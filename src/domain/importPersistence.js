import { prepareConfirmPayload } from './importConfirm';
import { annotateDuplicates, findDuplicateImport, ImportConfirmError } from './duplicates';
import { syncGroupsAfterRemovedTransactions } from './installments';

export async function confirmImportInDb(database, importId, options = {}) {
  return database.transaction(
    'rw',
    database.imports,
    database.importRows,
    database.transactions,
    database.installmentGroups,
    async () => {
      const imp = await database.imports.get(importId);
      if (!imp) throw new Error('Importação não encontrada');
      if (imp.status === 'confirmed') {
        throw new Error('Esta importação já foi confirmada.');
      }
      if (imp.status !== 'reviewing') {
        throw new Error('Esta importação não está em revisão.');
      }

      const allowDuplicateFile = Boolean(options.allowDuplicateFile || imp.allowDuplicateFile);
      const imports = await database.imports.toArray();
      const duplicateFile = findDuplicateImport(
        imports.filter((item) => item.id !== importId),
        imp.contentHash,
      );
      if (duplicateFile && !allowDuplicateFile) {
        throw new ImportConfirmError(
          'Este arquivo já foi importado e confirmado. Marque “Importar mesmo assim” para continuar.',
          'DUPLICATE_FILE',
          { duplicateImportId: duplicateFile.id },
        );
      }

      const staged = await database.importRows.where('importId').equals(importId).toArray();
      const groups = await database.installmentGroups.toArray();
      const transactions = await database.transactions.toArray();
      const livePosted = transactions.filter((tx) => tx.status !== 'ignored');
      const annotated = annotateDuplicates(staged, livePosted);

      const claimed = staged.filter((row) => row.include);
      const included = annotated.filter((row) => row.include);
      const blocked = annotated.filter(
        (row) => row.duplicateKind === 'exact' && !row.allowDuplicate && claimed.some((c) => c.id === row.id && c.include),
      );
      if (!included.length && blocked.length) {
        throw new ImportConfirmError(
          'Todas as linhas selecionadas já existem. Marque “É outra compra” nas duplicatas legítimas.',
          'DUPLICATE_ROWS',
          { count: blocked.length },
        );
      }

      if (annotated.length) await database.importRows.bulkPut(annotated);

      const payload = prepareConfirmPayload(annotated, {
        importId,
        accountId: imp.accountId,
        installmentGroups: groups,
        transactions,
      });

      const now = new Date().toISOString();
      if (payload.groupsToSave?.length) await database.installmentGroups.bulkPut(payload.groupsToSave);
      if (payload.transactionsToAdd.length) await database.transactions.bulkPut(payload.transactionsToAdd);
      await database.importRows.where('importId').equals(importId).delete();
      await database.imports.update(importId, {
        status: 'confirmed',
        transactionCount: payload.transactionsToAdd.length,
        totalCents: payload.transactionsToAdd.reduce((s, t) => s + t.amountCents, 0),
        confirmedAt: now,
        updatedAt: now,
        allowDuplicateFile,
        skippedDuplicates: blocked.length,
      });
      return { ...payload, skippedDuplicates: blocked.length };
    },
  );
}

export async function rollbackImportInDb(database, importId) {
  return database.transaction(
    'rw',
    database.imports,
    database.importRows,
    database.transactions,
    database.installmentGroups,
    async () => {
      const imp = await database.imports.get(importId);
      if (!imp) throw new Error('Importação não encontrada');
      if (imp.status === 'rolled_back') {
        return { alreadyRolledBack: true };
      }

      const removedTransactions = await database.transactions.where('importId').equals(importId).toArray();
      await database.transactions.where('importId').equals(importId).delete();
      await database.importRows.where('importId').equals(importId).delete();

      const remainingTransactions = await database.transactions.toArray();
      const groups = await database.installmentGroups.toArray();
      const { toDelete, toUpdate } = syncGroupsAfterRemovedTransactions({
        groups,
        remainingTransactions,
        removedTransactions,
        removedImportId: importId,
      });

      if (toDelete.length) {
        await Promise.all(toDelete.map((id) => database.installmentGroups.delete(id)));
      }
      if (toUpdate.length) await database.installmentGroups.bulkPut(toUpdate);

      await database.imports.update(importId, {
        status: 'rolled_back',
        updatedAt: new Date().toISOString(),
      });

      return { removed: removedTransactions.length, groupsDeleted: toDelete.length, groupsUpdated: toUpdate.length };
    },
  );
}

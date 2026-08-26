import { prepareConfirmPayload } from './importConfirm';
import { syncGroupsAfterRemovedTransactions } from './installments';

export async function confirmImportInDb(database, importId) {
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

      const staged = await database.importRows.where('importId').equals(importId).toArray();
      const groups = await database.installmentGroups.toArray();
      const transactions = await database.transactions.toArray();
      const payload = prepareConfirmPayload(staged, {
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
      });
      return payload;
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

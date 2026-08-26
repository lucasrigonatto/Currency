import { createId } from '../lib/id';
import { fingerprintTransaction } from '../lib/hash';
import { parseInstallment, rebuildInstallmentAssignments } from './installments';

export function buildTransactionRecord(input, previous, now = new Date().toISOString()) {
  const installment = parseInstallment(input.description);
  const amountCents = Number(input.amountCents);
  const merchant = input.merchant || input.description;
  const date = input.date;
  return {
    id: input.id || previous?.id || createId(),
    date,
    description: input.description,
    merchant,
    amountCents,
    type: input.type || 'expense',
    categoryId: input.categoryId || 'other',
    subcategoryId: input.subcategoryId || null,
    paymentMethod: input.paymentMethod || 'other',
    accountId: input.accountId || null,
    installmentCurrent: installment?.current || input.installmentCurrent || null,
    installmentTotal: installment?.total || input.installmentTotal || null,
    installmentGroupId: input.installmentGroupId || previous?.installmentGroupId || null,
    isRecurring: Boolean(input.isRecurring),
    recurrenceType: input.recurrenceType || null,
    notes: input.notes || '',
    source: input.source || previous?.source || 'manual',
    status: input.status || 'posted',
    isStatementMeta: Boolean(input.isStatementMeta),
    fingerprint: fingerprintTransaction({ date, amountCents, merchant }),
    importId: input.importId || previous?.importId || null,
    createdAt: input.createdAt || previous?.createdAt || now,
    updatedAt: now,
  };
}

export async function saveTransactionInDb(database, input) {
  return database.transaction('rw', database.transactions, database.installmentGroups, async () => {
    const now = new Date().toISOString();
    const previous = input.id ? await database.transactions.get(input.id) : null;
    const next = buildTransactionRecord(input, previous, now);
    const groups = await database.installmentGroups.toArray();
    const transactions = await database.transactions.toArray();
    const result = rebuildInstallmentAssignments({
      groups,
      transactions,
      savedTx: next,
    });
    if (result.transactionsToPut.length) await database.transactions.bulkPut(result.transactionsToPut);
    else await database.transactions.put(result.transaction || next);
    if (result.groupsToPut.length) await database.installmentGroups.bulkPut(result.groupsToPut);
    if (result.groupsToDelete.length) {
      await Promise.all(result.groupsToDelete.map((id) => database.installmentGroups.delete(id)));
    }
    return result.transaction || next;
  });
}

export async function deleteTransactionInDb(database, id) {
  return database.transaction('rw', database.transactions, database.installmentGroups, async () => {
    const previous = await database.transactions.get(id);
    if (!previous) return { deleted: false };
    const groups = await database.installmentGroups.toArray();
    const transactions = await database.transactions.toArray();
    const result = rebuildInstallmentAssignments({
      groups,
      transactions,
      deletedId: id,
    });
    await database.transactions.delete(id);
    if (result.transactionsToPut.length) await database.transactions.bulkPut(result.transactionsToPut);
    if (result.groupsToPut.length) await database.installmentGroups.bulkPut(result.groupsToPut);
    if (result.groupsToDelete.length) {
      await Promise.all(result.groupsToDelete.map((idToDelete) => database.installmentGroups.delete(idToDelete)));
    }
    return { deleted: true, groupsDeleted: result.groupsToDelete.length, groupsUpdated: result.groupsToPut.length };
  });
}

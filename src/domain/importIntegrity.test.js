import { db } from '../db';
import { normalizeParsedRow, revalidateReviewRow, isConfirmableRow } from './normalize';
import { prepareConfirmPayload } from './importConfirm';
import { confirmImportInDb, rollbackImportInDb } from './importPersistence';
import { remainingSchedule, syncGroupsAfterRemovedTransactions } from './installments';
import { futureCommitments } from './projections';

const RULES = [
  { id: '1', pattern: 'uber', categoryId: 'transportation', subcategoryId: 'transportation-rides', enabled: true, priority: 0 },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
  await db.close();
});

function installmentRow(overrides = {}) {
  return normalizeParsedRow(
    {
      id: 'row-notebook',
      date: '2026-08-08',
      description: 'Mercadolivre*Notebook - Parcela 3/10',
      amount: '360,00',
      ...overrides,
    },
    { rules: RULES, existingTransactions: [], accountId: 'card-nubank' },
  );
}

async function putReviewingImport(importId, rows, extra = {}) {
  await db.imports.put({
    id: importId,
    filename: extra.filename || 'nubank.csv',
    accountId: 'card-nubank',
    contentHash: extra.contentHash || `hash-${importId}`,
    status: 'reviewing',
    createdAt: new Date().toISOString(),
    ...extra,
  });
  await db.importRows.bulkPut(rows.map((row) => ({ ...row, id: row.id, importId })));
}

test('editing only the date of an invalid PDF line keeps the amount error', () => {
  const row = {
    id: 'pdf-1',
    date: null,
    description: 'Linha sem valor',
    amountCents: null,
    amountText: '',
    parseErrors: ['Data inválida', 'Valor inválido'],
    include: false,
    source: 'pdf',
  };
  const next = revalidateReviewRow(row, { date: '2026-08-21' }, { rules: RULES, existingTransactions: [], accountId: 'card-nubank' });
  expect(next.date).toBe('2026-08-21');
  expect(next.parseErrors).toContain('Valor inválido');
  expect(next.parseErrors).not.toContain('Data inválida');
  expect(next.include).toBe(false);
  expect(isConfirmableRow({ ...next, include: true })).toBe(false);
});

test('revalidating amount, description and date recalculates fingerprint and installment', () => {
  const row = installmentRow();
  const next = revalidateReviewRow(
    row,
    { description: 'Steam Games - Parcela 2/6', amountText: '79,99', date: '2026-07-15' },
    { rules: RULES, existingTransactions: [], accountId: 'card-nubank' },
  );
  expect(next.amountCents).toBe(7999);
  expect(next.installmentCurrent).toBe(2);
  expect(next.installmentTotal).toBe(6);
  expect(next.merchant.toLowerCase()).toContain('steam');
  expect(next.fingerprint).toContain('2026-07-15|7999|');
  expect(next.parseErrors).toEqual([]);
});

test('prepareConfirmPayload rejects included rows with null amount', () => {
  const row = {
    id: 'bad',
    include: true,
    date: '2026-08-01',
    description: 'Fantasma',
    amountCents: null,
    parseErrors: [],
  };
  expect(() => prepareConfirmPayload([row], { importId: 'imp1', accountId: 'card-nubank', installmentGroups: [], transactions: [] })).toThrow(/inválido/);
});

test('rollback of a new installment import removes the group and future commitments', async () => {
  const importId = 'imp-a';
  const row = { ...installmentRow(), id: 'row-notebook', include: true };
  await putReviewingImport(importId, [row]);
  await confirmImportInDb(db, importId);

  const groupsAfter = await db.installmentGroups.toArray();
  expect(groupsAfter).toHaveLength(1);
  const txs = await db.transactions.toArray();
  const committed = futureCommitments({
    fromMonth: '2026-08',
    months: 12,
    transactions: txs,
    installmentGroups: groupsAfter,
    recurring: [],
    planned: [],
  });
  expect(committed.some((m) => m.installments > 0)).toBe(true);

  await rollbackImportInDb(db, importId);
  expect(await db.transactions.count()).toBe(0);
  expect(await db.installmentGroups.count()).toBe(0);
  const afterRollback = futureCommitments({
    fromMonth: '2026-08',
    months: 12,
    transactions: [],
    installmentGroups: [],
    recurring: [],
    planned: [],
  });
  expect(afterRollback.every((m) => m.installments === 0)).toBe(true);
});

test('rollback of a later import recalculates paidThrough on a shared group', () => {
  const group = {
    id: 'g-shared',
    matchKey: 'card-nubank|mercadolivrenotebook|10|36000',
    totalInstallments: 10,
    installmentAmountCents: 36000,
    startDate: '2026-06-08',
    paidThrough: 3,
    createdByImportId: 'imp-1',
    sourceImportIds: ['imp-1', 'imp-2'],
  };
  const remaining = [
    { id: 't1', installmentGroupId: 'g-shared', installmentCurrent: 1, status: 'posted', date: '2026-06-08', importId: 'imp-1' },
    { id: 't2', installmentGroupId: 'g-shared', installmentCurrent: 2, status: 'posted', date: '2026-07-08', importId: 'imp-1' },
  ];
  const removed = [
    { id: 't3', installmentGroupId: 'g-shared', installmentCurrent: 3, status: 'posted', date: '2026-08-08', importId: 'imp-2' },
  ];
  const { toDelete, toUpdate } = syncGroupsAfterRemovedTransactions({
    groups: [group],
    remainingTransactions: remaining,
    removedTransactions: removed,
    removedImportId: 'imp-2',
  });
  expect(toDelete).toEqual([]);
  expect(toUpdate[0].paidThrough).toBe(2);
  expect(toUpdate[0].sourceImportIds).toEqual(['imp-1']);
  expect(remainingSchedule(toUpdate[0], remaining).remainingCount).toBe(8);
});

test('confirming twice does not duplicate transactions', async () => {
  const importId = 'imp-once';
  const row = { ...installmentRow({ description: 'Uber - NuPay', amount: '24,50' }), id: 'row-uber', include: true };
  await putReviewingImport(importId, [row]);
  const first = await confirmImportInDb(db, importId);
  await expect(confirmImportInDb(db, importId)).rejects.toThrow(/já foi confirmada/);
  expect(await db.transactions.count()).toBe(first.transactionsToAdd.length);
});

test('concurrent confirms serialize and keep a single set of transactions', async () => {
  const importId = 'imp-race';
  const row = { ...installmentRow({ description: 'Uber - NuPay', amount: '24,50' }), id: 'row-uber', include: true };
  await putReviewingImport(importId, [row]);
  const results = await Promise.allSettled([confirmImportInDb(db, importId), confirmImportInDb(db, importId)]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(await db.transactions.count()).toBe(1);
});

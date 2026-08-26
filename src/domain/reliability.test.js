import { db } from '../db';
import { normalizeParsedRow } from './normalize';
import { annotateDuplicates } from './duplicates';
import { prepareConfirmPayload } from './importConfirm';
import { confirmImportInDb } from './importPersistence';
import { groupKey, rebuildInstallmentAssignments } from './installments';
import { saveTransactionInDb, deleteTransactionInDb } from './transactionPersistence';
import { cashFlowProjection, futureCommitments } from './projections';
import { expandRecurringForMonth } from './recurring';

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

function purchase(overrides = {}) {
  return normalizeParsedRow(
    {
      id: 'row-uber',
      date: '2026-08-21',
      description: 'Uber - NuPay',
      amount: '22,99',
      ...overrides,
    },
    { rules: RULES, existingTransactions: [], accountId: 'card-nubank' },
  );
}

function installment(overrides = {}) {
  return normalizeParsedRow(
    {
      id: 'row-notebook',
      date: '2026-08-08',
      description: 'Mercadolivre*Notebook - Parcela 3/10',
      amount: '100,00',
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

test('two different imports of the same purchase cannot both confirm', async () => {
  const rowA = { ...purchase(), id: 'a1', include: true };
  const rowB = { ...purchase(), id: 'b1', include: true };
  await putReviewingImport('imp-a', [rowA], { contentHash: 'file-a' });
  await putReviewingImport('imp-b', [rowB], { contentHash: 'file-b' });
  await confirmImportInDb(db, 'imp-a');
  await expect(confirmImportInDb(db, 'imp-b')).rejects.toThrow(/já existem|outra compra/i);
  expect(await db.transactions.count()).toBe(1);
});

test('same file imported twice before any confirmation is blocked by contentHash', async () => {
  const rowA = { ...purchase(), id: 'a1', include: true };
  const rowB = { ...purchase(), id: 'b1', include: true };
  await putReviewingImport('imp-a', [rowA], { contentHash: 'same-bytes' });
  await putReviewingImport('imp-b', [rowB], { contentHash: 'same-bytes' });
  await confirmImportInDb(db, 'imp-a');
  await expect(confirmImportInDb(db, 'imp-b')).rejects.toThrow(/já foi importado/i);
  expect(await db.transactions.count()).toBe(1);
});

test('concurrent confirms of two reviews with the same purchase keep a single transaction', async () => {
  const rowA = { ...purchase(), id: 'a1', include: true };
  const rowB = { ...purchase(), id: 'b1', include: true };
  await putReviewingImport('imp-a', [rowA], { contentHash: 'file-a' });
  await putReviewingImport('imp-b', [rowB], { contentHash: 'file-b' });
  const results = await Promise.allSettled([confirmImportInDb(db, 'imp-a'), confirmImportInDb(db, 'imp-b')]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  expect(fulfilled.length).toBeGreaterThanOrEqual(1);
  expect(rejected.length).toBeGreaterThanOrEqual(1);
  expect(await db.transactions.count()).toBe(1);
});

test('legitimate identical purchases can be confirmed with allowDuplicate', async () => {
  const first = { ...purchase(), id: 'a1', include: true };
  const second = { ...purchase(), id: 'a2', include: true, allowDuplicate: true };
  const annotated = annotateDuplicates([first, second], []);
  expect(annotated[0].include).toBe(true);
  expect(annotated[1].intraFileDuplicate).toBe(true);
  expect(annotated[1].include).toBe(true);
  await putReviewingImport('imp-legit', annotated, { contentHash: 'two-ubers' });
  await confirmImportInDb(db, 'imp-legit');
  expect(await db.transactions.count()).toBe(2);
});

test('two equal installment purchases with different start months stay separate groups', () => {
  const june = { ...installment({ date: '2026-06-08', description: 'Mercadolivre*Notebook - Parcela 1/10' }), id: 'j1', include: true };
  const july = { ...installment({ date: '2026-07-08', description: 'Mercadolivre*Notebook - Parcela 1/10' }), id: 'j2', include: true };
  expect(groupKey({
    merchant: june.merchant,
    total: 10,
    amountCents: 10000,
    accountId: 'card-nubank',
    startDate: '2026-06-08',
  })).not.toBe(groupKey({
    merchant: july.merchant,
    total: 10,
    amountCents: 10000,
    accountId: 'card-nubank',
    startDate: '2026-07-08',
  }));
  const payload = prepareConfirmPayload([june, july], {
    importId: 'imp-two',
    accountId: 'card-nubank',
    installmentGroups: [],
    transactions: [],
  });
  expect(payload.groupsToSave).toHaveLength(2);
  expect(payload.groupsToSave[0].matchKey).toContain('2026-06');
  expect(payload.groupsToSave[1].matchKey).toContain('2026-07');
});

test('editing an installment transaction rebuilds fingerprint, group identity and paidThrough', async () => {
  const row = { ...installment(), id: 'nb1', include: true };
  await putReviewingImport('imp-edit', [row]);
  await confirmImportInDb(db, 'imp-edit');
  const [tx] = await db.transactions.toArray();
  expect((await db.installmentGroups.toArray())[0].matchKey).toContain('2026-06');

  const saved = await saveTransactionInDb(db, {
    ...tx,
    date: '2026-09-08',
    description: 'Mercadolivre*Notebook - Parcela 3/10',
    merchant: 'Mercadolivre*Notebook',
  });
  expect(saved.fingerprint).toContain('2026-09-08');
  const groups = await db.installmentGroups.toArray();
  expect(groups).toHaveLength(1);
  expect(groups[0].startDate).toBe('2026-07-08');
  expect(groups[0].matchKey).toContain('2026-07');
  expect(groups[0].paidThrough).toBe(3);
});

test('deleting the last installment transaction removes the orphan group', async () => {
  const row = { ...installment(), id: 'nb1', include: true };
  await putReviewingImport('imp-del', [row]);
  await confirmImportInDb(db, 'imp-del');
  const [tx] = await db.transactions.toArray();
  await deleteTransactionInDb(db, tx.id);
  expect(await db.transactions.count()).toBe(0);
  expect(await db.installmentGroups.count()).toBe(0);
});

test('manual Parcela n/m creates an installment group', () => {
  const tx = {
    id: 'manual-1',
    date: '2026-08-01',
    description: 'Loja X - Parcela 2/10',
    merchant: 'Loja X',
    amountCents: 5000,
    type: 'expense',
    status: 'posted',
    installmentCurrent: 2,
    installmentTotal: 10,
    accountId: 'card-nubank',
  };
  const result = rebuildInstallmentAssignments({ groups: [], transactions: [], savedTx: tx });
  expect(result.groupsToPut).toHaveLength(1);
  expect(result.groupsToPut[0].paidThrough).toBe(2);
  expect(result.groupsToPut[0].totalInstallments).toBe(10);
  expect(result.transaction.installmentGroupId).toBe(result.groupsToPut[0].id);
});

test('current-month projection subtracts posted recurring, variable spend and adds planned income', () => {
  const transactions = [
    { id: 'netflix', date: '2026-08-05', type: 'expense', status: 'posted', amountCents: 5590, merchant: 'Netflix', isRecurring: true, categoryId: 'subscriptions' },
    { id: 'grocery', date: '2026-08-10', type: 'expense', status: 'posted', amountCents: 20000, merchant: 'Supermercado', categoryId: 'food' },
    { id: 'salary', date: '2026-08-01', type: 'income', status: 'posted', amountCents: 500000, merchant: 'Salario' },
  ];
  const recurring = [
    { id: 'r1', merchant: 'Netflix', amountCents: 5590, averageCents: 5590, frequency: 'monthly', type: 'expense', isActive: true },
    { id: 'r2', merchant: 'Aluguel', amountCents: 150000, averageCents: 150000, frequency: 'monthly', type: 'expense', isActive: true },
  ];
  const planned = [
    { id: 'p1', description: 'Bonus', amountCents: 100000, type: 'income', frequency: 'once', date: '2026-08-20', isActive: true },
    { id: 'p2', description: 'Netflix', merchant: 'Netflix', amountCents: 5590, type: 'expense', frequency: 'monthly', startMonth: '2026-01', isActive: true },
  ];
  const rows = cashFlowProjection({
    fromMonth: '2026-08',
    months: 2,
    transactions,
    installmentGroups: [],
    recurring,
    planned,
  });
  expect(rows[0].income).toBe(600000);
  expect(rows[0].expensesConfirmed).toBe(25590);
  expect(rows[0].recurring).toBe(150000);
  expect(rows[0].planned).toBe(0);
  expect(rows[0].projectedAvailable).toBe(600000 - 25590 - 150000);
  expect(rows[1].income).toBe(0);
  expect(rows[1].recurring).toBe(155590);
});

test('yearly recurring created manually without startMonth uses createdAt', () => {
  const item = {
    merchant: 'IPVA',
    amountCents: 120000,
    averageCents: 120000,
    frequency: 'yearly',
    type: 'expense',
    isActive: true,
    createdAt: '2026-03-10T12:00:00.000Z',
  };
  expect(expandRecurringForMonth(item, '2026-03')).toHaveLength(1);
  expect(expandRecurringForMonth(item, '2026-04')).toHaveLength(0);
  expect(expandRecurringForMonth(item, '2027-03')).toHaveLength(1);
  const rows = futureCommitments({
    fromMonth: '2026-03',
    months: 13,
    transactions: [],
    installmentGroups: [],
    recurring: [item],
    planned: [],
  });
  expect(rows[0].recurring).toBe(120000);
  expect(rows[1].recurring).toBe(0);
  expect(rows[12].recurring).toBe(120000);
});

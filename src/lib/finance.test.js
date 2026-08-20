import { parseAmountToCents, fromCents } from './money';
import { parseInstallment, remainingSchedule, installmentStartDate } from '../domain/installments';
import { categorizeRecord } from '../domain/categorize';
import { findDuplicates } from '../domain/duplicates';
import { parseCsvText, rowsFromTabular } from '../import/csv';
import { detectColumns, normalizeParsedRow } from '../domain/normalize';
import { futureCommitments } from '../domain/projections';
import { parseStatementLine } from '../import/pdfText';

test('parses Brazilian and English amounts into cents', () => {
  expect(parseAmountToCents('22,99')).toBe(2299);
  expect(parseAmountToCents('"22,99"')).toBe(2299);
  expect(parseAmountToCents('- 2.869,65')).toBe(-286965);
  expect(parseAmountToCents('R$ 1.234,56')).toBe(123456);
  expect(parseAmountToCents('1,234.56')).toBe(123456);
  expect(fromCents(2299)).toBe(22.99);
});

test('parses Nubank installment suffix', () => {
  expect(parseInstallment('Mercadolivre*Purochar - Parcela 1/7')).toEqual({ current: 1, total: 7 });
  expect(parseInstallment('PURCHASE XYZ 03/10')).toEqual({ current: 3, total: 10 });
  expect(parseInstallment('Outback Goiania')).toBeNull();
  expect(parseInstallment('Something 14/07/2026')).toBeNull();
});

test('installment remaining value uses each month once', () => {
  const group = {
    id: 'g1',
    totalInstallments: 10,
    installmentAmountCents: 36000,
    startDate: '2026-06-08',
  };
  const posted = [
    { id: 't1', installmentGroupId: 'g1', installmentCurrent: 1, status: 'posted', date: '2026-06-08' },
    { id: 't2', installmentGroupId: 'g1', installmentCurrent: 2, status: 'posted', date: '2026-07-08' },
    { id: 't3', installmentGroupId: 'g1', installmentCurrent: 3, status: 'posted', date: '2026-08-08' },
  ];
  const schedule = remainingSchedule(group, posted);
  expect(schedule.paidCount).toBe(3);
  expect(schedule.remainingCount).toBe(7);
  expect(schedule.remainingCents).toBe(252000);
  expect(schedule.next.month).toBe('2026-09');
  expect(installmentStartDate('2026-08-08', 3)).toBe('2026-06-08');
});

test('rule-based categorization is deterministic', () => {
  const rules = [
    { id: '1', pattern: 'uber', categoryId: 'transportation', subcategoryId: 'transportation-rides', enabled: true, priority: 0 },
    { id: '2', pattern: 'netflix', categoryId: 'subscriptions', subcategoryId: 'subscriptions-streaming', enabled: true, priority: 1 },
    { id: '3', pattern: 'steam', categoryId: 'leisure', subcategoryId: 'leisure-games', enabled: true, priority: 2 },
  ];
  expect(categorizeRecord({ description: 'Uber - NuPay' }, rules).subcategoryId).toBe('transportation-rides');
  expect(categorizeRecord({ description: 'NETFLIX.COM' }, rules).subcategoryId).toBe('subscriptions-streaming');
  expect(categorizeRecord({ description: 'STEAM GAMES' }, rules).subcategoryId).toBe('leisure-games');
  expect(categorizeRecord({ description: 'Loja desconhecida' }, rules).confidence).toBe('unknown');
});

test('duplicate fingerprint matches same date, amount and merchant', () => {
  const existing = [{ id: 'a', date: '2026-07-21', amountCents: 2299, merchant: 'Uber', fingerprint: '2026-07-21|2299|uber', status: 'posted' }];
  const hit = findDuplicates({ date: '2026-07-21', amountCents: 2299, merchant: 'Uber - NuPay' }, existing);
  expect(hit.kind).toBe('likely');
});

test('parses Nubank CSV and normalizes rows', () => {
  const csv = `date,title,amount
2026-07-21,Uber - NuPay,"22,99"
2026-07-17,Pagamento recebido,"- 2.869,65"
2026-07-08,Mercadolivre*Purochar - Parcela 1/7,"57,00"`;
  const parsed = parseCsvText(csv);
  const columns = detectColumns(parsed.headers);
  const raw = rowsFromTabular(parsed, columns);
  const rules = [{ id: '1', pattern: 'uber', categoryId: 'transportation', subcategoryId: 'transportation-rides', enabled: true, priority: 0 }];
  const rows = raw.map((row) => normalizeParsedRow(row, { rules, existingTransactions: [], accountId: 'card-nubank' }));
  expect(rows[0].amountCents).toBe(2299);
  expect(rows[0].categoryId).toBe('transportation');
  expect(rows[1].isStatementMeta).toBe(true);
  expect(rows[1].include).toBe(false);
  expect(rows[2].installmentTotal).toBe(7);
});

test('cash-flow commitments keep future installments in later months', () => {
  const groups = [{
    id: 'g1',
    merchant: 'Notebook Store',
    totalInstallments: 10,
    installmentAmountCents: 36000,
    startDate: '2026-06-01',
    accountId: 'card-nubank',
  }];
  const transactions = [
    { id: '1', installmentGroupId: 'g1', installmentCurrent: 1, status: 'posted', date: '2026-06-01', type: 'expense', amountCents: 36000 },
    { id: '2', installmentGroupId: 'g1', installmentCurrent: 2, status: 'posted', date: '2026-07-01', type: 'expense', amountCents: 36000 },
    { id: '3', installmentGroupId: 'g1', installmentCurrent: 3, status: 'posted', date: '2026-08-01', type: 'expense', amountCents: 36000 },
  ];
  const rows = futureCommitments({
    fromMonth: '2026-08',
    months: 3,
    transactions,
    installmentGroups: groups,
    recurring: [],
    planned: [],
  });
  expect(rows[0].installments).toBe(0);
  expect(rows[1].installments).toBe(36000);
  expect(rows[2].installments).toBe(36000);
});

test('generic PDF line parser extracts date, merchant and amount', () => {
  const row = parseStatementLine('21 JUL Outback Goiania R$ 216,83', 2026);
  expect(row.date).toBe('2026-07-21');
  expect(row.description).toContain('Outback');
  expect(parseAmountToCents(row.amount)).toBe(21683);
});

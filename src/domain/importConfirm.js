import { createId } from '../lib/id';
import { monthKey } from '../lib/dates';
import { groupKey, installmentStartDate } from './installments';
import { detectRecurringCandidates } from './recurring';

export function prepareConfirmPayload(rows, { importId, accountId, installmentGroups, transactions }) {
  const selected = rows.filter((row) => row.include && row.parseErrors.length === 0);
  const groups = [...installmentGroups];
  const newGroups = [];
  const transactionsToAdd = [];

  selected.forEach((row) => {
    let installmentGroupId = null;
    if (row.installmentTotal) {
      const candidate = {
        merchant: row.merchant,
        total: row.installmentTotal,
        amountCents: Math.abs(row.amountCents),
        accountId,
      };
      const key = groupKey(candidate);
      let group = groups.find((g) => g.matchKey === key);
      if (!group) {
        group = {
          id: createId(),
          merchant: row.merchant,
          accountId,
          matchKey: key,
          totalInstallments: row.installmentTotal,
          installmentAmountCents: Math.abs(row.amountCents),
          totalAmountCents: Math.abs(row.amountCents) * row.installmentTotal,
          startDate: installmentStartDate(row.date, row.installmentCurrent || 1),
          createdAt: new Date().toISOString(),
        };
        groups.push(group);
        newGroups.push(group);
      }
      installmentGroupId = group.id;
    }

    transactionsToAdd.push({
      id: createId(),
      date: row.date,
      description: row.description,
      merchant: row.merchant,
      amountCents: row.type === 'income' ? Math.abs(row.amountCents) : row.amountCents,
      type: row.type,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      paymentMethod: row.paymentMethod || 'credit_card',
      accountId,
      installmentCurrent: row.installmentCurrent,
      installmentTotal: row.installmentTotal,
      installmentGroupId,
      isRecurring: Boolean(row.isRecurring),
      recurrenceType: row.isRecurring ? 'monthly' : null,
      notes: row.notes || '',
      source: row.source || 'import',
      status: 'posted',
      isStatementMeta: Boolean(row.isStatementMeta),
      fingerprint: row.fingerprint,
      importId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  const combined = [...transactions, ...transactionsToAdd];
  const recurringCandidates = detectRecurringCandidates(combined);

  return { selected, newGroups, transactionsToAdd, recurringCandidates };
}

export function statementPeriod(rows) {
  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  if (!dates.length) return { start: null, end: null, label: 'período desconhecido' };
  return { start: dates[0], end: dates[dates.length - 1], label: `${dates[0]} → ${dates[dates.length - 1]}` };
}

export function detectRecurringFlags(rows, recurring) {
  const merchants = new Set((recurring || []).filter((r) => r.isActive !== false).map((r) => String(r.merchant || '').toLowerCase()));
  return rows.map((row) => ({
    ...row,
    isRecurring: row.isRecurring || merchants.has(String(row.merchant || '').toLowerCase()),
  }));
}

export function monthFromRows(rows) {
  const dates = rows.map((r) => r.date).filter(Boolean);
  return dates.length ? monthKey(dates[0]) : null;
}

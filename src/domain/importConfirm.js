import { monthKey } from '../lib/dates';
import { findMatchingGroup, groupKey, installmentStartDate, purchaseKeyFromCandidate } from './installments';
import { detectRecurringCandidates } from './recurring';
import { isConfirmableRow } from './normalize';

export function transactionIdForImportRow(importId, row) {
  return `imp:${importId}:${row.id}`;
}

export function groupIdForImport(importId, matchKey) {
  return `ig:${importId}:${matchKey}`;
}

export function prepareConfirmPayload(rows, { importId, accountId, installmentGroups, transactions }) {
  const claimed = (rows || []).filter((row) => row.include);
  const invalid = claimed.filter((row) => !isConfirmableRow(row));
  if (invalid.length) {
    throw new Error(`Não é possível confirmar: ${invalid.length} linha(s) com data ou valor inválido.`);
  }

  const selected = claimed.filter(isConfirmableRow);
  const groups = installmentGroups.map((g) => ({ ...g }));
  const groupsToSave = [];
  const transactionsToAdd = [];

  selected.forEach((row) => {
    let installmentGroupId = null;
    if (row.installmentTotal) {
      const startDate = installmentStartDate(row.date, row.installmentCurrent || 1);
      const candidate = {
        merchant: row.merchant,
        total: row.installmentTotal,
        amountCents: Math.abs(row.amountCents),
        accountId,
        startDate,
        startMonth: monthKey(startDate),
      };
      const key = groupKey(candidate);
      const purchaseKey = purchaseKeyFromCandidate(candidate);
      let group = findMatchingGroup(groups, candidate);
      if (!group) {
        group = {
          id: groupIdForImport(importId, key),
          merchant: row.merchant,
          accountId,
          matchKey: key,
          purchaseKey,
          totalInstallments: row.installmentTotal,
          installmentAmountCents: Math.abs(row.amountCents),
          totalAmountCents: Math.abs(row.amountCents) * row.installmentTotal,
          startDate,
          paidThrough: row.installmentCurrent || 1,
          createdByImportId: importId,
          sourceImportIds: [importId],
          createdAt: new Date().toISOString(),
        };
        groups.push(group);
        groupsToSave.push(group);
      } else {
        group.matchKey = key;
        group.purchaseKey = group.purchaseKey || purchaseKey;
        group.paidThrough = Math.max(group.paidThrough || 0, row.installmentCurrent || 0);
        group.startDate = group.startDate || startDate;
        group.sourceImportIds = [...new Set([...(group.sourceImportIds || []), importId])];
        if (!groupsToSave.some((g) => g.id === group.id)) groupsToSave.push(group);
      }
      installmentGroupId = group.id;
    }

    transactionsToAdd.push({
      id: transactionIdForImportRow(importId, row),
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

  return { selected, newGroups: groupsToSave, groupsToSave, transactionsToAdd, recurringCandidates };
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

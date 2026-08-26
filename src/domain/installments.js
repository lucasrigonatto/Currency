import { addMonths, monthKey } from '../lib/dates';
import { stripInstallmentSuffix } from '../lib/text';

export function parseInstallment(description) {
  const text = String(description || '');
  const parcela = text.match(/parcela\s+(\d{1,2})\s*\/\s*(\d{1,2})/i);
  if (parcela) {
    return toInstallment(parcela[1], parcela[2]);
  }
  const dashed = text.match(/[-–—]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
  if (dashed) {
    return toInstallment(dashed[1], dashed[2]);
  }
  const trailing = text.match(/\s(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
  if (trailing) {
    return toInstallment(trailing[1], trailing[2]);
  }
  return null;
}

function toInstallment(currentRaw, totalRaw) {
  const current = Number(currentRaw);
  const total = Number(totalRaw);
  if (!Number.isInteger(current) || !Number.isInteger(total)) return null;
  if (current < 1 || total < 2 || current > total || total > 48) return null;
  return { current, total };
}

export function installmentStartDate(postedDate, current) {
  if (!postedDate || !current) return postedDate;
  return addMonths(postedDate, -(current - 1));
}

export function installmentDateFor(startDate, index) {
  return addMonths(startDate, index - 1);
}

export function groupKey({ merchant, total, amountCents, accountId }) {
  const name = stripInstallmentSuffix(merchant || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return `${accountId || ''}|${name}|${total}|${amountCents}`;
}

export function findMatchingGroup(groups, candidate) {
  const key = groupKey(candidate);
  return groups.find((g) => g.matchKey === key) || null;
}

export function remainingSchedule(group, postedTransactions) {
  const posted = postedTransactions.filter((t) => t.installmentGroupId === group.id && t.status !== 'ignored');
  const postedNumbers = new Set(posted.map((t) => t.installmentCurrent));
  const observedPaid = Math.max(
    Number(group.paidThrough) || 0,
    ...posted.map((t) => Number(t.installmentCurrent) || 0),
    0,
  );
  const anchor = posted.slice().sort((a, b) => (a.installmentCurrent || 0) - (b.installmentCurrent || 0))[0];
  const startDate = group.startDate || installmentStartDate(anchor?.date, anchor?.installmentCurrent || 1);
  const items = [];
  for (let i = 1; i <= group.totalInstallments; i += 1) {
    const date = installmentDateFor(startDate, i);
    items.push({
      n: i,
      date,
      month: monthKey(date),
      amountCents: group.installmentAmountCents,
      posted: postedNumbers.has(i) || i <= observedPaid,
    });
  }
  const paidCount = items.filter((i) => i.posted).length;
  const remaining = items.filter((i) => !i.posted);
  return {
    startDate,
    items,
    paidCount,
    remainingCount: remaining.length,
    paidCents: paidCount * group.installmentAmountCents,
    remainingCents: remaining.length * group.installmentAmountCents,
    next: remaining[0] || null,
    last: items[items.length - 1],
    remaining,
  };
}

export function isFixedExpense(tx) {
  if (!tx || tx.type !== 'expense' || tx.isStatementMeta) return false;
  if (tx.isRecurring || tx.installmentGroupId) return true;
  return ['housing', 'subscriptions', 'financial'].includes(tx.categoryId);
}

export function syncGroupsAfterRemovedTransactions({
  groups,
  remainingTransactions,
  removedTransactions,
  removedImportId,
}) {
  const remainingByGroup = new Map();
  remainingTransactions.forEach((tx) => {
    if (!tx.installmentGroupId) return;
    if (!remainingByGroup.has(tx.installmentGroupId)) remainingByGroup.set(tx.installmentGroupId, []);
    remainingByGroup.get(tx.installmentGroupId).push(tx);
  });

  const touchedIds = new Set(
    (removedTransactions || [])
      .map((tx) => tx.installmentGroupId)
      .filter(Boolean),
  );

  const toDelete = [];
  const toUpdate = [];

  groups.forEach((group) => {
    const originatedHere = group.createdByImportId === removedImportId;
    const sourcedHere = (group.sourceImportIds || []).includes(removedImportId);
    const touched = originatedHere || sourcedHere || touchedIds.has(group.id);
    if (!touched) return;

    const txs = remainingByGroup.get(group.id) || [];
    if (txs.length === 0) {
      toDelete.push(group.id);
      return;
    }

    const paidThrough = Math.max(0, ...txs.map((t) => Number(t.installmentCurrent) || 0));
    const anchor = txs.slice().sort((a, b) => (a.installmentCurrent || 0) - (b.installmentCurrent || 0))[0];
    toUpdate.push({
      ...group,
      paidThrough,
      startDate: installmentStartDate(anchor.date, anchor.installmentCurrent || 1),
      sourceImportIds: (group.sourceImportIds || []).filter((id) => id !== removedImportId),
    });
  });

  return { toDelete, toUpdate };
}

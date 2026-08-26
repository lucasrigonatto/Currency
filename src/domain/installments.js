import { addMonths, monthKey } from '../lib/dates';
import { fingerprintTransaction } from '../lib/hash';
import { createId } from '../lib/id';
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

export function groupKey({ merchant, total, amountCents, accountId, startDate, startMonth }) {
  const name = stripInstallmentSuffix(merchant || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  const month = startMonth || monthKey(startDate) || '';
  return `${accountId || ''}|${name}|${total}|${amountCents}|${month}`;
}

export function groupKeyPrefix({ merchant, total, amountCents, accountId }) {
  const name = stripInstallmentSuffix(merchant || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return `${accountId || ''}|${name}|${total}|${amountCents}`;
}

export function purchaseKeyFromCandidate(candidate) {
  return groupKey(candidate);
}

export function findMatchingGroup(groups, candidate) {
  const key = groupKey(candidate);
  const exact = (groups || []).find((g) => g.matchKey === key || g.purchaseKey === key);
  if (exact) return exact;
  const prefix = groupKeyPrefix(candidate);
  const matches = (groups || []).filter(
    (g) => g.matchKey === prefix || String(g.matchKey || '').startsWith(`${prefix}|`),
  );
  if (matches.length === 1) return matches[0];
  return null;
}

export function candidateFromTransaction(tx) {
  const startDate = installmentStartDate(tx.date, tx.installmentCurrent || 1);
  const candidate = {
    merchant: tx.merchant,
    total: tx.installmentTotal,
    amountCents: Math.abs(tx.amountCents),
    accountId: tx.accountId,
    startDate,
    startMonth: monthKey(startDate),
  };
  const key = groupKey(candidate);
  return {
    ...candidate,
    matchKey: key,
    purchaseKey: key,
    installmentTotal: tx.installmentTotal,
  };
}

export function remainingSchedule(group, postedTransactions) {
  const total = group.totalInstallments || group.installmentTotal || 0;
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
  for (let i = 1; i <= total; i += 1) {
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
    const startDate = installmentStartDate(anchor.date, anchor.installmentCurrent || 1);
    toUpdate.push({
      ...group,
      paidThrough,
      startDate,
      matchKey: groupKey({
        merchant: group.merchant,
        total: group.totalInstallments,
        amountCents: group.installmentAmountCents,
        accountId: group.accountId,
        startDate,
      }),
      purchaseKey: group.purchaseKey || group.matchKey,
      sourceImportIds: (group.sourceImportIds || []).filter((id) => id !== removedImportId),
    });
  });

  return { toDelete, toUpdate };
}

function isInstallmentTx(tx) {
  return Boolean(tx && Number(tx.installmentTotal) > 1 && tx.status !== 'ignored');
}

function groupRecordFromCluster(txs, existing) {
  const candidate = candidateFromTransaction(txs[0]);
  const paidThrough = Math.max(0, ...txs.map((t) => Number(t.installmentCurrent) || 0));
  const anchor = txs.slice().sort((a, b) => (a.installmentCurrent || 0) - (b.installmentCurrent || 0))[0];
  const startDate = installmentStartDate(anchor.date, anchor.installmentCurrent || 1);
  const sample = txs[0];
  const remainingInstallments = Math.max(0, candidate.installmentTotal - paidThrough);
  const base = {
    merchant: candidate.merchant,
    accountId: candidate.accountId,
    matchKey: candidate.matchKey,
    purchaseKey: candidate.purchaseKey,
    category: sample.categoryId,
    subcategory: sample.subcategoryId,
    installmentAmountCents: candidate.amountCents,
    totalInstallments: candidate.installmentTotal,
    totalAmountCents: candidate.amountCents * candidate.installmentTotal,
    remainingAmountCents: remainingInstallments * candidate.amountCents,
    remainingInstallments,
    paidThrough,
    startDate,
    status: paidThrough >= candidate.installmentTotal ? 'paid' : 'active',
  };

  if (existing) {
    return {
      ...existing,
      ...base,
      sourceImportIds: existing.sourceImportIds || [],
    };
  }

  return {
    id: createId(),
    ...base,
    sourceImportIds: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Recluster installment transactions after a create/update/delete.
 * Manual "Parcela n/m" rows get a group so they appear in future commitments.
 */
export function rebuildInstallmentAssignments({ groups, transactions, savedTx, deletedId }) {
  const remaining = (transactions || []).filter((tx) => tx.id !== deletedId && tx.id !== savedTx?.id);
  const byId = new Map(remaining.map((tx) => [tx.id, { ...tx }]));
  if (savedTx) byId.set(savedTx.id, { ...savedTx });

  const live = Array.from(byId.values()).map((tx) => ({
    ...tx,
    fingerprint: fingerprintTransaction(tx),
  }));

  const clusters = new Map();
  live.filter(isInstallmentTx).forEach((tx) => {
    const key = candidateFromTransaction(tx).matchKey;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(tx);
  });

  const usedGroupIds = new Set();
  const nextGroups = [];
  const assigned = new Map();

  clusters.forEach((txs) => {
    const candidate = candidateFromTransaction(txs[0]);
    const available = (groups || []).filter((g) => !usedGroupIds.has(g.id));
    const existing = findMatchingGroup(available, candidate);
    const group = groupRecordFromCluster(txs, existing);
    usedGroupIds.add(group.id);
    nextGroups.push(group);
    txs.forEach((tx) => {
      assigned.set(tx.id, {
        ...tx,
        installmentGroupId: group.id,
        fingerprint: fingerprintTransaction(tx),
      });
    });
  });

  const groupsToDelete = (groups || []).filter((g) => !usedGroupIds.has(g.id)).map((g) => g.id);
  const originalById = new Map((transactions || []).map((tx) => [tx.id, tx]));
  const transactionsToPut = [];

  live.forEach((tx) => {
    const clustered = assigned.get(tx.id);
    const next = clustered || {
      ...tx,
      installmentGroupId: isInstallmentTx(tx) ? tx.installmentGroupId : undefined,
      fingerprint: fingerprintTransaction(tx),
    };
    if (!isInstallmentTx(next)) {
      next.installmentGroupId = undefined;
    }
    byId.set(tx.id, next);
    const before = originalById.get(tx.id);
    const changed =
      tx.id === savedTx?.id ||
      !before ||
      before.installmentGroupId !== next.installmentGroupId ||
      before.fingerprint !== next.fingerprint ||
      before.paidThrough !== next.paidThrough;
    if (changed) transactionsToPut.push(next);
  });

  return {
    groupsToPut: nextGroups,
    groupsToDelete,
    transactionsToPut,
    transaction: savedTx ? byId.get(savedTx.id) : null,
  };
}

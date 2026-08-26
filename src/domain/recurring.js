import { monthKey } from '../lib/dates';
import { normalizeText } from '../lib/text';

const AMOUNT_TOLERANCE = 0.15;

export function detectRecurringCandidates(transactions) {
  const posted = transactions.filter(
    (t) => t.status === 'posted' && t.type === 'expense' && !t.isStatementMeta && t.merchant,
  );
  const byMerchant = new Map();
  posted.forEach((tx) => {
    const key = normalizeText(tx.merchant);
    if (!key) return;
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key).push(tx);
  });

  const candidates = [];
  byMerchant.forEach((rows, merchantKey) => {
    const months = new Map();
    rows.forEach((tx) => {
      const mk = monthKey(tx.date);
      if (!months.has(mk)) months.set(mk, []);
      months.get(mk).push(tx);
    });
    if (months.size < 2) return;
    const monthlyTotals = [...months.values()].map((list) => list.reduce((s, t) => s + t.amountCents, 0));
    const avg = monthlyTotals.reduce((s, n) => s + n, 0) / monthlyTotals.length;
    if (avg <= 0) return;
    const stable = monthlyTotals.every((n) => Math.abs(n - avg) / avg <= AMOUNT_TOLERANCE);
    const sample = rows[0];
    candidates.push({
      merchant: sample.merchant,
      merchantKey,
      frequency: 'monthly',
      occurrences: rows.length,
      months: months.size,
      averageCents: Math.round(avg),
      yearlyCents: Math.round(avg * 12),
      categoryId: sample.categoryId,
      subcategoryId: sample.subcategoryId,
      accountId: sample.accountId,
      stable,
      sampleDescription: sample.description,
    });
  });

  return candidates.sort((a, b) => b.averageCents - a.averageCents);
}

export function recurringStartMonth(item) {
  if (!item) return null;
  return item.startMonth || monthKey(item.date) || monthKey(item.createdAt) || null;
}

export function expandRecurringForMonth(item, month) {
  if (!item || item.isActive === false) return [];
  const start = recurringStartMonth(item);
  if (item.frequency === 'once') {
    return monthKey(item.date) === month || start === month ? [item] : [];
  }
  if (item.endMonth && item.endMonth < month) return [];
  if (start && start > month) return [];
  if (item.frequency === 'yearly') {
    if (!start) return [];
    return start.slice(5) === month.slice(5) ? [item] : [];
  }
  return [item];
}

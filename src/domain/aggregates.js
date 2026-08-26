import { inMonth, monthKey } from '../lib/dates';
import { isFixedExpense } from './installments';

export function isPostedSpend(tx) {
  return tx.status === 'posted' && tx.type === 'expense' && !tx.isStatementMeta;
}

export function isPostedIncome(tx) {
  return tx.status === 'posted' && tx.type === 'income' && !tx.isStatementMeta;
}

export function monthTransactions(transactions, month) {
  return transactions.filter((tx) => inMonth(tx.date, month));
}

export function dashboardSummary(transactions, month) {
  const rows = monthTransactions(transactions, month);
  const posted = rows.filter((tx) => tx.status === 'posted' && !tx.isStatementMeta);
  const income = posted.filter(isPostedIncome).reduce((s, t) => s + t.amountCents, 0);
  const expenses = posted.filter(isPostedSpend).reduce((s, t) => s + t.amountCents, 0);
  const investments = posted.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amountCents, 0);
  const creditCard = posted
    .filter((t) => isPostedSpend(t) && t.paymentMethod === 'credit_card')
    .reduce((s, t) => s + t.amountCents, 0);
  const fixed = posted.filter(isFixedExpense).reduce((s, t) => s + t.amountCents, 0);
  const variable = expenses - fixed;
  return {
    income,
    expenses,
    investments,
    available: income - expenses - investments,
    creditCard,
    fixed,
    variable,
    count: posted.length,
  };
}

export function groupSum(transactions, pickKey, extra = () => ({})) {
  const map = new Map();
  transactions.forEach((tx) => {
    const key = pickKey(tx) || '—';
    if (!map.has(key)) map.set(key, { key, amountCents: 0, count: 0, ...extra(tx) });
    const row = map.get(key);
    row.amountCents += tx.amountCents;
    row.count += 1;
  });
  return [...map.values()].sort((a, b) => b.amountCents - a.amountCents);
}

export function filterTransactions(transactions, filters = {}) {
  return transactions.filter((tx) => {
    if (filters.status && tx.status !== filters.status) return false;
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.categoryId && tx.categoryId !== filters.categoryId) return false;
    if (filters.subcategoryId && tx.subcategoryId !== filters.subcategoryId) return false;
    if (filters.accountId && tx.accountId !== filters.accountId) return false;
    if (filters.merchant) {
      const q = filters.merchant.toLowerCase();
      if (!String(tx.merchant || '').toLowerCase().includes(q)) return false;
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const blob = `${tx.description || ''} ${tx.merchant || ''} ${tx.notes || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (filters.from && tx.date < filters.from) return false;
    if (filters.to && tx.date > filters.to) return false;
    if (filters.minCents != null && tx.amountCents < filters.minCents) return false;
    if (filters.maxCents != null && tx.amountCents > filters.maxCents) return false;
    if (filters.installment === 'yes' && !tx.installmentGroupId) return false;
    if (filters.installment === 'no' && tx.installmentGroupId) return false;
    if (filters.recurring === 'yes' && !tx.isRecurring) return false;
    if (filters.recurring === 'no' && tx.isRecurring) return false;
    if (filters.hideMeta && tx.isStatementMeta) return false;
    return true;
  });
}

export function categoryLookup(categories) {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
  return {
    byId,
    nameOf(id) {
      return byId[id]?.name || '—';
    },
    pathOf(tx) {
      const cat = byId[tx.categoryId];
      const sub = byId[tx.subcategoryId];
      if (cat && sub) return `${cat.name} › ${sub.name}`;
      return cat?.name || 'Outros';
    },
    parents() {
      return categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    childrenOf(id) {
      return categories.filter((c) => c.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder);
    },
  };
}

export function monthKeysFromTransactions(transactions) {
  const set = new Set(transactions.map((t) => monthKey(t.date)).filter(Boolean));
  return [...set].sort();
}

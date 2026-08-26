import { addMonthsKey } from '../lib/dates';
import { remainingSchedule } from './installments';
import { expandRecurringForMonth, recurringStartMonth } from './recurring';
import { dashboardSummary, isPostedSpend, monthTransactions } from './aggregates';
import { compactText } from '../lib/text';

function amountOf(item) {
  return Math.abs(item.averageCents || item.amountCents || 0);
}

function itemKey(item) {
  return compactText(item.merchant || item.description || '');
}

function similarKeys(a, b) {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function similarAmounts(a, b) {
  if (!a || !b) return true;
  return Math.abs(a - b) / Math.max(a, b, 1) <= 0.15;
}

function isCoveredByPosted(item, postedInMonth) {
  const key = itemKey(item);
  const amount = amountOf(item);
  const wantIncome = item.type === 'income';
  return (postedInMonth || []).some((tx) => {
    if (tx.status === 'ignored' || tx.isStatementMeta) return false;
    if (wantIncome && tx.type !== 'income') return false;
    if (!wantIncome && tx.type !== 'expense') return false;
    const txKey = compactText(tx.merchant || tx.description || '');
    if (!similarKeys(key, txKey)) return false;
    return similarAmounts(amount, Math.abs(tx.amountCents || 0));
  });
}

function plannedCoveredByRecurring(plannedItem, recurringItems) {
  const key = itemKey(plannedItem);
  const amount = amountOf(plannedItem);
  return (recurringItems || []).some((item) => {
    if ((item.type || 'expense') !== (plannedItem.type || 'expense')) return false;
    if (!similarKeys(key, itemKey(item))) return false;
    return similarAmounts(amount, amountOf(item));
  });
}

function asRecurringLike(item) {
  return {
    ...item,
    isActive: item.isActive !== false,
    startMonth: recurringStartMonth(item),
    frequency: item.frequency || 'once',
  };
}

function centsForHits(item, month) {
  return expandRecurringForMonth(asRecurringLike(item), month).reduce(
    (sum, hit) => sum + (hit.averageCents || hit.amountCents || 0),
    0,
  );
}

function stillExpectedCents(items, month, postedInMonth, extraSkip = () => false) {
  return items.reduce((sum, item) => {
    if (item.isActive === false) return sum;
    if (extraSkip(item)) return sum;
    if (isCoveredByPosted(item, postedInMonth)) return sum;
    return sum + centsForHits(item, month);
  }, 0);
}

export function futureCommitments({
  fromMonth,
  months = 12,
  transactions,
  installmentGroups,
  recurring,
  planned,
}) {
  const keys = [];
  for (let i = 0; i < months; i += 1) keys.push(addMonthsKey(fromMonth, i));

  const posted = transactions.filter((t) => t.status === 'posted');
  const activeRecurring = (recurring || []).filter((item) => item.isActive !== false && item.type !== 'income');
  const activePlanned = (planned || []).filter((item) => item.isActive !== false && item.type === 'expense');

  return keys.map((month) => {
    const installmentCents = installmentGroups.reduce((sum, group) => {
      const schedule = remainingSchedule(group, posted);
      return sum + schedule.remaining.filter((item) => item.month === month).reduce((s, i) => s + i.amountCents, 0);
    }, 0);

    const postedInMonth = monthTransactions(posted, month);
    const recurringCents = stillExpectedCents(activeRecurring, month, postedInMonth);
    const plannedCents = stillExpectedCents(activePlanned, month, postedInMonth, (item) =>
      plannedCoveredByRecurring(item, activeRecurring),
    );

    const postedFixed = postedInMonth
      .filter((t) => isPostedSpend(t) && (t.isRecurring || ['housing', 'subscriptions', 'financial'].includes(t.categoryId)))
      .reduce((s, t) => s + t.amountCents, 0);

    const isCurrentOrPast = month <= fromMonth;
    const fixed = isCurrentOrPast ? postedFixed : 0;

    return {
      month,
      installments: installmentCents,
      recurring: recurringCents,
      fixed,
      planned: plannedCents,
      total: installmentCents + recurringCents + fixed + plannedCents,
    };
  });
}

export function cashFlowProjection({
  fromMonth,
  months = 12,
  transactions,
  installmentGroups,
  recurring,
  planned,
}) {
  const commitments = futureCommitments({
    fromMonth,
    months,
    transactions,
    installmentGroups,
    recurring,
    planned,
  });

  const activeIncomeRecurring = (recurring || []).filter((item) => item.isActive !== false && item.type === 'income');
  const activeIncomePlanned = (planned || []).filter((item) => item.isActive !== false && item.type === 'income');

  return commitments.map((row) => {
    const posted = dashboardSummary(transactions, row.month);
    const postedInMonth = monthTransactions(
      transactions.filter((t) => t.status === 'posted'),
      row.month,
    );
    const incomeRecurring = stillExpectedCents(activeIncomeRecurring, row.month, postedInMonth);
    const incomePlanned = stillExpectedCents(activeIncomePlanned, row.month, postedInMonth, (item) =>
      plannedCoveredByRecurring(item, activeIncomeRecurring),
    );
    const expectedIncome = posted.income + incomeRecurring + incomePlanned;
    const stillExpectedExpenses = row.installments + row.recurring + row.planned;
    const projectedAvailable = expectedIncome - posted.expenses - stillExpectedExpenses;

    return {
      ...row,
      income: expectedIncome,
      incomeConfirmed: posted.income,
      incomePlanned,
      incomeRecurring,
      expensesConfirmed: posted.expenses,
      committed: posted.expenses + stillExpectedExpenses,
      projectedAvailable,
      kinds: {
        confirmed: posted.expenses,
        recurring: row.recurring,
        planned: row.planned,
        installments: row.installments,
      },
    };
  });
}

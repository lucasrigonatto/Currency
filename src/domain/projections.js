import { addMonthsKey, monthKey } from '../lib/dates';
import { remainingSchedule } from './installments';
import { expandRecurringForMonth } from './recurring';
import { dashboardSummary, isPostedSpend, monthTransactions } from './aggregates';

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

  return keys.map((month) => {
    const installmentCents = installmentGroups.reduce((sum, group) => {
      const schedule = remainingSchedule(group, posted);
      return sum + schedule.remaining.filter((item) => item.month === month).reduce((s, i) => s + i.amountCents, 0);
    }, 0);

    const recurringItems = recurring.filter((item) => item.isActive !== false && item.type !== 'income');
    const recurringCents = recurringItems.reduce((sum, item) => {
      const hits = expandRecurringForMonth(item, month);
      return sum + hits.reduce((s, hit) => s + (hit.averageCents || hit.amountCents || 0), 0);
    }, 0);

    const plannedItems = planned.filter((item) => item.isActive !== false && item.type === 'expense');
    const plannedCents = plannedItems.reduce((sum, item) => {
      const hits = expandRecurringForMonth(
        {
          ...item,
          startMonth: item.startMonth || monthKey(item.date),
          frequency: item.frequency || 'once',
        },
        month,
      );
      return sum + hits.reduce((s, hit) => s + (hit.amountCents || 0), 0);
    }, 0);

    const postedFixed = monthTransactions(posted, month)
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

  return commitments.map((row, index) => {
    const incomeRecurring = recurring
      .filter((item) => item.isActive !== false && item.type === 'income')
      .reduce((sum, item) => sum + expandRecurringForMonth(item, row.month).reduce((s, hit) => s + (hit.averageCents || hit.amountCents || 0), 0), 0);

    const incomePlanned = planned
      .filter((item) => item.isActive !== false && item.type === 'income')
      .reduce((sum, item) => {
        const hits = expandRecurringForMonth(
          { ...item, startMonth: item.startMonth || monthKey(item.date), frequency: item.frequency || 'once' },
          row.month,
        );
        return sum + hits.reduce((s, hit) => s + (hit.amountCents || 0), 0);
      }, 0);

    const posted = dashboardSummary(transactions, row.month);
    const isPastOrCurrent = index === 0;
    const expectedIncome = isPastOrCurrent && posted.income ? posted.income : incomeRecurring + incomePlanned;

    return {
      ...row,
      income: expectedIncome,
      incomeConfirmed: isPastOrCurrent ? posted.income : 0,
      incomePlanned: incomePlanned,
      incomeRecurring,
      expensesConfirmed: isPastOrCurrent ? posted.expenses : 0,
      committed: row.total,
      projectedAvailable: expectedIncome - row.total - (isPastOrCurrent ? 0 : 0),
      kinds: {
        confirmed: isPastOrCurrent ? posted.expenses : 0,
        recurring: row.recurring,
        planned: row.planned,
        installments: row.installments,
      },
    };
  });
}

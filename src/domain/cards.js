import { currentMonthKey, monthKey, toIsoDate } from '../lib/dates';
import { remainingSchedule } from './installments';
import { isPostedSpend } from './aggregates';

export function cardCycleDates(card, fromDate = new Date()) {
  const closingDay = Number(card.closingDay) || 1;
  const dueDay = Number(card.dueDay) || closingDay;
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth();
  let closing = new Date(year, month, Math.min(closingDay, daysIn(year, month)));
  if (fromDate > closing) closing = new Date(year, month + 1, Math.min(closingDay, daysIn(year, month + 1)));
  const dueMonthOffset = dueDay <= closingDay ? 1 : 0;
  const dueBase = new Date(closing.getFullYear(), closing.getMonth() + dueMonthOffset, 1);
  const due = new Date(dueBase.getFullYear(), dueBase.getMonth(), Math.min(dueDay, daysIn(dueBase.getFullYear(), dueBase.getMonth())));
  return { closingDate: toIsoDate(closing), dueDate: toIsoDate(due) };
}

function daysIn(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function cardMetrics(card, { transactions, installmentGroups }) {
  const month = currentMonthKey();
  const spend = transactions.filter(
    (t) => t.accountId === card.id && isPostedSpend(t) && monthKey(t.date) === month,
  );
  const statementCents = spend.reduce((s, t) => s + t.amountCents, 0);
  const future = installmentGroups
    .filter((g) => g.accountId === card.id)
    .reduce((sum, group) => sum + remainingSchedule(group, transactions).remainingCents, 0);
  const limit = card.creditLimitCents || 0;
  const available = limit ? limit - statementCents - future : null;
  const cycle = cardCycleDates(card);
  return { statementCents, future, available, limit, ...cycle };
}

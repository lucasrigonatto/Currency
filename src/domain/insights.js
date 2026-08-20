import { addMonthsKey } from '../lib/dates';
import { dashboardSummary, groupSum, isPostedSpend, monthTransactions } from './aggregates';
import { remainingSchedule } from './installments';

export function monthlyComparison({ transactions, month, categories }) {
  const current = dashboardSummary(transactions, month);
  const previousMonth = addMonthsKey(month, -1);
  const previous = dashboardSummary(transactions, previousMonth);
  const yearAgo = addMonthsKey(month, -12);
  const sameMonthLastYear = dashboardSummary(transactions, yearAgo);

  const monthsWithData = new Set(
    transactions.filter(isPostedSpend).map((t) => t.date.slice(0, 7)),
  );
  const monthCount = Math.max(monthsWithData.size, 1);
  const avgExpenses =
    transactions.filter(isPostedSpend).reduce((s, t) => s + t.amountCents, 0) / monthCount;

  const currentCats = groupSum(
    monthTransactions(transactions, month).filter(isPostedSpend),
    (t) => t.categoryId,
  );
  const prevCats = groupSum(
    monthTransactions(transactions, previousMonth).filter(isPostedSpend),
    (t) => t.categoryId,
  );
  const avgByCat = groupSum(transactions.filter(isPostedSpend), (t) => t.categoryId).map((row) => ({
    ...row,
    amountCents: Math.round(row.amountCents / monthCount),
  }));

  const byId = Object.fromEntries((categories || []).map((c) => [c.id, c]));
  const catRows = currentCats.map((row) => {
    const prev = prevCats.find((p) => p.key === row.key)?.amountCents || 0;
    const avg = avgByCat.find((p) => p.key === row.key)?.amountCents || 0;
    const diffPct = prev ? ((row.amountCents - prev) / prev) * 100 : null;
    const vsAvg = avg ? ((row.amountCents - avg) / avg) * 100 : null;
    return {
      categoryId: row.key,
      name: byId[row.key]?.name || row.key,
      current: row.amountCents,
      previous: prev,
      average: avg,
      diffPct,
      vsAvg,
    };
  });

  return {
    current,
    previous,
    sameMonthLastYear,
    hasYearAgo: sameMonthLastYear.expenses > 0 || sameMonthLastYear.income > 0,
    averageExpenses: Math.round(avgExpenses),
    categories: catRows,
  };
}

export function buildInsights({ transactions, month, installmentGroups, recurring, categories }) {
  const insights = [];
  const comparison = monthlyComparison({ transactions, month, categories });
  const currentSpend = monthTransactions(transactions, month).filter(isPostedSpend);
  const byCat = groupSum(currentSpend, (t) => t.categoryId);
  const byId = Object.fromEntries((categories || []).map((c) => [c.id, c]));

  if (byCat[0]) {
    insights.push({
      id: 'top-category',
      title: `Maior categoria do mês: ${byId[byCat[0].key]?.name || byCat[0].key}`,
      detail: `${formatHint(byCat[0].amountCents)} em ${byCat[0].count} lançamentos.`,
    });
  }

  comparison.categories.forEach((row) => {
    if (row.vsAvg != null && Math.abs(row.vsAvg) >= 15 && row.current > 5000) {
      const dir = row.vsAvg > 0 ? 'acima' : 'abaixo';
      insights.push({
        id: `vs-avg-${row.categoryId}`,
        title: `${row.name} está ${Math.abs(row.vsAvg).toFixed(0)}% ${dir} da média mensal.`,
        detail: `Este mês: ${formatHint(row.current)}. Média: ${formatHint(row.average)}.`,
      });
    }
  });

  const remainingInstallments = installmentGroups.reduce(
    (acc, group) => {
      const schedule = remainingSchedule(
        group,
        transactions.filter((t) => t.status === 'posted'),
      );
      acc.cents += schedule.remainingCents;
      acc.count += schedule.remainingCount > 0 ? 1 : 0;
      acc.remainingCount += schedule.remainingCount;
      return acc;
    },
    { cents: 0, count: 0, remainingCount: 0 },
  );

  if (remainingInstallments.count) {
    insights.push({
      id: 'installments',
      title: `Há ${remainingInstallments.count} compras parceladas ativas.`,
      detail: `${formatHint(remainingInstallments.cents)} ainda comprometidos em ${remainingInstallments.remainingCount} parcelas futuras.`,
    });
  }

  const activeRecurring = (recurring || []).filter((r) => r.isActive !== false && r.type !== 'income');
  const recurringMonthly = activeRecurring.reduce((s, r) => s + (r.averageCents || r.amountCents || 0), 0);
  if (activeRecurring.length) {
    insights.push({
      id: 'recurring',
      title: `Assinaturas e recorrentes somam cerca de ${formatHint(recurringMonthly)}/mês.`,
      detail: `${activeRecurring.length} itens · ${formatHint(recurringMonthly * 12)} projetados no ano.`,
    });
  }

  const leisure = currentSpend.filter((t) => t.categoryId === 'leisure');
  if (leisure.length) {
    insights.push({
      id: 'leisure',
      title: `Você gastou ${formatHint(leisure.reduce((s, t) => s + t.amountCents, 0))} com lazer neste mês.`,
      detail: `${leisure.length} lançamentos na categoria.`,
    });
  }

  return insights.slice(0, 8);
}

function formatHint(cents) {
  const n = (cents || 0) / 100;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

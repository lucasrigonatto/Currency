import { useFinance } from '../context/FinanceContext';
import { monthlyComparison, buildInsights } from '../domain/insights';
import { brlCents, pct } from '../lib/format';
import { Metric } from '../components/ui';

export default function InsightsPage() {
  const { transactions, month, installmentGroups, recurring, categories } = useFinance();
  const comparison = monthlyComparison({ transactions, month, categories });
  const insights = buildInsights({ transactions, month, installmentGroups, recurring, categories });

  return (
    <>
      <p className="page-lead">Observações geradas só com os seus lançamentos. Sem dados, nada é inventado.</p>
      <div className="metrics">
        <Metric label="Despesas deste mês" value={brlCents(comparison.current.expenses)} />
        <Metric label="Mês anterior" value={brlCents(comparison.previous.expenses)} />
        <Metric label="Média mensal" value={brlCents(comparison.averageExpenses)} />
        {comparison.hasYearAgo && (
          <Metric label="Mesmo mês no ano passado" value={brlCents(comparison.sameMonthLastYear.expenses)} />
        )}
      </div>
      <div className="insight-grid" style={{ marginTop: 16 }}>
        {insights.map((item) => (
          <article className="insight" key={item.id}>
            <h3>{item.title}</h3>
            <p className="muted">{item.detail}</p>
          </article>
        ))}
        {!insights.length && <p className="muted">Importe faturas para gerar insights.</p>}
      </div>
      <div className="panel">
        <h3>Comparativo por categoria</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Atual</th>
                <th>Anterior</th>
                <th>Média</th>
                <th>vs anterior</th>
                <th>vs média</th>
              </tr>
            </thead>
            <tbody>
              {comparison.categories.map((row) => (
                <tr key={row.categoryId}>
                  <td>{row.name}</td>
                  <td>{brlCents(row.current)}</td>
                  <td>{brlCents(row.previous)}</td>
                  <td>{brlCents(row.average)}</td>
                  <td>{row.diffPct == null ? '—' : pct(row.diffPct)}</td>
                  <td>{row.vsAvg == null ? '—' : pct(row.vsAvg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

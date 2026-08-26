import { Link } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { dashboardSummary, groupSum, isPostedSpend, monthTransactions } from '../domain/aggregates';
import { buildInsights } from '../domain/insights';
import { brlCents } from '../lib/format';
import { fromCents } from '../lib/money';
import { Metric, EmptyState } from '../components/ui';
import { CategoryPie, HorizontalBars } from '../components/Charts';
import { PAYMENT_METHODS } from '../data/defaults';

export default function DashboardPage() {
  const { transactions, categories, cats, month, installmentGroups, recurring } = useFinance();
  const summary = dashboardSummary(transactions, month);
  const spend = monthTransactions(transactions, month).filter(isPostedSpend);
  const byCat = groupSum(spend, (t) => t.categoryId).map((row) => ({
    ...row,
    name: cats.nameOf(row.key),
    amount: fromCents(row.amountCents),
  }));
  const bySub = groupSum(spend, (t) => t.subcategoryId).map((row) => ({
    ...row,
    name: cats.nameOf(row.key),
    amount: fromCents(row.amountCents),
  }));
  const byMerchant = groupSum(spend, (t) => t.merchant).map((row) => ({
    ...row,
    name: row.key,
    amount: fromCents(row.amountCents),
  }));
  const byMethod = groupSum(spend, (t) => t.paymentMethod).map((row) => ({
    ...row,
    name: PAYMENT_METHODS.find((p) => p.id === row.key)?.label || row.key,
    amount: fromCents(row.amountCents),
  }));
  const insights = buildInsights({ transactions, month, installmentGroups, recurring, categories });

  if (!transactions.length) {
    return (
      <EmptyState
        title="Comece importando uma fatura"
        action={<Link className="btn" to="/importar">Importar CSV, XLSX ou PDF</Link>}
      >
        Os dados ficam neste navegador. Nada é enviado a bancos ou serviços externos.
      </EmptyState>
    );
  }

  return (
    <>
      <p className="page-lead">
        Resumo do mês selecionado. Parcelas futuras não entram como despesa deste mês — só a parcela correspondente.
      </p>
      <div className="metrics">
        <Metric label="Receitas" value={brlCents(summary.income)} tone="good" />
        <Metric label="Despesas" value={brlCents(summary.expenses)} tone="bad" />
        <Metric label="Investimentos" value={brlCents(summary.investments)} />
        <Metric label="Saldo disponível" value={brlCents(summary.available)} hint="Receitas − despesas − investimentos" />
        <Metric label="Gastos no cartão" value={brlCents(summary.creditCard)} />
        <Metric label="Despesas fixas" value={brlCents(summary.fixed)} hint="Recorrentes, parcelas e moradia" />
        <Metric label="Despesas variáveis" value={brlCents(summary.variable)} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <h3>Por categoria</h3>
          <CategoryPie data={byCat} />
        </section>
        <section className="panel">
          <h3>Maiores estabelecimentos</h3>
          <HorizontalBars data={byMerchant} />
        </section>
      </div>

      <div className="grid-2">
        <Breakdown title="Subcategorias" rows={bySub} />
        <Breakdown title="Forma de pagamento" rows={byMethod} />
      </div>

      {insights.length > 0 && (
        <section className="panel">
          <h3>Insights do mês</h3>
          <div className="insight-grid">
            {insights.slice(0, 4).map((item) => (
              <article className="insight" key={item.id}>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Breakdown({ title, rows }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Item</th><th>Qtde.</th><th>Total</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td>{row.count}</td>
                <td><strong>{brlCents(row.amountCents)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

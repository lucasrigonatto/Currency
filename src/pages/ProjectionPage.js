import { useFinance } from '../context/FinanceContext';
import { cashFlowProjection } from '../domain/projections';
import { brlCents } from '../lib/format';
import { monthLabel } from '../lib/dates';

export default function ProjectionPage() {
  const { month, transactions, installmentGroups, recurring, planned } = useFinance();
  const rows = cashFlowProjection({
    fromMonth: month,
    months: 12,
    transactions,
    installmentGroups,
    recurring,
    planned,
  });

  return (
    <>
      <p className="page-lead">
        Projeção mensal de caixa: receitas e despesas já confirmadas no mês, o que ainda é esperado, e compromissos futuros.
        Uma recorrência já lançada não entra de novo no esperado. Não trate estes números como valores garantidos.
      </p>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Receita esperada</th>
                <th>Parcelas</th>
                <th>Recorrentes</th>
                <th>Planejado</th>
                <th>Confirmado</th>
                <th>Comprometido</th>
                <th>Disponível projetado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <td style={{ textTransform: 'capitalize' }}>{monthLabel(row.month)}</td>
                  <td>{brlCents(row.income)}</td>
                  <td>{brlCents(row.installments)}</td>
                  <td>{brlCents(row.recurring)}</td>
                  <td>{brlCents(row.planned)}</td>
                  <td>{brlCents(row.expensesConfirmed)}</td>
                  <td>{brlCents(row.committed)}</td>
                  <td><strong>{brlCents(row.projectedAvailable)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

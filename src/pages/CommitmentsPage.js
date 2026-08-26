import { useFinance } from '../context/FinanceContext';
import { futureCommitments } from '../domain/projections';
import { brlCents } from '../lib/format';
import { monthLabel } from '../lib/dates';

export default function CommitmentsPage() {
  const { month, transactions, installmentGroups, recurring, planned } = useFinance();
  const rows = futureCommitments({
    fromMonth: month,
    months: 12,
    transactions,
    installmentGroups,
    recurring,
    planned,
  });
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <>
      <p className="page-lead">
        Quanto já está comprometido nos próximos 12 meses: parcelas, assinaturas, despesas fixas já lançadas e itens planejados.
      </p>
      <div className="panel">
        <h3>Linha do tempo de compromissos</h3>
        <div className="timeline">
          {rows.map((row) => (
            <div className="timeline-row" key={row.month}>
              <strong style={{ textTransform: 'capitalize' }}>{monthLabel(row.month)}</strong>
              <div className="bar" title={brlCents(row.total)}>
                <i style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }} />
              </div>
              <strong>{brlCents(row.total)}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Parcelas</th>
                <th>Recorrentes</th>
                <th>Fixas lançadas</th>
                <th>Planejado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <td style={{ textTransform: 'capitalize' }}>{monthLabel(row.month)}</td>
                  <td>{brlCents(row.installments)}</td>
                  <td>{brlCents(row.recurring)}</td>
                  <td>{brlCents(row.fixed)}</td>
                  <td>{brlCents(row.planned)}</td>
                  <td><strong>{brlCents(row.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Valores futuros são projeções com base em regras e cadastros — não são garantidos.</p>
      </div>
    </>
  );
}

import { Link } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { brlCents, formatDate } from '../lib/format';

const STATUS = {
  reviewing: 'Em revisão',
  confirmed: 'Confirmada',
  rolled_back: 'Desfeita',
};

export default function ImportsPage() {
  const { imports, accounts, rollbackImport } = useFinance();
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '—';

  return (
    <>
      <p className="page-lead">Cada fatura importada fica registrada. Desfazer remove os lançamentos daquela importação.</p>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Conta</th>
                <th>Período</th>
                <th>Quando</th>
                <th>Qtde.</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {imports.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((imp) => (
                <tr key={imp.id}>
                  <td>{imp.filename}</td>
                  <td>{accountName(imp.accountId)}</td>
                  <td>{imp.periodStart ? `${formatDate(imp.periodStart)} – ${formatDate(imp.periodEnd)}` : '—'}</td>
                  <td>{formatDate((imp.createdAt || '').slice(0, 10))}</td>
                  <td>{imp.transactionCount}</td>
                  <td>{brlCents(imp.totalCents)}</td>
                  <td><span className="tag">{STATUS[imp.status] || imp.status}</span></td>
                  <td>
                    {imp.status === 'reviewing' && <Link className="btn btn--ghost btn--small" to={`/importar/${imp.id}`}>Revisar</Link>}
                    {imp.status === 'confirmed' && (
                      <button type="button" className="btn btn--danger btn--small" onClick={() => rollbackImport(imp.id)}>
                        Desfazer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!imports.length && <p className="muted">Nenhuma importação ainda.</p>}
      </div>
    </>
  );
}

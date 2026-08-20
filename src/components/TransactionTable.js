import { brlCents, formatDate } from '../lib/format';
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../data/defaults';

export function TransactionTable({ rows, cats, onEdit, onDelete }) {
  if (!rows.length) {
    return <p className="muted">Nenhuma transação neste filtro.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Conta</th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id} className={tx.amountCents < 0 ? 'is-credit' : ''}>
              <td>{formatDate(tx.date)}</td>
              <td>
                <div>{tx.description}</div>
                <div className="muted small">
                  {tx.merchant}
                  {tx.installmentTotal ? ` · ${tx.installmentCurrent}/${tx.installmentTotal}` : ''}
                  {tx.isRecurring ? ' · recorrente' : ''}
                  {tx.isStatementMeta ? ' · fatura' : ''}
                </div>
              </td>
              <td><span className="tag">{cats.pathOf(tx)}</span></td>
              <td className="small">
                {TRANSACTION_TYPES.find((t) => t.id === tx.type)?.label}
                <div className="muted">{PAYMENT_METHODS.find((p) => p.id === tx.paymentMethod)?.label}</div>
              </td>
              <td><strong>{brlCents(tx.amountCents)}</strong></td>
              <td>
                <div className="toolbar">
                  {onEdit && <button type="button" className="btn btn--ghost btn--small" onClick={() => onEdit(tx)}>Editar</button>}
                  {onDelete && <button type="button" className="btn btn--danger btn--small" onClick={() => onDelete(tx)}>Excluir</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

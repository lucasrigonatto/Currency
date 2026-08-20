import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { brlCents, formatDate } from '../lib/format';
import { toCents } from '../lib/money';
import { todayIso } from '../lib/dates';
import { Modal } from '../components/ui';
import { TRANSACTION_TYPES } from '../data/defaults';

export default function PlanningPage() {
  const { planned, savePlanned, deletePlanned } = useFinance();
  const [editing, setEditing] = useState(null);

  return (
    <>
      <p className="page-lead">
        Salário, financiamento, viagens e outros compromissos futuros. Eles entram na projeção de caixa, separados das despesas já confirmadas.
      </p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setEditing({ date: todayIso(), type: 'income', frequency: 'monthly' })}>
          Nova receita planejada
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setEditing({ date: todayIso(), type: 'expense', frequency: 'once' })}>
          Nova despesa planejada
        </button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Frequência</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {planned.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.description}</td>
                  <td>{TRANSACTION_TYPES.find((t) => t.id === item.type)?.label}</td>
                  <td>{labelFreq(item.frequency)}</td>
                  <td>{brlCents(item.amountCents)}</td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(item)}>Editar</button>
                    <button type="button" className="btn btn--danger btn--small" onClick={() => deletePlanned(item.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!planned.length && <p className="muted">Nenhum item planejado.</p>}
      </div>
      {editing && (
        <Modal title="Planejamento" onClose={() => setEditing(null)}>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.target);
              savePlanned({
                ...editing,
                date: data.get('date'),
                description: data.get('description'),
                amountCents: toCents(String(data.get('amount')).replace(',', '.')),
                type: data.get('type'),
                frequency: data.get('frequency'),
              }).then(() => setEditing(null));
            }}
          >
            <label>Data<input className="input" type="date" name="date" defaultValue={editing.date || todayIso()} required /></label>
            <label>
              Tipo
              <select className="select" name="type" defaultValue={editing.type || 'expense'}>
                {TRANSACTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="span-2">Descrição<input className="input" name="description" defaultValue={editing.description || ''} required /></label>
            <label>Valor<input className="input" name="amount" defaultValue={editing.amountCents ? String(editing.amountCents / 100).replace('.', ',') : ''} required /></label>
            <label>
              Frequência
              <select className="select" name="frequency" defaultValue={editing.frequency || 'once'}>
                <option value="once">Única</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </label>
            <div className="toolbar span-2">
              <button className="btn" type="submit">Salvar</button>
              <button className="btn btn--ghost" type="button" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function labelFreq(value) {
  if (value === 'monthly') return 'Mensal';
  if (value === 'yearly') return 'Anual';
  return 'Única';
}

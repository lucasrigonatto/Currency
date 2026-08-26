import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { brlCents } from '../lib/format';
import { toCents } from '../lib/money';
import { Modal } from '../components/ui';

export default function RecurringPage() {
  const { recurring, recurringCandidates, saveRecurring, deleteRecurring, cats } = useFinance();
  const [editing, setEditing] = useState(null);

  return (
    <>
      <p className="page-lead">Assinaturas e gastos que se repetem. Candidatos são sugeridos quando o mesmo estabelecimento aparece em mais de um mês com valor parecido.</p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setEditing({ type: 'expense', frequency: 'monthly', isActive: true })}>
          Nova recorrência
        </button>
      </div>
      <div className="panel">
        <h3>Cadastradas</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Frequência</th>
                <th>Mês</th>
                <th>Ano</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.merchant}</div>
                    <div className="muted small">{cats.pathOf(item)}</div>
                  </td>
                  <td>{item.frequency}</td>
                  <td>{brlCents(item.averageCents || item.amountCents)}</td>
                  <td>{brlCents((item.averageCents || item.amountCents || 0) * (item.frequency === 'yearly' ? 1 : 12))}</td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(item)}>Editar</button>
                    <button type="button" className="btn btn--danger btn--small" onClick={() => deleteRecurring(item.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h3>Sugestões detectadas</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Média / mês</th>
                <th>Meses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recurringCandidates.map((item) => (
                <tr key={item.merchantKey}>
                  <td>{item.merchant}</td>
                  <td>{brlCents(item.averageCents)}</td>
                  <td>{item.months}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => saveRecurring({ ...item, isActive: true, type: 'expense' })}
                    >
                      Confirmar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!recurringCandidates.length && <p className="muted">Ainda não há padrão recorrente suficiente.</p>}
      </div>
      {editing && (
        <Modal title="Recorrência" onClose={() => setEditing(null)}>
          <RecurringForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={async (payload) => {
              await saveRecurring(payload);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function RecurringForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    merchant: initial.merchant || '',
    amount: initial.averageCents || initial.amountCents ? String(((initial.averageCents || initial.amountCents) / 100)).replace('.', ',') : '',
    frequency: initial.frequency || 'monthly',
    type: initial.type || 'expense',
    categoryId: initial.categoryId || 'subscriptions',
    subcategoryId: initial.subcategoryId || 'subscriptions-other',
  });
  const { categories, cats } = useFinance();
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = toCents(form.amount.replace(',', '.'));
        onSave({
          ...initial,
          merchant: form.merchant,
          averageCents: cents,
          amountCents: cents,
          frequency: form.frequency,
          type: form.type,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId,
        });
      }}
    >
      <label className="span-2">Estabelecimento<input className="input" required value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} /></label>
      <label>Valor<input className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
      <label>
        Frequência
        <select className="select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="monthly">Mensal</option>
          <option value="yearly">Anual</option>
        </select>
      </label>
      <label>
        Categoria
        <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        Subcategoria
        <select className="select" value={form.subcategoryId} onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}>
          {cats.childrenOf(form.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="toolbar span-2">
        <button className="btn" type="submit">Salvar</button>
        <button className="btn btn--ghost" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

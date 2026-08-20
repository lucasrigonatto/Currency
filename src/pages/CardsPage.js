import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { cardMetrics } from '../domain/cards';
import { brlCents, formatDate } from '../lib/format';
import { toCents } from '../lib/money';
import { Modal } from '../components/ui';

export default function CardsPage() {
  const { accounts, saveAccount, transactions, installmentGroups } = useFinance();
  const cards = accounts.filter((a) => a.type === 'credit_card');
  const [editing, setEditing] = useState(null);

  return (
    <>
      <p className="page-lead">Cartões cadastrados manualmente. Sem conexão bancária — fatura atual vem dos lançamentos importados ou digitados.</p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setEditing({ type: 'credit_card', isActive: true, color: '#820ad1' })}>
          Novo cartão
        </button>
      </div>
      {cards.map((card) => {
        const metrics = cardMetrics(card, { transactions, installmentGroups });
        return (
          <section className="panel" key={card.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{card.name}</h3>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(card)}>Editar</button>
            </div>
            <p className="muted small">{card.institution} {card.lastFour ? `•••• ${card.lastFour}` : ''} {card.isActive ? '' : '· inativo'}</p>
            <div className="metrics">
              <div className="metric"><span className="metric__label">Fatura do mês</span><strong className="metric__value">{brlCents(metrics.statementCents)}</strong></div>
              <div className="metric"><span className="metric__label">Limite</span><strong className="metric__value">{metrics.limit ? brlCents(metrics.limit) : '—'}</strong></div>
              <div className="metric"><span className="metric__label">Crédito disponível</span><strong className="metric__value">{metrics.available == null ? '—' : brlCents(metrics.available)}</strong></div>
              <div className="metric"><span className="metric__label">Parcelas futuras</span><strong className="metric__value">{brlCents(metrics.future)}</strong></div>
              <div className="metric"><span className="metric__label">Fecha em</span><strong className="metric__value">{formatDate(metrics.closingDate)}</strong></div>
              <div className="metric"><span className="metric__label">Vence em</span><strong className="metric__value">{formatDate(metrics.dueDate)}</strong></div>
            </div>
          </section>
        );
      })}
      {editing && (
        <Modal title="Cartão" onClose={() => setEditing(null)}>
          <AccountForm
            initial={editing}
            credit
            onCancel={() => setEditing(null)}
            onSave={async (payload) => {
              await saveAccount({ ...payload, type: 'credit_card' });
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}

export function AccountForm({ initial, credit, onSave, onCancel }) {
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        onSave({
          ...initial,
          name: data.get('name'),
          institution: data.get('institution'),
          lastFour: data.get('lastFour'),
          creditLimitCents: toCents(String(data.get('creditLimit') || '0').replace(',', '.')) || 0,
          closingDay: data.get('closingDay') ? Number(data.get('closingDay')) : null,
          dueDay: data.get('dueDay') ? Number(data.get('dueDay')) : null,
          color: data.get('color') || initial.color,
          isActive: data.get('isActive') === 'on',
        });
      }}
    >
      <label>Nome<input className="input" name="name" defaultValue={initial.name || ''} required /></label>
      <label>Banco<input className="input" name="institution" defaultValue={initial.institution || ''} /></label>
      {credit && (
        <>
          <label>Final<input className="input" name="lastFour" maxLength={4} defaultValue={initial.lastFour || ''} /></label>
          <label>Limite<input className="input" name="creditLimit" defaultValue={initial.creditLimitCents ? String(initial.creditLimitCents / 100).replace('.', ',') : ''} /></label>
          <label>Dia de fechamento<input className="input" type="number" min="1" max="31" name="closingDay" defaultValue={initial.closingDay || ''} /></label>
          <label>Dia de vencimento<input className="input" type="number" min="1" max="31" name="dueDay" defaultValue={initial.dueDay || ''} /></label>
        </>
      )}
      <label>Cor<input className="input" type="color" name="color" defaultValue={initial.color || '#2f6f5e'} /></label>
      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" name="isActive" defaultChecked={initial.isActive !== false} /> Ativo
      </label>
      <div className="toolbar span-2">
        <button className="btn" type="submit">Salvar</button>
        <button className="btn btn--ghost" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

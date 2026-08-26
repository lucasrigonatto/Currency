import { useEffect, useState } from 'react';
import { TRANSACTION_TYPES, PAYMENT_METHODS } from '../data/defaults';
import { fromCents, parseAmountToCents } from '../lib/money';
import { todayIso } from '../lib/dates';
import { useFinance } from '../context/FinanceContext';
import { parseInstallment } from '../domain/installments';

const EMPTY = {
  date: todayIso(),
  description: '',
  merchant: '',
  amount: '',
  type: 'expense',
  categoryId: 'other',
  subcategoryId: 'other-other',
  paymentMethod: 'credit_card',
  accountId: 'card-nubank',
  notes: '',
  isRecurring: false,
};

export function TransactionForm({ initial, onSave, onCancel }) {
  const { categories, accounts, cats, offerRuleFromTx } = useFinance();
  const [form, setForm] = useState({ ...EMPTY, ...hydrate(initial) });
  const [rulePrompt, setRulePrompt] = useState(null);

  useEffect(() => {
    setForm({ ...EMPTY, ...hydrate(initial) });
  }, [initial]);

  const subs = cats.childrenOf(form.categoryId);
  const installment = parseInstallment(form.description);

  function setField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'description' && !prev.merchant) next.merchant = value;
      if (key === 'categoryId') {
        const first = cats.childrenOf(value)[0];
        next.subcategoryId = first?.id || null;
      }
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amountCents = parseAmountToCents(form.amount);
    if (amountCents == null) return;
    const payload = {
      ...initial,
      ...form,
      amountCents: form.type === 'income' ? Math.abs(amountCents) : amountCents,
      installmentCurrent: installment?.current || form.installmentCurrent || null,
      installmentTotal: installment?.total || form.installmentTotal || null,
      merchant: form.merchant || form.description,
    };
    const changedCategory = initial && (initial.categoryId !== payload.categoryId || initial.subcategoryId !== payload.subcategoryId);
    if (changedCategory) {
      const suggestion = offerRuleFromTx(payload);
      if (suggestion) {
        setRulePrompt({ payload, suggestion });
        return;
      }
    }
    onSave(payload, { saveRule: false });
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="form-grid">
        <label>
          Data
          <input className="input" type="date" required value={form.date} onChange={(e) => setField('date', e.target.value)} />
        </label>
        <label>
          Tipo
          <select className="select" value={form.type} onChange={(e) => setField('type', e.target.value)}>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Descrição
          <input className="input" required value={form.description} onChange={(e) => setField('description', e.target.value)} />
        </label>
        <label>
          Estabelecimento
          <input className="input" value={form.merchant} onChange={(e) => setField('merchant', e.target.value)} />
        </label>
        <label>
          Valor
          <input className="input" required inputMode="decimal" value={form.amount} onChange={(e) => setField('amount', e.target.value)} placeholder="0,00" />
        </label>
        <label>
          Categoria
          <select className="select" value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}>
            {categories.filter((c) => !c.parentId).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Subcategoria
          <select className="select" value={form.subcategoryId || ''} onChange={(e) => setField('subcategoryId', e.target.value)}>
            <option value="">—</option>
            {subs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Conta / cartão
          <select className="select" value={form.accountId || ''} onChange={(e) => setField('accountId', e.target.value)}>
            <option value="">—</option>
            {accounts.filter((a) => a.isActive).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label>
          Pagamento
          <select className="select" value={form.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)}>
            {PAYMENT_METHODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Notas
          <textarea className="textarea" value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </label>
      </div>
      <label style={{ marginTop: 8 }}>
        <input type="checkbox" checked={form.isRecurring} onChange={(e) => setField('isRecurring', e.target.checked)} /> Recorrente
      </label>
      {installment && (
        <p className="muted small">Parcela detectada: {installment.current}/{installment.total}</p>
      )}
      {rulePrompt && (
        <div className="panel">
          <p>
            Sempre classificar lançamentos contendo <strong>{rulePrompt.suggestion.pattern}</strong> como{' '}
            {cats.pathOf({ categoryId: rulePrompt.payload.categoryId, subcategoryId: rulePrompt.payload.subcategoryId })}?
          </p>
          <div className="toolbar">
            <button type="button" className="btn" onClick={() => onSave(rulePrompt.payload, { saveRule: true })}>
              Sim, criar regra
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onSave(rulePrompt.payload, { saveRule: false })}>
              Só desta vez
            </button>
          </div>
        </div>
      )}
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button type="submit" className="btn">Salvar</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function hydrate(initial) {
  if (!initial) return {};
  return {
    ...initial,
    amount: initial.amountCents != null ? String(fromCents(initial.amountCents)).replace('.', ',') : '',
  };
}

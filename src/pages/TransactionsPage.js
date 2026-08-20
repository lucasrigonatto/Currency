import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { filterTransactions, monthTransactions } from '../domain/aggregates';
import { toCents } from '../lib/money';
import { TransactionTable } from '../components/TransactionTable';
import { TransactionForm } from '../components/TransactionForm';
import { Modal } from '../components/ui';
import { TRANSACTION_TYPES } from '../data/defaults';

export default function TransactionsPage() {
  const { transactions, cats, accounts, categories, month, deleteTransaction, applyCategoryToSimilar } = useFinance();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({
    query: '',
    type: '',
    categoryId: '',
    subcategoryId: '',
    accountId: '',
    installment: '',
    recurring: '',
    min: '',
    max: '',
    scope: 'month',
  });

  useEffect(() => {
    if (params.get('nova') === '1') setEditing({});
    if (params.get('foco') === '1') {
      document.getElementById('tx-search')?.focus();
    }
  }, [params]);

  const source = filters.scope === 'month' ? monthTransactions(transactions, month) : transactions;
  const rows = useMemo(
    () =>
      filterTransactions(source, {
        query: filters.query,
        type: filters.type,
        categoryId: filters.categoryId,
        subcategoryId: filters.subcategoryId,
        accountId: filters.accountId,
        installment: filters.installment,
        recurring: filters.recurring,
        minCents: filters.min ? toCents(filters.min.replace(',', '.')) : null,
        maxCents: filters.max ? toCents(filters.max.replace(',', '.')) : null,
        hideMeta: true,
      }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt?.localeCompare(a.createdAt || '')),
    [filters, source],
  );

  const subs = categories.filter((c) => c.parentId === filters.categoryId);

  async function handleSave(payload, { saveRule } = {}) {
    await applyCategoryToSimilar(payload, { saveRule });
    setEditing(null);
    setParams({});
  }

  return (
    <>
      <p className="page-lead">
        Busca e filtros rápidos. Atalhos: <span className="kbd">n</span> nova, <span className="kbd">/</span> buscar, <span className="kbd">i</span> importar.
      </p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setEditing({})}>Nova transação</button>
      </div>
      <div className="filters">
        <input id="tx-search" className="input" placeholder="Buscar" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
        <select className="select" value={filters.scope} onChange={(e) => setFilters({ ...filters, scope: e.target.value })}>
          <option value="month">Mês selecionado</option>
          <option value="all">Todo o histórico</option>
        </select>
        <select className="select" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Tipo</option>
          {TRANSACTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select className="select" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, subcategoryId: '' })}>
          <option value="">Categoria</option>
          {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={filters.subcategoryId} onChange={(e) => setFilters({ ...filters, subcategoryId: e.target.value })}>
          <option value="">Subcategoria</option>
          {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}>
          <option value="">Conta</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="select" value={filters.installment} onChange={(e) => setFilters({ ...filters, installment: e.target.value })}>
          <option value="">Parcelas</option>
          <option value="yes">Somente parceladas</option>
          <option value="no">Sem parcela</option>
        </select>
        <select className="select" value={filters.recurring} onChange={(e) => setFilters({ ...filters, recurring: e.target.value })}>
          <option value="">Recorrentes</option>
          <option value="yes">Somente recorrentes</option>
          <option value="no">Não recorrentes</option>
        </select>
        <input className="input" placeholder="Valor mín." value={filters.min} onChange={(e) => setFilters({ ...filters, min: e.target.value })} />
        <input className="input" placeholder="Valor máx." value={filters.max} onChange={(e) => setFilters({ ...filters, max: e.target.value })} />
      </div>
      <div className="panel">
        <TransactionTable
          rows={rows}
          cats={cats}
          onEdit={setEditing}
          onDelete={async (tx) => {
            if (window.confirm('Excluir esta transação?')) await deleteTransaction(tx.id);
          }}
        />
      </div>
      {editing && (
        <Modal title={editing.id ? 'Editar transação' : 'Nova transação'} onClose={() => { setEditing(null); setParams({}); }}>
          <TransactionForm
            initial={editing.id ? editing : undefined}
            onSave={handleSave}
            onCancel={() => { setEditing(null); setParams({}); }}
          />
        </Modal>
      )}
    </>
  );
}

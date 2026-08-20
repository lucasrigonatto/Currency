import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { addMonthsKey, monthLabel } from '../lib/dates';
import { useFinance } from '../context/FinanceContext';

const NAV = [
  {
    label: 'Visão geral',
    items: [
      ['/', 'Painel'],
      ['/transacoes', 'Transações'],
      ['/importar', 'Importar fatura'],
      ['/compromissos', 'Compromissos'],
      ['/projecao', 'Projeção'],
      ['/insights', 'Insights'],
    ],
  },
  {
    label: 'Planejamento',
    items: [
      ['/parcelamentos', 'Parcelamentos'],
      ['/recorrentes', 'Recorrentes'],
      ['/planejamento', 'Planejamento'],
    ],
  },
  {
    label: 'Cadastros',
    items: [
      ['/cartoes', 'Cartões'],
      ['/contas', 'Contas'],
      ['/categorias', 'Categorias'],
      ['/importacoes', 'Importações'],
      ['/configuracoes', 'Dados e exportação'],
    ],
  },
];

const TITLES = {
  '/': 'Painel',
  '/transacoes': 'Transações',
  '/importar': 'Importar fatura',
  '/compromissos': 'Compromissos futuros',
  '/projecao': 'Projeção de caixa',
  '/insights': 'Insights',
  '/parcelamentos': 'Parcelamentos',
  '/recorrentes': 'Despesas recorrentes',
  '/planejamento': 'Planejamento manual',
  '/cartoes': 'Cartões',
  '/contas': 'Contas',
  '/categorias': 'Categorias',
  '/importacoes': 'Histórico de importações',
  '/configuracoes': 'Dados e exportação',
};

export function Layout({ children }) {
  const { month, setMonth, notice, setNotice } = useFinance();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const title = Object.entries(TITLES).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path),
  )?.[1] || 'Finanças';

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'n') navigate('/transacoes?nova=1');
      if (e.key === 'i') navigate('/importar');
      if (e.key === '/') {
        e.preventDefault();
        navigate('/transacoes?foco=1');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <p className="brand">Finanças</p>
        <p className="brand-sub">Controle pessoal local</p>
        {NAV.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className="nav-link">
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="btn btn--ghost btn--small menu-toggle" onClick={() => setOpen((v) => !v)}>
              Menu
            </button>
            <h1>{title}</h1>
          </div>
          <div className="month-picker">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setMonth(addMonthsKey(month, -1))} aria-label="Mês anterior">
              ←
            </button>
            <strong>{monthLabel(month)}</strong>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setMonth(addMonthsKey(month, 1))} aria-label="Próximo mês">
              →
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      {notice && (
        <div className="notice" role="status">
          <div>{notice.message}</div>
          <button type="button" className="btn btn--ghost btn--small" style={{ marginTop: 8 }} onClick={() => setNotice(null)}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}

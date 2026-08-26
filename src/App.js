import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Layout } from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import ImportPage from './pages/ImportPage';
import ImportReviewPage from './pages/ImportReviewPage';
import ImportsPage from './pages/ImportsPage';
import CommitmentsPage from './pages/CommitmentsPage';
import ProjectionPage from './pages/ProjectionPage';
import InsightsPage from './pages/InsightsPage';
import InstallmentsPage from './pages/InstallmentsPage';
import RecurringPage from './pages/RecurringPage';
import PlanningPage from './pages/PlanningPage';
import CardsPage from './pages/CardsPage';
import AccountsPage from './pages/AccountsPage';
import CategoriesPage from './pages/CategoriesPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

function Shell() {
  const { ready, error } = useFinance();
  if (!ready) {
    return (
      <div className="content">
        <p className="muted">Abrindo o livro-caixa local…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="content">
        <p className="tag tag--bad">{error}</p>
      </div>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transacoes" element={<TransactionsPage />} />
        <Route path="/importar" element={<ImportPage />} />
        <Route path="/importar/:importId" element={<ImportReviewPage />} />
        <Route path="/importacoes" element={<ImportsPage />} />
        <Route path="/compromissos" element={<CommitmentsPage />} />
        <Route path="/projecao" element={<ProjectionPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/parcelamentos" element={<InstallmentsPage />} />
        <Route path="/recorrentes" element={<RecurringPage />} />
        <Route path="/planejamento" element={<PlanningPage />} />
        <Route path="/cartoes" element={<CardsPage />} />
        <Route path="/contas" element={<AccountsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <FinanceProvider>
        <Shell />
      </FinanceProvider>
    </HashRouter>
  );
}

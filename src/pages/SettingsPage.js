import { useFinance } from '../context/FinanceContext';
import { downloadBlob, exportJson, exportTransactionsCsv, exportWorkbook } from '../export';

export default function SettingsPage() {
  const snapshot = useFinance();

  function csv() {
    downloadBlob(exportTransactionsCsv(snapshot.transactions), 'transacoes.csv');
  }

  function json() {
    const { ready, error, notice, cats, showNotice, ...data } = snapshot;
    downloadBlob(exportJson({
      accounts: data.accounts,
      categories: data.categories,
      rules: data.rules,
      transactions: data.transactions,
      installmentGroups: data.installmentGroups,
      recurring: data.recurring,
      planned: data.planned,
      imports: data.imports,
    }), 'financas.json');
  }

  return (
    <>
      <p className="page-lead">
        Tudo fica no IndexedDB deste navegador. Não há login nem envio a APIs externas. Exporte com frequência se for usar em outro computador.
      </p>
      <div className="panel">
        <h3>Exportar</h3>
        <div className="toolbar">
          <button type="button" className="btn" onClick={csv}>CSV das transações</button>
          <button type="button" className="btn btn--ghost" onClick={() => exportWorkbook(snapshot)}>Excel completo</button>
          <button type="button" className="btn btn--ghost" onClick={json}>JSON completo</button>
        </div>
      </div>
      <div className="panel">
        <h3>Privacidade</h3>
        <ul className="muted">
          <li>Faturas são lidas no seu computador.</li>
          <li>PDF.js usa um worker local em <code>/pdf.worker.min.js</code>.</li>
          <li>Não há telemetria nem chave de API no código.</li>
          <li>Desfazer uma importação remove os lançamentos gerados por ela.</li>
        </ul>
      </div>
    </>
  );
}

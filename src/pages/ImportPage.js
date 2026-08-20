import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';

export default function ImportPage() {
  const { accounts, startImport, showNotice } = useFinance();
  const cards = accounts.filter((a) => a.type === 'credit_card' || a.isActive);
  const [accountId, setAccountId] = useState(cards[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function onFile(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await startImport(file, accountId);
      if (result.duplicateFile) {
        showNotice('Este arquivo parece igual a uma importação já confirmada. Revise com cuidado.');
      }
      navigate(`/importar/${result.importId}`);
    } catch (err) {
      setError(err.message || 'Falha ao ler o arquivo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="page-lead">
        Envie a fatura em PDF, CSV ou Excel. Nada é gravado em definitivo até você confirmar a revisão.
      </p>
      <div className="panel">
        <div className="form-grid">
          <label>
            Cartão / conta da fatura
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {cards.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label>
            Arquivo
            <input
              className="input"
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>
        {busy && <p className="muted">Lendo arquivo…</p>}
        {error && <p className="tag tag--bad">{error}</p>}
        <p className="muted small" style={{ marginTop: 16 }}>
          CSV do Nubank (date, title, amount) é reconhecido automaticamente. PDFs de bancos diferentes podem exigir correção na revisão — linhas não lidas nunca são descartadas.
        </p>
      </div>
    </>
  );
}

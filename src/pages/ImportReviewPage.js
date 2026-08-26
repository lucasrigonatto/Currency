import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { formatDate } from '../lib/format';
import { formatAmountInput } from '../lib/money';
import { summarizeReview } from '../domain/normalize';
import { TRANSACTION_TYPES } from '../data/defaults';

export default function ImportReviewPage() {
  const { importId } = useParams();
  const { imports, importRows, categories, cats, confirmImport, updateImportRow, showNotice } = useFinance();
  const navigate = useNavigate();
  const imp = imports.find((i) => i.id === importId);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => importRows.filter((r) => r.importId === importId), [importRows, importId]);
  const summary = summarizeReview(rows);

  if (!imp) return <p>Importação não encontrada.</p>;

  async function patch(row, changes) {
    await updateImportRow(row, changes);
  }

  async function confirm() {
    setBusy(true);
    try {
      const result = await confirmImport(importId);
      showNotice(`${result.transactionsToAdd.length} transações gravadas.`);
      navigate('/');
    } catch (err) {
      showNotice(err.message || 'Falha ao confirmar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="page-lead">
        Revise antes de salvar. Corrija data, descrição e valor; linhas inválidas não entram na confirmação.
      </p>
      <div className="metrics">
        <div className="metric"><span className="metric__label">Arquivo</span><strong className="metric__value" style={{ fontSize: '1rem' }}>{imp.filename}</strong></div>
        <div className="metric"><span className="metric__label">Incluir</span><strong className="metric__value">{summary.included}</strong></div>
        <div className="metric"><span className="metric__label">Duplicatas</span><strong className="metric__value">{summary.duplicates}</strong></div>
        <div className="metric"><span className="metric__label">Sem categoria</span><strong className="metric__value">{summary.unknownCategories}</strong></div>
        <div className="metric"><span className="metric__label">Parcelas</span><strong className="metric__value">{summary.installments}</strong></div>
        <div className="metric"><span className="metric__label">Não lidas</span><strong className="metric__value">{summary.unparsed}</strong></div>
      </div>
      {imp.duplicateOf && <p className="tag tag--warn">Arquivo idêntico a uma importação já confirmada.</p>}
      {(imp.warnings || []).map((w) => <p key={w} className="tag tag--warn">{w}</p>)}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Categoria</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.include)}
                      disabled={row.parseErrors?.length > 0}
                      onChange={(e) => patch(row, { include: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input className="input" type="date" value={row.date || ''} onChange={(e) => patch(row, { date: e.target.value })} />
                  </td>
                  <td>
                    <input className="input" value={row.description || ''} onChange={(e) => patch(row, { description: e.target.value })} />
                    <div className="muted small">{row.merchant}</div>
                  </td>
                  <td>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={row.amountText != null ? row.amountText : formatAmountInput(row.amountCents)}
                      onChange={(e) => patch(row, { amountText: e.target.value })}
                      placeholder="0,00"
                    />
                  </td>
                  <td>
                    <select className="select" value={row.categoryId || 'other'} onChange={(e) => patch(row, { categoryId: e.target.value, categoryConfidence: 'manual' })}>
                      {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className="select" value={row.subcategoryId || ''} onChange={(e) => patch(row, { subcategoryId: e.target.value, categoryConfidence: 'manual' })}>
                      <option value="">—</option>
                      {cats.childrenOf(row.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    {row.parseErrors?.map((err) => <div key={err} className="tag tag--bad">{err}</div>)}
                    {row.duplicateKind && <div className="tag tag--warn">Duplicata {row.duplicateKind}</div>}
                    {row.installmentTotal && <div className="tag">{row.installmentCurrent}/{row.installmentTotal}</div>}
                    {row.isRecurring && <div className="tag tag--good">Recorrente</div>}
                    {row.categoryConfidence === 'unknown' && <div className="tag">Categoria incerta</div>}
                    {row.isStatementMeta && <div className="tag">Meta da fatura</div>}
                    <div className="muted small">{TRANSACTION_TYPES.find((t) => t.id === row.type)?.label}</div>
                    <div className="muted small">{row.date ? formatDate(row.date) : ''}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={busy || !summary.included} onClick={confirm}>
            Confirmar importação
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/importar')}>Cancelar</button>
        </div>
      </div>
    </>
  );
}

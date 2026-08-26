import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ACCOUNT_TYPES } from '../data/defaults';
import { Modal } from '../components/ui';

export default function AccountsPage() {
  const { accounts, saveAccount, deleteAccount, showNotice } = useFinance();
  const [editing, setEditing] = useState(null);

  return (
    <>
      <p className="page-lead">Contas manuais: corrente, poupança, dinheiro, cartão e investimentos. Sem Open Finance.</p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setEditing({ type: 'checking', isActive: true })}>Nova conta</button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Instituição</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{ACCOUNT_TYPES.find((t) => t.id === a.type)?.label || a.type}</td>
                  <td>{a.institution || '—'}</td>
                  <td>{a.isActive ? 'Ativa' : 'Inativa'}</td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(a)}>Editar</button>
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={async () => {
                        try {
                          await deleteAccount(a.id);
                        } catch (err) {
                          showNotice(err.message);
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <Modal title="Conta" onClose={() => setEditing(null)}>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.target);
              await saveAccount({
                ...editing,
                name: data.get('name'),
                type: data.get('type'),
                institution: data.get('institution'),
                isActive: data.get('isActive') === 'on',
              });
              setEditing(null);
            }}
          >
            <label>Nome<input className="input" name="name" defaultValue={editing.name || ''} required /></label>
            <label>
              Tipo
              <select className="select" name="type" defaultValue={editing.type || 'checking'}>
                {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="span-2">Instituição<input className="input" name="institution" defaultValue={editing.institution || ''} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="isActive" defaultChecked={editing.isActive !== false} /> Ativa
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

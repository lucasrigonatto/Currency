import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Modal } from '../components/ui';

export default function CategoriesPage() {
  const { categories, rules, saveCategory, deleteCategory, saveRule, deleteRule, showNotice } = useFinance();
  const parents = categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const [editing, setEditing] = useState(null);

  return (
    <>
      <p className="page-lead">Categorias hierárquicas e regras determinísticas. A primeira regra que casar com a descrição vence.</p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => setEditing({ parentId: null })}>Nova categoria</button>
      </div>
      {parents.map((parent) => {
        const children = categories.filter((c) => c.parentId === parent.id);
        return (
          <section className="panel" key={parent.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{parent.name}</h3>
              <div className="toolbar">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing({ parentId: parent.id })}>Subcategoria</button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(parent)}>Renomear</button>
                <button
                  type="button"
                  className="btn btn--danger btn--small"
                  onClick={async () => {
                    try {
                      await deleteCategory(parent.id);
                    } catch (err) {
                      showNotice(err.message);
                    }
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
            <div className="toolbar" style={{ marginTop: 10 }}>
              {children.map((child) => (
                <span className="tag" key={child.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(child)}>
                  {child.name}
                </span>
              ))}
            </div>
          </section>
        );
      })}

      <section className="panel">
        <h3>Regras de classificação</h3>
        <RuleForm onSave={saveRule} />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Padrão</th><th>Categoria</th><th>Origem</th><th></th></tr>
            </thead>
            <tbody>
              {rules.slice().sort((a, b) => a.priority - b.priority).map((rule) => (
                <tr key={rule.id}>
                  <td><code>{rule.pattern}</code></td>
                  <td>{categories.find((c) => c.id === rule.categoryId)?.name} › {categories.find((c) => c.id === rule.subcategoryId)?.name}</td>
                  <td>{rule.source}</td>
                  <td><button type="button" className="btn btn--danger btn--small" onClick={() => deleteRule(rule.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Modal title={editing.id ? 'Editar categoria' : 'Nova categoria'} onClose={() => setEditing(null)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.target);
              await saveCategory({ ...editing, name: data.get('name') });
              setEditing(null);
            }}
          >
            <label>Nome<input className="input" name="name" defaultValue={editing.name || ''} required /></label>
            <div className="toolbar" style={{ marginTop: 12 }}>
              <button className="btn" type="submit">Salvar</button>
              <button className="btn btn--ghost" type="button" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function RuleForm({ onSave }) {
  const { categories, cats } = useFinance();
  const [categoryId, setCategoryId] = useState('transportation');
  return (
    <form
      className="filters"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        onSave({
          pattern: data.get('pattern'),
          categoryId: data.get('categoryId'),
          subcategoryId: data.get('subcategoryId'),
          source: 'user',
        });
        e.target.reset();
      }}
    >
      <input className="input" name="pattern" placeholder="Contém… ex.: STEAM" required />
      <select className="select" name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select className="select" name="subcategoryId">
        {cats.childrenOf(categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="btn" type="submit">Adicionar regra</button>
    </form>
  );
}

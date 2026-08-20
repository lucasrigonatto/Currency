export function Metric({ label, value, hint, tone }) {
  return (
    <div className={`metric ${tone ? `is-${tone}` : ''}`}>
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
      {hint ? <span className="metric__hint">{hint}</span> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <h2>{title}</h2>
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

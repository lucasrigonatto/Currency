export function brl(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function pct(value) {
  return `${Number(value).toFixed(2)}%`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function scoreColor(score) {
  if (score >= 7) return 'var(--good)';
  if (score >= 5) return 'var(--warn)';
  return 'var(--bad)';
}

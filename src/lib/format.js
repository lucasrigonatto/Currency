import { fromCents } from './money';

export function brl(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function brlCents(cents) {
  return brl(fromCents(cents));
}

export function pct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!d) return iso;
  return `${d}/${m}/${y}`;
}

export function signedClass(cents) {
  if (cents > 0) return 'is-negative';
  if (cents < 0) return 'is-positive';
  return '';
}

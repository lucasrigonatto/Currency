/** Store money as integer cents to avoid floating-point drift. */

export function toCents(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function fromCents(cents) {
  if (cents == null) return 0;
  return Number(cents) / 100;
}

export function parseAmountToCents(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/^["']+|["']+$/g, '');
  if (!s) return null;

  s = s.replace(/R\$\s*/gi, '');
  const wrappedNeg = /^\(.*\)$/.test(s);
  const trailingNeg = /-$/.test(s);
  const leadingNeg = /^-/.test(s.trim());
  const hadMinus = wrappedNeg || trailingNeg || leadingNeg || /^-/.test(s.replace(/\s/g, ''));

  s = s.replace(/[()\s]/g, '').replace(/^-/, '').replace(/-$/, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    if (decimals <= 2) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return hadMinus ? -Math.abs(cents) : cents;
}

export function sumCents(items, pick = (x) => x) {
  return items.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0);
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function todayIso() {
  return toIsoDate(new Date());
}

export function toIsoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthKey(isoDate) {
  if (!isoDate) return null;
  return String(isoDate).slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayIso());
}

export function addMonths(isoDate, delta) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m) return null;
  const totalMonths = y * 12 + (m - 1) + Number(delta || 0);
  const year = Math.floor(totalMonths / 12);
  const monthIndex = ((totalMonths % 12) + 12) % 12;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(d || 1, last);
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addMonthsKey(key, delta) {
  return monthKey(addMonths(`${key}-01`, delta));
}

export function monthRange(key) {
  const start = `${key}-01`;
  const end = addMonths(start, 1);
  return { start, endExclusive: end };
}

export function inMonth(isoDate, key) {
  return monthKey(isoDate) === key;
}

export function monthLabel(key, locale = 'pt-BR') {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function parseFlexibleDate(raw, fallbackYear) {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return toIsoDate(raw);
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + raw * 86400000);
    return toIsoDate(date);
  }

  const s = String(raw).trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const day = br[1].padStart(2, '0');
    const month = br[2].padStart(2, '0');
    let year = br[3];
    if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const mmm = s.match(/^(\d{1,2})\s+([A-Za-zçÇéÉêÊáÁóÓúÚíÍ]{3,9})(?:\s+(\d{2,4}))?$/i);
  if (mmm) {
    const day = mmm[1].padStart(2, '0');
    const token = mmm[2].toLowerCase().slice(0, 3);
    let monthIdx = MONTHS_PT.indexOf(token);
    if (monthIdx < 0) monthIdx = MONTHS_EN.indexOf(token);
    if (monthIdx >= 0) {
      const year = mmm[3]
        ? mmm[3].length === 2
          ? Number(mmm[3]) > 50
            ? `19${mmm[3]}`
            : `20${mmm[3]}`
          : mmm[3]
        : String(fallbackYear || new Date().getFullYear());
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${day}`;
    }
  }

  const native = new Date(s);
  if (!Number.isNaN(native.getTime())) return toIsoDate(native);
  return null;
}

export function nextNMonths(fromKey, count) {
  const keys = [];
  for (let i = 0; i < count; i += 1) keys.push(addMonthsKey(fromKey, i));
  return keys;
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(y, m, 0).getDate();
  return d <= last;
}

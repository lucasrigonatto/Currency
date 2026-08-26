import { parseFlexibleDate } from '../lib/dates';
import { parseAmountToCents } from '../lib/money';

const AMOUNT_RE = /(?:R\$\s*)?-?\s*\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2}/;
const DATE_RE = /(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-zçÇ]{3,9}(?:\s+\d{2,4})?)/i;

export function reconstructPdfLines(textItems) {
  const linesMap = new Map();
  textItems.forEach((item) => {
    const y = Math.round((item.transform?.[5] || 0) * 2) / 2;
    const x = item.transform?.[4] || 0;
    const key = String(y);
    if (!linesMap.has(key)) linesMap.set(key, []);
    linesMap.get(key).push({ x, str: item.str || '' });
  });
  return [...linesMap.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

export function parsePdfLines(lines, fallbackYear) {
  const rows = [];
  const unparsed = [];
  lines.forEach((line) => {
    if (line.length < 6) return;
    const lower = line.toLowerCase();
    if (/página|page |fatura de|vencimento|limite total|cliente |cpf /.test(lower)) {
      return;
    }
    const parsed = parseStatementLine(line, fallbackYear);
    if (parsed) rows.push(parsed);
    else unparsed.push(line);
  });
  return { rows, unparsed };
}

export function parseStatementLine(line, fallbackYear) {
  const amountMatch = line.match(AMOUNT_RE);
  const dateMatch = line.match(DATE_RE);
  if (!amountMatch || !dateMatch) return null;
  const amountCents = parseAmountToCents(amountMatch[0]);
  const date = parseFlexibleDate(dateMatch[1], fallbackYear);
  if (amountCents == null || !date) return null;
  let description = line.replace(amountMatch[0], '').replace(dateMatch[0], '').replace(/\s+/g, ' ').trim();
  description = description.replace(/^[-–—]\s*/, '').replace(/\s*[-–—]$/, '');
  if (!description) description = line;
  return {
    date,
    description,
    amount: amountMatch[0],
    amountCents,
    merchant: '',
    raw: line,
    source: 'pdf',
  };
}

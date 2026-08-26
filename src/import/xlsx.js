import * as XLSX from 'xlsx';
import { detectColumns, normalizeParsedRow } from '../domain/normalize';
import { rowsFromTabular } from './csv';

export function parseWorkbookArrayBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], errors: ['Planilha vazia'] };
  }
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (!json.length) return { headers: [], rows: [], errors: ['Planilha vazia'] };
  const headers = json[0].map((h) => String(h || '').trim());
  const rows = json.slice(1).filter((line) => line.some((cell) => String(cell || '').trim())).map((line, index) => {
    const record = { __line: index + 2, __raw: line.join(' | ') };
    headers.forEach((header, i) => {
      record[header] = line[i] ?? '';
    });
    return record;
  });
  return { headers, rows, sheetName, errors: [] };
}

export function workbookToNormalized(buffer, context) {
  const parsed = parseWorkbookArrayBuffer(buffer);
  const columns = detectColumns(parsed.headers);
  const rawRows = rowsFromTabular(parsed, columns).map((row) => ({ ...row, source: 'xlsx' }));
  const rows = rawRows.map((row) => normalizeParsedRow(row, context));
  return { parsed, columns, rows, warnings: missingColumnWarnings(columns) };
}

export function missingColumnWarnings(columns) {
  const missing = [];
  if (!columns.date) missing.push('Não encontrei coluna de data.');
  if (!columns.description) missing.push('Não encontrei coluna de descrição.');
  if (!columns.amount) missing.push('Não encontrei coluna de valor.');
  return missing;
}

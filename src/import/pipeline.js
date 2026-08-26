import { detectColumns, normalizeParsedRow, summarizeReview } from '../domain/normalize';
import { parseCsvText, rowsFromTabular } from './csv';
import { missingColumnWarnings, workbookToNormalized } from './xlsx';
import { parsePdfLines, reconstructPdfLines } from './pdfText';
import { sha256Hex } from '../lib/hash';

export async function parseImportFile(file, context) {
  const buffer = await file.arrayBuffer();
  const contentHash = await sha256Hex(buffer);
  const name = file.name || 'arquivo';
  const ext = name.split('.').pop()?.toLowerCase();

  let result;
  if (ext === 'csv' || file.type === 'text/csv') {
    result = parseCsvImport(buffer, context);
  } else if (ext === 'xlsx' || ext === 'xls') {
    result = workbookToNormalized(buffer, context);
  } else if (ext === 'pdf' || file.type === 'application/pdf') {
    result = await parsePdfImport(buffer, context);
  } else {
    result = parseCsvImport(buffer, context);
    if (!result.rows.length) {
      throw new Error('Formato não suportado. Envie PDF, CSV ou XLSX.');
    }
  }

  return {
    filename: name,
    contentHash,
    ...result,
    summary: summarizeReview(result.rows || []),
  };
}

function parseCsvImport(buffer, context) {
  const text = new TextDecoder('utf-8').decode(buffer);
  const parsed = parseCsvText(text);
  const columns = detectColumns(parsed.headers);
  const rawRows = rowsFromTabular(parsed, columns);
  const rows = rawRows.map((row) => normalizeParsedRow(row, context));
  return {
    kind: 'csv',
    parsed,
    columns,
    rows,
    unparsed: [],
    warnings: [...parsed.errors, ...missingColumnWarnings(columns)],
  };
}

async function parsePdfImport(buffer, context) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.js`;
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const lines = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    lines.push(...reconstructPdfLines(content.items || []));
  }
  const fallbackYear = new Date().getFullYear();
  const extracted = parsePdfLines(lines, fallbackYear);
  const rows = extracted.rows.map((row) => normalizeParsedRow(row, context));
  const unparsed = extracted.unparsed.map((line) => ({
    raw: line,
    date: null,
    description: line,
    merchant: '',
    amountCents: null,
    type: 'expense',
    parseErrors: ['Não foi possível interpretar esta linha'],
    include: false,
    isStatementMeta: false,
    categoryConfidence: 'unknown',
    duplicateKind: null,
    duplicateIds: [],
    installmentCurrent: null,
    installmentTotal: null,
    source: 'pdf',
  }));
  return {
    kind: 'pdf',
    rows: [...rows, ...unparsed],
    unparsed: extracted.unparsed,
    warnings: rows.length
      ? []
      : ['Nenhuma transação reconhecida neste PDF. Ajuste as linhas na revisão ou exporte a fatura em CSV.'],
  };
}

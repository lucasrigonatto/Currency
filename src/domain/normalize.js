import { parseAmountToCents } from '../lib/money';
import { parseFlexibleDate } from '../lib/dates';
import { looksLikeStatementMeta, merchantFromDescription } from '../lib/text';
import { parseInstallment } from './installments';
import { categorizeRecord } from './categorize';
import { fingerprintTransaction } from '../lib/hash';
import { findDuplicates } from './duplicates';

const DATE_HEADERS = ['date', 'data', 'dt', 'transaction date', 'data da transacao', 'data transacao'];
const DESC_HEADERS = ['title', 'description', 'descricao', 'descrição', 'historico', 'histórico', 'lancamento', 'lançamento', 'memo', 'details'];
const AMOUNT_HEADERS = ['amount', 'valor', 'value', 'vlr'];
const MERCHANT_HEADERS = ['merchant', 'estabelecimento', 'loja', 'favorecido'];

function normHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function detectColumns(headers) {
  const normalized = headers.map(normHeader);
  const find = (aliases) => {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    return idx >= 0 ? headers[idx] : null;
  };
  return {
    date: find(DATE_HEADERS),
    description: find(DESC_HEADERS),
    amount: find(AMOUNT_HEADERS),
    merchant: find(MERCHANT_HEADERS),
  };
}

export function normalizeParsedRow(row, { rules, existingTransactions, accountId, fallbackYear }) {
  const date = parseFlexibleDate(row.date, fallbackYear);
  const amountCents = parseAmountToCents(row.amount);
  const description = String(row.description || row.raw || '').trim();
  const errors = [];
  if (!date) errors.push('Data inválida');
  if (amountCents == null) errors.push('Valor inválida');
  if (!description) errors.push('Descrição vazia');

  const installment = parseInstallment(description);
  const merchant = row.merchant || merchantFromDescription(description);
  const isStatementMeta = looksLikeStatementMeta(description);
  const cats = isStatementMeta
    ? { categoryId: 'financial', subcategoryId: 'financial-fees', ruleId: null, confidence: 'meta' }
    : categorizeRecord({ description, merchant }, rules);

  const type = inferType({ description, amountCents, isStatementMeta });
  const fingerprint = date && amountCents != null ? fingerprintTransaction({ date, amountCents, merchant }) : null;
  const duplicate = fingerprint ? findDuplicates({ date, amountCents, merchant, fingerprint }, existingTransactions) : { kind: null, matches: [] };

  return {
    raw: row.raw || description,
    date,
    description,
    merchant,
    amountCents,
    type,
    paymentMethod: accountId ? 'credit_card' : 'other',
    accountId: accountId || null,
    categoryId: cats.categoryId,
    subcategoryId: cats.subcategoryId,
    ruleId: cats.ruleId,
    categoryConfidence: cats.confidence,
    installmentCurrent: installment?.current || null,
    installmentTotal: installment?.total || null,
    isStatementMeta,
    isRecurring: false,
    notes: row.notes || '',
    fingerprint,
    duplicateKind: duplicate.kind,
    duplicateIds: duplicate.matches.map((m) => m.id),
    parseErrors: errors,
    include: errors.length === 0 && !isStatementMeta && !(duplicate.kind === 'exact'),
    source: row.source || 'import',
  };
}

function inferType({ description, amountCents, isStatementMeta }) {
  if (isStatementMeta) return 'transfer';
  const t = String(description || '').toLowerCase();
  if (t.includes('salario') || t.includes('salary') || t.includes('rendimento') || t.includes('pix recebido')) {
    return 'income';
  }
  if (amountCents != null && amountCents < 0 && /estorno|cancelamento|resgate/.test(t)) {
    return 'expense';
  }
  return 'expense';
}

export function summarizeReview(rows) {
  const usable = rows.filter((r) => r.parseErrors.length === 0);
  const included = rows.filter((r) => r.include);
  return {
    total: rows.length,
    usable: usable.length,
    included: included.length,
    unparsed: rows.filter((r) => r.parseErrors.length > 0).length,
    duplicates: rows.filter((r) => r.duplicateKind).length,
    unknownCategories: rows.filter((r) => r.categoryConfidence === 'unknown' && r.include).length,
    installments: rows.filter((r) => r.installmentTotal).length,
    meta: rows.filter((r) => r.isStatementMeta).length,
    totalCents: included.reduce((s, r) => s + (r.amountCents || 0), 0),
  };
}

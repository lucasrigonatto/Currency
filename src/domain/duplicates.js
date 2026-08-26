import { fingerprintTransaction } from '../lib/hash';
import { normalizeText } from '../lib/text';

export class ImportConfirmError extends Error {
  constructor(message, code, extra = {}) {
    super(message);
    this.name = 'ImportConfirmError';
    this.code = code;
    Object.assign(this, extra);
  }
}

export function findDuplicates(candidate, existingTransactions) {
  const fp = candidate.fingerprint || fingerprintTransaction(candidate);
  const exact = existingTransactions.filter(
    (t) => t.status !== 'ignored' && (t.fingerprint === fp || fingerprintOf(t) === fp),
  );
  if (exact.length) {
    return { kind: 'exact', matches: exact };
  }

  const sameDayAmount = existingTransactions.filter((t) => {
    if (t.status === 'ignored') return false;
    if (t.date !== candidate.date) return false;
    if (t.amountCents !== candidate.amountCents) return false;
    return similarMerchant(t.merchant, candidate.merchant);
  });
  if (sameDayAmount.length) {
    return { kind: 'likely', matches: sameDayAmount };
  }
  return { kind: null, matches: [] };
}

function fingerprintOf(tx) {
  return tx.fingerprint || fingerprintTransaction(tx);
}

function similarMerchant(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function findDuplicateImport(imports, contentHash) {
  return imports.find((imp) => imp.contentHash === contentHash && imp.status === 'confirmed') || null;
}

export function rowFingerprint(row) {
  if (!row?.date || row.amountCents == null || !Number.isFinite(row.amountCents)) return null;
  return fingerprintTransaction({
    date: row.date,
    amountCents: row.amountCents,
    merchant: row.merchant,
  });
}

/**
 * Recalculates duplicate flags against live transactions and within the file.
 * Exact duplicates are excluded unless the user set allowDuplicate.
 */
export function annotateDuplicates(rows, existingTransactions) {
  const seen = new Map();
  return (rows || []).map((row) => {
    const fingerprint = rowFingerprint(row) || row.fingerprint || null;
    const candidate = { ...row, fingerprint };
    const againstExisting = fingerprint
      ? findDuplicates(candidate, existingTransactions || [])
      : { kind: null, matches: [] };

    const intraFileDuplicate = Boolean(fingerprint && seen.has(fingerprint));
    if (fingerprint && !seen.has(fingerprint)) seen.set(fingerprint, row.id);

    let kind = againstExisting.kind;
    if (intraFileDuplicate) kind = 'exact';

    const allowDuplicate = Boolean(row.allowDuplicate);
    const blockedExact = kind === 'exact' && !allowDuplicate;
    let include = Boolean(row.include);
    if (row.parseErrors?.length || row.isStatementMeta) {
      include = false;
    } else if (blockedExact) {
      include = false;
    } else if (allowDuplicate && !row.parseErrors?.length && !row.isStatementMeta) {
      include = row.include !== false;
    }

    return {
      ...row,
      fingerprint,
      duplicateKind: kind,
      duplicateIds: againstExisting.matches.map((m) => m.id),
      intraFileDuplicate,
      include,
      status: include ? 'pending' : row.status === 'skipped' || blockedExact ? 'skipped' : row.status,
    };
  });
}

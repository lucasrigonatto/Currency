import { fingerprintTransaction } from '../lib/hash';
import { normalizeText } from '../lib/text';

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

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function compactText(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

export function looksLikeStatementMeta(description) {
  const t = normalizeText(description);
  return (
    t.includes('pagamento recebido') ||
    t.includes('valor pendente') ||
    t.includes('deposito de confianca') ||
    t.includes('pagamento de fatura') ||
    t.includes('pagamento fatura') ||
    t.includes('saldo anterior') ||
    t.includes('saldo do mes') ||
    /^fatura\b/.test(t)
  );
}

export function stripInstallmentSuffix(description) {
  return String(description || '')
    .replace(/\s*[-–—]\s*parcela\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/i, '')
    .replace(/\s+parcela\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/i, '')
    .replace(/\s*[-–—]\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/i, '')
    .trim();
}

export function merchantFromDescription(description) {
  const stripped = stripInstallmentSuffix(description);
  return stripped.replace(/\s+/g, ' ').trim() || stripped || description || 'Desconhecido';
}

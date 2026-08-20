import { normalizeText } from '../lib/text';

function patternToRegex(pattern) {
  const escaped = String(pattern)
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(escaped, 'i');
}

export function matchRule(rule, { description, merchant }) {
  if (!rule?.enabled) return false;
  const field = rule.matchField === 'merchant' ? merchant : `${description || ''} ${merchant || ''}`;
  const haystack = normalizeText(field);
  const needle = normalizeText(rule.pattern);
  if (!needle) return false;
  if (rule.pattern.includes('*')) {
    return patternToRegex(rule.pattern).test(field || '');
  }
  return haystack.includes(needle);
}

export function categorizeRecord(record, rules) {
  const ordered = [...rules].filter((r) => r.enabled !== false).sort((a, b) => (a.priority || 0) - (b.priority || 0));
  for (const rule of ordered) {
    if (matchRule(rule, record)) {
      return {
        categoryId: rule.categoryId,
        subcategoryId: rule.subcategoryId || null,
        ruleId: rule.id,
        confidence: 'rule',
      };
    }
  }
  return {
    categoryId: 'other',
    subcategoryId: 'other-other',
    ruleId: null,
    confidence: 'unknown',
  };
}

export function suggestedRuleFromCorrection({ description, merchant, categoryId, subcategoryId }) {
  const source = merchant || description || '';
  const token = String(source)
    .replace(/\s*[-–—]\s*parcela.*/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
  if (token.length < 3) return null;
  return {
    pattern: token,
    matchField: 'description',
    categoryId,
    subcategoryId,
  };
}

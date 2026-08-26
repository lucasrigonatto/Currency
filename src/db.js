import Dexie from 'dexie';
import { CATEGORY_TREE, DEFAULT_ACCOUNTS, DEFAULT_RULES } from './data/defaults';

export const db = new Dexie('personal-finance-tracker');

db.version(1).stores({
  accounts: 'id, type, isActive, name',
  categories: 'id, parentId, name',
  rules: 'id, categoryId, enabled, priority',
  transactions: 'id, date, type, status, accountId, categoryId, subcategoryId, merchant, importId, installmentGroupId, fingerprint, createdAt',
  installmentGroups: 'id, merchant, accountId, totalInstallments',
  recurring: 'id, merchant, isActive, frequency',
  planned: 'id, date, type, isActive, frequency',
  imports: 'id, contentHash, status, createdAt, accountId',
  importRows: 'id, importId, status, fingerprint',
  settings: 'key',
});

db.version(2).stores({
  transactions: 'id, date, type, status, accountId, categoryId, subcategoryId, merchant, importId, installmentGroupId, fingerprint, [importId+fingerprint], createdAt',
  installmentGroups: 'id, merchant, accountId, createdByImportId, totalInstallments',
});

function flattenCategories(now) {
  const rows = [];
  CATEGORY_TREE.forEach((cat, index) => {
    rows.push({
      id: cat.id,
      parentId: null,
      name: cat.name,
      color: cat.color,
      sortOrder: index,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
    (cat.children || []).forEach((sub, subIndex) => {
      rows.push({
        id: sub.id,
        parentId: cat.id,
        name: sub.name,
        color: cat.color,
        sortOrder: subIndex,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  });
  return rows;
}

export async function seedIfEmpty() {
  const now = new Date().toISOString();
  await db.transaction('rw', db.categories, db.accounts, db.rules, db.settings, async () => {
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd(flattenCategories(now));
    }
    if ((await db.accounts.count()) === 0) {
      await db.accounts.bulkAdd(
        DEFAULT_ACCOUNTS.map((account) => ({
          ...account,
          lastFour: account.lastFour || '',
          creditLimitCents: account.creditLimitCents || 0,
          closingDay: account.closingDay || null,
          dueDay: account.dueDay || null,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    if ((await db.rules.count()) === 0) {
      await db.rules.bulkAdd(
        DEFAULT_RULES.map((rule, index) => ({
          id: `sys-rule-${index}-${rule.pattern.replace(/[^a-z0-9]+/gi, '').slice(0, 24)}`,
          pattern: rule.pattern,
          matchField: 'description',
          categoryId: rule.categoryId,
          subcategoryId: rule.subcategoryId,
          priority: index,
          enabled: true,
          source: 'system',
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    const locale = await db.settings.get('locale');
    if (!locale) {
      await db.settings.bulkPut([
        { key: 'locale', value: 'pt-BR' },
        { key: 'currency', value: 'BRL' },
        { key: 'onboarded', value: false },
      ]);
    }
  });
}

export async function loadSnapshot() {
  const [accounts, categories, rules, transactions, installmentGroups, recurring, planned, imports, importRows, settingsRows] =
    await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.rules.toArray(),
      db.transactions.toArray(),
      db.installmentGroups.toArray(),
      db.recurring.toArray(),
      db.planned.toArray(),
      db.imports.toArray(),
      db.importRows.toArray(),
      db.settings.toArray(),
    ]);

  const settings = {};
  settingsRows.forEach((row) => {
    settings[row.key] = row.value;
  });

  return {
    accounts,
    categories,
    rules,
    transactions,
    installmentGroups,
    recurring,
    planned,
    imports,
    importRows,
    settings,
  };
}

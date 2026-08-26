import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db, loadSnapshot, seedIfEmpty } from '../db';
import { createId } from '../lib/id';
import { currentMonthKey } from '../lib/dates';
import { parseImportFile } from '../import/pipeline';
import { detectRecurringFlags, statementPeriod } from '../domain/importConfirm';
import { confirmImportInDb, rollbackImportInDb } from '../domain/importPersistence';
import { findDuplicateImport } from '../domain/duplicates';
import { suggestedRuleFromCorrection } from '../domain/categorize';
import { detectRecurringCandidates } from '../domain/recurring';
import { categoryLookup } from '../domain/aggregates';
import { revalidateReviewRow } from '../domain/normalize';

const FinanceContext = createContext(null);

const EMPTY = {
  accounts: [],
  categories: [],
  rules: [],
  transactions: [],
  installmentGroups: [],
  recurring: [],
  planned: [],
  imports: [],
  importRows: [],
  settings: {},
};

export function FinanceProvider({ children }) {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    const data = await loadSnapshot();
    setSnapshot(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await seedIfEmpty();
        if (!cancelled) await refresh();
      } catch (err) {
        if (!cancelled) setError(err.message || 'Falha ao iniciar o banco local');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const cats = useMemo(() => categoryLookup(snapshot.categories), [snapshot.categories]);

  const showNotice = useCallback((message, kind = 'info') => {
    setNotice({ message, kind, id: createId() });
  }, []);

  const saveTransaction = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const row = {
        id: input.id || createId(),
        date: input.date,
        description: input.description,
        merchant: input.merchant || input.description,
        amountCents: Number(input.amountCents),
        type: input.type || 'expense',
        categoryId: input.categoryId || 'other',
        subcategoryId: input.subcategoryId || null,
        paymentMethod: input.paymentMethod || 'other',
        accountId: input.accountId || null,
        installmentCurrent: input.installmentCurrent || null,
        installmentTotal: input.installmentTotal || null,
        installmentGroupId: input.installmentGroupId || null,
        isRecurring: Boolean(input.isRecurring),
        recurrenceType: input.recurrenceType || null,
        notes: input.notes || '',
        source: input.source || 'manual',
        status: input.status || 'posted',
        isStatementMeta: Boolean(input.isStatementMeta),
        fingerprint: input.fingerprint || null,
        importId: input.importId || null,
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      await db.transactions.put(row);
      await refresh();
      return row;
    },
    [refresh],
  );

  const deleteTransaction = useCallback(
    async (id) => {
      await db.transactions.delete(id);
      await refresh();
    },
    [refresh],
  );

  const saveAccount = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const row = {
        id: input.id || createId(),
        name: input.name,
        type: input.type,
        institution: input.institution || '',
        lastFour: input.lastFour || '',
        creditLimitCents: Number(input.creditLimitCents) || 0,
        closingDay: input.closingDay ? Number(input.closingDay) : null,
        dueDay: input.dueDay ? Number(input.dueDay) : null,
        color: input.color || '#2f6f5e',
        isActive: input.isActive !== false,
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      await db.accounts.put(row);
      await refresh();
      return row;
    },
    [refresh],
  );

  const deleteAccount = useCallback(
    async (id) => {
      const used = snapshot.transactions.some((t) => t.accountId === id);
      if (used) throw new Error('Esta conta tem transações. Desative-a em vez de excluir.');
      await db.accounts.delete(id);
      await refresh();
    },
    [refresh, snapshot.transactions],
  );

  const saveCategory = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const row = {
        id: input.id || createId(),
        parentId: input.parentId || null,
        name: input.name,
        color: input.color || '#293241',
        sortOrder: input.sortOrder ?? 99,
        isSystem: Boolean(input.isSystem),
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      await db.categories.put(row);
      await refresh();
      return row;
    },
    [refresh],
  );

  const deleteCategory = useCallback(
    async (id) => {
      const cat = snapshot.categories.find((c) => c.id === id);
      if (!cat) return;
      const children = snapshot.categories.filter((c) => c.parentId === id);
      const used = snapshot.transactions.some((t) => t.categoryId === id || t.subcategoryId === id);
      if (used || children.length) {
        throw new Error('Mova as transações (e subcategorias) antes de excluir.');
      }
      await db.categories.delete(id);
      await refresh();
    },
    [refresh, snapshot.categories, snapshot.transactions],
  );

  const saveRule = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const row = {
        id: input.id || createId(),
        pattern: input.pattern,
        matchField: input.matchField || 'description',
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId || null,
        priority: input.priority ?? snapshot.rules.length,
        enabled: input.enabled !== false,
        source: input.source || 'user',
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      await db.rules.put(row);
      await refresh();
      return row;
    },
    [refresh, snapshot.rules.length],
  );

  const deleteRule = useCallback(
    async (id) => {
      await db.rules.delete(id);
      await refresh();
    },
    [refresh],
  );

  const savePlanned = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const row = {
        id: input.id || createId(),
        date: input.date,
        description: input.description,
        amountCents: Number(input.amountCents),
        type: input.type || 'expense',
        frequency: input.frequency || 'once',
        startMonth: input.startMonth || (input.date ? input.date.slice(0, 7) : null),
        endMonth: input.endMonth || null,
        categoryId: input.categoryId || null,
        accountId: input.accountId || null,
        isActive: input.isActive !== false,
        notes: input.notes || '',
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      await db.planned.put(row);
      await refresh();
      return row;
    },
    [refresh],
  );

  const deletePlanned = useCallback(
    async (id) => {
      await db.planned.delete(id);
      await refresh();
    },
    [refresh],
  );

  const saveRecurring = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const row = {
        id: input.id || createId(),
        merchant: input.merchant,
        description: input.description || input.merchant,
        amountCents: Number(input.amountCents || input.averageCents || 0),
        averageCents: Number(input.averageCents || input.amountCents || 0),
        frequency: input.frequency || 'monthly',
        type: input.type || 'expense',
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId || null,
        accountId: input.accountId || null,
        startMonth: input.startMonth || null,
        endMonth: input.endMonth || null,
        isActive: input.isActive !== false,
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      await db.recurring.put(row);
      await refresh();
      return row;
    },
    [refresh],
  );

  const deleteRecurring = useCallback(
    async (id) => {
      await db.recurring.delete(id);
      await refresh();
    },
    [refresh],
  );

  const startImport = useCallback(
    async (file, accountId) => {
      const parsed = await parseImportFile(file, {
        rules: snapshot.rules,
        existingTransactions: snapshot.transactions.filter((t) => t.status !== 'ignored'),
        accountId,
        fallbackYear: Number(month.slice(0, 4)),
      });
      const duplicateFile = findDuplicateImport(snapshot.imports, parsed.contentHash);
      const rows = detectRecurringFlags(parsed.rows, snapshot.recurring).map((row) => ({
        ...row,
        id: createId(),
        importId: null,
      }));
      const now = new Date().toISOString();
      const period = statementPeriod(rows);
      const importId = createId();
      const importRow = {
        id: importId,
        filename: parsed.filename,
        accountId,
        contentHash: parsed.contentHash,
        kind: parsed.kind || 'file',
        status: 'reviewing',
        periodStart: period.start,
        periodEnd: period.end,
        transactionCount: rows.length,
        totalCents: parsed.summary.totalCents,
        warnings: parsed.warnings || [],
        duplicateOf: duplicateFile?.id || null,
        createdAt: now,
        updatedAt: now,
      };
      const staged = rows.map((row) => ({ ...row, importId, status: row.include ? 'pending' : 'skipped' }));
      await db.transaction('rw', db.imports, db.importRows, async () => {
        await db.imports.put(importRow);
        await db.importRows.bulkPut(staged);
      });
      await refresh();
      return { importId, duplicateFile, warnings: parsed.warnings, unparsed: parsed.unparsed };
    },
    [month, refresh, snapshot.imports, snapshot.recurring, snapshot.rules, snapshot.transactions],
  );

  const updateImportRow = useCallback(
    async (row, patch = {}) => {
      const next = revalidateReviewRow(row, patch, {
        rules: snapshot.rules,
        existingTransactions: snapshot.transactions.filter((t) => t.status !== 'ignored'),
        accountId: row.accountId,
      });
      await db.importRows.put({ ...next, updatedAt: new Date().toISOString() });
      await refresh();
      return next;
    },
    [refresh, snapshot.rules, snapshot.transactions],
  );

  const confirmImport = useCallback(
    async (importId) => {
      const payload = await confirmImportInDb(db, importId);
      await refresh();
      return payload;
    },
    [refresh],
  );

  const rollbackImport = useCallback(
    async (importId) => {
      const result = await rollbackImportInDb(db, importId);
      await refresh();
      return result;
    },
    [refresh],
  );

  const offerRuleFromTx = useCallback((tx) => suggestedRuleFromCorrection(tx), []);

  const applyCategoryToSimilar = useCallback(
    async (tx, { saveRule: persistRule }) => {
      await saveTransaction({ ...tx });
      if (persistRule) {
        const suggestion = suggestedRuleFromCorrection(tx);
        if (suggestion) {
          await saveRule({ ...suggestion, source: 'user' });
        }
      }
    },
    [saveRule, saveTransaction],
  );

  const value = {
    ready,
    error,
    month,
    setMonth,
    notice,
    setNotice,
    showNotice,
    cats,
    ...snapshot,
    refresh,
    saveTransaction,
    deleteTransaction,
    saveAccount,
    deleteAccount,
    saveCategory,
    deleteCategory,
    saveRule,
    deleteRule,
    savePlanned,
    deletePlanned,
    saveRecurring,
    deleteRecurring,
    startImport,
    updateImportRow,
    confirmImport,
    rollbackImport,
    offerRuleFromTx,
    applyCategoryToSimilar,
    recurringCandidates: detectRecurringCandidates(snapshot.transactions),
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}

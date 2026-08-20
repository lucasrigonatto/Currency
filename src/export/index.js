import * as XLSX from 'xlsx';
import { fromCents } from '../lib/money';

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function exportTransactionsCsv(transactions) {
  const header = [
    'id',
    'date',
    'description',
    'merchant',
    'amount',
    'type',
    'categoryId',
    'subcategoryId',
    'paymentMethod',
    'accountId',
    'installment',
    'recurring',
    'notes',
    'source',
    'status',
  ];
  const lines = [
    header.join(','),
    ...transactions.map((tx) =>
      [
        tx.id,
        tx.date,
        csv(tx.description),
        csv(tx.merchant),
        fromCents(tx.amountCents).toFixed(2),
        tx.type,
        tx.categoryId,
        tx.subcategoryId,
        tx.paymentMethod,
        tx.accountId,
        tx.installmentTotal ? `${tx.installmentCurrent}/${tx.installmentTotal}` : '',
        tx.isRecurring ? 'yes' : '',
        csv(tx.notes),
        tx.source,
        tx.status,
      ].join(','),
    ),
  ];
  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}

function csv(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportWorkbook({ transactions, accounts, categories, rules, recurring, planned, installmentGroups, imports }) {
  const wb = XLSX.utils.book_new();
  const txRows = transactions.map((tx) => ({
    ...tx,
    amount: fromCents(tx.amountCents),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), 'transactions');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accounts), 'accounts');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories), 'categories');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rules), 'rules');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recurring), 'recurring');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planned), 'planned');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(installmentGroups), 'installments');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(imports), 'imports');
  XLSX.writeFile(wb, `financas-${stamp()}.xlsx`);
}

export function exportJson(snapshot) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'personal-finance-tracker',
    ...snapshot,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

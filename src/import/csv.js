function splitCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) {
    return { headers: [], rows: [], delimiter: ',', errors: ['Arquivo CSV vazio'] };
  }
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    const record = { __line: index + 2, __raw: line };
    headers.forEach((header, i) => {
      record[header] = cells[i] ?? '';
    });
    return record;
  });
  return { headers, rows, delimiter, errors: [] };
}

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

export function rowsFromTabular({ headers, rows }, columns) {
  return rows.map((row) => ({
    date: columns.date ? row[columns.date] : '',
    description: columns.description ? row[columns.description] : '',
    amount: columns.amount ? row[columns.amount] : '',
    merchant: columns.merchant ? row[columns.merchant] : '',
    raw: row.__raw || JSON.stringify(row),
    source: 'csv',
  }));
}

import { createRequire } from 'node:module';
import { normalizeHeaderRow } from '../../utils/headerNormalization.js';

export function readRowsAsJsonXlsx(filePath, { sheetName } = {}) {
  const require = createRequire(import.meta.url);
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(filePath, { cellDates: true });

  const name = sheetName || wb.SheetNames[0];
  if (!name) throw new Error('No sheets found');

  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false
  });

  const headerValues = rows[0] || [];
  const header = normalizeHeaderRow(headerValues);

  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const obj = {};
    for (let c = 0; c < header.length; c += 1) {
      obj[header[c]] = r[c] ?? null;
    }
    out.push(obj);
  }

  return { sheetName: name, header, rows: out };
}

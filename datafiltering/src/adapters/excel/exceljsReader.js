import ExcelJS from 'exceljs';
import { ExcelReader } from '../../ports/excelReader.js';

function cellToString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();

  // ExcelJS sometimes returns rich objects.
  // Handle common shapes: { text }, { richText: [{ text }] }, { result }, { hyperlink, text }
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text.trim();
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
        .join('')
        .trim();
    }
    if (typeof v.result === 'string' || typeof v.result === 'number') {
      return String(v.result).trim();
    }
    if (typeof v.hyperlink === 'string') {
      if (typeof v.text === 'string' && v.text.trim()) return v.text.trim();
      return v.hyperlink.trim();
    }
  }

  return String(v).trim();
}

function normalizeCellValue(v) {
  // For record values we preserve original primitives where possible,
  // but normalize rich objects to strings so downstream mapping works.
  if (v == null) return null;
  if (typeof v === 'object' && !(v instanceof Date)) return cellToString(v);
  return v;
}

class ExcelJsRowStream {
  constructor({ filePath, sheetName }) {
    this.filePath = filePath;
    this.sheetName = sheetName;
  }

  async *[Symbol.asyncIterator]() {
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(this.filePath, {
      entries: 'emit',
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore'
    });

    for await (const worksheetReader of workbookReader) {
      if (this.sheetName && worksheetReader.name !== this.sheetName) continue;

      let header = null;
      for await (const row of worksheetReader) {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        if (!header) {
          const candidateHeader = values.map(cellToString);
          const hasAny = candidateHeader.some((h) => h && String(h).trim());
          if (!hasAny) continue;

          header = candidateHeader;
          yield { kind: 'header', header, sheetName: worksheetReader.name };
          continue;
        }

        const record = {};
        for (let i = 0; i < header.length; i += 1) {
          const key = header[i] || `col_${i + 1}`;
          record[key] = normalizeCellValue(values[i]);
        }

        yield {
          kind: 'row',
          sheetName: worksheetReader.name,
          rowNumber: row.number,
          record
        };
      }

      if (this.sheetName) break;
    }
  }
}

export class ExcelJsReader extends ExcelReader {
  open(filePath, { sheetName } = {}) {
    return new ExcelJsRowStream({ filePath, sheetName });
  }
}

import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import { normalizeHeaderRow } from '../../utils/headerNormalization.js';

export async function* streamRowsAsJsonExcelJs(filePath, { sheetName, headerRowIndex = 1 } = {}) {
  try {
    await fs.access(filePath);
  } catch (e) {
    throw new Error(`Excel file not found or not readable: ${filePath}`);
  }

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore'
  });

  let readerError = null;
  workbookReader.on('error', (err) => {
    readerError = err;
  });

  for await (const worksheetReader of workbookReader) {
    if (readerError) {
      throw new Error(`Failed reading Excel file: ${readerError.message || String(readerError)}`);
    }
    if (sheetName && worksheetReader.name !== sheetName) continue;

    let header = null;

    for await (const row of worksheetReader) {
      if (readerError) {
        throw new Error(`Failed reading Excel file: ${readerError.message || String(readerError)}`);
      }
      const cells = Array.isArray(row.values) ? row.values.slice(1) : [];

      if (row.number < headerRowIndex) continue;

      if (!header) {
        header = normalizeHeaderRow(cells);
        yield { kind: 'header', sheetName: worksheetReader.name, header };
        continue;
      }

      const obj = {};
      for (let i = 0; i < header.length; i += 1) {
        obj[header[i]] = cells[i] ?? null;
      }

      yield {
        kind: 'row',
        sheetName: worksheetReader.name,
        rowNumber: row.number,
        data: obj
      };
    }

    return;
  }

  throw new Error('No sheets found (or specified sheetName not found)');
}

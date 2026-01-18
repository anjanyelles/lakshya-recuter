import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import fs from 'node:fs/promises';

import { streamRowsAsJsonExcelJs } from '../adapters/excel/streamRowsAsJsonExcelJs.js';
import { readRowsAsJsonXlsx } from '../adapters/excel/readRowsAsJsonXlsx.js';
import { createRowValidator } from '../utils/rowValidation.js';

export async function main(argv = process.argv) {
  const args = await yargs(hideBin(argv))
    .option('file', { type: 'string', demandOption: true })
    .option('sheet', { type: 'string' })
    .option('mode', { type: 'string', default: 'stream', choices: ['stream', 'memory'] })
    .option('limit', { type: 'number', default: 10 })
    .parse();

  await fs.access(args.file);

  const validate = createRowValidator({ requiredKeys: [] });

  if (args.mode === 'memory') {
    const { header, rows } = readRowsAsJsonXlsx(args.file, { sheetName: args.sheet });
    const out = [];
    for (let i = 0; i < rows.length && out.length < args.limit; i += 1) {
      const v = validate(rows[i]);
      if (!v.ok) continue;
      out.push(rows[i]);
    }

    // eslint-disable-next-line no-console
    console.log({ header, sample: out });
    return;
  }

  let header = null;
  const sample = [];

  for await (const item of streamRowsAsJsonExcelJs(args.file, { sheetName: args.sheet })) {
    if (item.kind === 'header') {
      header = item.header;
      continue;
    }

    const v = validate(item.data);
    if (!v.ok) continue;

    sample.push(item.data);
    if (sample.length >= args.limit) break;
  }

  // eslint-disable-next-line no-console
  console.log({ header, sample });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}

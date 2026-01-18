import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig } from '../config.js';
import { createLogger } from '../observability/logger.js';
import { createAiClientFromEnv } from '../adapters/ai/aiClientFactory.js';
import { mapHeadersWithAi } from '../application/mapHeadersWithAi.js';

import { streamRowsAsJsonExcelJs } from '../adapters/excel/streamRowsAsJsonExcelJs.js';

export async function main(argv = process.argv) {
  const args = await yargs(hideBin(argv))
    .option('file', { type: 'string', demandOption: true })
    .option('sheet', { type: 'string' })
    .parse();

  const cfg = getConfig();
  const logger = createLogger({ level: cfg.logLevel });

  let header = null;
  const sampleRows = [];
  for await (const item of streamRowsAsJsonExcelJs(args.file, { sheetName: args.sheet })) {
    if (item.kind === 'header') {
      header = item.header;
      continue;
    }

    if (item.kind === 'row') {
      sampleRows.push(item.data);
      if (sampleRows.length >= 5) break;
    }
  }

  if (!header) {
    throw new Error('Could not extract header row from Excel');
  }

  const aiClient = createAiClientFromEnv({ logger });

  const result = await mapHeadersWithAi({
    aiClient,
    headers: header,
    sampleRows,
    logger
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));

  if (result && result.error) {
    process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.message || String(err));
    process.exitCode = 1;
  });
}

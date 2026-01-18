import fs from 'node:fs/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig } from '../config.js';
import { createLogger } from '../observability/logger.js';
import { connectMongo } from '../adapters/mongo/mongoClient.js';
import { MongoCandidateRepository } from '../adapters/mongo/mongoCandidateRepository.js';
import { ExcelJsReader } from '../adapters/excel/exceljsReader.js';
import { DefaultSchemaMapperFactory } from '../adapters/schema/defaultSchemaMapper.js';
import { ImportCandidatesFromExcel } from '../application/importCandidatesFromExcel.js';
import { MongoIngestionStatusTracker } from '../ingestion/mongoIngestionStatusTracker.js';
import { LocalJsonIngestionStatusTracker } from '../ingestion/localJsonIngestionStatusTracker.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs({ attempt, baseMs, maxMs = 60_000 }) {
  const exp = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(baseMs, 1_000));
  return Math.min(maxMs, exp + jitter);
}

async function listExcelFiles(dirPath) {
  const out = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        if (/\.(xlsx|xlsm)$/i.test(e.name)) out.push(full);
      }
    }
  }

  await walk(dirPath);
  return out;
}

export async function main(argv = process.argv) {
  const args = await yargs(hideBin(argv))
    .option('file', { type: 'array', string: true })
    .option('dir', { type: 'string' })
    .option('sheet', { type: 'string' })
    .option('batchSize', { type: 'number', default: 1000 })
    .option('statusStore', {
      type: 'string',
      choices: ['none', 'mongo', 'local'],
      default: 'none'
    })
    .option('statusFile', { type: 'string' })
    .option('resume', { type: 'boolean', default: true })
    .option('failFast', { type: 'boolean', default: false })
    .option('maxRetries', { type: 'number', default: 2 })
    .option('retryBaseMs', { type: 'number', default: 1000 })
    .demandOption([], '')
    .strict()
    .parse();

  const cfg = getConfig();
  const logger = createLogger({
    level: cfg.logLevel,
    destination: cfg.logDestination
  });

  const files = [];
  if (args.file && args.file.length) {
    for (const f of args.file) files.push(String(f));
  }
  if (args.dir) {
    const discovered = await listExcelFiles(args.dir);
    files.push(...discovered);
  }

  if (!files.length) {
    throw new Error('Provide --file <path> (repeatable) or --dir <folder>');
  }

  const client = await connectMongo({ mongodbUri: cfg.mongodbUri });
  try {
    const db = client.db(cfg.mongodbDb);

    const candidateRepository = new MongoCandidateRepository({
      db,
      collectionName: cfg.mongodbCandidatesCollection,
      logger
    });

    const excelReader = new ExcelJsReader();
    const schemaMapperFactory = new DefaultSchemaMapperFactory();

    const useCase = new ImportCandidatesFromExcel({
      excelReader,
      schemaMapperFactory,
      candidateRepository,
      logger
    });

    let statusTracker = null;
    if (args.statusStore === 'mongo') {
      statusTracker = new MongoIngestionStatusTracker({ db });
    } else if (args.statusStore === 'local') {
      const statusFilePath =
        args.statusFile || path.resolve(process.cwd(), '.ingestion-status.json');
      statusTracker = new LocalJsonIngestionStatusTracker({ statusFilePath });
    }

    if (statusTracker) {
      await statusTracker.ensureReady();
      await statusTracker.seedPending(files);
    }

    await candidateRepository.ensureIndexes();

    for (const filePath of files) {
      if (statusTracker && args.resume) {
        const status = await statusTracker.getStatus(filePath);
        if (status === 'processed') {
          if (logger) logger.info({ filePath }, 'skipping already processed file');
          continue;
        }
      }

      const startedAt = new Date();
      const maxAttempts = Math.max(1, Number(args.maxRetries) + 1);
      let attempt = 1;

      while (attempt <= maxAttempts) {
        try {
          if (attempt === 1) {
            if (statusTracker) await statusTracker.markProcessing(filePath, { startedAt });
          } else if (logger) {
            logger.warn(
              { filePath, attempt, maxAttempts },
              'retrying failed file'
            );
          }

          const result = await useCase.execute({
            filePath,
            sheetName: args.sheet,
            batchSize: args.batchSize,
            ensureIndexes: false
          });

          if (statusTracker) {
            await statusTracker.markProcessed(filePath, {
              processedRows: result?.processedRows,
              persisted: result?.persisted,
              finishedAt: new Date()
            });
          }

          break;
        } catch (err) {
          const isLast = attempt >= maxAttempts;

          if (isLast) {
            if (statusTracker) {
              await statusTracker.markFailed(filePath, err, { finishedAt: new Date() });
            }
            if (logger) {
              logger.error({ filePath, err }, 'failed to process file');
            }
            if (args.failFast) throw err;
            break;
          }

          if (logger) {
            logger.warn(
              { filePath, err, attempt, maxAttempts },
              'file processing failed; will retry'
            );
          }

          const delay = backoffMs({
            attempt,
            baseMs: Math.max(50, Number(args.retryBaseMs) || 1000)
          });
          await sleep(delay);
          attempt += 1;
        }
      }
    }
  } finally {
    await client.close();
  }
 }

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}

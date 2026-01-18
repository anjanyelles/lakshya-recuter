import { IngestionStatusTracker } from './ingestionStatusTracker.js';

function now() {
  return new Date();
}

function normalizeMeta(meta) {
  if (!meta) return {};
  const out = { ...meta };
  if (out.startedAt && !(out.startedAt instanceof Date)) out.startedAt = new Date(out.startedAt);
  if (out.finishedAt && !(out.finishedAt instanceof Date)) out.finishedAt = new Date(out.finishedAt);
  return out;
}

export class MongoIngestionStatusTracker extends IngestionStatusTracker {
  constructor({ db, collectionName = 'ingestion_files' }) {
    super();
    this.collection = db.collection(collectionName);
  }

  async ensureReady() {
    await this.collection.createIndex({ filePath: 1 }, { unique: true });
    await this.collection.createIndex({ status: 1, updatedAt: -1 });
  }

  async seedPending(filePaths) {
    if (!filePaths?.length) return;
    const ops = filePaths.map((filePath) => ({
      updateOne: {
        filter: { filePath },
        update: {
          $setOnInsert: {
            filePath,
            status: 'pending',
            attempts: 0,
            createdAt: now(),
            updatedAt: now()
          }
        },
        upsert: true
      }
    }));
    await this.collection.bulkWrite(ops, { ordered: false });
  }

  async getStatus(filePath) {
    const doc = await this.collection.findOne({ filePath }, { projection: { status: 1 } });
    return doc?.status || null;
  }

  async markProcessing(filePath, meta = {}) {
    const m = normalizeMeta(meta);
    await this.collection.updateOne(
      { filePath },
      {
        $setOnInsert: { filePath, createdAt: now() },
        $set: {
          status: 'processing',
          startedAt: m.startedAt || now(),
          updatedAt: now()
        },
        $inc: { attempts: 1 }
      },
      { upsert: true }
    );
  }

  async markProcessed(filePath, meta = {}) {
    const m = normalizeMeta(meta);
    await this.collection.updateOne(
      { filePath },
      {
        $setOnInsert: { filePath, createdAt: now() },
        $set: {
          status: 'processed',
          processedRows: m.processedRows ?? null,
          persisted: m.persisted ?? null,
          finishedAt: m.finishedAt || now(),
          updatedAt: now(),
          errorMessage: null,
          errorStack: null
        }
      },
      { upsert: true }
    );
  }

  async markFailed(filePath, error, meta = {}) {
    const m = normalizeMeta(meta);
    const message = error?.message ? String(error.message) : String(error);
    const stack = error?.stack ? String(error.stack) : null;

    await this.collection.updateOne(
      { filePath },
      {
        $setOnInsert: { filePath, createdAt: now() },
        $set: {
          status: 'failed',
          finishedAt: m.finishedAt || now(),
          updatedAt: now(),
          errorMessage: message,
          errorStack: stack
        }
      },
      { upsert: true }
    );
  }
}

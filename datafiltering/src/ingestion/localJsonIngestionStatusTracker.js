import fs from 'node:fs/promises';
import path from 'node:path';
import { IngestionStatusTracker } from './ingestionStatusTracker.js';

function nowIso() {
  return new Date().toISOString();
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export class LocalJsonIngestionStatusTracker extends IngestionStatusTracker {
  constructor({ statusFilePath }) {
    super();
    this.statusFilePath = statusFilePath;
  }

  async ensureReady() {
    const dir = path.dirname(this.statusFilePath);
    await fs.mkdir(dir, { recursive: true });

    if (!(await fileExists(this.statusFilePath))) {
      await fs.writeFile(
        this.statusFilePath,
        JSON.stringify({ version: 1, files: {} }, null, 2),
        'utf8'
      );
    }
  }

  async _read() {
    const raw = await fs.readFile(this.statusFilePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.files) parsed.files = {};
    return parsed;
  }

  async _write(data) {
    const tmp = `${this.statusFilePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, this.statusFilePath);
  }

  async seedPending(filePaths) {
    if (!filePaths?.length) return;
    const data = await this._read();
    for (const filePath of filePaths) {
      if (!data.files[filePath]) {
        data.files[filePath] = {
          filePath,
          status: 'pending',
          attempts: 0,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
      }
    }
    await this._write(data);
  }

  async getStatus(filePath) {
    const data = await this._read();
    return data.files[filePath]?.status || null;
  }

  async markProcessing(filePath, meta = {}) {
    const data = await this._read();
    const existing = data.files[filePath] || {
      filePath,
      createdAt: nowIso(),
      attempts: 0
    };

    data.files[filePath] = {
      ...existing,
      status: 'processing',
      startedAt: meta.startedAt || nowIso(),
      attempts: (existing.attempts || 0) + 1,
      updatedAt: nowIso()
    };

    await this._write(data);
  }

  async markProcessed(filePath, meta = {}) {
    const data = await this._read();
    const existing = data.files[filePath] || { filePath, createdAt: nowIso(), attempts: 0 };

    data.files[filePath] = {
      ...existing,
      status: 'processed',
      processedRows: meta.processedRows ?? null,
      persisted: meta.persisted ?? null,
      finishedAt: meta.finishedAt || nowIso(),
      errorMessage: null,
      errorStack: null,
      updatedAt: nowIso()
    };

    await this._write(data);
  }

  async markFailed(filePath, error, meta = {}) {
    const data = await this._read();
    const existing = data.files[filePath] || { filePath, createdAt: nowIso(), attempts: 0 };

    data.files[filePath] = {
      ...existing,
      status: 'failed',
      finishedAt: meta.finishedAt || nowIso(),
      errorMessage: error?.message ? String(error.message) : String(error),
      errorStack: error?.stack ? String(error.stack) : null,
      updatedAt: nowIso()
    };

    await this._write(data);
  }
}

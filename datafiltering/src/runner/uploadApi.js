import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pino from 'pino';
import { nanoid } from 'nanoid';

import { getConfig } from '../config.js';
import { connectMongo } from '../adapters/mongo/mongoClient.js';
import { MongoCandidateRepository } from '../adapters/mongo/mongoCandidateRepository.js';
import { ExcelJsReader } from '../adapters/excel/exceljsReader.js';
import { DefaultSchemaMapperFactory } from '../adapters/schema/defaultSchemaMapper.js';
import { ImportCandidatesFromExcel } from '../application/importCandidatesFromExcel.js';

const cfg = getConfig();
const logger = pino({ level: cfg.logLevel || 'info' });

function isMongoConfigError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('missing mongodb_uri') ||
    msg.includes('mongodb_uri') ||
    msg.includes('auth') ||
    msg.includes('authentication') ||
    msg.includes('failed to connect') ||
    msg.includes('server selection') ||
    msg.includes('timed out')
  );
}

let mongoClientPromise = null;
async function getMongoClient() {
  if (mongoClientPromise) return mongoClientPromise;
  if (!cfg.mongodbUri) throw new Error('Missing MONGODB_URI');
  mongoClientPromise = connectMongo({ mongodbUri: cfg.mongodbUri });
  return mongoClientPromise;
}

async function getMongoDb() {
  const client = await getMongoClient();
  if (!cfg.mongodbDb) throw new Error('Missing MONGODB_DB');
  return client.db(cfg.mongodbDb);
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'));
const publicDir = path.resolve(process.cwd(), 'public');

app.use(express.static(publicDir));

async function validateUploadedFilePath(filePath) {
  const resolved = path.resolve(filePath);
  const prefix = uploadsDir.endsWith(path.sep) ? uploadsDir : `${uploadsDir}${path.sep}`;

  if (!resolved.startsWith(prefix)) {
    return { ok: false, message: 'filePath must be inside uploads folder' };
  }

  try {
    await fs.access(resolved);
  } catch {
    return { ok: false, message: 'filePath does not exist' };
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xlsm') {
    return { ok: false, message: 'Only .xlsx and .xlsm are supported' };
  }

  return { ok: true, resolvedPath: resolved };
}

function validateUploadsFilePathLoose(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  const prefix = uploadsDir.endsWith(path.sep) ? uploadsDir : `${uploadsDir}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    return { ok: false, message: 'filePath must be inside uploads folder' };
  }
  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xlsm') {
    return { ok: false, message: 'Only .xlsx and .xlsm are supported' };
  }
  return { ok: true, resolvedPath: resolved };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fs.mkdir(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      } catch (e) {
        cb(e);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${nanoid(10)}${ext || ''}`);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 }
});

function isExcelFile(file) {
  const name = String(file?.originalname || '').toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xlsm');
}

// Very small in-memory job map (single-process). For production use Mongo-based job tracking.
const jobs = new Map();

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Upload Excel to datafiltering/uploads
app.post('/api/excel/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'Missing file (field name: file)' });
  if (!isExcelFile(file)) {
    return res.status(400).json({ message: 'Invalid file type. Upload .xlsx or .xlsm' });
  }

  return res.json({
    uploadId: nanoid(12),
    filename: file.originalname,
    storedFilename: path.basename(file.path),
    storedPath: file.path
  });
});

// Bulk upload (up to 20 files)
app.post('/api/excel/upload/bulk', upload.array('files', 20), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ message: 'Missing files (field name: files)' });

  const invalid = files.find((f) => !isExcelFile(f));
  if (invalid) {
    return res.status(400).json({ message: 'Invalid file type detected. Upload only .xlsx or .xlsm' });
  }

  const uploads = files.map((f) => ({
    uploadId: nanoid(12),
    filename: f.originalname,
    storedFilename: path.basename(f.path),
    storedPath: f.path
  }));

  return res.json({ uploads });
});

// Error handler (including Multer)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (!err) return res.status(500).json({ message: 'Unknown error' });

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large (limit 200MB)' });
  }

  if (err?.code === 'ENOSPC') {
    return res.status(507).json({
      message: 'No space left on device. Free disk space or set UPLOADS_DIR to a drive with space.'
    });
  }

  logger.error({ err }, 'request failed');
  return res.status(500).json({ message: err?.message ? String(err.message) : 'Request failed' });
});

// Preview first N rows from first sheet (or a given sheet)
app.get('/api/excel/preview', async (req, res) => {
  const filePath = String(req.query.filePath || '');
  const sheetName = req.query.sheetName ? String(req.query.sheetName) : undefined;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 25)));

  if (!filePath) return res.status(400).json({ message: 'Missing filePath query param' });

  const validated = await validateUploadedFilePath(filePath);
  if (!validated.ok) {
    return res.status(400).json({ message: validated.message });
  }

  try {
    const reader = new ExcelJsReader();
    const stream = reader.open(validated.resolvedPath, { sheetName });

    let header = null;
    const rows = [];

    for await (const item of stream) {
      if (item.kind === 'header') {
        header = item.header;
        continue;
      }
      if (item.kind !== 'row') continue;
      rows.push(item.record);
      if (rows.length >= limit) break;
    }

    return res.json({ header, rows, limit });
  } catch (err) {
    logger.warn({ err, filePath }, 'preview failed');
    return res.status(500).json({ message: 'Preview failed' });
  }
});

app.get('/api/candidates/designations', async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
  try {
    const db = await getMongoDb();
    if (!cfg.mongodbCandidatesCollection) {
      throw new Error('Missing MONGODB_CANDIDATES_COLLECTION');
    }
    const col = db.collection(cfg.mongodbCandidatesCollection);
    const values = await col.distinct('professional.designation', {
      'professional.designation': { $type: 'string', $ne: '' }
    });

    const items = values
      .map((v) => String(v).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit);

    return res.json({ items, limit, total: items.length });
  } catch (err) {
    logger.error({ err }, 'designation list failed');
    const status = isMongoConfigError(err) ? 503 : 500;
    return res.status(status).json({
      message: 'Designation list failed',
      error: String(err?.message || err)
    });
  }
});

// Purge all candidates (dangerous). Requires ADMIN_KEY and explicit confirmation.
app.post('/api/candidates/purgeAll', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY ? String(process.env.ADMIN_KEY) : '';
  const providedKey = req.body?.adminKey ? String(req.body.adminKey) : '';
  const confirm = req.body?.confirm ? String(req.body.confirm) : '';

  if (!adminKey) {
    return res.status(500).json({ message: 'Server missing ADMIN_KEY' });
  }
  if (providedKey !== adminKey) {
    return res.status(403).json({ message: 'Invalid adminKey' });
  }
  if (confirm !== 'PURGE_ALL_CANDIDATES') {
    return res.status(400).json({ message: 'Missing confirm=PURGE_ALL_CANDIDATES' });
  }

  try {
    const db = await getMongoDb();
    const col = db.collection(cfg.mongodbCandidatesCollection);
    const before = await col.estimatedDocumentCount();
    const result = await col.deleteMany({});
    return res.json({ before, deleted: result?.deletedCount || 0 });
  } catch (err) {
    logger.error({ err }, 'purgeAll failed');
    return res.status(500).json({ message: 'purgeAll failed' });
  }
});

// Remove candidates ingested from a specific upload file.
// mode:
//  - detach: remove matching source entries from candidates (keeps candidate)
//  - delete: delete candidates that have a matching source entry
// dryRun:
//  - true: do not modify DB, only return how many would be affected
app.post('/api/candidates/removeByFile', async (req, res) => {
  const filePath = req.body?.filePath ? String(req.body.filePath) : '';
  const mode = req.body?.mode ? String(req.body.mode) : 'detach';
  const dryRun = req.body?.dryRun == null ? true : Boolean(req.body.dryRun);
  const deleteUploadFile = Boolean(req.body?.deleteUploadFile);

  if (!filePath) return res.status(400).json({ message: 'Missing filePath in body' });

  const validated = validateUploadsFilePathLoose(filePath);
  if (!validated.ok) return res.status(400).json({ message: validated.message });

  if (mode !== 'detach' && mode !== 'delete') {
    return res.status(400).json({ message: 'mode must be one of: detach, delete' });
  }

  try {
    const db = await getMongoDb();
    const col = db.collection(cfg.mongodbCandidatesCollection);

    const matchFilter = { sources: { $elemMatch: { filePath: validated.resolvedPath } } };
    const matched = await col.countDocuments(matchFilter);

    if (dryRun) {
      return res.json({ filePath: validated.resolvedPath, mode, dryRun: true, matched });
    }

    let result;
    if (mode === 'delete') {
      result = await col.deleteMany(matchFilter);
    } else {
      result = await col.updateMany(matchFilter, {
        $pull: { sources: { filePath: validated.resolvedPath } }
      });
    }

    if (deleteUploadFile) {
      try {
        await fs.unlink(validated.resolvedPath);
      } catch {
        // ignore
      }
    }

    return res.json({
      filePath: validated.resolvedPath,
      mode,
      dryRun: false,
      matched,
      modified: result?.modifiedCount,
      deleted: result?.deletedCount
    });
  } catch (err) {
    logger.error({ err, filePath }, 'removeByFile failed');
    return res.status(500).json({ message: 'removeByFile failed' });
  }
});

// Start ingestion as an async job
app.post('/api/excel/ingest', async (req, res) => {
  const schema = req.body || {};
  const filePath = String(schema.filePath || '');
  const sheetName = schema.sheetName ? String(schema.sheetName) : undefined;
  const batchSize = schema.batchSize == null ? 1000 : Number(schema.batchSize);

  if (!filePath) return res.status(400).json({ message: 'Missing filePath in body' });
  if (!cfg.mongodbUri) return res.status(500).json({ message: 'Server missing MONGODB_URI' });

  const validated = await validateUploadedFilePath(filePath);
  if (!validated.ok) {
    return res.status(400).json({ message: validated.message });
  }

  const jobId = nanoid(14);
  jobs.set(jobId, { jobId, status: 'queued', createdAt: new Date().toISOString() });

  // Fire and forget.
  (async () => {
    jobs.set(jobId, { ...jobs.get(jobId), status: 'running', startedAt: new Date().toISOString() });

    let client = null;
    try {
      client = await connectMongo({ mongodbUri: cfg.mongodbUri });
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

      await candidateRepository.ensureIndexes();
      const result = await useCase.execute({
        filePath: validated.resolvedPath,
        sheetName,
        batchSize,
        ensureIndexes: false
      });

      jobs.set(jobId, {
        ...jobs.get(jobId),
        status: 'completed',
        finishedAt: new Date().toISOString(),
        result
      });
    } catch (err) {
      logger.error({ err, jobId, filePath }, 'ingestion job failed');
      jobs.set(jobId, {
        ...jobs.get(jobId),
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: err?.message ? String(err.message) : String(err)
      });
    } finally {
      try {
        if (client) await client.close();
      } catch {
        // ignore
      }
    }
  })();

  return res.json({ jobId });
});

app.get('/api/excel/ingest/:jobId', async (req, res) => {
  const job = jobs.get(String(req.params.jobId));
  if (!job) return res.status(404).json({ message: 'Job not found' });
  return res.json(job);
});

app.get('/api/candidates', async (req, res) => {
  const name = req.query.name ? String(req.query.name).trim() : '';
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : '';
  const phone = req.query.phone ? String(req.query.phone).trim() : '';
  const designation = req.query.designation ? String(req.query.designation).trim() : '';
  const company = req.query.company ? String(req.query.company).trim() : '';
  const location = req.query.location ? String(req.query.location).trim() : '';
  const specialization = req.query.specialization ? String(req.query.specialization).trim() : '';
  const skill = req.query.skill ? String(req.query.skill).trim().toLowerCase() : '';
  const description = req.query.description ? String(req.query.description).trim() : '';
  const experienceMin = req.query.experienceMin == null ? null : Number(req.query.experienceMin);
  const experienceMax = req.query.experienceMax == null ? null : Number(req.query.experienceMax);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const filter = {};
  if (email) filter['contacts.emails'] = email;
  if (phone) filter['contacts.phones'] = phone;
  if (name) {
    filter['profile.fullName'] = { $regex: escapeRegex(name), $options: 'i' };
  }

  if (designation) filter['professional.designation'] = { $regex: escapeRegex(designation), $options: 'i' };
  if (company) filter['professional.currentCompany'] = { $regex: escapeRegex(company), $options: 'i' };
  if (location) filter['professional.location'] = { $regex: escapeRegex(location), $options: 'i' };
  if (specialization) filter['professional.specialization'] = { $regex: escapeRegex(specialization), $options: 'i' };
  if (skill) filter['professional.skills'] = skill;
  if (description) filter['profile.description'] = { $regex: escapeRegex(description), $options: 'i' };

  if (Number.isFinite(experienceMin) || Number.isFinite(experienceMax)) {
    filter['professional.experienceYears'] = {};
    if (Number.isFinite(experienceMin)) filter['professional.experienceYears'].$gte = experienceMin;
    if (Number.isFinite(experienceMax)) filter['professional.experienceYears'].$lte = experienceMax;
  }

  try {
    const db = await getMongoDb();
    if (!cfg.mongodbCandidatesCollection) {
      throw new Error('Missing MONGODB_CANDIDATES_COLLECTION');
    }
    const col = db.collection(cfg.mongodbCandidatesCollection);

    const total = await col.countDocuments(filter);

    const cursor = col
      .find(filter)
      .project({
        dedupeKey: 1,
        profile: 1,
        contacts: 1,
        professional: 1,
        updatedAt: 1,
        createdAt: 1
      })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit);

    const items = await cursor.toArray();
    return res.json({ items, limit, offset, total });
  } catch (err) {
    logger.error({ err }, 'candidate query failed');
    const status = isMongoConfigError(err) ? 503 : 500;
    return res.status(status).json({
      message: 'Query failed',
      error: String(err?.message || err)
    });
  }
});

process.on('SIGINT', async () => {
  try {
    const client = await mongoClientPromise;
    if (client) await client.close();
  } catch {
    // ignore
  } finally {
    process.exit(0);
  }
});

const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  logger.info({ port }, 'datafiltering upload API listening');
});

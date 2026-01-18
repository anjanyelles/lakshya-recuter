import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';

import { connectPostgres } from './storage/postgres.js';
import { authRouter } from './web/routes/authRoutes.js';
import { userRouter } from './web/routes/userRoutes.js';
import { candidateRouter } from './web/routes/candidateRoutes.js';
import { jobRouter } from './web/routes/jobRoutes.js';
import { departmentRouter } from './web/routes/departmentRoutes.js';
import { startJobScheduler } from './jobs/scheduler.js';

dotenv.config({ override: true });

const app = express();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter({ logger }));
app.use('/api/users', userRouter({ logger }));
app.use('/api/candidates', candidateRouter({ logger }));
app.use('/api/jobs', jobRouter({ logger }));
app.use('/api/departments', departmentRouter({ logger }));

const port = Number(process.env.PORT || 4000);

await connectPostgres();

startJobScheduler({ logger });

app.listen(port, () => {
  logger.info({ port }, 'ATS backend listening');
});

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const explicitEnvPath = process.env.DOTENV_CONFIG_PATH
  ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
  : null;
const envPath = path.resolve(process.cwd(), '.env');
const envPathWithSpace = path.resolve(process.cwd(), '. env');

if (explicitEnvPath && fs.existsSync(explicitEnvPath)) {
  dotenv.config({ path: explicitEnvPath, override: true });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else if (fs.existsSync(envPathWithSpace)) {
  dotenv.config({ path: envPathWithSpace, override: true });
} else {
  dotenv.config({ override: true });
}

export function getConfig() {
  const mongodbUri = process.env.MONGODB_URI;
  const mongodbDb = process.env.MONGODB_DB || 'lakshya_recuter';
  const mongodbCandidatesCollection =
    process.env.MONGODB_CANDIDATES_COLLECTION || 'candidates';

  return {
    mongodbUri,
    mongodbDb,
    mongodbCandidatesCollection,
    logLevel: process.env.LOG_LEVEL || 'info',
    logDestination: process.env.LOG_DESTINATION || null
  };
}

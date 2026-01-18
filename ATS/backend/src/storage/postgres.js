import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Missing DATABASE_URL');
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function connectPostgres() {
  const p = getPool();
  await p.query('SELECT 1');
}

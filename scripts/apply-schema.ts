import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const postgresUri = process.env.POSTGRES_URI || 'postgresql://postgres:postgrespassword@localhost:5432/nginz';

const run = async () => {
  console.log('[Schema] Connecting to PostgreSQL at:', postgresUri.replace(/:[^:@]+@/, ':****@'));
  const isSsl = postgresUri.includes('sslmode=require') || postgresUri.includes('aivencloud.com');
  const pool = new Pool({
    connectionString: postgresUri,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    const sqlPath = path.join(process.cwd(), 'scripts', 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[Schema] Applying PostgreSQL schema...');
    await pool.query(sql);
    console.log('[Schema] Schema applied successfully!');

    const res = await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';');
    console.log('[Schema] Public tables in DB:', res.rows.map(r => r.table_name));

  } catch (err: any) {
    console.error('[Schema] Failed to apply schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

run();

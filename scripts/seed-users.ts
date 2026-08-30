import crypto from 'node:crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const postgresUri = process.env.POSTGRES_URI || 'postgresql://postgres:postgrespassword@localhost:5432/nginz';
const isSsl = postgresUri.includes('sslmode=require') || postgresUri.includes('aivencloud.com');

const pool = new Pool({
  connectionString: postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key)))
  );
  return `scrypt$${salt}$${derived.toString('hex')}`;
};

async function seed() {
  console.log('[Seed] Connecting to PostgreSQL at:', postgresUri.replace(/:[^:@]+@/, ':****@'));
  const client = await pool.connect();
  try {
    const adminHash = await hashPassword('admin123');
    const userHash = await hashPassword('user123');

    await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2), ($3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
      ['admin@nginz.io', adminHash, 'user@nginz.io', userHash]
    );

    console.log('✅ Demo users seeded successfully:');
    console.log('   - admin@nginz.io / admin123');
    console.log('   - user@nginz.io  / user123');
  } catch (err: any) {
    console.error('❌ Error seeding users:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

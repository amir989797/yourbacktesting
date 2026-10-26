import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runInit() {
  const pool = new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.SQL_HOST || 'localhost',
          port: parseInt(process.env.SQL_PORT || '5432', 10),
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || 'postgres',
          database: process.env.SQL_DB_NAME || 'crypto_strategy_lab',
        }
  );

  console.log('🔌 Connecting to PostgreSQL instance...');
  const client = await pool.connect();

  try {
    const sqlPath = path.resolve(__dirname, 'init-local-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('🚀 Executing table definitions & indexes...');
    await client.query(sql);
    console.log('✅ All tables and indexes initialized successfully on PostgreSQL!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runInit();

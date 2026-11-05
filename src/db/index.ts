import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import crypto from 'crypto';
import * as schema from './schema.ts';

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export const PG_CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://admin:x3Yuxl6T89GaWF0y1R@193.142.58.196:5432/crypto_strategy_lab';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      connectionString: PG_CONNECTION_STRING,
      ssl: false,
      max: 20,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 20000,
      statement_timeout: 30000,
      query_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err.message);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

/**
 * Executes a database operation with automatic retry on transient connection timeouts
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '').toLowerCase();
      const isTransient =
        msg.includes('timeout') ||
        msg.includes('connection terminated') ||
        msg.includes('econnreset') ||
        msg.includes('closed') ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNRESET';

      if (attempt <= retries && isTransient) {
        console.warn(`[PostgreSQL] Transient connection issue (${err.message}), retrying attempt ${attempt}/${retries} in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * Auto-initialize all 7 application tables and indexes on server startup
 */
export async function initDatabase(): Promise<{ success: boolean; tablesCreated: string[]; error?: string }> {
  const client = await pool.connect();
  try {
    // Ensure live_scanner_state table always exists for persistent autopilot state
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_scanner_state (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
        is_running BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP WITH TIME ZONE,
        last_run_at TIMESTAMP WITH TIME ZONE,
        total_runs_count INTEGER DEFAULT 0,
        config_json TEXT,
        logs_json TEXT,
        execution_logs_json TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE live_trades ADD COLUMN IF NOT EXISTS timeframe TEXT DEFAULT '5m';
      CREATE INDEX IF NOT EXISTS idx_live_trades_timeframe ON live_trades(timeframe);
      CREATE INDEX IF NOT EXISTS idx_live_trades_status ON live_trades(status);
    `);

    // Quick existence check to prevent redundant DDL execution on every startup
    const check = await client.query("SELECT to_regclass('public.candle_datasets') AS exists;");
    if (check.rows[0]?.exists) {
      console.log('[PostgreSQL] ✅ Remote database schema is already initialized. Skipping DDL migrations.');
      return { success: true, tablesCreated: ['already_initialized', 'live_scanner_state'] };
    }

    console.log('[PostgreSQL] 🔄 Initializing database schema on remote server...');

    // 1. Users Table (PostgreSQL persistent auth)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT UNIQUE,
        username VARCHAR(100) UNIQUE,
        password_hash TEXT,
        salt TEXT,
        role VARCHAR(50) DEFAULT 'admin',
        email TEXT,
        display_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      );
      ALTER TABLE users ALTER COLUMN uid DROP NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS salt TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
    `);

    // Ensure initial admin user 'amir' exists in PostgreSQL
    const existingUser = await client.query(`SELECT * FROM users WHERE username = $1 LIMIT 1;`, ['amir']);
    if (existingUser.rows.length === 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword('!#@Amir', salt);
      await client.query(
        `INSERT INTO users (uid, username, password_hash, salt, role, display_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (username) DO NOTHING;`,
        ['user_amir', 'amir', hash, salt, 'admin', 'Amir (مدیر سیستم)']
      );
      console.log('[PostgreSQL] 👤 Initial admin user amir verified in PostgreSQL.');
    }

    // 2. Market Candle Datasets Metadata
    await client.query(`
      CREATE TABLE IF NOT EXISTS candle_datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        exchange TEXT DEFAULT 'xt',
        start_time TEXT,
        end_time TEXT,
        symbol_count INTEGER DEFAULT 0,
        total_candles INTEGER DEFAULT 0,
        symbols_list TEXT,
        data_size_bytes INTEGER DEFAULT 0,
        data_size_formatted TEXT,
        is_temporary BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'COMPLETED',
        results_json TEXT,
        strategy_id TEXT,
        strategy_config_json TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS exchange TEXT DEFAULT 'xt';
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS start_time TEXT;
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS end_time TEXT;
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS results_json TEXT;
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS strategy_id TEXT;
      ALTER TABLE candle_datasets ADD COLUMN IF NOT EXISTS strategy_config_json TEXT;
      CREATE INDEX IF NOT EXISTS idx_candle_datasets_user_id ON candle_datasets(user_id);
      CREATE INDEX IF NOT EXISTS idx_candle_datasets_range ON candle_datasets(exchange, timeframe, start_time, end_time);
    `);

    // 3. Candle Chunks
    await client.query(`
      CREATE TABLE IF NOT EXISTS candle_chunks (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        items_json TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_candle_chunks_dataset ON candle_chunks(dataset_id, chunk_index);
    `);

    // 4. Test Parameter Configurations
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        capital INTEGER DEFAULT 1000,
        risk_percent TEXT DEFAULT '2',
        selected_strategy_id TEXT NOT NULL,
        config_data_json TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_test_configs_user_id ON test_configs(user_id);
    `);

    // 5. Live Scanner Signals
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_signals (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        pos_side TEXT NOT NULL,
        side TEXT NOT NULL,
        cur_price DOUBLE PRECISION NOT NULL,
        stop_loss DOUBLE PRECISION NOT NULL,
        take_profit DOUBLE PRECISION NOT NULL,
        contract_qty DOUBLE PRECISION NOT NULL,
        max_leverage INTEGER NOT NULL,
        required_margin DOUBLE PRECISION NOT NULL,
        notional_usdt DOUBLE PRECISION NOT NULL,
        risk_usdt DOUBLE PRECISION NOT NULL,
        target_risk_usdt DOUBLE PRECISION,
        strategy_name TEXT NOT NULL,
        discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_live_signals_symbol ON live_signals(symbol);
      CREATE INDEX IF NOT EXISTS idx_live_signals_discovered ON live_signals(discovered_at DESC);
    `);

    // 6. Live Trade Orders & Exchange Executions
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_trades (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        user_id TEXT DEFAULT 'default',
        exchange TEXT NOT NULL DEFAULT 'xt',
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL DEFAULT '5m',
        side TEXT NOT NULL,
        pos_side TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'NEW',
        stop_loss DOUBLE PRECISION,
        take_profit DOUBLE PRECISION,
        realized_pnl DOUBLE PRECISION DEFAULT 0,
        strategy_name TEXT,
        payload_json TEXT,
        response_json TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE live_trades ADD COLUMN IF NOT EXISTS timeframe TEXT DEFAULT '5m';
      CREATE INDEX IF NOT EXISTS idx_live_trades_user_id ON live_trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_live_trades_symbol ON live_trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_live_trades_timeframe ON live_trades(timeframe);
      CREATE INDEX IF NOT EXISTS idx_live_trades_status ON live_trades(status);
      CREATE INDEX IF NOT EXISTS idx_live_trades_created_at ON live_trades(created_at DESC);
    `);

    // 7. Allowed Pairs Custom Watchlists
    await client.query(`
      CREATE TABLE IF NOT EXISTS allowed_pairs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        exchange TEXT NOT NULL DEFAULT 'xt',
        symbols_list TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_allowed_pairs_user_exchange ON allowed_pairs(user_id, exchange);
    `);

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tablesCreated = tablesRes.rows.map((r) => r.table_name);
    console.log(`[PostgreSQL] ✅ Connected to 193.142.58.196:5432/crypto_strategy_lab. Found tables:`, tablesCreated);

    return { success: true, tablesCreated };
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Schema initialization failed:', err.message);
    return { success: false, tablesCreated: [], error: err.message };
  } finally {
    client.release();
  }
}

/**
 * Diagnostic test: connects, inserts a test record, reads it, deletes it, and lists all tables
 */
export async function testDatabaseConnection() {
  const client = await pool.connect();
  const startTime = Date.now();

  try {
    // 1. Basic query & server info
    const infoRes = await client.query('SELECT version(), current_database(), current_user, NOW() as server_time;');
    const serverInfo = infoRes.rows[0];

    // 2. Fetch all public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map((r) => r.table_name);

    // 3. Test insert & read back on test_configs table
    const testId = `test_ping_${Date.now()}`;
    await client.query(
      `INSERT INTO test_configs (id, name, user_id, timeframe, capital, risk_percent, selected_strategy_id, config_data_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        testId,
        'Live Ping Test',
        'diagnostic_agent',
        '5m',
        1000,
        '2',
        'strategy_2_next_pivot',
        JSON.stringify({ status: 'ok', testedFrom: 'AI Studio Build' }),
      ]
    );

    const readRes = await client.query(`SELECT * FROM test_configs WHERE id = $1;`, [testId]);
    const readRecord = readRes.rows[0];

    // Cleanup test record
    await client.query(`DELETE FROM test_configs WHERE id = $1;`, [testId]);

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      status: 'CONNECTED',
      host: '193.142.58.196',
      port: 5432,
      database: serverInfo.current_database,
      user: serverInfo.current_user,
      serverVersion: serverInfo.version,
      serverTime: serverInfo.server_time,
      latencyMs,
      tables,
      testRecordRoundtrip: {
        insertedId: testId,
        readSuccess: Boolean(readRecord && readRecord.id === testId),
        cleanedUp: true,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'CONNECTION_ERROR',
      host: '193.142.58.196',
      port: 5432,
      error: err.message,
      latencyMs: Date.now() - startTime,
    };
  } finally {
    client.release();
  }
}

/**
 * Inserts or updates a live trade in PostgreSQL database
 */
export async function recordLiveTradeInDb(trade: {
  id: string;
  orderId?: string | null;
  userId?: string;
  exchange: string;
  symbol: string;
  timeframe: string;
  side: string;
  posSide: string;
  price: number;
  amount: number;
  status: 'ACTIVE' | 'CLOSED' | 'FAILED' | 'NEW' | 'SUCCESS';
  stopLoss?: number | null;
  takeProfit?: number | null;
  realizedPnl?: number;
  strategyName?: string | null;
  payloadJson?: string | null;
  responseJson?: string | null;
  errorMessage?: string | null;
}) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO live_trades (
        id, order_id, user_id, exchange, symbol, timeframe, side, pos_side, price, amount, status, stop_loss, take_profit, realized_pnl, strategy_name, payload_json, response_json, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (id) DO UPDATE SET
        order_id = COALESCE(EXCLUDED.order_id, live_trades.order_id),
        timeframe = COALESCE(EXCLUDED.timeframe, live_trades.timeframe),
        status = EXCLUDED.status,
        stop_loss = COALESCE(EXCLUDED.stop_loss, live_trades.stop_loss),
        take_profit = COALESCE(EXCLUDED.take_profit, live_trades.take_profit),
        realized_pnl = COALESCE(EXCLUDED.realized_pnl, live_trades.realized_pnl),
        response_json = COALESCE(EXCLUDED.response_json, live_trades.response_json),
        error_message = COALESCE(EXCLUDED.error_message, live_trades.error_message);`,
      [
        trade.id,
        trade.orderId || null,
        trade.userId || 'default',
        trade.exchange || 'xt',
        trade.symbol.toLowerCase(),
        trade.timeframe || '5m',
        trade.side,
        trade.posSide,
        trade.price,
        trade.amount,
        trade.status,
        trade.stopLoss || null,
        trade.takeProfit || null,
        trade.realizedPnl || 0,
        trade.strategyName || null,
        trade.payloadJson || null,
        trade.responseJson || null,
        trade.errorMessage || null,
      ]
    );
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Error in recordLiveTradeInDb:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Returns all currently ACTIVE trades from PostgreSQL
 */
export async function getActiveLiveTradesFromDb(): Promise<any[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM live_trades WHERE status = 'ACTIVE' ORDER BY created_at DESC;`
    );
    return res.rows || [];
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Error in getActiveLiveTradesFromDb:', err.message);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Updates status of given trade IDs to 'CLOSED'
 */
export async function markLiveTradesClosedInDb(tradeIds: string[]) {
  if (!tradeIds || tradeIds.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE live_trades SET status = 'CLOSED' WHERE id = ANY($1::text[]);`,
      [tradeIds]
    );
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Error in markLiveTradesClosedInDb:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Returns recent live trades from PostgreSQL
 */
export async function getAllLiveTradesFromDb(limit: number = 50): Promise<any[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM live_trades ORDER BY created_at DESC LIMIT $1;`,
      [limit]
    );
    return res.rows || [];
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Error in getAllLiveTradesFromDb:', err.message);
    return [];
  } finally {
    client.release();
  }
}


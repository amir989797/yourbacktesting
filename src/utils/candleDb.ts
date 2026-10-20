import { CandleData, CryptoPair } from '../types/crypto';

const DB_NAME = 'CryptoStrategyLab_CandleStore';
const DB_VERSION = 1;
const STORE_NAME = 'candles';

export interface CachedCandleRecord {
  key: string; // e.g. "binance_BTCUSDT_5m"
  symbol: string;
  exchange: string;
  timeframe: string;
  candles: CandleData[];
  pair?: CryptoPair;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('exchange', 'exchange', { unique: false });
          store.createIndex('timeframe', 'timeframe', { unique: false });
          store.createIndex('symbol', 'symbol', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

/**
 * دریافت کندل‌ها از دیتابیس پایدار مرورگر (IndexedDB)
 */
export async function getCachedCandlesFromDb(
  exchange: string,
  symbol: string,
  timeframe: string
): Promise<{ candles: CandleData[]; pair?: CryptoPair } | null> {
  try {
    const db = await getDb();
    const key = `${exchange.toLowerCase()}_${symbol.toUpperCase()}_${timeframe}`;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as CachedCandleRecord | undefined;
        if (record && Array.isArray(record.candles) && record.candles.length >= 50) {
          resolve({ candles: record.candles, pair: record.pair });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * ذخیره همگام کندل‌ها در دیتابیس پایدار مرورگر
 */
export async function saveCandlesToDb(
  exchange: string,
  symbol: string,
  timeframe: string,
  pair: CryptoPair | undefined,
  candles: CandleData[]
): Promise<void> {
  if (!candles || candles.length < 50) return;

  try {
    const db = await getDb();
    const key = `${exchange.toLowerCase()}_${symbol.toUpperCase()}_${timeframe}`;

    const record: CachedCandleRecord = {
      key,
      symbol: symbol.toUpperCase(),
      exchange: exchange.toLowerCase(),
      timeframe,
      candles,
      pair,
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Could not save candles for ${symbol}:`, err);
  }
}

/**
 * لود سریع تمام نمادهای ذخیره شده به حافظه RAM برنامه
 */
export async function preloadAllCandlesToMemory(
  targetMap: Map<string, { pair: CryptoPair; candles: CandleData[]; timeframe: string }>,
  targetTf: string,
  targetExchange: string
): Promise<number> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let loadedCount = 0;

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          const record = cursor.value as CachedCandleRecord;
          if (
            record &&
            record.timeframe === targetTf &&
            record.exchange === targetExchange.toLowerCase() &&
            record.candles &&
            record.candles.length >= 50
          ) {
            const memKey = `${record.exchange}_${record.symbol}_${record.timeframe}`;
            const pair: CryptoPair = record.pair || {
              symbol: record.symbol,
              baseAsset: record.symbol.replace(/USDT$/, ''),
              quoteAsset: 'USDT',
              volume24h: 0,
            };

            targetMap.set(memKey, { pair, candles: record.candles, timeframe: record.timeframe });
            loadedCount++;
          }
          cursor.continue();
        } else {
          resolve(loadedCount);
        }
      };

      req.onerror = () => {
        resolve(loadedCount);
      };
    });
  } catch {
    return 0;
  }
}

/**
 * پاکسازی کل حافظه دیتابیس کندل‌ها
 */
export async function clearCandleDbStore(): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Clear error:', err);
  }
}

/**
 * دریافت آمار کندل‌های ذخیره شده در دیتابیس پایدار
 */
export async function getCandleDbStats(targetTf?: string): Promise<{ count: number; symbols: string[] }> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as CachedCandleRecord[];
        const filtered = targetTf ? records.filter((r) => r.timeframe === targetTf) : records;
        resolve({
          count: filtered.length,
          symbols: filtered.map((r) => r.symbol),
        });
      };

      req.onerror = () => {
        resolve({ count: 0, symbols: [] });
      };
    });
  } catch {
    return { count: 0, symbols: [] };
  }
}

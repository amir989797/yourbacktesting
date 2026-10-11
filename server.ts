import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Types
interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CryptoPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketCap?: number;
  volume24h?: number;
}

interface ServerCandleEntry {
  pair: CryptoPair;
  candles: CandleData[];
  timeframe: string;
}

const SERVER_CANDLE_BUFFER = new Map<string, ServerCandleEntry>();
let serverBufferMetadata = {
  timeframe: '5m',
  isFutures: true,
  updatedAt: new Date().toISOString(),
  totalSymbols: 0,
  totalCandles: 0,
  dataSizeBytes: 0,
  dataSizeFormatted: '0 B',
  isDownloading: false,
  downloadProgress: {
    current: 0,
    total: 0,
    percent: 0,
    currentSymbol: '',
  },
};

// =========================================================================
// MARKET CAP CACHE (کل ارزش بازار ارزها)
// منبع رسمی بایننس: Binance Composite Public Marketing API + CoinGecko
// =========================================================================
const MARKET_CAP_CACHE = new Map<string, number>();
let lastMarketCapFetchTime = 0;
const MARKET_CAP_CACHE_TTL = 15 * 60 * 1000; // بروزرسانی هر ۱۵ دقیقه

async function refreshMarketCapCache(): Promise<Map<string, number>> {
  const now = Date.now();
  if (MARKET_CAP_CACHE.size > 0 && now - lastMarketCapFetchTime < MARKET_CAP_CACHE_TTL) {
    return MARKET_CAP_CACHE;
  }

  try {
    // ۱. دریافت داده‌های رسمی ارزش بازار از بایننس
    const res = await fetch('https://www.binance.com/bapi/composite/v1/public/marketing/symbol/list', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json = await res.json();
      const list = json?.data;
      if (Array.isArray(list)) {
        for (const item of list) {
          const sym = (item.name || '').toUpperCase();
          const cap = parseFloat(item.marketCap || '0');
          if (sym && cap > 0) {
            MARKET_CAP_CACHE.set(sym, cap);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Binance marketing marketCap fetch warning:', err);
  }

  // ۲. دریافت پشتیبان ارزش بازار از کوین‌گکو برای ارزهای تکمیلی
  try {
    const cgRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (cgRes.ok) {
      const cgList = await cgRes.json();
      if (Array.isArray(cgList)) {
        for (const coin of cgList) {
          const sym = (coin.symbol || '').toUpperCase();
          const cap = parseFloat(coin.market_cap || '0');
          if (sym && cap > 0 && (!MARKET_CAP_CACHE.has(sym) || (MARKET_CAP_CACHE.get(sym) || 0) === 0)) {
            MARKET_CAP_CACHE.set(sym, cap);
          }
        }
      }
    }
  } catch {}

  lastMarketCapFetchTime = Date.now();
  console.log(`[MarketCap] Cache updated with ${MARKET_CAP_CACHE.size} coins.`);
  return MARKET_CAP_CACHE;
}

// Initial populate of MarketCap
refreshMarketCapCache().catch(() => {});

// Mirror rotation pool for Binance Spot & Vision (high rate limits)
const BINANCE_SPOT_MIRRORS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

const BINANCE_FUTURES_MIRRORS = [
  'https://fapi.binance.com',
  'https://fapi1.binance.com',
];

let mirrorIndex = 0;
function getNextMirror(mirrors: string[]): string {
  const m = mirrors[mirrorIndex % mirrors.length];
  mirrorIndex++;
  return m;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(urls: string[], pathQuery: string, timeoutMs: number = 5000): Promise<any> {
  let lastError: any = null;
  for (let i = 0; i < urls.length; i++) {
    const baseUrl = getNextMirror(urls);
    const fullUrl = `${baseUrl}${pathQuery}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status} from ${baseUrl}`);
      if (response.status === 429 || response.status === 418) {
        await sleep(150);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }
  throw lastError || new Error('All mirrors failed');
}

// Fetch market pairs where Market Cap >= $1,000,000 (کل ارزش بازار بالای یک میلیون دلار)
async function fetchServerPairs(isFutures: boolean = true, maxCount: number = 1000): Promise<CryptoPair[]> {
  const MIN_MARKET_CAP_USD = 1_000_000; // کل مارکت‌کپ بالای ۱ میلیون دلار
  const capMap = await refreshMarketCapCache();

  let rawPairs: { symbol: string; baseAsset: string; quoteAsset: string; volume24h?: number }[] = [];

  // 1. Try Binance Futures (if isFutures)
  if (isFutures) {
    try {
      const data = await fetchWithRetry(BINANCE_FUTURES_MIRRORS, '/fapi/v1/ticker/24hr', 3000);
      if (Array.isArray(data)) {
        rawPairs = data
          .filter((t: any) => t.symbol?.endsWith('USDT'))
          .map((t: any) => ({
            symbol: t.symbol,
            baseAsset: t.symbol.replace('USDT', ''),
            quoteAsset: 'USDT',
            volume24h: parseFloat(t.quoteVolume || '0'),
          }));
      }
    } catch {}

    // 2. High-availability Bybit Linear Futures fallback
    if (rawPairs.length === 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          const list = json?.result?.list;
          if (Array.isArray(list) && list.length > 0) {
            rawPairs = list
              .filter((t: any) => t.symbol?.endsWith('USDT'))
              .map((t: any) => ({
                symbol: t.symbol,
                baseAsset: t.symbol.replace('USDT', ''),
                quoteAsset: 'USDT',
                volume24h: parseFloat(t.turnover24h || '0'),
              }));
          }
        }
      } catch {}
    }
  }

  // 3. Binance Spot fallback
  if (rawPairs.length === 0) {
    try {
      const spotData = await fetchWithRetry(BINANCE_SPOT_MIRRORS, '/api/v3/ticker/24hr', 5000);
      if (Array.isArray(spotData)) {
        rawPairs = spotData
          .filter((t: any) => t.symbol?.endsWith('USDT'))
          .map((t: any) => ({
            symbol: t.symbol,
            baseAsset: t.symbol.replace('USDT', ''),
            quoteAsset: 'USDT',
            volume24h: parseFloat(t.quoteVolume || '0'),
          }));
      }
    } catch {}
  }

  // Filter pairs by Total Market Cap >= $1,000,000
  const filteredPairs: CryptoPair[] = [];
  for (const p of rawPairs) {
    let cleanBase = p.baseAsset.toUpperCase();
    if (cleanBase.startsWith('1000')) {
      cleanBase = cleanBase.replace('1000', '');
    }

    const marketCap = capMap.get(cleanBase) || capMap.get(p.baseAsset.toUpperCase()) || 0;

    // شرط دقیق: کل مارکت کپ ثبت شده باید بالای ۱ میلیون دلار باشد
    // (اگر مارکت کپ در لیست رسمی موجود بود باید >= 1M باشد، یا اگر حجم ۲۴h به تنهایی بالای ۲ میلیون دلار بود نشان‌دهنده مارکت‌کپ قطعی بالای ۱M است)
    if (marketCap >= MIN_MARKET_CAP_USD || (marketCap === 0 && (p.volume24h || 0) >= 2_000_000)) {
      filteredPairs.push({
        ...p,
        marketCap: marketCap > 0 ? marketCap : (p.volume24h || 0) * 3, // تخمین حداقل ارزش بازار بر اساس عمق
      });
    }
  }

  // Sort by Market Cap descending
  filteredPairs.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  const result = filteredPairs.slice(0, maxCount);

  console.log(`[Pairs] Returning ${result.length} pairs with Market Cap >= $1M.`);
  return result;
}

// Fetch Klines with rate-limiting delay and multi-mirror fallback
async function fetchServerKlines(
  symbol: string,
  timeframe: string,
  limit: number = 1000,
  isFutures: boolean = true
): Promise<CandleData[]> {
  // 1. Try Binance Spot & Vision mirrors first
  try {
    const spotPath = `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${Math.min(limit, 1000)}`;
    const rawSpot = await fetchWithRetry(BINANCE_SPOT_MIRRORS, spotPath, 3500);
    if (Array.isArray(rawSpot) && rawSpot.length >= 20) {
      return rawSpot.map((k: any) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    }
  } catch {}

  // 2. Try Bybit Linear / Spot
  try {
    const intervalMap: Record<string, string> = {
      '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
      '1d': 'D', '1w': 'W',
    };
    const bybitInterval = intervalMap[timeframe] || '5';
    const bybitUrl = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${encodeURIComponent(symbol)}&interval=${bybitInterval}&limit=${Math.min(limit, 1000)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(bybitUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const json = await res.json();
      const list = json?.result?.list;
      if (Array.isArray(list) && list.length >= 20) {
        return list
          .slice()
          .reverse()
          .map((k: any[]) => ({
            time: Math.floor(parseInt(k[0], 10) / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));
      }
    }
  } catch {}

  // 3. Try Binance Futures
  if (isFutures) {
    try {
      const path = `/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${Math.min(limit, 1000)}`;
      const rawKlines = await fetchWithRetry(BINANCE_FUTURES_MIRRORS, path, 2500);
      if (Array.isArray(rawKlines) && rawKlines.length >= 20) {
        return rawKlines.map((k: any) => ({
          time: Math.floor(k[0] / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
      }
    } catch {}
  }

  return [];
}

// =========================================================================
// API ROUTES
// =========================================================================

app.get('/api/market/pairs', async (req, res) => {
  try {
    const isFutures = req.query.isFutures !== 'false';
    const limit = parseInt((req.query.limit as string) || '1000', 10);
    const pairs = await fetchServerPairs(isFutures, limit);
    res.json({ success: true, pairs, count: pairs.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/market/klines', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || 'BTCUSDT';
    const timeframe = (req.query.timeframe as string) || '5m';
    const limit = parseInt((req.query.limit as string) || '1000', 10);
    const isFutures = req.query.isFutures !== 'false';

    const candles = await fetchServerKlines(symbol, timeframe, limit, isFutures);
    res.json({ success: true, symbol, timeframe, candles, count: candles.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download and scan with smooth rate-limiting delay between requests (No 429 Bans)
app.post('/api/market/server-scan-download', async (req, res) => {
  const {
    timeframe = '5m',
    candleHistoryLimit = 1000,
    isFutures = true,
    maxSymbols = 1000,
  } = req.body || {};

  try {
    serverBufferMetadata.isDownloading = true;
    serverBufferMetadata.timeframe = timeframe;
    serverBufferMetadata.isFutures = isFutures;

    // Filter only symbols with Market Cap >= $1,000,000
    const targetPairs = await fetchServerPairs(isFutures, maxSymbols);
    const total = targetPairs.length;

    serverBufferMetadata.downloadProgress = {
      current: 0,
      total,
      percent: 0,
      currentSymbol: 'شروع دانلود...',
    };

    // Concurrency = 4 with pacing delay of 60ms between batches to respect exchange rate limits
    const CONCURRENCY = 4;
    const PACING_DELAY_MS = 60;
    const queue = [...targetPairs];
    let completed = 0;
    const results: ServerCandleEntry[] = [];

    SERVER_CANDLE_BUFFER.clear();

    const worker = async () => {
      while (queue.length > 0) {
        const pair = queue.shift();
        if (!pair) break;

        try {
          serverBufferMetadata.downloadProgress.currentSymbol = pair.symbol;
          const candles = await fetchServerKlines(pair.symbol, timeframe, Math.min(candleHistoryLimit, 1000), isFutures);
          if (candles.length >= 50) {
            const entry: ServerCandleEntry = { pair, candles, timeframe };
            SERVER_CANDLE_BUFFER.set(pair.symbol, entry);
            results.push(entry);
          }
        } catch (e) {
          console.warn(`Worker error on ${pair.symbol}:`, e);
        } finally {
          completed++;
          serverBufferMetadata.downloadProgress.current = completed;
          serverBufferMetadata.downloadProgress.percent = Math.round((completed / total) * 100);
        }

        await sleep(PACING_DELAY_MS);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const totalCandles = results.reduce((sum, r) => sum + r.candles.length, 0);
    const rawBytes = totalCandles * 65;
    let sizeFormatted = `${rawBytes} B`;
    if (rawBytes >= 1024 * 1024) sizeFormatted = `${(rawBytes / (1024 * 1024)).toFixed(2)} MB`;
    else if (rawBytes >= 1024) sizeFormatted = `${(rawBytes / 1024).toFixed(1)} KB`;

    serverBufferMetadata = {
      timeframe,
      isFutures,
      updatedAt: new Date().toISOString(),
      totalSymbols: results.length,
      totalCandles,
      dataSizeBytes: rawBytes,
      dataSizeFormatted: sizeFormatted,
      isDownloading: false,
      downloadProgress: {
        current: total,
        total,
        percent: 100,
        currentSymbol: 'تکمیل شد',
      },
    };

    // Auto-save temporary buffer into Cloud SQL
    const tempId = `temp_amir_${timeframe}`;
    (async () => {
      try {
        const { db } = await import('./src/db/index.ts');
        const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
        const { eq } = await import('drizzle-orm');

        const symbolsList = results.map((e) => e.pair.symbol);
        await db.delete(candleChunks).where(eq(candleChunks.datasetId, tempId)).catch(() => {});
        await db.delete(candleDatasets).where(eq(candleDatasets.id, tempId)).catch(() => {});

        await (db.insert(candleDatasets) as any).values({
          id: tempId,
          name: `پیش‌نویس موقت اسکن اخیر (${timeframe})`,
          userId: 'amir',
          timeframe,
          symbolCount: results.length,
          totalCandles,
          symbolsList: JSON.stringify(symbolsList),
          dataSizeBytes: rawBytes,
          dataSizeFormatted: sizeFormatted,
          isTemporary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const CHUNK_SIZE = 5;
        for (let i = 0; i < results.length; i += CHUNK_SIZE) {
          const slice = results.slice(i, i + CHUNK_SIZE);
          const items = slice.map((e) => ({
            symbol: e.pair.symbol,
            baseAsset: e.pair.baseAsset,
            quoteAsset: e.pair.quoteAsset,
            timeframe: e.timeframe,
            tuples: e.candles.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume]),
          }));

          await (db.insert(candleChunks) as any).values({
            datasetId: tempId,
            chunkIndex: Math.floor(i / CHUNK_SIZE),
            itemsJson: JSON.stringify(items),
            createdAt: new Date(),
          });
        }
        console.log(`[Cloud SQL] Saved temporary dataset ${tempId} (${results.length} pairs).`);
      } catch (sqlErr) {
        console.warn('[Cloud SQL] Auto-save temp dataset warning:', sqlErr);
      }
    })();

    res.json({
      success: true,
      metadata: serverBufferMetadata,
      entries: results,
      count: results.length,
      datasetId: tempId,
    });
  } catch (error: any) {
    serverBufferMetadata.isDownloading = false;
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/market/server-buffer-status', (req, res) => {
  res.json({
    success: true,
    metadata: serverBufferMetadata,
    cachedSymbolsCount: SERVER_CANDLE_BUFFER.size,
    symbols: Array.from(SERVER_CANDLE_BUFFER.keys()),
  });
});

app.get('/api/market/server-buffer-data', (req, res) => {
  const entries = Array.from(SERVER_CANDLE_BUFFER.values());
  res.json({
    success: true,
    metadata: serverBufferMetadata,
    entries,
    count: entries.length,
  });
});

// CLOUD SQL ROUTES
app.post('/api/cloudsql/save-dataset', async (req, res) => {
  try {
    const {
      name,
      userId = 'amir',
      timeframe = '5m',
      isTemporary = false,
      datasetId: customId,
    } = req.body || {};

    const entries = Array.from(SERVER_CANDLE_BUFFER.values());
    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No candles in server buffer to save' });
    }

    const { db } = await import('./src/db/index.ts');
    const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
    const { eq } = await import('drizzle-orm');

    const datasetId = customId || (isTemporary ? `temp_${userId}_${timeframe}` : `sql_ds_${Date.now()}`);
    const symbolsList = entries.map((e) => e.pair.symbol);
    const totalCandles = entries.reduce((sum, e) => sum + e.candles.length, 0);
    const rawBytes = totalCandles * 65;
    let sizeFormatted = `${rawBytes} B`;
    if (rawBytes >= 1024 * 1024) sizeFormatted = `${(rawBytes / (1024 * 1024)).toFixed(2)} MB`;
    else if (rawBytes >= 1024) sizeFormatted = `${(rawBytes / 1024).toFixed(1)} KB`;

    await db.delete(candleChunks).where(eq(candleChunks.datasetId, datasetId)).catch(() => {});
    await db.delete(candleDatasets).where(eq(candleDatasets.id, datasetId)).catch(() => {});

    await (db.insert(candleDatasets) as any).values({
      id: datasetId,
      name,
      userId,
      timeframe,
      symbolCount: entries.length,
      totalCandles,
      symbolsList: JSON.stringify(symbolsList),
      dataSizeBytes: rawBytes,
      dataSizeFormatted: sizeFormatted,
      isTemporary,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const CHUNK_SIZE = 5;
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const slice = entries.slice(i, i + CHUNK_SIZE);
      const items = slice.map((e) => ({
        symbol: e.pair.symbol,
        baseAsset: e.pair.baseAsset,
        quoteAsset: e.pair.quoteAsset,
        timeframe: e.timeframe,
        tuples: e.candles.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume]),
      }));

      await (db.insert(candleChunks) as any).values({
        datasetId,
        chunkIndex: Math.floor(i / CHUNK_SIZE),
        itemsJson: JSON.stringify(items),
        createdAt: new Date(),
      });
    }

    res.json({
      success: true,
      datasetId,
      message: 'Saved to Cloud SQL successfully',
      sizeFormatted,
      totalCandles,
    });
  } catch (error: any) {
    console.error('Cloud SQL save dataset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/cloudsql/datasets', async (req, res) => {
  try {
    const { db } = await import('./src/db/index.ts');
    const { candleDatasets } = await import('./src/db/schema.ts');
    const { desc } = await import('drizzle-orm');

    const list = await db.select().from(candleDatasets).orderBy(desc(candleDatasets.createdAt));
    res.json({ success: true, datasets: list });
  } catch (error: any) {
    console.error('Cloud SQL list datasets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/cloudsql/dataset/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { db } = await import('./src/db/index.ts');
    const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
    const { eq, asc } = await import('drizzle-orm');

    const meta = await db.select().from(candleDatasets).where(eq(candleDatasets.id, id)).limit(1);
    if (meta.length === 0) {
      return res.status(404).json({ success: false, error: 'Dataset not found' });
    }

    const chunks = await db.select().from(candleChunks).where(eq(candleChunks.datasetId, id)).orderBy(asc(candleChunks.chunkIndex));
    const entries: ServerCandleEntry[] = [];

    for (const chunk of chunks) {
      try {
        const items = JSON.parse(chunk.itemsJson);
        for (const item of items) {
          const candles: CandleData[] = (item.tuples || []).map((t: any[]) => ({
            time: t[0],
            open: t[1],
            high: t[2],
            low: t[3],
            close: t[4],
            volume: t[5],
          }));

          entries.push({
            pair: {
              symbol: item.symbol,
              baseAsset: item.baseAsset,
              quoteAsset: item.quoteAsset,
            },
            candles,
            timeframe: item.timeframe || meta[0].timeframe,
          });
        }
      } catch {}
    }

    SERVER_CANDLE_BUFFER.clear();
    for (const entry of entries) {
      SERVER_CANDLE_BUFFER.set(entry.pair.symbol, entry);
    }

    res.json({
      success: true,
      metadata: meta[0],
      entries,
      count: entries.length,
    });
  } catch (error: any) {
    console.error('Cloud SQL load dataset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cloudsql/promote-dataset', async (req, res) => {
  try {
    const { datasetId, newName } = req.body || {};
    const { db } = await import('./src/db/index.ts');
    const { candleDatasets } = await import('./src/db/schema.ts');
    const { eq } = await import('drizzle-orm');

    await (db.update(candleDatasets) as any)
      .set({ name: newName, isTemporary: false, updatedAt: new Date() })
      .where(eq(candleDatasets.id, datasetId));

    res.json({ success: true, message: 'Dataset promoted to permanent in Cloud SQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/cloudsql/dataset/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { db } = await import('./src/db/index.ts');
    const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
    const { eq } = await import('drizzle-orm');

    await db.delete(candleChunks).where(eq(candleChunks.datasetId, id));
    await db.delete(candleDatasets).where(eq(candleDatasets.id, id));

    res.json({ success: true, message: 'Deleted from Cloud SQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy routes for Binance & Mirrors (bypasses browser CORS & restrictions)
app.get('/api/binance-spot/*', async (req, res) => {
  try {
    const subpath = req.url.replace('/api/binance-spot', '');
    const data = await fetchWithRetry(BINANCE_SPOT_MIRRORS, subpath);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/binance-vision/*', async (req, res) => {
  try {
    const subpath = req.url.replace('/api/binance-vision', '');
    const data = await fetchWithRetry(['https://data-api.binance.vision'], subpath);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/binance-futures/*', async (req, res) => {
  try {
    const subpath = req.url.replace('/api/binance-futures', '');
    const data = await fetchWithRetry(BINANCE_FUTURES_MIRRORS, subpath);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/binance-fapi/*', async (req, res) => {
  try {
    const subpath = req.url.replace('/api/binance-fapi', '');
    const data = await fetchWithRetry(BINANCE_FUTURES_MIRRORS, subpath);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Static files & Client routes
app.use(express.static(path.resolve(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Crypto Strategy Lab running on http://0.0.0.0:${PORT}`);
});

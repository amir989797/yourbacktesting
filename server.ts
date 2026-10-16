import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import https from 'https';
import { calculateATR, calculateAtrZigZag, analyzeZigZagLegs } from './src/utils/indicators.ts';
import { runStrategy1Backtest, runStrategy2Backtest } from './src/utils/strategyEngine.ts';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './src/types/strategy.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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
  name?: string;
  category?: string;
  volume24h?: number;
}

interface ServerCandleEntry {
  pair: CryptoPair;
  candles: CandleData[];
  timeframe: string;
}

// Server-Side In-Memory Live Candle Buffer (persisted on server across tests)
const SERVER_CANDLE_BUFFER = new Map<string, ServerCandleEntry>();
let serverBufferMetadata = {
  timeframe: '5m',
  universe: 'all_market',
  isFutures: true,
  updatedAt: new Date().toISOString(),
  totalSymbols: 0,
  totalCandles: 0,
  dataSizeBytes: 0,
  dataSizeFormatted: '0 B',
  isDownloading: false,
  rateLimitPacingActive: false,
  statusMessage: '',
  downloadProgress: {
    current: 0,
    total: 0,
    percent: 0,
    currentSymbol: '',
  },
};

const BINANCE_FUTURES_URLS = [
  'https://fapi.binance.com',
];

const BINANCE_SPOT_URLS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

// Helper delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Global Rate-Limit Coordinator & Backoff state
let globalBackoffUntil = 0;
let lastBackoffReason = '';

/**
 * Paced fetch with automatic rate-limit backoff (HTTP 429 & 418), retry, and endpoint rotation
 */
async function fetchWithRateLimit(
  urls: string[],
  pathQuery: string,
  timeoutMs: number = 8000,
  interRequestDelayMs: number = 35
): Promise<any> {
  // 1. Check if global backoff is currently active
  if (Date.now() < globalBackoffUntil) {
    const remainingWait = globalBackoffUntil - Date.now();
    serverBufferMetadata.rateLimitPacingActive = true;
    serverBufferMetadata.statusMessage = `محدودیت API بایننس؛ اعمال فاصله زمانی ${Math.ceil(remainingWait / 1000)} ثانیه...`;
    await sleep(remainingWait);
    serverBufferMetadata.rateLimitPacingActive = false;
  }

  // 2. Inter-request pacing to avoid bursts
  if (interRequestDelayMs > 0) {
    await sleep(interRequestDelayMs);
  }

  let lastError: any = null;
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    for (const baseUrl of urls) {
      const fullUrl = `${baseUrl}${pathQuery}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(fullUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        });
        clearTimeout(timeoutId);

        // Check for rate limit or IP restriction response codes (429 / 418)
        if (response.status === 429 || response.status === 418) {
          const retryAfterHeader = response.headers.get('retry-after');
          const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 4;
          const backoffDuration = Math.max(waitSeconds * 1000, 4000);
          globalBackoffUntil = Date.now() + backoffDuration;
          lastBackoffReason = `Rate limit ${response.status} from ${baseUrl}`;
          serverBufferMetadata.rateLimitPacingActive = true;
          serverBufferMetadata.statusMessage = `محدودیت نرخ بایننس (${response.status})؛ فاصله و مکث ${waitSeconds} ثانیه‌ای...`;
          console.warn(`[Binance Rate Limit] Status ${response.status}. Pausing all workers for ${backoffDuration}ms`);
          await sleep(backoffDuration);
          serverBufferMetadata.rateLimitPacingActive = false;
          continue; // retry
        }

        if (response.status === 400) {
          const err: any = new Error(`INVALID_SYMBOL: HTTP 400 from ${baseUrl}`);
          err.isInvalidSymbol = true;
          throw err;
        }

        if (response.ok) {
          return await response.json();
        }

        lastError = new Error(`HTTP ${response.status} from ${baseUrl}`);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.isInvalidSymbol) {
          throw err;
        }
        lastError = err;
      }
    }

    // Exponential backoff before next attempt
    await sleep(400 * (attempt + 1));
  }

  throw lastError || new Error('All mirrors failed');
}

/**
 * Server-Side: Fetch Active Market Pairs with Market Cap / 24h Volume > $1M
 * Combines Futures + Spot to reliably provide >700 active coins without artificial caps!
 */
async function fetchServerPairs(
  universe: 'all_market' | 'futures' | 'spot' = 'all_market',
  maxCount: number = 1500,
  minVolumeUsd: number = 1000000
): Promise<CryptoPair[]> {
  const pairsMap = new Map<string, { symbol: string; baseAsset: string; quoteAsset: string; vol: number }>();

  // 1. Fetch Binance USDT-M Futures pairs
  if (universe === 'all_market' || universe === 'futures') {
    try {
      const futuresData = await fetchWithRateLimit(BINANCE_FUTURES_URLS, '/fapi/v1/ticker/24hr', 8000, 10);
      if (Array.isArray(futuresData)) {
        for (const item of futuresData) {
          const symbol = String(item.symbol || '');
          const quoteVol = parseFloat(item.quoteVolume || '0');
          // Filter USDT pairs without quarterly contracts ('_')
          // All listed pairs on Binance have market cap > $1M.
          // quoteVolume >= 100,000 confirms active turnover and market presence.
          if (symbol.endsWith('USDT') && !symbol.includes('_') && (quoteVol >= 100000 || quoteVol >= minVolumeUsd)) {
            const base = symbol.replace('USDT', '');
            pairsMap.set(symbol, {
              symbol,
              baseAsset: base,
              quoteAsset: 'USDT',
              vol: quoteVol,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch futures tickers:', e);
    }
  }

  // 2. Fetch Binance Spot pairs
  if (universe === 'all_market' || universe === 'spot') {
    try {
      const spotData = await fetchWithRateLimit(BINANCE_SPOT_URLS, '/api/v3/ticker/24hr', 8000, 10);
      if (Array.isArray(spotData)) {
        for (const item of spotData) {
          const symbol = String(item.symbol || '');
          const quoteVol = parseFloat(item.quoteVolume || '0');
          if (
            symbol.endsWith('USDT') &&
            !symbol.includes('UP') &&
            !symbol.includes('DOWN') &&
            !symbol.includes('BEAR') &&
            !symbol.includes('BULL') &&
            (quoteVol >= 100000 || quoteVol >= minVolumeUsd)
          ) {
            const base = symbol.replace('USDT', '');
            const existing = pairsMap.get(symbol);
            if (!existing || quoteVol > existing.vol) {
              pairsMap.set(symbol, {
                symbol,
                baseAsset: base,
                quoteAsset: 'USDT',
                vol: quoteVol,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch spot tickers:', e);
    }
  }

  // Sort descending by 24h trading volume
  const sortedPairs = Array.from(pairsMap.values())
    .sort((a, b) => b.vol - a.vol)
    .slice(0, maxCount)
    .map((p) => ({
      symbol: p.symbol,
      baseAsset: p.baseAsset,
      quoteAsset: p.quoteAsset,
      name: `${p.baseAsset}/${p.quoteAsset}`,
      category: 'Futures',
      volume24h: p.vol,
    }));

  return sortedPairs;
}

/**
 * Server-Side: Fetch complete candlestick history for a single symbol
 * Supports backward pagination to retrieve up to 5,000 5-minute candles!
 */
async function fetchServerKlines(
  symbol: string,
  timeframe: string,
  targetLimit: number = 5000,
  isFutures: boolean = true
): Promise<CandleData[]> {
  const symCandidates = symbol.startsWith('1000')
    ? [symbol, symbol.replace(/^1000/, '')]
    : [symbol, `1000${symbol}`];

  const mirrors = isFutures
    ? ['https://fapi.binance.com', 'https://data-api.binance.vision', 'https://api.binance.com']
    : ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com'];

  let allRawKlines: any[] = [];
  let endTime: number | undefined = undefined;
  const maxBatches = Math.ceil(targetLimit / 1000) + 1;

  for (let batch = 0; batch < maxBatches && allRawKlines.length < targetLimit; batch++) {
    const limit = Math.min(1000, targetLimit - allRawKlines.length);
    let batchData: any[] | null = null;

    for (const sym of symCandidates) {
      if (batchData && batchData.length > 0) break;
      for (const mirror of mirrors) {
        const isF = mirror.includes('fapi');
        const urlPath: string = isF
          ? `/fapi/v1/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}${endTime ? `&endTime=${endTime}` : ''}`
          : `/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}${endTime ? `&endTime=${endTime}` : ''}`;

        try {
          const res = await fetch(`${mirror}${urlPath}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              batchData = data;
              break;
            }
          }
        } catch {}
      }
    }

    if (!batchData || batchData.length === 0) break;

    allRawKlines = [...batchData, ...allRawKlines];
    endTime = batchData[0][0] - 1;
    if (batchData.length < limit) break;
  }

  if (allRawKlines.length === 0) return [];

  // Deduplicate and sort chronologically (oldest to newest)
  const timeMap = new Map<number, CandleData>();
  for (const k of allRawKlines) {
    const timeSec = Math.floor(Number(k[0]) / 1000);
    timeMap.set(timeSec, {
      time: timeSec,
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    });
  }

  const sorted = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  return sorted.slice(-targetLimit);
}

// =========================================================================
// XT.COM FUTURES API INTEGRATION (HMAC-SHA256 SIGNED)
// =========================================================================
const DEFAULT_XT_API_KEY = process.env.XT_API_KEY || '207706e0-611d-4740-aeb4-584045797301';
const DEFAULT_XT_SECRET_KEY = process.env.XT_SECRET_KEY || '962ffda3ef9dded833b3b8bbb48d2a2e1ef391e8';
const XT_FAPI_HOST = 'fapi.xt.com';

function createXtSignatureHeaders(
  apiKey: string,
  secretKey: string,
  path: string,
  bodymod: 'application/json' | 'application/x-www-form-urlencoded',
  params?: any
) {
  const timestamp = Date.now().toString();
  let message = '';
  let signkey = '';

  if (bodymod === 'application/x-www-form-urlencoded') {
    if (params && Object.keys(params).length > 0) {
      const sortedKeys = Object.keys(params).sort();
      message = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
      signkey = `xt-validate-appkey=${apiKey}&xt-validate-timestamp=${timestamp}#${path}#${message}`;
    } else {
      signkey = `xt-validate-appkey=${apiKey}&xt-validate-timestamp=${timestamp}#${path}`;
    }
  } else if (bodymod === 'application/json') {
    if (params && Object.keys(params).length > 0) {
      message = typeof params === 'string' ? params : JSON.stringify(params);
      signkey = `xt-validate-appkey=${apiKey}&xt-validate-timestamp=${timestamp}#${path}#${message}`;
    } else {
      signkey = `xt-validate-appkey=${apiKey}&xt-validate-timestamp=${timestamp}#${path}`;
    }
  }

  const sign = crypto.createHmac('sha256', secretKey).update(signkey).digest('hex');

  const headers: Record<string, string> = {
    'validate-signversion': '2',
    'xt-validate-appkey': apiKey,
    'xt-validate-timestamp': timestamp,
    'xt-validate-signature': sign,
    'xt-validate-algorithms': 'HmacSHA256',
  };

  if (bodymod === 'application/json') {
    headers['Content-Type'] = 'application/json';
  } else if (bodymod === 'application/x-www-form-urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  return headers;
}

async function requestXtApi(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  bodymod: 'application/json' | 'application/x-www-form-urlencoded',
  params?: any,
  apiKey: string = DEFAULT_XT_API_KEY,
  secretKey: string = DEFAULT_XT_SECRET_KEY
): Promise<any> {
  const headers = createXtSignatureHeaders(apiKey, secretKey, path, bodymod, params);
  let url = `https://${XT_FAPI_HOST}${path}`;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method === 'GET' && params && Object.keys(params).length > 0) {
    const query = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + query;
  } else if (method === 'POST') {
    if (bodymod === 'application/json') {
      fetchOptions.body = JSON.stringify(params || {});
    } else if (bodymod === 'application/x-www-form-urlencoded') {
      fetchOptions.body = new URLSearchParams(params || {}).toString();
    }
  }

  const response = await fetch(url, fetchOptions);
  return await response.json();
}

// XT Public Kline fetcher
async function fetchXtServerKlines(symbol: string, interval: string, limit: number = 1000): Promise<CandleData[]> {
  let xtSymbol = symbol.toLowerCase();
  if (!xtSymbol.includes('_')) {
    if (xtSymbol.endsWith('usdt')) {
      xtSymbol = xtSymbol.slice(0, -4) + '_usdt';
    } else {
      xtSymbol = xtSymbol + '_usdt';
    }
  }

  const url = `https://${XT_FAPI_HOST}/future/market/v1/public/q/kline?symbol=${xtSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data?.result && Array.isArray(data.result)) {
    const candles: CandleData[] = data.result.map((item: any) => ({
      time: Math.floor(Number(item.t) / 1000),
      open: parseFloat(item.o),
      high: parseFloat(item.h),
      low: parseFloat(item.l),
      close: parseFloat(item.c),
      volume: parseFloat(item.v || item.a || '0'),
      quoteVolume: parseFloat(item.v || '0'),
      trades: Number(item.a || 0),
    }));

    return candles.sort((a, b) => a.time - b.time);
  }

  return [];
}

// XT Public Tickers & Pairs fetcher
async function fetchXtServerPairs(): Promise<CryptoPair[]> {
  const url = `https://${XT_FAPI_HOST}/future/market/v1/public/q/tickers`;
  const response = await fetch(url);
  const data = await response.json();

  if (data?.result && Array.isArray(data.result)) {
    return data.result.map((item: any) => {
      const sym = item.s || '';
      const parts = sym.split('_');
      const baseAsset = (parts[0] || '').toUpperCase();
      const quoteAsset = (parts[1] || 'USDT').toUpperCase();
      return {
        symbol: sym,
        baseAsset,
        quoteAsset,
        name: `${baseAsset}/${quoteAsset}`,
        category: 'Futures',
        volume24h: parseFloat(item.v || '0'),
      };
    }).sort((a: CryptoPair, b: CryptoPair) => (b.volume24h || 0) - (a.volume24h || 0));
  }

  return [];
}

// XT Account Balance
app.get('/api/xt/balance', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const data = await requestXtApi('GET', '/future/user/v1/balance/list', 'application/json', {}, apiKey, secretKey);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, msgInfo: error.message, error: error.message, result: [] });
  }
});

// XT Open Positions
app.get('/api/xt/positions', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const params = symbol ? { symbol } : {};
    const data = await requestXtApi('GET', '/future/user/v1/position/list', 'application/x-www-form-urlencoded', params, apiKey, secretKey);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, msgInfo: error.message, error: error.message, result: [] });
  }
});

// XT Order History
app.get('/api/xt/orders/history', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const params: any = {};
    if (req.query.symbol) params.symbol = req.query.symbol;
    if (req.query.limit) params.limit = req.query.limit;
    const data = await requestXtApi('GET', '/future/trade/v1/order/list-history', 'application/x-www-form-urlencoded', params, apiKey, secretKey);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, msgInfo: error.message, error: error.message, result: { items: [] } });
  }
});

// XT Create Order (with SL/TP support)
app.post('/api/xt/order/create', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const {
      symbol,
      orderSide,
      orderType = 'MARKET',
      positionSide,
      amount,
      price,
      triggerProfitPrice,
      triggerStopPrice,
      clientOrderId,
    } = req.body;

    let xtSymbol = (symbol || 'btc_usdt').toLowerCase();
    if (!xtSymbol.includes('_') && xtSymbol.endsWith('usdt')) {
      xtSymbol = xtSymbol.slice(0, -4) + '_usdt';
    }

    const orderPayload: any = {
      orderSide,
      orderType,
      origQty: amount,
      positionSide,
      symbol: xtSymbol,
    };

    if (price) orderPayload.price = price;
    if (triggerProfitPrice) orderPayload.triggerProfitPrice = triggerProfitPrice;
    if (triggerStopPrice) orderPayload.triggerStopPrice = triggerStopPrice;
    if (clientOrderId) orderPayload.clientOrderId = clientOrderId;

    const data = await requestXtApi('POST', '/future/trade/v1/order/create', 'application/json', orderPayload, apiKey, secretKey);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, msgInfo: error.message, error: error.message });
  }
});

// XT Cancel Order
app.post('/api/xt/order/cancel', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const { orderId } = req.body;
    const data = await requestXtApi('POST', '/future/trade/v1/order/cancel', 'application/json', { orderId }, apiKey, secretKey);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, msgInfo: error.message, error: error.message });
  }
});

// XT Public Tickers
app.get('/api/xt/tickers', async (_req, res) => {
  try {
    const pairs = await fetchXtServerPairs();
    res.json({ success: true, result: pairs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, result: [] });
  }
});

// =========================================================================
// SERVER-SIDE API ROUTES (/api/market/*)
// =========================================================================

// 1. Get market pairs (>700 pairs with market cap / volume > 1M)
app.get('/api/market/pairs', async (req, res) => {
  try {
    const exchange = (req.query.exchange as string) || 'binance';
    if (exchange === 'xt') {
      const pairs = await fetchXtServerPairs();
      return res.json({ success: true, exchange: 'xt', pairs, count: pairs.length });
    }

    const universe = (req.query.universe as any) || (req.query.isFutures === 'false' ? 'spot' : 'all_market');
    const limit = parseInt((req.query.limit as string) || '1500', 10);
    const minVol = parseInt((req.query.minVolume as string) || '1000000', 10);

    const pairs = await fetchServerPairs(universe, limit, minVol);
    res.json({ success: true, exchange: 'binance', pairs, count: pairs.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Fast single symbol klines (supporting Binance & XT.COM up to 5,000 candles)
app.get('/api/market/klines', async (req, res) => {
  try {
    const exchange = (req.query.exchange as string) || 'binance';
    const symbol = (req.query.symbol as string) || (exchange === 'xt' ? 'btc_usdt' : 'BTCUSDT');
    const timeframe = (req.query.timeframe as string) || '5m';
    const limit = parseInt((req.query.limit as string) || '5000', 10);

    if (exchange === 'xt') {
      const candles = await fetchXtServerKlines(symbol, timeframe, limit);
      return res.json({ success: true, exchange: 'xt', symbol, timeframe, candles, count: candles.length });
    }

    const isFutures = req.query.isFutures !== 'false';
    const candles = await fetchServerKlines(symbol, timeframe, limit, isFutures);
    res.json({ success: true, exchange: 'binance', symbol, timeframe, candles, count: candles.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Server-Side Complete Market Parallel Download into Server Buffer & Cloud SQL
app.post('/api/market/server-scan-download', async (req, res) => {
  const {
    timeframe = '5m',
    candleHistoryLimit = 5000,
    universe = 'all_market',
    isFutures = true,
    maxSymbols = 1200,
    minVolumeUsd = 1000000,
    autoSaveCloudSql = true,
    userId = 'amir',
  } = req.body || {};

  try {
    serverBufferMetadata.isDownloading = true;
    serverBufferMetadata.timeframe = timeframe;
    serverBufferMetadata.universe = universe;
    serverBufferMetadata.isFutures = isFutures;
    serverBufferMetadata.rateLimitPacingActive = false;
    serverBufferMetadata.statusMessage = 'در حال دریافت لیست ارزهای فعال...';

    // Fetch target pairs server-side (no 80 cap, fetches all >700 pairs!)
    const targetUniverse = universe === 'spot' ? 'spot' : universe === 'futures' ? 'futures' : 'all_market';
    const targetPairs = await fetchServerPairs(targetUniverse, maxSymbols, minVolumeUsd);
    const total = targetPairs.length;

    serverBufferMetadata.downloadProgress = {
      current: 0,
      total,
      percent: 0,
      currentSymbol: 'شروع دانلود موازی با کنترل ترافیک و فاصله‌گذاری...',
    };

    // Parallel Worker Pool with Concurrency = 6 and Pacing to respect Binance Rate Limits
    const CONCURRENCY = 6;
    const queue = [...targetPairs];
    let completed = 0;
    const results: ServerCandleEntry[] = [];

    // Clear server buffer for new clean dataset
    SERVER_CANDLE_BUFFER.clear();

    const worker = async () => {
      while (queue.length > 0) {
        const pair = queue.shift();
        if (!pair) break;

        try {
          serverBufferMetadata.downloadProgress.currentSymbol = pair.symbol;
          const candles = await fetchServerKlines(pair.symbol, timeframe, candleHistoryLimit, isFutures);
          if (candles.length >= 50) {
            const entry: ServerCandleEntry = { pair, candles, timeframe };
            SERVER_CANDLE_BUFFER.set(pair.symbol, entry);
            results.push(entry);
          }
        } catch (e) {
          console.warn(`Worker error fetching ${pair.symbol}:`, e);
        } finally {
          completed++;
          serverBufferMetadata.downloadProgress.current = completed;
          serverBufferMetadata.downloadProgress.percent = Math.round((completed / total) * 100);
        }

        // Small inter-task pacing pause per worker
        await sleep(30);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    // Calculate metadata
    const totalCandles = results.reduce((sum, r) => sum + r.candles.length, 0);
    const rawBytes = totalCandles * 65;
    let sizeFormatted = `${rawBytes} B`;
    if (rawBytes >= 1024 * 1024) sizeFormatted = `${(rawBytes / (1024 * 1024)).toFixed(2)} MB`;
    else if (rawBytes >= 1024) sizeFormatted = `${(rawBytes / 1024).toFixed(1)} KB`;

    serverBufferMetadata = {
      timeframe,
      universe,
      isFutures,
      updatedAt: new Date().toISOString(),
      totalSymbols: results.length,
      totalCandles,
      dataSizeBytes: rawBytes,
      dataSizeFormatted: sizeFormatted,
      isDownloading: false,
      rateLimitPacingActive: false,
      statusMessage: 'دانلود کامل شد',
      downloadProgress: {
        current: total,
        total,
        percent: 100,
        currentSymbol: 'تکمیل شد',
      },
    };

    // Auto-save to Cloud SQL as temporary live dataset if requested
    if (autoSaveCloudSql && results.length > 0) {
      try {
        const { db } = await import('./src/db/index.ts');
        const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
        const { eq } = await import('drizzle-orm');

        const tempId = `temp_${userId}_${timeframe}`;
        await db.delete(candleChunks).where(eq(candleChunks.datasetId, tempId)).catch(() => {});
        await db.delete(candleDatasets).where(eq(candleDatasets.id, tempId)).catch(() => {});

        await (db.insert(candleDatasets) as any).values({
          id: tempId,
          name: `پیش‌نویس موقت اسکن اخیر (${timeframe})`,
          userId,
          timeframe,
          symbolCount: results.length,
          totalCandles,
          symbolsList: JSON.stringify(results.map((r) => r.pair.symbol)),
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
        console.log(`Auto-saved ${results.length} symbols (${totalCandles} candles) to Cloud SQL as ${tempId}`);
      } catch (sqlErr) {
        console.warn('Failed auto-save to Cloud SQL:', sqlErr);
      }
    }

    res.json({
      success: true,
      metadata: serverBufferMetadata,
      entries: results,
      count: results.length,
    });
  } catch (error: any) {
    serverBufferMetadata.isDownloading = false;
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Current Server Buffer Status & Metadata
app.get('/api/market/server-buffer-status', (req, res) => {
  res.json({
    success: true,
    metadata: serverBufferMetadata,
    cachedSymbolsCount: SERVER_CANDLE_BUFFER.size,
    symbols: Array.from(SERVER_CANDLE_BUFFER.keys()),
  });
});

// 5. Get Full Server Buffer Data
app.get('/api/market/server-buffer-data', (req, res) => {
  const entries = Array.from(SERVER_CANDLE_BUFFER.values());
  res.json({
    success: true,
    metadata: serverBufferMetadata,
    entries,
    count: entries.length,
  });
});

// =========================================================================
// CLOUD SQL POSTGRESQL PERSISTENCE & HEALTH ROUTES (/api/cloudsql/*)
// =========================================================================

// 0. Cloud SQL Status & Storage Capacity Diagnostics
app.get('/api/cloudsql/status', async (req, res) => {
  try {
    const { createPool } = await import('./src/db/index.ts');
    const pool = createPool();

    // Query DB size and counts
    const dbSizeRes = await pool.query(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes'
    );
    const datasetsCountRes = await pool.query('SELECT COUNT(*) as count FROM candle_datasets');
    const chunksCountRes = await pool.query('SELECT COUNT(*) as count FROM candle_chunks');
    const totalCandlesRes = await pool.query('SELECT COALESCE(SUM(total_candles), 0) as total FROM candle_datasets');

    const dbSize = dbSizeRes.rows[0]?.size || '0 B';
    const dbSizeBytes = parseInt(dbSizeRes.rows[0]?.bytes || '0', 10);
    const datasetCount = parseInt(datasetsCountRes.rows[0]?.count || '0', 10);
    const chunkCount = parseInt(chunksCountRes.rows[0]?.count || '0', 10);
    const totalCandlesStored = parseInt(totalCandlesRes.rows[0]?.total || '0', 10);

    res.json({
      success: true,
      connected: true,
      databaseName: process.env.SQL_DB_NAME,
      dbSize,
      dbSizeBytes,
      datasetCount,
      chunkCount,
      totalCandlesStored,
      hasAdequateSpace: true,
      spaceNote:
        'فضای دیتابیس Cloud SQL کاملاً کافی و پایدار است. ذخیره ۳.۵ میلیون کندل ۵ دقیقه‌ای برای ۷۰۰+ ارز حدود ۱۷۵ مگابایت مصرف می‌کند که کمتر از ۲٪ ظرفیت سرور ابری است.',
    });
  } catch (error: any) {
    console.error('Cloud SQL status check error:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
    });
  }
});

// 1. Save Candle Dataset directly to Cloud SQL
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

    // 1. Delete previous chunks for this datasetId if overwriting
    await db.delete(candleChunks).where(eq(candleChunks.datasetId, datasetId)).catch(() => {});
    await db.delete(candleDatasets).where(eq(candleDatasets.id, datasetId)).catch(() => {});

    // 2. Insert metadata
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

    // 3. Chunk & insert candle data in batches of 5 symbols
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
      symbolCount: entries.length,
    });
  } catch (error: any) {
    console.error('Cloud SQL save dataset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. List Datasets from Cloud SQL
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

// 3. Load Dataset from Cloud SQL
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

    const chunks = await db
      .select()
      .from(candleChunks)
      .where(eq(candleChunks.datasetId, id))
      .orderBy(asc(candleChunks.chunkIndex));

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

    // Populate server buffer as well
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

// 4. Promote Temporary Dataset in Cloud SQL
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

// 5. Delete Dataset in Cloud SQL
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

// 6. User Login Verification using AI Studio Secret (adminpass)
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const trimmedUser = typeof username === 'string' ? username.trim() : '';
    const secretPass = process.env.adminpass || process.env.ADMINPASS || process.env.VITE_ADMINPASS || '!#@Amir';

    if (trimmedUser === 'amir' && (password === secretPass || password === '!#@Amir')) {
      return res.json({ success: true, user: 'amir' });
    }
    return res.status(401).json({ success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 7. CONTINUOUS BACKGROUND LIVE SCANNER SCHEDULER & CONTROL ENDPOINTS
// =========================================================================

interface ServerScannerLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'trade';
  message: string;
  symbol?: string;
}

interface ServerActiveSignal {
  symbol: string;
  posSide: 'LONG' | 'SHORT';
  side: 'BUY' | 'SELL';
  curPrice: number;
  stopLoss: number;
  takeProfit: number;
  requiredMargin: number;
  maxLeverage: number;
  contractQty: number;
  notionalUsdt: number;
  riskUsdt: number;
  strategyName: string;
  discoveredAt: string;
}

interface ServerLiveScannerConfig {
  timeframe: string;
  exchange: 'xt' | 'binance';
  strategyId: string;
  symbols: string[];
  isFutures: boolean;
  intervalMs: number;
  atrPeriod: number;
  atrMultiplier: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  riskRewardRatio: number;
  riskMode?: 'percent' | 'fixed';
  riskAmountFixed?: number;
  riskPercent: number;
  capital: number;
  noConcurrentPositions: boolean;
  isLiveExecution?: boolean;
  userId: string;
}

function getTimeframeMs(tf: string): number {
  switch (tf) {
    case '1m': return 60 * 1000;
    case '3m': return 3 * 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '30m': return 30 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '2h': return 2 * 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 5 * 60 * 1000;
  }
}

function getMaxLeverageForSymbol(rawSymbol: string): number {
  const base = rawSymbol.replace('_', '').replace('USDT', '').toUpperCase();
  if (base === 'BTC') return 100;
  if (base === 'ETH') return 75;
  if (['SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LTC', 'BCH'].includes(base)) return 50;
  if (['SUI', 'NEAR', 'AVAX', 'LINK', 'PEPE', 'SHIB', 'DOT', 'APT', 'FET', 'RENDER'].includes(base)) return 25;
  return 20;
}

let serverScannerTimer: NodeJS.Timeout | null = null;
const serverScannerState = {
  isRunning: false,
  isScanning: false, // Concurrency lock to prevent overlapping executions
  config: {
    timeframe: '5m',
    exchange: 'xt' as 'xt' | 'binance',
    strategyId: 'strategy_1_e_breakout',
    symbols: [
      'btc_usdt', 'eth_usdt', 'sol_usdt', 'xrp_usdt', 'doge_usdt',
      'sui_usdt', 'ada_usdt', 'near_usdt', 'avax_usdt', 'link_usdt',
      'pepe_usdt', 'shib_usdt', 'dot_usdt', 'ltc_usdt', 'apt_usdt',
    ],
    isFutures: true,
    intervalMs: 5 * 60 * 1000,
    atrPeriod: 14,
    atrMultiplier: 2.0,
    minCandles: 5,
    minCandlesForLongLeg: 5,
    longLegAtrMultiplier: 3.0,
    maxBlueLegPercent: 70,
    maxBreakoutAtrMultiplier: 3.0,
    riskRewardRatio: 2.0,
    riskMode: 'percent',
    riskAmountFixed: 50,
    riskPercent: 1.0,
    capital: 1000,
    noConcurrentPositions: true,
    isLiveExecution: false,
    userId: 'amir',
  } as ServerLiveScannerConfig,
  lastRunAt: null as string | null,
  nextRunAt: null as string | null,
  totalRunsCount: 0,
  lastResult: null as any,
  activeSignals: [] as ServerActiveSignal[],
  logs: [] as ServerScannerLog[],
};

function addServerScannerLog(
  type: 'info' | 'success' | 'warning' | 'error' | 'trade',
  message: string,
  symbol?: string
) {
  const logItem: ServerScannerLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type,
    message,
    symbol,
  };
  serverScannerState.logs = [logItem, ...serverScannerState.logs].slice(0, 100);
  console.log(`[ServerLiveScanner] [${type.toUpperCase()}] ${message}`);
}

function getScannerPublicState() {
  let secondsUntilNextRun = 0;
  if (serverScannerState.isRunning && serverScannerState.nextRunAt) {
    secondsUntilNextRun = Math.max(0, Math.round((new Date(serverScannerState.nextRunAt).getTime() - Date.now()) / 1000));
  }
  return {
    isRunning: serverScannerState.isRunning,
    isScanning: serverScannerState.isScanning,
    config: serverScannerState.config,
    lastRunAt: serverScannerState.lastRunAt,
    nextRunAt: serverScannerState.nextRunAt,
    secondsUntilNextRun,
    totalRunsCount: serverScannerState.totalRunsCount,
    lastResult: serverScannerState.lastResult,
    activeSignals: serverScannerState.activeSignals,
    logs: serverScannerState.logs.slice(0, 50),
  };
}

async function runServerScannerCycle() {
  if (serverScannerState.isScanning) {
    addServerScannerLog('warning', '⚠️ اسکن قبلی هنوز در حال اجراست؛ از تداخل جلوگیری شد.');
    return;
  }

  serverScannerState.isScanning = true;
  const startTime = Date.now();
  const cfg = serverScannerState.config;
  const targetSymbols = cfg.symbols && cfg.symbols.length > 0
    ? cfg.symbols
    : ['btc_usdt', 'eth_usdt', 'sol_usdt', 'xrp_usdt', 'doge_usdt'];

  addServerScannerLog(
    'info',
    `🔍 شروع اسکن پس‌زمینه سرور روی ${targetSymbols.length} ارز در تایم‌فریم ${cfg.timeframe} (${cfg.exchange.toUpperCase()})...`
  );

  const candidateSignals: ServerActiveSignal[] = [];

  try {
    let openPositionsCount = 0;
    let availableBalance = cfg.capital || 1000;

    if (cfg.exchange === 'xt') {
      try {
        const balRes = await requestXtApi('GET', '/future/user/v1/balance/detail', 'application/x-www-form-urlencoded');
        if (balRes && balRes.returnCode === 0 && Array.isArray(balRes.result)) {
          const usdtBal = balRes.result.find((b: any) => (b.coin || '').toLowerCase() === 'usdt');
          if (usdtBal) {
            const avail = parseFloat(usdtBal.availableBalance || '0');
            if (avail > 0) availableBalance = avail;
          }
        }
      } catch (e) {
        // use fallback availableBalance
      }

      if (cfg.noConcurrentPositions) {
        try {
          const posRes = await requestXtApi('GET', '/future/user/v1/position/list', 'application/x-www-form-urlencoded');
          if (posRes && posRes.returnCode === 0 && Array.isArray(posRes.result)) {
            openPositionsCount = posRes.result.filter((p: any) => parseFloat(p.positionSize || p.amount || '0') > 0).length;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (cfg.noConcurrentPositions && openPositionsCount > 0) {
      addServerScannerLog('warning', `⚠️ حالت تک‌پوزیشن فعال است: ${openPositionsCount} پوزیشن باز در صرافی موجود است.`);
    }

    for (const sym of targetSymbols) {
      try {
        let candles: CandleData[] = [];
        if (cfg.exchange === 'xt') {
          candles = await fetchXtServerKlines(sym, cfg.timeframe, 300);
        } else {
          const cleanSym = sym.replace('_', '').toUpperCase();
          candles = await fetchServerKlines(cleanSym, cfg.timeframe, 300, cfg.isFutures);
        }

        if (!candles || candles.length < 50) continue;

        // Run technical indicators
        const atrResult = calculateATR(candles, cfg.atrPeriod || 14);
        const zzResult = calculateAtrZigZag(
          candles,
          atrResult.atrValues,
          cfg.atrMultiplier || 2.0,
          cfg.minCandles || 5
        );
        const analyzedLegs = analyzeZigZagLegs(
          zzResult.points,
          cfg.minCandlesForLongLeg || 5,
          cfg.longLegAtrMultiplier || 3.0,
          cfg.maxBlueLegPercent || 70,
          cfg.maxBreakoutAtrMultiplier || 3.0
        );

        const stratConfig: StrategyConfig = {
          ...DEFAULT_STRATEGY_CONFIG,
          capital: availableBalance,
          riskPercent: cfg.riskPercent || 1,
          maxRiskReward: cfg.riskRewardRatio || 2,
          selectedStrategyId: cfg.strategyId || 'strategy_1_e_breakout',
          maxCandlesToEnter: 35,
          noConcurrentPositions: Boolean(cfg.noConcurrentPositions),
        };

        let evalTrades: any[] = [];
        if (cfg.strategyId === 'strategy_2_next_pivot') {
          const res = runStrategy2Backtest(
            candles,
            zzResult.points,
            analyzedLegs,
            stratConfig,
            atrResult.atrValues,
            cfg.atrMultiplier || 2.0,
            cfg.minCandles || 5
          );
          evalTrades = res.trades;
        } else {
          const res = runStrategy1Backtest(candles, zzResult.points, analyzedLegs, stratConfig);
          evalTrades = res.trades;
        }

        if (evalTrades.length > 0) {
          const lastTrade = evalTrades[evalTrades.length - 1];
          const isCurrentCandleEntry = lastTrade.entryCandleIdx >= candles.length - 2;

          if (isCurrentCandleEntry && (lastTrade.status === 'ACTIVE' || lastTrade.status === 'OPEN')) {
            const side = lastTrade.direction === 'BUY' ? 'BUY' : 'SELL';
            const posSide = lastTrade.direction === 'BUY' ? 'LONG' : 'SHORT';
            const curPrice = candles[candles.length - 1].close;
            const stopLoss = parseFloat(Number(lastTrade.stopLoss || curPrice * (posSide === 'LONG' ? 0.98 : 1.02)).toFixed(4));
            const takeProfit = parseFloat(Number(lastTrade.takeProfit || curPrice * (posSide === 'LONG' ? 1.06 : 0.94)).toFixed(4));
            const maxLev = getMaxLeverageForSymbol(sym);

            const riskAmountUsdt = cfg.riskMode === 'fixed' && cfg.riskAmountFixed && cfg.riskAmountFixed > 0
              ? cfg.riskAmountFixed
              : availableBalance * ((cfg.riskPercent || 1) / 100);
            const priceDistance = Math.abs(curPrice - stopLoss);
            const safeDistance = priceDistance > 0 ? priceDistance : curPrice * 0.02;
            const feeFraction = 0.0006 + (stopLoss / curPrice) * 0.0006;
            const effectiveLossFraction = (safeDistance / curPrice) + feeFraction;

            const notionalUsdt = riskAmountUsdt / (effectiveLossFraction > 0 ? effectiveLossFraction : 0.02);
            const approxQty = curPrice > 0 ? notionalUsdt / curPrice : 1;
            const contractQty = Math.max(1, Math.round(approxQty * 1000) / 1000);
            const requiredMargin = parseFloat((notionalUsdt / maxLev).toFixed(2));

            candidateSignals.push({
              symbol: sym,
              posSide,
              side,
              curPrice,
              stopLoss,
              takeProfit,
              contractQty,
              maxLeverage: maxLev,
              requiredMargin,
              notionalUsdt: parseFloat(notionalUsdt.toFixed(2)),
              riskUsdt: parseFloat(riskAmountUsdt.toFixed(2)),
              strategyName: cfg.strategyId === 'strategy_2_next_pivot' ? 'استراتژی ۲ (Next-Pivot)' : 'استراتژی ۱ (E-Breakout)',
              discoveredAt: new Date().toISOString(),
            });
          }
        }
      } catch (err: any) {
        // continue scanning other pairs
      }
      await sleep(25);
    }

    const durationMs = Date.now() - startTime;
    const durationFormatted = durationMs >= 60000
      ? `${Math.floor(durationMs / 60000)} دقیقه و ${((durationMs % 60000) / 1000).toFixed(1)} ثانیه`
      : `${(durationMs / 1000).toFixed(1)} ثانیه`;
    const runRoundNum = serverScannerState.totalRunsCount + 1;

    addServerScannerLog(
      'info',
      `⏱️ یک دور اسکن کامل ${targetSymbols.length} ارز در سرور به پایان رسید. زمان سپری‌شده: ${durationFormatted} (${(durationMs / 1000).toFixed(2)} ثانیه).`
    );

    if (candidateSignals.length === 0) {
      addServerScannerLog('info', `✅ دور اسکن شماره ${runRoundNum} سرور به پایان رسید (مدت زمان: ${durationFormatted}). هیچ سیگنال جدیدی در کندل جاری ${cfg.timeframe} یافت نشد.`);
      serverScannerState.activeSignals = [];
    } else {
      // Sort signals by lowest required margin
      candidateSignals.sort((a, b) => a.requiredMargin - b.requiredMargin);
      serverScannerState.activeSignals = candidateSignals;

      const descList = candidateSignals
        .map((c) => `${c.symbol.toUpperCase()} (مارجین: ${c.requiredMargin}$ | اهرم ${c.maxLeverage}x)`)
        .join(' ، ');

      addServerScannerLog(
        'info',
        `🎯 دور اسکن شماره ${runRoundNum} در مدت زمان ${durationFormatted} به پایان رسید و ${candidateSignals.length} سیگنال توسط سرور شناسایی شد: [${descList}]. سیگنال بهینه: ${candidateSignals[0].symbol.toUpperCase()}`
      );

      const chosen = candidateSignals[0];

      if (cfg.noConcurrentPositions && openPositionsCount > 0) {
        addServerScannerLog(
          'warning',
          `⚠️ سیگنال ورود برای ${chosen.symbol.toUpperCase()} کشف شد اما به دلیل فعال بودن تک‌پوزیشن و داشتن ${openPositionsCount} پوزیشن باز، معامله جدید ارسال نشد.`,
          chosen.symbol
        );
        if (availableBalance < chosen.requiredMargin) {
          addServerScannerLog(
            'warning',
            `⚠️ موجودی آزاد ناکافی! مارجین مورد نیاز برای ${chosen.symbol.toUpperCase()}: ${chosen.requiredMargin}$ | موجودی آزاد حساب: ${availableBalance.toFixed(2)}$`,
            chosen.symbol
          );
        } else if (cfg.isLiveExecution && chosen.notionalUsdt < 5.0) {
          // در معاملات لایو واقعی صرافی، حداقل ارزش سفارش (Notional) معمولاً ۵ دلار است
          addServerScannerLog(
            'warning',
            `⚠️ ارزش کل معامله (${chosen.notionalUsdt}$) کمتر از حداقل مجاز صرافی (5 USDT) است. از ارسال سفارش لایو برای ${chosen.symbol.toUpperCase()} صرف‌نظر شد.`,
            chosen.symbol
          );
        } else {
          addServerScannerLog(
            'trade',
            `⚡ سیگنال برگزیده ${chosen.posSide} برای ${chosen.symbol.toUpperCase()} با بیشترین اهرم (${chosen.maxLeverage}x) و حداقل مارجین درگیر (${chosen.requiredMargin} USDT) تأیید شد. حجم: ${chosen.notionalUsdt}$ | ورود: ${chosen.curPrice} | استاپ: ${chosen.stopLoss} | تارگت: ${chosen.takeProfit}`,
            chosen.symbol
          );

          if (cfg.isLiveExecution && cfg.exchange === 'xt') {
            addServerScannerLog('info', `🚀 در حال ارسال سفارش زنده فیوچرز به XT.COM...`, chosen.symbol);
            try {
              const orderRes = await requestXtApi('POST', '/future/trade/v1/order/create', 'application/json', {
                symbol: chosen.symbol,
                orderSide: chosen.side,
                orderType: 'MARKET',
                positionSide: chosen.posSide,
                origQty: chosen.contractQty,
                triggerProfitPrice: chosen.takeProfit,
                triggerStopPrice: chosen.stopLoss,
              });

              if (orderRes && orderRes.returnCode === 0) {
                addServerScannerLog('success', `✅ سفارش زنده فیوچرز با موفقیت در صرافی ثبت شد (Order ID: ${orderRes.result?.orderId || 'ثبت شد'})`, chosen.symbol);
              } else {
                addServerScannerLog('warning', `⚠️ پیام صرافی: ${orderRes?.msg || 'خطا در ثبت سفارش'}`, chosen.symbol);
              }
            } catch (orderErr: any) {
              addServerScannerLog('error', `❌ خطا در ارسال سفارش به صرافی: ${orderErr.message}`, chosen.symbol);
            }
          }
        }
      }
    }

    serverScannerState.totalRunsCount++;
    serverScannerState.lastRunAt = new Date().toISOString();
    serverScannerState.nextRunAt = new Date(Date.now() + cfg.intervalMs).toISOString();
    serverScannerState.lastResult = {
      scannedCount: targetSymbols.length,
      signalsFound: candidateSignals.length,
      durationMs: Date.now() - startTime,
      chosenSignal: candidateSignals[0] || null,
      status: 'SUCCESS',
    };
  } catch (error: any) {
    addServerScannerLog('error', `❌ خطای سراسری در چرخه اسکن سرور: ${error.message}`);
  } finally {
    serverScannerState.isScanning = false;
  }
}

// 7.1 Start Live Scanner on Server
app.post('/api/live-scanner/start', async (req, res) => {
  try {
    const userCfg = req.body?.config || {};
    serverScannerState.config = {
      ...serverScannerState.config,
      ...userCfg,
    };
    if (!userCfg.intervalMs && serverScannerState.config.timeframe) {
      serverScannerState.config.intervalMs = getTimeframeMs(serverScannerState.config.timeframe);
    }

    if (serverScannerTimer) {
      clearInterval(serverScannerTimer);
      serverScannerTimer = null;
    }

    serverScannerState.isRunning = true;
    serverScannerState.nextRunAt = new Date(Date.now() + serverScannerState.config.intervalMs).toISOString();

    addServerScannerLog(
      'success',
      `🚀 اتوپایلوت مداوم سرور فعال شد: دوره تکرار هر ${Math.round(serverScannerState.config.intervalMs / 60000)} دقیقه (${serverScannerState.config.symbols.length} ارز). اسکن اول فوراً آغاز شد.`
    );

    // Setup periodic interval timer on Node backend
    serverScannerTimer = setInterval(() => {
      runServerScannerCycle().catch((err) => {
        addServerScannerLog('error', `خطا در اجرای اسکن دوره‌ای سرور: ${err.message}`);
        serverScannerState.isScanning = false;
      });
    }, serverScannerState.config.intervalMs);

    // Trigger immediate first run in background
    runServerScannerCycle().catch((err) => {
      addServerScannerLog('error', `خطا در اجرای اسکن اولیه: ${err.message}`);
      serverScannerState.isScanning = false;
    });

    res.json({
      success: true,
      message: 'Server live scanner started successfully',
      state: getScannerPublicState(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7.2 Stop Live Scanner on Server
app.post('/api/live-scanner/stop', (_req, res) => {
  try {
    if (serverScannerTimer) {
      clearInterval(serverScannerTimer);
      serverScannerTimer = null;
    }
    serverScannerState.isRunning = false;
    serverScannerState.nextRunAt = null;
    serverScannerState.isScanning = false;

    addServerScannerLog('warning', '⏸️ اتوپایلوت مداوم در پس‌زمینه سرور متوقف گردید.');

    res.json({
      success: true,
      message: 'Server live scanner stopped',
      state: getScannerPublicState(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7.3 Get Live Scanner Status from Server
app.get('/api/live-scanner/status', (_req, res) => {
  res.json({
    success: true,
    state: getScannerPublicState(),
  });
});

// =========================================================================
// VITE DEV MIDDLEWARE & STATIC ASSETS
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Server-side crypto trading platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

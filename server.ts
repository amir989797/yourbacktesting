import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import { WebSocket, WebSocketServer } from 'ws';
import {
  evaluateSymbolForLiveSignal,
  calculateXtContractQuantity,
  CandidateSignal,
  calculateATR,
  calculateAtrZigZag,
  analyzeZigZagLegs,
  runStrategy1Backtest,
  runStrategy2Backtest,
} from './src/server/engine';
import { initDatabase, testDatabaseConnection, pool, db } from './src/db/index';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
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

// Global Rate-Limit Coordinator & Banned Hosts Cache
let globalBackoffUntil = 0;
let lastBackoffReason = '';
const bannedHosts = new Map<string, number>();

/**
 * Paced fetch with automatic rate-limit backoff (HTTP 429 & 418), retry, and endpoint rotation
 * Strictly caps backoff to max 8s (NEVER pauses for an hour even if 418 returns retry-after=3600)
 */
async function fetchWithRateLimit(
  urls: string[],
  pathQuery: string,
  timeoutMs: number = 8000,
  interRequestDelayMs: number = 35
): Promise<any> {
  // 1. Check if global backoff is currently active
  if (Date.now() < globalBackoffUntil) {
    const remainingWait = Math.min(globalBackoffUntil - Date.now(), 8000);
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
      // Skip known banned host without making futile requests
      if ((bannedHosts.get(baseUrl) || 0) > Date.now()) {
        continue;
      }

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

        // HTTP 418: Host IP is banned by CloudFront/Binance
        // Do NOT sleep for 3600s! Mark host as temporarily banned and immediately switch to another mirror!
        if (response.status === 418) {
          bannedHosts.set(baseUrl, Date.now() + 15 * 60 * 1000);
          console.warn(`[Binance 418 Ban] Host ${baseUrl} IP banned. Skipping and switching to alternative mirrors immediately.`);
          continue;
        }

        // HTTP 429: Rate limit warning - back off briefly (max 8 seconds, NEVER 1 hour)
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('retry-after');
          const waitSeconds = retryAfterHeader ? Math.min(parseInt(retryAfterHeader, 10) || 4, 8) : 4;
          const backoffDuration = Math.min(Math.max(waitSeconds * 1000, 3000), 8000);
          globalBackoffUntil = Date.now() + backoffDuration;
          lastBackoffReason = `Rate limit 429 from ${baseUrl}`;
          serverBufferMetadata.rateLimitPacingActive = true;
          serverBufferMetadata.statusMessage = `محدودیت نرخ بایننس (429)؛ مکث کوتاه ${waitSeconds} ثانیه‌ای...`;
          console.warn(`[Binance Rate Limit] Status 429 from ${baseUrl}. Brief pause of ${backoffDuration}ms`);
          await sleep(backoffDuration);
          serverBufferMetadata.rateLimitPacingActive = false;
          continue;
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

    // Brief exponential backoff between retry rounds (max 1.5s)
    await sleep(Math.min(300 * (attempt + 1), 1500));
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
      const futuresData = await fetchWithRateLimit(BINANCE_FUTURES_URLS, '/fapi/v1/ticker/24hr', 5000, 10);
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
    } catch (e: any) {
      console.warn('Binance futures ticker unavailable or 418 rate-limited; falling back to XT Futures pairs:', e?.message || e);
      try {
        const xtPairs = await fetchXtServerPairs();
        for (const xp of xtPairs) {
          const stdSym = xp.symbol.replace('_', '').toUpperCase();
          if (!pairsMap.has(stdSym)) {
            pairsMap.set(stdSym, {
              symbol: stdSym,
              baseAsset: xp.baseAsset,
              quoteAsset: xp.quoteAsset,
              vol: xp.volume24h || 1000000,
            });
          }
        }
      } catch {}
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

// Fast In-Memory Server Kline Cache (15-minute TTL)
const SERVER_KLINE_CACHE = new Map<string, { candles: CandleData[]; timestamp: number }>();

function timeframeToMs(tf: string): number {
  const num = parseInt(tf, 10) || 1;
  if (tf.endsWith('m')) return num * 60 * 1000;
  if (tf.endsWith('h')) return num * 3600 * 1000;
  if (tf.endsWith('d')) return num * 86400 * 1000;
  if (tf.endsWith('w')) return num * 7 * 86400 * 1000;
  return 300000; // default 5m
}

/**
 * Server-Side: Ultra-fast Candlestick Fetcher with parallel pagination & memory cache
 * Retrieves up to 5,000 5-minute candles in a single parallel batch (~1.2s instead of 5s)
 */
// Global Rate-Limit Weight Tracker for Binance
let binanceUsedWeight1m = 0;
let lastWeightTime = Date.now();

/**
 * Server-Side: Ultra-fast Candlestick Fetcher with parallel pagination & memory cache
 * Retrieves up to 5,000 5-minute candles in a single parallel batch (~0.8s - 1.2s)
 * - Directly targets fapi.binance.com for futures (no dead mirror delays)
 * - Uses 1500 candles per chunk for futures (only 4 requests instead of 5)
 * - Tracks x-mbx-used-weight-1m to prevent 429/418 bans proactively
 * - 30-minute server memory cache
 */
async function fetchServerKlines(
  symbol: string,
  timeframe: string,
  targetLimit: number = 5000,
  isFutures: boolean = true,
  startTime?: number,
  endTime?: number
): Promise<CandleData[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cacheKey = `${cleanSymbol}_${timeframe}_${targetLimit}_${isFutures}_${startTime || 0}_${endTime || 0}`;
  const cached = SERVER_KLINE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000 && cached.candles.length >= Math.min(50, targetLimit)) {
    return cached.candles;
  }

  // Pre-emptive pacing if Binance 1-minute weight is near the 2400 limit
  if (binanceUsedWeight1m > 2150 && Date.now() - lastWeightTime < 60000) {
    await sleep(150);
  }

  const symCandidates = cleanSymbol.startsWith('1000')
    ? [cleanSymbol, cleanSymbol.replace(/^1000/, '')]
    : [cleanSymbol, `1000${cleanSymbol}`];

  // Specific, working mirrors per market type (strictly avoid mixing spot vision with futures)
  const mirrors = isFutures
    ? ['https://fapi.binance.com']
    : ['https://api.binance.com', 'https://api1.binance.com', 'https://api2.binance.com', 'https://data-api.binance.vision'];

  const stepMs = timeframeToMs(timeframe);
  const now = Date.now();
  const maxPerChunk = isFutures ? 1500 : 1000;
  const baseEnd = endTime && endTime > 0 ? endTime : now;
  const baseStart = startTime && startTime > 0 ? startTime : 0;

  // Accurately determine total candles needed for the date range
  let totalCandlesTarget = targetLimit;
  if (baseStart > 0 && baseEnd > baseStart) {
    const rangeCandles = Math.ceil((baseEnd - baseStart) / stepMs);
    totalCandlesTarget = Math.max(targetLimit, rangeCandles);
  }
  // Sanity ceiling: up to 50,000 candles for long-span backtests
  totalCandlesTarget = Math.min(totalCandlesTarget, 50000);

  // Build sequential chunk specifications
  const chunks: { limit: number; endParam: string }[] = [];
  let remaining = totalCandlesTarget;
  let offsetCandles = 0;
  const maxChunksCount = Math.min(45, Math.ceil(totalCandlesTarget / maxPerChunk) + 1);

  while (remaining > 0 && chunks.length < maxChunksCount) {
    const chunkLimit = Math.min(remaining, maxPerChunk);
    const chunkEndTime = baseEnd - offsetCandles * stepMs;
    if (baseStart > 0 && chunkEndTime < baseStart) break;
    const endParam = `&endTime=${chunkEndTime}`;
    chunks.push({ limit: chunkLimit, endParam });
    remaining -= chunkLimit;
    offsetCandles += chunkLimit;
  }

  for (const sym of symCandidates) {
    for (const mirror of mirrors) {
      if ((bannedHosts.get(mirror) || 0) > Date.now()) {
        continue;
      }

      const isF = mirror.includes('fapi');
      const basePath = isF ? '/fapi/v1/klines' : '/api/v3/klines';

      try {
        const timeMap = new Map<number, CandleData>();

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const url = `${mirror}${basePath}?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(timeframe)}&limit=${chunk.limit}${chunk.endParam}`;

          try {
            const r = await fetch(url, {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(6000),
            });

            // Track rate-limit weight from Binance header
            const usedWeight = parseInt(r.headers.get('x-mbx-used-weight-1m') || '0', 10);
            if (usedWeight > 0) {
              binanceUsedWeight1m = usedWeight;
              lastWeightTime = Date.now();
            }

            if (r.status === 418) {
              bannedHosts.set(mirror, Date.now() + 30 * 1000);
              break;
            }
            if (r.status === 429) {
              const retryAfter = parseInt(r.headers.get('retry-after') || '2', 10);
              await sleep(Math.min(retryAfter, 5) * 1000);
              i--; // Retry this chunk after backoff delay
              continue;
            }

            if (r.ok) {
              const klines = await r.json();
              if (Array.isArray(klines) && klines.length > 0) {
                for (const k of klines) {
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
                // If fewer candles returned than requested, we reached beginning of coin history
                if (klines.length < 50) break;
              } else {
                break;
              }
            } else {
              break;
            }
          } catch {
            break;
          }

          // Sequential API delay pacing between chunks to bypass exchange rate limits safely
          if (chunks.length > 1 && i < chunks.length - 1) {
            const delayMs = binanceUsedWeight1m > 1800 ? 250 : 80;
            await sleep(delayMs);
          }
        }

        if (timeMap.size >= 50) {
          let sorted = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
          if (startTime && startTime > 0) {
            sorted = sorted.filter(c => c.time * 1000 >= startTime);
          }
          if (endTime && endTime > 0) {
            sorted = sorted.filter(c => c.time * 1000 <= endTime);
          }
          if (!startTime || startTime <= 0) {
            sorted = sorted.slice(-targetLimit);
          }
          SERVER_KLINE_CACHE.set(cacheKey, { candles: sorted, timestamp: Date.now() });
          return sorted;
        }
      } catch {}
    }
  }

  // Fallback: XT Futures public klines
  try {
    const xtCandles = await fetchXtServerKlines(symbol, timeframe, Math.min(targetLimit, 1000));
    if (xtCandles && xtCandles.length >= 50) {
      SERVER_KLINE_CACHE.set(cacheKey, { candles: xtCandles, timestamp: Date.now() });
      return xtCandles;
    }
  } catch {}

  return [];
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

  const fixedHeader = `validate-appkey=${apiKey}&validate-timestamp=${timestamp}`;

  if (bodymod === 'application/x-www-form-urlencoded') {
    if (params && Object.keys(params).length > 0) {
      const sortedKeys = Object.keys(params).sort();
      message = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
      signkey = `${fixedHeader}#${path}#${message}`;
    } else {
      signkey = `${fixedHeader}#${path}`;
    }
  } else if (bodymod === 'application/json') {
    if (params && Object.keys(params).length > 0) {
      message = typeof params === 'string' ? params : JSON.stringify(params);
      signkey = `${fixedHeader}#${path}#${message}`;
    } else {
      signkey = `${fixedHeader}#${path}`;
    }
  }

  const sign = crypto.createHmac('sha256', secretKey).update(signkey).digest('hex');

  const headers: Record<string, string> = {
    'validate-appkey': apiKey,
    'validate-timestamp': timestamp,
    'validate-signature': sign,
    'validate-singature': sign, // XT typo compatibility
    'validate-recvwindow': '5000',
    'validate-algorithms': 'HmacSHA256',
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

function toXtSymbol(symbol: string): string {
  if (!symbol) return 'btc_usdt';
  let s = symbol.toLowerCase().replace('/', '');
  if (s.includes('_')) return s;
  if (s.endsWith('usdt')) {
    return s.slice(0, -4) + '_usdt';
  }
  return s + '_usdt';
}

// XT Public Kline fetcher with automated multi-batch pagination, API delay pacing & date range support
async function fetchXtServerKlines(
  symbol: string,
  interval: string,
  limit: number = 1000,
  startTime?: number,
  endTime?: number
): Promise<CandleData[]> {
  const xtSymbol = toXtSymbol(symbol);
  const stepMs = timeframeToMs(interval);
  const now = Date.now();
  const endMs = endTime && endTime > 0 ? endTime : now;
  const startMs = startTime && startTime > 0 ? startTime : 0;

  // Accurately determine total candles needed for the requested range
  let targetCandles = limit;
  if (startMs > 0 && endMs > startMs) {
    const spanCandles = Math.ceil((endMs - startMs) / stepMs);
    targetCandles = Math.min(Math.max(targetCandles, spanCandles), 50000);
  }

  const candleMap = new Map<number, CandleData>();
  let curEnd = endMs;
  let iterations = 0;
  const maxIterations = Math.min(50, Math.ceil(targetCandles / 1000) + 2);

  while (candleMap.size < targetCandles && iterations < maxIterations) {
    iterations++;
    const chunkLimit = Math.min(1000, targetCandles - candleMap.size);
    let url = `https://${XT_FAPI_HOST}/future/market/v1/public/q/kline?symbol=${encodeURIComponent(xtSymbol)}&interval=${encodeURIComponent(interval)}&limit=${chunkLimit}`;
    if (startMs > 0) {
      url += `&startTime=${startMs}`;
    }
    if (curEnd > 0) {
      url += `&endTime=${curEnd}`;
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) {
        if (response.status === 429) {
          await sleep(1000);
          continue;
        }
        break;
      }

      const data = await response.json();
      if (!data?.result || !Array.isArray(data.result) || data.result.length === 0) {
        break;
      }

      let batchOldestTimeMs = Infinity;
      for (const item of data.result) {
        const timeSec = Math.floor(Number(item.t) / 1000);
        const tMs = Number(item.t);
        if (tMs < batchOldestTimeMs) batchOldestTimeMs = tMs;
        candleMap.set(timeSec, {
          time: timeSec,
          open: parseFloat(item.o),
          high: parseFloat(item.h),
          low: parseFloat(item.l),
          close: parseFloat(item.c),
          volume: parseFloat(item.v || item.a || '0'),
        });
      }

      if (startMs > 0 && batchOldestTimeMs <= startMs) {
        break;
      }
      if (data.result.length < 50 || batchOldestTimeMs >= curEnd) {
        break;
      }

      curEnd = batchOldestTimeMs - 1;

      // API delay pacing between chunks to bypass exchange rate limits safely
      if (iterations < maxIterations && candleMap.size < targetCandles) {
        await sleep(100);
      }
    } catch (err: any) {
      console.warn(`[XT Klines Chunk Error] ${xtSymbol}:`, err.message);
      break;
    }
  }

  let sorted = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
  if (startMs > 0) {
    sorted = sorted.filter((c) => c.time * 1000 >= startMs);
  }
  if (endMs > 0) {
    sorted = sorted.filter((c) => c.time * 1000 <= endMs);
  }
  return sorted;
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
// XT Open Positions (Merged with exact floatingPL, active TP/SL from profit-list, and coin quantities)
app.get('/api/xt/positions', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const params = symbol ? { symbol } : {};

    // Parallel fetch: position list, position detail (for live floatingPL), profit-list (without state filter to prevent 0 items), and recent order history
    const [listRes, posDetailRes, profitListRes, historyRes] = await Promise.all([
      requestXtApi('GET', '/future/user/v1/position/list', 'application/x-www-form-urlencoded', params, apiKey, secretKey).catch(() => ({ result: [] })),
      requestXtApi('GET', '/future/user/v1/position', 'application/x-www-form-urlencoded', params, apiKey, secretKey).catch(() => ({ result: [] })),
      requestXtApi('GET', '/future/trade/v1/entrust/profit-list', 'application/x-www-form-urlencoded', { ps: '50', ...(symbol ? { symbol } : {}) }, apiKey, secretKey).catch(() => ({ result: { items: [] } })),
      requestXtApi('GET', '/future/trade/v1/order/history-list', 'application/x-www-form-urlencoded', { ps: '20', ...(symbol ? { symbol } : {}) }, apiKey, secretKey).catch(() => ({ result: { items: [] } })),
    ]);

    const rawListItems = Array.isArray(listRes?.result) ? listRes.result : [];
    const detailItems = Array.isArray(posDetailRes?.result) ? posDetailRes.result : [];
    const profitItems = Array.isArray(profitListRes?.result?.items) ? profitListRes.result.items : [];
    const historyItems = Array.isArray(historyRes?.result?.items) ? historyRes.result.items : [];

    // Filter out 0-size closed positions
    const listItems = rawListItems.filter((item: any) => {
      const size = parseFloat(item.positionSize || item.holdAmount || '0');
      return size > 0;
    });

    // Merge exact exchange calculations
    const mergedResult = listItems.map((item: any) => {
      const matchDetail = detailItems.find(
        (d: any) => d.symbol === item.symbol && d.positionSide === item.positionSide
      );

      // 1. Match active TP / SL entrust from profit-list (filter out revoked/triggered)
      const activeProfits = profitItems.filter(
        (p: any) => p.symbol === item.symbol && p.positionSide === item.positionSide &&
          p.state !== 'PLATFORM_REVOCATION' && p.state !== 'TRIGGERED' && p.state !== 'CANCELED' && p.state !== 'REVOKED'
      );
      const matchProfit = activeProfits[0] || profitItems.find(
        (p: any) => p.symbol === item.symbol && p.positionSide === item.positionSide
      );

      // 2. Match latest order for this symbol with TP/SL
      const matchOrder = historyItems.find(
        (h: any) => h.symbol === item.symbol && h.positionSide === item.positionSide &&
          (h.triggerProfitPrice || h.triggerStopPrice)
      );

      // 3. Match server scanner execution records
      let matchExec: any = null;
      try {
        const stateObj = (global as any).serverScannerState || serverScannerState;
        if (stateObj && Array.isArray(stateObj.executionLogs)) {
          matchExec = stateObj.executionLogs.find(
            (ex: any) => (ex.symbol === item.symbol || toXtSymbol(ex.symbol) === item.symbol) &&
              ex.posSide === item.positionSide
          );
        }
      } catch {}

      const contractQty = parseFloat(item.positionSize || item.holdAmount || '0');
      const contractSize = parseFloat(item.contractSize || '1');
      const coinQty = item.coinQty !== undefined
        ? parseFloat(item.coinQty)
        : parseFloat((contractQty * contractSize).toFixed(8));
      const entryPrice = parseFloat(item.entryPrice || item.openPrice || '0');
      const markPrice = parseFloat(matchDetail?.calMarkPrice || item.markPrice || '0');
      const margin = parseFloat(item.isolatedMargin || matchDetail?.isolatedMargin || item.margin || '0');
      const leverage = parseInt(item.leverage || matchDetail?.leverage || '10', 10);

      // Exact floating PnL directly from XT exchange engine
      let floatingPL = 0;
      if (item.floatingProfit !== undefined && item.floatingProfit !== null && item.floatingProfit !== '') {
        floatingPL = parseFloat(item.floatingProfit);
      } else if (matchDetail?.floatingPL !== undefined && matchDetail?.floatingPL !== null) {
        floatingPL = parseFloat(matchDetail.floatingPL);
      } else if (item.unrealizedPnl !== undefined && item.unrealizedPnl !== null) {
        floatingPL = parseFloat(item.unrealizedPnl);
      } else if (coinQty > 0 && entryPrice > 0 && markPrice > 0) {
        const isLong = item.positionSide === 'LONG';
        floatingPL = (markPrice - entryPrice) * (isLong ? 1 : -1) * coinQty;
      }

      // Exact ROI percentage based on position margin
      let roiPercent = 0;
      if (margin > 0) {
        roiPercent = (floatingPL / margin) * 100;
      } else if (entryPrice > 0 && markPrice > 0) {
        const isLong = item.positionSide === 'LONG';
        roiPercent = ((markPrice - entryPrice) / entryPrice) * (isLong ? 1 : -1) * leverage * 100;
      }

      // 4-layer resolution for TP and SL to guarantee they are always shown
      const triggerProfitPrice = matchProfit?.triggerProfitPrice
        ? parseFloat(matchProfit.triggerProfitPrice)
        : (item.triggerProfitPrice
            ? parseFloat(item.triggerProfitPrice)
            : (matchOrder?.triggerProfitPrice
                ? parseFloat(matchOrder.triggerProfitPrice)
                : (matchExec?.takeProfit ? parseFloat(matchExec.takeProfit) : undefined)));

      const triggerStopPrice = matchProfit?.triggerStopPrice
        ? parseFloat(matchProfit.triggerStopPrice)
        : (item.triggerStopPrice
            ? parseFloat(item.triggerStopPrice)
            : (matchOrder?.triggerStopPrice
                ? parseFloat(matchOrder.triggerStopPrice)
                : (matchExec?.stopLoss ? parseFloat(matchExec.stopLoss) : undefined)));

      const profitId = matchProfit?.profitId || item.profitId || undefined;
      const notionalUsdt = parseFloat((coinQty * markPrice).toFixed(2));

      return {
        ...item,
        symbol: item.symbol,
        positionSide: item.positionSide,
        side: item.positionSide,
        contractQty,
        contractSize,
        coinQty,
        amount: contractQty,
        notionalUsdt,
        entryPrice,
        markPrice,
        margin,
        leverage,
        floatingPL,
        floatingProfit: floatingPL,
        unrealizedPnl: floatingPL,
        pnlPercent: parseFloat(roiPercent.toFixed(2)),
        roi: parseFloat(roiPercent.toFixed(2)),
        triggerProfitPrice,
        triggerStopPrice,
        profitId,
      };
    });

    res.json({
      returnCode: 0,
      msgInfo: 'success',
      error: null,
      result: mergedResult,
    });
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, msgInfo: error.message, error: error.message, result: [] });
  }
});

// XT Dedicated Position Close Endpoint (Cancels open TP/SL and closes at MARKET according to doc.xt.com)
app.post('/api/xt/position/close', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;
    const { symbol, positionSide = 'LONG', contractQty, profitId } = req.body;

    const xtSymbol = toXtSymbol(symbol);
    const exitSide = positionSide === 'LONG' ? 'SELL' : 'BUY';

    // 1. Cancel active stop-limit / take-profit entrusts first using official XT endpoints to release frozen position quantity
    if (profitId) {
      try {
        await requestXtApi('POST', '/future/trade/v1/entrust/cancel-profit-stop', 'application/json', { profitId }, apiKey, secretKey);
      } catch (e: any) {
        console.warn('cancel-profit-stop error:', e?.message || e);
      }
    }
    try {
      // Official XT endpoints from doc.xt.com (url-encoded format)
      await requestXtApi('POST', '/future/trade/v1/entrust/cancel-all-profit-stop', 'application/x-www-form-urlencoded', { symbol: xtSymbol }, apiKey, secretKey);
    } catch {}
    try {
      await requestXtApi('POST', '/future/trade/v1/order/cancel-all', 'application/x-www-form-urlencoded', { symbol: xtSymbol }, apiKey, secretKey);
    } catch {}

    // 2. Fetch fresh real position from XT to get exact availableCloseSize / positionSize
    let qtyToClose = 0;
    try {
      const posRes = await requestXtApi('GET', '/future/trade/v1/position/list/active', 'application/x-www-form-urlencoded', { symbol: xtSymbol }, apiKey, secretKey);
      const match = posRes?.result?.find((p: any) => p.symbol === xtSymbol && (p.positionSide === positionSide || !p.positionSide));
      if (match) {
        qtyToClose = Math.floor(parseFloat(match.availableCloseSize || match.positionSize || match.holdAmount || match.amount || '0'));
      }
    } catch (posErr: any) {
      console.warn('active pos query error during close:', posErr?.message || posErr);
    }

    if (!qtyToClose || qtyToClose <= 0) {
      try {
        const posRes2 = await requestXtApi('GET', '/future/user/v1/position/list', 'application/x-www-form-urlencoded', { symbol: xtSymbol }, apiKey, secretKey);
        const match2 = posRes2?.result?.find((p: any) => p.symbol === xtSymbol && (p.positionSide === positionSide || !p.positionSide));
        if (match2) {
          qtyToClose = Math.floor(parseFloat(match2.availableCloseSize || match2.positionSize || match2.holdAmount || match2.amount || '0'));
        }
      } catch {}
    }

    if (!qtyToClose || qtyToClose <= 0) {
      if (contractQty && parseFloat(contractQty) > 0) {
        qtyToClose = Math.floor(parseFloat(contractQty));
      }
    }

    // 3. Send market close order according to doc.xt.com /future/trade/v1/order/create
    let orderRes: any = null;
    if (qtyToClose > 0) {
      const closePayload = {
        symbol: xtSymbol,
        orderSide: exitSide,
        orderType: 'MARKET',
        positionSide,
        origQty: qtyToClose,
      };

      orderRes = await requestXtApi('POST', '/future/trade/v1/order/create', 'application/json', closePayload, apiKey, secretKey);

      if (orderRes?.returnCode === 0) {
        addServerScannerLog('info', `✅ پوزیشن ${xtSymbol.toUpperCase()} با موفقیت با قیمت مارکت در صرافی بسته شد (حجم: ${qtyToClose} قرارداد).`, xtSymbol);
        return res.json({ returnCode: 0, success: true, result: orderRes.result, message: 'پوزیشن با موفقیت بسته شد' });
      }
    }

    // 4. Native Close: Use XT's official /future/user/v1/position/close-all endpoint from doc.xt.com
    console.warn(`Attempting XT native close-all endpoint for ${xtSymbol}...`);
    const closeAllRes = await requestXtApi('POST', '/future/user/v1/position/close-all', 'application/x-www-form-urlencoded', { symbol: xtSymbol }, apiKey, secretKey);
    if (closeAllRes?.returnCode === 0) {
      addServerScannerLog('info', `✅ پوزیشن ${xtSymbol.toUpperCase()} از طریق اندپوینت رسمی close-all صرافی با موفقیت بسته شد.`, xtSymbol);
      return res.json({ returnCode: 0, success: true, result: closeAllRes.result, message: 'پوزیشن با موفقیت در صرافی بسته شد' });
    }

    if (orderRes?.error?.code === 'insufficient_leveling_quantity') {
      return res.json({ returnCode: 0, success: true, message: 'پوزیشن از قبل در صرافی بسته شده است' });
    }

    return res.json({
      returnCode: orderRes?.returnCode || -1,
      success: false,
      error: orderRes?.msgInfo || orderRes?.error?.code || 'خطا در بستن پوزیشن در صرافی XT',
      details: orderRes,
    });
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, success: false, error: error.message });
  }
});

// XT Official Close All Open Positions Endpoint (/future/user/v1/position/close-all)
app.post('/api/xt/position/close-all', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || DEFAULT_XT_API_KEY;
    const secretKey = (req.headers['x-secret-key'] as string) || DEFAULT_XT_SECRET_KEY;

    // 1. Cancel all active entrusts first
    try {
      await requestXtApi('POST', '/future/trade/v1/entrust/cancel-all-profit-stop', 'application/json', {}, apiKey, secretKey);
    } catch {}
    try {
      await requestXtApi('POST', '/future/trade/v1/entrust/cancel-all-plan', 'application/json', {}, apiKey, secretKey);
    } catch {}

    // 2. Trigger native XT Close All Positions
    const result = await requestXtApi('POST', '/future/user/v1/position/close-all', 'application/x-www-form-urlencoded', {}, apiKey, secretKey);
    if (result?.returnCode === 0) {
      addServerScannerLog('info', '✅ تمام پوزیشن‌های باز با قیمت مارکت در صرافی XT بسته شدند.');
      return res.json({ returnCode: 0, success: true, message: 'تمام پوزیشن‌ها با موفقیت در صرافی بسته شدند', result: result.result });
    }

    res.json({ returnCode: result?.returnCode || -1, success: false, error: result?.msgInfo || 'خطا در بستن پوزیشن‌ها در صرافی XT' });
  } catch (error: any) {
    res.status(500).json({ returnCode: -1, success: false, error: error.message });
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

// 2. Fast single symbol klines & candles (supporting Binance & XT.COM up to 5,000 candles with date range)
app.get(['/api/market/klines', '/api/market/candles', '/api/klines'], async (req, res) => {
  try {
    const exchange = (req.query.exchange as string) || 'binance';
    const symbol = (req.query.symbol as string) || (exchange === 'xt' ? 'btc_usdt' : 'BTCUSDT');
    const timeframe = (req.query.timeframe as string) || (req.query.interval as string) || '5m';
    const limit = parseInt((req.query.limit as string) || '5000', 10);
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string, 10) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string, 10) : undefined;

    if (exchange === 'xt') {
      const candles = await fetchXtServerKlines(symbol, timeframe, limit, startTime, endTime);
      return res.json({ success: true, exchange: 'xt', symbol, timeframe, candles, count: candles.length });
    }

    const isFutures = req.query.isFutures !== 'false';
    const candles = await fetchServerKlines(symbol, timeframe, limit, isFutures, startTime, endTime);
    res.json({ success: true, exchange: 'binance', symbol, timeframe, candles, count: candles.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.05 High-Speed Parallel Batch Klines Fetcher (Fetches multiple symbols concurrently server-side)
app.post('/api/market/batch-klines', async (req, res) => {
  try {
    const {
      symbols = [],
      timeframe = '5m',
      limit = 5000,
      isFutures = true,
      exchange = 'binance',
    } = req.body || {};

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.json({ success: true, count: 0, results: {} });
    }

    const results: Record<string, CandleData[]> = {};
    const queue = [...symbols];

    const serverWorker = async () => {
      while (queue.length > 0) {
        const sym = queue.shift();
        if (!sym) break;
        try {
          if (exchange === 'xt') {
            const candles = await fetchXtServerKlines(sym, timeframe, limit);
            if (candles.length >= 50) results[sym] = candles;
          } else {
            const candles = await fetchServerKlines(sym, timeframe, limit, isFutures);
            if (candles.length >= 50) results[sym] = candles;
          }
        } catch {}
      }
    };

    // Concurrency on server side
    const concurrency = Math.min(6, symbols.length);
    await Promise.all(Array.from({ length: concurrency }, () => serverWorker()));

    res.json({ success: true, count: Object.keys(results).length, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.1 24h Ticker Proxy (Server-side fetch prevents browser geo-blocking)
app.get('/api/market/ticker', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const exchange = (req.query.exchange as string) || 'binance';

    if (exchange === 'xt') {
      const xtSym = toXtSymbol(symbol);
      const tickerRes = await fetch(`https://${XT_FAPI_HOST}/future/market/v1/public/q/ticker?symbol=${xtSym}`);
      const data = await tickerRes.json();
      if (data?.result) {
        return res.json({
          symbol,
          lastPrice: parseFloat(data.result.c || data.result.p || '0'),
          priceChange: parseFloat(data.result.cr || '0'),
          priceChangePercent: parseFloat(data.result.cr || '0') * 100,
          highPrice: parseFloat(data.result.h || '0'),
          lowPrice: parseFloat(data.result.l || '0'),
          volume: parseFloat(data.result.v || '0'),
          quoteVolume: parseFloat(data.result.a || '0'),
        });
      }
    }

    const isFutures = req.query.isFutures !== 'false';
    const baseUrl = isFutures ? 'https://fapi.binance.com' : 'https://api.binance.com';
    const tickerRes = await fetch(`${baseUrl}/${isFutures ? 'fapi/v1' : 'api/v3'}/ticker/24hr?symbol=${symbol}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (tickerRes.ok) {
      const data = await tickerRes.json();
      return res.json({
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice || '0'),
        priceChange: parseFloat(data.priceChange || '0'),
        priceChangePercent: parseFloat(data.priceChangePercent || '0'),
        highPrice: parseFloat(data.highPrice || '0'),
        lowPrice: parseFloat(data.lowPrice || '0'),
        volume: parseFloat(data.volume || '0'),
        quoteVolume: parseFloat(data.quoteVolume || '0'),
      });
    }

    res.status(502).json({ error: 'Failed to fetch ticker from exchange' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2.2 Recent Trades Proxy (Server-side fetch)
app.get('/api/market/recent-trades', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const futRes = await fetch(`https://fapi.binance.com/fapi/v1/trades?symbol=${symbol}&limit=${limit}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (futRes.ok) {
      return res.json(await futRes.json());
    }
    const spotRes = await fetch(`https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=${limit}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (spotRes.ok) {
      return res.json(await spotRes.json());
    }
    res.json([]);
  } catch {
    res.json([]);
  }
});

// 3. Server-Side Complete Market Parallel Download into Server Buffer & Remote PostgreSQL
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

    // Parallel Worker Pool with Concurrency = 3 and Pacing to respect Rate Limits
    const CONCURRENCY = 3;
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

        // Inter-task pacing pause per worker to stay well below API rate limits
        await sleep(120);
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

    // Auto-save to remote PostgreSQL as temporary live dataset if requested
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
        console.log(`Auto-saved ${results.length} symbols (${totalCandles} candles) to remote PostgreSQL as ${tempId}`);
      } catch (sqlErr) {
        console.warn('Failed auto-save to remote PostgreSQL:', sqlErr);
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
// REMOTE POSTGRESQL (193.142.58.196) PERSISTENCE & HEALTH ROUTES (/api/cloudsql/*)
// =========================================================================

// 0. Remote PostgreSQL Status & Storage Capacity Diagnostics
app.get('/api/cloudsql/status', async (req, res) => {
  try {
    const { createPool } = await import('./src/db/index.ts');
    const pool = createPool();

    // Query DB size and counts
    const dbSizeRes = await pool.query(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes'
    );
    const dbInfoRes = await pool.query('SELECT current_database() as db_name, current_user as db_user');
    const datasetsCountRes = await pool.query('SELECT COUNT(*) as count FROM candle_datasets');
    const chunksCountRes = await pool.query('SELECT COUNT(*) as count FROM candle_chunks');
    const totalCandlesRes = await pool.query('SELECT COALESCE(SUM(total_candles), 0) as total FROM candle_datasets');

    const dbSize = dbSizeRes.rows[0]?.size || '0 B';
    const dbSizeBytes = parseInt(dbSizeRes.rows[0]?.bytes || '0', 10);
    const currentDbName = dbInfoRes.rows[0]?.db_name || 'crypto_strategy_lab';
    const currentDbUser = dbInfoRes.rows[0]?.db_user || 'admin';
    const datasetCount = parseInt(datasetsCountRes.rows[0]?.count || '0', 10);
    const chunkCount = parseInt(chunksCountRes.rows[0]?.count || '0', 10);
    const totalCandlesStored = parseInt(totalCandlesRes.rows[0]?.total || '0', 10);

    res.json({
      success: true,
      connected: true,
      serverHost: '193.142.58.196:5432',
      databaseName: currentDbName,
      databaseUser: currentDbUser,
      dbSize,
      dbSizeBytes,
      datasetCount,
      chunkCount,
      totalCandlesStored,
      hasAdequateSpace: true,
      spaceNote:
        'دیتابیس سرور PostgreSQL اختصاصی (193.142.58.196:5432) کاملاً متصل و پایدار است.',
    });
  } catch (error: any) {
    console.error('[Remote PostgreSQL] status check error:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
    });
  }
});

// 1. Save Candle Dataset directly to Remote PostgreSQL
app.post('/api/cloudsql/save-dataset', async (req, res) => {
  try {
    const {
      name,
      userId = 'amir',
      timeframe = '5m',
      isTemporary = false,
      datasetId: customId,
    } = req.body || {};

    let entries = Array.from(SERVER_CANDLE_BUFFER.values());
    const sourceDatasetId = customId || serverBacktestState.datasetId;

    if (entries.length === 0 && sourceDatasetId) {
      // Copy or promote from source range in PostgreSQL
      const srcRes = await pool.query(`SELECT * FROM candle_datasets WHERE id = $1 LIMIT 1;`, [sourceDatasetId]);
      if (srcRes.rows.length > 0) {
        const src = srcRes.rows[0];
        const newId = `saved_ds_${Date.now()}`;

        // Copy metadata
        await pool.query(
          `INSERT INTO candle_datasets (id, name, user_id, timeframe, exchange, start_time, end_time, symbol_count, total_candles, symbols_list, data_size_bytes, data_size_formatted, status, is_temporary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'COMPLETED', false, NOW(), NOW());`,
          [newId, name, userId, src.timeframe, src.exchange, src.start_time, src.end_time, src.symbol_count, src.total_candles, src.symbols_list, src.data_size_bytes, src.data_size_formatted]
        );

        // Copy chunks
        await pool.query(
          `INSERT INTO candle_chunks (dataset_id, chunk_index, items_json, created_at)
           SELECT $1, chunk_index, items_json, NOW() FROM candle_chunks WHERE dataset_id = $2;`,
          [newId, sourceDatasetId]
        );

        return res.json({
          success: true,
          datasetId: newId,
          message: 'Saved dataset to PostgreSQL successfully',
          sizeFormatted: src.data_size_formatted,
          totalCandles: src.total_candles,
          symbolCount: src.symbol_count,
        });
      }
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'هیچ کندلی برای ذخیره‌سازی یافت نشد. لطفاً ابتدا اسکن را اجرا کنید.' });
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
      message: 'Saved to remote PostgreSQL successfully',
      sizeFormatted,
      totalCandles,
      symbolCount: entries.length,
    });
  } catch (error: any) {
    console.error('[Remote PostgreSQL] save dataset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. List Datasets from Remote PostgreSQL
app.get('/api/cloudsql/datasets', async (req, res) => {
  try {
    const { db, withDbRetry } = await import('./src/db/index.ts');
    const { candleDatasets } = await import('./src/db/schema.ts');
    const { desc } = await import('drizzle-orm');

    const list = await withDbRetry(() =>
      db
        .select({
          id: candleDatasets.id,
          name: candleDatasets.name,
          userId: candleDatasets.userId,
          timeframe: candleDatasets.timeframe,
          exchange: candleDatasets.exchange,
          startTime: candleDatasets.startTime,
          endTime: candleDatasets.endTime,
          symbolCount: candleDatasets.symbolCount,
          totalCandles: candleDatasets.totalCandles,
          dataSizeBytes: candleDatasets.dataSizeBytes,
          dataSizeFormatted: candleDatasets.dataSizeFormatted,
          isTemporary: candleDatasets.isTemporary,
          status: candleDatasets.status,
          createdAt: candleDatasets.createdAt,
          updatedAt: candleDatasets.updatedAt,
        })
        .from(candleDatasets)
        .orderBy(desc(candleDatasets.createdAt))
    );
    res.json({ success: true, datasets: list });
  } catch (error: any) {
    console.error('[Remote PostgreSQL] list datasets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Load Dataset from Remote PostgreSQL
app.get('/api/cloudsql/dataset/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { db, withDbRetry } = await import('./src/db/index.ts');
    const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
    const { eq, asc } = await import('drizzle-orm');

    const meta = await withDbRetry(() => db.select().from(candleDatasets).where(eq(candleDatasets.id, id)).limit(1));
    if (meta.length === 0) {
      return res.status(404).json({ success: false, error: 'Dataset not found' });
    }

    const chunks = await withDbRetry(() =>
      db
        .select()
        .from(candleChunks)
        .where(eq(candleChunks.datasetId, id))
        .orderBy(asc(candleChunks.chunkIndex))
    );

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
    console.error('[Remote PostgreSQL] load dataset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Promote Temporary Dataset in Remote PostgreSQL
app.post('/api/cloudsql/promote-dataset', async (req, res) => {
  try {
    const { datasetId, newName } = req.body || {};
    const { db } = await import('./src/db/index.ts');
    const { candleDatasets } = await import('./src/db/schema.ts');
    const { eq } = await import('drizzle-orm');

    await (db.update(candleDatasets) as any)
      .set({ name: newName, isTemporary: false, updatedAt: new Date() })
      .where(eq(candleDatasets.id, datasetId));

    res.json({ success: true, message: 'Dataset promoted to permanent in remote PostgreSQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Delete Dataset in Remote PostgreSQL
app.delete('/api/cloudsql/dataset/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { db } = await import('./src/db/index.ts');
    const { candleDatasets, candleChunks } = await import('./src/db/schema.ts');
    const { eq } = await import('drizzle-orm');

    await db.delete(candleChunks).where(eq(candleChunks.datasetId, id));
    await db.delete(candleDatasets).where(eq(candleDatasets.id, id));

    res.json({ success: true, message: 'Deleted from remote PostgreSQL' });
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
// 6.5 AUTONOMOUS SERVER-SIDE BACKTEST & POSTGRESQL DATASET ENGINE
// =========================================================================

interface ServerBacktestProgress {
  current: number;
  total: number;
  percent: number;
  currentSymbol: string;
}

const serverBacktestState = {
  isScanning: false,
  shouldStop: false,
  datasetId: null as string | null,
  stage: 'idle' as 'idle' | 'downloading' | 'analyzing' | 'completed' | 'error',
  exchange: 'xt',
  timeframe: '5m',
  startTime: null as number | null,
  endTime: null as number | null,
  progress: {
    current: 0,
    total: 0,
    percent: 0,
    currentSymbol: '',
  } as ServerBacktestProgress,
  results: [] as any[],
  allTrades: [] as any[],
  errorMsg: null as string | null,
  lastRunAt: null as string | null,
  lastStartedAt: 0,
  symbolCount: 0,
  totalCandles: 0,
  dataSizeFormatted: '0 B',
};

function getRangeDatasetId(exchange: string, timeframe: string, startTime?: number | null, endTime?: number | null): string {
  const ex = (exchange || 'xt').toLowerCase();
  const tf = timeframe || '5m';
  const s = startTime && Number(startTime) > 0 ? Number(startTime) : 0;
  const e = endTime && Number(endTime) > 0 ? Number(endTime) : 0;
  return `range_${ex}_${tf}_${s}_${e}`;
}

const serverDatasetCandleCache = new Map<string, ServerCandleEntry[]>();

async function loadDatasetEntriesFromPostgres(datasetId: string, symbolsFilter?: string[]): Promise<ServerCandleEntry[]> {
  if (serverDatasetCandleCache.has(datasetId)) {
    const cached = serverDatasetCandleCache.get(datasetId);
    if (cached && cached.length > 0) return cached;
  }

  const chunksRes = await pool.query(
    `SELECT items_json FROM candle_chunks WHERE dataset_id = $1 ORDER BY chunk_index ASC;`,
    [datasetId]
  );
  if (chunksRes.rows.length === 0) return [];

  const symbolsFilterSet = symbolsFilter && symbolsFilter.length > 0
    ? new Set(symbolsFilter.map((s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')))
    : null;

  const seenSymbols = new Map<string, ServerCandleEntry>();
  for (const chunkRow of chunksRes.rows) {
    try {
      const items = JSON.parse(chunkRow.items_json);
      for (const item of items) {
        const cleanSym = (item.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (symbolsFilterSet && !symbolsFilterSet.has(cleanSym)) continue;
        if (seenSymbols.has(cleanSym)) continue;

        const candles: CandleData[] = (item.tuples || []).map((t: any[]) => ({
          time: t[0],
          open: t[1],
          high: t[2],
          low: t[3],
          close: t[4],
          volume: t[5],
        }));
        if (candles.length >= 50) {
          seenSymbols.set(cleanSym, {
            pair: {
              symbol: item.symbol,
              baseAsset: item.baseAsset,
              quoteAsset: item.quoteAsset,
            },
            candles,
            timeframe: item.timeframe || '5m',
          });
        }
      }
    } catch {}
  }

  const entries = Array.from(seenSymbols.values());
  if (entries.length > 0) {
    serverDatasetCandleCache.set(datasetId, entries);
  }
  return entries;
}

async function runServerBacktestCycle(params: {
  exchange: string;
  timeframe: string;
  startTime?: number | null;
  endTime?: number | null;
  symbols: string[];
  workersCount?: number;
  strategyId: string;
  strategyConfig: any;
  forceRedownload?: boolean;
}) {
  const { exchange, timeframe, startTime, endTime, symbols, workersCount, strategyId, strategyConfig, forceRedownload } = params;
  const datasetId = getRangeDatasetId(exchange, timeframe, startTime, endTime);

  serverBacktestState.isScanning = true;
  serverBacktestState.lastStartedAt = Date.now();
  serverBacktestState.shouldStop = false;
  serverBacktestState.datasetId = datasetId;
  serverBacktestState.exchange = exchange;
  serverBacktestState.timeframe = timeframe;
  serverBacktestState.startTime = startTime || null;
  serverBacktestState.endTime = endTime || null;
  serverBacktestState.errorMsg = null;
  serverBacktestState.results = [];
  serverBacktestState.allTrades = [];
  serverBacktestState.progress = { current: 0, total: symbols.length, percent: 0, currentSymbol: 'آماده‌سازی...' };

  const cfg = strategyConfig || {};
  const capital = Number(cfg.capital) || 10000;
  const riskMode = cfg.riskMode || 'percent';
  const riskAmountFixed = Number(cfg.riskAmountFixed) || 10;
  const riskPercent = Number(cfg.riskPercent) || 1.0;
  const effectiveRiskPercent = riskMode === 'fixed' && capital > 0 ? (riskAmountFixed / capital) * 100 : riskPercent;
  const atrPeriod = Number(cfg.optAtrPeriod ?? cfg.atrPeriod) || 24;
  const atrMultiplier = Number(cfg.optAtrMultiplier ?? cfg.atrMultiplier) || 2.4;
  const minCandles = Number(cfg.optMinCandles ?? cfg.minCandles) || 2;
  const minCandlesForLongLeg = Number(cfg.optMinCandlesLong ?? cfg.minCandlesForLongLeg) || 10;
  const longLegAtrMultiplier = Number(cfg.optLongLegAtrMult ?? cfg.longLegAtrMultiplier) || 8.0;
  const maxBlueLegPercent = Number(cfg.optMaxBlueLegPercent ?? cfg.maxBlueLegPercent) || 50;
  const maxBreakoutAtrMultiplier = Number(cfg.optMaxBreakoutAtr ?? cfg.maxBreakoutAtrMultiplier) || 3.0;
  const maxRiskReward = Number(cfg.optMaxRiskReward ?? cfg.maxRiskReward) || 3.0;
  const maxCandlesToEnter = Number(cfg.maxCandlesToEnter) || 35;
  const entryCommission = Number(cfg.entryCommissionPercent) || 0.06;
  const exitCommission = Number(cfg.exitCommissionPercent) || 0.06;
  const timeStopEnabled = cfg.timeStopEnabled !== false && cfg.optTimeStopEnabled !== false;
  const timeStopCandles = Number(cfg.optTimeStopCandles ?? cfg.timeStopCandles) || 80;

  console.log(`[Server Backtest] 🚀 Starting cycle: Strategy=${strategyId}, ATR=${atrPeriod}, Mult=${atrMultiplier}, minCandles=${minCandles}, minLong=${minCandlesForLongLeg}, longMult=${longLegAtrMultiplier}, blue%=${maxBlueLegPercent}, breakoutMult=${maxBreakoutAtrMultiplier}, RR=${maxRiskReward}, timeStop=${timeStopCandles}, capital=${capital}, risk=${riskPercent}%`);

  const processSymbolStrategy = (pair: { symbol: string; baseAsset: string; quoteAsset: string }, candles: CandleData[]) => {
    if (!candles || candles.length < 50) return null;

    const atrResult = calculateATR(candles, atrPeriod);
    const zzResult = calculateAtrZigZag(candles, atrResult.atrValues, atrMultiplier, minCandles);
    const legs = analyzeZigZagLegs(zzResult.points, minCandlesForLongLeg, longLegAtrMultiplier, maxBlueLegPercent, maxBreakoutAtrMultiplier);

    const stratConfig: any = {
      capital,
      selectedStrategyId: strategyId,
      riskMode,
      riskAmountFixed,
      riskPercent,
      entryCommissionPercent: entryCommission,
      exitCommissionPercent: exitCommission,
      commissionPercent: parseFloat((entryCommission + exitCommission).toFixed(4)),
      maxRiskReward,
      maxCandlesToEnter,
      maxTradesPerLeg: 1,
      showOnChart: true,
      noConcurrentPositions: true,
      symbol: pair.symbol,
      timeStopEnabled,
      timeStopCandles,
    };

    let backtestRes: any;
    if (strategyId === 'strategy_2_next_pivot') {
      backtestRes = runStrategy2Backtest(candles, zzResult.points, legs, stratConfig, atrResult.atrValues, atrMultiplier, minCandles);
    } else {
      backtestRes = runStrategy1Backtest(candles, zzResult.points, legs, stratConfig);
    }

    const { trades, metrics } = backtestRes;
    let optimalRiskForDD20 = 0;
    if (metrics.maxDrawdownPercent > 0) {
      optimalRiskForDD20 = parseFloat(((effectiveRiskPercent * 19.0) / metrics.maxDrawdownPercent).toFixed(2));
    } else if (metrics.totalTrades > 0) {
      optimalRiskForDD20 = 5.0;
    }

    const lastTrade = trades.length > 0 ? trades[trades.length - 1] : undefined;

    const resultItem = {
      pair,
      stage: 'RAW / PRE-FILTER',
      candlesCount: candles.length,
      totalTrades: metrics.totalTrades,
      winTrades: metrics.winTrades,
      lossTrades: metrics.lossTrades,
      breakevenTrades: metrics.breakevenTrades || 0,
      activeTrades: metrics.activeTrades,
      winRate: metrics.winRate,
      grossProfit: metrics.grossProfit || 0,
      grossLoss: metrics.grossLoss || 0,
      grossPnl: metrics.grossPnl || 0,
      netProfit: metrics.netProfit,
      netProfitPercent: metrics.netProfitPercent,
      totalProfit: metrics.totalProfit,
      totalLoss: metrics.totalLoss,
      totalFee: metrics.totalFee || 0,
      profitFactor: metrics.profitFactor,
      profitFactorLabel: metrics.profitFactorLabel,
      avgRiskReward: metrics.avgRiskReward,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      optimalRiskForDD20,
      openPositionsCount: metrics.openPositionsCount || 0,
      openPositionsUnrealizedPnl: metrics.openPositionsUnrealizedPnl || 0,
      openPositionsFee: metrics.openPositionsFee || 0,
      lastTradeStatus: lastTrade?.status,
      trades,
    };

    const finishedTrades = (trades || [])
      .filter((t: any) => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BREAKEVEN')
      .map((t: any, tIdx: number) => ({
        ...t,
        id: `${pair.symbol}-${t.id || tIdx}`,
        symbol: pair.symbol,
        stage: 'RAW / PRE-FILTER',
      }));

    return { resultItem, finishedTrades };
  };

  try {
    let entries: ServerCandleEntry[] = [];

    // 1. Check if dataset already exists in PostgreSQL
    if (!forceRedownload) {
      serverBacktestState.stage = 'downloading';
      serverBacktestState.progress.currentSymbol = 'بررسی داده‌های ذخیره‌شده در دیتابیس PostgreSQL...';

      const dsRes = await pool.query(`SELECT * FROM candle_datasets WHERE id = $1 LIMIT 1;`, [datasetId]);
      if (dsRes.rows.length > 0) {
        const chunksRes = await pool.query(
          `SELECT items_json FROM candle_chunks WHERE dataset_id = $1 ORDER BY chunk_index ASC;`,
          [datasetId]
        );
        if (chunksRes.rows.length > 0) {
          const symbolsFilterSet = symbols && symbols.length > 0
            ? new Set(symbols.map((s: string) => s.toUpperCase().replace('_', '')))
            : null;
          const seenSymbols = new Map<string, ServerCandleEntry>();

          for (const chunkRow of chunksRes.rows) {
            try {
              const items = JSON.parse(chunkRow.items_json);
              for (const item of items) {
                const cleanSym = (item.symbol || '').toUpperCase().replace('_', '');
                if (symbolsFilterSet && !symbolsFilterSet.has(cleanSym)) continue;
                if (seenSymbols.has(cleanSym)) continue;

                const candles: CandleData[] = (item.tuples || []).map((t: any[]) => ({
                  time: t[0],
                  open: t[1],
                  high: t[2],
                  low: t[3],
                  close: t[4],
                  volume: t[5],
                }));
                seenSymbols.set(cleanSym, {
                  pair: {
                    symbol: item.symbol,
                    baseAsset: item.baseAsset,
                    quoteAsset: item.quoteAsset,
                  },
                  candles,
                  timeframe: item.timeframe || timeframe,
                });
              }
            } catch {}
          }
          entries = Array.from(seenSymbols.values());
        }
      }
    }

    // 2. If existing entries found in DB, run parallel workers to calculate and stream results live!
    if (entries.length > 0) {
      serverBacktestState.stage = 'analyzing';
      const total = entries.length;
      serverBacktestState.progress = { current: 0, total, percent: 0, currentSymbol: 'محاسبه استراتژی روی داده‌های دیتابیس...' };

      const queue = [...entries];
      const concurrency = Math.min(Math.max(1, Number(workersCount) || 16), entries.length);
      let completed = 0;

      const worker = async () => {
        while (queue.length > 0 && !serverBacktestState.shouldStop) {
          const entry = queue.shift();
          if (!entry) break;

          try {
            const calculated = processSymbolStrategy(entry.pair, entry.candles);
            if (calculated) {
              serverBacktestState.results.push(calculated.resultItem);
              serverBacktestState.allTrades.push(...calculated.finishedTrades);
            }
          } catch (err: any) {
            console.warn(`[Backtest Calc Error] ${entry.pair.symbol}:`, err.message);
          } finally {
            completed++;
            serverBacktestState.progress.current = completed;
            serverBacktestState.progress.percent = Math.round((completed / total) * 100);
            serverBacktestState.progress.currentSymbol = entry.pair.symbol;
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      if (entries.length > 0) {
        serverDatasetCandleCache.set(datasetId, entries);
      }
    } else {
      // 3. Download from exchange with CONCURRENT WORKERS, stream results live, and persist chunks to PostgreSQL
      serverBacktestState.stage = 'downloading';
      let targetSymbols = symbols && symbols.length > 0 ? symbols : [];

      if (targetSymbols.length === 0) {
        if (exchange === 'xt') {
          const xtPairs = await fetchXtServerPairs();
          targetSymbols = xtPairs.slice(0, 1000).map((p) => p.symbol);
        } else {
          const sPairs = await fetchServerPairs('futures', 1000);
          targetSymbols = sPairs.map((p) => p.symbol);
        }
      }

      const total = targetSymbols.length;
      serverBacktestState.progress.total = total;
      serverBacktestState.progress.current = 0;
      serverBacktestState.progress.percent = 0;

      const downloadedEntries: ServerCandleEntry[] = [];
      const isFutures = exchange !== 'spot';

      // Clean prior range data in PostgreSQL before fresh write
      await pool.query(`DELETE FROM candle_chunks WHERE dataset_id = $1;`, [datasetId]);
      await pool.query(`DELETE FROM candle_datasets WHERE id = $1;`, [datasetId]);

      const rangeName = `بازه ${exchange.toUpperCase()} ${timeframe} (${startTime ? new Date(startTime).toLocaleDateString('fa-IR') : 'آغاز'} تا ${endTime ? new Date(endTime).toLocaleDateString('fa-IR') : 'اکنون'})`;
      await pool.query(
        `INSERT INTO candle_datasets (id, name, user_id, timeframe, exchange, start_time, end_time, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET status = $8, updated_at = NOW();`,
        [datasetId, rangeName, 'amir', timeframe, exchange, startTime ? String(startTime) : '0', endTime ? String(endTime) : '0', 'DOWNLOADING']
      );

      let chunkIdx = 0;
      let batchToSave: ServerCandleEntry[] = [];
      const queue = [...targetSymbols];
      const concurrency = Math.min(Math.max(1, Number(workersCount) || 8), 12, targetSymbols.length);
      let completedCount = 0;

      const stepMs = timeframeToMs(timeframe);
      let neededLimit = 5000;
      if (startTime && endTime && endTime > startTime) {
        neededLimit = Math.max(50, Math.ceil((endTime - startTime) / stepMs));
      }

      const worker = async () => {
        while (queue.length > 0 && !serverBacktestState.shouldStop) {
          const sym = queue.shift();
          if (!sym) break;

          try {
            let candles: CandleData[] = [];
            if (exchange === 'xt') {
              candles = await fetchXtServerKlines(sym, timeframe, neededLimit, startTime || undefined, endTime || undefined);
            } else {
              const clean = sym.replace('_', '').toUpperCase();
              candles = await fetchServerKlines(clean, timeframe, neededLimit, isFutures, startTime || undefined, endTime || undefined);
            }

            if (candles && candles.length >= 50) {
              const baseAsset = sym.includes('_') ? sym.split('_')[0].toUpperCase() : sym.replace(/USDT$/i, '');
              const pair = { symbol: sym, baseAsset, quoteAsset: 'USDT' };
              const entry: ServerCandleEntry = { pair, candles, timeframe };

              downloadedEntries.push(entry);
              batchToSave.push(entry);

              // IMMEDIATELY compute strategy for this pair and STREAM live results!
              const calculated = processSymbolStrategy(pair, candles);
              if (calculated) {
                serverBacktestState.results.push(calculated.resultItem);
                serverBacktestState.allTrades.push(...calculated.finishedTrades);
              }

              // Save chunk to PostgreSQL every 5 symbols
              if (batchToSave.length >= 5) {
                const toFlush = [...batchToSave];
                batchToSave = [];
                const items = toFlush.map((e) => ({
                  symbol: e.pair.symbol,
                  baseAsset: e.pair.baseAsset,
                  quoteAsset: e.pair.quoteAsset,
                  timeframe: e.timeframe,
                  tuples: e.candles.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume]),
                }));

                await pool.query(
                  `INSERT INTO candle_chunks (dataset_id, chunk_index, items_json, created_at)
                   VALUES ($1, $2, $3, NOW());`,
                  [datasetId, chunkIdx++, JSON.stringify(items)]
                ).catch((err) => console.warn('[Chunk Save Error]:', err.message));
              }
            }
          } catch (err: any) {
            console.warn(`[Backtest Worker Error] ${sym}:`, err.message);
          } finally {
            completedCount++;
            serverBacktestState.progress.current = completedCount;
            serverBacktestState.progress.percent = Math.round((completedCount / total) * 100);
            serverBacktestState.progress.currentSymbol = sym;
          }

          await sleep(20);
        }
      };

      // Run parallel workers in Node.js backend
      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      // Save remaining batch
      if (batchToSave.length > 0) {
        const items = batchToSave.map((e) => ({
          symbol: e.pair.symbol,
          baseAsset: e.pair.baseAsset,
          quoteAsset: e.pair.quoteAsset,
          timeframe: e.timeframe,
          tuples: e.candles.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume]),
        }));

        await pool.query(
          `INSERT INTO candle_chunks (dataset_id, chunk_index, items_json, created_at)
           VALUES ($1, $2, $3, NOW());`,
          [datasetId, chunkIdx++, JSON.stringify(items)]
        ).catch(() => {});
      }

      entries = downloadedEntries;
      if (entries.length > 0) {
        serverDatasetCandleCache.set(datasetId, entries);
      }
    }

    if (serverBacktestState.shouldStop) {
      serverBacktestState.isScanning = false;
      serverBacktestState.stage = 'idle';
      console.log(`[Server Backtest] Scan stopped gracefully by user.`);
      return;
    }

    if (entries.length === 0 && serverBacktestState.results.length === 0) {
      throw new Error('هیچ داده کندلی در این بازه زمانی از صرافی دریافت نشد.');
    }

    const totalCandles = entries.reduce((acc, e) => acc + e.candles.length, 0);
    const dataSizeBytes = Math.round(totalCandles * 48);
    const dataSizeFormatted = dataSizeBytes > 1048576 ? `${(dataSizeBytes / 1048576).toFixed(1)} MB` : `${(dataSizeBytes / 1024).toFixed(0)} KB`;
    const symbolsListJson = JSON.stringify(entries.map((e) => e.pair.symbol));

    serverBacktestState.symbolCount = entries.length;
    serverBacktestState.totalCandles = totalCandles;
    serverBacktestState.dataSizeFormatted = dataSizeFormatted;
    serverBacktestState.lastRunAt = new Date().toISOString();
    serverBacktestState.progress.current = serverBacktestState.progress.total || entries.length;
    serverBacktestState.progress.percent = 100;
    serverBacktestState.progress.currentSymbol = 'پایان اسکن';
    serverBacktestState.stage = 'completed';
    serverBacktestState.isScanning = false;

    // 4. Persist final results in PostgreSQL safely (non-blocking)
    try {
      const resultsJson = JSON.stringify({ results: serverBacktestState.results, allTrades: serverBacktestState.allTrades });
      await pool.query(
        `UPDATE candle_datasets 
         SET symbol_count = $1, total_candles = $2, symbols_list = $3, data_size_bytes = $4, data_size_formatted = $5,
             status = 'COMPLETED', results_json = $6, strategy_id = $7, strategy_config_json = $8, updated_at = NOW()
         WHERE id = $9;`,
        [entries.length, totalCandles, symbolsListJson, dataSizeBytes, dataSizeFormatted, resultsJson, strategyId, JSON.stringify(cfg), datasetId]
      );
      console.log(`[Server Backtest] ✅ Completed backtest for ${datasetId} on ${serverBacktestState.results.length} pairs in PostgreSQL.`);
    } catch (dbErr: any) {
      console.warn(`[Server Backtest] Warning: Could not update candle_datasets status in PostgreSQL:`, dbErr.message);
    }
  } catch (err: any) {
    console.error(`[Server Backtest] ❌ Backtest error:`, err.message);
    serverBacktestState.isScanning = false;
    serverBacktestState.stage = 'error';
    serverBacktestState.errorMsg = err.message;
  }
}

// 6.5.1 Check if candles or backtest results exist for a specific time range in PostgreSQL
app.get('/api/backtest/range-status', async (req, res) => {
  try {
    const exchange = (req.query.exchange || 'xt').toString();
    const timeframe = (req.query.timeframe || '5m').toString();
    const startTime = req.query.startTime ? Number(req.query.startTime) : null;
    const endTime = req.query.endTime ? Number(req.query.endTime) : null;
    const datasetId = getRangeDatasetId(exchange, timeframe, startTime, endTime);

    const dsRes = await pool.query(`SELECT * FROM candle_datasets WHERE id = $1 LIMIT 1;`, [datasetId]);
    if (dsRes.rows.length === 0) {
      return res.json({
        success: true,
        exists: false,
        datasetId,
      });
    }

    const row = dsRes.rows[0];
    let parsedResults = null;
    let parsedTrades = null;
    if (row.results_json) {
      try {
        const parsed = JSON.parse(row.results_json);
        parsedResults = parsed.results || null;
        parsedTrades = parsed.allTrades || null;
      } catch {}
    }

    return res.json({
      success: true,
      exists: true,
      datasetId,
      dataset: {
        id: row.id,
        name: row.name,
        exchange: row.exchange,
        timeframe: row.timeframe,
        startTime: row.start_time,
        endTime: row.end_time,
        symbolCount: row.symbol_count,
        totalCandles: row.total_candles,
        dataSizeFormatted: row.data_size_formatted,
        status: row.status,
        updatedAt: row.updated_at,
        hasResults: Boolean(parsedResults && parsedResults.length > 0),
      },
      results: parsedResults,
      allTrades: parsedTrades,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.5.2 Start or Resume Autonomous Server-Side Backtest
app.post('/api/backtest/start', async (req, res) => {
  try {
    const { exchange, timeframe, startTime, endTime, symbols, workersCount, strategyId, strategyConfig, forceRedownload } = req.body || {};

    const isStale = serverBacktestState.isScanning && (Date.now() - (serverBacktestState.lastStartedAt || 0) > 180000);
    if (serverBacktestState.isScanning && !forceRedownload && !isStale) {
      return res.json({
        success: true,
        message: 'اسکن بک‌تست در حال حاضر در سرور در حال اجرا است...',
        state: serverBacktestState,
      });
    }

    if (serverBacktestState.isScanning && (forceRedownload || isStale)) {
      console.warn('[Server Backtest] Force restart or stale recovery triggered. Resetting scan state.');
      serverBacktestState.shouldStop = true;
      serverBacktestState.isScanning = false;
    }

    // Launch background task with parallel workers
    runServerBacktestCycle({
      exchange: exchange || 'xt',
      timeframe: timeframe || '5m',
      startTime: startTime ? Number(startTime) : null,
      endTime: endTime ? Number(endTime) : null,
      symbols: Array.isArray(symbols) ? symbols : [],
      workersCount: Number(workersCount) || 16,
      strategyId: strategyId || 'strategy_1_e_breakout',
      strategyConfig: strategyConfig || {},
      forceRedownload: Boolean(forceRedownload),
    }).catch((err) => {
      console.error('[Server Backtest Background Task Error]:', err.message);
    });

    res.json({
      success: true,
      message: 'فرآیند اسکن و دانلود بک‌تست به طور مستقل روی سرور و پایگاه‌داده آغاز شد.',
      datasetId: getRangeDatasetId(exchange || 'xt', timeframe || '5m', startTime, endTime),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.5.2.1 Reset Server Backtest State
app.post('/api/backtest/reset', (_req, res) => {
  serverBacktestState.shouldStop = true;
  serverBacktestState.isScanning = false;
  serverBacktestState.stage = 'idle';
  serverBacktestState.errorMsg = null;
  serverBacktestState.progress = { current: 0, total: 0, percent: 0, currentSymbol: '' };
  res.json({ success: true, message: 'وضعیت اسکن سرور ریست شد و آماده اجرای جدید است.' });
});

// 6.5.3 Get Current Server Backtest Status & Live Progress
app.get('/api/backtest/status', (_req, res) => {
  res.json({
    success: true,
    state: {
      isScanning: serverBacktestState.isScanning,
      stage: serverBacktestState.stage,
      datasetId: serverBacktestState.datasetId,
      exchange: serverBacktestState.exchange,
      timeframe: serverBacktestState.timeframe,
      startTime: serverBacktestState.startTime,
      endTime: serverBacktestState.endTime,
      progress: serverBacktestState.progress,
      resultsCount: serverBacktestState.results.length,
      results: serverBacktestState.results,
      allTrades: serverBacktestState.allTrades,
      errorMsg: serverBacktestState.errorMsg,
      lastRunAt: serverBacktestState.lastRunAt,
      totalCandles: serverBacktestState.totalCandles,
      symbolCount: serverBacktestState.symbolCount,
      dataSizeFormatted: serverBacktestState.dataSizeFormatted,
    },
  });
});

// 6.5.4 Stop In-Flight Server Backtest
app.post('/api/backtest/stop', (_req, res) => {
  serverBacktestState.shouldStop = true;
  serverBacktestState.isScanning = false;
  serverBacktestState.stage = 'idle';
  res.json({ success: true, message: 'دستور توقف اسکن سرور ثبت شد.' });
});

// 6.5.5 Delete ONLY Specific Time Range Dataset from PostgreSQL
app.delete('/api/backtest/range', async (req, res) => {
  try {
    const exchange = (req.query.exchange || req.body?.exchange || 'xt').toString();
    const timeframe = (req.query.timeframe || req.body?.timeframe || '5m').toString();
    const startTime = req.query.startTime ? Number(req.query.startTime) : (req.body?.startTime ? Number(req.body.startTime) : null);
    const endTime = req.query.endTime ? Number(req.query.endTime) : (req.body?.endTime ? Number(req.body.endTime) : null);
    const datasetId = (req.query.datasetId || req.body?.datasetId || getRangeDatasetId(exchange, timeframe, startTime, endTime)).toString();

    await pool.query(`DELETE FROM candle_chunks WHERE dataset_id = $1;`, [datasetId]);
    await pool.query(`DELETE FROM candle_datasets WHERE id = $1;`, [datasetId]);

    if (serverBacktestState.datasetId === datasetId) {
      serverBacktestState.isScanning = false;
      serverBacktestState.stage = 'idle';
      serverBacktestState.results = [];
      serverBacktestState.allTrades = [];
      serverBacktestState.datasetId = null;
    }

    res.json({
      success: true,
      message: `داده‌های بازه زمانی ${datasetId} با موفقیت فقط از این بازه در PostgreSQL حذف شد.`,
      datasetId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6.5.6 AUTONOMOUS SERVER-SIDE OPTIMIZER ENGINE (Connected directly to PostgreSQL)
// =========================================================================

interface ServerOptimizerTrial {
  id: number;
  hash: string;
  timestamp: string;
  qualityScore: number;
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
  timeStopCandles: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  totalFees: number;
  maxDrawdown: number;
  isValid: boolean;
}

const serverOptimizerState = {
  isOptimizing: false,
  shouldStop: false,
  datasetId: null as string | null,
  exchange: 'xt',
  timeframe: '5m',
  strategyId: 'strategy_1_e_breakout',
  totalEvaluatedCount: 0,
  sessionSecondsLeft: 900,
  top10Trials: [] as ServerOptimizerTrial[],
  adaptiveRanges: null as any,
  autoAdaptiveEnabled: true,
  lastStartedAt: 0,
  lastUpdatedAt: null as string | null,
  errorMsg: null as string | null,
  statusText: 'آماده برای بهینه‌سازی در سرور با اتصال مستقیم به PostgreSQL',
};

function generateConfigHash(p: {
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
  timeStopCandles?: number;
}): string {
  return `${p.atrPeriod}_${p.minCandles}_${p.minCandlesForLongLeg}_${p.atrMultiplier}_${p.longLegAtrMultiplier}_${p.maxBlueLegPercent}_${p.maxBreakoutAtrMultiplier}_${p.maxRiskReward}_${p.timeStopCandles || 80}`;
}

function calculateQualityScore(trial: {
  netProfit: number;
  profitFactor: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  targetMaxDrawdown: number;
  targetMinWinRate: number;
  targetMinTrades: number;
}): number {
  if (trial.totalTrades < 5) return -1000;
  let penalty = 0;
  if (trial.maxDrawdown > trial.targetMaxDrawdown) {
    penalty += (trial.maxDrawdown - trial.targetMaxDrawdown) * 15;
  }
  if (trial.winRate < trial.targetMinWinRate) {
    penalty += (trial.targetMinWinRate - trial.winRate) * 10;
  }
  if (trial.totalTrades < trial.targetMinTrades) {
    penalty += (trial.targetMinTrades - trial.totalTrades) * 2;
  }

  const profitScore = Math.max(-500, trial.netProfit) * 0.15;
  const pfScore = Math.min(trial.profitFactor, 10) * 35;
  const winRateScore = trial.winRate * 2.2;
  const ddSafety = Math.max(0, 25 - trial.maxDrawdown) * 4;
  const tradeVolumeBonus = Math.min(trial.totalTrades, 500) * 0.15;

  return parseFloat((profitScore + pfScore + winRateScore + ddSafety + tradeVolumeBonus - penalty).toFixed(2));
}

function refineAdaptiveRangesSmart(
  currentRanges: any,
  eliteTrials: any[],
  totalEvaluated: number,
  autoAdaptiveEnabled: boolean,
  locks?: any
): any {
  if (!autoAdaptiveEnabled || !eliteTrials || eliteTrials.length < 2) return currentRanges;

  const validElites = eliteTrials.filter((t) => t.isValid && t.netProfit > 0);
  const samplePool = validElites.length >= 2 ? validElites : eliteTrials.slice(0, 5);
  if (samplePool.length === 0) return currentRanges;

  const nextRanges: any = { ...currentRanges };
  const keys = [
    'atrPeriod',
    'minCandles',
    'minCandlesForLongLeg',
    'atrMultiplier',
    'longLegAtrMultiplier',
    'maxBlueLegPercent',
    'maxBreakoutAtrMultiplier',
    'maxRiskReward',
    'timeStopCandles',
  ];

  const lockKeyMap: Record<string, { lockProp: string; valProp: string }> = {
    atrPeriod: { lockProp: 'lockAtrPeriod', valProp: 'optAtrPeriod' },
    minCandles: { lockProp: 'lockMinCandles', valProp: 'optMinCandles' },
    minCandlesForLongLeg: { lockProp: 'lockMinCandlesLong', valProp: 'optMinCandlesLong' },
    atrMultiplier: { lockProp: 'lockAtrMultiplier', valProp: 'optAtrMultiplier' },
    longLegAtrMultiplier: { lockProp: 'lockLongLegAtrMult', valProp: 'optLongLegAtrMult' },
    maxBlueLegPercent: { lockProp: 'lockMaxBlueLegPercent', valProp: 'optMaxBlueLegPercent' },
    maxBreakoutAtrMultiplier: { lockProp: 'lockMaxBreakoutAtr', valProp: 'optMaxBreakoutAtr' },
    maxRiskReward: { lockProp: 'lockMaxRiskReward', valProp: 'optMaxRiskReward' },
    timeStopCandles: { lockProp: 'lockTimeStopCandles', valProp: 'optTimeStopCandles' },
  };

  for (const key of keys) {
    if (!nextRanges[key]) continue;
    const r = { ...nextRanges[key] };

    // Pin locked parameters strictly to locked value with 100% convergence
    const mapping = lockKeyMap[key];
    if (locks && mapping && locks[mapping.lockProp]) {
      const lockedVal = Number(locks[mapping.valProp]);
      if (!isNaN(lockedVal)) {
        r.bestVal = lockedVal;
        r.min = lockedVal;
        r.max = lockedVal;
        r.boundMin = lockedVal;
        r.boundMax = lockedVal;
        r.userMin = lockedVal;
        r.userMax = lockedVal;
        r.convergence = 100;
        r.isManualOverride = true;
        nextRanges[key] = r;
        continue;
      }
    }

    // Determine user-defined hard boundaries
    const boundMin = Number(r.userMin ?? r.boundMin ?? r.min);
    const boundMax = Number(r.userMax ?? r.boundMax ?? r.max);
    const hardMin = Math.min(boundMin, boundMax);
    const hardMax = Math.max(boundMin, boundMax);

    if (hardMin >= hardMax) {
      r.min = hardMin;
      r.max = hardMax;
      r.boundMin = hardMin;
      r.boundMax = hardMax;
      r.userMin = hardMin;
      r.userMax = hardMax;
      r.bestVal = hardMin;
      r.convergence = 100;
      nextRanges[key] = r;
      continue;
    }

    const values = samplePool.map((t) => Number(t[key]) || 0);
    let weightedSum = 0;
    let totalWeight = 0;
    for (const t of samplePool) {
      const weight = Math.max(1, t.netProfit > 0 ? t.netProfit : 1);
      weightedSum += (Number(t[key]) || 0) * weight;
      totalWeight += weight;
    }
    const center = totalWeight > 0 ? weightedSum / totalWeight : values.reduce((a, b) => a + b, 0) / values.length;
    const safeCenter = Math.max(hardMin, Math.min(hardMax, center));

    const variance = values.reduce((sum, v) => sum + Math.pow(v - safeCenter, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Simulated annealing cooling factor: contracts gracefully over iterations
    const coolingFactor = Math.max(0.35, 1.0 - (totalEvaluated / 1200));
    const step = Number(r.step) > 0 ? Number(r.step) : 1;
    const spread = Math.max(step * 1.5, (stdDev * 1.5 + step * 2) * coolingFactor);

    // Narrowed range around winning cluster
    let newMin = safeCenter - spread;
    let newMax = safeCenter + spread;

    newMin = Math.round(newMin / step) * step;
    newMax = Math.round(newMax / step) * step;

    // STRICT INVARIANT: newMin and newMax MUST NEVER fall outside [hardMin, hardMax]!
    newMin = Math.max(hardMin, Math.min(hardMax, newMin));
    newMax = Math.min(hardMax, Math.max(hardMin, newMax));

    if (newMax - newMin < step * 2) {
      newMin = Math.max(hardMin, safeCenter - step);
      newMax = Math.min(hardMax, safeCenter + step);
    }

    // Re-verify strictly within bounds
    newMin = Math.max(hardMin, Math.min(hardMax, newMin));
    newMax = Math.min(hardMax, Math.max(hardMin, newMax));

    const bestTrial = samplePool[0];
    const rawBestVal = Number(bestTrial[key]);
    r.bestVal = Math.max(hardMin, Math.min(hardMax, isNaN(rawBestVal) ? safeCenter : rawBestVal));
    r.min = parseFloat(newMin.toFixed(2));
    r.max = parseFloat(newMax.toFixed(2));
    r.boundMin = hardMin;
    r.boundMax = hardMax;
    r.userMin = hardMin;
    r.userMax = hardMax;

    const span = r.max - r.min;
    const totalSpan = hardMax - hardMin;
    r.convergence = totalSpan > 0 ? Math.round(Math.max(0, Math.min(100, (1 - span / totalSpan) * 100))) : 100;

    nextRanges[key] = r;
  }

  return nextRanges;
}

function getDefaultRangesForTimeframe(timeframe: string): any {
  const isScalp = timeframe === '5m';
  const isSwing = timeframe === '1h' || timeframe === '4h' || timeframe === '1d' || timeframe === '1w';

  const makeRange = (min: number, max: number, globalMin: number, globalMax: number, bestVal: number, step: number) => {
    const span = max - min;
    const globalSpan = globalMax - globalMin;
    const convergence = Math.round(Math.max(10, Math.min(95, (1 - span / globalSpan) * 100)));
    return { min, max, globalMin, globalMax, boundMin: min, boundMax: max, userMin: min, userMax: max, bestVal, step, convergence, isManualOverride: false };
  };

  if (isScalp) {
    return {
      atrPeriod: makeRange(20, 65, 12, 100, 45, 5),
      minCandles: makeRange(2, 5, 1, 8, 3, 1),
      minCandlesForLongLeg: makeRange(8, 22, 5, 36, 14, 2),
      atrMultiplier: makeRange(2.0, 4.25, 1.5, 6.0, 3.0, 0.25),
      longLegAtrMultiplier: makeRange(6.0, 14.5, 4.0, 22.0, 9.5, 0.5),
      maxBlueLegPercent: makeRange(35, 75, 20, 90, 55, 5),
      maxBreakoutAtrMultiplier: makeRange(2.0, 5.5, 1.0, 8.0, 3.5, 0.5),
      maxRiskReward: makeRange(1.5, 4.5, 1.0, 10.0, 2.5, 0.25),
      timeStopCandles: makeRange(20, 120, 5, 200, 80, 5),
    };
  }

  if (isSwing) {
    return {
      atrPeriod: makeRange(14, 45, 8, 80, 24, 2),
      minCandles: makeRange(1, 4, 1, 6, 2, 1),
      minCandlesForLongLeg: makeRange(5, 16, 4, 24, 10, 1),
      atrMultiplier: makeRange(1.5, 3.5, 1.0, 5.0, 2.4, 0.2),
      longLegAtrMultiplier: makeRange(4.5, 12.0, 3.0, 18.0, 8.0, 0.5),
      maxBlueLegPercent: makeRange(30, 70, 20, 85, 50, 5),
      maxBreakoutAtrMultiplier: makeRange(1.5, 5.0, 1.0, 7.0, 3.0, 0.5),
      maxRiskReward: makeRange(1.5, 7.0, 1.0, 12.0, 3.5, 0.5),
      timeStopCandles: makeRange(20, 120, 5, 200, 60, 5),
    };
  }

  return {
    atrPeriod: makeRange(18, 55, 10, 90, 32, 4),
    minCandles: makeRange(1, 5, 1, 8, 3, 1),
    minCandlesForLongLeg: makeRange(6, 20, 5, 30, 14, 2),
    atrMultiplier: makeRange(1.8, 4.0, 1.2, 5.5, 2.8, 0.25),
    longLegAtrMultiplier: makeRange(5.0, 14.0, 3.5, 20.0, 9.0, 0.5),
    maxBlueLegPercent: makeRange(35, 75, 25, 85, 55, 5),
    maxBreakoutAtrMultiplier: makeRange(1.8, 5.5, 1.0, 7.5, 3.5, 0.5),
    maxRiskReward: makeRange(1.5, 6.0, 1.0, 10.0, 3.0, 0.5),
    timeStopCandles: makeRange(20, 120, 5, 200, 80, 5),
  };
}

function getNextCandidateFromAdaptiveRanges(
  ranges: any,
  visited: Set<string>,
  totalEvaluated: number,
  locks: any
) {
  const l = locks || {};
  const sampleParam = (r: any, isLocked: boolean, lockedVal: any) => {
    const numLocked = Number(lockedVal);
    if (isLocked) return !isNaN(numLocked) ? parseFloat(numLocked.toFixed(2)) : 0;
    if (!r) return !isNaN(numLocked) ? parseFloat(numLocked.toFixed(2)) : 0;

    const boundMin = Number(r.userMin ?? r.boundMin ?? r.min);
    const boundMax = Number(r.userMax ?? r.boundMax ?? r.max);
    const hardMin = Math.min(boundMin, boundMax);
    const hardMax = Math.max(boundMin, boundMax);

    if (hardMin >= hardMax) {
      return parseFloat(hardMin.toFixed(2));
    }

    const curMin = Math.max(hardMin, Math.min(hardMax, Number(r.min) || hardMin));
    const curMax = Math.min(hardMax, Math.max(hardMin, Number(r.max) || hardMax));
    const step = Number(r.step) > 0 ? Number(r.step) : 1;

    let candidateVal: number;
    const rand = Math.random();

    // 70% sample around bestVal (contracted exploitation)
    if (rand < 0.70 && r.bestVal !== undefined) {
      const best = Math.max(curMin, Math.min(curMax, Number(r.bestVal)));
      const offset = (Math.floor(Math.random() * 3) - 1) * step;
      candidateVal = Math.max(curMin, Math.min(curMax, best + offset));
    }
    // 20% explore within active contracted range [curMin, curMax]
    else if (rand < 0.90) {
      const count = Math.max(1, Math.round((curMax - curMin) / step));
      const idx = Math.floor(Math.random() * (count + 1));
      candidateVal = curMin + idx * step;
    }
    // 10% explore across user's full defined range [hardMin, hardMax]
    // NEVER go outside [hardMin, hardMax]!
    else {
      const fullCount = Math.max(1, Math.round((hardMax - hardMin) / step));
      const gIdx = Math.floor(Math.random() * (fullCount + 1));
      candidateVal = hardMin + gIdx * step;
    }

    // Absolute hard clamp: can NEVER be outside [hardMin, hardMax]
    const clamped = Math.min(hardMax, Math.max(hardMin, candidateVal));
    const rounded = Math.round(clamped / step) * step;
    const finalVal = Math.min(hardMax, Math.max(hardMin, rounded));
    return parseFloat(finalVal.toFixed(2));
  };

  for (let attempts = 0; attempts < 350; attempts++) {
    const candidate = {
      atrPeriod: sampleParam(ranges.atrPeriod, l.lockAtrPeriod, l.optAtrPeriod ?? 45),
      minCandles: sampleParam(ranges.minCandles, l.lockMinCandles, l.optMinCandles ?? 3),
      minCandlesForLongLeg: sampleParam(ranges.minCandlesForLongLeg, l.lockMinCandlesLong, l.optMinCandlesLong ?? 14),
      atrMultiplier: sampleParam(ranges.atrMultiplier, l.lockAtrMultiplier, l.optAtrMultiplier ?? 3.0),
      longLegAtrMultiplier: sampleParam(ranges.longLegAtrMultiplier, l.lockLongLegAtrMult, l.optLongLegAtrMult ?? 9.5),
      maxBlueLegPercent: sampleParam(ranges.maxBlueLegPercent, l.lockMaxBlueLegPercent, l.optMaxBlueLegPercent ?? 55),
      maxBreakoutAtrMultiplier: sampleParam(ranges.maxBreakoutAtrMultiplier, l.lockMaxBreakoutAtr, l.optMaxBreakoutAtr ?? 3.5),
      maxRiskReward: sampleParam(ranges.maxRiskReward, l.lockMaxRiskReward, l.optMaxRiskReward ?? 2.5),
      timeStopCandles: sampleParam(ranges.timeStopCandles, l.lockTimeStopCandles, l.optTimeStopCandles ?? 80),
    };

    const hash = generateConfigHash(candidate);
    if (!visited.has(hash)) {
      return candidate;
    }
  }

  return null;
}

async function evaluateCombinationOnServer(
  params: {
    atrPeriod: number;
    minCandles: number;
    minCandlesForLongLeg: number;
    atrMultiplier: number;
    longLegAtrMultiplier: number;
    maxBlueLegPercent: number;
    maxBreakoutAtrMultiplier: number;
    maxRiskReward: number;
    timeStopCandles?: number;
  },
  entries: ServerCandleEntry[],
  strategyId: string,
  baseConfig: {
    capital: number;
    riskMode: 'percent' | 'fixed';
    riskAmountFixed: number;
    riskPercent: number;
    entryCommissionPercent: number;
    exitCommissionPercent: number;
    commissionPercent: number;
    maxCandlesToEnter: number;
    noConcurrentPositions: boolean;
    timeStopEnabled: boolean;
  },
  constraints: {
    targetMaxDrawdown: number;
    targetMinWinRate: number;
    targetMinTrades: number;
  }
) {
  const allTrades: any[] = [];

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    const candles = item.candles;
    if (!candles || candles.length < 50) continue;

    // Cooperative yielding every 4 symbols so Node.js can answer HTTP status and API requests without latency
    if (i > 0 && i % 4 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const atrResult = calculateATR(candles, params.atrPeriod);
    const zzResult = calculateAtrZigZag(candles, atrResult.atrValues, params.atrMultiplier, params.minCandles);
    const legs = analyzeZigZagLegs(
      zzResult.points,
      params.minCandlesForLongLeg,
      params.longLegAtrMultiplier,
      params.maxBlueLegPercent,
      params.maxBreakoutAtrMultiplier
    );

    const stratConfig: any = {
      capital: baseConfig.capital,
      selectedStrategyId: strategyId,
      riskMode: baseConfig.riskMode,
      riskAmountFixed: baseConfig.riskAmountFixed,
      riskPercent: baseConfig.riskPercent,
      entryCommissionPercent: baseConfig.entryCommissionPercent,
      exitCommissionPercent: baseConfig.exitCommissionPercent,
      commissionPercent: baseConfig.commissionPercent,
      maxRiskReward: params.maxRiskReward,
      maxCandlesToEnter: baseConfig.maxCandlesToEnter,
      maxTradesPerLeg: 1,
      showOnChart: false,
      noConcurrentPositions: baseConfig.noConcurrentPositions,
      symbol: item.pair.symbol,
      timeStopEnabled: baseConfig.timeStopEnabled,
      timeStopCandles: params.timeStopCandles || 80,
    };

    let backtestRes: any;
    if (strategyId === 'strategy_2_next_pivot') {
      backtestRes = runStrategy2Backtest(candles, zzResult.points, legs, stratConfig, atrResult.atrValues, params.atrMultiplier, params.minCandles);
    } else {
      backtestRes = runStrategy1Backtest(candles, zzResult.points, legs, stratConfig);
    }

    const closed = (backtestRes.trades || [])
      .filter((t: any) => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BREAKEVEN')
      .map((t: any, tIdx: number) => ({
        ...t,
        id: `${item.pair.symbol}-${t.id || tIdx}`,
        symbol: item.pair.symbol,
      }));
    allTrades.push(...closed);
  }

  // Deterministic sorting strictly identical to manual scan
  const sorted = [...allTrades].sort((a, b) => {
    const eA = a.entryTime || a.timeF || 0;
    const eB = b.entryTime || b.timeF || 0;
    if (eA !== eB) return eA - eB;
    const sA = (a as any).score || (a as any).confidence || 0;
    const sB = (b as any).score || (b as any).confidence || 0;
    if (sB !== sA) return sB - sA;
    return ((a as any).symbol || '').localeCompare((b as any).symbol || '');
  });

  let effectiveTrades: any[] = [];
  if (!baseConfig.noConcurrentPositions) {
    effectiveTrades = sorted;
  } else {
    let lastExitTime = 0;
    for (const t of sorted) {
      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;
      if (eTime >= lastExitTime) {
        effectiveTrades.push(t);
        lastExitTime = Math.max(lastExitTime, xTime);
      }
    }
  }

  const totalTrades = effectiveTrades.length;
  const winTrades = effectiveTrades.filter((t) => t.status === 'WIN').length;
  const lossTrades = effectiveTrades.filter((t) => t.status === 'LOSS').length;
  const grossProfitSum = effectiveTrades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const grossLossSum = effectiveTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0);
  const netProfitSum = effectiveTrades.reduce((acc, t) => acc + t.pnl, 0);
  const totalFeesSum = effectiveTrades.reduce((acc, t) => acc + (t.fee || t.commission || 0), 0);

  const winRate = totalTrades > 0 ? parseFloat(((winTrades / totalTrades) * 100).toFixed(1)) : 0;
  const profitFactor =
    grossLossSum > 0
      ? parseFloat((grossProfitSum / grossLossSum).toFixed(2))
      : grossProfitSum > 0
      ? 99.9
      : 0;
  const netProfit = parseFloat(netProfitSum.toFixed(2));
  const totalFees = parseFloat(totalFeesSum.toFixed(2));

  // Peak-to-Trough Drawdown on timeline
  const sortedByExit = [...effectiveTrades].sort(
    (a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0)
  );
  let curEq = baseConfig.capital;
  let peakEq = baseConfig.capital;
  let maxDd = 0;
  for (const t of sortedByExit) {
    curEq += t.pnl;
    if (curEq > peakEq) peakEq = curEq;
    const dd = peakEq > 0 ? ((peakEq - curEq) / peakEq) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  const maxDrawdown = parseFloat(maxDd.toFixed(2));

  const isValid =
    maxDrawdown <= constraints.targetMaxDrawdown &&
    winRate >= constraints.targetMinWinRate &&
    totalTrades >= constraints.targetMinTrades;

  return {
    totalTrades,
    winTrades,
    lossTrades,
    winRate,
    profitFactor,
    netProfit,
    totalFees,
    maxDrawdown,
    isValid,
  };
}

async function runServerOptimizerLoop(
  datasetId: string,
  entries: ServerCandleEntry[],
  strategyId: string,
  baseConfig: any,
  constraints: any,
  initialRanges: any,
  locks: any,
  autoAdaptiveEnabled: boolean
) {
  serverOptimizerState.isOptimizing = true;
  serverOptimizerState.shouldStop = false;
  serverOptimizerState.datasetId = datasetId;
  serverOptimizerState.strategyId = strategyId;
  serverOptimizerState.statusText = `در حال بهینه‌سازی مداوم روی ${entries.length} نماد در سرور...`;

  const visitedHashes = new Set<string>();
  for (const t of serverOptimizerState.top10Trials) {
    visitedHashes.add(t.hash);
  }

  let localRanges = { ...(serverOptimizerState.adaptiveRanges || initialRanges) };
  let localTop10 = [...serverOptimizerState.top10Trials];

  const startTime = Date.now();
  const maxSessionDurationMs = 900 * 1000; // 15 minutes

  while (!serverOptimizerState.shouldStop && (Date.now() - startTime) < maxSessionDurationMs) {
    serverOptimizerState.sessionSecondsLeft = Math.max(0, Math.round((maxSessionDurationMs - (Date.now() - startTime)) / 1000));

    const candidate = getNextCandidateFromAdaptiveRanges(localRanges, visitedHashes, serverOptimizerState.totalEvaluatedCount, locks);
    if (!candidate) {
      serverOptimizerState.statusText = 'تمامی ترکیب‌های موجود در رنج بهینه فعلی آزمایش شدند.';
      break;
    }

    const hash = generateConfigHash(candidate);
    visitedHashes.add(hash);

    const evalRes = await evaluateCombinationOnServer(candidate, entries, strategyId, baseConfig, constraints);
    serverOptimizerState.totalEvaluatedCount++;

    if (evalRes) {
      const qualityScore = calculateQualityScore({
        netProfit: evalRes.netProfit,
        profitFactor: evalRes.profitFactor,
        winRate: evalRes.winRate,
        maxDrawdown: evalRes.maxDrawdown,
        totalTrades: evalRes.totalTrades,
        targetMaxDrawdown: constraints.targetMaxDrawdown,
        targetMinWinRate: constraints.targetMinWinRate,
        targetMinTrades: constraints.targetMinTrades,
      });

      const trial: ServerOptimizerTrial = {
        id: serverOptimizerState.totalEvaluatedCount,
        hash,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        qualityScore,
        ...candidate,
        ...evalRes,
      };

      // Deduplicate by hash and update top 10
      const filtered = localTop10.filter((t) => t.hash !== trial.hash);
      const merged = [...filtered, trial];
      merged.sort((a, b) => {
        if (a.isValid && !b.isValid) return -1;
        if (!a.isValid && b.isValid) return 1;
        const scoreDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
        if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
        return b.netProfit - a.netProfit;
      });
      localTop10 = merged.slice(0, 10);
      serverOptimizerState.top10Trials = localTop10;

      // Refine adaptive ranges
      if (autoAdaptiveEnabled) {
        localRanges = refineAdaptiveRangesSmart(localRanges, localTop10, serverOptimizerState.totalEvaluatedCount, true, locks);
        serverOptimizerState.adaptiveRanges = localRanges;
      }
    }

    serverOptimizerState.lastUpdatedAt = new Date().toISOString();
    await sleep(35);
  }

  serverOptimizerState.isOptimizing = false;
  serverOptimizerState.sessionSecondsLeft = 0;
  console.log(`[Server Optimizer] Cycle ended. Total evaluations: ${serverOptimizerState.totalEvaluatedCount}`);
}

// 6.5.6.1 Start Server-Side Autonomous Optimization directly connected to PostgreSQL
app.post('/api/optimizer/start', async (req, res) => {
  try {
    const {
      exchange = 'xt',
      timeframe = '5m',
      startTime,
      endTime,
      symbols,
      strategyId = 'strategy_1_e_breakout',
      strategyConfig = {},
      constraints = {},
      ranges,
      locks,
      autoAdaptiveEnabled = true,
    } = req.body || {};

    const explicitDatasetId = req.body?.datasetId;
    let datasetId = explicitDatasetId || getRangeDatasetId(exchange, timeframe, startTime, endTime);

    // 1. Try to get entries from server in-memory cache
    let entries = serverDatasetCandleCache.get(datasetId);

    // If not found by direct ID, check if serverBacktestState has the dataset in memory
    if (!entries || entries.length === 0) {
      if (serverBacktestState.datasetId && serverDatasetCandleCache.has(serverBacktestState.datasetId)) {
        datasetId = serverBacktestState.datasetId;
        entries = serverDatasetCandleCache.get(datasetId);
      }
    }

    // 2. If not in memory, query PostgreSQL candle_chunks for this datasetId
    if (!entries || entries.length === 0) {
      entries = await loadDatasetEntriesFromPostgres(datasetId, symbols);
    }

    // 3. Fallback: if not found for this specific range, check for any completed dataset in PostgreSQL
    if (!entries || entries.length === 0) {
      const latestDs = await pool.query(
        `SELECT id FROM candle_datasets WHERE status = 'COMPLETED' OR symbol_count > 0 ORDER BY updated_at DESC LIMIT 1;`
      );
      if (latestDs.rows.length > 0) {
        const fallbackId = latestDs.rows[0].id;
        entries = await loadDatasetEntriesFromPostgres(fallbackId, symbols);
        if (entries && entries.length > 0) {
          datasetId = fallbackId;
        }
      }
    }

    if (!entries || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: '⚠️ داده کندلی در پایگاه داده PostgreSQL یافت نشد. لطفاً ابتدا در تب «اسکن دستی بازار» دکمه شروع اسکن را بزنید تا داده‌های کندل در دیتابیس ذخیره شوند.',
      });
    }

    const cfg = strategyConfig || {};
    const capital = Number(cfg.capital) || 10000;
    const riskMode = cfg.riskMode || 'percent';
    const riskAmountFixed = Number(cfg.riskAmountFixed) > 0 ? Number(cfg.riskAmountFixed) : 10;
    const riskPercent = Number(cfg.riskPercent) || 1.0;
    const entryCommission = Number(cfg.entryCommissionPercent) || 0.06;
    const exitCommission = Number(cfg.exitCommissionPercent) || 0.06;
    const commissionPercent = parseFloat((entryCommission + exitCommission).toFixed(4));
    const maxCandlesToEnter = Number(cfg.maxCandlesToEnter) || 35;
    const noConcurrentPositions = Boolean(cfg.noConcurrentPositions !== false);
    const timeStopEnabled = cfg.timeStopEnabled !== false;

    const baseConfig = {
      capital,
      riskMode,
      riskAmountFixed,
      riskPercent,
      entryCommissionPercent: entryCommission,
      exitCommissionPercent: exitCommission,
      commissionPercent,
      maxCandlesToEnter,
      noConcurrentPositions,
      timeStopEnabled,
    };

    const targetConstraints = {
      targetMaxDrawdown: Number(constraints.targetMaxDrawdown) || 20.0,
      targetMinWinRate: Number(constraints.targetMinWinRate) || 40.0,
      targetMinTrades: Number(constraints.targetMinTrades) || 100,
    };

    const effectiveLocks = {
      lockAtrPeriod: Boolean(locks?.lockAtrPeriod),
      lockMinCandles: Boolean(locks?.lockMinCandles),
      lockMinCandlesLong: Boolean(locks?.lockMinCandlesLong),
      lockAtrMultiplier: Boolean(locks?.lockAtrMultiplier),
      lockLongLegAtrMult: Boolean(locks?.lockLongLegAtrMult),
      lockMaxBlueLegPercent: Boolean(locks?.lockMaxBlueLegPercent),
      lockMaxBreakoutAtr: Boolean(locks?.lockMaxBreakoutAtr),
      lockMaxRiskReward: Boolean(locks?.lockMaxRiskReward),
      lockTimeStopCandles: Boolean(locks?.lockTimeStopCandles),
      optAtrPeriod: Number(locks?.optAtrPeriod ?? cfg?.atrPeriod ?? cfg?.optAtrPeriod ?? 45),
      optMinCandles: Number(locks?.optMinCandles ?? cfg?.minCandles ?? cfg?.optMinCandles ?? 3),
      optMinCandlesLong: Number(locks?.optMinCandlesLong ?? cfg?.minCandlesForLongLeg ?? cfg?.optMinCandlesLong ?? 14),
      optAtrMultiplier: Number(locks?.optAtrMultiplier ?? cfg?.atrMultiplier ?? cfg?.optAtrMultiplier ?? 3.0),
      optLongLegAtrMult: Number(locks?.optLongLegAtrMult ?? cfg?.longLegAtrMultiplier ?? cfg?.optLongLegAtrMult ?? 9.5),
      optMaxBlueLegPercent: Number(locks?.optMaxBlueLegPercent ?? cfg?.maxBlueLegPercent ?? cfg?.optMaxBlueLegPercent ?? 55),
      optMaxBreakoutAtr: Number(locks?.optMaxBreakoutAtr ?? cfg?.maxBreakoutAtrMultiplier ?? cfg?.optMaxBreakoutAtr ?? 3.5),
      optMaxRiskReward: Number(locks?.optMaxRiskReward ?? cfg?.maxRiskReward ?? cfg?.optMaxRiskReward ?? 2.5),
      optTimeStopCandles: Number(locks?.optTimeStopCandles ?? cfg?.timeStopCandles ?? cfg?.optTimeStopCandles ?? 80),
    };

    const initialRanges = ranges || serverOptimizerState.adaptiveRanges || getDefaultRangesForTimeframe(timeframe);

    // Initialize and enforce immutable user boundaries on all parameters
    const paramKeys = [
      'atrPeriod',
      'minCandles',
      'minCandlesForLongLeg',
      'atrMultiplier',
      'longLegAtrMultiplier',
      'maxBlueLegPercent',
      'maxBreakoutAtrMultiplier',
      'maxRiskReward',
      'timeStopCandles',
    ];
    for (const key of paramKeys) {
      if (initialRanges[key]) {
        const r = initialRanges[key];
        const lowerBound = Number(r.userMin ?? r.boundMin ?? r.min);
        const upperBound = Number(r.userMax ?? r.boundMax ?? r.max);
        const hardMin = Math.min(lowerBound, upperBound);
        const hardMax = Math.max(lowerBound, upperBound);
        r.boundMin = hardMin;
        r.userMin = hardMin;
        r.boundMax = hardMax;
        r.userMax = hardMax;
        r.min = Math.max(hardMin, Math.min(hardMax, Number(r.min) || hardMin));
        r.max = Math.min(hardMax, Math.max(hardMin, Number(r.max) || hardMax));
        if (r.bestVal !== undefined) {
          r.bestVal = Math.max(hardMin, Math.min(hardMax, Number(r.bestVal)));
        }
      }
    }
    
    // Pin locked parameters strictly inside initialRanges
    const lockKeyMap: Record<string, { lockProp: keyof typeof effectiveLocks; valProp: keyof typeof effectiveLocks }> = {
      atrPeriod: { lockProp: 'lockAtrPeriod', valProp: 'optAtrPeriod' },
      minCandles: { lockProp: 'lockMinCandles', valProp: 'optMinCandles' },
      minCandlesForLongLeg: { lockProp: 'lockMinCandlesLong', valProp: 'optMinCandlesLong' },
      atrMultiplier: { lockProp: 'lockAtrMultiplier', valProp: 'optAtrMultiplier' },
      longLegAtrMultiplier: { lockProp: 'lockLongLegAtrMult', valProp: 'optLongLegAtrMult' },
      maxBlueLegPercent: { lockProp: 'lockMaxBlueLegPercent', valProp: 'optMaxBlueLegPercent' },
      maxBreakoutAtrMultiplier: { lockProp: 'lockMaxBreakoutAtr', valProp: 'optMaxBreakoutAtr' },
      maxRiskReward: { lockProp: 'lockMaxRiskReward', valProp: 'optMaxRiskReward' },
      timeStopCandles: { lockProp: 'lockTimeStopCandles', valProp: 'optTimeStopCandles' },
    };

    for (const [k, m] of Object.entries(lockKeyMap)) {
      if (effectiveLocks[m.lockProp] && initialRanges[k]) {
        const val = Number(effectiveLocks[m.valProp]);
        if (!isNaN(val)) {
          initialRanges[k].bestVal = val;
          initialRanges[k].min = val;
          initialRanges[k].max = val;
          initialRanges[k].boundMin = val;
          initialRanges[k].boundMax = val;
          initialRanges[k].userMin = val;
          initialRanges[k].userMax = val;
          initialRanges[k].convergence = 100;
          initialRanges[k].isManualOverride = true;
        }
      }
    }

    serverOptimizerState.adaptiveRanges = initialRanges;
    serverOptimizerState.autoAdaptiveEnabled = autoAdaptiveEnabled !== false;
    serverOptimizerState.exchange = exchange;
    serverOptimizerState.timeframe = timeframe;
    serverOptimizerState.strategyId = strategyId;
    serverOptimizerState.lastStartedAt = Date.now();

    // Start background optimizer loop in server
    runServerOptimizerLoop(
      datasetId,
      entries,
      strategyId,
      baseConfig,
      targetConstraints,
      initialRanges,
      effectiveLocks,
      autoAdaptiveEnabled !== false
    ).catch((err) => {
      console.error('[Server Optimizer Background Error]:', err.message);
      serverOptimizerState.isOptimizing = false;
      serverOptimizerState.errorMsg = err.message;
    });

    res.json({
      success: true,
      message: `بهینه‌سازی مستقل در سرور با ${entries.length} نماد از پایگاه‌داده آغاز شد.`,
      datasetId,
      symbolCount: entries.length,
      state: serverOptimizerState,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.5.6.2 Get Current Server Optimizer Live State & Top 10 Trials
app.get('/api/optimizer/status', (_req, res) => {
  res.json({
    success: true,
    state: serverOptimizerState,
  });
});

// 6.5.6.3 Stop Server Optimizer
app.post('/api/optimizer/stop', (_req, res) => {
  serverOptimizerState.shouldStop = true;
  serverOptimizerState.isOptimizing = false;
  serverOptimizerState.statusText = 'بهینه‌سازی در سرور متوقف شد.';
  res.json({ success: true, message: 'دستور توقف بهینه‌سازی سرور ثبت شد.' });
});

// 6.5.6.4 Reset Server Optimizer Trials & Ranges
app.post('/api/optimizer/reset', (req, res) => {
  serverOptimizerState.shouldStop = true;
  serverOptimizerState.isOptimizing = false;
  serverOptimizerState.top10Trials = [];
  serverOptimizerState.totalEvaluatedCount = 0;
  serverOptimizerState.sessionSecondsLeft = 900;
  const tf = (req.body?.timeframe || serverOptimizerState.timeframe || '5m').toString();
  serverOptimizerState.adaptiveRanges = getDefaultRangesForTimeframe(tf);
  serverOptimizerState.statusText = 'آزمایش‌ها و رنج‌های بهینه‌ساز در سرور بازنشانی شدند.';
  res.json({ success: true, message: 'بهینه‌ساز سرور با موفقیت ریست شد.' });
});

// 6.5.6.5 Directly Evaluate Current Manual Config on Server Dataset
app.post('/api/optimizer/evaluate-candidate', async (req, res) => {
  try {
    const {
      exchange = 'xt',
      timeframe = '5m',
      startTime,
      endTime,
      symbols,
      strategyId = 'strategy_1_e_breakout',
      candidate,
      strategyConfig = {},
      constraints = {},
    } = req.body || {};

    const explicitDatasetId = req.body?.datasetId;
    let datasetId = explicitDatasetId || getRangeDatasetId(exchange, timeframe, startTime, endTime);
    let entries = serverDatasetCandleCache.get(datasetId);
    if (!entries || entries.length === 0) {
      if (serverBacktestState.datasetId && serverDatasetCandleCache.has(serverBacktestState.datasetId)) {
        datasetId = serverBacktestState.datasetId;
        entries = serverDatasetCandleCache.get(datasetId);
      }
    }
    if (!entries || entries.length === 0) {
      entries = await loadDatasetEntriesFromPostgres(datasetId, symbols);
    }
    if (!entries || entries.length === 0) {
      const latestDs = await pool.query(
        `SELECT id FROM candle_datasets WHERE status = 'COMPLETED' OR symbol_count > 0 ORDER BY updated_at DESC LIMIT 1;`
      );
      if (latestDs.rows.length > 0) {
        entries = await loadDatasetEntriesFromPostgres(latestDs.rows[0].id, symbols);
      }
    }

    if (!entries || entries.length === 0) {
      return res.status(400).json({ success: false, error: 'داده کندلی در دیتابیس یافت نشد.' });
    }

    const cfg = strategyConfig || {};
    const baseConfig = {
      capital: Number(cfg.capital) || 10000,
      riskMode: cfg.riskMode || 'percent',
      riskAmountFixed: Number(cfg.riskAmountFixed) > 0 ? Number(cfg.riskAmountFixed) : 10,
      riskPercent: Number(cfg.riskPercent) || 1.0,
      entryCommissionPercent: Number(cfg.entryCommissionPercent) || 0.06,
      exitCommissionPercent: Number(cfg.exitCommissionPercent) || 0.06,
      commissionPercent: Number(cfg.commissionPercent) || 0.12,
      maxCandlesToEnter: Number(cfg.maxCandlesToEnter) || 35,
      noConcurrentPositions: Boolean(cfg.noConcurrentPositions !== false),
      timeStopEnabled: cfg.timeStopEnabled !== false,
    };

    const targetConstraints = {
      targetMaxDrawdown: Number(constraints.targetMaxDrawdown) || 20.0,
      targetMinWinRate: Number(constraints.targetMinWinRate) || 40.0,
      targetMinTrades: Number(constraints.targetMinTrades) || 100,
    };

    const evalRes = await evaluateCombinationOnServer(candidate, entries, strategyId, baseConfig, targetConstraints);
    if (!evalRes) {
      return res.status(500).json({ success: false, error: 'ارزیابی انجام نشد.' });
    }

    const qualityScore = calculateQualityScore({
      netProfit: evalRes.netProfit,
      profitFactor: evalRes.profitFactor,
      winRate: evalRes.winRate,
      maxDrawdown: evalRes.maxDrawdown,
      totalTrades: evalRes.totalTrades,
      targetMaxDrawdown: targetConstraints.targetMaxDrawdown,
      targetMinWinRate: targetConstraints.targetMinWinRate,
      targetMinTrades: targetConstraints.targetMinTrades,
    });

    const hash = generateConfigHash(candidate);
    const trial: ServerOptimizerTrial = {
      id: serverOptimizerState.totalEvaluatedCount + 1,
      hash,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      qualityScore,
      ...candidate,
      ...evalRes,
    };

    // Add to top 10 on server
    const filtered = serverOptimizerState.top10Trials.filter((t) => t.hash !== trial.hash);
    const merged = [...filtered, trial];
    merged.sort((a, b) => {
      if (a.isValid && !b.isValid) return -1;
      if (!a.isValid && b.isValid) return 1;
      const scoreDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      return b.netProfit - a.netProfit;
    });
    serverOptimizerState.top10Trials = merged.slice(0, 10);
    serverOptimizerState.totalEvaluatedCount++;

    res.json({ success: true, trial });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6.6 POSTGRESQL TEST CONFIGURATIONS (test_configs table)
// =========================================================================
app.get('/api/test-configs', async (req, res) => {
  try {
    const userId = (req.query.userId || 'amir').toString();
    const result = await pool.query(
      `SELECT * FROM test_configs WHERE user_id = $1 OR user_id = 'amir' ORDER BY updated_at DESC;`,
      [userId]
    );
    const configs = result.rows.map((row) => {
      let extra = {};
      try {
        extra = JSON.parse(row.config_data_json);
      } catch {}
      return {
        id: row.id,
        name: row.name,
        userId: row.user_id,
        timeframe: row.timeframe,
        capital: row.capital,
        riskPercent: parseFloat(row.risk_percent || '2'),
        selectedStrategyId: row.selected_strategy_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...extra,
      };
    });
    res.json({ success: true, configs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/test-configs', async (req, res) => {
  try {
    const cfg = req.body || {};
    const id = cfg.id || `config_${Date.now()}`;
    const name = cfg.name || 'کانفیگ بدون نام';
    const userId = cfg.userId || 'amir';
    const timeframe = cfg.timeframe || '5m';
    const capital = Number(cfg.capital) || 1000;
    const riskPercent = String(cfg.riskPercent || '2');
    const selectedStrategyId = cfg.selectedStrategyId || 'strategy_1_e_breakout';

    await pool.query(
      `INSERT INTO test_configs (id, name, user_id, timeframe, capital, risk_percent, selected_strategy_id, config_data_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = $2,
         timeframe = $4,
         capital = $5,
         risk_percent = $6,
         selected_strategy_id = $7,
         config_data_json = $8,
         updated_at = NOW();`,
      [id, name, userId, timeframe, capital, riskPercent, selectedStrategyId, JSON.stringify(cfg)]
    );
    res.json({ success: true, id, message: 'Config saved to PostgreSQL successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/test-configs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query(`DELETE FROM test_configs WHERE id = $1;`, [id]);
    res.json({ success: true, message: 'Config deleted from PostgreSQL successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6.7 POSTGRESQL ALLOWED PAIRS LISTS (allowed_pairs table)
// =========================================================================
app.get('/api/allowed-pairs', async (req, res) => {
  try {
    const userId = (req.query.userId || 'amir').toString();
    const exchange = (req.query.exchange || 'xt').toString();
    const result = await pool.query(
      `SELECT * FROM allowed_pairs WHERE (user_id = $1 OR user_id = 'amir') AND exchange = $2 ORDER BY updated_at DESC;`,
      [userId, exchange]
    );
    const lists = result.rows.map((row) => {
      let syms: string[] = [];
      try {
        syms = JSON.parse(row.symbols_list || '[]');
      } catch {
        syms = [];
      }
      return {
        id: row.id,
        userId: row.user_id,
        exchange: row.exchange,
        listName: row.name,
        name: row.name,
        symbols: syms,
        count: syms.length,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    res.json({ success: true, lists });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/allowed-pairs', async (req, res) => {
  try {
    const { id, userId = 'amir', exchange = 'xt', listName, name, symbols = [] } = req.body || {};
    const effectiveName = listName || name || 'پیش‌فرض';
    const safeId = id || `${userId}_${exchange}_${Date.now()}`;
    await pool.query(
      `INSERT INTO allowed_pairs (id, user_id, exchange, name, symbols_list, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = $4,
         symbols_list = $5,
         updated_at = NOW();`,
      [safeId, userId, exchange, effectiveName, JSON.stringify(symbols)]
    );
    res.json({ success: true, id: safeId, message: 'Allowed pairs saved to PostgreSQL successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/allowed-pairs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query(`DELETE FROM allowed_pairs WHERE id = $1;`, [id]);
    res.json({ success: true, message: 'Allowed pairs deleted from PostgreSQL successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
  stepSize?: number;
  qtyPrecision?: number;
  notionalUsdt: number;
  riskUsdt: number;
  targetRiskUsdt?: number;
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

const CONFIG_FILE_PATH = path.resolve(__dirname, 'data', 'live-config.json');

interface PersistentLiveScannerData {
  config: ServerLiveScannerConfig;
  isRunning: boolean;
  updatedAt: string;
}

let serverScannerTimer: NodeJS.Timeout | null = null;
const serverScannerState = {
  isRunning: false,
  isScanning: false, // Concurrency lock to prevent overlapping executions
  config: {
    timeframe: '5m',
    exchange: 'xt' as 'xt' | 'binance',
    strategyId: 'strategy_2_next_pivot',
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
  executionLogs: [] as any[], // Detailed history of all exchange order attempts and responses
};

function loadLiveConfigFromDisk(): PersistentLiveScannerData | null {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.config) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn('[ServerLiveScanner] Warning reading config from disk:', err.message);
  }
  return null;
}

function saveLiveConfigToDisk() {
  try {
    const dataDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const data: PersistentLiveScannerData = {
      config: serverScannerState.config,
      isRunning: serverScannerState.isRunning,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[ServerLiveScanner] Failed to save live config to disk:', err.message);
  }
}

// Initialize and resume persistent state from disk
const savedDiskData = loadLiveConfigFromDisk();
if (savedDiskData) {
  serverScannerState.config = {
    ...serverScannerState.config,
    ...savedDiskData.config,
  };
  serverScannerState.isRunning = !!savedDiskData.isRunning;
  console.log(`[ServerLiveScanner] ✅ Loaded persistent config from ${CONFIG_FILE_PATH} (Active: ${serverScannerState.isRunning})`);
}

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
    logs: serverScannerState.logs.slice(0, 100),
    executionLogs: serverScannerState.executionLogs.slice(0, 50),
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

        // Evaluate using backend strategy engine (100% in-memory, pure Node.js)
        const signal = evaluateSymbolForLiveSignal({
          symbol: sym,
          candles,
          config: {
            strategyId: (cfg.strategyId as any) || 'strategy_2_next_pivot',
            timeframe: cfg.timeframe,
            atrPeriod: cfg.atrPeriod || 14,
            atrMultiplier: cfg.atrMultiplier || 2.0,
            minCandles: cfg.minCandles || 5,
            minCandlesForLongLeg: cfg.minCandlesForLongLeg || 5,
            longLegAtrMultiplier: cfg.longLegAtrMultiplier || 3.0,
            maxBlueLegPercent: cfg.maxBlueLegPercent || 70,
            maxBreakoutAtrMultiplier: cfg.maxBreakoutAtrMultiplier || 3.0,
            riskRewardRatio: cfg.riskRewardRatio || 2.0,
            riskMode: cfg.riskMode || 'percent',
            riskAmountFixed: cfg.riskAmountFixed || 50,
            riskPercent: cfg.riskPercent || 1.0,
            maxCandlesToEnter: 35,
            noConcurrentPositions: Boolean(cfg.noConcurrentPositions),
          },
          availableBalance,
          hasExistingPosition: openPositionsCount > 0,
        });

        if (signal) {
          candidateSignals.push(signal);
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
        .map((c) => `${c.symbol.toUpperCase()} (مارجین: ${c.requiredMargin}$ | اهرم ${c.maxLeverage}x | حجم: ${c.contractQty})`)
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
      } else if (availableBalance < chosen.requiredMargin) {
        addServerScannerLog(
          'warning',
          `⚠️ موجودی آزاد ناکافی! مارجین مورد نیاز برای ${chosen.symbol.toUpperCase()}: ${chosen.requiredMargin}$ | موجودی آزاد حساب: ${availableBalance.toFixed(2)}$`,
          chosen.symbol
        );
      } else {
        addServerScannerLog(
          'trade',
          `⚡ سیگنال برگزیده ${chosen.posSide} برای ${chosen.symbol.toUpperCase()} با بیشترین اهرم (${chosen.maxLeverage}x) و حداقل مارجین (${chosen.requiredMargin} USDT) تأیید شد. حجم مجاز صرافی: ${chosen.contractQty} (ارزش: ${chosen.notionalUsdt}$) | زیان استاپ با کسر اعشار: ${chosen.riskUsdt}$ از سقف ${chosen.targetRiskUsdt}$ | ورود: ${chosen.curPrice} | استاپ: ${chosen.stopLoss} | تارگت: ${chosen.takeProfit}`,
          chosen.symbol
        );

        if (cfg.isLiveExecution && cfg.exchange === 'xt') {
          const xtSymbol = toXtSymbol(chosen.symbol);
          addServerScannerLog('info', `🚀 در حال ارسال سفارش زنده فیوچرز به XT.COM برای ${xtSymbol.toUpperCase()}...`, chosen.symbol);
          
          const xtSizing = calculateXtContractQuantity(chosen.contractQty, chosen.curPrice, xtSymbol, 10);
          const orderQty = xtSizing.contractQty;

          // Adjust leverage on XT first (swallow error if already set)
          try {
            await requestXtApi('POST', '/future/user/v1/position/adjust-leverage', 'application/json', {
              symbol: xtSymbol,
              leverage: chosen.maxLeverage,
              positionSide: chosen.posSide,
            });
          } catch {}

          const orderPayload = {
            symbol: xtSymbol,
            orderSide: chosen.side,
            orderType: 'MARKET',
            positionSide: chosen.posSide,
            origQty: orderQty,
            triggerProfitPrice: chosen.takeProfit,
            triggerStopPrice: chosen.stopLoss,
          };

          const execRecord: any = {
            id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            time: new Date().toISOString(),
            timeFa: new Date().toLocaleTimeString('fa-IR'),
            symbol: xtSymbol,
            side: chosen.side,
            posSide: chosen.posSide,
            contractQty: orderQty,
            contractSize: xtSizing.contractSize,
            coinQty: xtSizing.effectiveCoinQty,
            nominalUsdt: xtSizing.nominalUsdt,
            curPrice: chosen.curPrice,
            stopLoss: chosen.stopLoss,
            takeProfit: chosen.takeProfit,
            payload: orderPayload,
          };

          try {
            const orderRes = await requestXtApi('POST', '/future/trade/v1/order/create', 'application/json', orderPayload);
            execRecord.response = orderRes;

            if (orderRes && orderRes.returnCode === 0) {
              const orderId = orderRes.result?.orderId || 'ثبت شد';
              execRecord.status = 'SUCCESS';
              execRecord.orderId = orderId;
              addServerScannerLog(
                'success',
                `✅ سفارش زنده فیوچرز با موفقیت در صرافی XT ثبت شد (Order ID: ${orderId}) | حجم: ${orderQty} قرارداد (${xtSizing.effectiveCoinQty} واحد، ارزش: $${xtSizing.nominalUsdt}) | استاپ: ${chosen.stopLoss} | تارگت: ${chosen.takeProfit}`,
                chosen.symbol
              );
            } else {
              execRecord.status = 'FAILED';
              const errDetail = orderRes?.error?.code
                ? `${orderRes.error.code}${orderRes.error.msg ? ': ' + orderRes.error.msg : ''}`
                : (orderRes?.msgInfo || orderRes?.msg || JSON.stringify(orderRes));
              execRecord.error = errDetail;
              addServerScannerLog('error', `❌ خطای صرافی XT در ثبت سفارش (${xtSymbol}): ${errDetail}`, chosen.symbol);
            }
          } catch (orderErr: any) {
            execRecord.status = 'FAILED';
            execRecord.error = orderErr.message;
            addServerScannerLog('error', `❌ استثنای شبکه در ارسال سفارش به صرافی XT: ${orderErr.message}`, chosen.symbol);
          }

          serverScannerState.executionLogs = [execRecord, ...serverScannerState.executionLogs].slice(0, 100);
        } else if (cfg.isLiveExecution && cfg.exchange === 'binance') {
          addServerScannerLog('info', `🚀 سفارش بایننس لایو برای ${chosen.symbol} محاسبه شد (حجم: ${chosen.contractQty}، ارزش: $${chosen.notionalUsdt}).`, chosen.symbol);
        } else {
          addServerScannerLog('info', `📝 معامله در حالت شبیه‌ساز (Paper Trading) محاسبه شد. برای ارسال سفارش واقعی به صرافی، گزینه «معامله زنده (Auto-Trade)» را فعال کنید.`, chosen.symbol);
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

// 7.1 Update and Persist Live Scanner Configuration
app.post('/api/live-scanner/config', (req, res) => {
  try {
    const userCfg = req.body?.config || req.body || {};
    serverScannerState.config = {
      ...serverScannerState.config,
      ...userCfg,
    };
    if (userCfg.timeframe && !userCfg.intervalMs) {
      serverScannerState.config.intervalMs = getTimeframeMs(userCfg.timeframe);
    }
    
    // Immediately persist to disk
    saveLiveConfigToDisk();

    // If autopilot is actively running and interval changed, update timer interval
    if (serverScannerState.isRunning && userCfg.timeframe) {
      if (serverScannerTimer) {
        clearInterval(serverScannerTimer);
      }
      serverScannerTimer = setInterval(() => {
        runServerScannerCycle().catch((err) => {
          addServerScannerLog('error', `خطا در اجرای اسکن دوره‌ای سرور: ${err.message}`);
          serverScannerState.isScanning = false;
        });
      }, serverScannerState.config.intervalMs);
    }

    addServerScannerLog('info', '💾 تنظیمات اسکنر و معاملات زنده با موفقیت در دیسک سرور پایدار شد.');
    res.json({
      success: true,
      message: 'Server live scanner config updated and persisted',
      config: serverScannerState.config,
      isRunning: serverScannerState.isRunning,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7.2 Start Live Scanner on Server
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

    // Persist running state to disk
    saveLiveConfigToDisk();

    const tradeModeText = serverScannerState.config.isLiveExecution ? '⚡ معامله زنده صرافی (Real Orders)' : '📝 شبیه‌ساز (Paper Trading)';
    addServerScannerLog(
      'success',
      `🚀 اتوپایلوت مداوم سرور فعال شد [حالت: ${tradeModeText}]: دوره تکرار هر ${Math.round(serverScannerState.config.intervalMs / 60000)} دقیقه (${serverScannerState.config.symbols.length} ارز). اسکن اول فوراً آغاز شد.`
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

// 7.3 Stop Live Scanner on Server
app.post('/api/live-scanner/stop', (_req, res) => {
  try {
    if (serverScannerTimer) {
      clearInterval(serverScannerTimer);
      serverScannerTimer = null;
    }
    serverScannerState.isRunning = false;
    serverScannerState.nextRunAt = null;
    serverScannerState.isScanning = false;

    // Persist stopped state to disk
    saveLiveConfigToDisk();

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

// 7.4 Get Live Scanner Status from Server
app.get('/api/live-scanner/status', (_req, res) => {
  res.json({
    success: true,
    state: getScannerPublicState(),
  });
});

// 7.4.1 Trigger Immediate Manual Scan on Server
app.post('/api/live-scanner/scan-now', async (_req, res) => {
  try {
    if (serverScannerState.isScanning) {
      return res.json({
        success: true,
        message: 'اسکن هم‌اکنون در سرور در حال انجام است...',
        state: getScannerPublicState(),
      });
    }

    addServerScannerLog('info', '🔍 اسکن دستی فوری سرور توسط کاربر درخواست شد.');
    await runServerScannerCycle();

    return res.json({
      success: true,
      message: 'اسکن سرور با موفقیت به پایان رسید.',
      state: getScannerPublicState(),
    });
  } catch (err: any) {
    addServerScannerLog('error', `❌ خطا در اجرای اسکن فوری سرور: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7.5 Execute Instant Test Live Trade ($0.10 Risk or Exchange Minimum)
app.post('/api/live-scanner/test-trade', async (req, res) => {
  try {
    const rawSymbol = (req.body?.symbol || 'btc_usdt').toString();
    const xtSymbol = toXtSymbol(rawSymbol);
    const posSide = (req.body?.posSide === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT';
    const side = posSide === 'LONG' ? 'BUY' : 'SELL';
    const targetRisk = parseFloat(String(req.body?.riskUsdt || 0.10));

    // 1. Fetch current live market price of the symbol from XT
    let curPrice = 0;
    try {
      const tickerRes = await fetch(`https://${XT_FAPI_HOST}/future/market/v1/public/q/ticker?symbol=${xtSymbol}`);
      const tickerData = await tickerRes.json();
      if (tickerData?.result?.c) {
        curPrice = parseFloat(tickerData.result.c);
      }
    } catch {}

    if (!curPrice || curPrice <= 0) {
      curPrice = xtSymbol.startsWith('btc') ? 81500 : (xtSymbol.startsWith('eth') ? 2500 : 100);
    }

    // 2. Safe SL (0.3% distance) and TP (0.9% distance, 1:3 RR)
    const slDistance = curPrice * 0.003;
    const tpDistance = curPrice * 0.009;

    const stopLoss = posSide === 'LONG'
      ? parseFloat((curPrice - slDistance).toFixed(1))
      : parseFloat((curPrice + slDistance).toFixed(1));
    const takeProfit = posSide === 'LONG'
      ? parseFloat((curPrice + tpDistance).toFixed(1))
      : parseFloat((curPrice - tpDistance).toFixed(1));

    // 3. Calculate minimum allowable contracts for XT (ensuring >= 10 USDT minNotional)
    const xtSizing = calculateXtContractQuantity(0, curPrice, xtSymbol, 10);
    const contractQty = xtSizing.contractQty;

    // 4. Build order payload
    const orderPayload = {
      symbol: xtSymbol,
      orderSide: side,
      orderType: 'MARKET',
      positionSide: posSide,
      origQty: contractQty,
      triggerProfitPrice: takeProfit,
      triggerStopPrice: stopLoss,
    };

    addServerScannerLog('info', `🧪 در حال ارسال معامله آزمایشی زنده به XT (${xtSymbol.toUpperCase()} | ${contractQty} قرارداد)...`, xtSymbol);

    // 5. Send order to XT API
    const orderRes = await requestXtApi('POST', '/future/trade/v1/order/create', 'application/json', orderPayload);

    const execRecord: any = {
      id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toISOString(),
      timeFa: new Date().toLocaleTimeString('fa-IR'),
      symbol: xtSymbol,
      side,
      posSide,
      contractQty,
      contractSize: xtSizing.contractSize,
      coinQty: xtSizing.effectiveCoinQty,
      nominalUsdt: xtSizing.nominalUsdt,
      curPrice,
      stopLoss,
      takeProfit,
      isTestTrade: true,
      payload: orderPayload,
      response: orderRes,
    };

    if (orderRes && orderRes.returnCode === 0) {
      const realOrderId = orderRes.result?.orderId || (typeof orderRes.result === 'string' || typeof orderRes.result === 'number' ? String(orderRes.result) : 'ثبت شد');
      execRecord.status = 'SUCCESS';
      execRecord.orderId = realOrderId;
      addServerScannerLog(
        'success',
        `🧪 معامله تست زنده با موفقیت در صرافی XT ثبت شد! Order ID: ${realOrderId} | نماد: ${xtSymbol.toUpperCase()} | حجم: ${contractQty} قرارداد (${xtSizing.effectiveCoinQty} واحد، ارزش: $${xtSizing.nominalUsdt}) | استاپ: ${stopLoss} | تارگت: ${takeProfit}`,
        xtSymbol
      );
    } else {
      execRecord.status = 'FAILED';
      const errDetail = orderRes?.error?.code
        ? `${orderRes.error.code}${orderRes.error.msg ? ': ' + orderRes.error.msg : ''}`
        : (orderRes?.msgInfo || orderRes?.msg || JSON.stringify(orderRes));
      execRecord.error = errDetail;
      addServerScannerLog('error', `❌ تست معامله در صرافی با خطا مواجه شد: ${errDetail}`, xtSymbol);
    }

    serverScannerState.executionLogs = [execRecord, ...serverScannerState.executionLogs].slice(0, 100);

    const realOrderId = orderRes?.result?.orderId || (typeof orderRes?.result === 'string' || typeof orderRes?.result === 'number' ? String(orderRes.result) : null);

    return res.json({
      success: orderRes && orderRes.returnCode === 0,
      orderId: realOrderId,
      orderPayload,
      exchangeResponse: orderRes,
      details: {
        symbol: xtSymbol,
        posSide,
        side,
        curPrice,
        stopLoss,
        takeProfit,
        contractQty,
        contractSize: xtSizing.contractSize,
        coinQty: xtSizing.effectiveCoinQty,
        nominalUsdt: xtSizing.nominalUsdt,
        estimatedLossAtSL: parseFloat((xtSizing.effectiveCoinQty * slDistance).toFixed(3)),
      },
    });
  } catch (err: any) {
    addServerScannerLog('error', `❌ خطای سیستمی در اجرای تست معامله: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// WEBSOCKET RELAY FOR REAL-TIME KLINES & CANDLES (Proxies upstream without client geoblocking)
// =========================================================================
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '';
    if (pathname === '/ws/kline') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.warn('WS upgrade error:', err);
  }
});

wss.on('connection', (clientWs, request) => {
  let isAlive = true;
  let upstreamWs: WebSocket | null = null;
  let pollInterval: NodeJS.Timeout | null = null;

  try {
    const urlObj = new URL(request.url || '', 'http://localhost');
    const rawSymbol = urlObj.searchParams.get('symbol') || 'BTCUSDT';
    const interval = urlObj.searchParams.get('interval') || '1h';
    const exchange = urlObj.searchParams.get('exchange') || 'binance';

    const cleanup = () => {
      isAlive = false;
      if (upstreamWs) {
        try {
          upstreamWs.close();
        } catch {}
        upstreamWs = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    if (exchange === 'xt') {
      const xtSym = toXtSymbol(rawSymbol);
      const pollXt = async () => {
        if (!isAlive || clientWs.readyState !== WebSocket.OPEN) return;
        try {
          const candles = await fetchXtServerKlines(xtSym, interval, 2);
          if (candles.length > 0) {
            const last = candles[candles.length - 1];
            clientWs.send(JSON.stringify({
              type: 'kline',
              candle: last,
              isFinal: false,
            }));
          }
        } catch {}
      };
      pollXt();
      pollInterval = setInterval(pollXt, 1500);
    } else {
      // Binance: Server connects upstream from cloud server (no client geo-block!)
      const cleanSym = rawSymbol.toLowerCase().replace(/[^a-z0-9]/g, '');
      const streamName = `${cleanSym}@kline_${interval}`;
      const upstreamUrl = `wss://fstream.binance.com/ws/${streamName}`;

      const startBinancePoll = () => {
        if (pollInterval || !isAlive) return;
        const poll = async () => {
          if (!isAlive || clientWs.readyState !== WebSocket.OPEN) return;
          try {
            const candles = await fetchServerKlines(rawSymbol.toUpperCase(), interval, 2, true);
            if (candles.length > 0) {
              const last = candles[candles.length - 1];
              clientWs.send(JSON.stringify({
                type: 'kline',
                candle: last,
                isFinal: false,
              }));
            }
          } catch {}
        };
        poll();
        pollInterval = setInterval(poll, 1500);
      };

      try {
        upstreamWs = new WebSocket(upstreamUrl);

        upstreamWs.on('message', (msg) => {
          if (!isAlive || clientWs.readyState !== WebSocket.OPEN) return;
          try {
            const parsed = JSON.parse(msg.toString());
            if (parsed?.k) {
              const k = parsed.k;
              const candle = {
                time: Math.floor(Number(k.t) / 1000),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                quoteVolume: parseFloat(k.q),
                trades: Number(k.n),
                isClosed: Boolean(k.x),
              };
              clientWs.send(JSON.stringify({
                type: 'kline',
                candle,
                isFinal: Boolean(k.x),
              }));
            }
          } catch {}
        });

        upstreamWs.on('error', () => {
          startBinancePoll();
        });

        upstreamWs.on('close', () => {
          startBinancePoll();
        });
      } catch {
        startBinancePoll();
      }
    }
  } catch (err: any) {
    console.warn('WS client handler error:', err);
  }
});

// =========================================================================
// POSTGRESQL DATABASE HEALTH & AUTO-INIT
// =========================================================================
app.get('/api/db-test', async (_req, res) => {
  try {
    const testResult = await testDatabaseConnection();
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'INTERNAL_ERROR',
      error: err.message,
    });
  }
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Server-side crypto trading platform running on http://0.0.0.0:${PORT}`);

    // Run PostgreSQL database table verification asynchronously in background so port 3000 opens instantly
    initDatabase()
      .then((dbInitResult) => {
        if (dbInitResult.success) {
          console.log(`[PostgreSQL] 🚀 Auto-initialized ${dbInitResult.tablesCreated.length} tables on remote database.`);
        } else {
          console.warn(`[PostgreSQL] ⚠️ Database auto-init warning:`, dbInitResult.error);
        }
      })
      .catch((dbErr: any) => {
        console.warn(`[PostgreSQL] ⚠️ Database startup warning:`, dbErr.message);
      });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

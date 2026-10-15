import { CandleData, CryptoPair, Ticker24h, RecentTrade } from '../types/crypto';

// Reliable Binance & Global Exchange REST mirrors (including server-side proxy routes to bypass CORS/geo-blocking in browser)
const BINANCE_REST_ENDPOINTS = [
  '/api/binance-spot',
  '/api/binance-vision',
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api.mexc.com',
];

const BINANCE_FUTURES_ENDPOINTS = [
  '/api/binance-futures',
  '/api/binance-fapi',
  'https://fapi.binance.com',
  'https://api.mexc.com',
];

export const POPULAR_PAIRS: CryptoPair[] = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', name: 'Bitcoin', category: 'Popular' },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', name: 'Ethereum', category: 'Popular' },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', name: 'Solana', category: 'Layer 1' },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', name: 'BNB Chain', category: 'Popular' },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', name: 'Ripple', category: 'Popular' },
  { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT', name: 'Dogecoin', category: 'Meme' },
  { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT', name: 'Cardano', category: 'Layer 1' },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDT', name: 'Avalanche', category: 'Layer 1' },
  { symbol: 'SUIUSDT', baseAsset: 'SUI', quoteAsset: 'USDT', name: 'Sui Network', category: 'Layer 1' },
  { symbol: 'NEARUSDT', baseAsset: 'NEAR', quoteAsset: 'USDT', name: 'NEAR Protocol', category: 'AI & Tech' },
  { symbol: 'LINKUSDT', baseAsset: 'LINK', quoteAsset: 'USDT', name: 'Chainlink', category: 'DeFi' },
  { symbol: 'PEPEUSDT', baseAsset: 'PEPE', quoteAsset: 'USDT', name: 'Pepe', category: 'Meme' },
  { symbol: 'SHIBUSDT', baseAsset: 'SHIB', quoteAsset: 'USDT', name: 'Shiba Inu', category: 'Meme' },
  { symbol: 'DOTUSDT', baseAsset: 'DOT', quoteAsset: 'USDT', name: 'Polkadot', category: 'Layer 1' },
  { symbol: 'LTCUSDT', baseAsset: 'LTC', quoteAsset: 'USDT', name: 'Litecoin', category: 'Popular' },
  { symbol: 'UNIUSDT', baseAsset: 'UNI', quoteAsset: 'USDT', name: 'Uniswap', category: 'DeFi' },
  { symbol: 'AAVEUSDT', baseAsset: 'AAVE', quoteAsset: 'USDT', name: 'Aave', category: 'DeFi' },
  { symbol: 'ARBUSDT', baseAsset: 'ARB', quoteAsset: 'USDT', name: 'Arbitrum', category: 'Layer 1' },
  { symbol: 'OPUSDT', baseAsset: 'OP', quoteAsset: 'USDT', name: 'Optimism', category: 'Layer 1' },
  { symbol: 'RENDERUSDT', baseAsset: 'RENDER', quoteAsset: 'USDT', name: 'Render Token', category: 'AI & Tech' },
  { symbol: 'FETUSDT', baseAsset: 'FET', quoteAsset: 'USDT', name: 'Artificial Superintelligence', category: 'AI & Tech' },
  { symbol: 'INJUSDT', baseAsset: 'INJ', quoteAsset: 'USDT', name: 'Injective', category: 'DeFi' },
  { symbol: 'TIAUSDT', baseAsset: 'TIA', quoteAsset: 'USDT', name: 'Celestia', category: 'Layer 1' },
  { symbol: 'APTUSDT', baseAsset: 'APT', quoteAsset: 'USDT', name: 'Aptos', category: 'Layer 1' },
  { symbol: 'FILUSDT', baseAsset: 'FIL', quoteAsset: 'USDT', name: 'Filecoin', category: 'Layer 1' },
  { symbol: 'ATOMUSDT', baseAsset: 'ATOM', quoteAsset: 'USDT', name: 'Cosmos', category: 'Layer 1' },
  { symbol: 'ICPUSDT', baseAsset: 'ICP', quoteAsset: 'USDT', name: 'Internet Computer', category: 'Layer 1' },
  { symbol: 'FTMUSDT', baseAsset: 'FTM', quoteAsset: 'USDT', name: 'Fantom', category: 'Layer 1' },
  { symbol: 'WIFUSDT', baseAsset: 'WIF', quoteAsset: 'USDT', name: 'dogwifhat', category: 'Meme' },
  { symbol: 'FLOKIUSDT', baseAsset: 'FLOKI', quoteAsset: 'USDT', name: 'Floki', category: 'Meme' },
  { symbol: 'BONKUSDT', baseAsset: 'BONK', quoteAsset: 'USDT', name: 'Bonk', category: 'Meme' },
  { symbol: 'SEIUSDT', baseAsset: 'SEI', quoteAsset: 'USDT', name: 'Sei Network', category: 'Layer 1' },
  { symbol: 'TAOUSDT', baseAsset: 'TAO', quoteAsset: 'USDT', name: 'Bittensor', category: 'AI & Tech' },
  { symbol: 'STXUSDT', baseAsset: 'STX', quoteAsset: 'USDT', name: 'Stacks', category: 'Layer 1' },
  { symbol: 'WLDUSDT', baseAsset: 'WLD', quoteAsset: 'USDT', name: 'Worldcoin', category: 'AI & Tech' },
  { symbol: 'PENDLEUSDT', baseAsset: 'PENDLE', quoteAsset: 'USDT', name: 'Pendle', category: 'DeFi' },
  { symbol: 'JUPUSDT', baseAsset: 'JUP', quoteAsset: 'USDT', name: 'Jupiter', category: 'DeFi' },
  { symbol: 'ONDOUSDT', baseAsset: 'ONDO', quoteAsset: 'USDT', name: 'Ondo Finance', category: 'DeFi' },
  { symbol: 'CRVUSDT', baseAsset: 'CRV', quoteAsset: 'USDT', name: 'Curve DAO', category: 'DeFi' },
  { symbol: 'MKRUSDT', baseAsset: 'MKR', quoteAsset: 'USDT', name: 'Maker', category: 'DeFi' },
  { symbol: 'LDOUSDT', baseAsset: 'LDO', quoteAsset: 'USDT', name: 'Lido DAO', category: 'DeFi' },
  { symbol: 'GRTUSDT', baseAsset: 'GRT', quoteAsset: 'USDT', name: 'The Graph', category: 'AI & Tech' },
  { symbol: 'RUNEUSDT', baseAsset: 'RUNE', quoteAsset: 'USDT', name: 'THORChain', category: 'DeFi' },
  { symbol: 'HBARUSDT', baseAsset: 'HBAR', quoteAsset: 'USDT', name: 'Hedera', category: 'Layer 1' },
];

/**
 * Fetch all active Binance USDT-M Futures pairs with 24h quote volume >= minVolumeUsd
 */
export async function fetchFuturesMarketPairs(
  minVolumeUsd: number = 200000,
  exchange: 'binance' | 'xt' = 'binance'
): Promise<CryptoPair[]> {
  // 1. Try server-side pairs API first (bypasses browser CORS & geo-restrictions)
  try {
    const res = await fetch(`/api/market/pairs?exchange=${exchange}&universe=futures&limit=1500&minVolume=${minVolumeUsd}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
        return data.pairs;
      }
    }
  } catch {}

  for (const baseUrl of BINANCE_FUTURES_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}/fapi/v1/ticker/24hr`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      const volumeMap = new Map<string, number>();
      const pairs: CryptoPair[] = [];
      for (const item of data) {
        const symbol = String(item.symbol);
        const quoteVol = parseFloat(item.quoteVolume || '0');

        if (
          symbol.endsWith('USDT') &&
          quoteVol >= minVolumeUsd &&
          !symbol.includes('_')
        ) {
          const base = symbol.slice(0, -4);
          pairs.push({
            symbol,
            baseAsset: base,
            quoteAsset: 'USDT',
            name: base,
            category: 'Futures',
          });
          volumeMap.set(symbol, quoteVol);
        }
      }

      // Sort by 24h volume descending
      pairs.sort((a, b) => (volumeMap.get(b.symbol) || 0) - (volumeMap.get(a.symbol) || 0));

      if (pairs.length > 0) {
        return pairs;
      }
    } catch {
      continue;
    }
  }

  // Fallback to Popular Pairs
  return POPULAR_PAIRS.map(p => ({ ...p, category: 'Futures' }));
}

/**
 * Fetch all active USDT market pairs with 24h volume/market turnover >= $1M
 */
export async function fetchUSDTMarketPairs(minVolumeUsd: number = 1000000): Promise<CryptoPair[]> {
  // 1. Try server-side pairs API first (bypasses browser CORS & geo-restrictions, no artificial 80 limit)
  try {
    const res = await fetch(`/api/market/pairs?universe=spot&limit=1500&minVolume=${minVolumeUsd}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
        return data.pairs;
      }
    }
  } catch {}

  for (const baseUrl of BINANCE_REST_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}/api/v3/ticker/24hr`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      const pairs: CryptoPair[] = [];
      for (const item of data) {
        const symbol = String(item.symbol);
        const quoteVol = parseFloat(item.quoteVolume || '0');

        if (
          symbol.endsWith('USDT') &&
          quoteVol >= minVolumeUsd &&
          !symbol.includes('UP') &&
          !symbol.includes('DOWN') &&
          !symbol.includes('BEAR') &&
          !symbol.includes('BULL')
        ) {
          const base = symbol.slice(0, -4);
          pairs.push({
            symbol,
            baseAsset: base,
            quoteAsset: 'USDT',
            name: base,
            category: 'Popular',
          });
        }
      }

      if (pairs.length > 0) {
        return pairs;
      }
    } catch {
      continue;
    }
  }

  // Fallback to rich predefined high cap list
  return POPULAR_PAIRS;
}

async function fetchBatch(
  baseUrl: string,
  symbol: string,
  interval: string,
  batchLimit: number,
  endTime?: number
): Promise<CandleData[]> {
  const isFutures = baseUrl.includes('fapi') || baseUrl.includes('futures');
  const path = isFutures ? '/fapi/v1/klines' : '/api/v3/klines';
  let url = `${baseUrl}${path}?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${batchLimit}`;
  if (endTime !== undefined) {
    url += `&endTime=${endTime}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 400 && isFutures && !symbol.startsWith('1000')) {
        return await fetchBatch(baseUrl, `1000${symbol}`, interval, batchLimit, endTime);
      }
      return [];
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) return [];

    return rawData.map((item: (string | number)[]) => ({
      time: Math.floor(Number(item[0]) / 1000), // Unix seconds for lightweight-charts
      open: parseFloat(String(item[1])),
      high: parseFloat(String(item[2])),
      low: parseFloat(String(item[3])),
      close: parseFloat(String(item[4])),
      volume: parseFloat(String(item[5])),
      quoteVolume: parseFloat(String(item[7])),
      trades: Number(item[8]),
    }));
  } catch {
    return [];
  }
}

const INTERVAL_MS_MAP: Record<string, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 1000,
  '1w': 7 * 24 * 60 * 1000,
};

/**
 * Fetch klines from Bybit API (worldwide open CORS, linear & spot)
 */
async function fetchBybitKlines(
  symbol: string,
  interval: string,
  limit: number = 5000
): Promise<CandleData[]> {
  const bybitIntervalMap: Record<string, string> = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '2h': '120',
    '4h': '240',
    '6h': '360',
    '12h': '720',
    '1d': 'D',
    '1w': 'W',
  };
  const bInterval = bybitIntervalMap[interval] || '5';
  const cleanSymbol = symbol.toUpperCase();

  const fetchOneBybitBatch = async (batchLimit: number, endTimeMs?: number): Promise<CandleData[]> => {
    let url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${cleanSymbol}&interval=${bInterval}&limit=${batchLimit}`;
    if (endTimeMs) {
      url += `&end=${endTimeMs}`;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      // Try spot category if linear fails
      const spotUrl = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${cleanSymbol}&interval=${bInterval}&limit=${batchLimit}${endTimeMs ? `&end=${endTimeMs}` : ''}`;
      const spotRes = await fetch(spotUrl, { signal: AbortSignal.timeout(8000) });
      if (!spotRes.ok) return [];
      const spotData = await spotRes.json();
      if (!spotData?.result?.list || !Array.isArray(spotData.result.list)) return [];
      return spotData.result.list.map((item: string[]) => ({
        time: Math.floor(Number(item[0]) / 1000),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        quoteVolume: parseFloat(item[6] || '0'),
        trades: 0,
      }));
    }
    const data = await res.json();
    if (!data?.result?.list || !Array.isArray(data.result.list)) return [];
    return data.result.list.map((item: string[]) => ({
      time: Math.floor(Number(item[0]) / 1000),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      quoteVolume: parseFloat(item[6] || '0'),
      trades: 0,
    }));
  };

  try {
    const firstLimit = Math.min(1000, limit);
    const batch0 = await fetchOneBybitBatch(firstLimit);
    if (!batch0 || batch0.length === 0) return [];

    if (limit <= 1000 || batch0.length < firstLimit) {
      return batch0.sort((a, b) => a.time - b.time);
    }

    const remaining = limit - batch0.length;
    const numBatches = Math.ceil(remaining / 1000);
    const intervalMs = INTERVAL_MS_MAP[interval] || 300000;
    const earliestTimeMs = Math.min(...batch0.map(c => c.time * 1000));

    const parallelReqs: Promise<CandleData[]>[] = [];
    for (let b = 0; b < numBatches; b++) {
      const bLimit = Math.min(1000, remaining - b * 1000);
      if (bLimit <= 0) break;
      const targetEndTime = earliestTimeMs - 1 - (b * 1000 * intervalMs);
      parallelReqs.push(fetchOneBybitBatch(bLimit, targetEndTime));
    }

    const otherBatches = await Promise.all(parallelReqs);
    const candleMap = new Map<number, CandleData>();
    for (const c of batch0) candleMap.set(c.time, c);
    for (const b of otherBatches) {
      for (const c of b) candleMap.set(c.time, c);
    }
    return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

/**
 * Fetch up to 5,000 klines (candlesticks) from Binance / MEXC / Bybit with high-speed parallel pagination and endpoint rotation
 */
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 5000,
  isFutures: boolean = true,
  exchange: 'binance' | 'xt' = 'binance'
): Promise<{ candles: CandleData[]; source: 'live' | 'fallback' }> {
  // 1. Try server-side fast klines endpoint first
  try {
    const res = await fetch(`/api/market/klines?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(interval)}&limit=${limit}&isFutures=${isFutures}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.candles) && data.candles.length >= 20) {
        return { candles: data.candles, source: 'live' };
      }
    }
  } catch {}

  const endpoints = isFutures
    ? [...BINANCE_FUTURES_ENDPOINTS, ...BINANCE_REST_ENDPOINTS]
    : BINANCE_REST_ENDPOINTS;

  const intervalMs = INTERVAL_MS_MAP[interval] || 5 * 60 * 1000;

  // 1. Try Binance & MEXC endpoints
  for (let epIndex = 0; epIndex < endpoints.length; epIndex++) {
    const primaryUrl = endpoints[epIndex];
    try {
      // Step 1: Fetch the most recent 1,000 candles first
      const firstBatchLimit = Math.min(1000, limit);
      const batch0 = await fetchBatch(primaryUrl, symbol, interval, firstBatchLimit);
      if (!batch0 || batch0.length === 0) continue;

      // If user only wanted <=1000 candles or coin has fewer than 1000 candles, return immediately!
      if (limit <= 1000 || batch0.length < firstBatchLimit) {
        return { candles: batch0.sort((a, b) => a.time - b.time), source: 'live' };
      }

      // Step 2: Coin has more history. Fetch remaining batches (up to 4 more batches) in PARALLEL
      const remainingCount = limit - batch0.length;
      const numRemainingBatches = Math.ceil(remainingCount / 1000);
      const earliestTimeMs = batch0[0].time * 1000;

      const parallelRequests: Promise<CandleData[]>[] = [];
      for (let b = 0; b < numRemainingBatches; b++) {
        const batchLimit = Math.min(1000, remainingCount - b * 1000);
        if (batchLimit <= 0) break;
        // Projected endTime for each 1000-candle block
        const targetEndTime = earliestTimeMs - 1 - (b * 1000 * intervalMs);
        // Distribute requests across available mirror endpoints to avoid rate limit choke
        const endpointUrl = endpoints[(epIndex + b + 1) % endpoints.length];
        parallelRequests.push(
          fetchBatch(endpointUrl, symbol, interval, batchLimit, targetEndTime)
        );
      }

      const otherBatches = await Promise.all(parallelRequests);

      // Merge and deduplicate all candles
      const candleMap = new Map<number, CandleData>();
      for (const c of batch0) {
        candleMap.set(c.time, c);
      }
      for (const b of otherBatches) {
        if (Array.isArray(b)) {
          for (const c of b) {
            candleMap.set(c.time, c);
          }
        }
      }

      const sortedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
      if (sortedCandles.length > 0) {
        return { candles: sortedCandles, source: 'live' };
      }
    } catch {
      continue;
    }
  }

  // 2. Try Bybit live API (Worldwide Open CORS)
  try {
    const bybitCandles = await fetchBybitKlines(symbol, interval, limit);
    if (bybitCandles && bybitCandles.length > 0) {
      return { candles: bybitCandles, source: 'live' };
    }
  } catch {}

  // 3. If all live endpoints fail, generate realistic synthetic data
  console.warn('All live exchange endpoints failed, using realistic simulated data fallback');
  const candles = generateFallbackCandles(symbol, interval, limit);
  return { candles, source: 'fallback' };
}

/**
 * Fetch 24hr Ticker stats from Binance, MEXC or Bybit
 */
export async function fetch24hTicker(symbol: string): Promise<Ticker24h | null> {
  // 1. Try Binance & MEXC mirrors
  for (const baseUrl of BINANCE_REST_ENDPOINTS) {
    try {
      const url = `${baseUrl}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;

      const data = await response.json();
      return {
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
        prevClosePrice: parseFloat(data.prevClosePrice),
      };
    } catch {
      continue;
    }
  }

  // 2. Try Bybit live ticker
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol.toUpperCase()}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const bData = await res.json();
      const item = bData?.result?.list?.[0];
      if (item) {
        return {
          symbol: item.symbol,
          lastPrice: parseFloat(item.lastPrice),
          priceChange: parseFloat(item.price24hPcnt || '0') * parseFloat(item.lastPrice),
          priceChangePercent: parseFloat(item.price24hPcnt || '0') * 100,
          highPrice: parseFloat(item.highPrice24h),
          lowPrice: parseFloat(item.lowPrice24h),
          volume: parseFloat(item.volume24h),
          quoteVolume: parseFloat(item.turnover24h),
          prevClosePrice: parseFloat(item.prevPrice24h),
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Fetch recent trades for the orderbook/trades preview
 */
export async function fetchRecentTrades(symbol: string, limit = 20): Promise<RecentTrade[]> {
  for (const baseUrl of BINANCE_REST_ENDPOINTS) {
    try {
      const url = `${baseUrl}/api/v3/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (!Array.isArray(data)) continue;

      return data.map((t: { id: number; price: string; qty: string; time: number; isBuyerMaker: boolean }) => ({
        id: t.id,
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        time: t.time,
        isBuyerMaker: t.isBuyerMaker,
      }));
    } catch {
      continue;
    }
  }
  return [];
}

/**
 * Connect to Binance live WebSocket for real-time klines and ticks
 */
export function subscribeToKlineStream(
  symbol: string,
  interval: string,
  onCandleUpdate: (candle: CandleData, isFinal: boolean) => void,
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void
): () => void {
  let ws: WebSocket | null = null;
  let isClosedManually = false;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
  const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;

  const connect = () => {
    if (isClosedManually) return;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        onStatusChange?.('connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.e === 'kline' && message.k) {
            const k = message.k;
            const candle: CandleData = {
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
            onCandleUpdate(candle, Boolean(k.x));
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onerror = () => {
        onStatusChange?.('reconnecting');
      };

      ws.onclose = () => {
        if (!isClosedManually) {
          onStatusChange?.('reconnecting');
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        } else {
          onStatusChange?.('disconnected');
        }
      };
    } catch {
      onStatusChange?.('disconnected');
    }
  };

  connect();

  return () => {
    isClosedManually = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (ws) {
      ws.close();
    }
  };
}

/**
 * Realistic synthetic data generator in case network or sandbox environment blocks external WebSocket/REST
 */
function generateFallbackCandles(symbol: string, interval: string, count: number): CandleData[] {
  let basePrice = 65000;
  if (symbol.includes('ETH')) basePrice = 3500;
  else if (symbol.includes('SOL')) basePrice = 180;
  else if (symbol.includes('BNB')) basePrice = 580;
  else if (symbol.includes('XRP')) basePrice = 0.58;
  else if (symbol.includes('DOGE')) basePrice = 0.14;
  else if (symbol.includes('ADA')) basePrice = 0.45;
  else if (symbol.includes('SUI')) basePrice = 2.1;
  else if (symbol.includes('PEPE')) basePrice = 0.0000095;

  const intervalSecondsMap: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
    '1w': 604800,
  };

  const stepSeconds = intervalSecondsMap[interval] || 3600;
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * stepSeconds;

  const candles: CandleData[] = [];
  let currentClose = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * stepSeconds;
    const volatility = currentClose * 0.006;
    const delta = (Math.random() - 0.49) * volatility * 2;
    const open = currentClose;
    const close = Math.max(open + delta, 0.000001);
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = Math.random() * 50 + 10;

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: volume * close,
      trades: Math.floor(Math.random() * 200) + 10,
    });

    currentClose = close;
  }

  return candles;
}

export interface ServerScanResult {
  success: boolean;
  metadata: {
    timeframe: string;
    isFutures: boolean;
    updatedAt: string;
    totalSymbols: number;
    totalCandles: number;
    dataSizeBytes: number;
    dataSizeFormatted: string;
  };
  entries: {
    pair: CryptoPair;
    candles: CandleData[];
    timeframe: string;
  }[];
  count: number;
}

/**
 * Perform complete market parallel download server-side (ultra fast, bypasses browser limits).
 * Supports fetching 5,000 5-minute candles across all 700+ market pairs with rate-limiting.
 */
export async function performServerSideMarketDownload(
  timeframe: string = '5m',
  candleHistoryLimit: number = 5000,
  universe: 'all_market' | 'futures' | 'spot' | boolean = 'all_market',
  maxSymbols: number = 1200
): Promise<ServerScanResult | null> {
  try {
    const universeParam =
      typeof universe === 'string'
        ? universe
        : universe === true
        ? 'futures'
        : 'spot';

    const res = await fetch('/api/market/server-scan-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeframe,
        candleHistoryLimit,
        universe: universeParam,
        isFutures: universeParam !== 'spot',
        maxSymbols,
        minVolumeUsd: 1000000,
        autoSaveCloudSql: true,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Server-side market download request failed:', err);
  }
  return null;
}

export async function fetchServerPairs(isFutures: boolean = true, minVolume: number = 200000): Promise<CryptoPair[]> {
  try {
    const res = await fetch(`/api/market-pairs?futures=${isFutures}&minVolume=${minVolume}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('Failed to fetch pairs from server API, falling back to direct:', err);
  }
  return isFutures ? fetchFuturesMarketPairs(minVolume) : fetchUSDTMarketPairs(minVolume);
}

export async function fetchServerKlines(
  symbol: string,
  interval: string = '5m',
  limit: number = 1000,
  isFutures: boolean = true
): Promise<CandleData[]> {
  try {
    const res = await fetch(`/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&isFutures=${isFutures}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('Failed to fetch klines from server API, falling back to direct:', err);
  }
  const direct = await fetchKlines(symbol, interval as any, limit, isFutures);
  return direct.candles;
}

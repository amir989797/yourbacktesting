import { CandleData, CryptoPair, Ticker24h, RecentTrade } from '../types/crypto';

// Reliable Binance REST mirrors
const BINANCE_REST_ENDPOINTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api3.binance.com',
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
 * Fetch all active USDT market pairs with 24h volume/market turnover >= $1M
 */
export async function fetchUSDTMarketPairs(minVolumeUsd: number = 1000000): Promise<CryptoPair[]> {
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
  let url = `${baseUrl}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${batchLimit}`;
  if (endTime !== undefined) {
    url += `&endTime=${endTime}`;
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4500),
  });

  if (!response.ok) return [];

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
}

/**
 * Fetch up to 5,000 klines (candlesticks) from Binance using backward pagination
 */
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 5000
): Promise<{ candles: CandleData[]; source: 'live' | 'fallback' }> {
  for (const baseUrl of BINANCE_REST_ENDPOINTS) {
    try {
      const allCandles: CandleData[] = [];
      let currentEndTime: number | undefined = undefined;
      const batchSize = 1000;
      const numBatches = Math.ceil(limit / batchSize);

      for (let b = 0; b < numBatches; b++) {
        const remaining = limit - allCandles.length;
        const currentBatchLimit = Math.min(batchSize, remaining);
        if (currentBatchLimit <= 0) break;

        const batch = await fetchBatch(baseUrl, symbol, interval, currentBatchLimit, currentEndTime);
        if (!batch || batch.length === 0) {
          break;
        }

        allCandles.unshift(...batch);

        // Next older batch must end right before the earliest candle in this batch
        const earliestTimeMs = batch[0].time * 1000;
        currentEndTime = earliestTimeMs - 1;

        if (batch.length < currentBatchLimit) {
          // Reached beginning of Binance history for this timeframe
          break;
        }
      }

      if (allCandles.length > 0) {
        // Deduplicate and sort ascending by time
        const candleMap = new Map<number, CandleData>();
        for (const c of allCandles) {
          candleMap.set(c.time, c);
        }
        const sortedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);

        return { candles: sortedCandles, source: 'live' };
      }
    } catch {
      // Try next mirror endpoint
      continue;
    }
  }

  // If all live endpoints fail, generate realistic synthetic data
  console.warn('All Binance endpoints failed, using realistic simulated data fallback');
  const candles = generateFallbackCandles(symbol, interval, limit);
  return { candles, source: 'fallback' };
}

/**
 * Fetch 24hr Ticker stats from Binance
 */
export async function fetch24hTicker(symbol: string): Promise<Ticker24h | null> {
  for (const baseUrl of BINANCE_REST_ENDPOINTS) {
    try {
      const url = `${baseUrl}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`;
      const response = await fetch(url);
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

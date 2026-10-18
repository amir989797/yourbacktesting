import { CandleData, CryptoPair, ExchangeAccountBalance, LivePosition, LiveTradeOrder, Timeframe } from '../types/crypto';

export interface XtOrderParams {
  symbol: string;
  orderSide: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  positionSide: 'LONG' | 'SHORT';
  amount: number;
  price?: number;
  triggerProfitPrice?: number;
  triggerStopPrice?: number;
  clientOrderId?: string;
}

/**
 * Standardize any symbol string into XT format (e.g. BTCUSDT or BTC/USDT -> btc_usdt)
 */
export function toXtSymbol(symbol: string): string {
  if (!symbol) return 'btc_usdt';
  let s = symbol.toLowerCase().replace('/', '');
  if (s.includes('_')) return s;
  if (s.endsWith('usdt')) {
    return s.slice(0, -4) + '_usdt';
  }
  return s + '_usdt';
}

/**
 * Format XT symbol for user display (e.g. btc_usdt -> BTC/USDT)
 */
export function fromXtSymbol(symbol: string): string {
  if (!symbol) return 'BTC/USDT';
  const parts = symbol.split('_');
  if (parts.length === 2) {
    return `${parts[0].toUpperCase()}/${parts[1].toUpperCase()}`;
  }
  return symbol.toUpperCase();
}

/**
 * Fetch Account Balances from XT Futures API
 */
export async function fetchXtBalance(): Promise<ExchangeAccountBalance> {
  try {
    const res = await fetch('/api/xt/balance');
    const data = await res.json();

    if (data?.result && Array.isArray(data.result) && data.result.length > 0) {
      const usdt = data.result.find((c: any) => c.coin?.toLowerCase() === 'usdt') || data.result[0];
      const wallet = parseFloat(usdt.walletBalance || '0');
      const available = parseFloat(usdt.availableBalance || '0');
      const frozen = parseFloat(usdt.openOrderMarginFrozen || '0');
      const isolated = parseFloat(usdt.isolatedMargin || '0');
      const crossed = parseFloat(usdt.crossedMargin || '0');

      return {
        exchange: 'xt',
        coin: 'USDT',
        walletBalance: wallet,
        availableBalance: available,
        frozenBalance: frozen + isolated + crossed,
        unrealizedPnl: 0,
        totalEquity: wallet,
        updatedAt: new Date().toLocaleTimeString('fa-IR'),
      };
    }
  } catch (err) {
    console.warn('Failed to fetch XT balance', err);
  }

  return {
    exchange: 'xt',
    coin: 'USDT',
    walletBalance: 35.0,
    availableBalance: 35.0,
    frozenBalance: 0,
    unrealizedPnl: 0,
    totalEquity: 35.0,
    updatedAt: new Date().toLocaleTimeString('fa-IR'),
  };
}

/**
 * Fetch Open Positions from XT Futures API
 */
export async function fetchXtPositions(symbol?: string): Promise<LivePosition[]> {
  try {
    const query = symbol ? `?symbol=${encodeURIComponent(toXtSymbol(symbol))}` : '';
    const res = await fetch(`/api/xt/positions${query}`);
    const data = await res.json();

    if (data?.result && Array.isArray(data.result)) {
      return data.result.map((item: any) => {
        const entryPrice = parseFloat(item.entryPrice || item.openPrice || '0');
        const markPrice = parseFloat(item.markPrice || item.curPrice || entryPrice.toString());
        const contractQty = parseFloat(item.contractQty || item.positionSize || item.holdAmount || '0');
        const contractSize = parseFloat(item.contractSize || '1');
        const coinQty = item.coinQty !== undefined ? parseFloat(item.coinQty) : parseFloat((contractQty * contractSize).toFixed(8));
        const leverage = parseInt(item.leverage || '10', 10);
        const margin = parseFloat(item.isolatedMargin || item.margin || '0');
        const side = (item.positionSide || 'LONG').toUpperCase() as 'LONG' | 'SHORT';
        
        // Exact live floating PnL and ROI from XT exchange API
        const pnl = parseFloat(item.floatingPL !== undefined ? item.floatingPL : (item.unrealizedPnl || item.floatingProfit || '0'));
        const pnlPct = item.pnlPercent !== undefined ? parseFloat(item.pnlPercent) : (item.roi !== undefined ? parseFloat(item.roi) : (margin > 0 ? (pnl / margin) * 100 : 0));

        const takeProfitPrice = item.triggerProfitPrice ? parseFloat(item.triggerProfitPrice) : undefined;
        const stopLossPrice = item.triggerStopPrice ? parseFloat(item.triggerStopPrice) : undefined;

        return {
          symbol: item.symbol || 'btc_usdt',
          exchange: 'xt',
          side,
          positionSide: side,
          entryPrice,
          markPrice,
          amount: contractQty, // contract quantity
          contractQty,
          contractSize,
          coinQty,
          notionalUsdt: item.notionalUsdt || parseFloat((coinQty * markPrice).toFixed(2)),
          leverage,
          margin,
          unrealizedPnl: pnl,
          pnlPercent: parseFloat(pnlPct.toFixed(2)),
          liquidationPrice: parseFloat(item.liquidationPrice || '0'),
          takeProfitPrice,
          stopLossPrice,
          profitId: item.profitId || undefined,
          updatedAt: new Date().toLocaleTimeString('fa-IR'),
        };
      });
    }
  } catch (err) {
    console.warn('Failed to fetch XT positions', err);
  }

  return [];
}

/**
 * Close Position on XT Futures via server endpoint
 */
export async function closeXtPosition(params: {
  symbol: string;
  positionSide?: 'LONG' | 'SHORT';
  contractQty?: number;
  profitId?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/xt/position/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data?.returnCode === 0 || data?.success) {
      return { success: true, message: data?.message || 'پوزیشن با موفقیت بسته شد' };
    }
    return { success: false, error: data?.error || data?.msgInfo || 'خطا در بستن پوزیشن در صرافی XT' };
  } catch (err: any) {
    return { success: false, error: err.message || 'خطای شبکه در اتصال به صرافی' };
  }
}

/**
 * Close All Open Positions on XT Futures via native exchange endpoint (/future/user/v1/position/close-all)
 */
export async function closeAllXtPositions(): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/xt/position/close-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data?.returnCode === 0 || data?.success) {
      return { success: true, message: data?.message || 'تمام پوزیشن‌ها با موفقیت در صرافی بسته شدند' };
    }
    return { success: false, error: data?.error || data?.msgInfo || 'خطا در بستن تمام پوزیشن‌ها' };
  } catch (err: any) {
    return { success: false, error: err.message || 'خطای شبکه در اتصال به صرافی' };
  }
}

/**
 * Fetch Order History from XT Futures API
 */
export async function fetchXtOrderHistory(symbol?: string, limit: number = 30): Promise<LiveTradeOrder[]> {
  try {
    let query = `?limit=${limit}`;
    if (symbol) query += `&symbol=${encodeURIComponent(toXtSymbol(symbol))}`;
    const res = await fetch(`/api/xt/orders/history${query}`);
    const data = await res.json();

    const items = data?.result?.items || data?.result || [];
    if (Array.isArray(items)) {
      return items.map((item: any) => {
        const side = (item.orderSide || 'BUY').toUpperCase() as 'BUY' | 'SELL';
        const posSide = (item.positionSide || (side === 'BUY' ? 'LONG' : 'SHORT')).toUpperCase() as 'LONG' | 'SHORT';
        return {
          id: String(item.orderId || item.id || Date.now()),
          orderId: String(item.orderId || ''),
          clientOrderId: item.clientOrderId || undefined,
          exchange: 'xt',
          symbol: item.symbol || 'btc_usdt',
          side,
          positionSide: posSide,
          orderType: (item.orderType || 'MARKET').toUpperCase() as 'MARKET' | 'LIMIT',
          price: parseFloat(item.avgPrice && parseFloat(item.avgPrice) > 0 ? item.avgPrice : (item.price || '0')),
          amount: parseFloat(item.origQty || item.executedQty || '0'),
          status: (item.state === 'FILLED' ? 'FILLED' : item.state === 'CANCELED' ? 'CANCELED' : 'NEW'),
          strategyName: 'ZigZag Strategy',
          takeProfitPrice: item.triggerProfitPrice ? parseFloat(item.triggerProfitPrice) : undefined,
          stopLossPrice: item.triggerStopPrice ? parseFloat(item.triggerStopPrice) : undefined,
          realizedPnl: item.closeProfit ? parseFloat(item.closeProfit) : undefined,
          timestamp: item.createdTime ? new Date(item.createdTime).toLocaleTimeString('fa-IR') : new Date().toLocaleTimeString('fa-IR'),
        };
      });
    }
  } catch (err) {
    console.warn('Failed to fetch XT order history', err);
  }

  return [];
}

/**
 * Create Live Order on XT Futures
 */
export async function createXtOrder(params: XtOrderParams): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const res = await fetch('/api/xt/order/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (data?.returnCode === 0) {
      return { success: true, orderId: data?.result?.orderId || String(data?.result) };
    }

    return {
      success: false,
      error: data?.msgInfo || data?.error || 'خطا در ثبت سفارش صرافی XT',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'خطای شبکه در اتصال به XT' };
  }
}

/**
 * Cancel Order on XT Futures
 */
export async function cancelXtOrder(orderId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/xt/order/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    return data?.returnCode === 0;
  } catch {
    return false;
  }
}

/**
 * Fetch XT Market Pairs (all >760 active pairs)
 */
export async function fetchXtPairs(): Promise<CryptoPair[]> {
  try {
    const res = await fetch('/api/market/pairs?exchange=xt');
    const data = await res.json();
    if (data?.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
      return data.pairs;
    }
  } catch (err) {
    console.warn('Failed to fetch XT pairs via server, using fallback', err);
  }

  return [
    { symbol: 'btc_usdt', baseAsset: 'BTC', quoteAsset: 'USDT', name: 'BTC/USDT', category: 'Futures', volume24h: 1200000000 },
    { symbol: 'eth_usdt', baseAsset: 'ETH', quoteAsset: 'USDT', name: 'ETH/USDT', category: 'Futures', volume24h: 800000000 },
    { symbol: 'sol_usdt', baseAsset: 'SOL', quoteAsset: 'USDT', name: 'SOL/USDT', category: 'Futures', volume24h: 400000000 },
    { symbol: 'xrp_usdt', baseAsset: 'XRP', quoteAsset: 'USDT', name: 'XRP/USDT', category: 'Futures', volume24h: 300000000 },
    { symbol: 'doge_usdt', baseAsset: 'DOGE', quoteAsset: 'USDT', name: 'DOGE/USDT', category: 'Futures', volume24h: 200000000 },
  ];
}

/**
 * Fetch Klines for XT Futures Symbol
 */
export async function fetchXtKlines(
  symbol: string,
  timeframe: Timeframe = '5m',
  limit: number = 1000
): Promise<CandleData[]> {
  const xtSymbol = toXtSymbol(symbol);
  try {
    const res = await fetch(`/api/market/klines?exchange=xt&symbol=${encodeURIComponent(xtSymbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`);
    const data = await res.json();
    if (data?.success && Array.isArray(data.candles) && data.candles.length > 0) {
      return data.candles;
    }
  } catch (err) {
    console.warn('Failed to fetch XT klines via server', err);
  }

  // Direct fetch fallback if needed
  try {
    const res = await fetch(`https://fapi.xt.com/future/market/v1/public/q/kline?symbol=${xtSymbol}&interval=${timeframe}&limit=${limit}`);
    const data = await res.json();
    if (data?.result && Array.isArray(data.result)) {
      return data.result.map((item: any) => ({
        time: Math.floor(Number(item.t) / 1000),
        open: parseFloat(item.o),
        high: parseFloat(item.h),
        low: parseFloat(item.l),
        close: parseFloat(item.c),
        volume: parseFloat(item.v || item.a || '0'),
        quoteVolume: parseFloat(item.v || '0'),
        trades: Number(item.a || 0),
      })).sort((a: CandleData, b: CandleData) => a.time - b.time);
    }
  } catch {}

  return [];
}

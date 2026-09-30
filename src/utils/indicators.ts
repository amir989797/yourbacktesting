import { CandleData, VolumeData } from '../types/crypto';

/**
 * Format price according to its magnitude (e.g. BTC vs PEPE)
 */
export function formatPrice(price: number): string {
  if (isNaN(price) || price === null || price === undefined) return '0.00';
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (price >= 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else if (price >= 0.001) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  } else {
    return price.toFixed(8);
  }
}

/**
 * Format points value
 */
export function formatPoints(points: number): string {
  if (isNaN(points) || points === null || points === undefined) return '0.00';
  if (Math.abs(points) >= 1000) {
    return points.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (Math.abs(points) >= 1) {
    return points.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else if (Math.abs(points) >= 0.001) {
    return points.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  } else {
    return points.toFixed(8);
  }
}

/**
 * Format volume in readable K, M, B
 */
export function formatVolume(vol: number): string {
  if (isNaN(vol) || vol === null || vol === undefined) return '0';
  if (vol >= 1_000_000_000) {
    return (vol / 1_000_000_000).toFixed(2) + 'B';
  } else if (vol >= 1_000_000) {
    return (vol / 1_000_000).toFixed(2) + 'M';
  } else if (vol >= 1_000) {
    return (vol / 1_000).toFixed(2) + 'K';
  }
  return vol.toFixed(2);
}

/**
 * Format timestamp to localized readable string
 */
export function formatTimestamp(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  return d.toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Convert candles to volume series data
 */
export function prepareVolumeData(candles: CandleData[]): VolumeData[] {
  return candles.map((c) => {
    const isUp = c.close >= c.open;
    return {
      time: c.time,
      value: c.volume,
      // #0ecb81 (Binance green) with opacity, #f6465d (Binance red) with opacity
      color: isUp ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)',
    };
  });
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(candles: CandleData[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }

  result.push({
    time: candles[period - 1].time,
    value: Number((sum / period).toFixed(6)),
  });

  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close;
    result.push({
      time: candles[i].time,
      value: Number((sum / period).toFixed(6)),
    });
  }

  return result;
}

/**
 * Calculate Average True Range (ATR) with Wilder's Smoothing
 * Exactly matches standard TradingView ATR indicator
 */
export function calculateATR(
  candles: CandleData[],
  period: number = 55
): {
  currentATR: number;
  twoATR: number;
  threeATR: number;
  series: { time: number; value: number }[];
  atrValues: number[];
  atrMap: Map<number, number>;
} {
  const n = candles.length;
  const map = new Map<number, number>();
  if (n === 0) {
    return {
      currentATR: 0,
      twoATR: 0,
      threeATR: 0,
      series: [],
      atrValues: [],
      atrMap: map,
    };
  }

  // 1. Calculate True Range for every candle
  const trs: number[] = new Array(n);
  trs[0] = Math.max(0, candles[0].high - candles[0].low);

  for (let i = 1; i < n; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs[i] = tr;
  }

  // 2. Wilder's RMA Smoothing across all candles
  const atrValues: number[] = new Array(n);
  const series: { time: number; value: number }[] = [];

  let runningAtr = trs[0];
  atrValues[0] = runningAtr;
  map.set(candles[0].time, runningAtr);
  series.push({ time: candles[0].time, value: runningAtr });

  let sum = trs[0];
  for (let i = 1; i < n; i++) {
    if (i < period) {
      sum += trs[i];
      runningAtr = sum / (i + 1);
    } else if (i === period) {
      sum += trs[i];
      runningAtr = sum / period;
    } else {
      // Standard Wilder RMA formula: (previousATR * (period - 1) + currentTR) / period
      runningAtr = (runningAtr * (period - 1) + trs[i]) / period;
    }
    atrValues[i] = runningAtr;
    map.set(candles[i].time, runningAtr);
    series.push({ time: candles[i].time, value: runningAtr });
  }

  const latest = atrValues[n - 1] || 0;

  return {
    currentATR: latest,
    twoATR: latest * 2,
    threeATR: latest * 3,
    series,
    atrValues,
    atrMap: map,
  };
}

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

export interface ZigZagPoint {
  time: number;
  value: number;
  type: 'high' | 'low';
  atrAtPoint: number;
  legPoints: number;
  legAtrRatio: number;
  candleIndex?: number;
}

/**
 * Calculate ATR-based ZigZag indicator where each leg strictly alternates (High -> Low -> High -> Low)
 * and each leg size is >= threshold (default 3 * ATR55).
 */
export function calculateAtrZigZag(
  candles: CandleData[],
  atrValues: number[],
  atrMultiplier: number = 3
): {
  points: ZigZagPoint[];
  series: { time: number; value: number }[];
} {
  const n = candles.length;
  if (n < 2) return { points: [], series: [] };

  // 1. Establish the initial trend direction
  let trend = 0; // 1 for UP (seeking peak), -1 for DOWN (seeking trough)
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const threshold = ((atrValues && atrValues[i] > 0) ? atrValues[i] : Math.max(0.0001, c.high - c.low)) * atrMultiplier;

    if (c.high - candles[0].low >= threshold) {
      trend = 1;
      startIdx = i;
      break;
    } else if (candles[0].high - c.low >= threshold) {
      trend = -1;
      startIdx = i;
      break;
    }
  }

  if (trend === 0) return { points: [], series: [] };

  const pivots: ZigZagPoint[] = [];
  if (trend === 1) {
    pivots.push({
      time: candles[0].time,
      value: candles[0].low,
      type: 'low',
      atrAtPoint: atrValues[0] || (candles[0].high - candles[0].low),
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  } else {
    pivots.push({
      time: candles[0].time,
      value: candles[0].high,
      type: 'high',
      atrAtPoint: atrValues[0] || (candles[0].high - candles[0].low),
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  }

  let curExtremeVal = trend === 1 ? candles[startIdx].high : candles[startIdx].low;
  let curExtremeIdx = startIdx;

  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const th = ((atrValues && atrValues[i] > 0) ? atrValues[i] : Math.max(0.0001, c.high - c.low)) * atrMultiplier;
    const lastPivot = pivots[pivots.length - 1];

    if (trend === 1) {
      // In UP leg: extend peak to highest high
      if (curExtremeIdx <= (lastPivot.candleIndex ?? 0)) {
        curExtremeVal = c.high;
        curExtremeIdx = i;
      } else if (c.high > curExtremeVal) {
        curExtremeVal = c.high;
        curExtremeIdx = i;
      }

      // Reversal down confirmed when price drops by threshold from peak
      if (curExtremeIdx > (lastPivot.candleIndex ?? 0) && curExtremeVal - c.low >= th) {
        const confirmedPeakIdx = curExtremeIdx;
        const diff = curExtremeVal - lastPivot.value;
        const peakAtr = (atrValues && atrValues[confirmedPeakIdx] > 0) ? atrValues[confirmedPeakIdx] : th / atrMultiplier;

        pivots.push({
          time: candles[confirmedPeakIdx].time,
          value: curExtremeVal,
          type: 'high',
          candleIndex: confirmedPeakIdx,
          atrAtPoint: peakAtr,
          legPoints: diff,
          legAtrRatio: peakAtr > 0 ? diff / peakAtr : 0,
        });

        // Switch to DOWN leg: search for lowest low among candles strictly AFTER confirmedPeakIdx
        trend = -1;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        for (let k = confirmedPeakIdx + 1; k <= i; k++) {
          if (candles[k].low < curExtremeVal) {
            curExtremeVal = candles[k].low;
            curExtremeIdx = k;
          }
        }
      }
    } else {
      // In DOWN leg: extend trough to lowest low
      if (curExtremeIdx <= (lastPivot.candleIndex ?? 0)) {
        curExtremeVal = c.low;
        curExtremeIdx = i;
      } else if (c.low < curExtremeVal) {
        curExtremeVal = c.low;
        curExtremeIdx = i;
      }

      // Reversal up confirmed when price rises by threshold from trough
      if (curExtremeIdx > (lastPivot.candleIndex ?? 0) && c.high - curExtremeVal >= th) {
        const confirmedTroughIdx = curExtremeIdx;
        const diff = lastPivot.value - curExtremeVal;
        const troughAtr = (atrValues && atrValues[confirmedTroughIdx] > 0) ? atrValues[confirmedTroughIdx] : th / atrMultiplier;

        pivots.push({
          time: candles[confirmedTroughIdx].time,
          value: curExtremeVal,
          type: 'low',
          candleIndex: confirmedTroughIdx,
          atrAtPoint: troughAtr,
          legPoints: diff,
          legAtrRatio: troughAtr > 0 ? diff / troughAtr : 0,
        });

        // Switch to UP leg: search for highest high among candles strictly AFTER confirmedTroughIdx
        trend = 1;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        for (let k = confirmedTroughIdx + 1; k <= i; k++) {
          if (candles[k].high > curExtremeVal) {
            curExtremeVal = candles[k].high;
            curExtremeIdx = k;
          }
        }
      }
    }
  }

  // Active ongoing leg up to the latest extreme
  const lastPivot = pivots[pivots.length - 1];
  if (curExtremeIdx > (lastPivot.candleIndex ?? 0)) {
    const diff = Math.abs(curExtremeVal - lastPivot.value);
    const lastAtr = (atrValues && atrValues[curExtremeIdx] > 0) ? atrValues[curExtremeIdx] : 1;
    pivots.push({
      time: candles[curExtremeIdx].time,
      value: curExtremeVal,
      type: trend === 1 ? 'high' : 'low',
      candleIndex: curExtremeIdx,
      atrAtPoint: lastAtr,
      legPoints: diff,
      legAtrRatio: lastAtr > 0 ? diff / lastAtr : 0,
    });
  }

  // Final check to guarantee strictly increasing time and alternating types
  const cleanPivots: ZigZagPoint[] = [];
  for (const p of pivots) {
    if (cleanPivots.length === 0) {
      cleanPivots.push(p);
    } else {
      const prev = cleanPivots[cleanPivots.length - 1];
      if ((p.candleIndex ?? 0) > (prev.candleIndex ?? 0) && p.type !== prev.type) {
        cleanPivots.push(p);
      }
    }
  }

  const series = cleanPivots.map((p) => ({
    time: p.time,
    value: p.value,
  }));

  return { points: cleanPivots, series };
}

export interface ZigZagLeg {
  index: number;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  isUp: boolean;
  legPoints: number;
  legAtrRatio: number;
  candleCount: number;
  color: 'white' | 'green' | 'red' | 'blue' | 'dark_blue';
  isGiantLeg?: boolean;
  breaksGiantLegIndex?: number;
}

/**
 * Classifies ZigZag legs based on:
 * 1. Giant leg > 1000% of ATR (>= 10 * ATR) AND > 20 candles:
 *    - Bold Green for bullish (صعودی)
 *    - Bold Red for bearish (نزولی)
 * 2. First subsequent leg that breaks the end of a red/green leg AND is < 5 ATR: Bright Blue (آبی روشن)
 * 3. ONLY the 2nd leg after the blue leg (B+2): If it breaks the end of the blue leg and is in the same direction,
 *    color it Darker Blue (آبی تیره‌تر).
 * 4. After completing this sequence, wait until conditions for a new Red or Green leg form before repeating.
 * 5. All other legs: White (سفید)
 */
export function analyzeZigZagLegs(points: ZigZagPoint[]): ZigZagLeg[] {
  if (points.length < 2) return [];

  const legs: ZigZagLeg[] = [];

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const isUp = end.type === 'high';
    const ratio = end.legAtrRatio;

    const startCandleIdx = start.candleIndex ?? (i - 1);
    const endCandleIdx = end.candleIndex ?? i;
    const candleCount = Math.max(1, Math.abs(endCandleIdx - startCandleIdx));

    let color: 'white' | 'green' | 'red' | 'blue' | 'dark_blue' = 'white';
    let isGiant = false;

    // Condition: Leg > 1000% (ratio >= 10) AND > 20 candles (لگ سبز و قرمز باید بیشتر از ۲۰ کندل باشند)
    if (ratio >= 10 && candleCount > 20) {
      isGiant = true;
      color = isUp ? 'green' : 'red';
    }

    legs.push({
      index: i - 1,
      startIndex: i - 1,
      endIndex: i,
      startTime: start.time,
      endTime: end.time,
      startPrice: start.value,
      endPrice: end.value,
      isUp,
      legPoints: end.legPoints,
      legAtrRatio: ratio,
      candleCount,
      color,
      isGiantLeg: isGiant,
    });
  }

  // Sequential cycle detection:
  // Step 1: Find next giant leg (Green/Red)
  // Step 2: Find first breaking leg < 5 ATR -> color 'blue'
  // Step 3: ONLY the 2nd leg after blue leg (B+2) -> if breaks end of B and same direction -> color 'dark_blue'
  // Step 4: Wait until conditions for a new Red/Green leg form before repeating!
  let searchIdx = 0;
  while (searchIdx < legs.length) {
    let giantIdx = -1;
    for (let i = searchIdx; i < legs.length; i++) {
      if (legs[i].isGiantLeg) {
        giantIdx = i;
        break;
      }
    }

    if (giantIdx === -1) break; // No more giant legs

    const giant = legs[giantIdx];
    const targetPrice = giant.endPrice;

    let blueIdx = -1;
    for (let f = giantIdx + 1; f < legs.length; f++) {
      // If a newer giant leg forms before any qualifying blue leg, pivot to the newer giant leg
      if (legs[f].isGiantLeg) {
        giantIdx = f;
        break;
      }

      const leg = legs[f];
      let broke = false;
      if (giant.isUp) {
        if (Math.max(leg.startPrice, leg.endPrice) > targetPrice) broke = true;
      } else {
        if (Math.min(leg.startPrice, leg.endPrice) < targetPrice) broke = true;
      }

      if (broke && leg.legAtrRatio < 5) {
        leg.color = 'blue';
        leg.breaksGiantLegIndex = giant.index;
        blueIdx = f;
        break;
      }
    }

    if (blueIdx !== -1) {
      // Check ONLY the 2nd leg after the blue leg (blueIdx + 2)
      const b2Index = blueIdx + 2;
      let nextSearch = blueIdx + 1;

      if (b2Index < legs.length) {
        const b2 = legs[b2Index];
        const blueLeg = legs[blueIdx];

        // Must be in the same direction as the blue leg and not a giant leg
        if (b2.isUp === blueLeg.isUp && !b2.isGiantLeg) {
          let brokeEnd = false;
          if (blueLeg.isUp) {
            // Blue leg was UP (ended at High). Does b2 break the blue leg's High?
            if (b2.endPrice > blueLeg.endPrice) {
              brokeEnd = true;
            }
          } else {
            // Blue leg was DOWN (ended at Low). Does b2 break the blue leg's Low?
            if (b2.endPrice < blueLeg.endPrice) {
              brokeEnd = true;
            }
          }

          if (brokeEnd) {
            b2.color = 'dark_blue';
            nextSearch = b2Index + 1;
          }
        }
      }

      // Wait until next giant leg forms!
      searchIdx = nextSearch;
    } else {
      searchIdx = giantIdx + 1;
    }
  }

  return legs;
}


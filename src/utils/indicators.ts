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
  label?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
}

/**
 * Calculate ATR-based ZigZag indicator where each leg strictly alternates (High -> Low -> High -> Low)
 * and each leg size is >= threshold (default 3 * ATR55).
 */
export function calculateAtrZigZag(
  candles: CandleData[],
  atrValues: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
): {
  points: ZigZagPoint[];
  series: { time: number; value: number }[];
} {
  const n = candles.length;
  if (n < 2) return { points: [], series: [] };

  const effectiveMinCandles = Math.max(1, minCandles);

  // 1. Establish the initial trend direction (requires >= effectiveMinCandles and >= 3 ATR)
  let trend = 0; // 1 for UP (seeking peak), -1 for DOWN (seeking trough)
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const atr = (atrValues && atrValues[i] > 0) ? atrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * atrMultiplier;

    if (i >= effectiveMinCandles) {
      if (c.high - candles[0].low >= th) {
        trend = 1;
        startIdx = i;
        break;
      } else if (candles[0].high - c.low >= th) {
        trend = -1;
        startIdx = i;
        break;
      }
    }
  }

  if (trend === 0) return { points: [], series: [] };

  const rawPivots: ZigZagPoint[] = [];
  if (trend === 1) {
    rawPivots.push({
      time: candles[0].time,
      value: candles[0].low,
      type: 'low',
      atrAtPoint: atrValues[0] || (candles[0].high - candles[0].low),
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  } else {
    rawPivots.push({
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
    const atr = (atrValues && atrValues[i] > 0) ? atrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * atrMultiplier;
    const lastPivot = rawPivots[rawPivots.length - 1];

    if (trend === 1) {
      // Last confirmed is LOW. Searching for HIGH.
      // If price drops below last confirmed low before finding valid high:
      if (c.low < lastPivot.value) {
        lastPivot.value = c.low;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        continue;
      }

      if (c.high > curExtremeVal) {
        curExtremeVal = c.high;
        curExtremeIdx = i;
      }

      const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
      const priceDist = curExtremeVal - lastPivot.value;
      const peakAtr = (atrValues && atrValues[curExtremeIdx] > 0) ? atrValues[curExtremeIdx] : atr;

      // Both conditions: >= effectiveMinCandles AND >= atrMultiplier * ATR distance, plus reversal pull-back
      if (candleDist >= effectiveMinCandles && priceDist >= atrMultiplier * peakAtr && curExtremeVal - c.low >= th) {
        const confirmedPeakIdx = curExtremeIdx;
        rawPivots.push({
          time: candles[confirmedPeakIdx].time,
          value: curExtremeVal,
          type: 'high',
          candleIndex: confirmedPeakIdx,
          atrAtPoint: peakAtr,
          legPoints: priceDist,
          legAtrRatio: peakAtr > 0 ? priceDist / peakAtr : 0,
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
      // Last confirmed is HIGH. Searching for LOW.
      // If price rises above last confirmed high before finding valid low:
      if (c.high > lastPivot.value) {
        lastPivot.value = c.high;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        continue;
      }

      if (c.low < curExtremeVal) {
        curExtremeVal = c.low;
        curExtremeIdx = i;
      }

      const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
      const priceDist = lastPivot.value - curExtremeVal;
      const troughAtr = (atrValues && atrValues[curExtremeIdx] > 0) ? atrValues[curExtremeIdx] : atr;

      // Both conditions: >= effectiveMinCandles AND >= atrMultiplier * ATR distance, plus reversal pull-back
      if (candleDist >= effectiveMinCandles && priceDist >= atrMultiplier * troughAtr && c.high - curExtremeVal >= th) {
        const confirmedTroughIdx = curExtremeIdx;
        rawPivots.push({
          time: candles[confirmedTroughIdx].time,
          value: curExtremeVal,
          type: 'low',
          candleIndex: confirmedTroughIdx,
          atrAtPoint: troughAtr,
          legPoints: priceDist,
          legAtrRatio: troughAtr > 0 ? priceDist / troughAtr : 0,
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
  const lastPivot = rawPivots[rawPivots.length - 1];
  if (curExtremeIdx > (lastPivot.candleIndex ?? 0)) {
    const diff = Math.abs(curExtremeVal - lastPivot.value);
    const lastAtr = (atrValues && atrValues[curExtremeIdx] > 0) ? atrValues[curExtremeIdx] : 1;
    rawPivots.push({
      time: candles[curExtremeIdx].time,
      value: curExtremeVal,
      type: trend === 1 ? 'high' : 'low',
      candleIndex: curExtremeIdx,
      atrAtPoint: lastAtr,
      legPoints: diff,
      legAtrRatio: lastAtr > 0 ? diff / lastAtr : 0,
    });
  }

  // Post-filter: Strict guarantee that EVERY leg between any two consecutive points
  // has AT LEAST effectiveMinCandles distance AND AT LEAST atrMultiplier * ATR distance.
  let pivots = [...rawPivots];
  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    const next: ZigZagPoint[] = [];

    for (let i = 0; i < pivots.length; i++) {
      if (next.length >= 2) {
        const pPrev2 = next[next.length - 2];
        const pPrev1 = next[next.length - 1];
        const pCurr = pivots[i];

        const cDist = (pCurr.candleIndex ?? 0) - (pPrev1.candleIndex ?? 0);
        const pDist = Math.abs(pCurr.value - pPrev1.value);
        const refAtr = (atrValues && atrValues[pCurr.candleIndex ?? 0] > 0) ? atrValues[pCurr.candleIndex ?? 0] : 1;
        const pRatio = pDist / refAtr;

        // If leg between pPrev1 and pCurr violates either rule (< effectiveMinCandles or < atrMultiplier ATR):
        if (cDist < effectiveMinCandles || pRatio < (atrMultiplier - 0.01)) {
          if (pCurr.type === pPrev2.type) {
            if (pCurr.type === 'high' && pCurr.value >= pPrev2.value) {
              next.pop(); // remove pPrev1
              next.pop(); // remove pPrev2
              next.push(pCurr); // pCurr becomes the higher high
              changed = true;
              continue;
            }
            if (pCurr.type === 'low' && pCurr.value <= pPrev2.value) {
              next.pop(); // remove pPrev1
              next.pop(); // remove pPrev2
              next.push(pCurr); // pCurr becomes the lower low
              changed = true;
              continue;
            }
          }
        }
      }
      next.push(pivots[i]);
    }
    pivots = next;
  }

  // Final check to guarantee strictly increasing time and alternating types
  const cleanPivots: ZigZagPoint[] = [];
  for (const p of pivots) {
    if (cleanPivots.length === 0) {
      cleanPivots.push(p);
    } else {
      const prev = cleanPivots[cleanPivots.length - 1];
      if (p.type === prev.type) {
        // If same type occurs in succession, keep the more extreme point
        if (p.type === 'high' && p.value > prev.value) {
          cleanPivots[cleanPivots.length - 1] = p;
        } else if (p.type === 'low' && p.value < prev.value) {
          cleanPivots[cleanPivots.length - 1] = p;
        }
      } else if ((p.candleIndex ?? 0) > (prev.candleIndex ?? 0)) {
        cleanPivots.push(p);
      }
    }
  }

  // Recalculate metrics accurately
  for (let i = 1; i < cleanPivots.length; i++) {
    const prev = cleanPivots[i - 1];
    const curr = cleanPivots[i];
    const diff = Math.abs(curr.value - prev.value);
    const cIdx = curr.candleIndex ?? 0;
    const atr = (atrValues && atrValues[cIdx] > 0) ? atrValues[cIdx] : 1;
    curr.atrAtPoint = atr;
    curr.legPoints = diff;
    curr.legAtrRatio = atr > 0 ? diff / atr : 0;
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
  startLabel?: 'A' | 'C' | 'E';
  endLabel?: 'B' | 'D' | 'F';
  cycleGiantLegIndex?: number;
  cyclePointAPrice?: number;
  cyclePointATime?: number;
}

/**
 * Classifies ZigZag legs based on user rules:
 * 1. Giant leg > 1000% of ATR (>= 10 * ATR) AND > 20 candles:
 *    - Bold Green for bullish (صعودی)
 *    - Bold Red for bearish (نزولی)
 * 2. آبی کم‌رنگ (Light Blue):
 *    - لگ دوم بعد از سبز یا قرمز (G + 2) است که انتهای لگ سبز یا قرمز را شکسته باشد.
 * 3. آبی پررنگ (Dark Blue):
 *    - لگ دوم بعد از آبی کم‌رنگ (B + 2) است که انتهای آن‌را شکسته باشد.
 * 4. سپس تا شرایط تشکیل قرمز یا سبز مجدد صبر کن.
 * 5. سایر لگ‌ها: سفید (White)
 */
export function analyzeZigZagLegs(
  points: ZigZagPoint[],
  minCandlesForLongLeg: number = 20,
  longLegAtrMultiplier: number = 10,
  maxBlueLegPercent: number = 60,
  maxBreakoutAtrMultiplier: number = 5
): ZigZagLeg[] {
  if (points.length < 2) return [];

  const legs: ZigZagLeg[] = [];
  const minLongCandles = Math.max(1, minCandlesForLongLeg);
  const minLongRatio = Math.max(0.1, longLegAtrMultiplier);
  const maxBlueRatio = Math.max(0.01, (maxBlueLegPercent || 60) / 100);
  const maxBreakoutMult = Math.max(0.1, maxBreakoutAtrMultiplier || 5);

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

    // Condition: Leg >= minLongRatio * ATR AND >= minLongCandles candles (لگ سبز و قرمز بلند)
    if (ratio >= minLongRatio && candleCount >= minLongCandles) {
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
  // Step 1: Find next giant leg (Green/Red: >= 10 ATR and > 20 candles) -> Label start: A, end: B
  // Step 2: آبی کم‌رنگ: لگ دوم یا چهارم بعد از سبز یا قرمز که انتهای آن‌را شکسته باشد -> Label start: C, end: D
  // Step 3: آبی پررنگ: لگ دوم یا چهارم بعد از آبی کم‌رنگ که انتهای آن‌را شکسته باشد -> Label start: E, end: F
  // Step 4: پس از این چرخه، تا شرایط تشکیل قرمز یا سبز مجدد صبر کن
  for (const p of points) {
    p.label = undefined;
  }

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
    const cycleGiantLegIndex = giant.index;
    const cyclePointAPrice = giant.startPrice;
    const cyclePointATime = giant.startTime;

    // شرط محدودیت درصدی برای لگ های آبی (پیش‌فرض ۶۰٪ pts لگ قرمز یا سبز)
    const maxBluePts = maxBlueRatio * giant.legPoints;

    // Label giant leg: Start = A, End = B
    points[giant.startIndex].label = 'A';
    points[giant.endIndex].label = 'B';
    giant.startLabel = 'A';
    giant.endLabel = 'B';
    giant.cycleGiantLegIndex = cycleGiantLegIndex;
    giant.cyclePointAPrice = cyclePointAPrice;
    giant.cyclePointATime = cyclePointATime;

    // آبی کم‌رنگ: دقیقاً لگ دوم بعد از سبز یا قرمز (giantIdx + 2)
    const g2Index = giantIdx + 2;
    let blueIdx = -1;

    if (g2Index < legs.length) {
      const g2 = legs[g2Index];

      // بررسی شکست انتهای لگ سبز یا قرمز توسط لگ دوم (نباید بیش از maxBreakoutMult برابر ATR از قیمت شکست عبور کند)
      let brokeGiant = false;
      let breakoutDist = 0;
      if (giant.isUp) {
        // لگ سبز صعودی است و در سقف (targetPrice) تمام شده؛ لگ دوم باید بالاتر از این سقف برود
        if (g2.endPrice > targetPrice) {
          brokeGiant = true;
          breakoutDist = g2.endPrice - targetPrice;
        }
      } else {
        // لگ قرمز نزولی است و در کف (targetPrice) تمام شده؛ لگ دوم باید پایین‌تر از این کف برود
        if (g2.endPrice < targetPrice) {
          brokeGiant = true;
          breakoutDist = targetPrice - g2.endPrice;
        }
      }

      // شرط سقف نفوذ: فاصله عبور از نقطه شکست نباید بیشتر از maxBreakoutMult برابر ATR باشد
      const refAtrG2 = points[g2.endIndex]?.atrAtPoint || points[giant.endIndex]?.atrAtPoint || 1;
      const within5AtrG2 = breakoutDist <= maxBreakoutMult * refAtrG2;
      // شرط محدودیت درصدی (پیش‌فرض ۶۰ درصد): اندازه لگ آبی باید کمتر از maxBluePts باشد
      const isUnder60PctG2 = g2.legPoints < maxBluePts;

      if (brokeGiant && within5AtrG2 && isUnder60PctG2 && !g2.isGiantLeg) {
        g2.color = 'blue';
        g2.breaksGiantLegIndex = giant.index;
        g2.cycleGiantLegIndex = cycleGiantLegIndex;
        g2.cyclePointAPrice = cyclePointAPrice;
        g2.cyclePointATime = cyclePointATime;
        blueIdx = g2Index;
        points[g2.startIndex].label = 'C';
        points[g2.endIndex].label = 'D';
        g2.startLabel = 'C';
        g2.endLabel = 'D';
      }
    }

    // اگر لگ دوم (G+2) برک‌اوت نکرد، بررسی لگ چهارم (G+4) پس از سبز یا قرمز:
    if (blueIdx === -1) {
      const g4Index = giantIdx + 4;
      if (g4Index < legs.length) {
        const hasInterGiant = legs.slice(giantIdx + 1, g4Index).some((l) => l.isGiantLeg);
        if (!hasInterGiant) {
          const g4 = legs[g4Index];
          let brokeGiant4 = false;
          let breakoutDist4 = 0;
          if (giant.isUp) {
            if (g4.endPrice > targetPrice) {
              brokeGiant4 = true;
              breakoutDist4 = g4.endPrice - targetPrice;
            }
          } else {
            if (g4.endPrice < targetPrice) {
              brokeGiant4 = true;
              breakoutDist4 = targetPrice - g4.endPrice;
            }
          }

          const refAtrG4 = points[g4.endIndex]?.atrAtPoint || points[giant.endIndex]?.atrAtPoint || 1;
          const within5AtrG4 = breakoutDist4 <= maxBreakoutMult * refAtrG4;
          const isUnder60PctG4 = g4.legPoints < maxBluePts;

          if (brokeGiant4 && within5AtrG4 && isUnder60PctG4 && !g4.isGiantLeg) {
            g4.color = 'blue';
            g4.breaksGiantLegIndex = giant.index;
            g4.cycleGiantLegIndex = cycleGiantLegIndex;
            g4.cyclePointAPrice = cyclePointAPrice;
            g4.cyclePointATime = cyclePointATime;
            blueIdx = g4Index;
            points[g4.startIndex].label = 'C';
            points[g4.endIndex].label = 'D';
            g4.startLabel = 'C';
            g4.endLabel = 'D';
          }
        }
      }
    }

    // آبی پررنگ: لگ دوم بعد از آبی کم‌رنگ (blueIdx + 2) یا در صورت عدم شکست، لگ چهارم (blueIdx + 4)
    if (blueIdx !== -1) {
      const b2Index = blueIdx + 2;
      let nextSearch = blueIdx + 1;
      let darkBlueIdx = -1;

      if (b2Index < legs.length) {
        const b2 = legs[b2Index];
        const blueLeg = legs[blueIdx];

        let brokeBlue = false;
        let breakoutDistB2 = 0;
        if (blueLeg.isUp) {
          // آبی کم‌رنگ صعودی است؛ لگ دوم بعد از آن باید بالاتر از سقف آن برود
          if (b2.endPrice > blueLeg.endPrice) {
            brokeBlue = true;
            breakoutDistB2 = b2.endPrice - blueLeg.endPrice;
          }
        } else {
          // آبی کم‌رنگ نزولی است؛ لگ دوم بعد از آن باید پایین‌تر از کف آن برود
          if (b2.endPrice < blueLeg.endPrice) {
            brokeBlue = true;
            breakoutDistB2 = blueLeg.endPrice - b2.endPrice;
          }
        }

        // شرط سقف نفوذ: نباید بیش از maxBreakoutMult برابر ATR از قیمت شکست عبور کند
        const refAtrB2 = points[b2.endIndex]?.atrAtPoint || points[blueLeg.endIndex]?.atrAtPoint || 1;
        const within5AtrB2 = breakoutDistB2 <= maxBreakoutMult * refAtrB2;
        // شرط محدودیت درصدی: اندازه لگ آبی پررنگ نیز باید کمتر از maxBluePts باشد
        const isUnder60PctB2 = b2.legPoints < maxBluePts;

        if (brokeBlue && within5AtrB2 && isUnder60PctB2 && !b2.isGiantLeg) {
          b2.color = 'dark_blue';
          b2.cycleGiantLegIndex = cycleGiantLegIndex;
          b2.cyclePointAPrice = cyclePointAPrice;
          b2.cyclePointATime = cyclePointATime;
          darkBlueIdx = b2Index;
          nextSearch = b2Index + 1;
          points[b2.startIndex].label = 'E';
          points[b2.endIndex].label = 'F';
          b2.startLabel = 'E';
          b2.endLabel = 'F';
        }
      }

      // اگر لگ دوم بعد از آبی برک‌اوت نکرد، بررسی لگ چهارم (B+4):
      if (darkBlueIdx === -1) {
        const b4Index = blueIdx + 4;
        if (b4Index < legs.length) {
          const hasInterGiant = legs.slice(blueIdx + 1, b4Index).some((l) => l.isGiantLeg);
          if (!hasInterGiant) {
            const b4 = legs[b4Index];
            const blueLeg = legs[blueIdx];

            let brokeBlue4 = false;
            let breakoutDistB4 = 0;
            if (blueLeg.isUp) {
              if (b4.endPrice > blueLeg.endPrice) {
                brokeBlue4 = true;
                breakoutDistB4 = b4.endPrice - blueLeg.endPrice;
              }
            } else {
              if (b4.endPrice < blueLeg.endPrice) {
                brokeBlue4 = true;
                breakoutDistB4 = blueLeg.endPrice - b4.endPrice;
              }
            }

            const refAtrB4 = points[b4.endIndex]?.atrAtPoint || points[blueLeg.endIndex]?.atrAtPoint || 1;
            const within5AtrB4 = breakoutDistB4 <= maxBreakoutMult * refAtrB4;
            const isUnder60PctB4 = b4.legPoints < maxBluePts;

            if (brokeBlue4 && within5AtrB4 && isUnder60PctB4 && !b4.isGiantLeg) {
              b4.color = 'dark_blue';
              b4.cycleGiantLegIndex = cycleGiantLegIndex;
              b4.cyclePointAPrice = cyclePointAPrice;
              b4.cyclePointATime = cyclePointATime;
              nextSearch = b4Index + 1;
              points[b4.startIndex].label = 'E';
              points[b4.endIndex].label = 'F';
              b4.startLabel = 'E';
              b4.endLabel = 'F';
            }
          }
        }
      }

      // تا شرایط تشکیل قرمز یا سبز مجدد صبر کن
      searchIdx = nextSearch;
    } else {
      searchIdx = giantIdx + 1;
    }
  }

  return legs;
}


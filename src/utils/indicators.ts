import { CandleData, Leg, ZigZagPoint } from '../types/crypto.ts';

export function calculateATR(candles: CandleData[], period: number = 14): { atrValues: number[]; currentATR: number } {
  if (candles.length < 2) {
    return { atrValues: candles.map(() => 0), currentATR: 0 };
  }

  const trValues: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trValues.push(tr);
  }

  const atrValues: number[] = [];
  let sum = 0;
  for (let i = 0; i < trValues.length; i++) {
    sum += trValues[i];
    if (i >= period) {
      sum -= trValues[i - period];
      atrValues.push(sum / period);
    } else {
      atrValues.push(sum / (i + 1));
    }
  }

  return {
    atrValues,
    currentATR: atrValues[atrValues.length - 1] || 0,
  };
}

export function calculateZigZag(
  candles: CandleData[],
  atrValues: number[],
  atrMultiplier: number = 2.0,
  minCandles: number = 3
): { points: ZigZagPoint[] } {
  if (candles.length < 5) return { points: [] };

  const points: ZigZagPoint[] = [];
  let currentTrend: 'UP' | 'DOWN' | null = null;
  let lastPivotPrice = candles[0].close;
  let lastPivotIndex = 0;

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const atr = (atrValues[i] || 1) * atrMultiplier;

    if (currentTrend === null) {
      if (candle.high >= lastPivotPrice + atr) {
        currentTrend = 'UP';
        lastPivotPrice = candle.high;
        lastPivotIndex = i;
        points.push({ index: i, time: candle.time, price: candle.high, type: 'HIGH' });
      } else if (candle.low <= lastPivotPrice - atr) {
        currentTrend = 'DOWN';
        lastPivotPrice = candle.low;
        lastPivotIndex = i;
        points.push({ index: i, time: candle.time, price: candle.low, type: 'LOW' });
      }
    } else if (currentTrend === 'UP') {
      if (candle.high > lastPivotPrice) {
        lastPivotPrice = candle.high;
        lastPivotIndex = i;
        if (points.length > 0) {
          points[points.length - 1] = { index: i, time: candle.time, price: candle.high, type: 'HIGH' };
        }
      } else if (candle.low <= lastPivotPrice - atr && i - lastPivotIndex >= minCandles) {
        currentTrend = 'DOWN';
        lastPivotPrice = candle.low;
        lastPivotIndex = i;
        points.push({ index: i, time: candle.time, price: candle.low, type: 'LOW' });
      }
    } else if (currentTrend === 'DOWN') {
      if (candle.low < lastPivotPrice) {
        lastPivotPrice = candle.low;
        lastPivotIndex = i;
        if (points.length > 0) {
          points[points.length - 1] = { index: i, time: candle.time, price: candle.low, type: 'LOW' };
        }
      } else if (candle.high >= lastPivotPrice + atr && i - lastPivotIndex >= minCandles) {
        currentTrend = 'UP';
        lastPivotPrice = candle.high;
        lastPivotIndex = i;
        points.push({ index: i, time: candle.time, price: candle.high, type: 'HIGH' });
      }
    }
  }

  return { points };
}

export function classifyLegs(
  points: ZigZagPoint[],
  minCandlesLong: number = 8,
  longLegAtrMult: number = 3.5,
  maxBlueLegPercent: number = 4.0,
  maxBreakoutAtrMultiplier: number = 2.0
): Leg[] {
  const legs: Leg[] = [];
  if (points.length < 2) return legs;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const direction: 'UP' | 'DOWN' = p2.price > p1.price ? 'UP' : 'DOWN';
    const length = Math.abs(p2.price - p1.price);
    const candlesCount = p2.index - p1.index;

    let color: 'BLUE' | 'RED' | 'BLACK' = 'BLACK';
    const percentChange = (length / p1.price) * 100;

    if (candlesCount >= minCandlesLong && percentChange >= longLegAtrMult) {
      color = 'RED'; // Long impulse leg
    } else if (percentChange <= maxBlueLegPercent) {
      color = 'BLUE'; // Short / retracement leg
    }

    legs.push({
      startIndex: p1.index,
      endIndex: p2.index,
      startTime: p1.time,
      endTime: p2.time,
      startPrice: p1.price,
      endPrice: p2.price,
      direction,
      color,
      length,
      candlesCount,
      atrValue: 0,
    });
  }

  return legs;
}

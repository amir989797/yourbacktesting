import { CandleData, Leg, ZigZagPoint as CryptoZigZagPoint } from '../types/crypto.ts';
import { ZigZagLeg, ZigZagPoint, analyzeZigZagLegs, calculateATR, calculateRSI } from './indicators';
import { StrategyConfig, StrategyMetrics, StrategyTrade, TradeStatus, BacktestMetrics, StrategyParams, Trade } from '../types/strategy.ts';
import { calculateExactTradeSizing } from './exchangePrecision.ts';
import {
  extractCausalZigZagEvents,
  getActiveMlModel,
  getTimeframeVolatilityScale,
  normalizeMlFeaturesForTimeframe,
  predictZigZagMlScore,
  type ZigZagMlModel,
} from './zigzagMlEngine.ts';
import './pretrainedZigZagMlModel.ts';

function resolveCausalZigZagParams(
  config: StrategyConfig,
  atrMultiplierArg?: number,
  minCandlesArg?: number
) {
  const atrPeriod = Math.max(2, Number(config.atrPeriod ?? config.optAtrPeriod ?? 17) || 17);
  const atrMultiplier =
    atrMultiplierArg !== undefined && atrMultiplierArg > 0
      ? atrMultiplierArg
      : Number(config.atrMultiplier ?? config.optAtrMultiplier ?? 3) || 3;
  const minCandles = Math.max(
    1,
    minCandlesArg !== undefined && minCandlesArg > 0
      ? minCandlesArg
      : Number(config.minCandles ?? config.optMinCandles ?? 5) || 5
  );
  const minCandlesForLongLeg = Math.max(
    1,
    Number(config.minCandlesForLongLeg ?? config.optMinCandlesLong ?? 12) || 12
  );
  const longLegAtrMultiplier = Math.max(
    0.1,
    Number(config.longLegAtrMultiplier ?? config.optLongLegAtrMult ?? 15) || 15
  );
  const minCandlesForBlueLeg = Math.max(
    1,
    Number(config.minCandlesForBlueLeg ?? config.optMinCandlesBlue ?? 7) || 7
  );
  const blueLegAtrMultiplier = Math.max(
    0.1,
    Number(config.blueLegAtrMultiplier ?? config.optBlueLegAtrMult ?? 4.75) || 4.75
  );
  const maxBlueLegPercent = Math.max(
    1,
    Number(config.maxBlueLegPercent ?? config.optMaxBlueLegPercent ?? 95) || 95
  );
  const maxBreakoutAtrMultiplier = Math.max(
    0.1,
    Number(config.maxBreakoutAtrMultiplier ?? config.optMaxBreakoutAtr ?? 4) || 4
  );

  return {
    atrPeriod,
    atrMultiplier,
    minCandles,
    minCandlesForLongLeg,
    longLegAtrMultiplier,
    minCandlesForBlueLeg,
    blueLegAtrMultiplier,
    maxBlueLegPercent,
    maxBreakoutAtrMultiplier,
  };
}

/**
 * Classifies the causal confirmed pivot prefix (ONLY pivots confirmed up to bar `i`, zero future data)
 * and returns the latest leg if it is a valid `dark_blue` (E -> F) leg.
 */
function findCausalLatestDarkBlueLeg(
  rawPivots: ZigZagPoint[],
  candles: CandleData[],
  atrValues: number[] | undefined,
  zz: ReturnType<typeof resolveCausalZigZagParams>
): { darkBlueLeg: ZigZagLeg; cycleType: 'bullish' | 'bearish'; priceA: number } | null {
  if (rawPivots.length < 4) return null;
  const recentRaw = rawPivots.length > 48 ? rawPivots.slice(-48) : rawPivots;
  const cleanPivots = normalizeConfirmedPivotsCausal(
    recentRaw,
    atrValues,
    zz.atrMultiplier,
    zz.minCandles
  );
  if (cleanPivots.length < 4) return null;

  // Recalculate legPoints/legAtrRatio strictly from past/current ATR values
  for (let p = 1; p < cleanPivots.length; p++) {
    const prev = cleanPivots[p - 1];
    const curr = cleanPivots[p];
    const diff = Math.abs(curr.value - prev.value);
    const cIdx = curr.candleIndex ?? 0;
    const atr = atrValues && atrValues[cIdx] > 0 ? atrValues[cIdx] : curr.atrAtPoint || 1;
    curr.atrAtPoint = atr;
    curr.legPoints = diff;
    curr.legAtrRatio = atr > 0 ? diff / atr : 0;
  }

  const legs = analyzeZigZagLegs(
    cleanPivots,
    zz.minCandlesForLongLeg,
    zz.longLegAtrMultiplier,
    zz.maxBlueLegPercent,
    zz.maxBreakoutAtrMultiplier,
    candles,
    zz.minCandlesForBlueLeg,
    zz.blueLegAtrMultiplier
  );
  if (legs.length === 0) return null;

  const lastLeg = legs[legs.length - 1];
  if (lastLeg.color !== 'dark_blue') return null;

  let giantLeg: ZigZagLeg | undefined;
  if (typeof lastLeg.cycleGiantLegIndex === 'number' && legs[lastLeg.cycleGiantLegIndex]) {
    giantLeg = legs[lastLeg.cycleGiantLegIndex];
  } else {
    for (let g = legs.length - 2; g >= 0; g--) {
      if (legs[g].isGiantLeg && (legs[g].color === 'green' || legs[g].color === 'red')) {
        giantLeg = legs[g];
        break;
      }
    }
  }
  const priceA = lastLeg.cyclePointAPrice ?? giantLeg?.startPrice ?? lastLeg.startPrice;
  const cycleType: 'bullish' | 'bearish' = (giantLeg ? giantLeg.isUp : lastLeg.isUp) ? 'bullish' : 'bearish';
  return { darkBlueLeg: lastLeg, cycleType, priceA };
}

/**
 * Runs Backtest and Live Analysis for Strategy 1 (Strictly Causal, Zero-Repaint, Candle-Close Entry):
 * Rule:
 * 1. Walks candles bar-by-bar using the causal ZigZag state machine (no future candle can erase/move a confirmed E-F leg).
 * 2. When a Dark Blue leg (E -> F) is causally confirmed (meaning reversal post-leg after F has started):
 *    - If E > F -> BUY (LONG) when a closed candle closes at or above E (`c.close >= priceE`), SL = F, TP = R:R.
 *    - If E <= F -> SELL (SHORT) when a closed candle closes at or below E (`c.close <= priceE`), SL = F, TP = R:R.
 * 3. Entry is strictly at `c.close` (matching Live Trading), and TP/SL/Time-Stop monitoring starts strictly at `k = entryCandleIdx + 1`.
 * 4. Maximum window of `maxCandlesToEnter` candles after F; allows at most 1 re-entry after a genuine Stop Loss.
 */
export function runStrategy1Backtest(
  candles: CandleData[],
  _points: ZigZagPoint[],
  _legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier?: number,
  minCandles?: number
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  const trades: StrategyTrade[] = [];
  const n = candles.length;
  if (n < 2) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  const zz = resolveCausalZigZagParams(config, atrMultiplier, minCandles);
  const effectiveMinCandles = zz.minCandles;
  const effectiveAtrMult = zz.atrMultiplier;
  const effectiveMaxCandles =
    config.maxCandlesToEnter && config.maxCandlesToEnter > 0 ? config.maxCandlesToEnter : 100;
  const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;

  const rawMinAtr = config.minAtrPercent ?? config.optMinAtrPercent;
  const effectiveMinAtrPct =
    rawMinAtr !== undefined && rawMinAtr !== null && !isNaN(Number(rawMinAtr))
      ? Math.max(0, Number(rawMinAtr))
      : 0.25;
  const rawRsi = config.s2RsiThreshold ?? config.optS2RsiThreshold;
  const parsedRsi =
    rawRsi !== undefined && rawRsi !== null && !isNaN(Number(rawRsi))
      ? Number(rawRsi)
      : 38;
  const effectiveRsiThresh = parsedRsi > 0 && parsedRsi < 50 ? parsedRsi : 0;
  const rawMinPivotAtr = config.minEntryPivotAtr ?? config.optMinEntryPivotAtr;
  const effectiveMinPivotAtr =
    rawMinPivotAtr !== undefined && rawMinPivotAtr !== null && !isNaN(Number(rawMinPivotAtr))
      ? Math.max(0, Number(rawMinPivotAtr))
      : 0;

  const rsi14 = effectiveRsiThresh > 0 ? calculateRSI(candles, 14) : [];
  const effectiveAtrValues =
    atrValues && atrValues.length === n
      ? atrValues
      : calculateATR(candles, zz.atrPeriod).atrValues;

  // 1. Causal initial trend setup (mirrors calculateAtrZigZag)
  let trend = 0;
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const atr = effectiveAtrValues[i] > 0 ? effectiveAtrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
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
  if (trend === 0) {
    return { trades: [], metrics: getEmptyMetrics(config.capital) };
  }

  const rawPivots: ZigZagPoint[] = [
    {
      time: candles[0].time,
      value: trend === 1 ? candles[0].low : candles[0].high,
      type: trend === 1 ? 'low' : 'high',
      atrAtPoint: effectiveAtrValues[0] || Math.max(0.0001, candles[0].high - candles[0].low),
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    },
  ];

  let curExtremeVal = trend === 1 ? candles[startIdx].high : candles[startIdx].low;
  let curExtremeIdx = startIdx;

  let lastTradeExitCandleIdx = -1;
  let rollingCapital = config.capital;
  const seenDarkBlueStartTimes = new Set<number>();

  interface PendingS1Setup {
    startTime: number;
    legIndex: number;
    priceA: number;
    priceE: number;
    priceF: number;
    timeF: number;
    candleIdxF: number;
    direction: 'BUY' | 'SELL';
    cycleType: 'bullish' | 'bearish';
    attempt: number;
    scanStartIdx: number;
    scanMaxWindow: number;
  }

  let pendingSetup: PendingS1Setup | null = null;

  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const atr = effectiveAtrValues[i] > 0 ? effectiveAtrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    const lastPivot = rawPivots[rawPivots.length - 1];

    let newlyConfirmedPivot: ZigZagPoint | null = null;
    let lastPivotExtended = false;

    if (trend === 1) {
      if (c.low < lastPivot.value) {
        lastPivot.value = c.low;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        lastPivotExtended = true;
      } else {
        if (c.high > curExtremeVal) {
          curExtremeVal = c.high;
          curExtremeIdx = i;
        }
        const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
        const priceDist = curExtremeVal - lastPivot.value;
        const peakAtr = effectiveAtrValues[curExtremeIdx] > 0 ? effectiveAtrValues[curExtremeIdx] : atr;
        if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * peakAtr && curExtremeVal - c.low >= th) {
          const confirmedPeakIdx = curExtremeIdx;
          newlyConfirmedPivot = {
            time: candles[confirmedPeakIdx].time,
            value: curExtremeVal,
            type: 'high',
            candleIndex: confirmedPeakIdx,
            atrAtPoint: peakAtr,
            legPoints: priceDist,
            legAtrRatio: peakAtr > 0 ? priceDist / peakAtr : 0,
          };
          rawPivots.push(newlyConfirmedPivot);
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
      }
    } else {
      if (c.high > lastPivot.value) {
        lastPivot.value = c.high;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        lastPivotExtended = true;
      } else {
        if (c.low < curExtremeVal) {
          curExtremeVal = c.low;
          curExtremeIdx = i;
        }
        const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
        const priceDist = lastPivot.value - curExtremeVal;
        const troughAtr = effectiveAtrValues[curExtremeIdx] > 0 ? effectiveAtrValues[curExtremeIdx] : atr;
        if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * troughAtr && c.high - curExtremeVal >= th) {
          const confirmedTroughIdx = curExtremeIdx;
          newlyConfirmedPivot = {
            time: candles[confirmedTroughIdx].time,
            value: curExtremeVal,
            type: 'low',
            candleIndex: confirmedTroughIdx,
            atrAtPoint: troughAtr,
            legPoints: priceDist,
            legAtrRatio: troughAtr > 0 ? priceDist / troughAtr : 0,
          };
          rawPivots.push(newlyConfirmedPivot);
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

    // If last confirmed pivot F extended BEFORE attempt 1 entered, re-check causal leg classification
    if (lastPivotExtended && pendingSetup && pendingSetup.attempt === 1) {
      const check = findCausalLatestDarkBlueLeg(rawPivots, candles, effectiveAtrValues, zz);
      if (check && check.darkBlueLeg.startTime === pendingSetup.startTime) {
        pendingSetup.priceF = check.darkBlueLeg.endPrice;
        pendingSetup.timeF = check.darkBlueLeg.endTime;
        pendingSetup.candleIdxF = i;
        pendingSetup.scanMaxWindow = i + effectiveMaxCandles;
      } else {
        pendingSetup = null;
      }
    }

    // When a new pivot confirms causally at bar `i`, check if it completes a fresh dark_blue (E -> F) leg
    if (newlyConfirmedPivot) {
      const check = findCausalLatestDarkBlueLeg(rawPivots, candles, effectiveAtrValues, zz);
      if (
        check &&
        check.darkBlueLeg.endTime === newlyConfirmedPivot.time &&
        !seenDarkBlueStartTimes.has(check.darkBlueLeg.startTime)
      ) {
        seenDarkBlueStartTimes.add(check.darkBlueLeg.startTime);
        const dl = check.darkBlueLeg;
        const idxF = newlyConfirmedPivot.candleIndex ?? i;
        const direction: 'BUY' | 'SELL' = dl.startPrice > dl.endPrice ? 'BUY' : 'SELL';
        pendingSetup = {
          startTime: dl.startTime,
          legIndex: dl.index,
          priceA: check.priceA,
          priceE: dl.startPrice,
          priceF: dl.endPrice,
          timeF: dl.endTime,
          candleIdxF: idxF,
          direction,
          cycleType: check.cycleType,
          attempt: 1,
          scanStartIdx: Math.max(i, idxF + 1),
          scanMaxWindow: idxF + effectiveMaxCandles,
        };
      }
    }

    if (!pendingSetup) continue;
    if (i < pendingSetup.scanStartIdx) continue;
    if (i > pendingSetup.scanMaxWindow) {
      pendingSetup = null;
      continue;
    }

    // Candle-close breakout check matching Live Trading (closed candle breaks E)
    const triggered =
      pendingSetup.direction === 'BUY'
        ? c.close >= pendingSetup.priceE
        : c.close <= pendingSetup.priceE;

    if (!triggered) continue;

    const entryCandleIdx = i;
    const entryTime = c.time;
    const entryPrice = c.close;
    const stopLoss = pendingSetup.priceF;
    const direction = pendingSetup.direction;

    // Ensure entry close is strictly on the valid side of Stop Loss (F)
    if (
      !(entryPrice > 0) ||
      !(stopLoss > 0) ||
      (direction === 'BUY' ? entryPrice <= stopLoss : entryPrice >= stopLoss)
    ) {
      continue;
    }

    if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
      pendingSetup = null;
      continue;
    }

    const stopDistance = Math.abs(entryPrice - stopLoss);
    if (stopDistance <= 0.000001) {
      pendingSetup = null;
      continue;
    }

    if (effectiveMinAtrPct > 0 && (entryPrice <= 0 || (atr / entryPrice) * 100 < effectiveMinAtrPct)) {
      pendingSetup = null;
      continue;
    }
    if (effectiveRsiThresh > 0) {
      const pivotRsi = rsi14[pendingSetup.candleIdxF] ?? 50;
      if (direction === 'BUY' ? pivotRsi > effectiveRsiThresh : pivotRsi < 100 - effectiveRsiThresh) {
        pendingSetup = null;
        continue;
      }
    }
    if (effectiveMinPivotAtr > 0 && (atr <= 0 || stopDistance / atr < effectiveMinPivotAtr)) {
      pendingSetup = null;
      continue;
    }

    const takeProfit =
      direction === 'BUY'
        ? entryPrice + stopDistance * targetRR
        : entryPrice - stopDistance * targetRR;

    const riskBudget =
      config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
        ? config.riskAmountFixed
        : (rollingCapital * (config.riskPercent || 1.0)) / 100;
    const entryFeeRate =
      (config.entryCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
    const exitFeeRate =
      (config.exitCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

    const effectiveExchange = config.exchange ?? 'xt';
    const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

    const sizing = calculateExactTradeSizing(
      riskBudget,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      config.symbol,
      {
        exchange: effectiveExchange,
        contractSize: config.xtContractSize,
        minNotional: config.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );
    const positionSize = sizing.quantizedPositionSize;
    const positionValue = sizing.positionValue;
    const entryFee = sizing.entryFee;
    const riskAmount = riskBudget;
    const realizedRisk = sizing.actualLossAtSL;

    if (positionSize <= 0 || positionValue <= 0) {
      pendingSetup = null;
      continue;
    }

    const effectiveMaxRatio =
      config.maxPositionToRiskRatio !== undefined
        ? config.maxPositionToRiskRatio
        : config.optMaxPositionToRiskRatio !== undefined
        ? config.optMaxPositionToRiskRatio
        : 300;
    const posToRiskRatio =
      riskAmount > 0 ? parseFloat((positionValue / riskAmount).toFixed(2)) : 0;

    if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
      pendingSetup = null;
      continue;
    }

    // Entry occurs strictly at close of entryCandleIdx; monitor TP/SL/Time-Stop from entryCandleIdx + 1 forward
    let status: TradeStatus = 'ACTIVE';
    let exitTime: number | undefined;
    let exitCandleIdx: number | undefined;
    let exitPrice: number | undefined;
    let pnl = 0;
    let pnlPercent = 0;
    let reason: string | undefined = undefined;

    for (let k = entryCandleIdx + 1; k < candles.length; k++) {
      const ck = candles[k];
      const hitTP = direction === 'BUY' ? ck.high >= takeProfit : ck.low <= takeProfit;
      const hitSL = direction === 'BUY' ? ck.low <= stopLoss : ck.high >= stopLoss;

      if (hitTP && hitSL) {
        status = 'LOSS';
        exitPrice = direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        pnlPercent = (pnl / rollingCapital) * 100;
        break;
      } else if (hitTP) {
        status = 'WIN';
        exitPrice = takeProfit;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        pnlPercent = (pnl / rollingCapital) * 100;
        break;
      } else if (hitSL) {
        status = 'LOSS';
        exitPrice = direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        pnlPercent = (pnl / rollingCapital) * 100;
        break;
      }

      const timeStopActive =
        config.timeStopEnabled !== false &&
        typeof config.timeStopCandles === 'number' &&
        config.timeStopCandles > 0;
      const candlesInTrade = k - entryCandleIdx;
      if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
        exitPrice = ck.close;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        pnlPercent = (pnl / rollingCapital) * 100;
        status = pnl > 0.0001 ? 'WIN' : pnl < -0.0001 ? 'LOSS' : 'BREAKEVEN';
        reason = 'TIME_STOP';
        break;
      }
    }

    if (status === 'ACTIVE') {
      const latestCandle = candles[candles.length - 1];
      exitPrice = latestCandle.close;
      const exitFee = positionSize * exitPrice * exitFeeRate;
      const grossMovePnl =
        direction === 'BUY'
          ? positionSize * (exitPrice - entryPrice)
          : positionSize * (entryPrice - exitPrice);
      pnl = grossMovePnl - (entryFee + exitFee);
      pnlPercent = (pnl / rollingCapital) * 100;
    }

    const elapsed = entryCandleIdx - pendingSetup.candleIdxF;
    const actualExitPrice = exitPrice ?? entryPrice;
    const tradeExitFee = positionSize * actualExitPrice * exitFeeRate;
    const tradeTotalFee = entryFee + tradeExitFee;
    const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
    pnl = parseFloat(pnl.toFixed(4));
    pnlPercent = parseFloat(pnlPercent.toFixed(4));

    if (!config.disableCapitalCompounding) {
      rollingCapital = Math.max(1, parseFloat((rollingCapital + pnl).toFixed(4)));
    }

    trades.push({
      id: `trade-${trades.length + 1}-${pendingSetup.legIndex}-att${pendingSetup.attempt}`,
      strategyId: 'strategy_1_e_breakout',
      strategyName: 'استراتژی ۱ (شکست E)',
      cycleIndex: trades.length + 1,
      attemptNumber: pendingSetup.attempt,
      direction,
      cycleType: pendingSetup.cycleType,
      priceA: pendingSetup.priceA,
      priceE: pendingSetup.priceE,
      priceF: stopLoss,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount: parseFloat(riskAmount.toFixed(4)),
      targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
      realizedRisk: parseFloat(realizedRisk.toFixed(4)),
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      positionSize,
      positionValue: parseFloat(positionValue.toFixed(4)),
      positionToRiskRatio: posToRiskRatio,
      riskReward: parseFloat(targetRR.toFixed(2)),
      timeF: pendingSetup.timeF,
      candleIdxF: pendingSetup.candleIdxF,
      entryTime,
      entryCandleIdx,
      exitTime,
      exitCandleIdx,
      exitPrice,
      candlesElapsedToEntry: elapsed,
      candlesRemainingToEnter: 0,
      waitingForPostLeg: false,
      hasPostLeg: true,
      status,
      grossPnl: parseFloat((pnl + tradeTotalFee).toFixed(4)),
      entryFee: parseFloat(entryFee.toFixed(4)),
      exitFee: parseFloat(tradeExitFee.toFixed(4)),
      fee: parseFloat(tradeTotalFee.toFixed(4)),
      commission: parseFloat(tradeTotalFee.toFixed(4)),
      pnl,
      pnlPercent,
      returnR: riskAmount > 0 ? parseFloat((pnl / riskAmount).toFixed(3)) : 0,
      capitalBeforeTrade,
      capitalAfterTrade: rollingCapital,
      slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
      entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
      exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
      reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
    });

    lastTradeExitCandleIdx = Math.max(
      lastTradeExitCandleIdx,
      exitCandleIdx !== undefined ? exitCandleIdx : candles.length
    );

    // Allow at most 1 re-entry strictly after a genuine Stop Loss (within maxCandlesToEnter after SL candle)
    if (status === 'LOSS' && reason !== 'TIME_STOP' && exitCandleIdx !== undefined && pendingSetup.attempt < 2) {
      pendingSetup.attempt = 2;
      pendingSetup.scanStartIdx = exitCandleIdx + 1;
      pendingSetup.scanMaxWindow = exitCandleIdx + effectiveMaxCandles;
    } else {
      pendingSetup = null;
    }
  }

  const metrics = calculateMetrics(trades, config.capital);
  return { trades, metrics };
}

/**
 * Runs Backtest and Live Analysis for Strategy 2 (Strictly Causal, Zero-Repaint, Candle-Close Entry):
 * User Rules:
 * 1. Walks candles bar-by-bar using the causal ZigZag state machine so NO future candle can retroactively erase/extend a failed E-F leg.
 * 2. When a Dark Blue leg (E -> F) is causally formed, waits candle-by-candle for the first valid post-F leg formation
 *    (`candleDist >= minCandles` and reversal move `>= atrMultiplier * ATR` within `maxCandlesToEnter`).
 * 3. Entry occurs strictly at the CLOSED candle (`entryPrice = c.close`, matching Live Trading 100%), with SL-breach guard on close.
 * 4. Stop Loss = F, Take Profit = entryPrice +/- |entryPrice - SL| * targetRR.
 * 5. TP/SL/Time-Stop monitoring starts strictly at `k = entryCandleIdx + 1` (no same-bar exit).
 * 6. Only 1 entry per E-F leg.
 */
export function runStrategy2Backtest(
  candles: CandleData[],
  _points: ZigZagPoint[],
  _legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  const trades: StrategyTrade[] = [];
  const n = candles.length;
  if (n < 2) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  const zz = resolveCausalZigZagParams(config, atrMultiplier, minCandles);
  const effectiveMinCandles = zz.minCandles;
  const effectiveAtrMult = zz.atrMultiplier;
  const effectiveMaxCandles =
    config.maxCandlesToEnter && config.maxCandlesToEnter > 0 ? config.maxCandlesToEnter : 35;
  const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;

  const rawMinAtr = config.minAtrPercent ?? config.optMinAtrPercent;
  const effectiveMinAtrPct =
    rawMinAtr !== undefined && rawMinAtr !== null && !isNaN(Number(rawMinAtr))
      ? Math.max(0, Number(rawMinAtr))
      : 0.25;
  const rawRsi = config.s2RsiThreshold ?? config.optS2RsiThreshold;
  const parsedRsi =
    rawRsi !== undefined && rawRsi !== null && !isNaN(Number(rawRsi))
      ? Number(rawRsi)
      : 38;
  const effectiveRsiThresh = parsedRsi > 0 && parsedRsi < 50 ? parsedRsi : 0;
  const rawMinPivotAtr = config.minEntryPivotAtr ?? config.optMinEntryPivotAtr;
  const effectiveMinPivotAtr =
    rawMinPivotAtr !== undefined && rawMinPivotAtr !== null && !isNaN(Number(rawMinPivotAtr))
      ? Math.max(0, Number(rawMinPivotAtr))
      : 0;

  const rsi14 = effectiveRsiThresh > 0 ? calculateRSI(candles, 14) : [];
  const effectiveAtrValues =
    atrValues && atrValues.length === n
      ? atrValues
      : calculateATR(candles, zz.atrPeriod).atrValues;

  // 1. Causal initial trend setup (mirrors calculateAtrZigZag)
  let trend = 0;
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const atr = effectiveAtrValues[i] > 0 ? effectiveAtrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
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
  if (trend === 0) {
    return { trades: [], metrics: getEmptyMetrics(config.capital) };
  }

  const rawPivots: ZigZagPoint[] = [
    {
      time: candles[0].time,
      value: trend === 1 ? candles[0].low : candles[0].high,
      type: trend === 1 ? 'low' : 'high',
      atrAtPoint: effectiveAtrValues[0] || Math.max(0.0001, candles[0].high - candles[0].low),
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    },
  ];

  let curExtremeVal = trend === 1 ? candles[startIdx].high : candles[startIdx].low;
  let curExtremeIdx = startIdx;

  let lastTradeExitCandleIdx = -1;
  let rollingCapital = config.capital;
  const seenDarkBlueStartTimes = new Set<number>();

  interface PendingS2Setup {
    startTime: number;
    legIndex: number;
    priceA: number;
    priceE: number;
    priceF: number;
    timeF: number;
    candleIdxF: number;
    isFHigh: boolean;
    cycleType: 'bullish' | 'bearish';
  }

  let pendingSetup: PendingS2Setup | null = null;

  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const atr = effectiveAtrValues[i] > 0 ? effectiveAtrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    const lastPivot = rawPivots[rawPivots.length - 1];

    let newlyConfirmedPivot: ZigZagPoint | null = null;
    let lastPivotExtended = false;

    if (trend === 1) {
      if (c.low < lastPivot.value) {
        lastPivot.value = c.low;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        lastPivotExtended = true;
      } else {
        if (c.high > curExtremeVal) {
          curExtremeVal = c.high;
          curExtremeIdx = i;
        }
        const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
        const priceDist = curExtremeVal - lastPivot.value;
        const peakAtr = effectiveAtrValues[curExtremeIdx] > 0 ? effectiveAtrValues[curExtremeIdx] : atr;
        if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * peakAtr && curExtremeVal - c.low >= th) {
          const confirmedPeakIdx = curExtremeIdx;
          newlyConfirmedPivot = {
            time: candles[confirmedPeakIdx].time,
            value: curExtremeVal,
            type: 'high',
            candleIndex: confirmedPeakIdx,
            atrAtPoint: peakAtr,
            legPoints: priceDist,
            legAtrRatio: peakAtr > 0 ? priceDist / peakAtr : 0,
          };
          rawPivots.push(newlyConfirmedPivot);
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
      }
    } else {
      if (c.high > lastPivot.value) {
        lastPivot.value = c.high;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        lastPivotExtended = true;
      } else {
        if (c.low < curExtremeVal) {
          curExtremeVal = c.low;
          curExtremeIdx = i;
        }
        const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
        const priceDist = lastPivot.value - curExtremeVal;
        const troughAtr = effectiveAtrValues[curExtremeIdx] > 0 ? effectiveAtrValues[curExtremeIdx] : atr;
        if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * troughAtr && c.high - curExtremeVal >= th) {
          const confirmedTroughIdx = curExtremeIdx;
          newlyConfirmedPivot = {
            time: candles[confirmedTroughIdx].time,
            value: curExtremeVal,
            type: 'low',
            candleIndex: confirmedTroughIdx,
            atrAtPoint: troughAtr,
            legPoints: priceDist,
            legAtrRatio: troughAtr > 0 ? priceDist / troughAtr : 0,
          };
          rawPivots.push(newlyConfirmedPivot);
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

    // If pivot F extended before Strategy 2 triggered entry, update F and re-verify dark_blue validity causally
    if (lastPivotExtended && pendingSetup) {
      const check = findCausalLatestDarkBlueLeg(rawPivots, candles, effectiveAtrValues, zz);
      if (check && check.darkBlueLeg.startTime === pendingSetup.startTime) {
        pendingSetup.priceF = check.darkBlueLeg.endPrice;
        pendingSetup.timeF = check.darkBlueLeg.endTime;
        pendingSetup.candleIdxF = i;
      } else {
        pendingSetup = null;
      }
      continue;
    }

    // When a new pivot confirms causally at bar `i`, check if it completes a fresh dark_blue (E -> F) leg
    if (newlyConfirmedPivot) {
      const check = findCausalLatestDarkBlueLeg(rawPivots, candles, effectiveAtrValues, zz);
      if (
        check &&
        check.darkBlueLeg.endTime === newlyConfirmedPivot.time &&
        !seenDarkBlueStartTimes.has(check.darkBlueLeg.startTime)
      ) {
        seenDarkBlueStartTimes.add(check.darkBlueLeg.startTime);
        const dl = check.darkBlueLeg;
        const idxF = newlyConfirmedPivot.candleIndex ?? i;
        pendingSetup = {
          startTime: dl.startTime,
          legIndex: dl.index,
          priceA: check.priceA,
          priceE: dl.startPrice,
          priceF: dl.endPrice,
          timeF: dl.endTime,
          candleIdxF: idxF,
          isFHigh: dl.isUp,
          cycleType: check.cycleType,
        };
      }
    }

    if (!pendingSetup) continue;
    if (i <= pendingSetup.candleIdxF) continue;

    // If price broke past F before post-F leg triggered, extend F causally and wait
    if (pendingSetup.isFHigh && c.high > pendingSetup.priceF) {
      pendingSetup.priceF = c.high;
      pendingSetup.timeF = c.time;
      pendingSetup.candleIdxF = i;
      continue;
    }
    if (!pendingSetup.isFHigh && c.low < pendingSetup.priceF) {
      pendingSetup.priceF = c.low;
      pendingSetup.timeF = c.time;
      pendingSetup.candleIdxF = i;
      continue;
    }

    const candleDist = i - pendingSetup.candleIdxF;
    if (candleDist > effectiveMaxCandles) {
      pendingSetup = null;
      continue;
    }

    const requiredDistance = effectiveAtrMult * atr;
    const priceDist = pendingSetup.isFHigh
      ? pendingSetup.priceF - c.low
      : c.high - pendingSetup.priceF;

    if (candleDist < effectiveMinCandles || priceDist < requiredDistance) {
      continue;
    }

    // Triggered for the FIRST time after F -> consume this F setup (only 1 entry attempt per F)
    const activeSetup = pendingSetup;
    pendingSetup = null;

    const entryCandleIdx = i;
    const entryTime = c.time;
    const entryPrice = c.close; // Strictly candle-close entry matching Live Trading
    const stopLoss = activeSetup.priceF;
    const direction: 'BUY' | 'SELL' = activeSetup.isFHigh ? 'SELL' : 'BUY';

    // SL Breach Guard on close (matching Live Trading)
    if (
      !(entryPrice > 0) ||
      !(stopLoss > 0) ||
      (direction === 'BUY' ? entryPrice <= stopLoss : entryPrice >= stopLoss)
    ) {
      continue;
    }

    const stopDistance = Math.abs(entryPrice - stopLoss);
    if (stopDistance <= 0.000001) {
      continue;
    }

    if (effectiveMinAtrPct > 0 && (atr / entryPrice) * 100 < effectiveMinAtrPct) {
      continue;
    }
    if (effectiveRsiThresh > 0) {
      const pivotRsi = rsi14[activeSetup.candleIdxF] ?? 50;
      if (direction === 'BUY' ? pivotRsi > effectiveRsiThresh : pivotRsi < 100 - effectiveRsiThresh) {
        continue;
      }
    }
    if (effectiveMinPivotAtr > 0 && (atr <= 0 || stopDistance / atr < effectiveMinPivotAtr)) {
      continue;
    }
    if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
      continue;
    }

    const takeProfit =
      direction === 'BUY'
        ? entryPrice + stopDistance * targetRR
        : entryPrice - stopDistance * targetRR;

    const riskBudget =
      config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
        ? config.riskAmountFixed
        : (rollingCapital * (config.riskPercent || 1.0)) / 100;
    const entryFeeRate =
      (config.entryCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
    const exitFeeRate =
      (config.exitCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

    const effectiveExchange = config.exchange ?? 'xt';
    const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

    const sizing = calculateExactTradeSizing(
      riskBudget,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      config.symbol,
      {
        exchange: effectiveExchange,
        contractSize: config.xtContractSize,
        minNotional: config.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );
    const positionSize = sizing.quantizedPositionSize;
    const positionValue = sizing.positionValue;
    const entryFee = sizing.entryFee;
    const riskAmount = riskBudget;
    const realizedRisk = sizing.actualLossAtSL;

    if (positionSize <= 0 || positionValue <= 0) {
      continue;
    }

    const effectiveMaxRatio =
      config.maxPositionToRiskRatio !== undefined
        ? config.maxPositionToRiskRatio
        : config.optMaxPositionToRiskRatio !== undefined
        ? config.optMaxPositionToRiskRatio
        : 300;
    const posToRiskRatio =
      riskAmount > 0 ? parseFloat((positionValue / riskAmount).toFixed(2)) : 0;

    if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
      continue;
    }

    // Entry occurs strictly at close of entryCandleIdx; monitor TP/SL/Time-Stop from entryCandleIdx + 1 forward
    let status: TradeStatus = 'ACTIVE';
    let exitTime: number | undefined;
    let exitCandleIdx: number | undefined;
    let exitPrice: number | undefined;
    let reason: string | undefined = undefined;

    for (let k = entryCandleIdx + 1; k < candles.length; k++) {
      const ck = candles[k];
      const hitTP = direction === 'BUY' ? ck.high >= takeProfit : ck.low <= takeProfit;
      const hitSL = direction === 'BUY' ? ck.low <= stopLoss : ck.high >= stopLoss;

      if (hitTP && hitSL) {
        status = 'LOSS';
        exitPrice = direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        break;
      } else if (hitTP) {
        status = 'WIN';
        exitPrice = takeProfit;
        exitTime = ck.time;
        exitCandleIdx = k;
        break;
      } else if (hitSL) {
        status = 'LOSS';
        exitPrice = direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        break;
      }

      const timeStopActive =
        config.timeStopEnabled !== false &&
        typeof config.timeStopCandles === 'number' &&
        config.timeStopCandles > 0;
      const candlesInTrade = k - entryCandleIdx;
      if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
        exitPrice = ck.close;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFeeTs = positionSize * exitPrice * exitFeeRate;
        const grossTs =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        const netTs = grossTs - (entryFee + exitFeeTs);
        status = netTs > 0.0001 ? 'WIN' : netTs < -0.0001 ? 'LOSS' : 'BREAKEVEN';
        reason = 'TIME_STOP';
        break;
      }
    }

    if (status === 'ACTIVE') {
      exitPrice = candles[candles.length - 1].close;
    }

    const actualExitPrice = exitPrice ?? entryPrice;
    const tradeExitFee = positionSize * actualExitPrice * exitFeeRate;
    const tradeTotalFee = entryFee + tradeExitFee;
    const grossVal =
      direction === 'BUY'
        ? positionSize * (actualExitPrice - entryPrice)
        : positionSize * (entryPrice - actualExitPrice);
    const netVal = grossVal - tradeTotalFee;
    const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
    const nextCap = Math.max(1, parseFloat((rollingCapital + netVal).toFixed(4)));

    trades.push({
      id: `trade-s2-${trades.length + 1}-${activeSetup.legIndex}`,
      strategyId: 'strategy_2_next_pivot',
      strategyName: 'استراتژی ۲ (اولین تشکیل بعد از F)',
      cycleIndex: trades.length + 1,
      attemptNumber: 1,
      direction,
      cycleType: activeSetup.cycleType,
      priceA: activeSetup.priceA,
      priceE: activeSetup.priceE,
      priceF: stopLoss,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount: parseFloat(riskAmount.toFixed(4)),
      targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
      realizedRisk: parseFloat(realizedRisk.toFixed(4)),
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      positionSize,
      positionValue: parseFloat(positionValue.toFixed(4)),
      positionToRiskRatio: posToRiskRatio,
      riskReward: parseFloat(targetRR.toFixed(2)),
      timeF: activeSetup.timeF,
      candleIdxF: activeSetup.candleIdxF,
      entryTime,
      entryCandleIdx,
      exitTime,
      exitCandleIdx,
      exitPrice,
      candlesElapsedToEntry: entryCandleIdx - activeSetup.candleIdxF,
      candlesRemainingToEnter: 0,
      waitingForPostLeg: false,
      hasPostLeg: true,
      status,
      grossPnl: parseFloat(grossVal.toFixed(4)),
      entryFee: parseFloat(entryFee.toFixed(4)),
      exitFee: parseFloat(tradeExitFee.toFixed(4)),
      fee: parseFloat(tradeTotalFee.toFixed(4)),
      commission: parseFloat(tradeTotalFee.toFixed(4)),
      pnl: parseFloat(netVal.toFixed(4)),
      pnlPercent: parseFloat(((netVal / rollingCapital) * 100).toFixed(4)),
      returnR: riskAmount > 0 ? parseFloat((netVal / riskAmount).toFixed(3)) : 0,
      capitalBeforeTrade,
      capitalAfterTrade: nextCap,
      slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
      entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
      exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
      reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
    });

    if (!config.disableCapitalCompounding) {
      rollingCapital = nextCap;
    }

    lastTradeExitCandleIdx = Math.max(
      lastTradeExitCandleIdx,
      exitCandleIdx !== undefined ? exitCandleIdx : candles.length
    );
  }

  const metrics = calculateMetrics(trades, config.capital);
  return { trades, metrics };
}

/**
 * Finds the exact candle index where a ZigZag pivot `P1` is first causally formed/confirmed
 * by a reversal move of at least `atrMultiplier * ATR` away from `P1.value`
 * without breaking past `P1.value` before confirmation.
 * Returns -1 if `P1` is still unconfirmed or was broken before confirmation.
 */
export function findPivotConfirmCandleIdx(
  candles: CandleData[],
  pivotP1: ZigZagPoint,
  pivotIdxP1: number,
  atrValues?: number[],
  atrMultiplier: number = 3
): number {
  const effectiveAtrMult = atrMultiplier > 0 ? atrMultiplier : 3;
  const priceP1 = pivotP1.value;
  for (let cIdx = pivotIdxP1 + 1; cIdx < candles.length; cIdx++) {
    const c = candles[cIdx];
    const atr =
      atrValues && atrValues[cIdx] > 0
        ? atrValues[cIdx]
        : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    if (pivotP1.type === 'high') {
      // Pivot 1 is a HIGH: confirmed once price drops by >= th from P1 without breaking above P1 first
      if (c.high > priceP1) return -1;
      if (priceP1 - c.low >= th) return cIdx;
    } else {
      // Pivot 1 is a LOW: confirmed once price bounces by >= th from P1 without breaking below P1 first
      if (c.low < priceP1) return -1;
      if (c.high - priceP1 >= th) return cIdx;
    }
  }
  return -1;
}

/**
 * Normalizes confirmed ZigZag pivots identically to `calculateAtrZigZag`'s post-filter
 * using ONLY pivots already confirmed up to the current causal candle (zero future data).
 */
function normalizeConfirmedPivotsCausal(
  rawPivots: ZigZagPoint[],
  atrValues: number[] | undefined,
  atrMultiplier: number,
  effectiveMinCandles: number
): ZigZagPoint[] {
  if (rawPivots.length === 0) return [];
  let pivots = rawPivots.map((p) => ({ ...p }));
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
        const refAtr =
          atrValues && atrValues[pCurr.candleIndex ?? 0] > 0
            ? atrValues[pCurr.candleIndex ?? 0]
            : 1;
        const pRatio = pDist / refAtr;

        if (cDist < effectiveMinCandles || pRatio < atrMultiplier - 0.01) {
          if (pCurr.type === pPrev2.type) {
            if (pCurr.type === 'high' && pCurr.value >= pPrev2.value) {
              next.pop();
              next.pop();
              next.push(pCurr);
              changed = true;
              continue;
            }
            if (pCurr.type === 'low' && pCurr.value <= pPrev2.value) {
              next.pop();
              next.pop();
              next.push(pCurr);
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

  const cleanPivots: ZigZagPoint[] = [];
  for (const p of pivots) {
    if (cleanPivots.length === 0) {
      cleanPivots.push(p);
    } else {
      const prev = cleanPivots[cleanPivots.length - 1];
      if (p.type === prev.type) {
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
  return cleanPivots;
}

/**
 * Runs Backtest for Strategy 3 (5-Consecutive-Pivot Pattern — Strictly Causal):
 * Walks candles bar-by-bar using the exact `calculateAtrZigZag` state machine so that
 * NO future candle can retroactively erase or relocate a failed pivot `P1` (zero repainting / look-ahead bias).
 *
 * At the exact candle `i` where a new pivot `P1` causally confirms via ATR-multiplier reversal,
 * evaluates the 6 newest confirmed pivots ordered newest to oldest (`P1, P2, P3, P4, P5, P6`):
 *
 * Bullish Setup (BUY — پیوت اول کف است):
 *   - P1 = low, P2 = high, P3 = low, P4 = high, P5 = low, P6 = high
 *   - P1 < P3 (پیوت اول پایین‌تر از دو پیوت قبل)
 *   - P2 > P4 (پیوت دوم بالاتر از دو پیوت قبل)
 *   - P3 < P5 (پیوت سوم پایین‌تر از دو پیوت قبل)
 *   - P4 > P6 (پیوت چهارم بالاتر از دو پیوت قبل)
 *
 * Bearish Setup (SELL — پیوت اول سقف است):
 *   - P1 = high, P2 = low, P3 = high, P4 = low, P5 = high, P6 = low
 *   - P1 > P3 (پیوت اول بالاتر از دو پیوت قبل)
 *   - P2 < P4 (پیوت دوم پایین‌تر از دو پیوت قبل)
 *   - P3 > P5 (پیوت سوم بالاتر از دو پیوت قبل)
 *   - P4 < P6 (پیوت چهارم پایین‌تر از دو پیوت قبل)
 *
 * Entry & Risk Rules:
 *   - Enter at Market at close of the causal confirmation candle `i` (or `i + 1` if `P1` formed on the same bar `i` and holds).
 *   - Stop Loss = P1.value.
 *   - Take Profit = entryPrice +/- |entryPrice - stopLoss| * targetRR.
 */
export function runStrategy3Backtest(
  candles: CandleData[],
  _points: ZigZagPoint[],
  _legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  const trades: StrategyTrade[] = [];
  const n = candles.length;
  if (n < 2) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  const effectiveMinCandles = Math.max(1, minCandles);
  const effectiveAtrMult = atrMultiplier > 0 ? atrMultiplier : 3;
  const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;

  const rawMinAtr = config.minAtrPercent ?? config.optMinAtrPercent;
  const effectiveMinAtrPct =
    rawMinAtr !== undefined && rawMinAtr !== null && !isNaN(Number(rawMinAtr))
      ? Math.max(0, Number(rawMinAtr))
      : 0.25;
  const rawRsi = config.s2RsiThreshold ?? config.optS2RsiThreshold;
  const parsedRsi =
    rawRsi !== undefined && rawRsi !== null && !isNaN(Number(rawRsi))
      ? Number(rawRsi)
      : 38;
  const effectiveRsiThresh = parsedRsi > 0 && parsedRsi < 50 ? parsedRsi : 0;
  const rawMinPivotAtr = config.minEntryPivotAtr ?? config.optMinEntryPivotAtr;
  const effectiveMinPivotAtr =
    rawMinPivotAtr !== undefined && rawMinPivotAtr !== null && !isNaN(Number(rawMinPivotAtr))
      ? Math.max(0, Number(rawMinPivotAtr))
      : 0;
  const rsi14 = effectiveRsiThresh > 0 ? calculateRSI(candles, 14) : [];
  const effectiveAtrValues =
    atrValues && atrValues.length === candles.length
      ? atrValues
      : calculateATR(candles, config.atrPeriod || config.optAtrPeriod || 17).atrValues;

  // 1. Causal initial trend setup (mirrors `calculateAtrZigZag` step 1)
  let trend = 0; // 1 for UP (seeking peak), -1 for DOWN (seeking trough)
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const atr = effectiveAtrValues[i] > 0 ? effectiveAtrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
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

  if (trend === 0) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  const rawPivots: ZigZagPoint[] = [];
  if (trend === 1) {
    rawPivots.push({
      time: candles[0].time,
      value: candles[0].low,
      type: 'low',
      atrAtPoint: effectiveAtrValues[0] || candles[0].high - candles[0].low,
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  } else {
    rawPivots.push({
      time: candles[0].time,
      value: candles[0].high,
      type: 'high',
      atrAtPoint: effectiveAtrValues[0] || candles[0].high - candles[0].low,
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  }

  let curExtremeVal = trend === 1 ? candles[startIdx].high : candles[startIdx].low;
  let curExtremeIdx = startIdx;

  let lastTradeExitCandleIdx = -1;
  let rollingCapital = config.capital;
  // Deferred check for rare same-candle pinbar pivot confirmation (ensures entryCandleIdx > candleIdxF)
  let pendingSameBarSetup: { p1: ZigZagPoint; p2: ZigZagPoint; p6: ZigZagPoint; direction: 'BUY' | 'SELL' } | null = null;

  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const atr = effectiveAtrValues[i] > 0 ? effectiveAtrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    const lastPivot = rawPivots[rawPivots.length - 1];

    let newlyConfirmedPivot: ZigZagPoint | null = null;

    if (trend === 1) {
      if (c.low < lastPivot.value) {
        lastPivot.value = c.low;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        pendingSameBarSetup = null;
        continue;
      }

      if (c.high > curExtremeVal) {
        curExtremeVal = c.high;
        curExtremeIdx = i;
      }

      const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
      const priceDist = curExtremeVal - lastPivot.value;
      const peakAtr = effectiveAtrValues[curExtremeIdx] > 0 ? effectiveAtrValues[curExtremeIdx] : atr;

      if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * peakAtr && curExtremeVal - c.low >= th) {
        const confirmedPeakIdx = curExtremeIdx;
        newlyConfirmedPivot = {
          time: candles[confirmedPeakIdx].time,
          value: curExtremeVal,
          type: 'high',
          candleIndex: confirmedPeakIdx,
          atrAtPoint: peakAtr,
          legPoints: priceDist,
          legAtrRatio: peakAtr > 0 ? priceDist / peakAtr : 0,
        };
        rawPivots.push(newlyConfirmedPivot);

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
      if (c.high > lastPivot.value) {
        lastPivot.value = c.high;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        pendingSameBarSetup = null;
        continue;
      }

      if (c.low < curExtremeVal) {
        curExtremeVal = c.low;
        curExtremeIdx = i;
      }

      const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
      const priceDist = lastPivot.value - curExtremeVal;
      const troughAtr = effectiveAtrValues[curExtremeIdx] > 0 ? effectiveAtrValues[curExtremeIdx] : atr;

      if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * troughAtr && c.high - curExtremeVal >= th) {
        const confirmedTroughIdx = curExtremeIdx;
        newlyConfirmedPivot = {
          time: candles[confirmedTroughIdx].time,
          value: curExtremeVal,
          type: 'low',
          candleIndex: confirmedTroughIdx,
          atrAtPoint: troughAtr,
          legPoints: priceDist,
          legAtrRatio: troughAtr > 0 ? priceDist / troughAtr : 0,
        };
        rawPivots.push(newlyConfirmedPivot);

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

    // Evaluate either a deferred same-bar pivot (now at i = pivotIdx + 1) or a newly confirmed pivot
    let triggerP1: ZigZagPoint | null = null;
    let triggerP2: ZigZagPoint | null = null;
    let triggerP6: ZigZagPoint | null = null;
    let triggerDirection: 'BUY' | 'SELL' | null = null;

    if (pendingSameBarSetup) {
      const heldStop =
        pendingSameBarSetup.direction === 'BUY'
          ? c.low >= pendingSameBarSetup.p1.value && c.high - pendingSameBarSetup.p1.value >= th
          : c.high <= pendingSameBarSetup.p1.value && pendingSameBarSetup.p1.value - c.low >= th;
      if (heldStop && !newlyConfirmedPivot) {
        triggerP1 = pendingSameBarSetup.p1;
        triggerP2 = pendingSameBarSetup.p2;
        triggerP6 = pendingSameBarSetup.p6;
        triggerDirection = pendingSameBarSetup.direction;
      }
      pendingSameBarSetup = null;
    }

    if (newlyConfirmedPivot && rawPivots.length >= 6) {
      const recentRaw = rawPivots.length > 32 ? rawPivots.slice(-32) : rawPivots;
      const cleanPivots = normalizeConfirmedPivotsCausal(
        recentRaw,
        effectiveAtrValues,
        effectiveAtrMult,
        effectiveMinCandles
      );
      if (cleanPivots.length >= 6) {
        const len = cleanPivots.length;
        const p1 = cleanPivots[len - 1]; // اولی (جدیدترین)
        const p2 = cleanPivots[len - 2]; // دومی
        const p3 = cleanPivots[len - 3]; // سومی
        const p4 = cleanPivots[len - 4]; // چهارمی
        const p5 = cleanPivots[len - 5]; // پنجمی
        const p6 = cleanPivots[len - 6]; // ششمی (قدیمی‌ترین)

        // Ensure the top pivot is indeed the one just confirmed at bar `i`
        if ((p1.candleIndex ?? -1) === (newlyConfirmedPivot.candleIndex ?? -2) && p1.type === newlyConfirmedPivot.type) {
          const isBullishSetup =
            p1.type === 'low' &&
            p2.type === 'high' &&
            p3.type === 'low' &&
            p4.type === 'high' &&
            p5.type === 'low' &&
            p6.type === 'high' &&
            p1.value < p3.value &&
            p2.value > p4.value &&
            p3.value < p5.value &&
            p4.value > p6.value;

          const isBearishSetup =
            p1.type === 'high' &&
            p2.type === 'low' &&
            p3.type === 'high' &&
            p4.type === 'low' &&
            p5.type === 'high' &&
            p6.type === 'low' &&
            p1.value > p3.value &&
            p2.value < p4.value &&
            p3.value > p5.value &&
            p4.value < p6.value;

          if (isBullishSetup || isBearishSetup) {
            const dir: 'BUY' | 'SELL' = isBullishSetup ? 'BUY' : 'SELL';
            if ((p1.candleIndex ?? i) === i) {
              // Same-candle reversal: defer 1 candle so entryCandleIdx > candleIdxF and intra-bar order is unambiguous
              pendingSameBarSetup = { p1, p2, p6, direction: dir };
              continue;
            }
            triggerP1 = p1;
            triggerP2 = p2;
            triggerP6 = p6;
            triggerDirection = dir;
          }
        }
      }
    }

    if (!triggerP1 || !triggerP2 || !triggerP6 || !triggerDirection) {
      continue;
    }

    const pivotIdxP1 = triggerP1.candleIndex ?? 0;
    const entryCandleIdx = i;

    if (entryCandleIdx <= pivotIdxP1) {
      continue;
    }

    if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
      continue;
    }

    const direction = triggerDirection;
    const cycleType: 'bullish' | 'bearish' = direction === 'BUY' ? 'bullish' : 'bearish';
    const entryCandle = candles[entryCandleIdx];
    const entryTime = entryCandle.time;
    const entryPrice = entryCandle.close;
    const stopLoss = triggerP1.value;

    // Ensure entry close is strictly on the valid side of Stop Loss (P1)
    if (
      !(entryPrice > 0) ||
      !(stopLoss > 0) ||
      (direction === 'BUY' ? entryPrice <= stopLoss : entryPrice >= stopLoss)
    ) {
      continue;
    }

    const stopDistance = Math.abs(entryPrice - stopLoss);
    if (stopDistance <= 0.000001) {
      continue;
    }

    const entryAtr =
      effectiveAtrValues && effectiveAtrValues[entryCandleIdx] > 0
        ? effectiveAtrValues[entryCandleIdx]
        : Math.max(0.0001, entryCandle.high - entryCandle.low);

    if (effectiveMinAtrPct > 0 && (entryPrice <= 0 || (entryAtr / entryPrice) * 100 < effectiveMinAtrPct)) {
      continue;
    }
    if (effectiveRsiThresh > 0) {
      const pivotRsi = rsi14[pivotIdxP1] ?? 50;
      if (direction === 'BUY' ? pivotRsi > effectiveRsiThresh : pivotRsi < 100 - effectiveRsiThresh) {
        continue;
      }
    }
    if (effectiveMinPivotAtr > 0 && (entryAtr <= 0 || stopDistance / entryAtr < effectiveMinPivotAtr)) {
      continue;
    }

    const takeProfit =
      direction === 'BUY'
        ? entryPrice + stopDistance * targetRR
        : entryPrice - stopDistance * targetRR;
    const p1 = triggerP1;
    const p2 = triggerP2;
    const p6 = triggerP6;
    const idx = rawPivots.length - 1;

    const riskBudget =
      config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
        ? config.riskAmountFixed
        : (rollingCapital * (config.riskPercent || 1.0)) / 100;
    const entryFeeRate =
      (config.entryCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
    const exitFeeRate =
      (config.exitCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

    const effectiveExchange = config.exchange ?? 'xt';
    const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

    const sizing = calculateExactTradeSizing(
      riskBudget,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      config.symbol,
      {
        exchange: effectiveExchange,
        contractSize: config.xtContractSize,
        minNotional: config.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );
    const positionSize = sizing.quantizedPositionSize;
    const positionValue = sizing.positionValue;
    const entryFee = sizing.entryFee;
    const riskAmount = riskBudget;
    const realizedRisk = sizing.actualLossAtSL;

    if (positionSize <= 0 || positionValue <= 0) {
      continue;
    }

    const effectiveMaxRatio =
      config.maxPositionToRiskRatio !== undefined
        ? config.maxPositionToRiskRatio
        : config.optMaxPositionToRiskRatio !== undefined
        ? config.optMaxPositionToRiskRatio
        : 300;
    const posToRiskRatio =
      riskAmount > 0 ? parseFloat((positionValue / riskAmount).toFixed(2)) : 0;

    if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
      continue;
    }

    let status: TradeStatus = 'ACTIVE';
    let exitTime: number | undefined;
    let exitCandleIdx: number | undefined;
    let exitPrice: number | undefined;
    let pnl = 0;
    let reason: string | undefined = undefined;

    // Entry occurs at close of entryCandleIdx; monitor TP/SL/Time-Stop from entryCandleIdx + 1 forward
    for (let k = entryCandleIdx + 1; k < candles.length; k++) {
      const ck = candles[k];
      const hitTP = direction === 'BUY' ? ck.high >= takeProfit : ck.low <= takeProfit;
      const hitSL = direction === 'BUY' ? ck.low <= stopLoss : ck.high >= stopLoss;

      if (hitTP && hitSL) {
        status = 'LOSS';
        exitPrice =
          direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        break;
      } else if (hitTP) {
        status = 'WIN';
        exitPrice = takeProfit;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        break;
      } else if (hitSL) {
        status = 'LOSS';
        exitPrice =
          direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        break;
      }

      const timeStopActive =
        config.timeStopEnabled !== false &&
        typeof config.timeStopCandles === 'number' &&
        config.timeStopCandles > 0;
      const candlesInTrade = k - entryCandleIdx;
      if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
        exitPrice = ck.close;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        status = pnl > 0.0001 ? 'WIN' : pnl < -0.0001 ? 'LOSS' : 'BREAKEVEN';
        reason = 'TIME_STOP';
        break;
      }
    }

    if (status === 'ACTIVE') {
      const latestCandle = candles[candles.length - 1];
      exitPrice = latestCandle.close;
      const exitFee = positionSize * exitPrice * exitFeeRate;
      const grossTradePnl =
        direction === 'BUY'
          ? positionSize * (exitPrice - entryPrice)
          : positionSize * (entryPrice - exitPrice);
      pnl = grossTradePnl - (entryFee + exitFee);
    }

    const actualExitPrice = exitPrice ?? entryPrice;
    const tradeExitFee = positionSize * actualExitPrice * exitFeeRate;
    const tradeTotalFee = entryFee + tradeExitFee;
    const grossVal =
      direction === 'BUY'
        ? positionSize * (actualExitPrice - entryPrice)
        : positionSize * (entryPrice - actualExitPrice);
    const netVal = grossVal - tradeTotalFee;
    const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
    const nextCap = Math.max(1, parseFloat((rollingCapital + netVal).toFixed(4)));
    const waitCandles = entryCandleIdx - pivotIdxP1;

    trades.push({
      id: `trade-s3-${trades.length + 1}-${idx}`,
      strategyId: 'strategy_3_ab_midpoint',
      strategyName:
        direction === 'BUY'
          ? 'استراتژی ۳ (۶ پیوت متوالی - خرید)'
          : 'استراتژی ۳ (۶ پیوت متوالی - فروش)',
      cycleIndex: trades.length + 1,
      attemptNumber: 1,
      direction,
      cycleType,
      priceA: p6.value,
      priceE: p2.value,
      priceF: stopLoss,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount: parseFloat(riskAmount.toFixed(4)),
      targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
      realizedRisk: parseFloat(realizedRisk.toFixed(4)),
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      positionSize,
      positionValue: parseFloat(positionValue.toFixed(4)),
      positionToRiskRatio: posToRiskRatio,
      riskReward: parseFloat(targetRR.toFixed(2)),
      timeF: p1.time,
      candleIdxF: pivotIdxP1,
      entryTime,
      entryCandleIdx,
      exitTime,
      exitCandleIdx,
      exitPrice,
      candlesElapsedToEntry: waitCandles,
      candlesRemainingToEnter: 0,
      waitingForPostLeg: false,
      hasPostLeg: true,
      status,
      grossPnl: parseFloat(grossVal.toFixed(4)),
      entryFee: parseFloat(entryFee.toFixed(4)),
      exitFee: parseFloat(tradeExitFee.toFixed(4)),
      fee: parseFloat(tradeTotalFee.toFixed(4)),
      commission: parseFloat(tradeTotalFee.toFixed(4)),
      pnl: parseFloat(netVal.toFixed(4)),
      pnlPercent: parseFloat(((netVal / rollingCapital) * 100).toFixed(4)),
      returnR: riskAmount > 0 ? parseFloat((netVal / riskAmount).toFixed(3)) : 0,
      capitalBeforeTrade,
      capitalAfterTrade: nextCap,
      slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
      entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
      exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
      reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
    });

    if (!config.disableCapitalCompounding) {
      rollingCapital = nextCap;
    }
    lastTradeExitCandleIdx = Math.max(
      lastTradeExitCandleIdx,
      exitCandleIdx !== undefined ? exitCandleIdx : candles.length
    );
  }

  const metrics = calculateMetrics(trades, config.capital);
  return { trades, metrics };
}

/**
 * Runs Backtest and Live Analysis for Strategy 4 (ZigZag Machine Learning GBDT):
 * - Strictly causal bar-by-bar ZigZag pivot confirmation (ZERO lookahead / ZERO repainting).
 * - Evaluates 28 symmetric features across 4 leg types (Giant green/red, Light Blue CD, Dark Blue EF, White),
 *   Fibonacci/Harmonic ratios (Gartley/Bat/Butterfly/Crab/AB=CD), Leg Volume comparisons (exhaustion & climax),
 *   and structure/RSI/EMA exhaustion.
 * - Entry on confirmation candle close; exit strictly from k = entryIdx + 1 with exact XT fees + SL slippage.
 */
export function runStrategy4MlBacktest(
  candles: CandleData[],
  config: StrategyConfig,
  atrValues?: number[],
  customModel?: ZigZagMlModel
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  const trades: StrategyTrade[] = [];
  if (!candles || candles.length < 100) {
    return { trades: [], metrics: getEmptyMetrics(config.capital) };
  }

  const model = customModel || getActiveMlModel();
  const activeTf = config.timeframe || model.timeframe || '5m';
  const modelTf = model.timeframe || '5m';
  const tfVolScale = getTimeframeVolatilityScale(activeTf, modelTf);
  const tfThresholdScale = Math.max(0.6, Math.min(2.5, tfVolScale));

  const useProvidedAtr =
    atrValues &&
    atrValues.length === candles.length &&
    (config.atrPeriod ?? config.optAtrPeriod) === model.zigzagParams.atrPeriod;

  const baseMinStretchPct = model.minStretchPct ?? (model.version >= 3 ? 1.5 : model.version >= 2 ? 4.0 : 0);
  const effectiveMinStretchPct = baseMinStretchPct * tfThresholdScale;
  const effectiveMinAtrPct = model.minAtrPct * tfThresholdScale;

  const events = extractCausalZigZagEvents(
    candles,
    model.zigzagParams,
    effectiveMinAtrPct,
    useProvidedAtr ? atrValues : undefined,
    0,
    effectiveMinStretchPct,
    activeTf
  );

  if (events.length === 0) {
    return { trades: [], metrics: getEmptyMetrics(config.capital) };
  }

  const entryFeeRate = (config.entryCommissionPercent ?? 0.06) / 100;
  const exitFeeRate = (config.exitCommissionPercent ?? 0.06) / 100;
  const slSlipRate = (config.slSlippagePercent ?? (config.exchange === 'xt' ? 0.04 : 0)) / 100;
  const maxPosRatio = config.maxPositionToRiskRatio ?? config.optMaxPositionToRiskRatio ?? 300;
  const timeStopBars = Math.max(10, Math.round(model.timeStopCandles || 144));
  const slMult = model.slAtrMult > 0 ? model.slAtrMult : 4.5;
  const baseMinSlPct = model.minSlPct ?? (model.version >= 3 ? 3.0 : model.version >= 2 ? 3.5 : 0);
  const minSlPct = baseMinSlPct * tfThresholdScale;
  const tpMult = model.tpAtrMult > 0 ? model.tpAtrMult : 6.75;
  const targetRR = model.targetRR && model.targetRR > 0 ? model.targetRR : tpMult / slMult;

  let rollingCapital = config.capital;
  let lastTradeExitCandleIdx = -1;

  for (let eIdx = 0; eIdx < events.length; eIdx++) {
    const ev = events[eIdx];
    const entryCandleIdx = ev.candleIndex;

    if (model.sideFilter === 'BUY' && ev.side !== 'BUY') continue;
    if (model.sideFilter === 'SELL' && ev.side !== 'SELL') continue;

    if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
      continue;
    }

    const evalFeatures = normalizeMlFeaturesForTimeframe(ev.features, activeTf, modelTf);
    const score = predictZigZagMlScore(model, evalFeatures);
    if (score < model.scoreThreshold) {
      continue;
    }

    const direction: 'BUY' | 'SELL' = ev.side;
    const cycleType: 'bullish' | 'bearish' = direction === 'BUY' ? 'bullish' : 'bearish';
    const entryPrice = ev.close;
    const slDist = Math.max(entryPrice * (minSlPct / 100), slMult * ev.atr);
    const tpDist = slDist * targetRR;
    if (!(entryPrice > 0) || !(slDist > 0) || !(tpDist > 0)) continue;

    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit = direction === 'BUY' ? entryPrice + tpDist : entryPrice - tpDist;
    if (stopLoss <= 0 || takeProfit <= 0) continue;

    const riskAmount =
      config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
        ? config.riskAmountFixed
        : rollingCapital * ((config.riskPercent || 1) / 100);

    const effectiveExchange = config.exchange ?? 'xt';
    const sizing = calculateExactTradeSizing(
      riskAmount,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      config.symbol,
      {
        exchange: effectiveExchange,
        contractSize: config.xtContractSize,
        minNotional: config.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );

    const positionSize = sizing.quantizedPositionSize;
    const positionValue = sizing.positionValue;
    if (positionSize <= 0 || positionValue <= 0) continue;

    const realizedRisk = sizing.actualLossAtSL > 0 ? sizing.actualLossAtSL : riskAmount;
    const posToRiskRatio = riskAmount > 0 ? parseFloat((positionValue / riskAmount).toFixed(2)) : 0;
    if (maxPosRatio > 0 && posToRiskRatio > maxPosRatio) {
      continue;
    }

    const entryFee = sizing.entryFee;
    const maxHoldIdx = entryCandleIdx + timeStopBars;
    const simEndIdx = Math.min(candles.length - 1, maxHoldIdx);

    let status: TradeStatus = 'ACTIVE';
    let exitPrice: number | undefined = undefined;
    let exitTime: number | undefined = undefined;
    let exitCandleIdx: number | undefined = undefined;
    let reason = `ML Score ${score.toFixed(3)} • ${ev.patternLabelFa}`;

    for (let k = entryCandleIdx + 1; k <= simEndIdx; k++) {
      const c = candles[k];
      if (direction === 'BUY') {
        if (c.low <= stopLoss) {
          status = 'LOSS';
          exitPrice = stopLoss * (1 - slSlipRate);
          exitTime = c.time;
          exitCandleIdx = k;
          reason = `Stop Loss (${ev.patternLabelFa})`;
          break;
        }
        if (c.high >= takeProfit) {
          status = 'WIN';
          exitPrice = takeProfit;
          exitTime = c.time;
          exitCandleIdx = k;
          reason = `Take Profit (${ev.patternLabelFa})`;
          break;
        }
      } else {
        if (c.high >= stopLoss) {
          status = 'LOSS';
          exitPrice = stopLoss * (1 + slSlipRate);
          exitTime = c.time;
          exitCandleIdx = k;
          reason = `Stop Loss (${ev.patternLabelFa})`;
          break;
        }
        if (c.low <= takeProfit) {
          status = 'WIN';
          exitPrice = takeProfit;
          exitTime = c.time;
          exitCandleIdx = k;
          reason = `Take Profit (${ev.patternLabelFa})`;
          break;
        }
      }

      if (k === maxHoldIdx) {
        exitPrice = c.close;
        exitTime = c.time;
        exitCandleIdx = k;
        const grossTs =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        const netTs = grossTs - (entryFee + positionSize * exitPrice * exitFeeRate);
        status = netTs > 0 ? 'WIN' : 'LOSS';
        reason = 'TIME_STOP';
        break;
      }
    }

    if (status === 'ACTIVE') {
      exitPrice = candles[candles.length - 1].close;
    }

    const actualExitPrice = exitPrice ?? entryPrice;
    const tradeExitFee = positionSize * actualExitPrice * exitFeeRate;
    const tradeTotalFee = entryFee + tradeExitFee;
    const grossVal =
      direction === 'BUY'
        ? positionSize * (actualExitPrice - entryPrice)
        : positionSize * (entryPrice - actualExitPrice);
    const netVal = grossVal - tradeTotalFee;
    const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
    const nextCap = Math.max(1, parseFloat((rollingCapital + netVal).toFixed(4)));

    trades.push({
      id: `trade-s4-ml-${trades.length + 1}-${entryCandleIdx}`,
      strategyId: 'strategy_4_ml_zigzag',
      strategyName: `استراتژی ۴ (ML ZigZag - ${ev.patternLabelFa})`,
      cycleIndex: trades.length + 1,
      attemptNumber: 1,
      direction,
      cycleType,
      priceA: takeProfit,
      priceE: entryPrice,
      priceF: ev.pivotPrice,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount: parseFloat(riskAmount.toFixed(4)),
      targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
      realizedRisk: parseFloat(realizedRisk.toFixed(4)),
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      positionSize,
      positionValue: parseFloat(positionValue.toFixed(4)),
      positionToRiskRatio: posToRiskRatio,
      riskReward: parseFloat(targetRR.toFixed(2)),
      timeF: ev.pivotTime,
      candleIdxF: entryCandleIdx,
      entryTime: ev.time,
      entryCandleIdx,
      exitTime,
      exitCandleIdx,
      exitPrice,
      candlesElapsedToEntry: 0,
      candlesRemainingToEnter: 0,
      waitingForPostLeg: false,
      hasPostLeg: true,
      status,
      grossPnl: parseFloat(grossVal.toFixed(4)),
      entryFee: parseFloat(entryFee.toFixed(4)),
      exitFee: parseFloat(tradeExitFee.toFixed(4)),
      fee: parseFloat(tradeTotalFee.toFixed(4)),
      commission: parseFloat(tradeTotalFee.toFixed(4)),
      pnl: parseFloat(netVal.toFixed(4)),
      pnlPercent: parseFloat(((netVal / rollingCapital) * 100).toFixed(4)),
      returnR: riskAmount > 0 ? parseFloat((netVal / riskAmount).toFixed(3)) : 0,
      capitalBeforeTrade,
      capitalAfterTrade: nextCap,
      slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
      entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
      exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
      score: Number(score.toFixed(6)),
      confidence: Number(score.toFixed(6)),
      reason,
    });

    if (!config.disableCapitalCompounding) {
      rollingCapital = nextCap;
    }
    lastTradeExitCandleIdx = Math.max(
      lastTradeExitCandleIdx,
      exitCandleIdx !== undefined ? exitCandleIdx : candles.length
    );
  }

  const metrics = calculateMetrics(trades, config.capital);
  return { trades, metrics };
}

/**
 * Universal Strategy Dispatcher: runs Strategy 1, Strategy 2, Strategy 3, or Strategy 4 (ML ZigZag).
 */
export function runStrategyBacktest(
  candles: CandleData[],
  points: ZigZagPoint[],
  legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  if (config.selectedStrategyId === 'strategy_4_ml_zigzag') {
    return runStrategy4MlBacktest(candles, config, atrValues);
  } else if (config.selectedStrategyId === 'strategy_3_ab_midpoint') {
    return runStrategy3Backtest(candles, points, legs, config, atrValues, atrMultiplier, minCandles);
  } else if (config.selectedStrategyId === 'strategy_2_next_pivot') {
    return runStrategy2Backtest(candles, points, legs, config, atrValues, atrMultiplier, minCandles);
  } else if (config.selectedStrategyId === 'strategy_1_e_breakout') {
    return runStrategy1Backtest(candles, points, legs, config, atrValues, atrMultiplier, minCandles);
  }
  return {
    trades: [],
    metrics: getEmptyMetrics(config.capital),
  };
}

export function calculateMetrics(trades: StrategyTrade[], initialCapital: number): StrategyMetrics {
  let winTrades = 0;
  let lossTrades = 0;
  let breakevenTrades = 0;
  let activeTrades = 0;
  let pendingTrades = 0;
  let expiredTrades = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netProfit = 0;
  let rrSum = 0;
  let completedTradesCount = 0;
  let totalFee = 0;

  // Open position tracking (isolated completely from closed trade metrics)
  let openPositionsCount = 0;
  let openPositionsUnrealizedPnl = 0;
  let openPositionsFee = 0;

  let currentEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  // معاملات بر اساس زمان مرتب می‌شوند تا تقدم و تأخر واقعی شبیه‌سازی گردد
  const sortedTrades = [...trades].sort(
    (a, b) => (a.exitTime || a.entryTime || a.timeF || 0) - (b.exitTime || b.entryTime || b.timeF || 0)
  );

  for (const t of sortedTrades) {
    const isClosed = t.status === 'WIN' || t.status === 'LOSS' || (t.status as string) === 'BREAKEVEN' || (t.exitPrice !== undefined && t.exitPrice > 0 && t.status !== 'ACTIVE' && t.status !== 'PENDING' && t.status !== 'EXPIRED');

    if (isClosed) {
      completedTradesCount++;
      const tradeFee = t.fee !== undefined ? t.fee : (t.commission !== undefined ? t.commission : 0);
      totalFee += tradeFee;

      const pnl = t.pnl || 0;
      const gross = t.grossPnl !== undefined ? t.grossPnl : (pnl + tradeFee);

      if (gross > 0.0001) {
        grossProfit += gross;
      } else if (gross < -0.0001) {
        grossLoss += Math.abs(gross);
      }

      if (pnl > 0.0001) {
        winTrades++;
        totalProfit += pnl;
      } else if (pnl < -0.0001) {
        lossTrades++;
        totalLoss += Math.abs(pnl);
      } else {
        breakevenTrades++;
      }

      netProfit += pnl;
      currentEquity += pnl;

      if (t.riskReward !== undefined && t.riskReward > 0) {
        rrSum += t.riskReward;
      }

      // Peak & Drawdown based purely on closed equity curve
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const ddDollars = peakEquity - currentEquity;
      const ddPercent = peakEquity > 0 ? (ddDollars / peakEquity) * 100 : 0;
      if (ddDollars > maxDrawdown) {
        maxDrawdown = ddDollars;
      }
      if (ddPercent > maxDrawdownPercent) {
        maxDrawdownPercent = ddPercent;
      }
    } else if (t.status === 'ACTIVE' || (t.status as string) === 'OPEN') {
      activeTrades++;
      openPositionsCount++;
      openPositionsUnrealizedPnl += (t.pnl || 0);
      const fee = t.fee !== undefined ? t.fee : (t.commission !== undefined ? t.commission : 0);
      openPositionsFee += fee;
    } else if (t.status === 'PENDING') {
      pendingTrades++;
    } else if (t.status === 'EXPIRED') {
      expiredTrades++;
    }
  }

  const completedTrades = completedTradesCount; // Wins + Losses + Breakeven
  const winRate = completedTrades > 0 ? (winTrades / completedTrades) * 100 : 0;

  // Handle Profit Factor edge cases explicitly without arbitrary sentinels
  let profitFactor = 0;
  let profitFactorLabel = 'N/A — No Trades';

  if (completedTrades === 0) {
    profitFactor = 0;
    profitFactorLabel = 'N/A — No Trades';
  } else if (totalLoss <= 0.0001) {
    if (totalProfit > 0.0001) {
      profitFactor = Infinity;
      profitFactorLabel = 'No Losing Trades';
    } else {
      profitFactor = 0;
      profitFactorLabel = 'Breakeven Only';
    }
  } else {
    profitFactor = parseFloat((totalProfit / totalLoss).toFixed(2));
    profitFactorLabel = profitFactor.toFixed(2);
  }

  const avgRiskReward = completedTrades > 0 ? rrSum / completedTrades : 0;
  const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  // If NO closed trades exist, every closed-trade-derived statistic MUST be strictly ZERO or N/A
  if (completedTrades === 0) {
    return {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      breakevenTrades: 0,
      activeTrades,
      pendingTrades,
      expiredTrades,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      grossPnl: 0,
      totalProfit: 0,
      totalLoss: 0,
      totalFee: 0,
      netProfit: 0,
      netProfitPercent: 0,
      profitFactor: 0,
      profitFactorLabel: 'N/A — No Trades',
      avgRiskReward: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      finalEquity: initialCapital,
      openPositionsCount,
      openPositionsUnrealizedPnl: parseFloat(openPositionsUnrealizedPnl.toFixed(2)),
      openPositionsFee: parseFloat(openPositionsFee.toFixed(2)),
    };
  }

  return {
    totalTrades: completedTrades,
    winTrades,
    lossTrades,
    breakevenTrades,
    activeTrades,
    pendingTrades,
    expiredTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossLoss: parseFloat(grossLoss.toFixed(2)),
    grossPnl: parseFloat((grossProfit - grossLoss).toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    totalLoss: parseFloat(totalLoss.toFixed(2)),
    totalFee: parseFloat(totalFee.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
    profitFactorLabel,
    avgRiskReward: parseFloat(avgRiskReward.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    finalEquity: parseFloat(currentEquity.toFixed(2)),
    openPositionsCount,
    openPositionsUnrealizedPnl: parseFloat(openPositionsUnrealizedPnl.toFixed(2)),
    openPositionsFee: parseFloat(openPositionsFee.toFixed(2)),
  };
}

export function getEmptyMetrics(capital: number): StrategyMetrics {
  return {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    breakevenTrades: 0,
    activeTrades: 0,
    pendingTrades: 0,
    expiredTrades: 0,
    winRate: 0,
    grossProfit: 0,
    grossLoss: 0,
    grossPnl: 0,
    totalProfit: 0,
    totalLoss: 0,
    totalFee: 0,
    netProfit: 0,
    netProfitPercent: 0,
    profitFactor: 0,
    profitFactorLabel: 'N/A — No Trades',
    avgRiskReward: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    finalEquity: capital,
    openPositionsCount: 0,
    openPositionsUnrealizedPnl: 0,
    openPositionsFee: 0,
  };
}


export function runBreakoutStrategy(
  candles: CandleData[],
  points: CryptoZigZagPoint[] | any[],
  legs: Leg[] | any[],
  params: StrategyParams
): { trades: Trade[]; metrics: BacktestMetrics } {
  const trades: Trade[] = [];
  let capital = params.capital;
  const initialCapital = params.capital;

  for (let i = 1; i < points.length; i++) {
    const prevPivot = points[i - 1];
    const currPivot = points[i];
    const isLong = currPivot.type === 'LOW'; // Looking for bounce/breakout upward
    const entryCandleIndex = currPivot.index + 1;
    if (entryCandleIndex >= candles.length) break;

    const entryCandle = candles[entryCandleIndex];
    const entryPrice = entryCandle.open;
    const stopLoss = isLong ? currPivot.price * 0.995 : currPivot.price * 1.005;
    const risk = Math.abs(entryPrice - stopLoss);
    if (risk <= 0) continue;

    const targetRR = params.maxRiskReward && params.maxRiskReward > 0 ? params.maxRiskReward : 2.0;
    const takeProfit = isLong ? entryPrice + risk * targetRR : entryPrice - risk * targetRR;

    let status: 'OPEN' | 'WIN' | 'LOSS' | 'ACTIVE' = 'ACTIVE';
    let exitPrice = entryPrice;
    let exitIndex = entryCandleIndex;
    let exitTime = entryCandle.time;

    const checkLimit = Math.min(entryCandleIndex + (params.maxCandlesToEnter || 100), candles.length);
    for (let c = entryCandleIndex; c < checkLimit; c++) {
      const candle = candles[c];
      if (isLong) {
        if (candle.low <= stopLoss) {
          status = 'LOSS';
          exitPrice = stopLoss;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
        if (candle.high >= takeProfit) {
          status = 'WIN';
          exitPrice = takeProfit;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
      } else {
        if (candle.high >= stopLoss) {
          status = 'LOSS';
          exitPrice = stopLoss;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
        if (candle.low <= takeProfit) {
          status = 'WIN';
          exitPrice = takeProfit;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
      }
    }

    const riskBudget =
      params.riskMode === 'fixed' && params.riskAmountFixed && params.riskAmountFixed > 0
        ? params.riskAmountFixed
        : (capital * (params.riskPercent || 1)) / 100;
    const entryFeeRate =
      (params.entryCommissionPercent ??
        (params.commissionPercent !== undefined ? params.commissionPercent / 2 : 0.06)) / 100;
    const exitFeeRate =
      (params.exitCommissionPercent ??
        (params.commissionPercent !== undefined ? params.commissionPercent / 2 : 0.06)) / 100;
    const effectiveExchange = params.exchange ?? 'xt';
    const slSlipRate = (params.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

    if (status === 'LOSS') {
      exitPrice = isLong ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
    }

    const sizing = calculateExactTradeSizing(
      riskBudget,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      params.symbol,
      {
        exchange: effectiveExchange,
        contractSize: params.xtContractSize,
        minNotional: params.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );
    const positionSize = sizing.quantizedPositionSize;
    if (positionSize <= 0) continue;

    const riskAmount = riskBudget;
    const pnl = isLong
      ? (exitPrice - entryPrice) * positionSize
      : (entryPrice - exitPrice) * positionSize;
    const commission = entryPrice * positionSize * entryFeeRate + exitPrice * positionSize * exitFeeRate;
    const netPnl = pnl - commission;
    capital += netPnl;

    trades.push({
      id: `trade_${i}`,
      symbol: '',
      type: isLong ? 'BUY' : 'SELL',
      entryPrice,
      entryTime: entryCandle.time,
      entryIndex: entryCandleIndex,
      stopLoss,
      takeProfit,
      exitPrice,
      exitTime,
      exitIndex,
      status,
      grossPnl: pnl,
      fee: commission,
      commission,
      positionSize,
      positionValue: positionSize * entryPrice,
      riskAmount,
      targetRiskAmount: riskAmount,
      realizedRisk: sizing.actualLossAtSL,
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      pnl: parseFloat(netPnl.toFixed(4)),
      pnlPercent: parseFloat(((netPnl / riskAmount) * 100).toFixed(2)),
      returnR: riskAmount > 0 ? parseFloat((netPnl / riskAmount).toFixed(3)) : 0,
      riskReward: targetRR,
    });
  }

  const winTrades = trades.filter((t) => t.status === 'WIN').length;
  const lossTrades = trades.filter((t) => t.status === 'LOSS').length;
  const activeTrades = trades.filter((t) => t.status === 'ACTIVE').length;
  const totalTrades = winTrades + lossTrades;
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
  const netProfit = capital - initialCapital;
  const netProfitPercent = (netProfit / initialCapital) * 100;

  const totalProfit = trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const totalFee = trades.reduce((sum, t) => sum + t.commission, 0);
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 10 : 0;

  let peak = initialCapital;
  let maxDD = 0;
  let running = initialCapital;
  for (const t of trades) {
    running += t.pnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  const maxDrawdownPercent = peak > 0 ? (maxDD / peak) * 100 : 0;

  return {
    trades,
    metrics: {
      totalTrades: trades.length,
      winTrades,
      lossTrades,
      activeTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalLoss: parseFloat(totalLoss.toFixed(2)),
      totalFee: parseFloat(totalFee.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      avgRiskReward: params.maxRiskReward || 2,
      maxDrawdown: parseFloat(maxDD.toFixed(2)),
      maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    },
  };
}

export function runNextPivotStrategy(
  candles: CandleData[],
  points: CryptoZigZagPoint[] | any[],
  legs: Leg[] | any[],
  params: StrategyParams,
  atrValues: number[],
  atrMult: number,
  minCandles: number
): { trades: Trade[]; metrics: BacktestMetrics } {
  return runBreakoutStrategy(candles, points, legs, params);
}

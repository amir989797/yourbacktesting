/**
 * Backend Strategy Engine & Signal Generator
 * 
 * Runs 100% in-memory on the Node.js backend with ZERO browser or DOM dependencies.
 * Powers the 24/7 autonomous live scanner, signal evaluation, and order dispatcher.
 */

import { CandleData, ZigZagPoint, Leg } from '../types/crypto';
import { StrategyConfig, DEFAULT_STRATEGY_CONFIG, Trade } from '../types/strategy';
import { calculateATR, calculateAtrZigZag, analyzeZigZagLegs } from '../utils/indicators';
import { runStrategy1Backtest, runStrategy2Backtest } from '../utils/strategyEngine';
import {
  calculateExactTradeSizing,
  calculateXtContractQuantity,
  calculateXtRiskBudgetedOrder,
  XtRiskBudgetedResult,
  getSymbolLotRule,
} from '../utils/exchangePrecision';

export {
  calculateATR,
  calculateAtrZigZag,
  analyzeZigZagLegs,
  runStrategy1Backtest,
  runStrategy2Backtest,
  calculateExactTradeSizing,
  calculateXtContractQuantity,
  calculateXtRiskBudgetedOrder,
  getSymbolLotRule,
};
export type { XtRiskBudgetedResult };

export interface ServerStrategyConfig {
  strategyId: 'strategy_1_e_breakout' | 'strategy_2_next_pivot';
  timeframe: string;
  atrPeriod: number;
  atrMultiplier: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  longLegAtrMultiplier: number;
  minCandlesForBlueLeg?: number;
  blueLegAtrMultiplier?: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  riskRewardRatio: number;
  riskMode: 'percent' | 'fixed';
  riskAmountFixed?: number;
  riskPercent?: number;
  maxCandlesToEnter?: number;
  noConcurrentPositions?: boolean;
  maxPositionToRiskRatio?: number;
  exchange?: 'xt' | 'binance';
  entryCommissionPercent?: number;
  exitCommissionPercent?: number;
  xtContractSize?: number;
  xtMinNotional?: number;
  slSlippagePercent?: number;
  timeStopEnabled?: boolean;
  timeStopCandles?: number;
}

export interface CandidateSignal {
  symbol: string;
  posSide: 'LONG' | 'SHORT';
  side: 'BUY' | 'SELL';
  curPrice: number;
  stopLoss: number;
  takeProfit: number;
  signalEntryPrice?: number;
  signalTakeProfit?: number;
  signalStopDist?: number;
  entryCandleTime?: number;
  feeToRiskRatio?: number;
  riskReward?: number;
  contractQty: number;
  stepSize?: number;
  qtyPrecision?: number;
  maxLeverage: number;
  requiredMargin: number;
  notionalUsdt: number;
  riskUsdt: number;
  positionToRiskRatio?: number;
  targetRiskUsdt?: number;
  strategyName: string;
  timeframe?: string;
  discoveredAt: string;
}

export function getTimeframeDurationMs(tf?: string): number {
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

/**
 * Strips the trailing candle if it is still open/forming so ATR, ZigZag,
 * and Strategy 2 run strictly on completed closed candles (matching Backtest).
 */
export function stripFormingCandle(
  candles: CandleData[],
  timeframe?: string,
  nowMs: number = Date.now()
): CandleData[] {
  if (!candles || candles.length === 0) return candles;
  const tfMs = getTimeframeDurationMs(timeframe);
  const last = candles[candles.length - 1];
  const lastOpenMs = last.time > 1e12 ? last.time : last.time * 1000;
  // Keep 2s clock-skew tolerance so a candle closed right now is kept
  if (lastOpenMs + tfMs > nowMs + 2000) {
    return candles.slice(0, -1);
  }
  return candles;
}

/**
 * Standardize symbol into XT format (e.g. BTCUSDT -> btc_usdt)
 */
export function toXtSymbol(symbol: string): string {
  if (!symbol) return 'btc_usdt';
  let s = symbol.toLowerCase().replace('/', '');
  if (s.endsWith('usdt') && !s.includes('_')) {
    s = s.slice(0, -4) + '_usdt';
  } else if (!s.includes('_')) {
    s = s + '_usdt';
  }
  const standardMemeMap: Record<string, string> = {
    'pepe_usdt': '1000pepe_usdt',
    'shib_usdt': '1000shib_usdt',
    'bonk_usdt': '1000bonk_usdt',
    'floki_usdt': '1000floki_usdt',
    'lunc_usdt': '1000lunc_usdt',
    'rats_usdt': '1000rats_usdt',
    'sats_usdt': '1000sats_usdt',
    'xec_usdt': '1000xec_usdt',
    'cat_usdt': '1000cat_usdt',
    'cheems_usdt': '1000cheems_usdt',
    'btt_usdt': '1000btt_usdt',
  };
  return standardMemeMap[s] || s;
}

/**
 * Determine max leverage allowed for symbol on XT & Binance
 */
export function getMaxLeverageForSymbol(rawSymbol: string): number {
  const base = rawSymbol.replace('_', '').replace('USDT', '').toUpperCase();
  if (base === 'BTC') return 100;
  if (base === 'ETH') return 75;
  if (['SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LTC', 'BCH'].includes(base)) return 50;
  if (['SUI', 'NEAR', 'AVAX', 'LINK', 'PEPE', 'SHIB', 'DOT', 'APT', 'FET', 'RENDER'].includes(base)) return 25;
  return 20;
}

/**
 * Evaluates a cryptocurrency pair in-memory on the backend and detects active breakout/entry signals.
 * Runs strictly on closed candles to preserve 100% ATR / ZigZag / Entry parity with the Backtester.
 */
export function evaluateSymbolForLiveSignal(params: {
  symbol: string;
  candles: CandleData[];
  config: ServerStrategyConfig;
  availableBalance: number;
  hasExistingPosition?: boolean;
  nowMs?: number;
}): CandidateSignal | null {
  const { symbol, candles: rawCandles, config, availableBalance, hasExistingPosition, nowMs } = params;

  const candles = stripFormingCandle(rawCandles, config.timeframe, nowMs ?? Date.now());
  if (!candles || candles.length < 50) {
    return null;
  }

  // If single position mode is enabled and position already exists for this symbol, skip
  if (config.noConcurrentPositions && hasExistingPosition) {
    return null;
  }

  // 1. Run technical indicators strictly on closed candles
  const atrResult = calculateATR(candles, config.atrPeriod || 14);
  const atrValues = atrResult.atrValues;

  const zzResult = calculateAtrZigZag(
    candles,
    atrValues,
    config.atrMultiplier || 2.0,
    config.minCandles || 5
  );

  const analyzedLegs = analyzeZigZagLegs(
    zzResult.points,
    config.minCandlesForLongLeg || 5,
    config.longLegAtrMultiplier || 3.0,
    config.maxBlueLegPercent || 70,
    config.maxBreakoutAtrMultiplier || 3.0,
    candles,
    config.minCandlesForBlueLeg ?? 1,
    config.blueLegAtrMultiplier ?? 0.1
  );

  // 2. Configure strategy parameters
  const entryFeePct = config.entryCommissionPercent ?? 0.06;
  const exitFeePct = config.exitCommissionPercent ?? 0.06;
  const stratConfig: StrategyConfig = {
    ...DEFAULT_STRATEGY_CONFIG,
    capital: availableBalance > 0 ? availableBalance : 1000,
    riskMode: config.riskMode || 'percent',
    riskAmountFixed: config.riskAmountFixed || 10,
    riskPercent: config.riskPercent || 1.0,
    entryCommissionPercent: entryFeePct,
    exitCommissionPercent: exitFeePct,
    commissionPercent: parseFloat((entryFeePct + exitFeePct).toFixed(4)),
    maxRiskReward: config.riskRewardRatio || 2.0,
    selectedStrategyId: config.strategyId || 'strategy_2_next_pivot',
    maxCandlesToEnter: config.maxCandlesToEnter || 35,
    noConcurrentPositions: Boolean(config.noConcurrentPositions),
    maxPositionToRiskRatio: config.maxPositionToRiskRatio ?? 300,
    exchange: config.exchange ?? 'xt',
    xtContractSize: config.xtContractSize,
    xtMinNotional: config.xtMinNotional,
    slSlippagePercent: config.slSlippagePercent ?? ((config.exchange ?? 'xt') === 'xt' ? 0.04 : 0),
    timeStopEnabled: config.timeStopEnabled !== false,
    timeStopCandles: config.timeStopCandles ?? 80,
    symbol,
  };

  // 3. Run Strategy Backtest Engine on closed candles
  let evalTrades: any[] = [];
  if (config.strategyId === 'strategy_2_next_pivot') {
    const res = runStrategy2Backtest(
      candles,
      zzResult.points,
      analyzedLegs,
      stratConfig,
      atrValues,
      config.atrMultiplier || 2.0,
      config.minCandles || 5
    );
    evalTrades = res.trades;
  } else {
    const res = runStrategy1Backtest(candles, zzResult.points, analyzedLegs, stratConfig);
    evalTrades = res.trades;
  }

  if (!evalTrades || evalTrades.length === 0) {
    return null;
  }

  // 4. Require signal on the FRESHLY closed candle ONLY (no 2-candle stale entry drift)
  const lastTrade = evalTrades[evalTrades.length - 1];
  const isFreshClosedEntry = lastTrade.entryCandleIdx === candles.length - 1;

  if (!isFreshClosedEntry || (lastTrade.status !== 'ACTIVE' && lastTrade.status !== 'OPEN')) {
    return null;
  }

  // 5. Construct precise candidate signal with SL Breach, Chase, and Capped TP guards
  const side: 'BUY' | 'SELL' = lastTrade.direction === 'BUY' ? 'BUY' : 'SELL';
  const posSide: 'LONG' | 'SHORT' = lastTrade.direction === 'BUY' ? 'LONG' : 'SHORT';
  const curPrice = candles[candles.length - 1].close;
  const targetRR = config.riskRewardRatio && config.riskRewardRatio > 0 ? config.riskRewardRatio : 2.0;

  if (!(curPrice > 0) || !(lastTrade.stopLoss > 0)) {
    return null;
  }

  const stopLoss = lastTrade.stopLoss;
  // SL Breach Guard: reject if close already crossed Stop Loss
  if (posSide === 'LONG' ? curPrice <= stopLoss : curPrice >= stopLoss) {
    return null;
  }

  const stopDistance = Math.abs(curPrice - stopLoss);
  if (stopDistance <= 0) {
    return null;
  }

  const signalEntryPrice = Number(lastTrade.entryPrice) > 0 ? Number(lastTrade.entryPrice) : curPrice;
  const signalTakeProfit = Number(lastTrade.takeProfit) > 0
    ? Number(lastTrade.takeProfit)
    : (posSide === 'LONG' ? curPrice + stopDistance * targetRR : curPrice - stopDistance * targetRR);
  const signalStopDist = Math.abs(signalEntryPrice - stopLoss);

  // Chase Guard: reject if closed price already stretched >25% away from SL or covered >=35% to backtest TP
  if (signalStopDist > 0) {
    if (stopDistance > signalStopDist * 1.25) {
      return null;
    }
    const signalTpDist = Math.abs(signalTakeProfit - signalEntryPrice);
    if (signalTpDist > 0) {
      const progressTowardTP = posSide === 'LONG'
        ? (curPrice - signalEntryPrice) / signalTpDist
        : (signalEntryPrice - curPrice) / signalTpDist;
      if (progressTowardTP >= 0.35) {
        return null;
      }
    }
  }

  // Capped TP Parity: never stretch TP farther than Backtest signalTakeProfit
  const rrTargetTp = posSide === 'LONG'
    ? curPrice + stopDistance * targetRR
    : curPrice - stopDistance * targetRR;
  const takeProfit = posSide === 'LONG'
    ? Math.min(signalTakeProfit, rrTargetTp)
    : Math.max(signalTakeProfit, rrTargetTp);

  if (posSide === 'LONG' ? takeProfit <= curPrice : takeProfit >= curPrice) {
    return null;
  }

  const maxLev = getMaxLeverageForSymbol(symbol);
  const riskBudgetUsdt = config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
    ? config.riskAmountFixed
    : availableBalance * ((config.riskPercent || 1) / 100);

  const entryFeeRate = entryFeePct / 100;
  const exitFeeRate = exitFeePct / 100;
  const effectiveExchange = config.exchange ?? 'xt';
  const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

  // Exact trade sizing calculation with XT integer contracts / exchange stepSize and tick truncation
  const sizing = calculateExactTradeSizing(
    riskBudgetUsdt,
    curPrice,
    stopLoss,
    takeProfit,
    entryFeeRate,
    exitFeeRate,
    symbol,
    {
      exchange: effectiveExchange,
      contractSize: config.xtContractSize,
      minNotional: config.xtMinNotional,
      riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
      slSlippageRate: slSlipRate,
    }
  );

  const contractQty = sizing.contractQty ?? sizing.quantizedPositionSize;
  const notionalUsdt = sizing.positionValue;
  const requiredMargin = parseFloat((notionalUsdt / maxLev).toFixed(2));
  const actualRiskUsdt = sizing.actualLossAtSL;

  if (sizing.exceedsRiskBudget || sizing.quantizedPositionSize <= 0 || notionalUsdt <= 0) {
    return null;
  }

  // Track Fee-to-Risk Ratio for diagnostics (already bounded by maxPositionToRiskRatio)
  const totalRoundTripFeeAtSL = sizing.totalFeesAtSL || (sizing.entryFee + sizing.exitFeeAtSL);
  const feeToRiskRatio = riskBudgetUsdt > 0 ? totalRoundTripFeeAtSL / riskBudgetUsdt : 0;

  const maxPosRatio = config.maxPositionToRiskRatio !== undefined ? config.maxPositionToRiskRatio : 300;
  const posToRiskRatio = (riskBudgetUsdt > 0)
    ? parseFloat((notionalUsdt / riskBudgetUsdt).toFixed(2))
    : 0;

  if (maxPosRatio > 0 && posToRiskRatio > maxPosRatio) {
    return null;
  }

  return {
    symbol,
    posSide,
    side,
    curPrice,
    stopLoss,
    takeProfit,
    signalEntryPrice,
    signalTakeProfit,
    signalStopDist,
    entryCandleTime: candles[lastTrade.entryCandleIdx]?.time,
    feeToRiskRatio: parseFloat(feeToRiskRatio.toFixed(4)),
    riskReward: targetRR,
    contractQty,
    stepSize: sizing.stepSize,
    qtyPrecision: sizing.qtyPrecision,
    maxLeverage: maxLev,
    requiredMargin,
    notionalUsdt: parseFloat(notionalUsdt.toFixed(2)),
    riskUsdt: parseFloat(actualRiskUsdt.toFixed(2)),
    positionToRiskRatio: posToRiskRatio,
    targetRiskUsdt: parseFloat(riskBudgetUsdt.toFixed(2)),
    strategyName: config.strategyId === 'strategy_2_next_pivot' ? 'استراتژی ۲ (Next-Pivot)' : 'استراتژی ۱ (E-Breakout)',
    discoveredAt: new Date().toISOString(),
  };
}

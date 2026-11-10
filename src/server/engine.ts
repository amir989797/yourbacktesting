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
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  minVolumeGrowthPercent?: number;
  riskRewardRatio: number;
  riskMode: 'percent' | 'fixed';
  riskAmountFixed?: number;
  riskPercent?: number;
  maxCandlesToEnter?: number;
  noConcurrentPositions?: boolean;
  maxPositionToRiskRatio?: number;
}

export interface CandidateSignal {
  symbol: string;
  posSide: 'LONG' | 'SHORT';
  side: 'BUY' | 'SELL';
  curPrice: number;
  stopLoss: number;
  takeProfit: number;
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
 * Returns CandidateSignal if a valid trade entry occurred on the current/recent candle, or null if no signal.
 */
export function evaluateSymbolForLiveSignal(params: {
  symbol: string;
  candles: CandleData[];
  config: ServerStrategyConfig;
  availableBalance: number;
  hasExistingPosition?: boolean;
}): CandidateSignal | null {
  const { symbol, candles, config, availableBalance, hasExistingPosition } = params;

  if (!candles || candles.length < 50) {
    return null;
  }

  // If single position mode is enabled and position already exists for this symbol, skip
  if (config.noConcurrentPositions && hasExistingPosition) {
    return null;
  }

  // 1. Run technical indicators
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
    config.minVolumeGrowthPercent || 0
  );

  // 2. Configure strategy parameters
  const stratConfig: StrategyConfig = {
    ...DEFAULT_STRATEGY_CONFIG,
    capital: availableBalance > 0 ? availableBalance : 1000,
    riskMode: config.riskMode || 'percent',
    riskAmountFixed: config.riskAmountFixed || 10,
    riskPercent: config.riskPercent || 1.0,
    maxRiskReward: config.riskRewardRatio || 2.0,
    selectedStrategyId: config.strategyId || 'strategy_2_next_pivot',
    maxCandlesToEnter: config.maxCandlesToEnter || 35,
    noConcurrentPositions: Boolean(config.noConcurrentPositions),
    maxPositionToRiskRatio: config.maxPositionToRiskRatio ?? 300,
    minVolumeGrowthPercent: config.minVolumeGrowthPercent || 0,
    symbol,
  };

  // 3. Run Strategy Backtest Engine on candles
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

  // 4. Verify whether an entry occurred on the current or immediately preceding candle
  const lastTrade = evalTrades[evalTrades.length - 1];
  const isCurrentCandleEntry = lastTrade.entryCandleIdx >= candles.length - 2;

  if (!isCurrentCandleEntry || (lastTrade.status !== 'ACTIVE' && lastTrade.status !== 'OPEN')) {
    return null;
  }

  // 5. Construct precise candidate signal
  const side: 'BUY' | 'SELL' = lastTrade.direction === 'BUY' ? 'BUY' : 'SELL';
  const posSide: 'LONG' | 'SHORT' = lastTrade.direction === 'BUY' ? 'LONG' : 'SHORT';
  const curPrice = candles[candles.length - 1].close;
  const targetRR = config.riskRewardRatio && config.riskRewardRatio > 0 ? config.riskRewardRatio : 2.0;

  // Exact Stop Loss from pivot leg
  const stopLoss = (lastTrade.stopLoss && lastTrade.stopLoss > 0)
    ? lastTrade.stopLoss
    : (posSide === 'LONG' ? curPrice * 0.98 : curPrice * 1.02);

  const stopDistance = Math.abs(curPrice - stopLoss);
  if (stopDistance <= 0) {
    return null;
  }

  // Exact Take Profit strictly matching configured targetRR without arbitrary toFixed truncation
  const takeProfit = posSide === 'LONG'
    ? curPrice + stopDistance * targetRR
    : curPrice - stopDistance * targetRR;
  const maxLev = getMaxLeverageForSymbol(symbol);

  const riskBudgetUsdt = config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
    ? config.riskAmountFixed
    : availableBalance * ((config.riskPercent || 1) / 100);

  // Exact trade sizing calculation with exchange step size and tick truncation
  const sizing = calculateExactTradeSizing(
    riskBudgetUsdt,
    curPrice,
    stopLoss,
    takeProfit,
    0.0006,
    0.0006,
    symbol
  );

  const contractQty = sizing.quantizedPositionSize;
  const notionalUsdt = sizing.positionValue;
  const requiredMargin = parseFloat((notionalUsdt / maxLev).toFixed(2));
  const actualRiskUsdt = sizing.actualLossAtSL;

  const maxPosRatio = config.maxPositionToRiskRatio !== undefined ? config.maxPositionToRiskRatio : 300;
  const posToRiskRatio = (actualRiskUsdt > 0)
    ? parseFloat((notionalUsdt / actualRiskUsdt).toFixed(2))
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

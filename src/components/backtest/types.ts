import { CryptoPair, CandleData, Timeframe, ExchangeType } from '../../types/crypto';
import { StrategyTrade } from '../../types/strategy';

export interface BacktestResultItem {
  pair: CryptoPair;
  stage?: string;
  candlesCount: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  breakevenTrades?: number;
  activeTrades: number;
  winRate: number;
  grossProfit?: number;
  grossLoss?: number;
  grossPnl?: number;
  netProfit: number;
  netProfitPercent: number;
  totalProfit: number;
  totalLoss: number;
  totalFee: number;
  profitFactor: number;
  profitFactorLabel?: string;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  optimalRiskForDD20: number;
  openPositionsCount?: number;
  openPositionsUnrealizedPnl?: number;
  openPositionsFee?: number;
  rejectedTradesCount?: number;
  lastTradeStatus?: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'ACTIVE';
  trades: StrategyTrade[];
}

export interface OptimizationTrial {
  id: number;
  hash: string;
  timestamp: string;
  // ۸ پارامتر استراتژی
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
  // خروجی‌های شبیه‌سازی
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  netProfit: number;
  totalFees?: number; // مجموع کارمزد معاملات
  maxDrawdown: number;
  profitFactor: number;
  isValid: boolean; // آیا هر ۳ شرط درودان، وین‌ریت و تعداد معامله برقرار است؟
  qualityScore?: number; // نمره کیفیت چندمعیاره هوشمند
}

export interface ParameterRange {
  min: number;
  max: number;
  globalMin: number;
  globalMax: number;
  bestVal: number;
  bestValProfit?: number;
  bestValScore?: number;
  step: number;
  convergence: number; // 0 - 100%
  isManualOverride?: boolean;
}

export interface AdaptiveRanges {
  atrPeriod: ParameterRange;
  minCandles: ParameterRange;
  minCandlesForLongLeg: ParameterRange;
  atrMultiplier: ParameterRange;
  longLegAtrMultiplier: ParameterRange;
  maxBlueLegPercent: ParameterRange;
  maxBreakoutAtrMultiplier: ParameterRange;
  maxRiskReward: ParameterRange;
}

export type SortDirection = 'asc' | 'desc';
export type ScannerSortCol =
  | 'symbol'
  | 'totalTrades'
  | 'winRate'
  | 'netProfit'
  | 'totalFee'
  | 'profitFactor'
  | 'maxDrawdownPercent'
  | 'optimalRiskForDD20';
export type OptSortCol = keyof OptimizationTrial;

// حافظه کش ماندگار کندل‌های دانلودشده در طول سشن مرورگر
export const GLOBAL_CANDLE_CACHE = new Map<string, { pair: CryptoPair; candles: CandleData[]; timeframe: string }>();

export const toMs = (ts: number | null | undefined): number => {
  if (!ts || isNaN(ts)) return 0;
  return ts < 1e11 ? ts * 1000 : ts;
};

export const toSec = (ts: number | null | undefined): number => {
  if (!ts || isNaN(ts)) return 0;
  return ts > 1e11 ? Math.floor(ts / 1000) : ts;
};

export function getDefaultRangesForContext(timeframe: Timeframe, strategyId: string): AdaptiveRanges {
  const isScalp = timeframe === '5m';
  const isSwing = timeframe === '1h' || timeframe === '4h' || timeframe === '1d' || timeframe === '1w';

  const makeRange = (
    min: number,
    max: number,
    globalMin: number,
    globalMax: number,
    bestVal: number,
    step: number
  ): ParameterRange => {
    const span = max - min;
    const globalSpan = globalMax - globalMin;
    const convergence = Math.round(Math.max(10, Math.min(95, (1 - span / globalSpan) * 100)));
    return {
      min,
      max,
      globalMin,
      globalMax,
      bestVal,
      step,
      convergence,
      isManualOverride: false,
    };
  };

  if (isScalp) {
    return {
      atrPeriod: makeRange(20, 65, 12, 100, 45, 5),
      minCandles: makeRange(2, 5, 1, 8, 3, 1),
      minCandlesForLongLeg: makeRange(8, 22, 5, 36, 14, 2),
      atrMultiplier: makeRange(2.0, 4.25, 1.5, 6.0, 3.0, 0.25),
      longLegAtrMultiplier: makeRange(6.0, 14.5, 4.0, 22.0, 9.5, 0.5),
      maxBlueLegPercent: makeRange(35, 75, 20, 90, 55, 5),
      maxBreakoutAtrMultiplier: makeRange(2.0, 5.5, 1.0, 8.0, 3.5, 0.5),
      maxRiskReward: makeRange(1.5, 4.5, 1.0, 10.0, 2.5, 0.25),
    };
  }

  if (isSwing) {
    return {
      atrPeriod: makeRange(14, 45, 8, 80, 24, 2),
      minCandles: makeRange(1, 4, 1, 6, 2, 1),
      minCandlesForLongLeg: makeRange(5, 16, 4, 24, 10, 1),
      atrMultiplier: makeRange(1.5, 3.5, 1.0, 5.0, 2.4, 0.2),
      longLegAtrMultiplier: makeRange(4.5, 12.0, 3.0, 18.0, 8.0, 0.5),
      maxBlueLegPercent: makeRange(30, 70, 20, 85, 50, 5),
      maxBreakoutAtrMultiplier: makeRange(1.5, 5.0, 1.0, 7.0, 3.0, 0.5),
      maxRiskReward: makeRange(1.5, 7.0, 1.0, 12.0, 3.5, 0.5),
    };
  }

  // Medium timeframes (15m, 30m)
  return {
    atrPeriod: makeRange(18, 55, 10, 90, 32, 4),
    minCandles: makeRange(1, 5, 1, 8, 3, 1),
    minCandlesForLongLeg: makeRange(6, 20, 5, 30, 14, 2),
    atrMultiplier: makeRange(1.8, 4.0, 1.2, 5.5, 2.8, 0.25),
    longLegAtrMultiplier: makeRange(5.0, 14.0, 3.5, 20.0, 9.0, 0.5),
    maxBlueLegPercent: makeRange(35, 75, 25, 85, 55, 5),
    maxBreakoutAtrMultiplier: makeRange(1.8, 5.5, 1.0, 7.5, 3.5, 0.5),
    maxRiskReward: makeRange(1.5, 6.0, 1.0, 10.0, 3.0, 0.5),
  };
}

export const DEFAULT_RANGES: AdaptiveRanges = getDefaultRangesForContext('15m', 'zigzag-hybrid');

export function calculateQualityScore(trial: {
  netProfit: number;
  profitFactor: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  targetMaxDrawdown: number;
  targetMinWinRate: number;
  targetMinTrades: number;
}): number {
  if (trial.totalTrades < 5) return -1000;
  let penalty = 0;
  if (trial.maxDrawdown > trial.targetMaxDrawdown) {
    penalty += (trial.maxDrawdown - trial.targetMaxDrawdown) * 15;
  }
  if (trial.winRate < trial.targetMinWinRate) {
    penalty += (trial.targetMinWinRate - trial.winRate) * 10;
  }
  if (trial.totalTrades < trial.targetMinTrades) {
    penalty += (trial.targetMinTrades - trial.totalTrades) * 2;
  }

  const profitScore = Math.max(-500, trial.netProfit) * 0.15;
  const pfScore = Math.min(trial.profitFactor, 10) * 35;
  const winRateScore = trial.winRate * 2.2;
  const ddSafety = Math.max(0, 25 - trial.maxDrawdown) * 4;
  const tradeVolumeBonus = Math.min(trial.totalTrades, 500) * 0.15;

  return parseFloat((profitScore + pfScore + winRateScore + ddSafety + tradeVolumeBonus - penalty).toFixed(2));
}

export function refineAdaptiveRangesSmart(
  currentRanges: AdaptiveRanges,
  eliteTrials: OptimizationTrial[],
  totalEvaluated: number,
  autoAdaptiveEnabled: boolean
): AdaptiveRanges {
  if (!autoAdaptiveEnabled || eliteTrials.length < 2) return currentRanges;

  const validElites = eliteTrials.filter((t) => t.isValid && t.netProfit > 0);
  const samplePool = validElites.length >= 2 ? validElites : eliteTrials.slice(0, 5);
  if (samplePool.length === 0) return currentRanges;

  const nextRanges: AdaptiveRanges = { ...currentRanges };
  const keys: (keyof AdaptiveRanges)[] = [
    'atrPeriod',
    'minCandles',
    'minCandlesForLongLeg',
    'atrMultiplier',
    'longLegAtrMultiplier',
    'maxBlueLegPercent',
    'maxBreakoutAtrMultiplier',
    'maxRiskReward',
  ];

  for (const key of keys) {
    const r = { ...nextRanges[key] };
    if (r.isManualOverride) continue;

    const values = samplePool.map((t) => Number(t[key]) || 0);
    let weightedSum = 0;
    let totalWeight = 0;
    for (const t of samplePool) {
      const weight = Math.max(1, t.netProfit > 0 ? t.netProfit : 1);
      weightedSum += (Number(t[key]) || 0) * weight;
      totalWeight += weight;
    }
    const center = totalWeight > 0 ? weightedSum / totalWeight : values.reduce((a, b) => a + b, 0) / values.length;

    const variance = values.reduce((sum, v) => sum + Math.pow(v - center, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const coolingFactor = Math.max(0.45, 1.0 - (totalEvaluated / 1200));
    const spread = Math.max(r.step * 1.5, (stdDev * 1.6 + r.step * 2) * coolingFactor);

    let newMin = Math.max(r.globalMin, center - spread);
    let newMax = Math.min(r.globalMax, center + spread);

    newMin = Math.round(newMin / r.step) * r.step;
    newMax = Math.round(newMax / r.step) * r.step;

    if (newMax - newMin < r.step * 3) {
      newMin = Math.max(r.globalMin, center - r.step * 2);
      newMax = Math.min(r.globalMax, center + r.step * 2);
    }

    const bestTrial = samplePool[0];
    r.bestVal = Number(bestTrial[key]);
    r.min = parseFloat(newMin.toFixed(2));
    r.max = parseFloat(newMax.toFixed(2));

    const span = r.max - r.min;
    const globalSpan = r.globalMax - r.globalMin;
    r.convergence = Math.round(Math.max(0, Math.min(100, (1 - span / globalSpan) * 100)));

    nextRanges[key] = r;
  }

  return nextRanges;
}

export function generateConfigHash(p: {
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
}): string {
  return `${p.atrPeriod}_${p.minCandles}_${p.minCandlesForLongLeg}_${p.atrMultiplier}_${p.longLegAtrMultiplier}_${p.maxBlueLegPercent}_${p.maxBreakoutAtrMultiplier}_${p.maxRiskReward}`;
}

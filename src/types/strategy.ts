import { CandleData, CryptoPair, Leg, ZigZagPoint, ZigZagSettings as CryptoZigZagSettings } from './crypto.ts';

export type ZigZagSettings = CryptoZigZagSettings;

export interface StrategyParams {
  capital: number;
  selectedStrategyId: string;
  riskPercent: number;
  entryCommissionPercent: number;
  exitCommissionPercent: number;
  commissionPercent: number;
  maxRiskReward: number;
  maxCandlesToEnter: number;
  maxTradesPerLeg: number;
  showOnChart: boolean;
  noConcurrentPositions?: boolean; // عدم ورود به معامله جدید در صورت وجود پوزیشن باز
}

export type StrategyConfig = StrategyParams;

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  capital: 10000,
  selectedStrategyId: 'strategy_1_e_breakout',
  riskPercent: 1.0,
  maxCandlesToEnter: 100,
  maxRiskReward: 2,
  maxTradesPerLeg: 3,
  showOnChart: true,
  noConcurrentPositions: false,
  commissionPercent: 0.12, // مجموع ورود و خروج: 0.06% + 0.06% = 0.12%
  entryCommissionPercent: 0.06, // 0.06% ورود
  exitCommissionPercent: 0.06, // 0.06% خروج
};

export type TradeStatus = 'PENDING' | 'ACTIVE' | 'WIN' | 'LOSS' | 'EXPIRED' | 'OPEN';

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  entryTime: number;
  entryIndex: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  exitTime?: number;
  exitIndex?: number;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'ACTIVE' | TradeStatus;
  pnl: number;
  pnlPercent: number;
  commission: number;
  riskReward: number;
  reason?: string;
  // Strategy extended properties
  strategyId?: string;
  strategyName?: string;
  cycleIndex?: number;
  attemptNumber?: number;
  direction?: 'BUY' | 'SELL';
  cycleType?: 'bullish' | 'bearish';
  priceA?: number;
  priceE?: number;
  priceF?: number;
  riskAmount?: number;
  positionSize?: number;
  positionValue?: number;
  timeF?: number;
  candleIdxF?: number;
  entryCandleIdx?: number;
  exitCandleIdx?: number;
  candlesElapsedToEntry?: number;
  candlesRemainingToEnter?: number;
  waitingForPostLeg?: boolean;
  hasPostLeg?: boolean;
  grossPnl?: number;
  entryFee?: number;
  exitFee?: number;
  fee?: number;
}

export interface StrategyTrade {
  id: string;
  symbol?: string;
  type?: 'BUY' | 'SELL';
  strategyId?: string;
  strategyName?: string;
  cycleIndex: number;
  attemptNumber?: number;
  direction: 'BUY' | 'SELL';
  cycleType: 'bullish' | 'bearish';
  // Pivot key levels
  priceA: number; // Target price
  priceE: number; // Entry price level
  priceF: number; // Stop Loss price level
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  positionSize: number;
  positionValue: number;
  riskReward: number;
  // Timestamps & Candle Indexes
  timeF: number; // Formation time of point F
  candleIdxF: number;
  entryTime?: number;
  entryCandleIdx?: number;
  entryIndex?: number;
  exitTime?: number;
  exitCandleIdx?: number;
  exitIndex?: number;
  exitPrice?: number;
  candlesElapsedToEntry?: number;
  candlesRemainingToEnter?: number;
  waitingForPostLeg?: boolean;
  hasPostLeg?: boolean;
  status: TradeStatus;
  grossPnl?: number; // سود/زیان ناخالص قبل از کارمزد
  entryFee?: number; // کارمزد ورود (0.06%)
  exitFee?: number; // کارمزد خروج (0.06%)
  fee?: number; // مجموع کارمزد ورود و خروج
  commission?: number;
  pnl: number; // سود/زیان خالص پس از کسر کارمزد
  pnlPercent: number;
  reason?: string;
}

export interface BacktestMetrics {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  activeTrades: number;
  winRate: number;
  netProfit: number;
  netProfitPercent: number;
  totalProfit: number;
  totalLoss: number;
  totalFee: number;
  profitFactor: number;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
}

export interface StrategyMetrics {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  activeTrades: number;
  pendingTrades: number;
  expiredTrades: number;
  winRate: number; // In percent (0 - 100)
  totalProfit: number;
  totalLoss: number;
  totalFee?: number; // مجموع کارمزدهای پرداخت‌شده
  netProfit: number;
  netProfitPercent: number;
  profitFactor: number;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  finalEquity: number;
}

export interface BacktestResult {
  pair: CryptoPair;
  candlesCount: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  activeTrades: number;
  winRate: number;
  netProfit: number;
  netProfitPercent: number;
  totalProfit: number;
  totalLoss: number;
  totalFee: number;
  profitFactor: number;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  optimalRiskForDD20: number;
  lastTradeStatus?: 'WIN' | 'LOSS' | 'ACTIVE';
  trades: Trade[];
}

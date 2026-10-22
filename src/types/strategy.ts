import { CandleData, CryptoPair, Leg, ZigZagPoint, ZigZagSettings as CryptoZigZagSettings } from './crypto.ts';

export type ZigZagSettings = CryptoZigZagSettings;

export interface StrategyParams {
  capital: number;
  selectedStrategyId: string;
  riskMode?: 'percent' | 'fixed'; // 'percent' (درصد از کل سرمایه) | 'fixed' (مبلغ ثابت دلاری/تتر)
  riskAmountFixed?: number; // مقدار ریسک ثابت بر حسب USDT
  riskPercent: number;
  entryCommissionPercent: number;
  exitCommissionPercent: number;
  commissionPercent: number;
  maxRiskReward: number;
  maxCandlesToEnter: number;
  maxTradesPerLeg: number;
  showOnChart: boolean;
  noConcurrentPositions?: boolean; // عدم ورود به معامله جدید در صورت وجود پوزیشن باز
  symbol?: string; // نماد جفت‌ارز اختیاری برای اعمال گام اعشار و استپ‌سایز صرافی
}

export type StrategyConfig = StrategyParams;

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  capital: 10000,
  selectedStrategyId: 'strategy_2_next_pivot',
  riskMode: 'percent',
  riskAmountFixed: 10,
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

export type TradeStatus = 'PENDING' | 'ACTIVE' | 'WIN' | 'LOSS' | 'BREAKEVEN' | 'EXPIRED' | 'OPEN';

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
  returnR?: number;
  targetRiskAmount?: number;
  realizedRisk?: number;
  stepSize?: number;
  qtyPrecision?: number;
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
  targetRiskAmount?: number; // بودجه ریسک هدف کاربر (مثلاً ۱۰۰ دلار یا ۱٪)
  realizedRisk?: number; // ریسک واقعی دلاری پس از کوانتیزه‌کردن به استپ سایز صرافی (مثلاً ۹۸.۵$)
  stepSize?: number; // حداقل گام حجم معامله در صرافی
  qtyPrecision?: number; // تعداد ارقام اعشار مجاز حجم در صرافی
  positionSize: number;
  quantity?: number;
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
  entryFee?: number; // کارمزد ورود
  exitFee?: number; // کارمزد خروج
  fee?: number; // مجموع کارمزد ورود و خروج
  commission?: number;
  pnl: number; // سود/زیان خالص پس از کسر کارمزد
  pnlPercent: number;
  returnR?: number; // بازدهی بر حسب R (نسبت سود/زیان خالص به ریسک)
  capitalAfterTrade?: number; // موجودی شناور حساب پس از این معامله
  entryNotional?: number;
  exitNotional?: number;
  fundingCashFlow?: number;
  netPnlAfterFunding?: number;
  concurrencyDecision?: 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
  stage?: 'RAW' | 'FINAL';
  competingSymbol?: string;
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
  totalTrades: number; // Closed trades count
  winTrades: number;
  lossTrades: number;
  breakevenTrades?: number;
  activeTrades: number;
  pendingTrades: number;
  expiredTrades: number;
  winRate: number; // In percent (0 - 100)
  grossProfit?: number;
  grossLoss?: number;
  grossPnl?: number;
  totalProfit: number;
  totalLoss: number;
  totalFee?: number; // مجموع کارمزدهای پرداخت‌شده
  netProfit: number;
  netProfitPercent: number;
  profitFactor: number;
  profitFactorLabel?: string;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  finalEquity: number;
  openPositionsCount?: number;
  openPositionsUnrealizedPnl?: number;
  openPositionsFee?: number;
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

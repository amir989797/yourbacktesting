export interface StrategyConfig {
  capital: number;
  selectedStrategyId: string;
  riskPercent: number;
  maxCandlesToEnter: number;
  maxRiskReward: number;
  maxTradesPerLeg: number;
  showOnChart: boolean;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  capital: 10000,
  selectedStrategyId: 'strategy_1_e_breakout',
  riskPercent: 1.0,
  maxCandlesToEnter: 100,
  maxRiskReward: 5,
  maxTradesPerLeg: 3,
  showOnChart: true,
};

export type TradeStatus = 'PENDING' | 'ACTIVE' | 'WIN' | 'LOSS' | 'EXPIRED';

export interface StrategyTrade {
  id: string;
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
  exitTime?: number;
  exitCandleIdx?: number;
  exitPrice?: number;

  candlesElapsedToEntry?: number;
  candlesRemainingToEnter?: number;
  waitingForPostLeg?: boolean;
  hasPostLeg?: boolean;

  status: TradeStatus;
  pnl: number;
  pnlPercent: number;
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
  netProfit: number;
  netProfitPercent: number;
  profitFactor: number;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  finalEquity: number;
}

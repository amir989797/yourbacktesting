import { CandleData, CryptoPair, Leg, ZigZagPoint } from './crypto.ts';

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
}

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
  status: 'OPEN' | 'WIN' | 'LOSS' | 'ACTIVE';
  pnl: number;
  pnlPercent: number;
  commission: number;
  riskReward: number;
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

export interface ZigZagSettings {
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
}

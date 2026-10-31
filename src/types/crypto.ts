export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  trades?: number;
  isClosed?: boolean;
}

export interface VolumeData {
  time: number;
  value: number;
  color: string;
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number; // Base volume
  quoteVolume: number; // USDT volume
  prevClosePrice: number;
}

export interface CryptoPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  name?: string;
  icon?: string;
  category?: 'Popular' | 'Layer 1' | 'DeFi' | 'Meme' | 'AI & Tech' | 'Futures' | string;
  marketCap?: number;
  volume24h?: number;
  isOpenApi?: boolean;
  tradeSwitch?: boolean;
  openSwitch?: boolean;
  isApiSupported?: boolean;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export type ChartType = 'candlestick' | 'line' | 'area';

export interface IndicatorSettings {
  showMa7: boolean;
  showMa25: boolean;
  showMa99: boolean;
  showVolume: boolean;
  showZigZag: boolean;
}

export interface ZigZagSettings {
  atrPeriod: number; // Period ATR (پیش‌فرض 55)
  minCandles: number; // Min candle (پیش‌فرض 3)
  minCandlesForLongLeg: number; // Min candle for long leg (پیش‌فرض 20)
  atrMultiplier: number; // ضریب ATR لگ‌های عادی (پیش‌فرض 3)
  longLegAtrMultiplier: number; // ضریب ATR نوسان لگ‌های بزرگ (پیش‌فرض 10)
  maxBlueLegPercent?: number; // سقف درصدی اندازه لگ‌های آبی نسبت به قرمز/سبز (پیش‌فرض 60)
  maxBreakoutAtrMultiplier?: number; // سقف نفوذ شکست انتهای لگ بر مبنای ATR (پیش‌فرض 5)
  maxRiskReward?: number;
}

export interface ZigZagPoint {
  index: number;
  time: number;
  price: number;
  type: 'HIGH' | 'LOW';
}

export interface Leg {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  direction: 'UP' | 'DOWN';
  color: 'BLUE' | 'RED' | 'BLACK';
  length: number;
  candlesCount: number;
  atrValue: number;
}

export interface RecentTrade {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface OrderBookItem {
  price: number;
  qty: number;
  total: number;
}

export type ExchangeType = 'binance' | 'xt';

export interface ExchangeAccountBalance {
  exchange: ExchangeType;
  coin: string;
  walletBalance: number;
  availableBalance: number;
  frozenBalance: number;
  unrealizedPnl: number;
  totalEquity: number;
  updatedAt: string;
}

export interface LivePosition {
  symbol: string;
  exchange: ExchangeType;
  side: 'LONG' | 'SHORT';
  positionSide: 'LONG' | 'SHORT';
  entryPrice: number;
  markPrice: number;
  amount: number; // contracts
  contractQty?: number;
  contractSize?: number;
  coinQty?: number;
  notionalUsdt?: number;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  pnlPercent: number;
  liquidationPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  profitId?: string;
  updatedAt: string;
}

export interface LiveTradeOrder {
  id: string;
  orderId?: string;
  clientOrderId?: string;
  exchange: ExchangeType;
  symbol: string;
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT';
  orderType: 'MARKET' | 'LIMIT';
  price: number;
  amount: number;
  status: 'NEW' | 'FILLED' | 'CANCELED' | 'REJECTED';
  strategyName: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: 'TP' | 'SL' | 'MANUAL';
  timestamp: string;
}

export interface LiveTradeSettings {
  exchange: ExchangeType;
  selectedStrategyId: string;
  capitalUsdt: number;
  leverage: number;
  riskReward: number;
  timeframe: Timeframe;
  atrPeriod: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  autoScanIntervalMinutes: number;
  isAutoTrading: boolean;
  isSimulatedPaper: boolean;
}

export interface ActiveChartOrder {
  id?: string;
  orderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  positionSide?: 'LONG' | 'SHORT';
  price: number;
  entryPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  amount?: number;
  contractQty?: number;
  nominalUsdt?: number;
  leverage?: number;
  unrealizedPnl?: number;
  pnlPercent?: number;
  status?: string;
  time?: string | number;
  timestamp?: string | number;
}


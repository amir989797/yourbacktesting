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
  name: string;
  icon?: string;
  category: 'Popular' | 'Layer 1' | 'DeFi' | 'Meme' | 'AI & Tech';
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

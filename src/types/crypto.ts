export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CryptoPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketCap?: number;
  volume24h?: number;
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

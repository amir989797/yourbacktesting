/**
 * Exchange Lot Size, Step Size, and Precision Rules for Binance & XT.COM
 * 
 * Provides accurate quantity quantization and exact PnL / loss calculation
 * accounting for exchange stepSize truncation and trading fees.
 */

export interface SymbolLotRule {
  stepSize: number;
  precision: number;
  minQty: number;
  minNotional: number; // e.g., 5 USDT for Binance/XT futures
}

// Precision and stepSize mapping for top high-volume crypto futures pairs
const KNOWN_SYMBOL_RULES: Record<string, SymbolLotRule> = {
  // Mega caps
  BTCUSDT: { stepSize: 0.001, precision: 3, minQty: 0.001, minNotional: 5 },
  ETHUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  BNBUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  SOLUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  
  // High / Mid caps
  XRPUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  ADAUSDT: { stepSize: 1, precision: 0, minQty: 1, minNotional: 5 },
  AVAXUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  DOGEUSDT: { stepSize: 1, precision: 0, minQty: 1, minNotional: 5 },
  SUIUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  NEARUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  LINKUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  DOTUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  LTCUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  UNIUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  AAVEUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  ARBUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  OPUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  INJUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  TIAUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  APTUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  ATOMUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  ICPUSDT: { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 },
  FTMUSDT: { stepSize: 1, precision: 0, minQty: 1, minNotional: 5 },
  SEIUSDT: { stepSize: 1, precision: 0, minQty: 1, minNotional: 5 },
  TAOUSDT: { stepSize: 0.001, precision: 3, minQty: 0.001, minNotional: 5 },
  MKRUSDT: { stepSize: 0.001, precision: 3, minQty: 0.001, minNotional: 5 },

  // Meme & micro-cent coins (contract sizes / high multiples in futures)
  PEPEUSDT: { stepSize: 1000, precision: 0, minQty: 1000, minNotional: 5 },
  SHIBUSDT: { stepSize: 1000, precision: 0, minQty: 1000, minNotional: 5 },
  BONKUSDT: { stepSize: 1000, precision: 0, minQty: 1000, minNotional: 5 },
  FLOKIUSDT: { stepSize: 1000, precision: 0, minQty: 1000, minNotional: 5 },
  WIFUSDT: { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 },
  LUNCUSDT: { stepSize: 1000, precision: 0, minQty: 1000, minNotional: 5 },
  BTTUSDT: { stepSize: 10000, precision: 0, minQty: 10000, minNotional: 5 },
};

/**
 * Get the LOT_SIZE rules (stepSize, precision, minQty) for any crypto symbol.
 * If symbol is not in the known table, accurately infers it from current price
 * based on standard Binance and XT Futures specifications.
 */
export function getSymbolLotRule(symbol?: string, currentPrice?: number): SymbolLotRule {
  const cleanSym = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanSym && KNOWN_SYMBOL_RULES[cleanSym]) {
    return KNOWN_SYMBOL_RULES[cleanSym];
  }

  // Infer based on price level (matching Binance / XT futures conventions)
  const price = currentPrice && currentPrice > 0 ? currentPrice : 1.0;

  if (price >= 10000) {
    // BTC-like ($10,000+)
    return { stepSize: 0.001, precision: 3, minQty: 0.001, minNotional: 5 };
  } else if (price >= 1000) {
    // ETH, MKR-like ($1,000 - $10,000)
    return { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 };
  } else if (price >= 100) {
    // SOL, BNB, AAVE-like ($100 - $1,000)
    return { stepSize: 0.01, precision: 2, minQty: 0.01, minNotional: 5 };
  } else if (price >= 10) {
    // LINK, AVAX, NEAR, UNI ($10 - $100)
    return { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 };
  } else if (price >= 1) {
    // SUI, ARB, OP, ADA ($1 - $10)
    return { stepSize: 0.1, precision: 1, minQty: 0.1, minNotional: 5 };
  } else if (price >= 0.05) {
    // DOGE, XRP, GALA ($0.05 - $1)
    return { stepSize: 1, precision: 0, minQty: 1, minNotional: 5 };
  } else if (price >= 0.001) {
    // Sub-cent coins ($0.001 - $0.05)
    return { stepSize: 10, precision: 0, minQty: 10, minNotional: 5 };
  } else {
    // Micro-meme coins (PEPE, SHIB, BONK < $0.001)
    return { stepSize: 1000, precision: 0, minQty: 1000, minNotional: 5 };
  }
}

/**
 * Quantize order quantity strictly downward (Floor) to the exchange stepSize.
 * Never rounds up, because rounding up would cause the realized loss to exceed max risk!
 */
export function quantizeOrderQuantity(
  rawQty: number,
  stepSize: number,
  precision: number
): number {
  if (rawQty <= 0 || !Number.isFinite(rawQty)) return 0;
  if (stepSize <= 0) return parseFloat(rawQty.toFixed(precision));

  // Round down to nearest stepSize multiple
  const steps = Math.floor(rawQty / stepSize);
  const quantized = steps * stepSize;

  // Fix floating-point precision issues (e.g., 0.30000000000000004 -> 0.3)
  return parseFloat(quantized.toFixed(Math.max(0, precision)));
}

export interface TradeSizingResult {
  rawPositionSize: number;
  quantizedPositionSize: number;
  stepSize: number;
  qtyPrecision: number;
  maxRiskBudget: number; // e.g. 100$
  actualLossAtSL: number; // e.g. 98.65$ (<= maxRiskBudget)
  expectedProfitAtTP: number;
  grossLossAtSL: number;
  grossProfitAtTP: number;
  entryFee: number;
  exitFeeAtSL: number;
  exitFeeAtTP: number;
  totalFeesAtSL: number;
  totalFeesAtTP: number;
  positionValue: number;
}

/**
 * Calculate realistic trade sizing and exact net PnL at Stop Loss and Take Profit
 * incorporating both exchange stepSize truncation and entry/exit commissions.
 */
export function calculateExactTradeSizing(
  riskBudget: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  entryFeeRate: number,
  exitFeeRate: number,
  symbol?: string
): TradeSizingResult {
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const targetDistance = Math.abs(takeProfit - entryPrice);

  if (stopDistance <= 0.000001 || entryPrice <= 0 || riskBudget <= 0) {
    return {
      rawPositionSize: 0,
      quantizedPositionSize: 0,
      stepSize: 0.01,
      qtyPrecision: 2,
      maxRiskBudget: riskBudget,
      actualLossAtSL: 0,
      expectedProfitAtTP: 0,
      grossLossAtSL: 0,
      grossProfitAtTP: 0,
      entryFee: 0,
      exitFeeAtSL: 0,
      exitFeeAtTP: 0,
      totalFeesAtSL: 0,
      totalFeesAtTP: 0,
      positionValue: 0,
    };
  }

  // Fee per unit at SL: (Entry Fee + Exit Fee)
  const feePerUnitAtSL = (entryPrice * entryFeeRate) + (stopLoss * exitFeeRate);
  const effectiveStopDistance = stopDistance + feePerUnitAtSL;

  // Theoretical exact position size to lose exactly riskBudget at SL
  const rawPositionSize = effectiveStopDistance > 0 ? riskBudget / effectiveStopDistance : 0;

  // Get exchange LOT_SIZE rules
  const lotRule = getSymbolLotRule(symbol, entryPrice);
  const quantizedPositionSize = quantizeOrderQuantity(rawPositionSize, lotRule.stepSize, lotRule.precision);

  const positionValue = quantizedPositionSize * entryPrice;
  const entryFee = positionValue * entryFeeRate;

  // Realized calculations at Stop Loss
  const grossLossAtSL = quantizedPositionSize * stopDistance;
  const exitFeeAtSL = (quantizedPositionSize * stopLoss) * exitFeeRate;
  const totalFeesAtSL = entryFee + exitFeeAtSL;
  const actualLossAtSL = grossLossAtSL + totalFeesAtSL; // Real loss <= riskBudget

  // Realized calculations at Take Profit
  const grossProfitAtTP = quantizedPositionSize * targetDistance;
  const exitFeeAtTP = (quantizedPositionSize * takeProfit) * exitFeeRate;
  const totalFeesAtTP = entryFee + exitFeeAtTP;
  const expectedProfitAtTP = grossProfitAtTP - totalFeesAtTP;

  return {
    rawPositionSize,
    quantizedPositionSize,
    stepSize: lotRule.stepSize,
    qtyPrecision: lotRule.precision,
    maxRiskBudget: riskBudget,
    actualLossAtSL: parseFloat(actualLossAtSL.toFixed(4)),
    expectedProfitAtTP: parseFloat(expectedProfitAtTP.toFixed(4)),
    grossLossAtSL: parseFloat(grossLossAtSL.toFixed(4)),
    grossProfitAtTP: parseFloat(grossProfitAtTP.toFixed(4)),
    entryFee: parseFloat(entryFee.toFixed(4)),
    exitFeeAtSL: parseFloat(exitFeeAtSL.toFixed(4)),
    exitFeeAtTP: parseFloat(exitFeeAtTP.toFixed(4)),
    totalFeesAtSL: parseFloat(totalFeesAtSL.toFixed(4)),
    totalFeesAtTP: parseFloat(totalFeesAtTP.toFixed(4)),
    positionValue: parseFloat(positionValue.toFixed(2)),
  };
}

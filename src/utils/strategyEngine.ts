import { CandleData, Leg, ZigZagPoint } from '../types/crypto.ts';
import { BacktestMetrics, StrategyParams, Trade } from '../types/strategy.ts';

export function runBreakoutStrategy(
  candles: CandleData[],
  points: ZigZagPoint[],
  legs: Leg[],
  params: StrategyParams
): { trades: Trade[]; metrics: BacktestMetrics } {
  const trades: Trade[] = [];
  let capital = params.capital;
  const initialCapital = params.capital;

  for (let i = 1; i < points.length; i++) {
    const prevPivot = points[i - 1];
    const currPivot = points[i];
    const isLong = currPivot.type === 'LOW'; // Looking for bounce/breakout upward
    const entryCandleIndex = currPivot.index + 1;
    if (entryCandleIndex >= candles.length) break;

    const entryCandle = candles[entryCandleIndex];
    const entryPrice = entryCandle.open;
    const stopLoss = isLong ? currPivot.price * 0.995 : currPivot.price * 1.005;
    const risk = Math.abs(entryPrice - stopLoss);
    if (risk <= 0) continue;

    const targetRR = Math.min(params.maxRiskReward || 2.0, 5.0);
    const takeProfit = isLong ? entryPrice + risk * targetRR : entryPrice - risk * targetRR;

    let status: 'OPEN' | 'WIN' | 'LOSS' | 'ACTIVE' = 'ACTIVE';
    let exitPrice = entryPrice;
    let exitIndex = entryCandleIndex;
    let exitTime = entryCandle.time;

    const checkLimit = Math.min(entryCandleIndex + (params.maxCandlesToEnter || 100), candles.length);
    for (let c = entryCandleIndex; c < checkLimit; c++) {
      const candle = candles[c];
      if (isLong) {
        if (candle.low <= stopLoss) {
          status = 'LOSS';
          exitPrice = stopLoss;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
        if (candle.high >= takeProfit) {
          status = 'WIN';
          exitPrice = takeProfit;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
      } else {
        if (candle.high >= stopLoss) {
          status = 'LOSS';
          exitPrice = stopLoss;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
        if (candle.low <= takeProfit) {
          status = 'WIN';
          exitPrice = takeProfit;
          exitIndex = c;
          exitTime = candle.time;
          break;
        }
      }
    }

    const riskAmount = (capital * (params.riskPercent || 1)) / 100;
    const positionSize = riskAmount / risk;
    const pnl = isLong
      ? (exitPrice - entryPrice) * positionSize
      : (entryPrice - exitPrice) * positionSize;
    const commission = (entryPrice * positionSize + exitPrice * positionSize) * ((params.commissionPercent || 0.08) / 100);
    const netPnl = pnl - commission;
    capital += netPnl;

    trades.push({
      id: `trade_${i}`,
      symbol: '',
      type: isLong ? 'BUY' : 'SELL',
      entryPrice,
      entryTime: entryCandle.time,
      entryIndex: entryCandleIndex,
      stopLoss,
      takeProfit,
      exitPrice,
      exitTime,
      exitIndex,
      status,
      pnl: netPnl,
      pnlPercent: (netPnl / riskAmount) * 100,
      commission,
      riskReward: targetRR,
    });
  }

  const winTrades = trades.filter((t) => t.status === 'WIN').length;
  const lossTrades = trades.filter((t) => t.status === 'LOSS').length;
  const activeTrades = trades.filter((t) => t.status === 'ACTIVE').length;
  const totalTrades = winTrades + lossTrades;
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
  const netProfit = capital - initialCapital;
  const netProfitPercent = (netProfit / initialCapital) * 100;

  const totalProfit = trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const totalFee = trades.reduce((sum, t) => sum + t.commission, 0);
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 10 : 0;

  let peak = initialCapital;
  let maxDD = 0;
  let running = initialCapital;
  for (const t of trades) {
    running += t.pnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  const maxDrawdownPercent = peak > 0 ? (maxDD / peak) * 100 : 0;

  return {
    trades,
    metrics: {
      totalTrades: trades.length,
      winTrades,
      lossTrades,
      activeTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalLoss: parseFloat(totalLoss.toFixed(2)),
      totalFee: parseFloat(totalFee.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      avgRiskReward: params.maxRiskReward || 2,
      maxDrawdown: parseFloat(maxDD.toFixed(2)),
      maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    },
  };
}

export function runNextPivotStrategy(
  candles: CandleData[],
  points: ZigZagPoint[],
  legs: Leg[],
  params: StrategyParams,
  atrValues: number[],
  atrMult: number,
  minCandles: number
): { trades: Trade[]; metrics: BacktestMetrics } {
  return runBreakoutStrategy(candles, points, legs, params);
}

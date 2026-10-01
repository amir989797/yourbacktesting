import { CandleData } from '../types/crypto';
import { ZigZagLeg, ZigZagPoint } from './indicators';
import { StrategyConfig, StrategyMetrics, StrategyTrade, TradeStatus } from '../types/strategy';

/**
 * Runs Backtest and Live Analysis for Strategy 1:
 * Rule:
 * 1. Dark Blue leg (E -> F) is confirmed.
 * 2. Prerequisite: Leg after dark blue point F MUST be formed before entering.
 * 3. When point E breaks:
 *    - Check if E > F:
 *      If E > F -> Enter BUY (LONG), Stop Loss = F, Target = A.
 *      Triggered when price breaks above E (c.high >= priceE).
 *    - If E <= F:
 *      Enter SELL (SHORT), Stop Loss = F, Target = A.
 *      Triggered when price breaks below E (c.low <= priceE).
 * 4. Only 1 entry per leg.
 * 5. Maximum window of 100 candles after leg E-F (point F) to enter the trade.
 */
export function runStrategy1Backtest(
  candles: CandleData[],
  points: ZigZagPoint[],
  legs: ZigZagLeg[],
  config: StrategyConfig
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  const trades: StrategyTrade[] = [];
  if (candles.length === 0 || legs.length === 0 || points.length === 0) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  // Build time to candle index map for fast lookups
  const timeToCandleIdx = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) {
    timeToCandleIdx.set(candles[i].time, i);
  }

  const findCandleIndex = (timestamp: number): number => {
    const direct = timeToCandleIdx.get(timestamp);
    if (direct !== undefined) return direct;
    // Fallback: binary search or closest
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time >= timestamp) return i;
    }
    return candles.length - 1;
  };

  // Find all complete cycles: A-B (Giant) -> C-D (Light Blue) -> E-F (Dark Blue)
  let currentGiant: ZigZagLeg | null = null;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];

    if (leg.isGiantLeg && (leg.color === 'green' || leg.color === 'red')) {
      currentGiant = leg;
    }

    if (leg.color === 'dark_blue' && currentGiant) {
      const darkBlueLeg = leg;
      const giantLeg = currentGiant;

      // User Rule: تارگت باید a باشد که ابتدای چرخه‌ای هست که لگ آبی را درست کرده
      // (اگر بین a و e لگ دیگری بود نباید در نظر گرفته شود)
      const priceA = darkBlueLeg.cyclePointAPrice ?? giantLeg.startPrice;
      const priceE = darkBlueLeg.startPrice;
      const priceF = darkBlueLeg.endPrice;

      // User Rule: چک کن E بزرگ تر است یا F. اگر E بزرگتر باشد خرید و اگر نباشد فروش
      const isEGreaterThanF = priceE > priceF;
      const direction: 'BUY' | 'SELL' = isEGreaterThanF ? 'BUY' : 'SELL';
      const cycleType: 'bullish' | 'bearish' = giantLeg.isUp ? 'bullish' : 'bearish';

      const entryPrice = priceE;
      const stopLoss = priceF;
      const takeProfit = priceA;

      const stopDistance = Math.abs(entryPrice - stopLoss);
      const targetDistance = Math.abs(takeProfit - entryPrice);
      const riskReward = stopDistance > 0 ? targetDistance / stopDistance : 0;

      const riskAmount = (config.capital * config.riskPercent) / 100;
      const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
      const positionValue = positionSize * entryPrice;

      const timeF = darkBlueLeg.endTime;
      const candleIdxF = findCandleIndex(timeF);

      // User Rule: ما زمانی وارد میشیم که لگ بعد از ابی F تشکیل شده باشد
      const hasPostLeg = i + 1 < legs.length;

      // Evaluate entry within maxCandlesToEnter
      const maxWindowIdx = candleIdxF + config.maxCandlesToEnter;
      let entryCandleIdx: number | undefined;
      let entryTime: number | undefined;
      let status: TradeStatus = 'ACTIVE';

      // Scan for break of point E only if the post-F leg has formed!
      if (hasPostLeg) {
        for (let cIdx = candleIdxF + 1; cIdx <= Math.min(candles.length - 1, maxWindowIdx); cIdx++) {
          const c = candles[cIdx];
          let triggered = false;

          if (direction === 'BUY') {
            // E > F: Price breaks above E
            if (c.high >= priceE) {
              triggered = true;
            }
          } else {
            // E <= F: Price breaks below E
            if (c.low <= priceE) {
              triggered = true;
            }
          }

          if (triggered) {
            entryCandleIdx = cIdx;
            entryTime = c.time;
            status = 'ACTIVE';
            break;
          }
        }
      }

      // User Rule: در این استراتژی چیزی به اسم pending نداریم هرزمان که شکست انجام شد علامت ها را در چارت اضافه کن
      // اگر شکست E رخ نداده باشد، اصلا وارد معامله نمیشویم
      if (entryCandleIdx !== undefined) {
        let exitTime: number | undefined;
        let exitCandleIdx: number | undefined;
        let exitPrice: number | undefined;
        let pnl = 0;
        let pnlPercent = 0;

        // Trade entered! Now evaluate outcome from entry onwards
        for (let k = entryCandleIdx; k < candles.length; k++) {
          const ck = candles[k];

          if (direction === 'BUY') {
            const hitTP = ck.high >= takeProfit;
            const hitSL = ck.low <= stopLoss;

            if (hitTP && hitSL) {
              // Conservative: assume Stop Loss hit if both in same candle
              status = 'LOSS';
              exitPrice = stopLoss;
              exitTime = ck.time;
              exitCandleIdx = k;
              pnl = -riskAmount;
              pnlPercent = -config.riskPercent;
              break;
            } else if (hitTP) {
              status = 'WIN';
              exitPrice = takeProfit;
              exitTime = ck.time;
              exitCandleIdx = k;
              pnl = riskAmount * riskReward;
              pnlPercent = (pnl / config.capital) * 100;
              break;
            } else if (hitSL) {
              status = 'LOSS';
              exitPrice = stopLoss;
              exitTime = ck.time;
              exitCandleIdx = k;
              pnl = -riskAmount;
              pnlPercent = -config.riskPercent;
              break;
            }
          } else {
            // SELL (Short)
            const hitTP = ck.low <= takeProfit;
            const hitSL = ck.high >= stopLoss;

            if (hitTP && hitSL) {
              status = 'LOSS';
              exitPrice = stopLoss;
              exitTime = ck.time;
              exitCandleIdx = k;
              pnl = -riskAmount;
              pnlPercent = -config.riskPercent;
              break;
            } else if (hitTP) {
              status = 'WIN';
              exitPrice = takeProfit;
              exitTime = ck.time;
              exitCandleIdx = k;
              pnl = riskAmount * riskReward;
              pnlPercent = (pnl / config.capital) * 100;
              break;
            } else if (hitSL) {
              status = 'LOSS';
              exitPrice = stopLoss;
              exitTime = ck.time;
              exitCandleIdx = k;
              pnl = -riskAmount;
              pnlPercent = -config.riskPercent;
              break;
            }
          }
        }

        // If neither TP nor SL hit up to the latest candle
        if (status === 'ACTIVE') {
          const latestCandle = candles[candles.length - 1];
          const curPrice = latestCandle.close;
          const currentMove = direction === 'BUY' ? curPrice - entryPrice : entryPrice - curPrice;
          pnl = positionSize * currentMove;
          pnlPercent = (pnl / config.capital) * 100;
        }

        const elapsed = entryCandleIdx - candleIdxF;

        trades.push({
          id: `trade-${trades.length + 1}-${darkBlueLeg.index}`,
          cycleIndex: trades.length + 1,
          direction,
          cycleType,
          priceA,
          priceE,
          priceF,
          entryPrice,
          stopLoss,
          takeProfit,
          riskAmount,
          positionSize,
          positionValue,
          riskReward: parseFloat(riskReward.toFixed(2)),
          timeF,
          candleIdxF,
          entryTime,
          entryCandleIdx,
          exitTime,
          exitCandleIdx,
          exitPrice,
          candlesElapsedToEntry: elapsed,
          candlesRemainingToEnter: 0,
          waitingForPostLeg: false,
          hasPostLeg: true,
          status,
          pnl: parseFloat(pnl.toFixed(2)),
          pnlPercent: parseFloat(pnlPercent.toFixed(2)),
        });
      }

      currentGiant = null; // Only one entry per leg/cycle
    }
  }

  // Calculate cumulative metrics
  const metrics = calculateMetrics(trades, config.capital);

  return { trades, metrics };
}

function calculateMetrics(trades: StrategyTrade[], initialCapital: number): StrategyMetrics {
  let winTrades = 0;
  let lossTrades = 0;
  let activeTrades = 0;
  let pendingTrades = 0;
  let expiredTrades = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let netProfit = 0;
  let rrSum = 0;
  let completedTradesCount = 0;

  let currentEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;

  for (const t of trades) {
    if (t.status === 'WIN') {
      winTrades++;
      completedTradesCount++;
      totalProfit += t.pnl;
      netProfit += t.pnl;
      rrSum += t.riskReward;
      currentEquity += t.pnl;
    } else if (t.status === 'LOSS') {
      lossTrades++;
      completedTradesCount++;
      totalLoss += Math.abs(t.pnl);
      netProfit += t.pnl;
      currentEquity += t.pnl;
    } else if (t.status === 'ACTIVE') {
      activeTrades++;
      netProfit += t.pnl;
      currentEquity += t.pnl;
    } else if (t.status === 'PENDING') {
      pendingTrades++;
    } else if (t.status === 'EXPIRED') {
      expiredTrades++;
    }

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const dd = peakEquity - currentEquity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  const totalClosed = winTrades + lossTrades;
  const winRate = totalClosed > 0 ? (winTrades / totalClosed) * 100 : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0;
  const avgRiskReward = completedTradesCount > 0 ? rrSum / completedTradesCount : 0;
  const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;
  const maxDrawdownPercent = peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : 0;

  return {
    totalTrades: trades.length,
    winTrades,
    lossTrades,
    activeTrades,
    pendingTrades,
    expiredTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    totalLoss: parseFloat(totalLoss.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    avgRiskReward: parseFloat(avgRiskReward.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    finalEquity: parseFloat(currentEquity.toFixed(2)),
  };
}

function getEmptyMetrics(capital: number): StrategyMetrics {
  return {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    activeTrades: 0,
    pendingTrades: 0,
    expiredTrades: 0,
    winRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netProfit: 0,
    netProfitPercent: 0,
    profitFactor: 0,
    avgRiskReward: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    finalEquity: capital,
  };
}

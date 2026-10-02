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

      const stopDistance = Math.abs(entryPrice - stopLoss);
      const naturalTargetDistance = Math.abs(priceA - entryPrice);
      const naturalRR = stopDistance > 0 ? naturalTargetDistance / stopDistance : 0;

      // User Rule: حداکثر RR هم بزار و مقدارش رو 5قرار بده
      const maxRR = config.maxRiskReward > 0 ? config.maxRiskReward : 5;
      let takeProfit = priceA;
      let riskReward = naturalRR;

      if (naturalRR > maxRR) {
        riskReward = maxRR;
        takeProfit =
          direction === 'BUY'
            ? entryPrice + stopDistance * maxRR
            : entryPrice - stopDistance * maxRR;
      }

      const riskAmount = (config.capital * config.riskPercent) / 100;
      const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
      const positionValue = positionSize * entryPrice;

      const timeF = darkBlueLeg.endTime;
      const candleIdxF = findCandleIndex(timeF);

      // User Rule: ما زمانی وارد میشیم که لگ بعد از ابی F تشکیل شده باشد
      const hasPostLeg = i + 1 < legs.length;

      // User Rule: در این استراتژی چیزی به اسم pending نداریم هرزمان که شکست انجام شد علامت ها را در چارت اضافه کن.
      // اگر استاپ خورد میتواند دوباره با شکست E وارد شود. منتهی از زمان استاپ تا شکست را مهلت ورود محدود میکند.
      if (hasPostLeg) {
        let scanStartIdx = candleIdxF + 1;
        let scanMaxWindow = candleIdxF + config.maxCandlesToEnter;
        let attempt = 1;

        while (scanStartIdx <= Math.min(candles.length - 1, scanMaxWindow)) {
          let entryCandleIdx: number | undefined;
          let entryTime: number | undefined;

          // Scan for break of point E within the current window
          for (let cIdx = scanStartIdx; cIdx <= Math.min(candles.length - 1, scanMaxWindow); cIdx++) {
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
              break;
            }
          }

          if (entryCandleIdx === undefined) {
            // No break of E occurred in this window
            break;
          }

          // Trade entered!
          let status: TradeStatus = 'ACTIVE';
          let exitTime: number | undefined;
          let exitCandleIdx: number | undefined;
          let exitPrice: number | undefined;
          let pnl = 0;
          let pnlPercent = 0;

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
            id: `trade-${trades.length + 1}-${darkBlueLeg.index}-att${attempt}`,
            cycleIndex: trades.length + 1,
            attemptNumber: attempt,
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

          // User Rule: فقط یکبار دیگر میتواند پس از استاپ در صورت شرایطی که گفته شد وارد شود.
          // (حداکثر ۱ بار ورود مجدد پس از استاپ)
          if (status === 'LOSS' && exitCandleIdx !== undefined && attempt < 2) {
            // New entry window begins right from the stop loss candle!
            scanStartIdx = exitCandleIdx + 1;
            scanMaxWindow = exitCandleIdx + config.maxCandlesToEnter;
            attempt++;
          } else {
            // If WIN, still ACTIVE, or already used the 1 re-entry attempt:
            break;
          }
        }
      }

      currentGiant = null; // Only one entry per leg/cycle
    }
  }

  // Calculate cumulative metrics
  const metrics = calculateMetrics(trades, config.capital);

  return { trades, metrics };
}

/**
 * Runs Backtest and Live Analysis for Strategy 2:
 * User Rules:
 * 1. پس از تشکیل نقطه ی F منتظر تشکیل نقطه بعدی میشیم.
 * 2. وقتی برای اولین بار شرط تشکیل لگ/نقطه بعدی برقرار شد، بلافاصله وارد میشیم (نه زمانی که چند بار جابجا شده و ثابت شده).
 * 3. برای فهمیدن دقیق زمان تشکیل، از نقطه F رو به جلو شمع‌به‌شمع بررسی می‌کنیم تا زمانی که شرط تشکیل لگ بعدی (حداقل minCandles کندل و حداقل atrMultiplier * ATR فاصله از F) برای اولین بار برقرار شود.
 * 4. استاپ در F قرار می‌گیرد.
 * 5. تارگت برابر با حداکثر R:R در پارامترهای استراتژی است.
 * 6. برای هر F فقط یکبار مجاز به ورود هستیم.
 */
export function runStrategy2Backtest(
  candles: CandleData[],
  points: ZigZagPoint[],
  legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
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

  const timeToCandleIdx = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) {
    timeToCandleIdx.set(candles[i].time, i);
  }

  const findCandleIndex = (timestamp: number): number => {
    const direct = timeToCandleIdx.get(timestamp);
    if (direct !== undefined) return direct;
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time >= timestamp) return i;
    }
    return candles.length - 1;
  };

  const effectiveMinCandles = Math.max(1, minCandles);
  const effectiveAtrMult = atrMultiplier > 0 ? atrMultiplier : 3;

  let currentGiant: ZigZagLeg | null = null;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];

    if (leg.isGiantLeg && (leg.color === 'green' || leg.color === 'red')) {
      currentGiant = leg;
    }

    if (leg.color === 'dark_blue' && currentGiant) {
      const darkBlueLeg = leg;
      const giantLeg = currentGiant;

      const priceA = darkBlueLeg.cyclePointAPrice ?? giantLeg.startPrice;
      const priceE = darkBlueLeg.startPrice;
      const priceF = darkBlueLeg.endPrice;
      const timeF = darkBlueLeg.endTime;
      const candleIdxF = findCandleIndex(timeF);
      const isFHigh = darkBlueLeg.isUp; // اگر لگ آبی صعودی بوده، F سقف (High) است وگرنه کف (Low)

      // شمع‌به‌شمع از نقطه F جلو می‌رویم تا لحظه‌ای که شرط تشکیل لگ بعدی برای اولین بار برقرار شود
      let currentFVal = priceF;
      let currentFIdx = candleIdxF;

      for (let cIdx = candleIdxF + 1; cIdx < candles.length; cIdx++) {
        const c = candles[cIdx];
        const atr = (atrValues && atrValues[cIdx] > 0) ? atrValues[cIdx] : Math.max(0.0001, c.high - c.low);
        const requiredDistance = effectiveAtrMult * atr;

        if (isFHigh) {
          // نقطه F سقف بوده؛ اگر قیمت قبل از تشکیل لگ جدید سقف بالاتری زد، F امتداد یافته است
          if (c.high > currentFVal) {
            currentFVal = c.high;
            currentFIdx = cIdx;
            continue;
          }

          const candleDist = cIdx - currentFIdx;
          const priceDist = currentFVal - c.low;

          // شرط اولین بار تشکیل لگ نزولی بعد از F:
          // حداقل minCandles کندل گذشته باشد و افت قیمت حداقل برابر atrMultiplier * ATR باشد
          if (candleDist >= effectiveMinCandles && priceDist >= requiredDistance) {
            const thresholdPrice = currentFVal - requiredDistance;
            // در لحظه فعال‌شدن شرط، قیمت از thresholdPrice عبور کرده
            const entryPrice = parseFloat(Math.min(c.open, thresholdPrice).toFixed(4));
            const entryTime = c.time;
            const entryCandleIdx = cIdx;
            const stopLoss = parseFloat(currentFVal.toFixed(4));
            const stopDistance = Math.abs(entryPrice - stopLoss);

            if (stopDistance > 0.000001) {
              const direction: 'BUY' | 'SELL' = 'SELL'; // ریزش از سقف F
              const cycleType: 'bullish' | 'bearish' = giantLeg.isUp ? 'bullish' : 'bearish';

              const maxRR = config.maxRiskReward > 0 ? config.maxRiskReward : 5;
              const riskReward = maxRR;
              const takeProfit = parseFloat((entryPrice - stopDistance * maxRR).toFixed(4));

              const riskAmount = (config.capital * config.riskPercent) / 100;
              const positionSize = riskAmount / stopDistance;
              const positionValue = positionSize * entryPrice;

              let status: TradeStatus = 'ACTIVE';
              let exitTime: number | undefined;
              let exitCandleIdx: number | undefined;
              let exitPrice: number | undefined;
              let pnl = 0;
              let pnlPercent = 0;

              for (let k = entryCandleIdx; k < candles.length; k++) {
                const ck = candles[k];
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

              if (status === 'ACTIVE') {
                const latestCandle = candles[candles.length - 1];
                const curPrice = latestCandle.close;
                const currentMove = entryPrice - curPrice;
                pnl = positionSize * currentMove;
                pnlPercent = (pnl / config.capital) * 100;
              }

              trades.push({
                id: `trade-s2-${trades.length + 1}-${darkBlueLeg.index}`,
                strategyId: 'strategy_2_next_pivot',
                strategyName: 'استراتژی ۲ (اولین تشکیل بعد از F)',
                cycleIndex: trades.length + 1,
                attemptNumber: 1,
                direction,
                cycleType,
                priceA,
                priceE,
                priceF: stopLoss,
                entryPrice,
                stopLoss,
                takeProfit,
                riskAmount: parseFloat(riskAmount.toFixed(2)),
                positionSize: parseFloat(positionSize.toFixed(6)),
                positionValue: parseFloat(positionValue.toFixed(2)),
                riskReward: parseFloat(riskReward.toFixed(2)),
                timeF,
                candleIdxF,
                entryTime,
                entryCandleIdx,
                exitTime,
                exitCandleIdx,
                exitPrice: exitPrice ? parseFloat(exitPrice.toFixed(4)) : undefined,
                candlesElapsedToEntry: entryCandleIdx - candleIdxF,
                candlesRemainingToEnter: 0,
                waitingForPostLeg: false,
                hasPostLeg: true,
                status,
                pnl: parseFloat(pnl.toFixed(2)),
                pnlPercent: parseFloat(pnlPercent.toFixed(2)),
              });
            }
            break; // برای هر F فقط یکبار وارد می‌شویم
          }
        } else {
          // نقطه F کف بوده؛ اگر قیمت قبل از تشکیل لگ جدید کف پایین‌تری زد، F امتداد یافته است
          if (c.low < currentFVal) {
            currentFVal = c.low;
            currentFIdx = cIdx;
            continue;
          }

          const candleDist = cIdx - currentFIdx;
          const priceDist = c.high - currentFVal;

          // شرط اولین بار تشکیل لگ صعودی بعد از F:
          // حداقل minCandles کندل گذشته باشد و رشد قیمت حداقل برابر atrMultiplier * ATR باشد
          if (candleDist >= effectiveMinCandles && priceDist >= requiredDistance) {
            const thresholdPrice = currentFVal + requiredDistance;
            const entryPrice = parseFloat(Math.max(c.open, thresholdPrice).toFixed(4));
            const entryTime = c.time;
            const entryCandleIdx = cIdx;
            const stopLoss = parseFloat(currentFVal.toFixed(4));
            const stopDistance = Math.abs(entryPrice - stopLoss);

            if (stopDistance > 0.000001) {
              const direction: 'BUY' | 'SELL' = 'BUY'; // صعود از کف F
              const cycleType: 'bullish' | 'bearish' = giantLeg.isUp ? 'bullish' : 'bearish';

              const maxRR = config.maxRiskReward > 0 ? config.maxRiskReward : 5;
              const riskReward = maxRR;
              const takeProfit = parseFloat((entryPrice + stopDistance * maxRR).toFixed(4));

              const riskAmount = (config.capital * config.riskPercent) / 100;
              const positionSize = riskAmount / stopDistance;
              const positionValue = positionSize * entryPrice;

              let status: TradeStatus = 'ACTIVE';
              let exitTime: number | undefined;
              let exitCandleIdx: number | undefined;
              let exitPrice: number | undefined;
              let pnl = 0;
              let pnlPercent = 0;

              for (let k = entryCandleIdx; k < candles.length; k++) {
                const ck = candles[k];
                const hitTP = ck.high >= takeProfit;
                const hitSL = ck.low <= stopLoss;

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

              if (status === 'ACTIVE') {
                const latestCandle = candles[candles.length - 1];
                const curPrice = latestCandle.close;
                const currentMove = curPrice - entryPrice;
                pnl = positionSize * currentMove;
                pnlPercent = (pnl / config.capital) * 100;
              }

              trades.push({
                id: `trade-s2-${trades.length + 1}-${darkBlueLeg.index}`,
                strategyId: 'strategy_2_next_pivot',
                strategyName: 'استراتژی ۲ (اولین تشکیل بعد از F)',
                cycleIndex: trades.length + 1,
                attemptNumber: 1,
                direction,
                cycleType,
                priceA,
                priceE,
                priceF: stopLoss,
                entryPrice,
                stopLoss,
                takeProfit,
                riskAmount: parseFloat(riskAmount.toFixed(2)),
                positionSize: parseFloat(positionSize.toFixed(6)),
                positionValue: parseFloat(positionValue.toFixed(2)),
                riskReward: parseFloat(riskReward.toFixed(2)),
                timeF,
                candleIdxF,
                entryTime,
                entryCandleIdx,
                exitTime,
                exitCandleIdx,
                exitPrice: exitPrice ? parseFloat(exitPrice.toFixed(4)) : undefined,
                candlesElapsedToEntry: entryCandleIdx - candleIdxF,
                candlesRemainingToEnter: 0,
                waitingForPostLeg: false,
                hasPostLeg: true,
                status,
                pnl: parseFloat(pnl.toFixed(2)),
                pnlPercent: parseFloat(pnlPercent.toFixed(2)),
              });
            }
            break; // برای هر F فقط یکبار وارد می‌شویم
          }
        }
      }

      currentGiant = null; // Only one entry per cycle
    }
  }

  const metrics = calculateMetrics(trades, config.capital);
  return { trades, metrics };
}

/**
 * Universal Strategy Dispatcher: runs either Strategy 1 or Strategy 2 based on user selection.
 */
export function runStrategyBacktest(
  candles: CandleData[],
  points: ZigZagPoint[],
  legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  if (config.selectedStrategyId === 'strategy_2_next_pivot') {
    return runStrategy2Backtest(candles, points, legs, config, atrValues, atrMultiplier, minCandles);
  } else if (config.selectedStrategyId === 'strategy_1_e_breakout') {
    return runStrategy1Backtest(candles, points, legs, config);
  }
  return {
    trades: [],
    metrics: getEmptyMetrics(config.capital),
  };
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
  let maxDrawdownPercent = 0;

  for (const t of trades) {
    if (t.status === 'WIN') {
      winTrades++;
      completedTradesCount++;
      rrSum += t.riskReward;
    } else if (t.status === 'LOSS') {
      lossTrades++;
      completedTradesCount++;
    } else if (t.status === 'ACTIVE') {
      activeTrades++;
    } else if (t.status === 'PENDING') {
      pendingTrades++;
    } else if (t.status === 'EXPIRED') {
      expiredTrades++;
    }

    // مجموع سود ناخالص و زیان ناخالص برای محاسبه دقیق Profit Factor و Net Profit
    if (t.pnl > 0) {
      totalProfit += t.pnl;
    } else if (t.pnl < 0) {
      totalLoss += Math.abs(t.pnl);
    }
    netProfit += t.pnl;
    currentEquity += t.pnl;

    // به‌روزرسانی بیشترین سرمایه ثبت‌شده تا این لحظه (Peak Equity)
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }

    // افت سرمایه نسبت به بیشترین سرمایه‌ای که تا این لحظه ثبت شده
    const ddDollars = peakEquity - currentEquity;
    const ddPercent = peakEquity > 0 ? (ddDollars / peakEquity) * 100 : 0;

    if (ddDollars > maxDrawdown) {
      maxDrawdown = ddDollars;
    }
    if (ddPercent > maxDrawdownPercent) {
      maxDrawdownPercent = ddPercent;
    }
  }

  // فرمول استاندارد کاربر: وین ریت = تعداد معاملات سودده تقسیم بر کل معاملات به درصد
  const totalTradesCount = trades.length;
  const winRate = totalTradesCount > 0 ? (winTrades / totalTradesCount) * 100 : 0;
  // پروفیت فکتور = مجموع کل سودها تقسیم بر مجموع کل زیان‌ها
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0;
  const avgRiskReward = completedTradesCount > 0 ? rrSum / completedTradesCount : 0;
  const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  return {
    totalTrades: totalTradesCount,
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

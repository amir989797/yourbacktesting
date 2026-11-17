import { CandleData, Leg, ZigZagPoint as CryptoZigZagPoint } from '../types/crypto.ts';
import { ZigZagLeg, ZigZagPoint, calculateATR, calculateRSI } from './indicators';
import { StrategyConfig, StrategyMetrics, StrategyTrade, TradeStatus, BacktestMetrics, StrategyParams, Trade } from '../types/strategy.ts';
import { calculateExactTradeSizing } from './exchangePrecision.ts';

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
  config: StrategyConfig,
  atrValues?: number[]
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

  const rawMinAtr = config.minAtrPercent ?? config.optMinAtrPercent;
  const effectiveMinAtrPct =
    rawMinAtr !== undefined && rawMinAtr !== null && !isNaN(Number(rawMinAtr))
      ? Math.max(0, Number(rawMinAtr))
      : 0.25;
  const rawRsi = config.s2RsiThreshold ?? config.optS2RsiThreshold;
  const parsedRsi =
    rawRsi !== undefined && rawRsi !== null && !isNaN(Number(rawRsi))
      ? Number(rawRsi)
      : 38;
  const effectiveRsiThresh = parsedRsi > 0 && parsedRsi < 50 ? parsedRsi : 0;
  const rawMinPivotAtr = config.minEntryPivotAtr ?? config.optMinEntryPivotAtr;
  const effectiveMinPivotAtr =
    rawMinPivotAtr !== undefined && rawMinPivotAtr !== null && !isNaN(Number(rawMinPivotAtr))
      ? Math.max(0, Number(rawMinPivotAtr))
      : 0;
  const rsi14 = effectiveRsiThresh > 0 ? calculateRSI(candles, 14) : [];
  const effectiveAtrValues =
    atrValues && atrValues.length === candles.length
      ? atrValues
      : (effectiveMinAtrPct > 0 || effectiveMinPivotAtr > 0)
      ? calculateATR(candles, config.atrPeriod || 14).atrValues
      : undefined;

  // Find all complete cycles: A-B (Giant) -> C-D (Light Blue) -> E-F (Dark Blue)
  let currentGiant: ZigZagLeg | null = null;
  let lastTradeExitCandleIdx = -1;
  let rollingCapital = config.capital;

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

      // محاسبه حد سود (Take Profit) دقیقاً بر اساس پارامتر ریسک به ریوارد (همانند استراتژی ۲ و ترید زنده)
      const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;
      const riskReward = targetRR;
      const takeProfit =
        direction === 'BUY'
          ? entryPrice + stopDistance * targetRR
          : entryPrice - stopDistance * targetRR;

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

          // عدم ورود به معامله جدید در صورت وجود پوزیشن باز
          if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
            break;
          }

          const entryCandleObj = candles[entryCandleIdx];
          const entryAtr =
            effectiveAtrValues && effectiveAtrValues[entryCandleIdx] > 0
              ? effectiveAtrValues[entryCandleIdx]
              : Math.max(0.0001, entryCandleObj.high - entryCandleObj.low);

          if (effectiveMinAtrPct > 0 && (entryPrice <= 0 || (entryAtr / entryPrice) * 100 < effectiveMinAtrPct)) {
            break;
          }
          if (effectiveRsiThresh > 0) {
            const pivotRsi = rsi14[candleIdxF] ?? 50;
            if (direction === 'BUY' ? pivotRsi > effectiveRsiThresh : pivotRsi < 100 - effectiveRsiThresh) {
              break;
            }
          }
          if (effectiveMinPivotAtr > 0 && (entryAtr <= 0 || stopDistance / entryAtr < effectiveMinPivotAtr)) {
            break;
          }

          // Trade entered!
          let status: TradeStatus = 'ACTIVE';
          let exitTime: number | undefined;
          let exitCandleIdx: number | undefined;
          let exitPrice: number | undefined;
          let pnl = 0;
          let pnlPercent = 0;
          let reason: string | undefined = undefined;

          // ریسک پویا: در حالت درصد بر اساس موجودی شناور حساب و در حالت ثابت همیشه مقدار معین دلاری
          const riskBudget =
            config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
              ? config.riskAmountFixed
              : (rollingCapital * (config.riskPercent || 1.0)) / 100;
          const entryFeeRate =
            (config.entryCommissionPercent ??
              (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
          const exitFeeRate =
            (config.exitCommissionPercent ??
              (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

          const effectiveExchange = config.exchange ?? 'xt';
          const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

          // محاسبه حجم دقیق با اعمال قوانین اعشار، قراردادهای صحیح صرافی (XT)، حداقل سفارش و کارمزدها
          const sizing = calculateExactTradeSizing(
            riskBudget,
            entryPrice,
            stopLoss,
            takeProfit,
            entryFeeRate,
            exitFeeRate,
            config.symbol,
            {
              exchange: effectiveExchange,
              contractSize: config.xtContractSize,
              minNotional: config.xtMinNotional,
              riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
              slSlippageRate: slSlipRate,
            }
          );
          const positionSize = sizing.quantizedPositionSize;
          const positionValue = sizing.positionValue;
          const entryFee = sizing.entryFee;
          const riskAmount = riskBudget;
          const realizedRisk = sizing.actualLossAtSL;

          // اگر به دلیل حداقل ارزش سفارش (5/10 USDT) یا بزرگی ۱ قرارداد، ریسک از بودجه بیشتر شد، معامله دقیقاً مشابه ترید لایو رد می‌شود
          if (positionSize <= 0 || positionValue <= 0) {
            scanStartIdx = scanMaxWindow + 1;
            break;
          }

          // حداکثر نسبت ارزش پوزیشن به ریسک (پیش‌فرض ۳۰۰)
          const effectiveMaxRatio = config.maxPositionToRiskRatio !== undefined
            ? config.maxPositionToRiskRatio
            : (config.optMaxPositionToRiskRatio !== undefined ? config.optMaxPositionToRiskRatio : 300);
          const posToRiskRatio = (riskAmount > 0)
            ? parseFloat((positionValue / riskAmount).toFixed(2))
            : 0;

          if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
            scanStartIdx = scanMaxWindow + 1;
            break;
          }

          for (let k = entryCandleIdx; k < candles.length; k++) {
            const ck = candles[k];

            if (direction === 'BUY') {
              const hitTP = ck.high >= takeProfit;
              const hitSL = ck.low <= stopLoss;

              if (hitTP && hitSL) {
                // Conservative: assume Stop Loss hit if both in same candle (with realistic stop-market slippage)
                status = 'LOSS';
                exitPrice = stopLoss * (1 - slSlipRate);
                exitTime = ck.time;
                exitCandleIdx = k;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                const grossTradePnl = positionSize * (exitPrice - entryPrice);
                pnl = grossTradePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
                break;
              } else if (hitTP) {
                status = 'WIN';
                exitPrice = takeProfit;
                exitTime = ck.time;
                exitCandleIdx = k;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                const grossTradePnl = positionSize * (exitPrice - entryPrice);
                pnl = grossTradePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
                break;
              } else if (hitSL) {
                status = 'LOSS';
                exitPrice = stopLoss * (1 - slSlipRate);
                exitTime = ck.time;
                exitCandleIdx = k;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                const grossTradePnl = positionSize * (exitPrice - entryPrice);
                pnl = grossTradePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
                break;
              }
            } else {
              // SELL (Short)
              const hitTP = ck.low <= takeProfit;
              const hitSL = ck.high >= stopLoss;

              if (hitTP && hitSL) {
                status = 'LOSS';
                exitPrice = stopLoss * (1 + slSlipRate);
                exitTime = ck.time;
                exitCandleIdx = k;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                const grossTradePnl = positionSize * (entryPrice - exitPrice);
                pnl = grossTradePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
                break;
              } else if (hitTP) {
                status = 'WIN';
                exitPrice = takeProfit;
                exitTime = ck.time;
                exitCandleIdx = k;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                const grossTradePnl = positionSize * (entryPrice - exitPrice);
                pnl = grossTradePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
                break;
              } else if (hitSL) {
                status = 'LOSS';
                exitPrice = stopLoss * (1 + slSlipRate);
                exitTime = ck.time;
                exitCandleIdx = k;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                const grossTradePnl = positionSize * (entryPrice - exitPrice);
                pnl = grossTradePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
                break;
              }
            }

            // خروج زمانی (Time-Stop): حداکثر تعداد کندل مجاز در معامله (چه در سود چه در ضرر)
            const timeStopActive = config.timeStopEnabled !== false && typeof config.timeStopCandles === 'number' && config.timeStopCandles > 0;
            const candlesInTrade = k - entryCandleIdx + 1;
            if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
              exitPrice = ck.close;
              exitTime = ck.time;
              exitCandleIdx = k;
              const exitFee = (positionSize * exitPrice) * exitFeeRate;
              const tradeFee = entryFee + exitFee;
              const grossTradePnl = direction === 'BUY'
                ? positionSize * (exitPrice - entryPrice)
                : positionSize * (entryPrice - exitPrice);
              pnl = grossTradePnl - tradeFee;
              pnlPercent = (pnl / rollingCapital) * 100;
              status = pnl > 0.0001 ? 'WIN' : (pnl < -0.0001 ? 'LOSS' : 'BREAKEVEN');
              reason = 'TIME_STOP';
              break;
            }
          }

          // If neither TP nor SL hit up to the latest candle
          if (status === 'ACTIVE') {
            const latestCandle = candles[candles.length - 1];
            const curPrice = latestCandle.close;
            exitPrice = curPrice;
            const currentMove = direction === 'BUY' ? curPrice - entryPrice : entryPrice - curPrice;
            const grossMovePnl = positionSize * currentMove;
            const exitFee = (positionSize * exitPrice) * exitFeeRate;
            const tradeFee = entryFee + exitFee;
            pnl = grossMovePnl - tradeFee;
            pnlPercent = (pnl / rollingCapital) * 100;
          }

          const elapsed = entryCandleIdx - candleIdxF;
          const actualExitPrice = exitPrice ?? entryPrice;
          const tradeExitFee = (positionSize * actualExitPrice) * exitFeeRate;
          const tradeTotalFee = entryFee + tradeExitFee;
          const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
          pnl = parseFloat(pnl.toFixed(4));
          pnlPercent = parseFloat(pnlPercent.toFixed(4));

          // ارتقای بالانس پویا برای معامله بعدی
          rollingCapital = Math.max(1, parseFloat((rollingCapital + pnl).toFixed(4)));

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
            riskAmount: parseFloat(riskAmount.toFixed(4)),
            targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
            realizedRisk: parseFloat(realizedRisk.toFixed(4)),
            stepSize: sizing.stepSize,
            qtyPrecision: sizing.qtyPrecision,
            positionSize,
            positionValue: parseFloat(positionValue.toFixed(4)),
            positionToRiskRatio: posToRiskRatio,
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
            grossPnl: parseFloat((pnl + tradeTotalFee).toFixed(4)),
            entryFee: parseFloat(entryFee.toFixed(4)),
            exitFee: parseFloat(tradeExitFee.toFixed(4)),
            fee: parseFloat(tradeTotalFee.toFixed(4)),
            commission: parseFloat(tradeTotalFee.toFixed(4)),
            pnl,
            pnlPercent,
            returnR: riskAmount > 0 ? parseFloat((pnl / riskAmount).toFixed(3)) : 0,
            capitalBeforeTrade,
            capitalAfterTrade: rollingCapital,
            slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
            entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
            exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
            reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
          });

          lastTradeExitCandleIdx = Math.max(
            lastTradeExitCandleIdx,
            exitCandleIdx !== undefined ? exitCandleIdx : candles.length
          );

          // User Rule: فقط یکبار دیگر میتواند پس از استاپ در صورت شرایطی که گفته شد وارد شود.
          // (حداکثر ۱ بار ورود مجدد فقط پس از استاپ لاس واقعی، نه پس از خروج زمانی Time-Stop)
          if (status === 'LOSS' && reason !== 'TIME_STOP' && exitCandleIdx !== undefined && attempt < 2) {
            // New entry window begins right from the stop loss candle!
            scanStartIdx = exitCandleIdx + 1;
            scanMaxWindow = exitCandleIdx + config.maxCandlesToEnter;
            attempt++;
          } else {
            // If WIN, TIME_STOP, still ACTIVE, or already used the 1 re-entry attempt:
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
  const effectiveMaxCandles = (config.maxCandlesToEnter && config.maxCandlesToEnter > 0) ? config.maxCandlesToEnter : 35;

  const rawMinAtr = config.minAtrPercent ?? config.optMinAtrPercent;
  const effectiveMinAtrPct =
    rawMinAtr !== undefined && rawMinAtr !== null && !isNaN(Number(rawMinAtr))
      ? Math.max(0, Number(rawMinAtr))
      : 0.25;
  const rawRsi = config.s2RsiThreshold ?? config.optS2RsiThreshold;
  const parsedRsi =
    rawRsi !== undefined && rawRsi !== null && !isNaN(Number(rawRsi))
      ? Number(rawRsi)
      : 38;
  const effectiveRsiThresh = parsedRsi > 0 && parsedRsi < 50 ? parsedRsi : 0;
  const rawMinPivotAtr = config.minEntryPivotAtr ?? config.optMinEntryPivotAtr;
  const effectiveMinPivotAtr =
    rawMinPivotAtr !== undefined && rawMinPivotAtr !== null && !isNaN(Number(rawMinPivotAtr))
      ? Math.max(0, Number(rawMinPivotAtr))
      : 0;
  const rsi14 = effectiveRsiThresh > 0 ? calculateRSI(candles, 14) : [];

  let currentGiant: ZigZagLeg | null = null;
  let lastTradeExitCandleIdx = -1;
  let rollingCapital = config.capital;

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

          // سقف کندل ورود برای استراتژی ۲:
          // شمارش از نقطه پیوت (currentFIdx) تا کندل ورود.
          // اگر تعداد کندل‌های سپری شده از نقطه پیوت بیش از سقف مجاز باشد، ستاپ منقضی می‌شود.
          if (candleDist > effectiveMaxCandles) {
            break;
          }

          // شرط اولین بار تشکیل لگ نزولی بعد از F:
          // حداقل minCandles کندل گذشته باشد و افت قیمت حداقل برابر atrMultiplier * ATR باشد
          if (candleDist >= effectiveMinCandles && priceDist >= requiredDistance) {
            const thresholdPrice = currentFVal - requiredDistance;
            // در لحظه فعال‌شدن شرط، قیمت از thresholdPrice عبور کرده
            const entryPrice = Math.min(c.open, thresholdPrice);
            const entryTime = c.time;
            const entryCandleIdx = cIdx;
            const stopLoss = currentFVal;
            const stopDistance = Math.abs(entryPrice - stopLoss);

            if (effectiveMinAtrPct > 0 && (entryPrice <= 0 || (atr / entryPrice) * 100 < effectiveMinAtrPct)) {
              break;
            }
            if (effectiveRsiThresh > 0) {
              const pivotRsi = rsi14[currentFIdx] ?? 50;
              if (pivotRsi < 100 - effectiveRsiThresh) {
                break;
              }
            }
            if (effectiveMinPivotAtr > 0 && (atr <= 0 || stopDistance / atr < effectiveMinPivotAtr)) {
              break;
            }

            if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
              break;
            }

            if (stopDistance > 0.000001) {
              const direction: 'BUY' | 'SELL' = 'SELL'; // ریزش از سقف F
              const cycleType: 'bullish' | 'bearish' = giantLeg.isUp ? 'bullish' : 'bearish';

              const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;
              const riskReward = targetRR;
              const takeProfit = entryPrice - stopDistance * targetRR;

              const riskBudget =
                config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
                  ? config.riskAmountFixed
                  : (rollingCapital * (config.riskPercent || 1.0)) / 100;
              const entryFeeRate =
                (config.entryCommissionPercent ??
                  (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
              const exitFeeRate =
                (config.exitCommissionPercent ??
                  (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

              const effectiveExchange = config.exchange ?? 'xt';
              const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

              // محاسبه حجم دقیق با اعمال قراردادهای صحیح XT / استپ سایز صرافی و لحاظ کارمزدها
              const sizing = calculateExactTradeSizing(
                riskBudget,
                entryPrice,
                stopLoss,
                takeProfit,
                entryFeeRate,
                exitFeeRate,
                config.symbol,
                {
                  exchange: effectiveExchange,
                  contractSize: config.xtContractSize,
                  minNotional: config.xtMinNotional,
                  riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
                  slSlippageRate: slSlipRate,
                }
              );
              const positionSize = sizing.quantizedPositionSize;
              const positionValue = sizing.positionValue;
              const entryFee = sizing.entryFee;
              const riskAmount = riskBudget;
              const realizedRisk = sizing.actualLossAtSL;

              if (positionSize <= 0 || positionValue <= 0) {
                break;
              }

              // حداکثر نسبت ارزش پوزیشن به ریسک (پیش‌فرض ۳۰۰)
              const effectiveMaxRatio = config.maxPositionToRiskRatio !== undefined
                ? config.maxPositionToRiskRatio
                : (config.optMaxPositionToRiskRatio !== undefined ? config.optMaxPositionToRiskRatio : 300);
              const posToRiskRatio = (riskAmount > 0)
                ? parseFloat((positionValue / riskAmount).toFixed(2))
                : 0;

              if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
                break;
              }

              let status: TradeStatus = 'ACTIVE';
              let exitTime: number | undefined;
              let exitCandleIdx: number | undefined;
              let exitPrice: number | undefined;
              let pnl = 0;
              let pnlPercent = 0;
              let reason: string | undefined = undefined;

              for (let k = entryCandleIdx; k < candles.length; k++) {
                const ck = candles[k];
                const hitTP = ck.low <= takeProfit;
                const hitSL = ck.high >= stopLoss;

                if (hitTP && hitSL) {
                  status = 'LOSS';
                  exitPrice = stopLoss * (1 + slSlipRate);
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (entryPrice - exitPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  break;
                } else if (hitTP) {
                  status = 'WIN';
                  exitPrice = takeProfit;
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (entryPrice - exitPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  break;
                } else if (hitSL) {
                  status = 'LOSS';
                  exitPrice = stopLoss * (1 + slSlipRate);
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (entryPrice - exitPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  break;
                }

                // خروج زمانی (Time-Stop): حداکثر زمان ماندن در پوزیشن (تعداد کندل)
                const timeStopActive = config.timeStopEnabled !== false && typeof config.timeStopCandles === 'number' && config.timeStopCandles > 0;
                const candlesInTrade = k - entryCandleIdx + 1;
                if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
                  exitPrice = ck.close;
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (entryPrice - exitPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  status = pnl > 0.0001 ? 'WIN' : (pnl < -0.0001 ? 'LOSS' : 'BREAKEVEN');
                  reason = 'TIME_STOP';
                  break;
                }
              }

              if (status === 'ACTIVE') {
                const latestCandle = candles[candles.length - 1];
                const curPrice = latestCandle.close;
                exitPrice = curPrice;
                const currentMove = entryPrice - curPrice;
                const grossMovePnl = positionSize * currentMove;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                pnl = grossMovePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
              }

              const actualExitPrice = exitPrice ?? entryPrice;
              const tradeExitFee = (positionSize * actualExitPrice) * exitFeeRate;
              const tradeTotalFee = entryFee + tradeExitFee;
              const grossVal = positionSize * (entryPrice - actualExitPrice);
              const netVal = grossVal - tradeTotalFee;
              const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
              const nextCap = Math.max(1, parseFloat((rollingCapital + netVal).toFixed(4)));

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
                riskAmount: parseFloat(riskAmount.toFixed(4)),
                targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
                realizedRisk: parseFloat(realizedRisk.toFixed(4)),
                stepSize: sizing.stepSize,
                qtyPrecision: sizing.qtyPrecision,
                positionSize,
                positionValue: parseFloat(positionValue.toFixed(4)),
                positionToRiskRatio: posToRiskRatio,
                riskReward: parseFloat(riskReward.toFixed(2)),
                timeF,
                candleIdxF,
                entryTime,
                entryCandleIdx,
                exitTime,
                exitCandleIdx,
                exitPrice: exitPrice,
                candlesElapsedToEntry: entryCandleIdx - currentFIdx,
                candlesRemainingToEnter: 0,
                waitingForPostLeg: false,
                hasPostLeg: true,
                status,
                grossPnl: parseFloat(grossVal.toFixed(4)),
                entryFee: parseFloat(entryFee.toFixed(4)),
                exitFee: parseFloat(tradeExitFee.toFixed(4)),
                fee: parseFloat(tradeTotalFee.toFixed(4)),
                commission: parseFloat(tradeTotalFee.toFixed(4)),
                pnl: parseFloat(netVal.toFixed(4)),
                pnlPercent: parseFloat(((netVal / rollingCapital) * 100).toFixed(4)),
                returnR: riskAmount > 0 ? parseFloat((netVal / riskAmount).toFixed(3)) : 0,
                capitalBeforeTrade,
                capitalAfterTrade: nextCap,
                slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
                entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
                exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
                reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
              });

              rollingCapital = nextCap;

              lastTradeExitCandleIdx = Math.max(
                lastTradeExitCandleIdx,
                exitCandleIdx !== undefined ? exitCandleIdx : candles.length
              );
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

          // سقف کندل ورود برای استراتژی ۲:
          // شمارش از نقطه پیوت (currentFIdx) تا کندل ورود.
          // اگر تعداد کندل‌های سپری شده از نقطه پیوت بیش از سقف مجاز باشد، ستاپ منقضی می‌شود.
          if (candleDist > effectiveMaxCandles) {
            break;
          }

          // شرط اولین بار تشکیل لگ صعودی بعد از F:
          // حداقل minCandles کندل گذشته باشد و رشد قیمت حداقل برابر atrMultiplier * ATR باشد
          if (candleDist >= effectiveMinCandles && priceDist >= requiredDistance) {
            const thresholdPrice = currentFVal + requiredDistance;
            const entryPrice = Math.max(c.open, thresholdPrice);
            const entryTime = c.time;
            const entryCandleIdx = cIdx;
            const stopLoss = currentFVal;
            const stopDistance = Math.abs(entryPrice - stopLoss);

            if (effectiveMinAtrPct > 0 && (entryPrice <= 0 || (atr / entryPrice) * 100 < effectiveMinAtrPct)) {
              break;
            }
            if (effectiveRsiThresh > 0) {
              const pivotRsi = rsi14[currentFIdx] ?? 50;
              if (pivotRsi > effectiveRsiThresh) {
                break;
              }
            }
            if (effectiveMinPivotAtr > 0 && (atr <= 0 || stopDistance / atr < effectiveMinPivotAtr)) {
              break;
            }

            if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
              break;
            }

            if (stopDistance > 0.000001) {
              const direction: 'BUY' | 'SELL' = 'BUY'; // صعود از کف F
              const cycleType: 'bullish' | 'bearish' = giantLeg.isUp ? 'bullish' : 'bearish';

              const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;
              const riskReward = targetRR;
              const takeProfit = entryPrice + stopDistance * targetRR;

              const riskBudget =
                config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
                  ? config.riskAmountFixed
                  : (rollingCapital * (config.riskPercent || 1.0)) / 100;
              const entryFeeRate =
                (config.entryCommissionPercent ??
                  (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
              const exitFeeRate =
                (config.exitCommissionPercent ??
                  (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

              const effectiveExchange = config.exchange ?? 'xt';
              const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

              // محاسبه حجم دقیق با اعمال قراردادهای صحیح XT / استپ سایز صرافی و لحاظ کارمزدها
              const sizing = calculateExactTradeSizing(
                riskBudget,
                entryPrice,
                stopLoss,
                takeProfit,
                entryFeeRate,
                exitFeeRate,
                config.symbol,
                {
                  exchange: effectiveExchange,
                  contractSize: config.xtContractSize,
                  minNotional: config.xtMinNotional,
                  riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
                  slSlippageRate: slSlipRate,
                }
              );
              const positionSize = sizing.quantizedPositionSize;
              const positionValue = sizing.positionValue;
              const entryFee = sizing.entryFee;
              const riskAmount = riskBudget;
              const realizedRisk = sizing.actualLossAtSL;

              if (positionSize <= 0 || positionValue <= 0) {
                break;
              }

              // حداکثر نسبت ارزش پوزیشن به ریسک (پیش‌فرض ۳۰۰)
              const effectiveMaxRatio = config.maxPositionToRiskRatio !== undefined
                ? config.maxPositionToRiskRatio
                : (config.optMaxPositionToRiskRatio !== undefined ? config.optMaxPositionToRiskRatio : 300);
              const posToRiskRatio = (riskAmount > 0)
                ? parseFloat((positionValue / riskAmount).toFixed(2))
                : 0;

              if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
                break;
              }

              let status: TradeStatus = 'ACTIVE';
              let exitTime: number | undefined;
              let exitCandleIdx: number | undefined;
              let exitPrice: number | undefined;
              let pnl = 0;
              let pnlPercent = 0;
              let reason: string | undefined = undefined;

              for (let k = entryCandleIdx; k < candles.length; k++) {
                const ck = candles[k];
                const hitTP = ck.high >= takeProfit;
                const hitSL = ck.low <= stopLoss;

                if (hitTP && hitSL) {
                  status = 'LOSS';
                  exitPrice = stopLoss * (1 - slSlipRate);
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (exitPrice - entryPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  break;
                } else if (hitTP) {
                  status = 'WIN';
                  exitPrice = takeProfit;
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (exitPrice - entryPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  break;
                } else if (hitSL) {
                  status = 'LOSS';
                  exitPrice = stopLoss * (1 - slSlipRate);
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (exitPrice - entryPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  break;
                }

                // خروج زمانی (Time-Stop): حداکثر زمان ماندن در پوزیشن (تعداد کندل)
                const timeStopActive = config.timeStopEnabled !== false && typeof config.timeStopCandles === 'number' && config.timeStopCandles > 0;
                const candlesInTrade = k - entryCandleIdx + 1;
                if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
                  exitPrice = ck.close;
                  exitTime = ck.time;
                  exitCandleIdx = k;
                  const exitFee = (positionSize * exitPrice) * exitFeeRate;
                  const tradeFee = entryFee + exitFee;
                  const grossTradePnl = positionSize * (exitPrice - entryPrice);
                  pnl = grossTradePnl - tradeFee;
                  pnlPercent = (pnl / rollingCapital) * 100;
                  status = pnl > 0.0001 ? 'WIN' : (pnl < -0.0001 ? 'LOSS' : 'BREAKEVEN');
                  reason = 'TIME_STOP';
                  break;
                }
              }

              if (status === 'ACTIVE') {
                const latestCandle = candles[candles.length - 1];
                const curPrice = latestCandle.close;
                exitPrice = curPrice;
                const currentMove = curPrice - entryPrice;
                const grossMovePnl = positionSize * currentMove;
                const exitFee = (positionSize * exitPrice) * exitFeeRate;
                const tradeFee = entryFee + exitFee;
                pnl = grossMovePnl - tradeFee;
                pnlPercent = (pnl / rollingCapital) * 100;
              }

              const actualExitPrice = exitPrice ?? entryPrice;
              const tradeExitFee = (positionSize * actualExitPrice) * exitFeeRate;
              const tradeTotalFee = entryFee + tradeExitFee;
              const grossVal = positionSize * (actualExitPrice - entryPrice);
              const netVal = grossVal - tradeTotalFee;
              const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
              const nextCap = Math.max(1, parseFloat((rollingCapital + netVal).toFixed(4)));

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
                riskAmount: parseFloat(riskAmount.toFixed(4)),
                targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
                realizedRisk: parseFloat(realizedRisk.toFixed(4)),
                stepSize: sizing.stepSize,
                qtyPrecision: sizing.qtyPrecision,
                positionSize,
                positionValue: parseFloat(positionValue.toFixed(4)),
                positionToRiskRatio: posToRiskRatio,
                riskReward: parseFloat(riskReward.toFixed(2)),
                timeF,
                candleIdxF,
                entryTime,
                entryCandleIdx,
                exitTime,
                exitCandleIdx,
                exitPrice: exitPrice,
                candlesElapsedToEntry: entryCandleIdx - currentFIdx,
                candlesRemainingToEnter: 0,
                waitingForPostLeg: false,
                hasPostLeg: true,
                status,
                grossPnl: parseFloat(grossVal.toFixed(4)),
                entryFee: parseFloat(entryFee.toFixed(4)),
                exitFee: parseFloat(tradeExitFee.toFixed(4)),
                fee: parseFloat(tradeTotalFee.toFixed(4)),
                commission: parseFloat(tradeTotalFee.toFixed(4)),
                pnl: parseFloat(netVal.toFixed(4)),
                pnlPercent: parseFloat(((netVal / rollingCapital) * 100).toFixed(4)),
                returnR: riskAmount > 0 ? parseFloat((netVal / riskAmount).toFixed(3)) : 0,
                capitalBeforeTrade,
                capitalAfterTrade: nextCap,
                slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
                entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
                exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
                reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
              });

              rollingCapital = nextCap;

              lastTradeExitCandleIdx = Math.max(
                lastTradeExitCandleIdx,
                exitCandleIdx !== undefined ? exitCandleIdx : candles.length
              );
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
 * Finds the exact candle index where a ZigZag pivot `P1` is first causally formed/confirmed
 * by a reversal move of at least `atrMultiplier * ATR` away from `P1.value`
 * without breaking past `P1.value` before confirmation.
 * Returns -1 if `P1` is still unconfirmed or was broken before confirmation.
 */
export function findPivotConfirmCandleIdx(
  candles: CandleData[],
  pivotP1: ZigZagPoint,
  pivotIdxP1: number,
  atrValues?: number[],
  atrMultiplier: number = 3
): number {
  const effectiveAtrMult = atrMultiplier > 0 ? atrMultiplier : 3;
  const priceP1 = pivotP1.value;
  for (let cIdx = pivotIdxP1 + 1; cIdx < candles.length; cIdx++) {
    const c = candles[cIdx];
    const atr =
      atrValues && atrValues[cIdx] > 0
        ? atrValues[cIdx]
        : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    if (pivotP1.type === 'high') {
      // Pivot 1 is a HIGH: confirmed once price drops by >= th from P1 without breaking above P1 first
      if (c.high > priceP1) return -1;
      if (priceP1 - c.low >= th) return cIdx;
    } else {
      // Pivot 1 is a LOW: confirmed once price bounces by >= th from P1 without breaking below P1 first
      if (c.low < priceP1) return -1;
      if (c.high - priceP1 >= th) return cIdx;
    }
  }
  return -1;
}

/**
 * Normalizes confirmed ZigZag pivots identically to `calculateAtrZigZag`'s post-filter
 * using ONLY pivots already confirmed up to the current causal candle (zero future data).
 */
function normalizeConfirmedPivotsCausal(
  rawPivots: ZigZagPoint[],
  atrValues: number[] | undefined,
  atrMultiplier: number,
  effectiveMinCandles: number
): ZigZagPoint[] {
  if (rawPivots.length === 0) return [];
  let pivots = rawPivots.map((p) => ({ ...p }));
  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    const next: ZigZagPoint[] = [];
    for (let i = 0; i < pivots.length; i++) {
      if (next.length >= 2) {
        const pPrev2 = next[next.length - 2];
        const pPrev1 = next[next.length - 1];
        const pCurr = pivots[i];
        const cDist = (pCurr.candleIndex ?? 0) - (pPrev1.candleIndex ?? 0);
        const pDist = Math.abs(pCurr.value - pPrev1.value);
        const refAtr =
          atrValues && atrValues[pCurr.candleIndex ?? 0] > 0
            ? atrValues[pCurr.candleIndex ?? 0]
            : 1;
        const pRatio = pDist / refAtr;

        if (cDist < effectiveMinCandles || pRatio < atrMultiplier - 0.01) {
          if (pCurr.type === pPrev2.type) {
            if (pCurr.type === 'high' && pCurr.value >= pPrev2.value) {
              next.pop();
              next.pop();
              next.push(pCurr);
              changed = true;
              continue;
            }
            if (pCurr.type === 'low' && pCurr.value <= pPrev2.value) {
              next.pop();
              next.pop();
              next.push(pCurr);
              changed = true;
              continue;
            }
          }
        }
      }
      next.push(pivots[i]);
    }
    pivots = next;
  }

  const cleanPivots: ZigZagPoint[] = [];
  for (const p of pivots) {
    if (cleanPivots.length === 0) {
      cleanPivots.push(p);
    } else {
      const prev = cleanPivots[cleanPivots.length - 1];
      if (p.type === prev.type) {
        if (p.type === 'high' && p.value > prev.value) {
          cleanPivots[cleanPivots.length - 1] = p;
        } else if (p.type === 'low' && p.value < prev.value) {
          cleanPivots[cleanPivots.length - 1] = p;
        }
      } else if ((p.candleIndex ?? 0) > (prev.candleIndex ?? 0)) {
        cleanPivots.push(p);
      }
    }
  }
  return cleanPivots;
}

/**
 * Runs Backtest for Strategy 3 (5-Consecutive-Pivot Pattern — Strictly Causal):
 * Walks candles bar-by-bar using the exact `calculateAtrZigZag` state machine so that
 * NO future candle can retroactively erase or relocate a failed pivot `P1` (zero repainting / look-ahead bias).
 *
 * At the exact candle `i` where a new pivot `P1` causally confirms via ATR-multiplier reversal,
 * evaluates the 6 newest confirmed pivots ordered newest to oldest (`P1, P2, P3, P4, P5, P6`):
 *
 * Bullish Setup (BUY — پیوت اول کف است):
 *   - P1 = low, P2 = high, P3 = low, P4 = high, P5 = low, P6 = high
 *   - P1 < P3 (پیوت اول پایین‌تر از دو پیوت قبل)
 *   - P2 > P4 (پیوت دوم بالاتر از دو پیوت قبل)
 *   - P3 < P5 (پیوت سوم پایین‌تر از دو پیوت قبل)
 *   - P4 > P6 (پیوت چهارم بالاتر از دو پیوت قبل)
 *
 * Bearish Setup (SELL — پیوت اول سقف است):
 *   - P1 = high, P2 = low, P3 = high, P4 = low, P5 = high, P6 = low
 *   - P1 > P3 (پیوت اول بالاتر از دو پیوت قبل)
 *   - P2 < P4 (پیوت دوم پایین‌تر از دو پیوت قبل)
 *   - P3 > P5 (پیوت سوم بالاتر از دو پیوت قبل)
 *   - P4 < P6 (پیوت چهارم پایین‌تر از دو پیوت قبل)
 *
 * Entry & Risk Rules:
 *   - Enter at Market at close of the causal confirmation candle `i` (or `i + 1` if `P1` formed on the same bar `i` and holds).
 *   - Stop Loss = P1.value.
 *   - Take Profit = entryPrice +/- |entryPrice - stopLoss| * targetRR.
 */
export function runStrategy3Backtest(
  candles: CandleData[],
  _points: ZigZagPoint[],
  _legs: ZigZagLeg[],
  config: StrategyConfig,
  atrValues?: number[],
  atrMultiplier: number = 3,
  minCandles: number = 3
): {
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
} {
  const trades: StrategyTrade[] = [];
  const n = candles.length;
  if (n < 2) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  const effectiveMinCandles = Math.max(1, minCandles);
  const effectiveAtrMult = atrMultiplier > 0 ? atrMultiplier : 3;
  const targetRR = config.maxRiskReward > 0 ? config.maxRiskReward : 2.0;

  const rawMinAtr = config.minAtrPercent ?? config.optMinAtrPercent;
  const effectiveMinAtrPct =
    rawMinAtr !== undefined && rawMinAtr !== null && !isNaN(Number(rawMinAtr))
      ? Math.max(0, Number(rawMinAtr))
      : 0.25;
  const rawRsi = config.s2RsiThreshold ?? config.optS2RsiThreshold;
  const parsedRsi =
    rawRsi !== undefined && rawRsi !== null && !isNaN(Number(rawRsi))
      ? Number(rawRsi)
      : 38;
  const effectiveRsiThresh = parsedRsi > 0 && parsedRsi < 50 ? parsedRsi : 0;
  const rawMinPivotAtr = config.minEntryPivotAtr ?? config.optMinEntryPivotAtr;
  const effectiveMinPivotAtr =
    rawMinPivotAtr !== undefined && rawMinPivotAtr !== null && !isNaN(Number(rawMinPivotAtr))
      ? Math.max(0, Number(rawMinPivotAtr))
      : 0;
  const rsi14 = effectiveRsiThresh > 0 ? calculateRSI(candles, 14) : [];
  const effectiveAtrValues =
    atrValues && atrValues.length === candles.length
      ? atrValues
      : (effectiveMinAtrPct > 0 || effectiveMinPivotAtr > 0)
      ? calculateATR(candles, config.atrPeriod || 14).atrValues
      : atrValues;

  // 1. Causal initial trend setup (mirrors `calculateAtrZigZag` step 1)
  let trend = 0; // 1 for UP (seeking peak), -1 for DOWN (seeking trough)
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const atr = atrValues && atrValues[i] > 0 ? atrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    if (i >= effectiveMinCandles) {
      if (c.high - candles[0].low >= th) {
        trend = 1;
        startIdx = i;
        break;
      } else if (candles[0].high - c.low >= th) {
        trend = -1;
        startIdx = i;
        break;
      }
    }
  }

  if (trend === 0) {
    return {
      trades: [],
      metrics: getEmptyMetrics(config.capital),
    };
  }

  const rawPivots: ZigZagPoint[] = [];
  if (trend === 1) {
    rawPivots.push({
      time: candles[0].time,
      value: candles[0].low,
      type: 'low',
      atrAtPoint: atrValues?.[0] || candles[0].high - candles[0].low,
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  } else {
    rawPivots.push({
      time: candles[0].time,
      value: candles[0].high,
      type: 'high',
      atrAtPoint: atrValues?.[0] || candles[0].high - candles[0].low,
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    });
  }

  let curExtremeVal = trend === 1 ? candles[startIdx].high : candles[startIdx].low;
  let curExtremeIdx = startIdx;

  let lastTradeExitCandleIdx = -1;
  let rollingCapital = config.capital;
  // Deferred check for rare same-candle pinbar pivot confirmation (ensures entryCandleIdx > candleIdxF)
  let pendingSameBarSetup: { p1: ZigZagPoint; p2: ZigZagPoint; p6: ZigZagPoint; direction: 'BUY' | 'SELL' } | null = null;

  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const atr = atrValues && atrValues[i] > 0 ? atrValues[i] : Math.max(0.0001, c.high - c.low);
    const th = atr * effectiveAtrMult;
    const lastPivot = rawPivots[rawPivots.length - 1];

    let newlyConfirmedPivot: ZigZagPoint | null = null;

    if (trend === 1) {
      if (c.low < lastPivot.value) {
        lastPivot.value = c.low;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        pendingSameBarSetup = null;
        continue;
      }

      if (c.high > curExtremeVal) {
        curExtremeVal = c.high;
        curExtremeIdx = i;
      }

      const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
      const priceDist = curExtremeVal - lastPivot.value;
      const peakAtr = atrValues && atrValues[curExtremeIdx] > 0 ? atrValues[curExtremeIdx] : atr;

      if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * peakAtr && curExtremeVal - c.low >= th) {
        const confirmedPeakIdx = curExtremeIdx;
        newlyConfirmedPivot = {
          time: candles[confirmedPeakIdx].time,
          value: curExtremeVal,
          type: 'high',
          candleIndex: confirmedPeakIdx,
          atrAtPoint: peakAtr,
          legPoints: priceDist,
          legAtrRatio: peakAtr > 0 ? priceDist / peakAtr : 0,
        };
        rawPivots.push(newlyConfirmedPivot);

        trend = -1;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        for (let k = confirmedPeakIdx + 1; k <= i; k++) {
          if (candles[k].low < curExtremeVal) {
            curExtremeVal = candles[k].low;
            curExtremeIdx = k;
          }
        }
      }
    } else {
      if (c.high > lastPivot.value) {
        lastPivot.value = c.high;
        lastPivot.time = c.time;
        lastPivot.candleIndex = i;
        curExtremeVal = c.low;
        curExtremeIdx = i;
        pendingSameBarSetup = null;
        continue;
      }

      if (c.low < curExtremeVal) {
        curExtremeVal = c.low;
        curExtremeIdx = i;
      }

      const candleDist = curExtremeIdx - (lastPivot.candleIndex ?? 0);
      const priceDist = lastPivot.value - curExtremeVal;
      const troughAtr = atrValues && atrValues[curExtremeIdx] > 0 ? atrValues[curExtremeIdx] : atr;

      if (candleDist >= effectiveMinCandles && priceDist >= effectiveAtrMult * troughAtr && c.high - curExtremeVal >= th) {
        const confirmedTroughIdx = curExtremeIdx;
        newlyConfirmedPivot = {
          time: candles[confirmedTroughIdx].time,
          value: curExtremeVal,
          type: 'low',
          candleIndex: confirmedTroughIdx,
          atrAtPoint: troughAtr,
          legPoints: priceDist,
          legAtrRatio: troughAtr > 0 ? priceDist / troughAtr : 0,
        };
        rawPivots.push(newlyConfirmedPivot);

        trend = 1;
        curExtremeVal = c.high;
        curExtremeIdx = i;
        for (let k = confirmedTroughIdx + 1; k <= i; k++) {
          if (candles[k].high > curExtremeVal) {
            curExtremeVal = candles[k].high;
            curExtremeIdx = k;
          }
        }
      }
    }

    // Evaluate either a deferred same-bar pivot (now at i = pivotIdx + 1) or a newly confirmed pivot
    let triggerP1: ZigZagPoint | null = null;
    let triggerP2: ZigZagPoint | null = null;
    let triggerP6: ZigZagPoint | null = null;
    let triggerDirection: 'BUY' | 'SELL' | null = null;

    if (pendingSameBarSetup) {
      const heldStop =
        pendingSameBarSetup.direction === 'BUY'
          ? c.low >= pendingSameBarSetup.p1.value && c.high - pendingSameBarSetup.p1.value >= th
          : c.high <= pendingSameBarSetup.p1.value && pendingSameBarSetup.p1.value - c.low >= th;
      if (heldStop && !newlyConfirmedPivot) {
        triggerP1 = pendingSameBarSetup.p1;
        triggerP2 = pendingSameBarSetup.p2;
        triggerP6 = pendingSameBarSetup.p6;
        triggerDirection = pendingSameBarSetup.direction;
      }
      pendingSameBarSetup = null;
    }

    if (newlyConfirmedPivot && rawPivots.length >= 6) {
      const cleanPivots = normalizeConfirmedPivotsCausal(
        rawPivots,
        atrValues,
        effectiveAtrMult,
        effectiveMinCandles
      );
      if (cleanPivots.length >= 6) {
        const len = cleanPivots.length;
        const p1 = cleanPivots[len - 1]; // اولی (جدیدترین)
        const p2 = cleanPivots[len - 2]; // دومی
        const p3 = cleanPivots[len - 3]; // سومی
        const p4 = cleanPivots[len - 4]; // چهارمی
        const p5 = cleanPivots[len - 5]; // پنجمی
        const p6 = cleanPivots[len - 6]; // ششمی (قدیمی‌ترین)

        // Ensure the top pivot is indeed the one just confirmed at bar `i`
        if ((p1.candleIndex ?? -1) === (newlyConfirmedPivot.candleIndex ?? -2) && p1.type === newlyConfirmedPivot.type) {
          const isBullishSetup =
            p1.type === 'low' &&
            p2.type === 'high' &&
            p3.type === 'low' &&
            p4.type === 'high' &&
            p5.type === 'low' &&
            p6.type === 'high' &&
            p1.value < p3.value &&
            p2.value > p4.value &&
            p3.value < p5.value &&
            p4.value > p6.value;

          const isBearishSetup =
            p1.type === 'high' &&
            p2.type === 'low' &&
            p3.type === 'high' &&
            p4.type === 'low' &&
            p5.type === 'high' &&
            p6.type === 'low' &&
            p1.value > p3.value &&
            p2.value < p4.value &&
            p3.value > p5.value &&
            p4.value < p6.value;

          if (isBullishSetup || isBearishSetup) {
            const dir: 'BUY' | 'SELL' = isBullishSetup ? 'BUY' : 'SELL';
            if ((p1.candleIndex ?? i) === i) {
              // Same-candle reversal: defer 1 candle so entryCandleIdx > candleIdxF and intra-bar order is unambiguous
              pendingSameBarSetup = { p1, p2, p6, direction: dir };
              continue;
            }
            triggerP1 = p1;
            triggerP2 = p2;
            triggerP6 = p6;
            triggerDirection = dir;
          }
        }
      }
    }

    if (!triggerP1 || !triggerP2 || !triggerP6 || !triggerDirection) {
      continue;
    }

    const pivotIdxP1 = triggerP1.candleIndex ?? 0;
    const entryCandleIdx = i;

    if (entryCandleIdx <= pivotIdxP1) {
      continue;
    }

    if (config.noConcurrentPositions && entryCandleIdx <= lastTradeExitCandleIdx) {
      continue;
    }

    const direction = triggerDirection;
    const cycleType: 'bullish' | 'bearish' = direction === 'BUY' ? 'bullish' : 'bearish';
    const entryCandle = candles[entryCandleIdx];
    const entryTime = entryCandle.time;
    const entryPrice = entryCandle.close;
    const stopLoss = triggerP1.value;

    // Ensure entry close is strictly on the valid side of Stop Loss (P1)
    if (
      !(entryPrice > 0) ||
      !(stopLoss > 0) ||
      (direction === 'BUY' ? entryPrice <= stopLoss : entryPrice >= stopLoss)
    ) {
      continue;
    }

    const stopDistance = Math.abs(entryPrice - stopLoss);
    if (stopDistance <= 0.000001) {
      continue;
    }

    const entryAtr =
      effectiveAtrValues && effectiveAtrValues[entryCandleIdx] > 0
        ? effectiveAtrValues[entryCandleIdx]
        : Math.max(0.0001, entryCandle.high - entryCandle.low);

    if (effectiveMinAtrPct > 0 && (entryPrice <= 0 || (entryAtr / entryPrice) * 100 < effectiveMinAtrPct)) {
      continue;
    }
    if (effectiveRsiThresh > 0) {
      const pivotRsi = rsi14[pivotIdxP1] ?? 50;
      if (direction === 'BUY' ? pivotRsi > effectiveRsiThresh : pivotRsi < 100 - effectiveRsiThresh) {
        continue;
      }
    }
    if (effectiveMinPivotAtr > 0 && (entryAtr <= 0 || stopDistance / entryAtr < effectiveMinPivotAtr)) {
      continue;
    }

    const takeProfit =
      direction === 'BUY'
        ? entryPrice + stopDistance * targetRR
        : entryPrice - stopDistance * targetRR;
    const p1 = triggerP1;
    const p2 = triggerP2;
    const p6 = triggerP6;
    const idx = rawPivots.length - 1;

    const riskBudget =
      config.riskMode === 'fixed' && config.riskAmountFixed && config.riskAmountFixed > 0
        ? config.riskAmountFixed
        : (rollingCapital * (config.riskPercent || 1.0)) / 100;
    const entryFeeRate =
      (config.entryCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;
    const exitFeeRate =
      (config.exitCommissionPercent ??
        (config.commissionPercent !== undefined ? config.commissionPercent / 2 : 0.06)) / 100;

    const effectiveExchange = config.exchange ?? 'xt';
    const slSlipRate = (config.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

    const sizing = calculateExactTradeSizing(
      riskBudget,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      config.symbol,
      {
        exchange: effectiveExchange,
        contractSize: config.xtContractSize,
        minNotional: config.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );
    const positionSize = sizing.quantizedPositionSize;
    const positionValue = sizing.positionValue;
    const entryFee = sizing.entryFee;
    const riskAmount = riskBudget;
    const realizedRisk = sizing.actualLossAtSL;

    if (positionSize <= 0 || positionValue <= 0) {
      continue;
    }

    const effectiveMaxRatio =
      config.maxPositionToRiskRatio !== undefined
        ? config.maxPositionToRiskRatio
        : config.optMaxPositionToRiskRatio !== undefined
        ? config.optMaxPositionToRiskRatio
        : 300;
    const posToRiskRatio =
      riskAmount > 0 ? parseFloat((positionValue / riskAmount).toFixed(2)) : 0;

    if (effectiveMaxRatio > 0 && posToRiskRatio > effectiveMaxRatio) {
      continue;
    }

    let status: TradeStatus = 'ACTIVE';
    let exitTime: number | undefined;
    let exitCandleIdx: number | undefined;
    let exitPrice: number | undefined;
    let pnl = 0;
    let reason: string | undefined = undefined;

    // Entry occurs at close of entryCandleIdx; monitor TP/SL/Time-Stop from entryCandleIdx + 1 forward
    for (let k = entryCandleIdx + 1; k < candles.length; k++) {
      const ck = candles[k];
      const hitTP = direction === 'BUY' ? ck.high >= takeProfit : ck.low <= takeProfit;
      const hitSL = direction === 'BUY' ? ck.low <= stopLoss : ck.high >= stopLoss;

      if (hitTP && hitSL) {
        status = 'LOSS';
        exitPrice =
          direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        break;
      } else if (hitTP) {
        status = 'WIN';
        exitPrice = takeProfit;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        break;
      } else if (hitSL) {
        status = 'LOSS';
        exitPrice =
          direction === 'BUY' ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        break;
      }

      const timeStopActive =
        config.timeStopEnabled !== false &&
        typeof config.timeStopCandles === 'number' &&
        config.timeStopCandles > 0;
      const candlesInTrade = k - entryCandleIdx;
      if (status === 'ACTIVE' && timeStopActive && candlesInTrade >= config.timeStopCandles) {
        exitPrice = ck.close;
        exitTime = ck.time;
        exitCandleIdx = k;
        const exitFee = positionSize * exitPrice * exitFeeRate;
        const grossTradePnl =
          direction === 'BUY'
            ? positionSize * (exitPrice - entryPrice)
            : positionSize * (entryPrice - exitPrice);
        pnl = grossTradePnl - (entryFee + exitFee);
        status = pnl > 0.0001 ? 'WIN' : pnl < -0.0001 ? 'LOSS' : 'BREAKEVEN';
        reason = 'TIME_STOP';
        break;
      }
    }

    if (status === 'ACTIVE') {
      const latestCandle = candles[candles.length - 1];
      exitPrice = latestCandle.close;
      const exitFee = positionSize * exitPrice * exitFeeRate;
      const grossTradePnl =
        direction === 'BUY'
          ? positionSize * (exitPrice - entryPrice)
          : positionSize * (entryPrice - exitPrice);
      pnl = grossTradePnl - (entryFee + exitFee);
    }

    const actualExitPrice = exitPrice ?? entryPrice;
    const tradeExitFee = positionSize * actualExitPrice * exitFeeRate;
    const tradeTotalFee = entryFee + tradeExitFee;
    const grossVal =
      direction === 'BUY'
        ? positionSize * (actualExitPrice - entryPrice)
        : positionSize * (entryPrice - actualExitPrice);
    const netVal = grossVal - tradeTotalFee;
    const capitalBeforeTrade = parseFloat(rollingCapital.toFixed(4));
    const nextCap = Math.max(1, parseFloat((rollingCapital + netVal).toFixed(4)));
    const waitCandles = entryCandleIdx - pivotIdxP1;

    trades.push({
      id: `trade-s3-${trades.length + 1}-${idx}`,
      strategyId: 'strategy_3_ab_midpoint',
      strategyName:
        direction === 'BUY'
          ? 'استراتژی ۳ (۶ پیوت متوالی - خرید)'
          : 'استراتژی ۳ (۶ پیوت متوالی - فروش)',
      cycleIndex: trades.length + 1,
      attemptNumber: 1,
      direction,
      cycleType,
      priceA: p6.value,
      priceE: p2.value,
      priceF: stopLoss,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount: parseFloat(riskAmount.toFixed(4)),
      targetRiskAmount: parseFloat(riskAmount.toFixed(4)),
      realizedRisk: parseFloat(realizedRisk.toFixed(4)),
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      positionSize,
      positionValue: parseFloat(positionValue.toFixed(4)),
      positionToRiskRatio: posToRiskRatio,
      riskReward: parseFloat(targetRR.toFixed(2)),
      timeF: p1.time,
      candleIdxF: pivotIdxP1,
      entryTime,
      entryCandleIdx,
      exitTime,
      exitCandleIdx,
      exitPrice,
      candlesElapsedToEntry: waitCandles,
      candlesRemainingToEnter: 0,
      waitingForPostLeg: false,
      hasPostLeg: true,
      status,
      grossPnl: parseFloat(grossVal.toFixed(4)),
      entryFee: parseFloat(entryFee.toFixed(4)),
      exitFee: parseFloat(tradeExitFee.toFixed(4)),
      fee: parseFloat(tradeTotalFee.toFixed(4)),
      commission: parseFloat(tradeTotalFee.toFixed(4)),
      pnl: parseFloat(netVal.toFixed(4)),
      pnlPercent: parseFloat(((netVal / rollingCapital) * 100).toFixed(4)),
      returnR: riskAmount > 0 ? parseFloat((netVal / riskAmount).toFixed(3)) : 0,
      capitalBeforeTrade,
      capitalAfterTrade: nextCap,
      slSlippageApplied: status === 'LOSS' && reason !== 'TIME_STOP' ? slSlipRate * 100 : 0,
      entryNotional: parseFloat((positionSize * entryPrice).toFixed(4)),
      exitNotional: parseFloat((positionSize * actualExitPrice).toFixed(4)),
      reason: reason || (status === 'WIN' ? 'Take Profit' : status === 'LOSS' ? 'Stop Loss' : 'Active'),
    });

    rollingCapital = nextCap;
    lastTradeExitCandleIdx = Math.max(
      lastTradeExitCandleIdx,
      exitCandleIdx !== undefined ? exitCandleIdx : candles.length
    );
  }

  const metrics = calculateMetrics(trades, config.capital);
  return { trades, metrics };
}

/**
 * Universal Strategy Dispatcher: runs Strategy 1, Strategy 2, or Strategy 3 based on user selection.
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
  if (config.selectedStrategyId === 'strategy_3_ab_midpoint') {
    return runStrategy3Backtest(candles, points, legs, config, atrValues, atrMultiplier, minCandles);
  } else if (config.selectedStrategyId === 'strategy_2_next_pivot') {
    return runStrategy2Backtest(candles, points, legs, config, atrValues, atrMultiplier, minCandles);
  } else if (config.selectedStrategyId === 'strategy_1_e_breakout') {
    return runStrategy1Backtest(candles, points, legs, config, atrValues);
  }
  return {
    trades: [],
    metrics: getEmptyMetrics(config.capital),
  };
}

export function calculateMetrics(trades: StrategyTrade[], initialCapital: number): StrategyMetrics {
  let winTrades = 0;
  let lossTrades = 0;
  let breakevenTrades = 0;
  let activeTrades = 0;
  let pendingTrades = 0;
  let expiredTrades = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netProfit = 0;
  let rrSum = 0;
  let completedTradesCount = 0;
  let totalFee = 0;

  // Open position tracking (isolated completely from closed trade metrics)
  let openPositionsCount = 0;
  let openPositionsUnrealizedPnl = 0;
  let openPositionsFee = 0;

  let currentEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  // معاملات بر اساس زمان مرتب می‌شوند تا تقدم و تأخر واقعی شبیه‌سازی گردد
  const sortedTrades = [...trades].sort(
    (a, b) => (a.exitTime || a.entryTime || a.timeF || 0) - (b.exitTime || b.entryTime || b.timeF || 0)
  );

  for (const t of sortedTrades) {
    const isClosed = t.status === 'WIN' || t.status === 'LOSS' || (t.status as string) === 'BREAKEVEN' || (t.exitPrice !== undefined && t.exitPrice > 0 && t.status !== 'ACTIVE' && t.status !== 'PENDING' && t.status !== 'EXPIRED');

    if (isClosed) {
      completedTradesCount++;
      const tradeFee = t.fee !== undefined ? t.fee : (t.commission !== undefined ? t.commission : 0);
      totalFee += tradeFee;

      const pnl = t.pnl || 0;
      const gross = t.grossPnl !== undefined ? t.grossPnl : (pnl + tradeFee);

      if (gross > 0.0001) {
        grossProfit += gross;
      } else if (gross < -0.0001) {
        grossLoss += Math.abs(gross);
      }

      if (pnl > 0.0001) {
        winTrades++;
        totalProfit += pnl;
      } else if (pnl < -0.0001) {
        lossTrades++;
        totalLoss += Math.abs(pnl);
      } else {
        breakevenTrades++;
      }

      netProfit += pnl;
      currentEquity += pnl;

      if (t.riskReward !== undefined && t.riskReward > 0) {
        rrSum += t.riskReward;
      }

      // Peak & Drawdown based purely on closed equity curve
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const ddDollars = peakEquity - currentEquity;
      const ddPercent = peakEquity > 0 ? (ddDollars / peakEquity) * 100 : 0;
      if (ddDollars > maxDrawdown) {
        maxDrawdown = ddDollars;
      }
      if (ddPercent > maxDrawdownPercent) {
        maxDrawdownPercent = ddPercent;
      }
    } else if (t.status === 'ACTIVE' || (t.status as string) === 'OPEN') {
      activeTrades++;
      openPositionsCount++;
      openPositionsUnrealizedPnl += (t.pnl || 0);
      const fee = t.fee !== undefined ? t.fee : (t.commission !== undefined ? t.commission : 0);
      openPositionsFee += fee;
    } else if (t.status === 'PENDING') {
      pendingTrades++;
    } else if (t.status === 'EXPIRED') {
      expiredTrades++;
    }
  }

  const completedTrades = completedTradesCount; // Wins + Losses + Breakeven
  const winRate = completedTrades > 0 ? (winTrades / completedTrades) * 100 : 0;

  // Handle Profit Factor edge cases explicitly without arbitrary sentinels
  let profitFactor = 0;
  let profitFactorLabel = 'N/A — No Trades';

  if (completedTrades === 0) {
    profitFactor = 0;
    profitFactorLabel = 'N/A — No Trades';
  } else if (totalLoss <= 0.0001) {
    if (totalProfit > 0.0001) {
      profitFactor = Infinity;
      profitFactorLabel = 'No Losing Trades';
    } else {
      profitFactor = 0;
      profitFactorLabel = 'Breakeven Only';
    }
  } else {
    profitFactor = parseFloat((totalProfit / totalLoss).toFixed(2));
    profitFactorLabel = profitFactor.toFixed(2);
  }

  const avgRiskReward = completedTrades > 0 ? rrSum / completedTrades : 0;
  const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  // If NO closed trades exist, every closed-trade-derived statistic MUST be strictly ZERO or N/A
  if (completedTrades === 0) {
    return {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      breakevenTrades: 0,
      activeTrades,
      pendingTrades,
      expiredTrades,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      grossPnl: 0,
      totalProfit: 0,
      totalLoss: 0,
      totalFee: 0,
      netProfit: 0,
      netProfitPercent: 0,
      profitFactor: 0,
      profitFactorLabel: 'N/A — No Trades',
      avgRiskReward: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      finalEquity: initialCapital,
      openPositionsCount,
      openPositionsUnrealizedPnl: parseFloat(openPositionsUnrealizedPnl.toFixed(2)),
      openPositionsFee: parseFloat(openPositionsFee.toFixed(2)),
    };
  }

  return {
    totalTrades: completedTrades,
    winTrades,
    lossTrades,
    breakevenTrades,
    activeTrades,
    pendingTrades,
    expiredTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossLoss: parseFloat(grossLoss.toFixed(2)),
    grossPnl: parseFloat((grossProfit - grossLoss).toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    totalLoss: parseFloat(totalLoss.toFixed(2)),
    totalFee: parseFloat(totalFee.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
    profitFactorLabel,
    avgRiskReward: parseFloat(avgRiskReward.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    finalEquity: parseFloat(currentEquity.toFixed(2)),
    openPositionsCount,
    openPositionsUnrealizedPnl: parseFloat(openPositionsUnrealizedPnl.toFixed(2)),
    openPositionsFee: parseFloat(openPositionsFee.toFixed(2)),
  };
}

export function getEmptyMetrics(capital: number): StrategyMetrics {
  return {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    breakevenTrades: 0,
    activeTrades: 0,
    pendingTrades: 0,
    expiredTrades: 0,
    winRate: 0,
    grossProfit: 0,
    grossLoss: 0,
    grossPnl: 0,
    totalProfit: 0,
    totalLoss: 0,
    totalFee: 0,
    netProfit: 0,
    netProfitPercent: 0,
    profitFactor: 0,
    profitFactorLabel: 'N/A — No Trades',
    avgRiskReward: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    finalEquity: capital,
    openPositionsCount: 0,
    openPositionsUnrealizedPnl: 0,
    openPositionsFee: 0,
  };
}


export function runBreakoutStrategy(
  candles: CandleData[],
  points: CryptoZigZagPoint[] | any[],
  legs: Leg[] | any[],
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

    const targetRR = params.maxRiskReward && params.maxRiskReward > 0 ? params.maxRiskReward : 2.0;
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

    const riskBudget =
      params.riskMode === 'fixed' && params.riskAmountFixed && params.riskAmountFixed > 0
        ? params.riskAmountFixed
        : (capital * (params.riskPercent || 1)) / 100;
    const entryFeeRate =
      (params.entryCommissionPercent ??
        (params.commissionPercent !== undefined ? params.commissionPercent / 2 : 0.06)) / 100;
    const exitFeeRate =
      (params.exitCommissionPercent ??
        (params.commissionPercent !== undefined ? params.commissionPercent / 2 : 0.06)) / 100;
    const effectiveExchange = params.exchange ?? 'xt';
    const slSlipRate = (params.slSlippagePercent ?? (effectiveExchange === 'xt' ? 0.04 : 0)) / 100;

    if (status === 'LOSS') {
      exitPrice = isLong ? stopLoss * (1 - slSlipRate) : stopLoss * (1 + slSlipRate);
    }

    const sizing = calculateExactTradeSizing(
      riskBudget,
      entryPrice,
      stopLoss,
      takeProfit,
      entryFeeRate,
      exitFeeRate,
      params.symbol,
      {
        exchange: effectiveExchange,
        contractSize: params.xtContractSize,
        minNotional: params.xtMinNotional,
        riskCushion: effectiveExchange === 'xt' ? 0.92 : 1.0,
        slSlippageRate: slSlipRate,
      }
    );
    const positionSize = sizing.quantizedPositionSize;
    if (positionSize <= 0) continue;

    const riskAmount = riskBudget;
    const pnl = isLong
      ? (exitPrice - entryPrice) * positionSize
      : (entryPrice - exitPrice) * positionSize;
    const commission = entryPrice * positionSize * entryFeeRate + exitPrice * positionSize * exitFeeRate;
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
      grossPnl: pnl,
      fee: commission,
      commission,
      positionSize,
      positionValue: positionSize * entryPrice,
      riskAmount,
      targetRiskAmount: riskAmount,
      realizedRisk: sizing.actualLossAtSL,
      stepSize: sizing.stepSize,
      qtyPrecision: sizing.qtyPrecision,
      pnl: parseFloat(netPnl.toFixed(4)),
      pnlPercent: parseFloat(((netPnl / riskAmount) * 100).toFixed(2)),
      returnR: riskAmount > 0 ? parseFloat((netPnl / riskAmount).toFixed(3)) : 0,
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
  points: CryptoZigZagPoint[] | any[],
  legs: Leg[] | any[],
  params: StrategyParams,
  atrValues: number[],
  atrMult: number,
  minCandles: number
): { trades: Trade[]; metrics: BacktestMetrics } {
  return runBreakoutStrategy(candles, points, legs, params);
}

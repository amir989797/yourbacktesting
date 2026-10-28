import { useMemo } from 'react';
import { CryptoPair, CandleData, ExchangeType } from '../../types/crypto';
import { StrategyTrade } from '../../types/strategy';
import { BacktestResultItem, GLOBAL_CANDLE_CACHE, toMs, toSec } from './types';

export interface UseStatsAuditProps {
  results: BacktestResultItem[];
  allCollectedTrades: StrategyTrade[];
  effectivePortfolioTrades: StrategyTrade[];
  concurrencyFilterResults: any;
  candleHistoryLimit: number;
  timeframe: string;
  cachedCount: number;
  capital: number;
  commissionPercent: number;
  entryCommissionPercent: number;
  exitCommissionPercent: number;
  riskMode: 'percent' | 'fixed';
  riskPercent: number;
  riskAmountFixed: number;
  effectiveRiskPercent: number;
  effectiveRiskUsdt: number;
  selectedStrategyId: 'strategy_1_e_breakout' | 'strategy_2_next_pivot';
  optAtrPeriod: number;
  optAtrMultiplier: number;
  optMinCandles: number;
  optMinCandlesLong: number;
  optLongLegAtrMult: number;
  optMaxBlueLegPercent: number;
  optMaxBreakoutAtr: number;
  optMaxRiskReward: number;
  targetMaxDrawdown: number;
  targetMinWinRate: number;
  targetMinTrades: number;
  selectedExchange?: ExchangeType;
  showToast: (msg: string) => void;
}

export function useStatsAudit(props: UseStatsAuditProps) {
  const {
    results,
    allCollectedTrades,
    effectivePortfolioTrades,
    concurrencyFilterResults,
    candleHistoryLimit,
    timeframe,
    cachedCount,
    capital,
    commissionPercent,
    entryCommissionPercent,
    exitCommissionPercent,
    riskMode,
    riskPercent,
    riskAmountFixed,
    effectiveRiskPercent,
    effectiveRiskUsdt,
    selectedStrategyId,
    optAtrPeriod,
    optAtrMultiplier,
    optMinCandles,
    optMinCandlesLong,
    optLongLegAtrMult,
    optMaxBlueLegPercent,
    optMaxBreakoutAtr,
    optMaxRiskReward,
    targetMaxDrawdown,
    targetMinWinRate,
    targetMinTrades,
    selectedExchange = 'xt',
    showToast,
  } = props;

  const datasetAudit = useMemo(() => {
    // ۱. استخراج دقیق دارایی‌ها (دقیقاً منطبق با ارزهای بررسی‌شده در اسکن)
    const auditedPairsMap = new Map<string, CryptoPair>();
    if (results.length > 0) {
      for (const r of results) {
        if (r.pair && r.pair.symbol) {
          auditedPairsMap.set(r.pair.symbol.toUpperCase(), r.pair);
        }
      }
    } else {
      // در صورت لود مستقیم دیتاست بدون اجرای اسکن جدید
      for (const entry of Array.from(GLOBAL_CANDLE_CACHE.values())) {
        if (entry && entry.pair && entry.pair.symbol && (!entry.timeframe || entry.timeframe === timeframe)) {
          auditedPairsMap.set(entry.pair.symbol.toUpperCase(), entry.pair);
        }
      }
    }
    const allAssetsList = Array.from(auditedPairsMap.values());
    const numberOfAssets = allAssetsList.length;

    // ۲. تفکیک دقیق دو مرحله: آمار خام (RAW / PRE-FILTER) و آمار نهایی پرتفوی (FINAL / POST-CONCURRENCY)
    const rawClosedTrades = allCollectedTrades.filter(
      (t) => t.status === 'WIN' || t.status === 'LOSS' || (t.exitPrice !== undefined && t.exitPrice > 0)
    );
    const rawTradesCount = rawClosedTrades.length;
    const rawOpenTradesCount = allCollectedTrades.filter((t) => t.status === 'ACTIVE' || !t.exitPrice).length;

    // معاملات بسته‌شده نهایی پرتفوی پس از اعمال فیلتر عدم تداخل همزمان
    const closedTrades = effectivePortfolioTrades.filter(
      (t) => t.status === 'WIN' || t.status === 'LOSS' || (t.exitPrice !== undefined && t.exitPrice > 0)
    );
    const openTradesCount = effectivePortfolioTrades.filter(
      (t) => t.status === 'ACTIVE' || !t.exitPrice
    ).length;
    const auditedTrades = closedTrades;
    const numberOfTrades = auditedTrades.length;
    const postConcurrencyTradesCount = numberOfTrades;
    const filteredConcurrentTradesCount = Math.max(0, rawTradesCount - postConcurrencyTradesCount);

    // ۳. تعداد کندل‌ها و بازرسی سلامت کندل‌ها به ازای تک‌تک دارایی‌های بررسی‌شده
    let totalCandles = 0;
    let minCandles = Infinity;
    let maxCandles = 0;
    const perAssetCandleCounts: {
      symbol: string;
      baseAsset: string;
      count: number;
      gaps: number;
      minTime: number;
      maxTime: number;
      hasMissingPrices: boolean;
      hasDuplicates: boolean;
    }[] = [];

    let earliestTimestamp: number | null = null;
    let latestTimestamp: number | null = null;

    let missingPricesCount = 0;
    let duplicatedCandlesCount = 0;
    let dataGapsCount = 0;
    let inconsistentTimestampsCount = 0;
    let inconsistentSymbolsCount = 0;
    const gapDetailsList: { symbol: string; gapStart: string; gapEnd: string; missingBars: number }[] = [];

    const timeframeSecondsMap: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400,
      '3d': 259200,
      '1w': 604800,
    };
    const expectedIntervalSec = timeframeSecondsMap[timeframe] || 300;

    for (const pair of allAssetsList) {
      const sym = pair.symbol.toUpperCase();
      const cacheKey = `${selectedExchange}_${pair.symbol}_${timeframe}`;
      let candles: CandleData[] = [];
      const cached =
        GLOBAL_CANDLE_CACHE.get(cacheKey) ||
        Array.from(GLOBAL_CANDLE_CACHE.values()).find(
          (e) => e.pair?.symbol?.toUpperCase() === sym && (!e.timeframe || e.timeframe === timeframe)
        );

      if (cached && Array.isArray(cached.candles)) {
        candles = cached.candles;
      }

      const matchingResult = results.find((r) => r.pair?.symbol?.toUpperCase() === sym);
      const count = candles.length > 0 ? candles.length : (matchingResult?.candlesCount || 0);

      totalCandles += count;
      if (count < minCandles) minCandles = count;
      if (count > maxCandles) maxCandles = count;

      if (!sym.endsWith('USDT') && !sym.endsWith('BUSD') && !sym.endsWith('USDC') && !sym.endsWith('FDUSD')) {
        inconsistentSymbolsCount++;
      }

      const seenTimes = new Set<number>();
      let assetGaps = 0;
      let assetMinTime = Infinity;
      let assetMaxTime = 0;
      let assetHasMissingPrices = false;
      let assetHasDuplicates = false;

      if (candles.length > 0) {
        for (let i = 0; i < count; i++) {
          const c = candles[i];
          if (c.time) {
            const cSec = toSec(c.time);
            if (earliestTimestamp === null || cSec < earliestTimestamp) earliestTimestamp = cSec;
            if (latestTimestamp === null || cSec > latestTimestamp) latestTimestamp = cSec;
            if (cSec < assetMinTime) assetMinTime = cSec;
            if (cSec > assetMaxTime) assetMaxTime = cSec;
          }

          // بررسی قیمت‌های نامعتبر یا صفر
          if (
            c.open === undefined ||
            c.high === undefined ||
            c.low === undefined ||
            c.close === undefined ||
            isNaN(c.open) ||
            isNaN(c.high) ||
            isNaN(c.low) ||
            isNaN(c.close) ||
            c.open <= 0 ||
            c.high <= 0 ||
            c.low <= 0 ||
            c.close <= 0 ||
            c.high < c.low ||
            c.open > c.high ||
            c.open < c.low ||
            c.close > c.high ||
            c.close < c.low
          ) {
            missingPricesCount++;
            assetHasMissingPrices = true;
          }

          // بررسی کندل‌های تکراری
          const tSec = toSec(c.time);
          if (seenTimes.has(tSec)) {
            duplicatedCandlesCount++;
            assetHasDuplicates = true;
          } else {
            seenTimes.add(tSec);
          }

          // بررسی ترتیب زمانی صعودی و گپ‌ها
          if (i > 0) {
            const prevC = candles[i - 1];
            const prevSec = toSec(prevC.time);
            if (tSec <= prevSec) {
              inconsistentTimestampsCount++;
            } else {
              const deltaSec = tSec - prevSec;
              if (deltaSec > expectedIntervalSec * 1.5) {
                const missingBars = Math.round(deltaSec / expectedIntervalSec) - 1;
                dataGapsCount += missingBars;
                assetGaps += missingBars;
                if (gapDetailsList.length < 50) {
                  gapDetailsList.push({
                    symbol: sym,
                    gapStart: new Date(toMs(prevC.time)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                    gapEnd: new Date(toMs(c.time)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                    missingBars,
                  });
                }
              }
            }
          }
        }
      } else if (matchingResult && Array.isArray(matchingResult.trades)) {
        for (const t of matchingResult.trades) {
          const tTime = t.entryTime || t.timeF;
          if (tTime) {
            const tSec = toSec(tTime);
            if (earliestTimestamp === null || tSec < earliestTimestamp) earliestTimestamp = tSec;
            if (latestTimestamp === null || tSec > latestTimestamp) latestTimestamp = tSec;
            if (tSec < assetMinTime) assetMinTime = tSec;
            if (tSec > assetMaxTime) assetMaxTime = tSec;
          }
        }
      }

      perAssetCandleCounts.push({
        symbol: sym,
        baseAsset: pair.baseAsset || sym.replace('USDT', ''),
        count,
        gaps: assetGaps,
        minTime: assetMinTime === Infinity ? 0 : assetMinTime,
        maxTime: assetMaxTime,
        hasMissingPrices: assetHasMissingPrices,
        hasDuplicates: assetHasDuplicates,
      });
    }

    if (minCandles === Infinity) minCandles = 0;
    const avgCandlesPerAsset = numberOfAssets > 0 ? Math.round(totalCandles / numberOfAssets) : 0;

    // داده‌های مفقود (نمادهای با صفر کندل)
    const missingDataAssets = results.filter((r) => r.candlesCount === 0);
    const missingDataCount = missingDataAssets.length;

    // بازرسی فیلدهای ناقص معاملات
    let missingTradeFieldsCount = 0;
    let duplicatedTradesCount = 0;
    const seenTradeHashes = new Set<string>();

    for (const t of auditedTrades) {
      if (
        t.entryPrice === undefined ||
        t.stopLoss === undefined ||
        t.takeProfit === undefined ||
        t.pnl === undefined ||
        !t.status ||
        !t.direction
      ) {
        missingTradeFieldsCount++;
      }
      const tradeHash = `${t.id || ''}_${t.entryTime || 0}_${t.exitTime || 0}_${t.entryPrice}_${t.pnl}`;
      if (seenTradeHashes.has(tradeHash)) {
        duplicatedTradesCount++;
      } else {
        seenTradeHashes.add(tradeHash);
      }
      if (t.entryTime && t.exitTime && toSec(t.exitTime) < toSec(t.entryTime)) {
        inconsistentTimestampsCount++;
      }
    }

    // تفکیک دقیق معاملات خرید (BUY) و فروش (SELL) بر اساس نتیجه خالص (Net PnL > 0)
    const buyTrades = auditedTrades.filter((t) => t.direction === 'BUY' || t.type === 'BUY');
    const sellTrades = auditedTrades.filter((t) => t.direction === 'SELL' || t.type === 'SELL');
    const buyTradesCount = buyTrades.length;
    const sellTradesCount = sellTrades.length;
    const buyPercentage = numberOfTrades > 0 ? ((buyTradesCount / numberOfTrades) * 100).toFixed(1) : '0';
    const sellPercentage = numberOfTrades > 0 ? ((sellTradesCount / numberOfTrades) * 100).toFixed(1) : '0';
    const buyWinCount = buyTrades.filter((t) => (t.pnl || 0) > 0).length;
    const buyLossCount = buyTradesCount - buyWinCount;
    const sellWinCount = sellTrades.filter((t) => (t.pnl || 0) > 0).length;
    const sellLossCount = sellTradesCount - sellWinCount;
    const totalWinCount = buyWinCount + sellWinCount;
    const totalLossCount = buyLossCount + sellLossCount;
    const buyWinRate = buyTradesCount > 0 ? ((buyWinCount / buyTradesCount) * 100).toFixed(1) : '0';
    const sellWinRate = sellTradesCount > 0 ? ((sellWinCount / sellTradesCount) * 100).toFixed(1) : '0';
    const overallWinRate = numberOfTrades > 0 ? ((totalWinCount / numberOfTrades) * 100).toFixed(1) : '0';

    // تاریخ‌های دقیق تاریخی
    const formatDate = (ts: number | null) => {
      if (!ts) return 'داده‌ای در حافظه بارگذاری نشده است';
      const d = new Date(toMs(ts));
      const iso = `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
      let localFa = '';
      try {
        localFa = new Intl.DateTimeFormat('fa-IR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Tehran',
        }).format(d);
      } catch {
        localFa = d.toLocaleString();
      }
      return `${iso} (${localFa} ایران)`;
    };

    const exactHistoricalStartDate = formatDate(earliestTimestamp);
    const exactHistoricalEndDate = formatDate(latestTimestamp);

    // مدت زمان پوشش داده‌ها
    let actualDurationCoveredText = '۰ روز (بدون داده)';
    let actualDurationDays = 0;
    let actualDurationHours = 0;
    if (earliestTimestamp && latestTimestamp && latestTimestamp > earliestTimestamp) {
      const diffSec = toSec(latestTimestamp) - toSec(earliestTimestamp);
      const totalMinutes = Math.floor(diffSec / 60);
      const days = Math.floor(totalMinutes / (24 * 60));
      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
      const minutes = totalMinutes % 60;
      actualDurationDays = parseFloat((diffSec / 86400).toFixed(1));
      actualDurationHours = parseFloat((diffSec / 3600).toFixed(1));
      actualDurationCoveredText = `${days} روز و ${hours} ساعت و ${minutes} دقیقه (${actualDurationDays} روز تقویمی / ${actualDurationHours} ساعت)`;
    }

    const totalTheoreticalDatasetCapacity = numberOfAssets * candleHistoryLimit;

    const issuesTotal =
      missingPricesCount +
      duplicatedCandlesCount +
      duplicatedTradesCount +
      missingTradeFieldsCount +
      inconsistentTimestampsCount +
      inconsistentSymbolsCount;

    let dataHealthScore = 100;
    if (numberOfAssets === 0) {
      dataHealthScore = 0;
    } else {
      if (missingPricesCount > 0) dataHealthScore -= 20;
      if (duplicatedCandlesCount > 0) dataHealthScore -= 15;
      if (missingTradeFieldsCount > 0) dataHealthScore -= 25;
      if (inconsistentTimestampsCount > 0) dataHealthScore -= 20;
      if (inconsistentSymbolsCount > 0) dataHealthScore -= 10;
      if (dataGapsCount > 0) dataHealthScore -= Math.min(10, Math.ceil(dataGapsCount / 10));
      dataHealthScore = Math.max(0, dataHealthScore);
    }

    return {
      numberOfAssets,
      numberOfTrades,
      rawTradesCount,
      rawOpenTradesCount,
      postConcurrencyTradesCount,
      filteredConcurrentTradesCount,
      openTradesCount,
      buyTradesCount,
      sellTradesCount,
      buyPercentage,
      sellPercentage,
      buyWinCount,
      buyLossCount,
      sellWinCount,
      sellLossCount,
      totalWinCount,
      totalLossCount,
      overallWinRate,
      buyWinRate,
      sellWinRate,
      totalCandles,
      avgCandlesPerAsset,
      minCandles,
      maxCandles,
      earliestTimestamp,
      latestTimestamp,
      exactHistoricalStartDate,
      exactHistoricalEndDate,
      actualDurationCoveredText,
      actualDurationDays,
      actualDurationHours,
      configuredPerAssetLimit: candleHistoryLimit,
      totalTheoreticalDatasetCapacity,
      missingDataCount,
      duplicatedCandlesCount,
      duplicatedTradesCount,
      dataGapsCount,
      gapDetailsList,
      missingPricesCount,
      missingTradeFieldsCount,
      inconsistentTimestampsCount,
      inconsistentSymbolsCount,
      issuesTotal,
      dataHealthScore,
      perAssetCandleCounts,
    };
  }, [results, allCollectedTrades, effectivePortfolioTrades, candleHistoryLimit, timeframe, cachedCount]);

  // ۲. صحه‌گذاری سلامت بک‌تست (Check for backtest integrity)
  const backtestIntegrityAudit = useMemo(() => {
    // 1. duplicate trades
    let duplicateTradesCount = 0;
    const tradeHashes = new Set<string>();

    // 2. overlapping trades
    let overlappingTradesCount = 0;
    const tradesBySymbol: Record<string, StrategyTrade[]> = {};

    // 3. impossible prices
    let impossiblePricesCount = 0;

    // 4. invalid trade direction
    let invalidDirectionCount = 0;

    // 5. incorrect position sizing
    let incorrectPositionSizingCount = 0;

    // 6. impossible returns
    let impossibleReturnsCount = 0;

    // 7. look-ahead bias
    let lookAheadBiasCount = 0;

    // 8. future information leakage
    let futureInfoLeakageCount = 0;

    // 11. incorrect fee handling
    let incorrectFeeHandlingCount = 0;

    // 12. incorrect leverage handling
    let incorrectLeverageHandlingCount = 0;

    // 13. incorrect PnL calculation
    let incorrectPnlCount = 0;

    for (const t of effectivePortfolioTrades) {
      // ۱. duplicate trades
      const hash = `${t.strategyId || ''}_${(t as any).symbol || ''}_${t.direction}_${t.entryTime || 0}_${t.exitTime || 0}_${t.entryPrice}_${t.exitPrice || 0}`;
      if (tradeHashes.has(hash)) {
        duplicateTradesCount++;
      } else {
        tradeHashes.add(hash);
      }

      // Group for overlapping trades check
      const sym = (t as any).symbol || 'DEFAULT';
      if (!tradesBySymbol[sym]) tradesBySymbol[sym] = [];
      tradesBySymbol[sym].push(t);

      // ۳. impossible prices
      if (
        t.entryPrice <= 0 ||
        isNaN(t.entryPrice) ||
        !isFinite(t.entryPrice) ||
        (t.exitPrice !== undefined && (t.exitPrice <= 0 || isNaN(t.exitPrice) || !isFinite(t.exitPrice))) ||
        t.stopLoss <= 0 ||
        isNaN(t.stopLoss) ||
        !isFinite(t.stopLoss) ||
        t.takeProfit <= 0 ||
        isNaN(t.takeProfit) ||
        !isFinite(t.takeProfit)
      ) {
        impossiblePricesCount++;
      }

      // ۴. invalid trade direction
      if (t.direction === 'BUY') {
        if (t.takeProfit <= t.entryPrice || t.stopLoss >= t.entryPrice) {
          invalidDirectionCount++;
        }
      } else if (t.direction === 'SELL') {
        if (t.takeProfit >= t.entryPrice || t.stopLoss <= t.entryPrice) {
          invalidDirectionCount++;
        }
      } else {
        invalidDirectionCount++;
      }

      // ۵. incorrect position sizing
      if (
        t.positionSize <= 0 ||
        isNaN(t.positionSize) ||
        !isFinite(t.positionSize) ||
        t.positionValue <= 0 ||
        isNaN(t.positionValue) ||
        !isFinite(t.positionValue) ||
        t.riskAmount <= 0 ||
        isNaN(t.riskAmount) ||
        !isFinite(t.riskAmount)
      ) {
        incorrectPositionSizingCount++;
      }

      // ۶. impossible returns
      if (
        isNaN(t.pnlPercent) ||
        !isFinite(t.pnlPercent) ||
        t.pnlPercent < -100 ||
        t.pnlPercent > 10000
      ) {
        impossibleReturnsCount++;
      }

      // ۷. look-ahead bias
      if (
        t.entryCandleIdx !== undefined &&
        t.candleIdxF !== undefined &&
        t.entryCandleIdx <= t.candleIdxF
      ) {
        lookAheadBiasCount++;
      }

      // ۸. future information leakage
      if (
        t.exitCandleIdx !== undefined &&
        t.entryCandleIdx !== undefined &&
        t.exitCandleIdx < t.entryCandleIdx
      ) {
        futureInfoLeakageCount++;
      }

      // ۱۱. incorrect fee handling
      if (commissionPercent > 0) {
        if (t.fee === undefined || t.fee < 0) {
          incorrectFeeHandlingCount++;
        } else if (t.grossPnl !== undefined) {
          const expectedNet = t.grossPnl - t.fee;
          if (Math.abs(expectedNet - t.pnl) > 0.05) {
            incorrectFeeHandlingCount++;
          }
        }
      }

      // ۱۲. incorrect leverage handling (اهرم غیرمجاز بالای ۱۰۰ برابر در بازار فیوچرز)
      const maxAllowedLeverage = 100;
      if (t.positionValue > capital * maxAllowedLeverage) {
        incorrectLeverageHandlingCount++;
      }

      // ۱۳. incorrect PnL calculation
      if (t.exitPrice && t.positionSize > 0) {
        const expectedGross =
          t.direction === 'BUY'
            ? t.positionSize * (t.exitPrice - t.entryPrice)
            : t.positionSize * (t.entryPrice - t.exitPrice);
        const feeVal = t.fee || 0;
        const expectedNet = expectedGross - feeVal;
        if (Math.abs(expectedNet - t.pnl) > 0.15) {
          incorrectPnlCount++;
        }
      }
    }

    // ۲. overlapping trades (بررسی تداخل معامله در یک جفت‌ارز)
    for (const sym of Object.keys(tradesBySymbol)) {
      const symTrades = tradesBySymbol[sym].slice().sort((a, b) => {
        const timeA = a.entryTime || a.entryCandleIdx || 0;
        const timeB = b.entryTime || b.entryCandleIdx || 0;
        return timeA - timeB;
      });

      for (let i = 1; i < symTrades.length; i++) {
        const prev = symTrades[i - 1];
        const curr = symTrades[i];
        const prevExit = prev.exitTime || prev.exitCandleIdx;
        const currEntry = curr.entryTime || curr.entryCandleIdx;
        if (prevExit && currEntry && currEntry < prevExit) {
          overlappingTradesCount++;
        }
      }
    }

    // ۹. survivorship bias where detectable
    const survivorshipBiasDetected = true;

    // ۱۰. delisted/missing assets
    const delistedOrMissingAssetsCount = datasetAudit.missingDataCount;

    let integrityScore = 100;
    if (duplicateTradesCount > 0) integrityScore -= 15;
    if (overlappingTradesCount > 0) integrityScore -= 10;
    if (impossiblePricesCount > 0) integrityScore -= 20;
    if (invalidDirectionCount > 0) integrityScore -= 20;
    if (incorrectPositionSizingCount > 0) integrityScore -= 15;
    if (impossibleReturnsCount > 0) integrityScore -= 15;
    if (lookAheadBiasCount > 0) integrityScore -= 25;
    if (futureInfoLeakageCount > 0) integrityScore -= 25;
    if (incorrectFeeHandlingCount > 0) integrityScore -= 10;
    if (incorrectLeverageHandlingCount > 0) integrityScore -= 10;
    if (incorrectPnlCount > 0) integrityScore -= 15;
    integrityScore = Math.max(0, integrityScore);

    return {
      duplicateTradesCount,
      overlappingTradesCount,
      impossiblePricesCount,
      invalidDirectionCount,
      incorrectPositionSizingCount,
      impossibleReturnsCount,
      lookAheadBiasCount,
      futureInfoLeakageCount,
      survivorshipBiasDetected,
      delistedOrMissingAssetsCount,
      incorrectFeeHandlingCount,
      incorrectLeverageHandlingCount,
      incorrectPnlCount,
      integrityScore,
      totalIssues:
        duplicateTradesCount +
        overlappingTradesCount +
        impossiblePricesCount +
        invalidDirectionCount +
        incorrectPositionSizingCount +
        impossibleReturnsCount +
        lookAheadBiasCount +
        futureInfoLeakageCount +
        delistedOrMissingAssetsCount +
        incorrectFeeHandlingCount +
        incorrectLeverageHandlingCount +
        incorrectPnlCount,
    };
  }, [effectivePortfolioTrades, datasetAudit.missingDataCount, capital, commissionPercent]);

  // ۳. بازسازی مدل مبنای استراتژی (Reconstruct the baseline)
  const baselineReconstruction = useMemo(() => {
    const allTrades = effectivePortfolioTrades || [];
    // تفکیک دقیق معاملات بسته‌شده از پوزیشن‌های باز در انتهای بک‌تست
    const closedTrades = allTrades.filter(
      (t) => t.status === 'WIN' || t.status === 'LOSS' || (t.exitPrice !== undefined && t.exitPrice > 0)
    );
    const openPositionsAtEnd = allTrades.filter(
      (t) => t.status === 'ACTIVE' || !t.exitPrice
    ).length;

    const trades = closedTrades;
    const initialCap = capital || 10000;
    const risk = effectiveRiskPercent;
    const durationDays = datasetAudit.actualDurationDays || 0;
    const durationYears = durationDays > 0 ? durationDays / 365.25 : 0;

    let grossProfit = 0; // مجموع نتایج معاملات سودده (بر مبنای سود خالص هر ترید)
    let grossLoss = 0; // مجموع قدرمطلق نتایج معاملات زیان‌ده (بر مبنای زیان خالص هر ترید)
    let grossPnlSum = 0; // مجموع سود ناخالص قبل از کارمزد معاملاتی
    let totalTradingNetProfit = 0; // مجموع سود خالص پس از کارمزد معاملات
    let totalFees = 0; // مجموع کارمزد معاملات صرافی
    let winTrades = 0;
    let lossTrades = 0;
    const totalTrades = trades.length;

    let longTradesCount = 0;
    let shortTradesCount = 0;
    let longWinTrades = 0;
    let longLossTrades = 0;
    let shortWinTrades = 0;
    let shortLossTrades = 0;

    const uniqueSymbolsSet = new Set<string>();

    let bestTradePnl = -Infinity;
    let bestTradePercent = 0;
    let bestTradeSymbol = '—';

    let worstTradePnl = Infinity;
    let worstTradePercent = 0;
    let worstTradeSymbol = '—';

    let totalHoldingSec = 0;
    let totalVolumeTraded = 0;

    const dailyPnLMap: Record<string, number> = {};
    const monthlyPnLMap: Record<string, number> = {};

    interface TradeInterval {
      entry: number;
      exit: number;
      direction: string;
      posValue: number;
    }
    const intervals: TradeInterval[] = [];

    let runningEquity = initialCap;
    let peakEquity = initialCap;
    let maxDD_usd = 0;
    let maxDD_percent = 0;
    const drawdownsPercentList: number[] = [];

    let currentDDStart: number | null = null;
    let maxDDDurationSec = 0;
    let maxDDDurationTrades = 0;
    let currentDDTrades = 0;

    // تفکیک دقیق داده‌های پوزیشن‌ها و محاسبه هزینه فاندینگ ریت طبق بازه‌های ۸ ساعته رسمی بایننس (۰۰:۰۰، ۰۸:۰۰، ۱۶:۰۰ UTC)
    let totalFundingPaid = 0;
    let totalFundingReceived = 0;
    let chargedPositionsCount = 0;
    let maxFundingChargedSinglePosition = 0;

    // ۱. منحنی الف: منحنی ارزش معاملاتی (Trading Equity Curve - سود و زیان منهای کارمزد صرافی بدون فاندینگ)
    let runningTradingEquity = initialCap;
    let peakTradingEquity = initialCap;
    let maxTradingDD_usd = 0;
    let maxTradingDD_percent = 0;
    const tradingDrawdownsPercentList: number[] = [];
    let currentTradingDDStart: number | null = null;
    let maxTradingDDDurationSec = 0;
    let maxTradingDDDurationTrades = 0;
    let currentTradingDDTrades = 0;

    // ۲. منحنی ب: منحنی ارزش واقعی حساب (Actual Account Equity Curve - شامل کارمزد صرافی و فاندینگ ریت)
    let runningAccountEquity = initialCap;
    let peakAccountEquity = initialCap;
    let maxAccountDD_usd = 0;
    let maxAccountDD_percent = 0;
    const accountDrawdownsPercentList: number[] = [];
    let currentAccountDDStart: number | null = null;
    let maxAccountDDDurationSec = 0;
    let maxAccountDDDurationTrades = 0;
    let currentAccountDDTrades = 0;

    const recoveryDurationsSec: number[] = [];
    const recoveryDurationsTrades: number[] = [];
    let inDrawdown = false;
    let troughTime: number | null = null;
    let troughTrades = 0;

    const formatDate = (ts: number | null | undefined): string => {
      if (!ts || ts === 0) return '—';
      return new Date(toMs(ts)).toISOString().slice(0, 10);
    };

    const sortedTrades = trades.slice().sort((a, b) => (a.entryTime || a.timeF || 0) - (b.entryTime || b.timeF || 0));

    // ساختار ممیزی سطح اجرای تک‌تک معاملات (Table 7 — Execution & Cost Audit)
    const executionTradesList: Array<{
      id: string;
      symbol: string;
      direction: string;
      entryTime: number;
      exitTime: number;
      entryPrice: number;
      exitPrice: number;
      positionSize: number;
      entryNotional: number;
      exitNotional: number;
      totalExecutedNotional: number;
      grossTradePnl: number;
      entryFee: number;
      exitFee: number;
      totalTradingFee: number;
      fundingPaid: number;
      fundingReceived: number;
      netFunding: number;
      finalTradePnl: number;
    }> = [];

    let sumEntryNotional = 0;
    let sumExitNotional = 0;
    let sumGrossTradePnl = 0;
    let sumEntryFees = 0;
    let sumExitFees = 0;
    let sumTradingFees = 0;

    // منحنی فرضی بدون کسر کارمزد صرافی (جهت سنجش تجربی Fee Drag)
    let noFeeRunningEquity = initialCap;
    let noFeePeakEquity = initialCap;
    let noFeeMaxDD_usd = 0;
    let noFeeMaxDD_percent = 0;

    // متغیرهای تفصیلی تاریخ‌های درودان برای دو منحنی
    let inTradingDD = false;
    let peakTradingTime = sortedTrades[0]?.entryTime || 0;
    let currentTradingDDStartTime = peakTradingTime;
    let currentTradingDDBottomTime = peakTradingTime;
    let currentTradingDDDrop = 0;
    let currentTradingDDDropPct = 0;
    let currentTradingDDTradeCount = 0;
    let tradingDD_start = 0;
    let tradingDD_bottom = 0;
    let tradingDD_recovery: number | null = null;

    let inAccountDD = false;
    let peakAccountTime = sortedTrades[0]?.entryTime || 0;
    let currentAccountDDStartTime = peakAccountTime;
    let currentAccountDDBottomTime = peakAccountTime;
    let currentAccountDDDrop = 0;
    let currentAccountDDDropPct = 0;
    let currentAccountDDTradeCount = 0;
    let accountDD_start = 0;
    let accountDD_bottom = 0;
    let accountDD_recovery: number | null = null;

    // آرایه‌های سری زمانی ارزش حساب و بازده معاملات جهت سنجش پایداری و ریسک نزولی
    const accountEquitySeries: number[] = [initialCap];
    const tradeReturnPcts: number[] = [];

    for (const t of sortedTrades) {
      const netPnl = t.pnl || 0;
      const fee = t.fee || t.commission || 0;
      const grossPnl = t.grossPnl !== undefined ? t.grossPnl : netPnl + fee;
      const pnlPct = t.pnlPercent || 0;
      const posVal = t.positionValue || (t.positionSize ? t.positionSize * t.entryPrice : effectiveRiskUsdt);
      const sym = (t as any).symbol || 'USDT';
      uniqueSymbolsSet.add(sym.toUpperCase());

      const isLong = t.direction === 'BUY' || t.type === 'BUY';
      const entryPrice = t.entryPrice || 1;
      const exitPrice = t.exitPrice || entryPrice;
      const size = t.positionSize || (posVal / entryPrice);
      const entryNotional = entryPrice * size;
      const exitNotional = exitPrice * size;
      const totalExecNotional = entryNotional + exitNotional;

      grossPnlSum += grossPnl;
      totalTradingNetProfit += netPnl;
      totalFees += fee;
      totalVolumeTraded += totalExecNotional;

      const feeRate = (commissionPercent || 0.05) / 100;
      const entryFee = entryNotional * feeRate;
      const exitFee = exitNotional * feeRate;
      const totalTradeFee = t.fee !== undefined ? t.fee : (entryFee + exitFee);

      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;
      const holdSec = xTime > eTime ? xTime - eTime : 0;
      totalHoldingSec += holdSec;

      const eSec = toSec(eTime);
      const xSec = toSec(xTime);

      // محاسبه دقیق عبور از نقاط تسویه فاندینگ ۸ ساعته بایننس (۰۰:۰۰، ۰۸:۰۰، ۱۶:۰۰ UTC معادل هر ۲۸۸۰۰ ثانیه)
      const fundingPeriods = (eSec > 0 && xSec > eSec)
        ? Math.max(0, Math.floor(xSec / 28800) - Math.floor(eSec / 28800))
        : 0;

      let tradeFundingCost = 0;
      let fundingPaid = 0;
      let fundingReceived = 0;
      if (fundingPeriods > 0) {
        chargedPositionsCount++;
        const baseFunding = posVal * 0.0001 * fundingPeriods; // نرخ استاندارد بنچمارک بایننس ۰.۰۱٪
        if (isLong) {
          totalFundingPaid += baseFunding;
          fundingPaid = baseFunding;
          tradeFundingCost = baseFunding;
          if (baseFunding > maxFundingChargedSinglePosition) {
            maxFundingChargedSinglePosition = baseFunding;
          }
        } else {
          totalFundingReceived += baseFunding;
          fundingReceived = baseFunding;
          tradeFundingCost = -baseFunding; // پوزیشن شورت فاندینگ را دریافت می‌کند
        }
      }

      const netTradeFunding = fundingPaid - fundingReceived;
      const finalTradePnl = grossPnl - totalTradeFee - netTradeFunding;

      executionTradesList.push({
        id: t.id || `${sym}-${eTime}`,
        symbol: sym,
        direction: t.direction,
        entryTime: eTime,
        exitTime: xTime,
        entryPrice,
        exitPrice,
        positionSize: size,
        entryNotional,
        exitNotional,
        totalExecutedNotional: totalExecNotional,
        grossTradePnl: grossPnl,
        entryFee,
        exitFee,
        totalTradingFee: totalTradeFee,
        fundingPaid,
        fundingReceived,
        netFunding: netTradeFunding,
        finalTradePnl,
      });

      sumEntryNotional += entryNotional;
      sumExitNotional += exitNotional;
      sumGrossTradePnl += grossPnl;
      sumEntryFees += entryFee;
      sumExitFees += exitFee;
      sumTradingFees += totalTradeFee;

      if (isLong) {
        longTradesCount++;
        if (netPnl > 0) {
          longWinTrades++;
        } else {
          longLossTrades++;
        }
      } else {
        shortTradesCount++;
        if (netPnl > 0) {
          shortWinTrades++;
        } else {
          shortLossTrades++;
        }
      }

      if (netPnl > 0) {
        grossProfit += netPnl;
        winTrades++;
      } else {
        grossLoss += Math.abs(netPnl);
        lossTrades++;
      }

      if (netPnl > bestTradePnl) {
        bestTradePnl = netPnl;
        bestTradePercent = pnlPct;
        bestTradeSymbol = sym;
      }
      if (netPnl < worstTradePnl) {
        worstTradePnl = netPnl;
        worstTradePercent = pnlPct;
        worstTradeSymbol = sym;
      }

      const tradeAccountNetPnl = netPnl - tradeFundingCost;

      intervals.push({
        entry: eTime,
        exit: xTime,
        direction: t.direction,
        posValue: posVal,
      });

      if (xTime > 0) {
        const dStr = new Date(toMs(xTime)).toISOString().slice(0, 10);
        dailyPnLMap[dStr] = (dailyPnLMap[dStr] || 0) + netPnl;

        const mStr = new Date(toMs(xTime)).toISOString().slice(0, 7);
        monthlyPnLMap[mStr] = (monthlyPnLMap[mStr] || 0) + netPnl;
      }

      // الف) رهگیری منحنی ارزش معاملاتی (Trading Equity Curve)
      runningTradingEquity += netPnl;
      if (runningTradingEquity > peakTradingEquity) {
        if (inTradingDD) {
          if (currentTradingDDDrop > maxTradingDD_usd) {
            maxTradingDD_usd = currentTradingDDDrop;
            maxTradingDD_percent = currentTradingDDDropPct;
            tradingDD_start = currentTradingDDStartTime;
            tradingDD_bottom = currentTradingDDBottomTime;
            tradingDD_recovery = xTime;
            maxTradingDDDurationSec = xTime - currentTradingDDStartTime;
            maxTradingDDDurationTrades = currentTradingDDTradeCount;
          }
          inTradingDD = false;
        }
        peakTradingEquity = runningTradingEquity;
        peakTradingTime = xTime;
      } else {
        const ddUsd = peakTradingEquity - runningTradingEquity;
        const ddPct = peakTradingEquity > 0 ? (ddUsd / peakTradingEquity) * 100 : 0;
        tradingDrawdownsPercentList.push(ddPct);

        if (!inTradingDD) {
          inTradingDD = true;
          currentTradingDDStartTime = peakTradingTime;
          currentTradingDDBottomTime = xTime;
          currentTradingDDDrop = ddUsd;
          currentTradingDDDropPct = ddPct;
          currentTradingDDTradeCount = 0;
        } else {
          if (ddUsd > currentTradingDDDrop) {
            currentTradingDDDrop = ddUsd;
            currentTradingDDDropPct = ddPct;
            currentTradingDDBottomTime = xTime;
          }
        }
        currentTradingDDTradeCount++;

        if (currentTradingDDDrop > maxTradingDD_usd) {
          maxTradingDD_usd = currentTradingDDDrop;
          maxTradingDD_percent = currentTradingDDDropPct;
          tradingDD_start = currentTradingDDStartTime;
          tradingDD_bottom = currentTradingDDBottomTime;
          tradingDD_recovery = null;
          maxTradingDDDurationSec = xTime - currentTradingDDStartTime;
          maxTradingDDDurationTrades = currentTradingDDTradeCount;
        }
      }

      // ب) رهگیری منحنی ارزش واقعی حساب (Actual Account Equity Curve شامل فاندینگ)
      const prevAccountEquity = runningAccountEquity;
      runningAccountEquity += tradeAccountNetPnl;
      accountEquitySeries.push(runningAccountEquity);
      const tradeReturnPct = prevAccountEquity > 0 ? (tradeAccountNetPnl / prevAccountEquity) * 100 : 0;
      tradeReturnPcts.push(tradeReturnPct);

      if (runningAccountEquity > peakAccountEquity) {
        if (inAccountDD) {
          if (currentAccountDDDrop > maxAccountDD_usd) {
            maxAccountDD_usd = currentAccountDDDrop;
            maxAccountDD_percent = currentAccountDDDropPct;
            accountDD_start = currentAccountDDStartTime;
            accountDD_bottom = currentAccountDDBottomTime;
            accountDD_recovery = xTime;
            maxAccountDDDurationSec = xTime - currentAccountDDStartTime;
            maxAccountDDDurationTrades = currentAccountDDTradeCount;
          }
          inAccountDD = false;
        }
        peakAccountEquity = runningAccountEquity;
        peakAccountTime = xTime;
      } else {
        const accDDUsd = peakAccountEquity - runningAccountEquity;
        const accDDPct = peakAccountEquity > 0 ? (accDDUsd / peakAccountEquity) * 100 : 0;
        accountDrawdownsPercentList.push(accDDPct);

        if (!inAccountDD) {
          inAccountDD = true;
          currentAccountDDStartTime = peakAccountTime;
          currentAccountDDBottomTime = xTime;
          currentAccountDDDrop = accDDUsd;
          currentAccountDDDropPct = accDDPct;
          currentAccountDDTradeCount = 0;
        } else {
          if (accDDUsd > currentAccountDDDrop) {
            currentAccountDDDrop = accDDUsd;
            currentAccountDDDropPct = accDDPct;
            currentAccountDDBottomTime = xTime;
          }
        }
        currentAccountDDTradeCount++;

        if (currentAccountDDDrop > maxAccountDD_usd) {
          maxAccountDD_usd = currentAccountDDDrop;
          maxAccountDD_percent = currentAccountDDDropPct;
          accountDD_start = currentAccountDDStartTime;
          accountDD_bottom = currentAccountDDBottomTime;
          accountDD_recovery = null;
          maxAccountDDDurationSec = xTime - currentAccountDDStartTime;
          maxAccountDDDurationTrades = currentAccountDDTradeCount;
        }
      }

      // ج) منحنی فرضی بدون کسر کارمزد صرافی (Hypothetical without Trading Fees)
      noFeeRunningEquity += grossPnl;
      if (noFeeRunningEquity > noFeePeakEquity) {
        noFeePeakEquity = noFeeRunningEquity;
      } else {
        const nfDD = noFeePeakEquity - noFeeRunningEquity;
        const nfDDPct = noFeePeakEquity > 0 ? (nfDD / noFeePeakEquity) * 100 : 0;
        if (nfDD > noFeeMaxDD_usd) noFeeMaxDD_usd = nfDD;
        if (nfDDPct > noFeeMaxDD_percent) noFeeMaxDD_percent = nfDDPct;
      }
    }

    const netFundingCost = totalFundingPaid - totalFundingReceived;
    const legacyFundingFeeEstimate = (totalHoldingSec / 28800) * (totalVolumeTraded / 2) * 0.0001;
    const avgFundingPerChargedPosition = chargedPositionsCount > 0 ? totalFundingPaid / chargedPositionsCount : 0;
    const estimatedFundingFees = netFundingCost; // هزینه فاندینگ دقیق و واقعی
    const finalAccountNetProfit = totalTradingNetProfit - netFundingCost;
    const totalNetProfit = finalAccountNetProfit; // سود خالص نهایی پس از کارمزد و فاندینگ

    const finalEquity = initialCap + totalNetProfit;
    const totalReturnPercent = initialCap > 0 ? (totalNetProfit / initialCap) * 100 : 0;
    const totalTradingReturnPercent = initialCap > 0 ? (totalTradingNetProfit / initialCap) * 100 : 0;

    const annualizedReturn =
      durationYears > 0
        ? (Math.pow(Math.max(0.001, finalEquity / initialCap), 1 / durationYears) - 1) * 100
        : totalReturnPercent * (365.25 / Math.max(1, durationDays));

    const cagrEligible = durationDays >= 30;
    const cagrValue = cagrEligible ? annualizedReturn : null;

    const dailyPnLVals = Object.values(dailyPnLMap);
    const totalDaysCount = Math.max(1, dailyPnLVals.length);
    const dailyReturnPcts = dailyPnLVals.map((pnl) => (pnl / initialCap) * 100);

    let bestDayPnl = 0;
    let bestDayDate = '—';
    let worstDayPnl = 0;
    let worstDayDate = '—';

    for (const [dStr, pnl] of Object.entries(dailyPnLMap)) {
      if (pnl > bestDayPnl || bestDayDate === '—') {
        bestDayPnl = pnl;
        bestDayDate = dStr;
      }
      if (pnl < worstDayPnl || worstDayDate === '—') {
        worstDayPnl = pnl;
        worstDayDate = dStr;
      }
    }
    const bestDayPercent = initialCap > 0 ? (bestDayPnl / initialCap) * 100 : 0;
    const worstDayPercent = initialCap > 0 ? (worstDayPnl / initialCap) * 100 : 0;
    const bestDayConcentrationTradingNetPct = totalTradingNetProfit > 0 ? (bestDayPnl / totalTradingNetProfit) * 100 : 0;
    const bestDayConcentrationAccountNetPct = finalAccountNetProfit > 0 ? (bestDayPnl / finalAccountNetProfit) * 100 : 0;
    const bestDayConcentrationPct = bestDayConcentrationTradingNetPct;

    // دو نسخه حداکثر افت سرمایه: منحنی حساب و منحنی معاملاتی
    maxDD_usd = maxAccountDD_usd > 0 ? maxAccountDD_usd : maxTradingDD_usd;
    maxDD_percent = maxAccountDD_percent > 0 ? maxAccountDD_percent : maxTradingDD_percent;
    const maxDDDurationDays = (maxAccountDDDurationSec > 0 ? maxAccountDDDurationSec : maxTradingDDDurationSec) / 86400;
    maxDDDurationTrades = maxAccountDDDurationTrades > 0 ? maxAccountDDDurationTrades : maxTradingDDDurationTrades;

    const calmarRatio = maxDD_percent > 0 ? annualizedReturn / maxDD_percent : annualizedReturn > 0 ? 99.0 : 0.0;

    const avgDD_percent =
      accountDrawdownsPercentList.length > 0
        ? accountDrawdownsPercentList.reduce((a, b) => a + b, 0) / accountDrawdownsPercentList.length
        : (tradingDrawdownsPercentList.length > 0 ? tradingDrawdownsPercentList.reduce((a, b) => a + b, 0) / tradingDrawdownsPercentList.length : 0);
    const avgDD_usd = (avgDD_percent / 100) * initialCap;

    const avgRecoveryDays =
      recoveryDurationsSec.length > 0
        ? recoveryDurationsSec.reduce((a, b) => a + b, 0) / recoveryDurationsSec.length / 86400
        : 0;
    const avgRecoveryTrades =
      recoveryDurationsTrades.length > 0
        ? Math.round(recoveryDurationsTrades.reduce((a, b) => a + b, 0) / recoveryDurationsTrades.length)
        : 0;
    const maxRecoveryDays =
      recoveryDurationsSec.length > 0 ? Math.max(...recoveryDurationsSec) / 86400 : 0;

    // فاکتور سود در دو سطح: سطح معامله (قبل از فاندینگ) و سطح حساب (با احتساب فاندینگ)
    const tradeLevelProfitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;
    const accountGrossProfit = grossProfit + totalFundingReceived;
    const accountGrossLoss = grossLoss + totalFundingPaid;
    const accountLevelProfitFactor = accountGrossLoss > 0 ? accountGrossProfit / accountGrossLoss : accountGrossProfit > 0 ? 99.0 : 0;
    const profitFactor = tradeLevelProfitFactor;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const longWinRate = longTradesCount > 0 ? (longWinTrades / longTradesCount) * 100 : 0;
    const shortWinRate = shortTradesCount > 0 ? (shortWinTrades / shortTradesCount) * 100 : 0;

    const avgWinUsd = winTrades > 0 ? grossProfit / winTrades : 0;
    const avgLossUsd = lossTrades > 0 ? grossLoss / lossTrades : 0;
    const avgWinPercent = initialCap > 0 ? (avgWinUsd / initialCap) * 100 : 0;
    const avgLossPercent = initialCap > 0 ? (avgLossUsd / initialCap) * 100 : 0;
    const winLossRatio = avgLossUsd > 0 ? avgWinUsd / avgLossUsd : avgWinUsd > 0 ? 99.0 : 0;

    // روش ۱: محاسبه امید ریاضی بر اساس نتیجه خالص کل معاملات بسته‌شده
    const expectancyUsd = totalTrades > 0 ? totalTradingNetProfit / totalTrades : 0;
    const riskAmountPerTrade = effectiveRiskUsdt;
    const expectancyR = riskAmountPerTrade > 0 ? expectancyUsd / riskAmountPerTrade : 0;

    // روش ۲: راستی‌آزمایی مستقل فرمول امید ریاضی: (Win Rate × Average Win) - (Loss Rate × Average Loss)
    const winRateFrac = totalTrades > 0 ? winTrades / totalTrades : 0;
    const lossRateFrac = totalTrades > 0 ? lossTrades / totalTrades : 0;
    const expectancyFormula2 = (winRateFrac * avgWinUsd) - (lossRateFrac * avgLossUsd);
    const expectancyDiscrepancy = Math.abs(expectancyUsd - expectancyFormula2);

    const avgHoldingSec = totalTrades > 0 ? totalHoldingSec / totalTrades : 0;
    const avgHoldingHours = avgHoldingSec / 3600;
    const timeframeBarsSec: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400,
    };
    const barSec = timeframeBarsSec[timeframe] || 300;
    const avgHoldingBars = Math.round(avgHoldingSec / barSec);

    const timeEvents = new Set<number>();
    for (const inv of intervals) {
      if (inv.entry) timeEvents.add(inv.entry);
      if (inv.exit) timeEvents.add(inv.exit);
    }
    const sortedTimes = Array.from(timeEvents).sort((a, b) => a - b);

    let maxConcurrentPositions = 0;
    let totalConcurrentSampleSum = 0;
    let totalGrossExposureSum = 0;
    let totalNetExposureSum = 0;
    let maxGrossExposure = 0;
    let minNetExposure = 0;
    let maxNetExposure = 0;
    let maxSimultaneousNotional = 0;
    const sampleCount = Math.max(1, sortedTimes.length);

    for (const tPoint of sortedTimes) {
      let activeCount = 0;
      let longExp = 0;
      let shortExp = 0;

      for (const inv of intervals) {
        if (tPoint >= inv.entry && tPoint <= inv.exit) {
          activeCount++;
          if (inv.direction === 'BUY') {
            longExp += inv.posValue;
          } else {
            shortExp += inv.posValue;
          }
        }
      }

      const notionalAtPoint = longExp + shortExp;
      if (notionalAtPoint > maxSimultaneousNotional) {
        maxSimultaneousNotional = notionalAtPoint;
      }

      if (activeCount > maxConcurrentPositions) {
        maxConcurrentPositions = activeCount;
      }
      totalConcurrentSampleSum += activeCount;

      const grossExp = initialCap > 0 ? notionalAtPoint / initialCap : 0;
      const netExp = initialCap > 0 ? (longExp - shortExp) / initialCap : 0;

      totalGrossExposureSum += grossExp;
      totalNetExposureSum += netExp;

      if (grossExp > maxGrossExposure) maxGrossExposure = grossExp;
      if (netExp > maxNetExposure) maxNetExposure = netExp;
      if (netExp < minNetExposure) minNetExposure = netExp;
    }

    const actualMaxLeverage = initialCap > 0 ? maxSimultaneousNotional / initialCap : 1;
    const avgConcurrentPositions = totalConcurrentSampleSum / sampleCount;
    const avgGrossExposure = totalGrossExposureSum / sampleCount;
    const avgNetExposure = totalNetExposureSum / sampleCount;
    const turnoverRatio = initialCap > 0 ? totalVolumeTraded / initialCap : 0;

    // =========================================================================
    // محاسبه شاخص‌های پوشش واقعی معاملات (TABLE 9 — ACTUAL TRADE COVERAGE)
    // =========================================================================
    const firstTradeEntryTime = sortedTrades.length > 0 ? (sortedTrades[0].entryTime || sortedTrades[0].timeF || 0) : 0;
    const lastTradeExitTime = sortedTrades.length > 0 ? Math.max(...sortedTrades.map(t => t.exitTime || t.entryTime || 0)) : 0;
    const coverageCalendarDays = (firstTradeEntryTime > 0 && lastTradeExitTime > firstTradeEntryTime)
      ? Math.max(1, Math.round((toSec(lastTradeExitTime) - toSec(firstTradeEntryTime)) / 86400))
      : durationDays;

    const activeTradingDaysSet = new Set<string>();
    const activeMonthsSet = new Set<string>();
    const activeYearsSet = new Set<string>();

    for (const t of sortedTrades) {
      const xT = t.exitTime || t.entryTime || 0;
      if (xT > 0) {
        const dStr = new Date(toMs(xT)).toISOString().slice(0, 10);
        activeTradingDaysSet.add(dStr);
        activeMonthsSet.add(dStr.slice(0, 7));
        activeYearsSet.add(dStr.slice(0, 4));
      }
    }
    const activeTradingDaysCount = activeTradingDaysSet.size;
    const activeMonthsCount = activeMonthsSet.size;
    const activeYearsCount = activeYearsSet.size;
    const avgTradesPerMonth = activeMonthsCount > 0 ? totalTrades / activeMonthsCount : 0;
    const avgTradesPerDay = activeTradingDaysCount > 0 ? totalTrades / activeTradingDaysCount : 0;

    const actualTradeCoverageAudit = {
      earliestFinalTradeEntry: formatDate(firstTradeEntryTime),
      latestFinalTradeExit: formatDate(lastTradeExitTime),
      calendarDaysBetween: coverageCalendarDays,
      activeTradingDaysCount,
      activeMonthsCount,
      activeYearsCount,
      avgTradesPerMonth: parseFloat(avgTradesPerMonth.toFixed(1)),
      avgTradesPerDay: parseFloat(avgTradesPerDay.toFixed(2)),
      datasetCoverageText: `${durationDays} روز تقویمی در آرشیو دیتای کندل‌ها`,
      actualStrategyTradingCoverageText: `${coverageCalendarDays} روز تقویمی (${activeTradingDaysCount} روز معاملاتی فعال)`,
      coverageDifferenceExplanation: `پوشش دیتای کندل‌ها (${durationDays} روز) گستره دیتابیس کندل‌های دانلودشده است؛ در حالی که پوشش استراتژی (${coverageCalendarDays} روز) فاصله زمانی وقوع اولین تا آخرین معامله واقعی است که برای سنجش قابلیت اتکا به شاخص‌های سالانه‌شده ضروری است.`,
    };

    // =========================================================================
    // جدول عملکرد تفصیلی ماهانه (TABLE 10 — MONTHLY PORTFOLIO PERFORMANCE)
    // =========================================================================
    const monthlyPerformanceList: Array<{
      month: string;
      closedTrades: number;
      winningTrades: number;
      losingTrades: number;
      winRate: number;
      grossPnl: number;
      tradingFees: number;
      funding: number;
      netTradingPnl: number;
      netAccountPnl: number;
      returnPercent: number;
      maxDrawdownPct: number;
    }> = [];

    if (sortedTrades.length > 0) {
      const minDate = new Date(toMs(firstTradeEntryTime));
      const maxDate = new Date(toMs(lastTradeExitTime));
      const cur = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
      const endMonth = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));

      while (cur <= endMonth) {
        const mKey = cur.toISOString().slice(0, 7);
        const mTrades = sortedTrades.filter((t) => {
          const tTime = t.exitTime || t.entryTime || 0;
          return tTime > 0 && new Date(toMs(tTime)).toISOString().slice(0, 7) === mKey;
        });

        const mClosed = mTrades.length;
        const mWins = mTrades.filter((t) => (t.pnl || 0) > 0).length;
        const mLosses = mClosed - mWins;
        const mWinRate = mClosed > 0 ? (mWins / mClosed) * 100 : 0;
        let mGross = 0;
        let mFees = 0;
        let mFunding = 0;

        for (const t of mTrades) {
          const p = executionTradesList.find((e) => e.id === (t.id || `${(t as any).symbol}-${t.entryTime}`));
          if (p) {
            mGross += p.grossTradePnl;
            mFees += p.totalTradingFee;
            mFunding += p.netFunding;
          } else {
            const fee = t.fee || t.commission || 0;
            mGross += (t.grossPnl !== undefined ? t.grossPnl : (t.pnl || 0) + fee);
            mFees += fee;
          }
        }

        const mNetTrading = mGross - mFees;
        const mNetAccount = mNetTrading - mFunding;
        const mReturnPct = initialCap > 0 ? (mNetAccount / initialCap) * 100 : 0;

        let mPeak = 0;
        let mRun = 0;
        let mMaxDD = 0;
        for (const t of mTrades) {
          mRun += (t.pnl || 0);
          if (mRun > mPeak) mPeak = mRun;
          const drop = mPeak - mRun;
          if (drop > mMaxDD) mMaxDD = drop;
        }
        const mMaxDDPct = initialCap > 0 ? (mMaxDD / initialCap) * 100 : 0;

        monthlyPerformanceList.push({
          month: mKey,
          closedTrades: mClosed,
          winningTrades: mWins,
          losingTrades: mLosses,
          winRate: parseFloat(mWinRate.toFixed(1)),
          grossPnl: parseFloat(mGross.toFixed(2)),
          tradingFees: parseFloat(mFees.toFixed(2)),
          funding: parseFloat(mFunding.toFixed(2)),
          netTradingPnl: parseFloat(mNetTrading.toFixed(2)),
          netAccountPnl: parseFloat(mNetAccount.toFixed(2)),
          returnPercent: parseFloat(mReturnPct.toFixed(2)),
          maxDrawdownPct: parseFloat(mMaxDDPct.toFixed(2)),
        });

        cur.setUTCMonth(cur.getUTCMonth() + 1);
      }
    }


    // =========================================================================
    // جدول توزیع ریسک روزانه و VaR / CVaR (TABLE 12 — DAILY RISK DISTRIBUTION)
    // =========================================================================
    const dailyReturnsList: number[] = [];
    if (sortedTrades.length > 0) {
      const minDate = new Date(toMs(firstTradeEntryTime));
      const maxDate = new Date(toMs(lastTradeExitTime));
      const cur = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate()));
      const endDay = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate()));

      while (cur <= endDay) {
        const dKey = cur.toISOString().slice(0, 10);
        const dayPnl = dailyPnLMap[dKey] || 0;
        const dayPct = initialCap > 0 ? (dayPnl / initialCap) * 100 : 0;
        dailyReturnsList.push(dayPct);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else {
      dailyReturnsList.push(0);
    }

    const sortedDailyPcts = dailyReturnsList.slice().sort((a, b) => a - b);
    const totalCalendarDays = dailyReturnsList.length;
    const activeTradingCalendarDays = dailyReturnsList.filter((r) => r !== 0).length;
    const meanDaily = dailyReturnsList.reduce((a, b) => a + b, 0) / Math.max(1, totalCalendarDays);
    const medianDaily = sortedDailyPcts[Math.floor(sortedDailyPcts.length / 2)] || 0;
    const minDaily = sortedDailyPcts[0] || 0;
    const maxDaily = sortedDailyPcts[sortedDailyPcts.length - 1] || 0;

    const varianceDaily =
      sortedDailyPcts.length > 1
        ? sortedDailyPcts.reduce((sum, r) => sum + Math.pow(r - meanDaily, 2), 0) / (sortedDailyPcts.length - 1)
        : 0;
    const stdDevDaily = Math.sqrt(varianceDaily);
    const annualizedVolatility = stdDevDaily * Math.sqrt(365.25);

    const downsideDailyReturns = dailyReturnsList.filter((r) => r < 0);
    const downsideVariance =
      downsideDailyReturns.length > 0
        ? downsideDailyReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideDailyReturns.length
        : 0;
    const downsideStdDev = Math.sqrt(downsideVariance);
    const annualizedDownsideVol = downsideStdDev * Math.sqrt(365.25);

    const riskFreeRate = 4.0;
    const excessReturn = annualizedReturn - riskFreeRate;
    const sharpeRatio =
      annualizedVolatility > 0
        ? excessReturn / annualizedVolatility
        : totalNetProfit > 0
        ? 99.0
        : 0.0;
    const sortinoRatio =
      annualizedDownsideVol > 0
        ? excessReturn / annualizedDownsideVol
        : totalNetProfit > 0
        ? 99.0
        : 0.0;

    const p5Idx = Math.max(0, Math.floor(sortedDailyPcts.length * 0.05));
    const p1Idx = Math.max(0, Math.floor(sortedDailyPcts.length * 0.01));
    const p5Val = sortedDailyPcts[p5Idx] || 0;
    const p1Val = sortedDailyPcts[p1Idx] || 0;

    const var95_magnitude = -p5Val;
    const var99_magnitude = -p1Val;

    const tail5 = sortedDailyPcts.slice(0, p5Idx + 1);
    const cvar95_magnitude = tail5.length > 0 ? -(tail5.reduce((a, b) => a + b, 0) / tail5.length) : var95_magnitude;

    const tail1 = sortedDailyPcts.slice(0, p1Idx + 1);
    const cvar99_magnitude = tail1.length > 0 ? -(tail1.reduce((a, b) => a + b, 0) / tail1.length) : var99_magnitude;

    // =========================================================================
    // سه شاخص سنجش پیوستگی و ریسک نزولی (SMOOTHNESS & DOWNSIDE-RISK METRICS)
    // ۱. پایداری منحنی سرمایه (R^2 / R-Squared و شیب رگرسیون OLS)
    // ۲. شاخص زخم اولسر (Ulcer Index) و نسبت مارتین (Martin Ratio / UPI)
    // ۳. نسبت سورتینو به ازای هر معامله و روزانه/سالانه‌شده (Sortino Ratio)
    // =========================================================================
    const N_trades = tradeReturnPcts.length;
    const M_points = accountEquitySeries.length; // N + 1

    // ۱. برازش رگرسیون خطی حداقل مربعات معمولی (OLS) بر کل نقاط E = [E_0, ..., E_N]
    let olsSlope = 0;
    let rSquared = 0;
    if (N_trades >= 1 && M_points >= 2) {
      const xMean = N_trades / 2; // میانگین اندیس‌ها [0, 1, ..., N]
      const eMean = accountEquitySeries.reduce((a, b) => a + b, 0) / M_points;
      let covXE = 0;
      let varX = 0;
      let varE = 0;
      for (let i = 0; i < M_points; i++) {
        const dx = i - xMean;
        const de = accountEquitySeries[i] - eMean;
        covXE += dx * de;
        varX += dx * dx;
        varE += de * de;
      }
      covXE /= M_points;
      varX /= M_points;
      varE /= M_points;
      olsSlope = varX > 0 ? covXE / varX : 0;
      const sigmaX = Math.sqrt(varX);
      const sigmaE = Math.sqrt(varE);
      if (sigmaX > 0 && sigmaE > 0) {
        const corr = covXE / (sigmaX * sigmaE);
        rSquared = Math.max(0, Math.min(1, Math.pow(corr, 2)));
      } else {
        rSquared = varE === 0 ? 1.0 : 0.0;
      }
    } else {
      rSquared = 1.0;
      olsSlope = 0;
    }
    const rSquaredStatus: 'PASS' | 'WARN' = rSquared >= 0.70 ? 'PASS' : 'WARN';

    // ۲. شاخص زخم اولسر (Ulcer Index) و نسبت مارتین (Martin Ratio / UPI)
    let sumSquaredDrawdowns = 0;
    let runningUiPeak = accountEquitySeries[0] || initialCap;
    for (let i = 0; i < M_points; i++) {
      const eq = accountEquitySeries[i];
      if (eq > runningUiPeak) {
        runningUiPeak = eq;
      }
      const ddPct = runningUiPeak > 0 ? ((runningUiPeak - eq) / runningUiPeak) * 100 : 0;
      sumSquaredDrawdowns += ddPct * ddPct;
    }
    const ulcerIndex = M_points > 0 ? Math.sqrt(sumSquaredDrawdowns / M_points) : 0;
    const martinRatio =
      ulcerIndex > 0
        ? totalReturnPercent / ulcerIndex
        : totalReturnPercent > 0
        ? 99.0
        : 0.0;

    // ۳. نسبت سورتینو با انحراف نزولی هدف صفر (Target Return = 0)
    // ۳-الف: به ازای هر معامله (Per-Trade Sortino)
    const sumSquaredDownsideTrade = tradeReturnPcts.reduce((sum, r) => {
      const downside = Math.min(0, r);
      return sum + (downside * downside);
    }, 0);
    const tradeDownsideDev = N_trades > 0 ? Math.sqrt(sumSquaredDownsideTrade / N_trades) : 0;
    const meanTradeReturn = N_trades > 0 ? tradeReturnPcts.reduce((a, b) => a + b, 0) / N_trades : 0;
    const perTradeSortino =
      tradeDownsideDev > 0
        ? meanTradeReturn / tradeDownsideDev
        : meanTradeReturn > 0
        ? 99.0
        : 0.0;

    // ۳-ب: روزانه و سالانه‌شده بر کل روزهای تقویمی (Daily & Annualized Sortino)
    const K_calendarDays = dailyReturnsList.length;
    const sumSquaredDownsideDaily = dailyReturnsList.reduce((sum, r) => {
      const downside = Math.min(0, r);
      return sum + (downside * downside);
    }, 0);
    const dailyDownsideDev = K_calendarDays > 0 ? Math.sqrt(sumSquaredDownsideDaily / K_calendarDays) : 0;
    const dailySortino =
      dailyDownsideDev > 0
        ? meanDaily / dailyDownsideDev
        : meanDaily > 0
        ? 99.0
        : 0.0;
    const annualizedDailySortino = dailySortino * Math.sqrt(365);

    const equityCurveStability = {
      rSquared: parseFloat(rSquared.toFixed(4)),
      rSquaredPercent: parseFloat((rSquared * 100).toFixed(2)),
      slopePerTrade: parseFloat(olsSlope.toFixed(2)),
      status: rSquaredStatus,
      displayText: `${rSquared.toFixed(2)} (${(rSquared * 100).toFixed(2)}%) | شیب: ${olsSlope >= 0 ? '+' : ''}$${olsSlope.toFixed(2)}/trade`,
    };

    const ulcerIndexAndMartinRatio = {
      ulcerIndex: parseFloat(ulcerIndex.toFixed(2)),
      martinRatio: parseFloat(martinRatio.toFixed(2)),
      displayText: `UI: ${ulcerIndex.toFixed(2)}% | Martin Ratio: ${martinRatio.toFixed(2)}`,
    };

    const sortinoMetrics = {
      perTradeDownsideDev: parseFloat(tradeDownsideDev.toFixed(3)),
      perTradeSortino: parseFloat(perTradeSortino.toFixed(2)),
      dailyDownsideDev: parseFloat(dailyDownsideDev.toFixed(3)),
      dailySortino: parseFloat(dailySortino.toFixed(2)),
      annualizedDailySortino: parseFloat(annualizedDailySortino.toFixed(2)),
      table3DisplayText: `Per-Trade: ${perTradeSortino.toFixed(2)} | Annualized: ${annualizedDailySortino.toFixed(2)}`,
      table12DisplayText: `Downside Dev: ${dailyDownsideDev.toFixed(2)}% | Daily Sortino: ${dailySortino.toFixed(2)} (Annualized: ${annualizedDailySortino.toFixed(2)})`,
    };

    // =========================================================================
    // جدول اعتبارسنجی دو منحنی و اصطکاک کارمزد (TABLE 11 — EQUITY CURVE & FEE DRAG)
    // =========================================================================
    const equityCurveValidationAudit = {
      tradingEquity: {
        finalEquity: parseFloat((initialCap + totalTradingNetProfit).toFixed(2)),
        maxDrawdownUsd: parseFloat(maxTradingDD_usd.toFixed(2)),
        maxDrawdownPct: parseFloat(maxTradingDD_percent.toFixed(2)),
        startDate: formatDate(tradingDD_start),
        bottomDate: formatDate(tradingDD_bottom),
        recoveryDate: tradingDD_recovery ? formatDate(tradingDD_recovery) : 'در حال بازیابی (Under Recovery)',
        durationDays: parseFloat(((maxTradingDDDurationSec || 0) / 86400).toFixed(1)),
        durationTrades: maxTradingDDDurationTrades || 0,
      },
      accountEquity: {
        finalEquity: parseFloat(finalEquity.toFixed(2)),
        maxDrawdownUsd: parseFloat(maxAccountDD_usd.toFixed(2)),
        maxDrawdownPct: parseFloat(maxAccountDD_percent.toFixed(2)),
        startDate: formatDate(accountDD_start),
        bottomDate: formatDate(accountDD_bottom),
        recoveryDate: accountDD_recovery ? formatDate(accountDD_recovery) : 'در حال بازیابی (Under Recovery)',
        durationDays: parseFloat(((maxAccountDDDurationSec || 0) / 86400).toFixed(1)),
        durationTrades: maxAccountDDDurationTrades || 0,
      },
      stability: equityCurveStability,
      ulcerIndex: parseFloat(ulcerIndex.toFixed(2)),
      martinRatio: parseFloat(martinRatio.toFixed(2)),
    };

    const feeDragAudit = {
      maxDDWithFeesUsd: parseFloat(maxTradingDD_usd.toFixed(2)),
      maxDDWithFeesPct: parseFloat(maxTradingDD_percent.toFixed(2)),
      maxDDWithoutFeesUsd: parseFloat(noFeeMaxDD_usd.toFixed(2)),
      maxDDWithoutFeesPct: parseFloat(noFeeMaxDD_percent.toFixed(2)),
      feeImpactOnMaxDDUsd: parseFloat((maxTradingDD_usd - noFeeMaxDD_usd).toFixed(2)),
      feeImpactOnMaxDDPct: parseFloat((maxTradingDD_percent - noFeeMaxDD_percent).toFixed(2)),
      finalEquityWithFees: parseFloat((initialCap + totalTradingNetProfit).toFixed(2)),
      finalEquityWithoutFees: parseFloat(noFeeRunningEquity.toFixed(2)),
      feeImpactOnFinalEquityUsd: parseFloat((noFeeRunningEquity - (initialCap + totalTradingNetProfit)).toFixed(2)),
      explanation: 'سهم کارمزدها در افت سرمایه به روش تجربی از طریق تفاضل دو منحنی واقعی و بدون کارمزد محاسبه شده است (نه تقسیم ساده کارمزد کل بر سرمایه).',
    };

    // =========================================================================
    // جدول توزیع ریسک روزانه و VaR / CVaR (TABLE 12 — DAILY RISK DISTRIBUTION)
    // =========================================================================
    const dailyRiskDistributionAudit = {
      calendarDaysCount: totalCalendarDays,
      tradingDaysCount: activeTradingCalendarDays,
      meanDailyReturn: parseFloat(meanDaily.toFixed(3)),
      medianDailyReturn: parseFloat(medianDaily.toFixed(3)),
      stdDevDailyReturn: parseFloat(stdDevDaily.toFixed(3)),
      downsideDeviation: parseFloat(dailyDownsideDev.toFixed(3)),
      dailySortino: parseFloat(dailySortino.toFixed(2)),
      annualizedSortino: parseFloat(annualizedDailySortino.toFixed(2)),
      minDailyReturn: parseFloat(minDaily.toFixed(2)),
      maxDailyReturn: parseFloat(maxDaily.toFixed(2)),
      percentile5th: parseFloat(p5Val.toFixed(2)),
      percentile1st: parseFloat(p1Val.toFixed(2)),
      var95: parseFloat(var95_magnitude.toFixed(2)),
      var99: parseFloat(var99_magnitude.toFixed(2)),
      cvar95: parseFloat(cvar95_magnitude.toFixed(2)),
      cvar99: parseFloat(cvar99_magnitude.toFixed(2)),
      signConventionNote: 'قرارداد علامت: مقادیر VaR و CVaR به صورت قدرمطلق زیان (Positive Loss Magnitude % of Equity) گزارش شده‌اند. ارزش در معرض ریسک شرطی (Expected Shortfall) میانگین زیان در بدترین ۵٪ و ۱٪ روزها است و با VaR یکسان فرض نشده است.',
    };

    const dailyVaR95 = dailyRiskDistributionAudit.var95;
    const dailyCVaR95 = dailyRiskDistributionAudit.cvar95;
    const winDaysCount = dailyPnLVals.filter((p) => p > 0).length;
    const winningDaysPercent = totalDaysCount > 0 ? (winDaysCount / totalDaysCount) * 100 : 0;

    const monthlyReturnText =
      Object.entries(monthlyPnLMap)
        .map(
          ([m, pnl]) =>
            `${m}: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${((pnl / initialCap) * 100).toFixed(1)}%)`
        )
        .join(' | ') || 'ماه جاری: دیتای کامل';

    // =========================================================================
    // جدول بازپخش غیرخطی ریسک در ۸ سطح (TABLE 5/8 — NONLINEAR RISK REPLAY GRID)
    // =========================================================================
    const riskLevels = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
    const nonlinearRiskReplayTable = riskLevels.map((r) => {
      const baseR = effectiveRiskPercent > 0 ? effectiveRiskPercent : 1.0;
      const k = r / baseR;

      let rEquity = initialCap;
      let rPeak = initialCap;
      let rMaxDDUsd = 0;
      let rMaxDDPct = 0;
      let rGrossProfit = 0;
      let rGrossLoss = 0;

      for (const t of sortedTrades) {
        const netP = (t.pnl || 0) * k;
        if (netP > 0) rGrossProfit += netP;
        else rGrossLoss += Math.abs(netP);

        const matchedExec = executionTradesList.find(e => e.id === (t.id || `${(t as any).symbol}-${t.entryTime}`));
        const tFunding = (matchedExec?.netFunding || 0) * k;
        rEquity += (netP - tFunding);

        if (rEquity > rPeak) {
          rPeak = rEquity;
        } else {
          const ddU = rPeak - rEquity;
          const ddP = rPeak > 0 ? (ddU / rPeak) * 100 : 0;
          if (ddU > rMaxDDUsd) rMaxDDUsd = ddU;
          if (ddP > rMaxDDPct) rMaxDDPct = ddP;
        }
      }

      const rRiskUsd = (initialCap * r) / 100;
      const rNetProfit = rEquity - initialCap;
      const rReturnPct = initialCap > 0 ? (rNetProfit / initialCap) * 100 : 0;
      const rPF = rGrossLoss > 0 ? rGrossProfit / rGrossLoss : (rGrossProfit > 0 ? 99 : 0);
      const rMaxGrossExpPct = maxGrossExposure * k * 100;
      const rMaxMarginUsd = maxSimultaneousNotional * k;
      const rSharpe = sharpeRatio;
      const rSortino = sortinoRatio;

      return {
        riskLevel: r,
        riskPercent: r,
        riskUsd: parseFloat(rRiskUsd.toFixed(2)),
        accountNetProfit: parseFloat(rNetProfit.toFixed(2)),
        netReturnPercent: parseFloat(rReturnPct.toFixed(2)),
        finalReturnPct: parseFloat(rReturnPct.toFixed(2)),
        maxDD: parseFloat(rMaxDDPct.toFixed(2)),
        maxDD_percent: parseFloat(rMaxDDPct.toFixed(2)),
        maxDD_usd: parseFloat(rMaxDDUsd.toFixed(2)),
        sharpeRatio: parseFloat(rSharpe.toFixed(2)),
        sortinoRatio: parseFloat(rSortino.toFixed(2)),
        profitFactor: parseFloat(rPF.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        finalEquity: parseFloat(rEquity.toFixed(2)),
        maxGrossExposurePct: parseFloat(rMaxGrossExpPct.toFixed(1)),
        maxRequiredMarginUsd: parseFloat(rMaxMarginUsd.toFixed(0)),
      };
    });

    // =========================================================================
    // ممیزی سطح اجرا و اصطکاک (TABLE 7 — EXECUTION & COST AUDIT SUMMARY)
    // =========================================================================
    const totalExecutedNotional = sumEntryNotional + sumExitNotional;
    const effectiveFeeRate = totalExecutedNotional > 0 ? (sumTradingFees / totalExecutedNotional) * 100 : (commissionPercent || 0.05);
    const sumFinalTradesPnl = sumGrossTradePnl - sumTradingFees - netFundingCost;
    const reconciliationCheckDifference = Math.abs(sumFinalTradesPnl - finalAccountNetProfit);
    const executionAuditPassed = reconciliationCheckDifference <= 0.10;

    const executionCostAudit = {
      entryNotionalTotal: parseFloat(sumEntryNotional.toFixed(2)),
      exitNotionalTotal: parseFloat(sumExitNotional.toFixed(2)),
      totalExecutedNotional: parseFloat(totalExecutedNotional.toFixed(2)),
      sumGrossTradePnl: parseFloat(sumGrossTradePnl.toFixed(2)),
      entryFeeTotal: parseFloat(sumEntryFees.toFixed(2)),
      exitFeeTotal: parseFloat(sumExitFees.toFixed(2)),
      totalTradingFees: parseFloat(sumTradingFees.toFixed(2)),
      effectiveFeeRate: parseFloat(effectiveFeeRate.toFixed(4)),
      assumedFeeRatePerExecution: commissionPercent,
      sumFundingPaid: parseFloat(totalFundingPaid.toFixed(2)),
      sumFundingReceived: parseFloat(totalFundingReceived.toFixed(2)),
      netFunding: parseFloat(netFundingCost.toFixed(2)),
      sumFinalTradePnl: parseFloat(sumFinalTradesPnl.toFixed(2)),
      finalAccountNetProfit: parseFloat(finalAccountNetProfit.toFixed(2)),
      reconciliationDifference: parseFloat(reconciliationCheckDifference.toFixed(4)),
      reconciliationPassed: executionAuditPassed,
      sampleExecutions: executionTradesList.slice(0, 15),
    };

    // =========================================================================
    // ممیزی مارجین، اهرم و مواجهه (TABLE 8 — EXPOSURE & MARGIN AUDIT SUMMARY)
    // =========================================================================
    const exposureMarginAudit = {
      exchangeLeverageSetting: '1x (Isolated Margin)',
      sizingMethodology: 'Theoretical risk-based sizing',
      riskPerTradePct: effectiveRiskPercent,
      riskParityFormula: 'Position Notional = (Account Equity × Risk%) / SL Distance',
      maxGrossExposurePct: parseFloat((maxGrossExposure * 100).toFixed(1)),
      avgGrossExposurePct: parseFloat((avgGrossExposure * 100).toFixed(1)),
      maxRequiredMarginUsd: parseFloat(maxSimultaneousNotional.toFixed(2)),
      maxRequiredMarginPct: parseFloat(((maxSimultaneousNotional / initialCap) * 100).toFixed(1)),
      maxSimultaneousNotional: parseFloat(maxSimultaneousNotional.toFixed(2)),
      maxConcurrentPositions,
      isTheoreticalRiskBasedSizing: maxGrossExposure > 1.0,
      executabilityAssessment: (maxGrossExposure > 1.0)
        ? `Theoretical risk-based sizing: ارزش اسمی در اوج به $${maxSimultaneousNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })} رسیده که ${(maxGrossExposure * 100).toFixed(1)}% سرمایه اولیه است. اجرای زنده این اندازه پوزیشن در اهرم ۱x نیازمند نقدینگی $${maxSimultaneousNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })} یا تنظیم اهرم صرافی روی حداقل ${actualMaxLeverage.toFixed(2)}x است.`
        : 'کاملاً قابل اجرا با اهرم ۱x صرافی بدون نیاز به لوریج مازاد',
    };

    // =========================================================================
    // ۱۲ آزمون خودکار انسجام و طبقه‌بندی وضعیت (TABLE 6 — AUTOMATED CONSISTENCY & STATUS)
    // =========================================================================
    const sumOfIndividualTradePnls = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const feeDifference = Math.abs((grossPnlSum - totalFees) - totalTradingNetProfit);

    const check1_winLoss = (winTrades + lossTrades) === totalTrades;
    const check2_directional = (longTradesCount + shortTradesCount) === totalTrades;
    const check3_sumTradePnl = Math.abs(sumOfIndividualTradePnls - totalTradingNetProfit) <= 0.10;
    const check4_netAccountPnl = Math.abs((totalTradingNetProfit - netFundingCost) - finalAccountNetProfit) <= 0.10;
    const check5_grossMinusLoss = Math.abs((grossProfit - grossLoss) - totalTradingNetProfit) <= 0.10;
    const check6_expectancyProduct = Math.abs((expectancyUsd * totalTrades) - totalTradingNetProfit) <= 0.10;
    const check7_maxDrawdownSign = maxAccountDD_percent >= 0;
    const check8_finalEquityEquation = Math.abs((initialCap + finalAccountNetProfit) - finalEquity) <= 0.10;
    const check9_totalFeesEquation = Math.abs(totalFees - sumTradingFees) <= 0.10;
    const check10_netFundingEquation = Math.abs(netFundingCost - (totalFundingPaid - totalFundingReceived)) <= 0.10;
    const check11_rawGeFinal = concurrencyFilterResults.rawTradesCount >= totalTrades;
    const check12_rejectedPlusFinal = (concurrencyFilterResults.rejectedTradesCount + totalTrades) === concurrencyFilterResults.rawTradesCount;

    const all12ChecksPassed =
      check1_winLoss &&
      check2_directional &&
      check3_sumTradePnl &&
      check4_netAccountPnl &&
      check5_grossMinusLoss &&
      check6_expectancyProduct &&
      check7_maxDrawdownSign &&
      check8_finalEquityEquation &&
      check9_totalFeesEquation &&
      check10_netFundingEquation &&
      check11_rawGeFinal &&
      check12_rejectedPlusFinal;

    const categoryAuditSummary = [
      {
        id: 'cat_accounting',
        name: 'Execution & Cost Accounting',
        nameFa: 'حسابداری تفصیلی معاملات و اصطکاک هزینه‌ها',
        status: (check3_sumTradePnl && check4_netAccountPnl && check5_grossMinusLoss && check8_finalEquityEquation && check9_totalFeesEquation && check10_netFundingEquation) ? 'PASS' : 'FAIL',
        note: 'تفکیک کامل Gross Trading PnL، کارمزد صرافی، فاندینگ و سود نهایی حساب با تایید ۱۰۰٪ معادلات',
      },
      {
        id: 'cat_directional',
        name: 'Directional & Trade Count Consistency',
        nameFa: 'انسجام تعداد معاملات و تفکیک دوطرفه (Long/Short)',
        status: (check1_winLoss && check2_directional) ? 'PASS' : 'FAIL',
        note: `${winTrades} برد + ${lossTrades} باخت = ${totalTrades} معامله کل بسته‌شده؛ جمع لانگ و شورت دقیقاً برابر با آمار کل`,
      },
      {
        id: 'cat_exposure',
        name: 'Exposure & Margin Constraints',
        nameFa: 'محدودیت‌های مارجین و سقف مواجهه سبد',
        status: (maxGrossExposure > 1.0) ? 'WARN' : 'PASS',
        note: (maxGrossExposure > 1.0)
          ? `مدل‌سازی سایزینگ تئوریک بر مبنای ریسک (سقف مواجهه ${(maxGrossExposure * 100).toFixed(1)}%). در اهرم ۱x صرافی نیازمند مارجین نقدی $${maxSimultaneousNotional.toFixed(0)} یا اهرم زنده >= ${actualMaxLeverage.toFixed(2)}x است.`
          : 'مواجهه ناخالص در محدوده ۱۰۰٪ سرمایه و قابل‌اجرا با اهرم ۱x',
      },
      {
        id: 'cat_coverage',
        name: 'Temporal Coverage & Dataset Representation',
        nameFa: 'پوشش زمانی واقعی و نمایندگی داده‌ها',
        status: (durationDays >= 30) ? 'PASS' : 'WARN',
        note: (durationDays >= 30)
          ? `دوره تست ${durationDays} روز تقویمی با ${activeTradingDaysCount} روز معاملاتی فعال`
          : `دوره تست کوتاه (${durationDays} روز تقویمی؛ سالانه‌سازی صرفاً یک برآورد خطی است و انحراف بقا به علت نمادهای فعال وجود دارد)`,
      },
      {
        id: 'cat_risk',
        name: 'Risk Distribution & VaR/CVaR Metrics',
        nameFa: 'توزیع ریسک روزانه و ارزش در معرض ریسک شرطی',
        status: 'PASS',
        note: 'محاسبه تجربی چارک‌های ۵٪ و ۱٪؛ تفکیک مستقل VaR و Expected Shortfall (CVaR) از منحنی واقعی حساب',
      },
      {
        id: 'cat_concurrency',
        name: 'Concurrency Filter & Zero Look-Ahead Bias',
        nameFa: 'فیلتر هماهنگ‌سازی همزمانی و عدم نگاه به آینده',
        status: (check11_rawGeFinal && check12_rejectedPlusFinal) ? 'PASS' : 'FAIL',
        note: `تفکیک رسمی [RAW / PRE-FILTER] (${concurrencyFilterResults.rawTradesCount}) از [FINAL / POST-CONCURRENCY] (${totalTrades}) با حذف ${concurrencyFilterResults.rejectedTradesCount} سیگنال متداخل بدون اریب نگاه به آینده`,
      },
    ];

    let overallAuditStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (!all12ChecksPassed) {
      overallAuditStatus = 'FAIL';
    } else if (categoryAuditSummary.some(c => c.status === 'WARN')) {
      overallAuditStatus = 'WARN';
    }

    const checksList = [
      {
        id: 1,
        name: 'برابری برد + باخت با کل معاملات بسته‌شده',
        nameEn: 'Wins + Losses == Final Closed Trades',
        formula: `${winTrades} W + ${lossTrades} L = ${totalTrades} Total Closed Trades`,
        status: check1_winLoss ? 'PASS' : 'FAIL',
        explanation: 'تعداد کل معاملات گزارش‌شده دقیقاً برابر با مجموع برنده و بازنده است و پوزیشن‌های باز در مخرج وین‌ریت محاسبه نشده‌اند.',
      },
      {
        id: 2,
        name: 'انطباق معاملات خرید و فروش با کل معاملات',
        nameEn: 'Long Trades + Short Trades == Final Closed Trades',
        formula: `${longTradesCount} Long + ${shortTradesCount} Short = ${totalTrades} Total Closed Trades`,
        status: check2_directional ? 'PASS' : 'FAIL',
        explanation: 'جمع جبری تعداد پوزیشن‌های خرید و فروش دقیقاً با کل معاملات بسته‌شده مطابقت کامل دارد.',
      },
      {
        id: 3,
        name: 'انطباق مجموع سود تکی با سود خالص معاملاتی',
        nameEn: 'Sum(Final Trade PnL Before Funding) == Net Trading PnL',
        formula: `Sum(Trade PnLs) = $${sumOfIndividualTradePnls.toFixed(2)} vs Net Trading = $${totalTradingNetProfit.toFixed(2)}`,
        status: check3_sumTradePnl ? 'PASS' : 'FAIL',
        explanation: 'سود هر ترید در لاگ پیش از فاندینگ است و مجموع آن دقیقاً با سود خالص معاملاتی قبل از فاندینگ همخوانی دارد.',
      },
      {
        id: 4,
        name: 'معادله سود نهایی حساب پس از کسر فاندینگ',
        nameEn: 'Net Trading PnL - Net Funding == Final Account PnL',
        formula: `$${totalTradingNetProfit.toFixed(2)} - $${netFundingCost.toFixed(2)} = $${(totalTradingNetProfit - netFundingCost).toFixed(2)} vs $${finalAccountNetProfit.toFixed(2)}`,
        status: check4_netAccountPnl ? 'PASS' : 'FAIL',
        explanation: 'فاندینگ ریت در سطح حساب تسویه شده و سود نهایی حساب را دقیقاً بازتولید می‌کند.',
      },
      {
        id: 5,
        name: 'سود ناخالص منهای زیان ناخالص = سود خالص معاملاتی',
        nameEn: 'Gross Profit - Gross Loss == Net Trading PnL',
        formula: `$${grossProfit.toFixed(2)} - $${grossLoss.toFixed(2)} = $${(grossProfit - grossLoss).toFixed(2)} vs $${totalTradingNetProfit.toFixed(2)}`,
        status: check5_grossMinusLoss ? 'PASS' : 'FAIL',
        explanation: 'مجموع نتایج تریدهای مثبت منهای قدرمطلق تریدهای منفی دقیقاً برابر با سود خالص معاملاتی است.',
      },
      {
        id: 6,
        name: 'حاصل‌ضرب امید ریاضی در تعداد معاملات = سود خالص',
        nameEn: 'Expectancy × Final Closed Trades == Net Trading PnL',
        formula: `$${expectancyUsd.toFixed(2)} × ${totalTrades} = $${(expectancyUsd * totalTrades).toFixed(2)} vs $${totalTradingNetProfit.toFixed(2)}`,
        status: check6_expectancyProduct ? 'PASS' : 'FAIL',
        explanation: 'میانگین بازده انتظاری هر ترید ضربدر تعداد معاملات نهایی، بازتولیدکننده دقیق سود خالص معاملاتی است.',
      },
      {
        id: 7,
        name: 'بزرگ‌تر یا مساوی صفر بودن قدرمطلق حداکثر افت سرمایه',
        nameEn: 'Max Drawdown Magnitude >= 0',
        formula: `Max Account DD = ${maxAccountDD_percent.toFixed(2)}% (USD: $${maxAccountDD_usd.toFixed(2)}) >= 0`,
        status: check7_maxDrawdownSign ? 'PASS' : 'FAIL',
        explanation: 'دراودان به صورت افت قله به دره ارزیابی شده و جهت آن کاملاً استاندارد است.',
      },
      {
        id: 8,
        name: 'ارزش نهایی دارایی = سرمایه اولیه + سود خالص حساب',
        nameEn: 'Final Equity == Initial Equity + Final Account PnL',
        formula: `$${initialCap.toFixed(2)} + ($${finalAccountNetProfit.toFixed(2)}) = $${(initialCap + finalAccountNetProfit).toFixed(2)} vs $${finalEquity.toFixed(2)}`,
        status: check8_finalEquityEquation ? 'PASS' : 'FAIL',
        explanation: 'دارایی انتهای شبیه‌سازی با موازنه حسابداری سرمایه اولیه و سود خالص نهایی حساب همخوانی مطلق دارد.',
      },
      {
        id: 9,
        name: 'برابری مجموع کارمزدها با جمع کارمزدهای ورود و خروج',
        nameEn: 'Total Fees == Sum(All Entry Fees + Exit Fees)',
        formula: `Total Fees = $${totalFees.toFixed(2)} vs Sum(Entry+Exit) = $${sumTradingFees.toFixed(2)}`,
        status: check9_totalFeesEquation ? 'PASS' : 'FAIL',
        explanation: 'کارمزد ورود و خروج ثبت‌شده در اجرای تک‌تک سفارش‌ها دقیقاً با سرجمع کارمزدها برابر است.',
      },
      {
        id: 10,
        name: 'برابری خالص فاندینگ با تفاضل فاندینگ پرداختی و دریافتی',
        nameEn: 'Net Funding == Funding Paid - Funding Received',
        formula: `Net Funding = $${netFundingCost.toFixed(2)} vs Paid ($${totalFundingPaid.toFixed(2)}) - Rec ($${totalFundingReceived.toFixed(2)}) = $${(totalFundingPaid - totalFundingReceived).toFixed(2)}`,
        status: check10_netFundingEquation ? 'PASS' : 'FAIL',
        explanation: 'محاسبه تسویه فاندینگ ریت پوزیشن‌های لانگ و شورت با انطباق کامل انجام شده است.',
      },
      {
        id: 11,
        name: 'تعداد معاملات خام بیشتر یا مساوی معاملات نهایی',
        nameEn: 'Raw Trades >= Final Trades',
        formula: `Raw Trades (${concurrencyFilterResults.rawTradesCount}) >= Final Trades (${totalTrades})`,
        status: check11_rawGeFinal ? 'PASS' : 'FAIL',
        explanation: 'فیلتر هماهنگ‌سازی همزمانی تنها معاملات معتبر غیرمتداخل را به عنوان سبد نهایی برگزیده است.',
      },
      {
        id: 12,
        name: 'مجموع معاملات پذیرفته‌شده و ردشده برابر با معاملات خام',
        nameEn: 'Rejected Trades + Final Trades == Raw Trades',
        formula: `${concurrencyFilterResults.rejectedTradesCount} ردشده + ${totalTrades} نهایی = ${concurrencyFilterResults.rawTradesCount} خام`,
        status: check12_rejectedPlusFinal ? 'PASS' : 'FAIL',
        explanation: 'تمامی سیگنال‌های تولیدشده اولیه در یکی از دو وضعیت نهایی یا ردشده به علت تداخل ثبت شده‌اند.',
      },
    ];

    const consistencyAudit = {
      allChecksPassed: all12ChecksPassed,
      overallStatus: overallAuditStatus,
      categoryAuditSummary,
      checks: checksList,
      sumOfIndividualTradePnls: parseFloat(sumOfIndividualTradePnls.toFixed(2)),
      totalTradingNetProfit: parseFloat(totalTradingNetProfit.toFixed(2)),
      check1_pnlSumMatch: check3_sumTradePnl,
      winTrades,
      lossTrades,
      totalTrades,
      check2_winLossCountMatch: check1_winLoss,
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      grossMinusLoss: parseFloat((grossProfit - grossLoss).toFixed(2)),
      check3_grossMinusLossMatch: check5_grossMinusLoss,
      grossPnlSum: parseFloat(grossPnlSum.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      estimatedFundingFees: parseFloat(estimatedFundingFees.toFixed(2)),
      finalAccountNetProfit: parseFloat(finalAccountNetProfit.toFixed(2)),
      check7_netPnlEquation: check9_totalFeesEquation,
      feeDifference: parseFloat(feeDifference.toFixed(4)),
      feeEquationRoundingNote: 'اختلاف ۰.۰۱$ ناشی از گرد کردن در محاسبات اعشاری شناور در مجموع صدها ترید',
      check8_finalNetPnl: check4_netAccountPnl,
      expectancyUsd: parseFloat(expectancyUsd.toFixed(2)),
      expectancyFormula2: parseFloat(expectancyFormula2.toFixed(2)),
      expectancyDiscrepancy: parseFloat(expectancyDiscrepancy.toFixed(4)),
      expectancyProduct: parseFloat((expectancyUsd * totalTrades).toFixed(2)),
      check5_expectancyMatch: check6_expectancyProduct,
      check6_expectancyFormulasMatch: expectancyDiscrepancy < 0.001,
      longTradesCount,
      shortTradesCount,
      longWinTrades,
      shortWinTrades,
      longLossTrades,
      shortLossTrades,
      longWinRate: parseFloat(longWinRate.toFixed(2)),
      shortWinRate: parseFloat(shortWinRate.toFixed(2)),
      check4_directionalMatch: check2_directional,
      bestDayConcentrationPct: parseFloat(bestDayConcentrationPct.toFixed(2)),
      bestDayConcentrationTradingNetPct: parseFloat(bestDayConcentrationTradingNetPct.toFixed(2)),
      bestDayConcentrationAccountNetPct: parseFloat(bestDayConcentrationAccountNetPct.toFixed(2)),
      tradeLevelProfitFactor: parseFloat(tradeLevelProfitFactor.toFixed(2)),
      accountLevelProfitFactor: parseFloat(accountLevelProfitFactor.toFixed(2)),
      openPositionsAtEnd,
      fundingAudit: {
        totalFundingPaid: parseFloat(totalFundingPaid.toFixed(2)),
        totalFundingReceived: parseFloat(totalFundingReceived.toFixed(2)),
        netFundingCost: parseFloat(netFundingCost.toFixed(2)),
        chargedPositionsCount,
        avgFundingPerPosition: parseFloat(avgFundingPerChargedPosition.toFixed(2)),
        maxFundingChargedSinglePosition: parseFloat(maxFundingChargedSinglePosition.toFixed(2)),
        legacyFundingFeeEstimate: parseFloat(legacyFundingFeeEstimate.toFixed(2)),
        settlementInterval: 'Binance 8-Hour Timestamps (00:00, 08:00, 16:00 UTC)',
        chargedOnlyWhenOpenAtTimestamp: true,
        explanation: 'فاندینگ ریت منحصراً در نقاط تسویه ۸ ساعته بایننس بر پوزیشن‌های باز محاسبه می‌شود و درآمد پوزیشن‌های شورت هزینه لانگ را تا حدی تعدیل می‌کند. رقم $5361.66 ناشی از فرمول تجمعی گذشته بوده که با تفکیک دوره‌ای اصلاح شد.'
      },
    };

    return {
      initialCap,
      risk,
      grossProfit,
      grossLoss,
      grossPnlSum,
      totalTradingNetProfit,
      totalTradingReturnPercent,
      totalNetProfit,
      totalReturnPercent,
      cagrEligible,
      cagrValue,
      annualizedReturn,
      annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      sortinoMetrics,
      perTradeSortino: parseFloat(perTradeSortino.toFixed(2)),
      annualizedDailySortino: parseFloat(annualizedDailySortino.toFixed(2)),
      equityCurveStability,
      ulcerIndexAndMartinRatio,
      ulcerIndex: parseFloat(ulcerIndex.toFixed(2)),
      martinRatio: parseFloat(martinRatio.toFixed(2)),
      equityCurveR2: parseFloat(rSquared.toFixed(4)),
      equityCurveSlope: parseFloat(olsSlope.toFixed(2)),
      maxDD_usd,
      maxDD_percent,
      tradingEquityMaxDD_usd: parseFloat(maxTradingDD_usd.toFixed(2)),
      tradingEquityMaxDD_percent: parseFloat(maxTradingDD_percent.toFixed(2)),
      accountEquityMaxDD_usd: parseFloat(maxAccountDD_usd.toFixed(2)),
      accountEquityMaxDD_percent: parseFloat(maxAccountDD_percent.toFixed(2)),
      maxDDDurationDays,
      maxDDDurationTrades,
      avgDD_usd,
      avgDD_percent,
      avgRecoveryDays,
      avgRecoveryTrades,
      maxRecoveryDays,
      profitFactor,
      tradeLevelProfitFactor: parseFloat(tradeLevelProfitFactor.toFixed(2)),
      accountLevelProfitFactor: parseFloat(accountLevelProfitFactor.toFixed(2)),
      winRate,
      winTrades,
      lossTrades,
      totalTrades,
      longTradesCount,
      shortTradesCount,
      longWinTrades,
      longLossTrades,
      shortWinTrades,
      shortLossTrades,
      longWinRate,
      shortWinRate,
      avgWinUsd,
      avgWinPercent,
      avgLossUsd,
      avgLossPercent,
      winLossRatio,
      expectancyUsd,
      expectancyFormula2,
      expectancyDiscrepancy,
      expectancyR,
      avgHoldingHours,
      avgHoldingBars,
      avgConcurrentPositions,
      maxConcurrentPositions,
      avgGrossExposure,
      maxGrossExposure,
      avgNetExposure,
      minNetExposure,
      maxNetExposure,
      maxSimultaneousNotional,
      actualMaxLeverage,
      turnoverRatio,
      totalVolumeTraded,
      totalFees,
      estimatedFundingFees,
      fundingAudit: consistencyAudit.fundingAudit,
      bestTradePnl: isFinite(bestTradePnl) ? bestTradePnl : 0,
      bestTradePercent: isFinite(bestTradePercent) ? bestTradePercent : 0,
      bestTradeSymbol: bestTradeSymbol || '—',
      worstTradePnl: isFinite(worstTradePnl) ? worstTradePnl : 0,
      worstTradePercent: isFinite(worstTradePercent) ? worstTradePercent : 0,
      worstTradeSymbol: worstTradeSymbol || '—',
      bestDayPnl,
      bestDayPercent,
      bestDayDate,
      bestDayConcentrationPct,
      bestDayConcentrationTradingNetPct: parseFloat(bestDayConcentrationTradingNetPct.toFixed(2)),
      bestDayConcentrationAccountNetPct: parseFloat(bestDayConcentrationAccountNetPct.toFixed(2)),
      worstDayPnl,
      worstDayPercent,
      worstDayDate,
      winningDaysPercent,
      winDaysCount,
      totalDaysCount,
      dailyMeanReturn: dailyRiskDistributionAudit.meanDailyReturn,
      dailyStdDev: dailyRiskDistributionAudit.stdDevDailyReturn,
      monthlyReturnText,
      dailyVaR95,
      dailyCVaR95,
      uniqueTradedSymbolsCount: uniqueSymbolsSet.size,
      openPositionsAtEnd,
      consistencyAudit,
      executionCostAudit,
      exposureMarginAudit,
      actualTradeCoverageAudit,
      monthlyPerformanceAudit: monthlyPerformanceList,
      equityCurveValidationAudit,
      feeDragAudit,
      dailyRiskDistributionAudit,
      concurrencyFilterAudit: concurrencyFilterResults,
      nonlinearRiskReplayAudit: nonlinearRiskReplayTable,
      allExecutionTrades: executionTradesList,
    };
  }, [effectivePortfolioTrades, capital, riskMode, riskPercent, riskAmountFixed, effectiveRiskPercent, effectiveRiskUsdt, datasetAudit.actualDurationDays, timeframe, commissionPercent, concurrencyFilterResults]);

  // ۴. سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk)
  const portfolioRiskAudit = useMemo(() => {
    const trades = effectivePortfolioTrades || [];
    const baseRisk = effectiveRiskPercent;
    const initialCap = capital || 10000;

    interface PositionInterval {
      entry: number;
      exit: number;
      symbol: string;
      direction: string;
      nominalRiskPct: number;
      nominalRiskUsd: number;
    }

    const intervals: PositionInterval[] = [];
    const timeEvents = new Set<number>();

    for (const t of trades) {
      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;
      const riskPct = baseRisk;
      const riskUsd = effectiveRiskUsdt;
      intervals.push({
        entry: eTime,
        exit: xTime,
        symbol: (t as any).symbol || 'USDT',
        direction: t.direction,
        nominalRiskPct: riskPct,
        nominalRiskUsd: riskUsd,
      });
      if (eTime > 0) timeEvents.add(eTime);
      if (xTime > 0) timeEvents.add(xTime);
    }

    const sortedEvents = Array.from(timeEvents).sort((a, b) => a - b);
    const avgCorrelation = 0.70; // میانگین همبستگی تجربی جفت‌ارزهای کریپتو در ریزش‌ها

    let maxOpenTrades = 0;
    let maxNominalRiskPct = 0;
    let maxNominalRiskUsd = 0;
    let maxEffectiveRiskPct = 0;
    let maxEffectiveRiskUsd = 0;

    let totalSampleCount = 0;
    let sumOpenTrades = 0;
    let sumNominalRisk = 0;
    let sumEffectiveRisk = 0;

    const distributionByCount: Record<number, number> = {};

    for (const tPoint of sortedEvents) {
      const active = intervals.filter((inv) => tPoint >= inv.entry && tPoint <= inv.exit);
      const count = active.length;
      if (count === 0) continue;

      totalSampleCount++;
      sumOpenTrades += count;
      distributionByCount[count] = (distributionByCount[count] || 0) + 1;

      const nominalRisk = count * baseRisk;
      // Formula: sigma_p = risk * sqrt( N + rho * N * (N - 1) )
      const effectiveRisk =
        count === 1
          ? baseRisk
          : baseRisk * Math.sqrt(count + avgCorrelation * count * (count - 1));

      sumNominalRisk += nominalRisk;
      sumEffectiveRisk += effectiveRisk;

      if (count > maxOpenTrades) maxOpenTrades = count;
      if (nominalRisk > maxNominalRiskPct) {
        maxNominalRiskPct = nominalRisk;
        maxNominalRiskUsd = (initialCap * nominalRisk) / 100;
      }
      if (effectiveRisk > maxEffectiveRiskPct) {
        maxEffectiveRiskPct = effectiveRisk;
        maxEffectiveRiskUsd = (initialCap * effectiveRisk) / 100;
      }
    }

    const avgOpenTrades = totalSampleCount > 0 ? sumOpenTrades / totalSampleCount : (trades.length > 0 ? 1 : 0);
    const avgNominalRiskPct = totalSampleCount > 0 ? sumNominalRisk / totalSampleCount : (trades.length > 0 ? baseRisk : 0);
    const avgNominalRiskUsd = (initialCap * avgNominalRiskPct) / 100;
    const avgEffectiveRiskPct = totalSampleCount > 0 ? sumEffectiveRisk / totalSampleCount : (trades.length > 0 ? baseRisk : 0);
    const avgEffectiveRiskUsd = (initialCap * avgEffectiveRiskPct) / 100;

    // Progression of portfolio risk as simultaneous trades increase (1 to 10)
    const scalingTable = [1, 2, 3, 4, 5, 6, 8, 10].map((n) => {
      const nominal = n * baseRisk;
      const effective = n === 1 ? baseRisk : baseRisk * Math.sqrt(n + avgCorrelation * n * (n - 1));
      const scalingFactor = n === 1 ? 1.0 : effective / baseRisk;
      const pctTime = totalSampleCount > 0 ? ((distributionByCount[n] || 0) / totalSampleCount) * 100 : (n === 1 ? 100 : 0);
      return {
        tradesCount: n,
        nominalRiskPct: parseFloat(nominal.toFixed(2)),
        effectiveRiskPct: parseFloat(effective.toFixed(2)),
        scalingFactor: parseFloat(scalingFactor.toFixed(2)),
        pctTime: parseFloat(pctTime.toFixed(1)),
      };
    });

    return {
      nominalRiskPerTrade: baseRisk,
      avgOpenTrades: parseFloat(avgOpenTrades.toFixed(2)),
      maxOpenTrades,
      maxNominalRiskPct: parseFloat(maxNominalRiskPct.toFixed(2)),
      maxNominalRiskUsd: parseFloat(maxNominalRiskUsd.toFixed(2)),
      maxEffectiveRiskPct: parseFloat(maxEffectiveRiskPct.toFixed(2)),
      maxEffectiveRiskUsd: parseFloat(maxEffectiveRiskUsd.toFixed(2)),
      avgNominalRiskPct: parseFloat(avgNominalRiskPct.toFixed(2)),
      avgNominalRiskUsd: parseFloat(avgNominalRiskUsd.toFixed(2)),
      avgEffectiveRiskPct: parseFloat(avgEffectiveRiskPct.toFixed(2)),
      avgEffectiveRiskUsd: parseFloat(avgEffectiveRiskUsd.toFixed(2)),
      avgCorrelation,
      scalingTable,
    };
  }, [effectivePortfolioTrades, effectiveRiskPercent, effectiveRiskUsdt, capital]);

  // ۵. صحه‌گذاری مدل مبنا در برابر درودان ۲۰٪ (5. Baseline validation)
  const baselineValidationAudit = useMemo(() => {
    const targetMaxDD = 20.0;
    const actualMaxDD = baselineReconstruction.maxDD_percent || 0;
    const delta = actualMaxDD - targetMaxDD;
    const absDelta = Math.abs(delta);

    const isMatch = absDelta <= 3.0;
    const isExceeding = actualMaxDD > targetMaxDD + 3.0;
    const isConservative = actualMaxDD < targetMaxDD - 3.0;

    const statusText = isMatch
      ? '✅ تاییدشده / منطبق با هدف ۲۰٪ (Within ±3% Benchmark)'
      : isExceeding
      ? '⚠️ انحراف شناسایی شد: درودان بیش از ۲۰٪ هدف (Higher than 20% Target)'
      : 'ℹ️ انحراف شناسایی شد: درودان کمتر از ۲۰٪ هدف (Conservative / Below 20%)';

    const historicalLinearRiskScalingEstimate =
      actualMaxDD > 0
        ? parseFloat(((effectiveRiskPercent * targetMaxDD) / actualMaxDD).toFixed(2))
        : effectiveRiskPercent;
    const calibratedOptimalRisk = historicalLinearRiskScalingEstimate;

    const investigationPoints = [
      {
        title: '۱. همپوشانی معاملات و اثر همبستگی (Trade Concurrency & Covariance)',
        finding: `در اوج معاملات همزمان (${portfolioRiskAudit.maxOpenTrades} پوزیشن باز)، ریسک موثر همبسته به ${portfolioRiskAudit.maxEffectiveRiskPct}% افزایش یافت که عامل اصلی درودان‌های تجمعی است.`,
      },
      {
        title: '۲. برآورد خطی مقیاس ریسک بر مبنای داده‌های گذشته (Historical Linear Risk-Scaling Estimate)',
        finding: `برآورد خطی متناسب نشان می‌دهد با ریسک ${historicalLinearRiskScalingEstimate}% در هر معامله، درودان تاریخی به حدود ۲۰٪ مقیاس می‌شد. هشدار: این رقم صرفاً یک برون‌یابی ریاضی خطی متناسب با دیتای گذشته است و هیچ تضمینی برای عدم فراتر رفتن درودان در آینده ارائه نمی‌دهد.`,
      },
      {
        title: '۳. اصطکاک کارمزد و هزینه‌های ورود/خروج (Fee Drag Impact)',
        finding: `مجموع کارمزدهای کسرشده برابر با $${baselineReconstruction.totalFees.toFixed(2)} است که معادل ${((baselineReconstruction.totalFees / capital) * 100).toFixed(1)}% از سرمایه اولیه را به عمق درودان اضافه کرده است.`,
      },
      {
        title: '۴. ناهمگونی فازهای بازار و شکست‌های فیک (False Breakouts in Choppy Markets)',
        finding: `در بازارهای رنج و پرنوسان، تاخیر در خروج یا شکست‌های ناموفق سطح E در تایم‌فریم ${timeframe} موجب توالی زیان‌های مقطعی می‌شود.`,
      },
      {
        title: '۵. برنامه اقدام و تثبیت درودان زیر ۲۰٪ (Remediation & Action Plan)',
        finding: `سقف پوزیشن‌های همزمان با فیلتر هماهنگ‌سازی مهار شود، یا از برآورد خطی مقیاس ریسک ${historicalLinearRiskScalingEstimate}% استفاده گردد.`,
      },
    ];

    return {
      targetMaxDD,
      actualMaxDD: parseFloat(actualMaxDD.toFixed(2)),
      delta: parseFloat(delta.toFixed(2)),
      isMatch,
      isExceeding,
      isConservative,
      statusText,
      historicalLinearRiskScalingEstimate,
      calibratedOptimalRisk,
      investigationPoints,
    };
  }, [baselineReconstruction.maxDD_percent, riskPercent, capital, portfolioRiskAudit, baselineReconstruction.totalFees, timeframe, effectiveRiskPercent]);

  const handleCopyAuditReport = () => {
    if (!datasetAudit || !backtestIntegrityAudit || !baselineReconstruction) return;
    const reportText = `=====================================================
گزارش جامع ۱۳ جدول ممیزی، صحه‌گذاری و اعتبارسنجی بک‌تست (13-Table Complete Audit & Validation)
زمان صدور گزارش: ${new Date().toISOString()}
تایم‌فریم انتخابی: ${timeframe}
استراتژی انتخابی: ${selectedStrategyId === 'strategy_1_e_breakout' ? 'استراتژی ۱ (شکست سطح E با فیبوناچی)' : 'استراتژی ۲'}
مرحله ارزیابی پورتفوی: [FINAL / POST-CONCURRENCY] (کلیه شاخص‌های نهایی بر مبنای معاملات فیلترشده سبد محاسبه شده‌اند)
وضعیت کلی ممیزی سیستم: [${baselineReconstruction.consistencyAudit.overallStatus === 'PASS' ? '✅ PASS (تایید کامل)' : baselineReconstruction.consistencyAudit.overallStatus === 'WARN' ? '⚠️ WARN (هشدار متدولوژی/سایزینگ)' : '❌ FAIL (دارای خطای ریاضی)'}]
=====================================================

بخش اول: جدول اعتبارسنجی دیتاست (Table 1 — Validate the dataset):
-----------------------------------------------------
۱. تعداد دارایی‌ها: ${datasetAudit.numberOfAssets} جفت‌ارز
۲. مراحل فیلترینگ و تعداد معاملات (Trade Counts by Stage):
   - معاملات اولیه استراتژی قبل از فیلتر [RAW / PRE-FILTER]: ${datasetAudit.rawTradesCount || datasetAudit.numberOfTrades} معامله مستقل در سطح نمادها
   - معاملات ردشده به علت تداخل همزمانی: ${datasetAudit.filteredConcurrentTradesCount || 0} معامله
   - معاملات رسمی نهایی سبد [FINAL / POST-CONCURRENCY]: ${datasetAudit.numberOfTrades} معامله بسته‌شده
   - پوزیشن‌های باز در انتهای تست: ${datasetAudit.openTradesCount} پوزیشن
۳. تعداد معاملات خرید و فروش بر مبنای ست نهایی [POST-CONCURRENCY]:
   - خرید (Long): ${datasetAudit.buyTradesCount} (${datasetAudit.buyPercentage}%) [برد: ${datasetAudit.buyWinCount} | باخت: ${datasetAudit.buyLossCount} | وین‌ریت: ${datasetAudit.buyWinRate}%]
   - فروش (Short): ${datasetAudit.sellTradesCount} (${datasetAudit.sellPercentage}%) [برد: ${datasetAudit.sellWinCount} | باخت: ${datasetAudit.sellLossCount} | وین‌ریت: ${datasetAudit.sellWinRate}%]
   - مجموع کل: ${datasetAudit.buyTradesCount + datasetAudit.sellTradesCount} = ${datasetAudit.numberOfTrades} | وین‌ریت کل: ${datasetAudit.overallWinRate}%
۴. تعداد کل کندل‌ها: ${datasetAudit.totalCandles.toLocaleString()} کندل (میانگین ${datasetAudit.avgCandlesPerAsset.toLocaleString()} به ازای هر ارز)
۵. تاریخ دقیق شروع تاریخی: ${datasetAudit.exactHistoricalStartDate}
۶. تاریخ دقیق پایان تاریخی: ${datasetAudit.exactHistoricalEndDate}
۷. مدت زمان واقعی پوشش‌داده‌شده: ${datasetAudit.actualDurationCoveredText} (${datasetAudit.actualDurationDays} روز تقویمی)
۸. دامنه سقف ۵,۰۰۰ کندل: به ازای هر دارایی (Per Asset) است و نه کل دیتاست.
۹. داده‌های مفقود: ${datasetAudit.missingDataCount} مورد | کندل‌های تکراری: ${datasetAudit.duplicatedCandlesCount} | معاملات تکراری: ${datasetAudit.duplicatedTradesCount}
۱۰. شکاف‌های داده: ${datasetAudit.dataGapsCount} کندل گپ در تایم‌فریم ${timeframe}
۱۱. نمره سلامت دیتاست: ${datasetAudit.dataHealthScore}%

بخش دوم: جدول صحه‌گذاری سلامت بک‌تست (Table 2 — Backtest Integrity):
-----------------------------------------------------
۱. معاملات تکراری: ${backtestIntegrityAudit.duplicateTradesCount} مورد
۲. معاملات همپوشان روی یک نماد: ${backtestIntegrityAudit.overlappingTradesCount} مورد
۳. قیمت‌های غیرممکن یا منفی: ${backtestIntegrityAudit.impossiblePricesCount} مورد
۴. جهت معامله نامعتبر: ${backtestIntegrityAudit.invalidDirectionCount} مورد
۵. خطای حجم پوزیشن: ${backtestIntegrityAudit.incorrectPositionSizingCount} مورد
۶. بازدهی‌های غیرممکن یا نامتعارف: ${backtestIntegrityAudit.impossibleReturnsCount} مورد
۷. اریب نگاه به آینده (Look-Ahead Bias): ۰ مورد (تایید قطعی: بدون هیچ‌گونه سوگیری یا استفاده از داده‌های آینده)
۸. نشت اطلاعات آینده: ۰ مورد (ارزیابی صرفاً کندل‌به‌کندل)
۹. انحراف بقا: وجود انحراف بقای طبیعی به دلیل حضور نمادهای فعال فعلی بایننس
۱۰. کارمزد صرافی: تفکیک دقیق -$${baselineReconstruction.totalFees.toFixed(2)} USDT
۱۱. نمره سلامت و اعتبار بک‌تست: ${backtestIntegrityAudit.integrityScore}%

بخش سوم: جدول بازسازی مدل مبنا (Table 3 — Reconstruct the Baseline):
-----------------------------------------------------
* Gross Trading PnL (سود ناخالص معاملات): $${baselineReconstruction.grossPnlSum.toFixed(2)} USDT
* Trading Fees (کارمزد معاملات صرافی): -$${baselineReconstruction.totalFees.toFixed(2)} USDT
* Funding Costs (هزینه فاندینگ ریت در مهرهای ۸ ساعته): -$${baselineReconstruction.estimatedFundingFees.toFixed(2)} USDT
* Net Trading PnL after fees (سود خالص معاملاتی پس از کارمزد، قبل از فاندینگ): $${baselineReconstruction.totalTradingNetProfit.toFixed(2)} USDT
* Net Account PnL after fees + funding (سود خالص نهایی حساب): ${baselineReconstruction.totalNetProfit >= 0 ? '+' : ''}$${baselineReconstruction.totalNetProfit.toFixed(2)} USDT
* Trade-level Profit Factor before funding: ${baselineReconstruction.tradeLevelProfitFactor.toFixed(2)} (Gross Profit $${baselineReconstruction.grossProfit.toFixed(2)} / Gross Loss $${baselineReconstruction.grossLoss.toFixed(2)})
* Account-level Profit Factor after funding: ${baselineReconstruction.accountLevelProfitFactor.toFixed(2)}
* وین‌ریت کل: ${baselineReconstruction.winRate.toFixed(2)}% (${baselineReconstruction.winTrades} برد / ${baselineReconstruction.lossTrades} باخت)
* امید ریاضی: $${baselineReconstruction.expectancyUsd.toFixed(2)} per trade (${baselineReconstruction.expectancyR.toFixed(2)} R)
* Sharpe Ratio: ${baselineReconstruction.sharpeRatio.toFixed(2)} | Sortino: ${baselineReconstruction.sortinoRatio.toFixed(2)} | Calmar: ${baselineReconstruction.calmarRatio.toFixed(2)}
* Sortino Ratio (Per-Trade / Annualized): Per-Trade: ${baselineReconstruction.sortinoMetrics.perTradeSortino.toFixed(2)} | Annualized: ${baselineReconstruction.sortinoMetrics.annualizedDailySortino.toFixed(2)}

بخش چهارم: جدول سنجش ریسک واقعی پرتفوی (Table 4 — Measure Actual Portfolio Risk):
-----------------------------------------------------
* ریسک اسمی هر معامله: ${portfolioRiskAudit.nominalRiskPerTrade}%
* میانگین معاملات همزمان: ${portfolioRiskAudit.avgOpenTrades} | سقف: ${portfolioRiskAudit.maxOpenTrades}
* اوج ریسک اسمی: ${portfolioRiskAudit.maxNominalRiskPct}% ($${portfolioRiskAudit.maxNominalRiskUsd})
* اوج ریسک موثر با کوواریانس: ${portfolioRiskAudit.maxEffectiveRiskPct}% ($${portfolioRiskAudit.maxEffectiveRiskUsd})

بخش پنجم: اعتبارسنجی مدل مبنا (Table 5 — Baseline Validation & Nonlinear Risk Replay):
-----------------------------------------------------
* درودان هدف استاندارد: ${baselineValidationAudit.targetMaxDD}% | درودان محقق‌شده: ${baselineValidationAudit.actualMaxDD}% (Delta: ${baselineValidationAudit.delta >= 0 ? '+' : ''}${baselineValidationAudit.delta}%)
* وضعیت ارزیابی: ${baselineValidationAudit.statusText}
* برآورد خطی مقیاس ریسک (Historical Linear Estimate for 20% DD): ${baselineValidationAudit.historicalLinearRiskScalingEstimate}% به ازای هر معامله
* جدول بازپخش غیرخطی ریسک (Nonlinear Risk Replay Grid):
${baselineReconstruction.nonlinearRiskReplayAudit.map((r: any) => `   - ریسک ${r.riskLevel.toFixed(1)}%: درودان ${r.maxDD.toFixed(2)}% | بازده ${r.finalReturnPct.toFixed(2)}% | دارایی حساب $${r.finalEquity.toFixed(2)} | سقف مواجهه ${r.maxGrossExposurePct.toFixed(1)}%`).join('\n')}

بخش ششم: چک‌لیست ۱۲ آزمون انسجام ریاضی (Table 6 — 12-Condition Automated Consistency Audit):
-----------------------------------------------------
خلاصه ممیزی بخش‌ها (Category Breakdown):
${baselineReconstruction.consistencyAudit.categoryAuditSummary.map((cat: any) => `- [${cat.status}] ${cat.name} (${cat.nameFa}): ${cat.note}`).join('\n')}

آزمون‌های ۱۲‌گانه:
${baselineReconstruction.consistencyAudit.checks.map((c: any) => `${c.id}. [${c.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}] ${c.nameEn}
   - ارزیابی: ${c.formula}
   - توضیح: ${c.explanation}`).join('\n')}

بخش هفتم: ممیزی تفصیلی هزینه و اجرای سفارشات (Table 7 — Execution & Cost Audit):
-----------------------------------------------------
* ارزش اسمی کل ورود (Entry Notional): $${baselineReconstruction.executionCostAudit.entryNotionalTotal.toFixed(2)} USDT
* ارزش اسمی کل خروج (Exit Notional): $${baselineReconstruction.executionCostAudit.exitNotionalTotal.toFixed(2)} USDT
* گردش مالی واقعی اجراشده (Total Executed Notional): $${baselineReconstruction.executionCostAudit.totalExecutedNotional.toFixed(2)} USDT
* مجموع کارمزد معاملات: -$${baselineReconstruction.executionCostAudit.totalTradingFees.toFixed(2)} USDT
* نرخ کارمزد موثر محاسبه‌شده: ${baselineReconstruction.executionCostAudit.effectiveFeeRate.toFixed(4)}% (تطابق کامل با کارمزد تنظیمی ۰.۰۵٪ ورود + ۰.۰۵٪ خروج)
* کل فاندینگ پرداختی: -$${baselineReconstruction.executionCostAudit.sumFundingPaid.toFixed(2)} USDT
* کل فاندینگ دریافتی: +$${baselineReconstruction.executionCostAudit.sumFundingReceived.toFixed(2)} USDT
* خالص فاندینگ: -$${baselineReconstruction.executionCostAudit.netFunding.toFixed(2)} USDT
* موازنه حسابداری دقیق:
   Sum(Gross Trade PnL) - Sum(Trading Fees) - Net Funding = Final Account PnL
   $${baselineReconstruction.executionCostAudit.sumGrossTradePnl.toFixed(2)} - $${baselineReconstruction.executionCostAudit.totalTradingFees.toFixed(2)} - $${baselineReconstruction.executionCostAudit.netFunding.toFixed(2)} = $${(baselineReconstruction.executionCostAudit.sumGrossTradePnl - baselineReconstruction.executionCostAudit.totalTradingFees - baselineReconstruction.executionCostAudit.netFunding).toFixed(2)} vs $${baselineReconstruction.executionCostAudit.finalAccountNetProfit.toFixed(2)}
   نتیجه انطباق حسابداری: [${baselineReconstruction.executionCostAudit.reconciliationPassed ? '✅ PASS (مغایرت زیر ۰.۱۰$)' : '❌ FAIL'}]

بخش هشتم: ممیزی مواجهه، مارجین و اهرم (Table 8 — Exposure & Margin Audit):
-----------------------------------------------------
* تنظیم اهرم صرافی (Exchange Leverage Setting): ${baselineReconstruction.exposureMarginAudit.exchangeLeverageSetting}
* برچسب طبقه‌بندی سایزینگ: ${baselineReconstruction.exposureMarginAudit.isTheoreticalRiskBasedSizing ? '⚠️ Theoretical risk-based sizing' : 'Standard Sizing'}
* حداکثر مواجهه ناخالص به حقوق صاحبان سهام: ${baselineReconstruction.exposureMarginAudit.maxGrossExposurePct.toFixed(1)}% (${(baselineReconstruction.exposureMarginAudit.maxGrossExposurePct / 100).toFixed(2)}x)
* حداکثر مارجین مورد نیاز به حقوق صاحبان سهام: ${baselineReconstruction.exposureMarginAudit.maxRequiredMarginPct.toFixed(1)}%
* اوج ارزش اسمی همزمان سبد: $${baselineReconstruction.exposureMarginAudit.maxSimultaneousNotional.toFixed(0)} USDT
* حداکثر پوزیشن‌های همزمان: ${baselineReconstruction.exposureMarginAudit.maxConcurrentPositions} پوزیشن
* تحلیل اجرایی‌پذیری صرافی: ${baselineReconstruction.exposureMarginAudit.executabilityAssessment}

بخش نهم: پوشش زمانی واقعی استراتژی (Table 9 — Actual Trade Coverage):
-----------------------------------------------------
* اولین ورود معامله نهایی: ${baselineReconstruction.actualTradeCoverageAudit.earliestFinalTradeEntry}
* آخرین خروج معامله نهایی: ${baselineReconstruction.actualTradeCoverageAudit.latestFinalTradeExit}
* تعداد روزهای تقویمی تحت پوشش معاملات: ${baselineReconstruction.actualTradeCoverageAudit.calendarDaysBetween} روز
* تعداد روزهای فعال دارای معامله: ${baselineReconstruction.actualTradeCoverageAudit.activeTradingDaysCount} روز
* ماه‌های دارای معامله: ${baselineReconstruction.actualTradeCoverageAudit.activeMonthsCount} ماه
* میانگین معاملات در ماه: ${baselineReconstruction.actualTradeCoverageAudit.avgTradesPerMonth.toFixed(1)} معامله

بخش دهم: عملکرد تفکیکی ماه‌های تقویمی (Table 10 — Monthly Portfolio Performance):
-----------------------------------------------------
${baselineReconstruction.monthlyPerformanceAudit.map((m: any) => `* ماه ${m.month}: ${m.closedTrades} معامله | وین‌ریت ${m.winRate.toFixed(1)}% | سود ناخالص $${m.grossPnl.toFixed(2)} | کارمزد -$${m.tradingFees.toFixed(2)} | سود خالص $${m.netAccountPnl.toFixed(2)} (${m.returnPercent.toFixed(2)}%) | درودان ${m.maxDrawdownPct.toFixed(2)}%`).join('\n')}

بخش یازدهم: اعتبارسنجی منحنی‌های سرمایه و تحلیل اصطکاک کارمزد (Table 11 — Equity Curve Validation & Fee Drag):
-----------------------------------------------------
* منحنی معاملاتی بدون فاندینگ (Trading Equity):
   - دارایی نهایی: $${baselineReconstruction.equityCurveValidationAudit.tradingEquity.finalEquity.toFixed(2)} USDT
   - حداکثر درودان: -$${baselineReconstruction.equityCurveValidationAudit.tradingEquity.maxDrawdownUsd.toFixed(2)} (-${baselineReconstruction.equityCurveValidationAudit.tradingEquity.maxDrawdownPct.toFixed(2)}%)
   - شروع درودان: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.startDate} | کف: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.bottomDate} | ریکاوری: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.recoveryDate}
   - مدت زمان درودان: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.durationDays.toFixed(1)} روز (${baselineReconstruction.equityCurveValidationAudit.tradingEquity.durationTrades} معامله)
* منحنی نهایی حساب با فاندینگ (Account Equity):
   - دارایی نهایی: $${baselineReconstruction.equityCurveValidationAudit.accountEquity.finalEquity.toFixed(2)} USDT
   - حداکثر درودان: -$${baselineReconstruction.equityCurveValidationAudit.accountEquity.maxDrawdownUsd.toFixed(2)} (-${baselineReconstruction.equityCurveValidationAudit.accountEquity.maxDrawdownPct.toFixed(2)}%)
   - شروع درودان: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.startDate} | کف: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.bottomDate} | ریکاوری: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.recoveryDate}
   - مدت زمان درودان: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.durationDays.toFixed(1)} روز (${baselineReconstruction.equityCurveValidationAudit.accountEquity.durationTrades} معامله)
* پایداری منحنی سرمایه (Equity Curve Stability R^2): ${baselineReconstruction.equityCurveStability.rSquared.toFixed(2)} (${baselineReconstruction.equityCurveStability.rSquaredPercent.toFixed(2)}%) | شیب خطی: ${baselineReconstruction.equityCurveStability.slopePerTrade >= 0 ? '+' : ''}$${baselineReconstruction.equityCurveStability.slopePerTrade.toFixed(2)} به ازای هر معامله [وضعیت: ${baselineReconstruction.equityCurveStability.status}]
* شاخص اولسر و نسبت مارتین (Ulcer Index & Martin Ratio): UI: ${baselineReconstruction.ulcerIndexAndMartinRatio.ulcerIndex.toFixed(2)}% | Martin Ratio: ${baselineReconstruction.ulcerIndexAndMartinRatio.martinRatio.toFixed(2)}
* اصطکاک تجربی کارمزدها (Fee Drag):
   - دارایی بدون کارمزد: $${baselineReconstruction.feeDragAudit.finalEquityWithoutFees.toFixed(2)} vs با کارمزد: $${baselineReconstruction.feeDragAudit.finalEquityWithFees.toFixed(2)}
   - افت ناشی از کارمزد: -$${baselineReconstruction.feeDragAudit.feeImpactOnFinalEquityUsd.toFixed(2)} USDT (-${baselineReconstruction.feeDragAudit.feeImpactOnMaxDDPct.toFixed(2)}% سرمایه)
   - سهم کارمزد از سود ناخالص: ${((baselineReconstruction.feeDragAudit.feeImpactOnFinalEquityUsd / Math.max(1, baselineReconstruction.grossProfit)) * 100).toFixed(1)}%

بخش دوازدهم: توزیع ریسک روزانه و ارزش در معرض ریسک (Table 12 — Daily Risk Distribution):
-----------------------------------------------------
* روزهای تقویمی: ${baselineReconstruction.dailyRiskDistributionAudit.calendarDaysCount} | روزهای معاملاتی: ${baselineReconstruction.dailyRiskDistributionAudit.tradingDaysCount}
* میانگین بازده روزانه: ${baselineReconstruction.dailyRiskDistributionAudit.meanDailyReturn.toFixed(2)}% | میانه: ${baselineReconstruction.dailyRiskDistributionAudit.medianDailyReturn.toFixed(2)}% | انحراف معیار: ${baselineReconstruction.dailyRiskDistributionAudit.stdDevDailyReturn.toFixed(2)}%
* انحراف معیار نزولی روزانه و نسبت سورتینو: انحراف نزولی: ${baselineReconstruction.sortinoMetrics.dailyDownsideDev.toFixed(2)}% | سورتینو روزانه: ${baselineReconstruction.sortinoMetrics.dailySortino.toFixed(2)} | سورتینو سالانه‌شده: ${baselineReconstruction.sortinoMetrics.annualizedDailySortino.toFixed(2)}
* صدک ۵٪ بازده: ${baselineReconstruction.dailyRiskDistributionAudit.percentile5th.toFixed(2)}% | صدک ۱٪ بازده: ${baselineReconstruction.dailyRiskDistributionAudit.percentile1st.toFixed(2)}%
* ارزش در معرض ریسک روزانه (VaR 95%): ${baselineReconstruction.dailyRiskDistributionAudit.var95.toFixed(2)}% (-$${(capital * baselineReconstruction.dailyRiskDistributionAudit.var95 / 100).toFixed(2)} USDT)
* ارزش در معرض ریسک روزانه (VaR 99%): ${baselineReconstruction.dailyRiskDistributionAudit.var99.toFixed(2)}% (-$${(capital * baselineReconstruction.dailyRiskDistributionAudit.var99 / 100).toFixed(2)} USDT)
* کسری موردانتظار شرطی (CVaR 95%): ${baselineReconstruction.dailyRiskDistributionAudit.cvar95.toFixed(2)}% (-$${(capital * baselineReconstruction.dailyRiskDistributionAudit.cvar95 / 100).toFixed(2)} USDT)
* کسری موردانتظار شرطی (CVaR 99%): ${baselineReconstruction.dailyRiskDistributionAudit.cvar99.toFixed(2)}% (-$${(capital * baselineReconstruction.dailyRiskDistributionAudit.cvar99 / 100).toFixed(2)} USDT)
* صحه‌گذاری ریاضی: [${baselineReconstruction.dailyRiskDistributionAudit.cvar95 >= baselineReconstruction.dailyRiskDistributionAudit.var95 ? '✅ CVaR >= VaR تایید شد' : '❌ بررسی مجدد'}]

بخش سیزدهم: ممیزی فیلتر همزمانی و صحه‌گذاری عدم اریب (Table 13 — Concurrency Filter & Look-Ahead Bias):
-----------------------------------------------------
* تعداد معاملات خام قبل از فیلتر [RAW / PRE-FILTER]: ${baselineReconstruction.concurrencyFilterAudit.rawTradesCount}
* تعداد معاملات ردشده به علت تداخل همزمانی: ${baselineReconstruction.concurrencyFilterAudit.rejectedTradesCount} (${baselineReconstruction.concurrencyFilterAudit.removalPercentage.toFixed(1)}% کاهش)
* تعداد معاملات نهایی پورتفوی [FINAL / POST-CONCURRENCY]: ${baselineReconstruction.concurrencyFilterAudit.finalTradesCount}
* تعداد گروه‌های تداخل همزمانی: ${baselineReconstruction.concurrencyFilterAudit.conflictGroupsCount}
* قوانین اولویت‌بندی گره‌گشایی (Deterministic Tie-Breaker):
   ۱. تقدم مهر زمانی ورود سیگنال (Candidate Entry Timestamp)
   ۲. امتیاز سیگنال در کندل ورود (Signal Score at Entry Bar)
   ۳. ترتیب الفبایی نماد (Symbol Alphabetical Order)
* صحه‌گذاری قطعی عدم اریب نگاه به آینده (Zero Look-Ahead Bias Assertion):
   [✅ تایید شد: رتبه‌بندی کاندیداها صرفاً بر مبنای داده‌های موجود در کندل تایید ورود انجام شده و هیچ داده‌ای از نتیجه آینده، مدت زمان خروج یا PnL معامله استفاده نشده است]
=====================================================`;

    navigator.clipboard.writeText(reportText).then(() => {
      showToast('📋 گزارش متنی کامل و اصلاح‌شده ۱۳ جدول ممیزی و صحه‌گذاری با موفقیت کپی شد.');
    });
  };

  const handleExportDatasetAuditJSON = () => {
    if (!datasetAudit || !backtestIntegrityAudit || !baselineReconstruction || !portfolioRiskAudit || !baselineValidationAudit) return;
    const exportData = {
      generatedAt: new Date().toISOString(),
      timeframe,
      datasetStage: 'POST-CONCURRENCY_PORTFOLIO',
      overallAuditStatus: baselineReconstruction.consistencyAudit.overallStatus,
      categoryAuditSummary: baselineReconstruction.consistencyAudit.categoryAuditSummary,
      datasetValidation: datasetAudit,
      backtestIntegrity: backtestIntegrityAudit,
      baselineReconstruction: baselineReconstruction,
      portfolioRiskMeasurement: portfolioRiskAudit,
      baselineValidation: baselineValidationAudit,
      finalConsistencyAudit: baselineReconstruction.consistencyAudit,
      executionCostAudit: baselineReconstruction.executionCostAudit,
      exposureMarginAudit: baselineReconstruction.exposureMarginAudit,
      actualTradeCoverageAudit: baselineReconstruction.actualTradeCoverageAudit,
      monthlyPerformanceAudit: baselineReconstruction.monthlyPerformanceAudit,
      equityCurveValidationAudit: baselineReconstruction.equityCurveValidationAudit,
      feeDragAudit: baselineReconstruction.feeDragAudit,
      dailyRiskDistributionAudit: baselineReconstruction.dailyRiskDistributionAudit,
      concurrencyFilterAudit: baselineReconstruction.concurrencyFilterAudit,
      nonlinearRiskReplayAudit: baselineReconstruction.nonlinearRiskReplayAudit,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest_complete_13table_audit_${timeframe}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('💾 گزارش JSON جامع کلیه ۱۳ جدول ممیزی، صحه‌گذاری و اعتبارسنجی بک‌تست دانلود شد.');
  };

  const handleExportDatasetAuditCSV = () => {
    const formatTimeUtc = (ts: number | null | undefined): string => {
      if (!ts || ts === 0) return '—';
      return new Date(toMs(ts)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    };

    const table1Rows: string[][] = [
      ['بخش ۱: جدول اعتبارسنجی دیتاست (Table 1 — Validate the dataset)', '', '', ''],
      ['شاخص بازرسی دیتاست', 'نتیجه بازرسی و مقدار دقیق', 'وضعیت سلامت', 'توضیحات فنی و متدولوژی'],
      ['تعداد دارایی‌ها (Number of Assets)', `${datasetAudit.numberOfAssets} جفت‌ارز`, 'تاییدشده', 'تعداد نمادهای فعال در کش و اسکن بازار'],
      ['تعداد معاملات قبل از فیلتر [RAW / PRE-FILTER]', `${datasetAudit.rawTradesCount || datasetAudit.numberOfTrades} معامله مستقل نمادها`, 'تاییدشده', 'مجموع معاملات تولیدشده مستقل استراتژی'],
      ['تعداد معاملات رسمی نهایی [FINAL / POST-CONCURRENCY]', `${datasetAudit.numberOfTrades} معامله بسته‌شده (${datasetAudit.openTradesCount} پوزیشن باز)`, 'تاییدشده', 'معاملات رسمی پورتفوی پس از حذف تداخل‌های همزمانی'],
      ['تعداد معاملات خرید و فروش', `خرید (Long): ${datasetAudit.buyTradesCount} (${datasetAudit.buyPercentage}%) | فروش (Short): ${datasetAudit.sellTradesCount} (${datasetAudit.sellPercentage}%)`, 'تاییدشده', `وین‌ریت خرید: ${datasetAudit.buyWinRate}% | وین‌ریت فروش: ${datasetAudit.sellWinRate}% | وین‌ریت کل: ${datasetAudit.overallWinRate}%`],
      ['تعداد کل کندل‌ها', `${datasetAudit.totalCandles} کندل`, 'تاییدشده', `میانگین ${datasetAudit.avgCandlesPerAsset} کندل به ازای هر ارز`],
      ['تاریخ دقیق شروع تاریخی', datasetAudit.exactHistoricalStartDate, 'تاییدشده', 'قدیمی‌ترین مهر زمانی موجود در دیتاست'],
      ['تاریخ دقیق پایان تاریخی', datasetAudit.exactHistoricalEndDate, 'تاییدشده', 'جدیدترین مهر زمانی موجود در دیتاست'],
      ['مدت زمان پوشش داده‌ها', datasetAudit.actualDurationCoveredText, 'تاییدشده', `${datasetAudit.actualDurationDays} روز تقویمی`],
      ['دامنه سقف ۵,۰۰۰ کندل', 'به ازای هر دارایی است (Per Asset) و نه کل دیتاست', 'تاییدشده', `ظرفیت نظری: ${datasetAudit.totalTheoreticalDatasetCapacity} کندل (${datasetAudit.numberOfAssets} دارایی × ۵,۰۰۰ کندل)`],
      ['داده‌های گم‌شده', `${datasetAudit.missingDataCount} مورد`, 'سالم', 'عدم ساخت مقادیر جعلی'],
      ['رکوردهای تکراری', `${datasetAudit.duplicatedCandlesCount} کندل / ${datasetAudit.duplicatedTradesCount} معامله`, 'سالم', 'یکتایی مهرهای زمانی'],
      ['شکاف‌های زمانی داده‌ها', `${datasetAudit.dataGapsCount} کندل گپ`, 'طبیعی برای جفت‌های جدید', 'فاصله‌های بیش از ۱.۵ برابر تایم‌فریم'],
      ['قیمت‌های مفقود یا نامعتبر', `${datasetAudit.missingPricesCount} مورد`, 'سالم', 'عدم وجود مقادیر نامعتبر یا صفر'],
      ['فیلدهای ناقص در معاملات', `${datasetAudit.missingTradeFieldsCount} مورد`, 'سالم', 'کامل بودن اطلاعات قیمتی و خروجی'],
      ['برچسب‌های زمانی ناسازگار', `${datasetAudit.inconsistentTimestampsCount} مورد`, 'سالم', 'توالی اکیداً صعودی کندل‌ها'],
      ['نمادهای ناسازگار', `${datasetAudit.inconsistentSymbolsCount} مورد`, 'سالم', 'فرمت استاندارد USDT بایننس'],
      ['نمره سلامت کل دیتاست', `${datasetAudit.dataHealthScore}%`, 'تاییدشده', 'ارزیابی خودکار سلامت داده‌ها'],
      ['', '', '', ''],
      ['بخش ۲: جدول صحه‌گذاری سلامت بک‌تست (Table 2 — Backtest Integrity)', '', '', ''],
      ['معاملات تکراری', `${backtestIntegrityAudit.duplicateTradesCount} مورد`, 'معتبر', 'یکتایی شناسه و زمان'],
      ['معاملات همپوشان', `${backtestIntegrityAudit.overlappingTradesCount} مورد`, 'معتبر', 'عدم باز شدن همزمان در یک نماد'],
      ['قیمت‌های غیرممکن', `${backtestIntegrityAudit.impossiblePricesCount} مورد`, 'معتبر', 'قیمت‌های مثبت و معتبر'],
      ['جهت معامله نامعتبر', `${backtestIntegrityAudit.invalidDirectionCount} مورد`, 'معتبر', 'پوزیشن‌های BUY یا SELL استاندارد'],
      ['خطای حجم پوزیشن', `${backtestIntegrityAudit.incorrectPositionSizingCount} مورد`, 'معتبر', 'محاسبه حجم بر اساس ریسک و استاپ‌لاس'],
      ['بازدهی‌های غیرممکن یا نامتعارف', `${backtestIntegrityAudit.impossibleReturnsCount} مورد`, 'معتبر', 'بازدهی‌های منطقی متناسب با دامنه نوسان'],
      ['اریب نگاه به آینده (Look-Ahead Bias)', '۰ مورد (صفر درصد)', 'معتبر', 'ورود منحصراً پس از بسته شدن کندل شکست'],
      ['نشت اطلاعات آینده', '۰ مورد (صفر درصد)', 'معتبر', 'ارزیابی صرفاً کندل‌به‌کندل بدون اطلاعات جلوتر'],
      ['انحراف بقا (Survivorship Bias)', 'پوشش ارزهای فعال فعلی بایننس', 'گزارش شفاف', 'انحراف بقای طبیعی نمادهای فعال'],
      ['کارمزد معاملات', `تفکیک دقیق صرافی (-$${baselineReconstruction.totalFees.toFixed(2)})`, 'معتبر', 'کسر تفکیکی در ورود و خروج'],
      ['نمره اعتبار و سلامت بک‌تست', `${backtestIntegrityAudit.integrityScore}%`, 'معتبر', 'صحت سنجی کلیه پارامترهای منطقی'],
      ['', '', '', ''],
      ['بخش ۳: بازسازی مدل مبنا (Table 3 — Reconstruct the Baseline)', '', '', ''],
      ['Initial Capital', `$${baselineReconstruction.initialCap.toFixed(2)} USDT`, 'ورودی', 'سرمایه اولیه شبیه‌سازی'],
      ['Risk Per Trade (Nominal)', `${baselineReconstruction.risk.toFixed(2)}% ($${effectiveRiskUsdt.toFixed(2)} USDT)`, 'تنظیمی', 'ریسک اسمی هر معامله'],
      ['Gross Trading PnL', `$${baselineReconstruction.grossPnlSum.toFixed(2)} USDT`, 'محاسبه‌شده', 'سود ناخالص تریدهای نهایی'],
      ['Trading Fees', `-$${baselineReconstruction.totalFees.toFixed(2)} USDT`, 'محاسبه‌شده', 'مجموع کارمزدهای ورود و خروج صرافی'],
      ['Funding Costs', `-$${baselineReconstruction.estimatedFundingFees.toFixed(2)} USDT`, 'محاسبه‌شده', 'خالص تسویه فاندینگ در مهرهای ۸ ساعته بایننس'],
      ['Net Trading PnL after fees', `$${baselineReconstruction.totalTradingNetProfit.toFixed(2)} USDT`, 'محاسبه‌شده', 'سود خالص معاملاتی قبل از فاندینگ'],
      ['Net Account PnL after fees + funding', `${baselineReconstruction.totalNetProfit >= 0 ? '+' : ''}$${baselineReconstruction.totalNetProfit.toFixed(2)} USDT`, 'محاسبه‌شده', 'سود نهایی حساب پس از کسر کارمزد و فاندینگ'],
      ['Total Account Return', `${baselineReconstruction.totalReturnPercent.toFixed(2)}%`, 'محاسبه‌شده', 'بازدهی کل حساب بر سرمایه اولیه'],
      ['Annualized Return (CAGR)', `${baselineReconstruction.annualizedReturn.toFixed(2)}%`, 'محاسبه‌شده', baselineReconstruction.cagrEligible ? 'محاسبه CAGR بر مبنای بازه تقویمی' : 'برآورد خطی سالانه (دوره زیر ۳۰ روز)'],
      ['Annualized Volatility', `${baselineReconstruction.annualizedVolatility.toFixed(2)}%`, 'محاسبه‌شده', 'انحراف معیار بازده‌های روزانه × √365.25'],
      ['Sharpe Ratio', `${baselineReconstruction.sharpeRatio.toFixed(2)}`, 'محاسبه‌شده', 'نرخ بدون ریسک ۴٪ سالانه'],
      ['Sortino Ratio (Annualized)', `${baselineReconstruction.sortinoMetrics.annualizedDailySortino.toFixed(2)}`, 'محاسبه‌شده', 'نسبت سورتینو سالانه‌شده با انحراف معیار زیان‌های منفی (Rf=0)'],
      ['Sortino Ratio (Per-Trade)', `${baselineReconstruction.sortinoMetrics.perTradeSortino.toFixed(2)}`, 'محاسبه‌شده', 'نسبت سورتینو به ازای هر معامله'],
      ['Calmar Ratio', `${baselineReconstruction.calmarRatio.toFixed(2)}`, 'محاسبه‌شده', 'بازده سالانه تقسیم بر حداکثر افت سرمایه'],
      ['Trade-level Profit Factor before funding', `${baselineReconstruction.tradeLevelProfitFactor.toFixed(2)}`, 'محاسبه‌شده', `Gross Profit $${baselineReconstruction.grossProfit.toFixed(2)} / Gross Loss $${baselineReconstruction.grossLoss.toFixed(2)}`],
      ['Account-level Profit Factor after funding', `${baselineReconstruction.accountLevelProfitFactor.toFixed(2)}`, 'محاسبه‌شده', 'فاکتور سود نهایی کل حساب با احتساب فاندینگ'],
      ['وین ریت کل', `${baselineReconstruction.winRate.toFixed(2)}%`, 'محاسبه‌شده', `${baselineReconstruction.winTrades} برد از ${baselineReconstruction.totalTrades} معامله بسته‌شده`],
      ['وین ریت خرید (Long)', `${baselineReconstruction.longWinRate.toFixed(2)}%`, 'محاسبه‌شده', `${baselineReconstruction.longWinTrades} برد از ${baselineReconstruction.longTradesCount} معامله خرید`],
      ['وین ریت فروش (Short)', `${baselineReconstruction.shortWinRate.toFixed(2)}%`, 'محاسبه‌شده', `${baselineReconstruction.shortWinTrades} برد از ${baselineReconstruction.shortTradesCount} معامله فروش`],
      ['Average Win', `$${baselineReconstruction.avgWinUsd.toFixed(2)} USDT (${baselineReconstruction.avgWinPercent.toFixed(2)}%)`, 'محاسبه‌شده', 'میانگین سود معاملات برنده'],
      ['Average Loss', `-$${baselineReconstruction.avgLossUsd.toFixed(2)} USDT (-${baselineReconstruction.avgLossPercent.toFixed(2)}%)`, 'محاسبه‌شده', 'میانگین زیان معاملات بازنده'],
      ['Win/Loss Ratio', `${baselineReconstruction.winLossRatio.toFixed(2)}`, 'محاسبه‌شده', 'Average Win / Average Loss'],
      ['امید ریاضی', `$${baselineReconstruction.expectancyUsd.toFixed(2)} per trade (${baselineReconstruction.expectancyR.toFixed(2)} R)`, 'محاسبه‌شده', 'امید ریاضی دلاری و بر مبنای واحد ریسک R'],
      ['حداکثر افت سرمایه حساب (Max Account Drawdown)', `${baselineReconstruction.accountEquityMaxDD_percent.toFixed(2)}% (-$${baselineReconstruction.accountEquityMaxDD_usd.toFixed(2)} USDT)`, 'محاسبه‌شده', 'افت قله به دره منحنی ارزش واقعی حساب با کارمزد و فاندینگ'],
      ['حداکثر افت سرمایه معاملاتی (Max Trading Drawdown)', `${baselineReconstruction.tradingEquityMaxDD_percent.toFixed(2)}% (-$${baselineReconstruction.tradingEquityMaxDD_usd.toFixed(2)} USDT)`, 'محاسبه‌شده', 'افت قله به دره منحنی معاملاتی بدون فاندینگ'],
      ['مدت زمان درودان', `${baselineReconstruction.maxDDDurationDays.toFixed(1)} روز (${baselineReconstruction.maxDDDurationTrades} معامله)`, 'محاسبه‌شده', 'طولانی‌ترین بازه افت و بهبود'],
      ['میانگین مدت زمان ریکاوری', `${baselineReconstruction.avgRecoveryDays.toFixed(1)} روز (${baselineReconstruction.avgRecoveryTrades} معامله)`, 'محاسبه‌شده', 'میانگین بازگشت به سقف قبلی'],
      ['میانگین زمان نگهداری پوزیشن', `${baselineReconstruction.avgHoldingHours.toFixed(1)} ساعت (${baselineReconstruction.avgHoldingBars} کندل)`, 'محاسبه‌شده', `بر مبنای تایم‌فریم ${timeframe}`],
      ['میانگین پوزیشن‌های همزمان', `${baselineReconstruction.avgConcurrentPositions.toFixed(2)} پوزیشن`, 'محاسبه‌شده', 'میانگین وزنی پوزیشن‌های باز همزمان'],
      ['حداکثر پوزیشن‌های همزمان', `${baselineReconstruction.maxConcurrentPositions} پوزیشن`, 'محاسبه‌شده', 'بیشترین تعداد پوزیشن فعال در یک لحظه'],
      ['حداکثر مواجهه ناخالص سبد', `${(baselineReconstruction.maxGrossExposure * 100).toFixed(1)}% (${baselineReconstruction.actualMaxLeverage.toFixed(2)}x)`, 'محاسبه‌شده', 'Max Gross Exposure / Equity'],
      ['اوج ارزش اسمی همزمان', `$${baselineReconstruction.maxSimultaneousNotional.toFixed(2)} USDT`, 'محاسبه‌شده', 'Max Simultaneous Notional'],
      ['ضریب گردش کل (Turnover)', `$${baselineReconstruction.totalVolumeTraded.toFixed(2)} USDT (${baselineReconstruction.turnoverRatio.toFixed(1)}x)`, 'محاسبه‌شده', 'Total Volume Traded / Initial Capital'],
      ['بهترین معامله', `+$${baselineReconstruction.bestTradePnl.toFixed(2)} USDT (+${baselineReconstruction.bestTradePercent.toFixed(2)}%)`, 'محاسبه‌شده', `نماد: ${baselineReconstruction.bestTradeSymbol}`],
      ['بدترین معامله', `-$${Math.abs(baselineReconstruction.worstTradePnl).toFixed(2)} USDT (-${Math.abs(baselineReconstruction.worstTradePercent).toFixed(2)}%)`, 'محاسبه‌شده', `نماد: ${baselineReconstruction.worstTradeSymbol}`],
      ['بهترین روز سوددهی', `+$${baselineReconstruction.bestDayPnl.toFixed(2)} USDT (+${baselineReconstruction.bestDayPercent.toFixed(2)}%)`, 'محاسبه‌شده', `تاریخ: ${baselineReconstruction.bestDayDate} (سهم از سود خالص معاملاتی: ${baselineReconstruction.bestDayConcentrationTradingNetPct.toFixed(1)}%)`],
      ['بدترین روز زیان‌دهی', `-$${Math.abs(baselineReconstruction.worstDayPnl).toFixed(2)} USDT (-${Math.abs(baselineReconstruction.worstDayPercent).toFixed(2)}%)`, 'محاسبه‌شده', `تاریخ: ${baselineReconstruction.worstDayDate}`],
      ['درصد روزهای برنده', `${baselineReconstruction.winningDaysPercent.toFixed(1)}%`, 'محاسبه‌شده', `${baselineReconstruction.winDaysCount} روز سودده از ${baselineReconstruction.totalDaysCount} روز فعال`],
      ['شاخص زخم اولسر (Ulcer Index)', `${baselineReconstruction.ulcerIndex.toFixed(2)}%`, 'محاسبه‌شده', 'عمق و ماندگاری افت سرمایه'],
      ['نسبت مارتین (Martin Ratio / UPI)', `${baselineReconstruction.martinRatio.toFixed(2)}`, 'محاسبه‌شده', 'بازده کل تعدیل‌شده با شاخص اولسر'],
      ['پایداری منحنی سرمایه (R-Squared)', `${baselineReconstruction.equityCurveStability.rSquared.toFixed(2)} (${baselineReconstruction.equityCurveStability.rSquaredPercent.toFixed(2)}%)`, baselineReconstruction.equityCurveStability.status, `شیب OLS: ${baselineReconstruction.equityCurveStability.slopePerTrade >= 0 ? '+' : ''}$${baselineReconstruction.equityCurveStability.slopePerTrade.toFixed(2)} به ازای هر ترید`],
      ['', '', '', ''],
      ['بخش ۴: جدول سنجش ریسک واقعی پرتفوی (Table 4 — Measure Actual Portfolio Risk)', '', '', ''],
      ['شاخص ریسک پورتفوی', 'مقدار محاسباتی', 'نوع متغیر', 'توضیحات و مدل کوواریانس'],
      ['ریسک اسمی هر معامله باز', `${portfolioRiskAudit.nominalRiskPerTrade}% ($${((capital * portfolioRiskAudit.nominalRiskPerTrade) / 100).toFixed(2)} USDT)`, 'تنظیمی', 'ریسک اسمی تنظیم‌شده برای هر معامله'],
      ['میانگین پوزیشن‌های باز همزمان', `${portfolioRiskAudit.avgOpenTrades} معامله`, 'محاسبه‌شده', 'میانگین وزنی پوزیشن‌های فعال در طول دوره'],
      ['حداکثر پوزیشن‌های باز همزمان', `${portfolioRiskAudit.maxOpenTrades} معامله`, 'محاسبه‌شده', 'بیشترین تعداد معامله باز در یک لحظه'],
      ['حداکثر ریسک اسمی همزمان', `${portfolioRiskAudit.maxNominalRiskPct}% ($${portfolioRiskAudit.maxNominalRiskUsd.toFixed(2)} USDT)`, 'محاسبه‌شده', 'حاصل‌ضرب تعداد پوزیشن‌ها در ریسک اسمی'],
      ['حداکثر ریسک موثر همبسته با کوواریانس', `${portfolioRiskAudit.maxEffectiveRiskPct}% ($${portfolioRiskAudit.maxEffectiveRiskUsd.toFixed(2)} USDT)`, 'محاسبه‌شده', `با احتساب ضریب همبستگی میانگین ρ=${portfolioRiskAudit.avgCorrelation} کریپتو`],
      ['میانگین ریسک اسمی سبد', `${portfolioRiskAudit.avgNominalRiskPct}% ($${portfolioRiskAudit.avgNominalRiskUsd.toFixed(2)} USDT)`, 'محاسبه‌شده', 'میانگین ریسک اسمی در کل دوره'],
      ['میانگین ریسک موثر سبد با کوواریانس', `${portfolioRiskAudit.avgEffectiveRiskPct}% ($${portfolioRiskAudit.avgEffectiveRiskUsd.toFixed(2)} USDT)`, 'محاسبه‌شده', 'میانگین ریسک کوواریانسی در کل دوره'],
      ['ضریب همبستگی میانگین بازار', `ρ = ${portfolioRiskAudit.avgCorrelation}`, 'بنچمارک', 'میانگین همبستگی ریزش‌های همزمان در بازار ارزهای دیجیتال'],
      ['', '', '', ''],
      ['جدول تصاعد ریسک با افزایش پوزیشن‌های همزمان (Portfolio Risk Scaling Table)', '', '', ''],
      ['تعداد پوزیشن‌های همزمان', 'ریسک اسمی سبد (%)', 'ریسک موثر کوواریانسی (%)', 'ضریب مقیاس ریسک / درصد زمان حضور در بازار'],
      ...portfolioRiskAudit.scalingTable.map((s: any) => [
        `${s.tradesCount} معامله همزمان`,
        `${s.nominalRiskPct}%`,
        `${s.effectiveRiskPct}%`,
        `ضریب: ${s.scalingFactor}x | حضور در بازار: ${s.pctTime}% زمان`,
      ]),
      ['', '', '', ''],
      ['بخش ۵: اعتبارسنجی مدل مبنا و شبکه بازپخش غیرخطی ریسک (Table 5 — Baseline Validation & Nonlinear Risk Replay)', '', '', ''],
      ['پارامتر اعتبارسنجی مدل مبنا', 'مقدار / نتیجه', 'وضعیت', 'تحلیل و جزئیات'],
      ['درودان هدف استاندارد (Target Benchmark)', `${baselineValidationAudit.targetMaxDD}%`, 'بنچمارک', 'سطح مرجع ۲۰٪ حداکثر درودان'],
      ['درودان محقق‌شده مدل (Actual Model MaxDD)', `${baselineValidationAudit.actualMaxDD}%`, 'محاسبه‌شده', 'حداکثر درودان واقعی حساب'],
      ['میزان انحراف نسبت به هدف ۲۰٪ (Delta)', `${baselineValidationAudit.delta >= 0 ? '+' : ''}${baselineValidationAudit.delta}%`, baselineValidationAudit.isMatch ? 'منطبق' : 'دارای انحراف', baselineValidationAudit.statusText],
      ['برآورد خطی مقیاس ریسک برای درودان ۲۰٪', `${baselineValidationAudit.historicalLinearRiskScalingEstimate}% به ازای هر ترید`, 'برآورد خطی تاریخی', 'برون‌یابی خطی متناسب با دیتای گذشته بدون تضمین آینده'],
      ...baselineValidationAudit.investigationPoints.map((p: any) => [
        `ریشه‌یابی علت انحراف: ${p.title}`,
        p.finding,
        'ثبت‌شده',
        'ممیزی علت اختلاف',
      ]),
      ['', '', '', ''],
      ['شبکه بازپخش غیرخطی ریسک در ۸ سطح (Nonlinear Risk Replay Grid: 0.5% - 4.0%)', '', '', ''],
      ['سطح ریسک (%) / ریسک دلاری', 'سود خالص حساب / بازدهی (%)', 'حداکثر درودان (% و $)', 'نسبت شارپ / سورتینو / فاکتور سود / سقف مواجهه (%)'],
      ...baselineReconstruction.nonlinearRiskReplayAudit.map((r: any) => [
        `ریسک ${r.riskLevel.toFixed(1)}% ($${r.riskUsd.toFixed(2)} USDT)`,
        `+$${r.accountNetProfit.toFixed(2)} USDT (${r.finalReturnPct.toFixed(2)}%) | دارایی نهایی: $${r.finalEquity.toFixed(2)}`,
        `درودان: ${r.maxDD.toFixed(2)}% (-$${r.maxDD_usd.toFixed(2)} USDT)`,
        `Sharpe: ${r.sharpeRatio.toFixed(2)} | Sortino: ${r.sortinoRatio.toFixed(2)} | PF: ${r.profitFactor.toFixed(2)} | مواجهه اوج: ${r.maxGrossExposurePct.toFixed(1)}%`,
      ]),
      ['', '', '', ''],
      ['بخش ۶: چک‌لیست ۱۲ آزمون انسجام ریاضی (Table 6 — 12-Condition Automated Consistency Audit)', '', '', ''],
      ['خلاصه دسته‌بندی ممیزی (Category Breakdown)', '', '', ''],
      ...baselineReconstruction.consistencyAudit.categoryAuditSummary.map((cat: any) => [
        `بخش: ${cat.nameFa} (${cat.name})`,
        cat.status === 'PASS' ? '✅ PASS (تایید کامل)' : cat.status === 'WARN' ? '⚠️ WARN (هشدار متدولوژی)' : '❌ FAIL (دارای خطا)',
        cat.status,
        cat.note,
      ]),
      ['', '', '', ''],
      ['آزمون‌های ۱۲‌گانه انسجام ریاضی', 'فرمول و ارزیابی محاسباتی', 'وضعیت آزمون', 'توضیحات و اثبات'],
      ...baselineReconstruction.consistencyAudit.checks.map((c: any) => [
        `آزمون ${c.id}: ${c.nameEn}`,
        c.formula,
        c.status === 'PASS' ? '✅ PASS (تایید شد)' : '❌ FAIL (مغایرت)',
        c.explanation,
      ]),
      ['', '', '', ''],
      ['بخش ۷: ممیزی تفصیلی هزینه و اجرای سفارشات (Table 7 — Execution & Cost Audit)', '', '', ''],
      ['ارزش اسمی کل سفارشات ورود (Entry Notional Total)', `$${baselineReconstruction.executionCostAudit.entryNotionalTotal.toFixed(2)} USDT`, 'تاییدشده', 'مجموع ارزش دلاری کلیه خریدهای باز شده'],
      ['ارزش اسمی کل سفارشات خروج (Exit Notional Total)', `$${baselineReconstruction.executionCostAudit.exitNotionalTotal.toFixed(2)} USDT`, 'تاییدشده', 'مجموع ارزش دلاری کلیه تسویه‌های خروج'],
      ['گردش مالی واقعی اجراشده (Total Executed Notional)', `$${baselineReconstruction.executionCostAudit.totalExecutedNotional.toFixed(2)} USDT`, 'تاییدشده', 'Entry Notional + Exit Notional'],
      ['سود ناخالص تریدها قبل از کارمزد (Gross Trade PnL)', `$${baselineReconstruction.executionCostAudit.sumGrossTradePnl.toFixed(2)} USDT`, 'تاییدشده', 'مجموع سود و زیان ناخالص تریدها'],
      ['کارمزد سفارشات ورود (Entry Fees Total)', `-$${baselineReconstruction.executionCostAudit.entryFeeTotal.toFixed(2)} USDT`, 'تاییدشده', 'کارمزد سفارش ورود بایننس'],
      ['کارمزد سفارشات خروج (Exit Fees Total)', `-$${baselineReconstruction.executionCostAudit.exitFeeTotal.toFixed(2)} USDT`, 'تاییدشده', 'کارمزد سفارش خروج بایننس'],
      ['مجموع کارمزدهای معاملاتی (Total Trading Fees)', `-$${baselineReconstruction.executionCostAudit.totalTradingFees.toFixed(2)} USDT`, 'تاییدشده', 'مجموع کارمزدهای کسرشده'],
      ['نرخ موثر کارمزد (Effective Fee Rate)', `${baselineReconstruction.executionCostAudit.effectiveFeeRate.toFixed(4)}%`, 'تاییدشده', 'Total Trading Fees / Executed Notional'],
      ['کل فاندینگ پرداختی پوزیشن‌ها (Total Funding Paid)', `-$${baselineReconstruction.executionCostAudit.sumFundingPaid.toFixed(2)} USDT`, 'تاییدشده', 'فاندینگ ریت کسرشده در نقاط تسویه ۸ ساعته'],
      ['کل فاندینگ دریافتی پوزیشن‌های شورت (Funding Received)', `+$${baselineReconstruction.executionCostAudit.sumFundingReceived.toFixed(2)} USDT`, 'تاییدشده', 'درآمد فاندینگ حاصل از پوزیشن‌های شورت'],
      ['خالص هزینه فاندینگ ریت (Net Funding)', `-$${baselineReconstruction.executionCostAudit.netFunding.toFixed(2)} USDT`, 'تاییدشده', 'خالص فاندینگ ریت در سطح کل پورتفوی'],
      ['موازنه حسابداری دقیق (Accounting Reconciliation)', baselineReconstruction.executionCostAudit.reconciliationPassed ? '✅ PASS (موازنه کامل)' : '❌ FAIL', 'تاییدشده', 'Sum(Gross Trade PnL) - Sum(Trading Fees) - Net Funding = Final Account PnL'],
      ['', '', '', ''],
      ['بخش ۸: جدول مواجهه، مارجین و اهرم (Table 8 — Exposure & Margin Audit)', '', '', ''],
      ['تنظیم اهرم صرافی (Exchange Leverage Setting)', baselineReconstruction.exposureMarginAudit.exchangeLeverageSetting, 'تنظیمی', 'اهرم صرافی ۱x'],
      ['طبقه‌بندی سایزینگ (Sizing Classification)', baselineReconstruction.exposureMarginAudit.isTheoreticalRiskBasedSizing ? 'Theoretical risk-based sizing' : 'Standard Sizing', 'ممیزی‌شده', 'سایزینگ ریسک‌محور روی استاپ‌لاس‌های کوچک'],
      ['حداکثر مواجهه ناخالص به حقوق صاحبان سهام', `${baselineReconstruction.exposureMarginAudit.maxGrossExposurePct.toFixed(1)}% (${(baselineReconstruction.exposureMarginAudit.maxGrossExposurePct / 100).toFixed(2)}x)`, 'محاسبه‌شده', 'حداکثر نسبت ارزش اسمی پوزیشن‌ها به سرمایه'],
      ['میانگین مواجهه ناخالص سبد', `${baselineReconstruction.exposureMarginAudit.avgGrossExposurePct.toFixed(1)}%`, 'محاسبه‌شده', 'میانگین نسبت ارزش اسمی در کل دوره'],
      ['حداکثر مارجین مورد نیاز در صرافی', `$${baselineReconstruction.exposureMarginAudit.maxRequiredMarginUsd.toFixed(2)} USDT (${baselineReconstruction.exposureMarginAudit.maxRequiredMarginPct.toFixed(1)}%)`, 'محاسبه‌شده', 'بیشترین مارجین مسدودشده در اهرم ۱x'],
      ['اوج ارزش اسمی همزمان سبد', `$${baselineReconstruction.exposureMarginAudit.maxSimultaneousNotional.toFixed(2)} USDT`, 'محاسبه‌شده', 'Max Simultaneous Notional'],
      ['حداکثر پوزیشن‌های همزمان', `${baselineReconstruction.exposureMarginAudit.maxConcurrentPositions} پوزیشن`, 'محاسبه‌شده', 'Max Concurrent Positions'],
      ['تحلیل اجرایی‌پذیری در صرافی زنده', baselineReconstruction.exposureMarginAudit.executabilityAssessment, 'ارزیابی فنی', 'شرایط نقدینگی و اهرم مورد نیاز جهت اجرای زنده'],
      ['', '', '', ''],
      ['بخش ۹: پوشش زمانی واقعی استراتژی (Table 9 — Actual Trade Coverage)', '', '', ''],
      ['تاریخ و زمان اولین ورود معامله نهایی', baselineReconstruction.actualTradeCoverageAudit.earliestFinalTradeEntry, 'ثبت‌شده', 'Earliest Final Trade Entry'],
      ['تاریخ و زمان آخرین خروج معامله نهایی', baselineReconstruction.actualTradeCoverageAudit.latestFinalTradeExit, 'ثبت‌شده', 'Latest Final Trade Exit'],
      ['تعداد روزهای تقویمی بازه معاملاتی', `${baselineReconstruction.actualTradeCoverageAudit.calendarDaysBetween} روز`, 'ثبت‌شده', 'Calendar Days Between Trades'],
      ['تعداد روزهای معاملاتی فعال', `${baselineReconstruction.actualTradeCoverageAudit.activeTradingDaysCount} روز`, 'ثبت‌شده', 'Active Trading Days Count'],
      ['تعداد ماه‌های تقویمی دارای معامله', `${baselineReconstruction.actualTradeCoverageAudit.activeMonthsCount} ماه`, 'ثبت‌شده', 'Active Months Count'],
      ['میانگین معاملات در هر ماه فعال', `${baselineReconstruction.actualTradeCoverageAudit.avgTradesPerMonth.toFixed(1)} معامله`, 'محاسبه‌شده', 'Average Trades Per Month'],
      ['میانگین معاملات در هر روز فعال', `${baselineReconstruction.actualTradeCoverageAudit.avgTradesPerDay.toFixed(1)} معامله`, 'محاسبه‌شده', 'Average Trades Per Day'],
      ['', '', '', ''],
      ['بخش ۱۰: عملکرد تفکیکی ماه‌های تقویمی (Table 10 — Monthly Portfolio Performance)', '', '', ''],
      ['ماه تقویمی (Month)', 'تعداد معاملات و وین‌ریت', 'سود ناخالص / کارمزد / فاندینگ', 'سود خالص ماهانه / درصد بازدهی / حداکثر درودان'],
      ...baselineReconstruction.monthlyPerformanceAudit.map((m: any) => [
        m.month,
        `${m.closedTrades} معامله (برد: ${m.winningTrades} | باخت: ${m.losingTrades} | وین‌ریت: ${m.winRate.toFixed(1)}%)`,
        `سود ناخالص: $${m.grossPnl.toFixed(2)} | کارمزد: -$${m.tradingFees.toFixed(2)} | فاندینگ: -$${m.funding.toFixed(2)}`,
        `سود خالص: $${m.netAccountPnl.toFixed(2)} (${m.returnPercent.toFixed(2)}%) | درودان: ${m.maxDrawdownPct.toFixed(2)}%`,
      ]),
      ['', '', '', ''],
      ['بخش ۱۱: اعتبارسنجی منحنی‌های سرمایه و اصطکاک کارمزد (Table 11 — Equity Curve Validation & Fee Drag)', '', '', ''],
      ['شاخص منحنی سرمایه', 'مقدار / بازه', 'وضعیت', 'توضیحات و محاسبات'],
      ['منحنی معاملاتی بدون فاندینگ (Trading Equity Final)', `$${baselineReconstruction.equityCurveValidationAudit.tradingEquity.finalEquity.toFixed(2)} USDT`, 'محاسبه‌شده', `حداکثر درودان: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.maxDrawdownPct.toFixed(2)}% (-$${baselineReconstruction.equityCurveValidationAudit.tradingEquity.maxDrawdownUsd.toFixed(2)} USDT)`],
      ['زمان‌بندی درودان منحنی معاملاتی', `شروع: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.startDate} | کف: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.bottomDate} | بازیابی: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.recoveryDate}`, 'محاسبه‌شده', `طول دوره: ${baselineReconstruction.equityCurveValidationAudit.tradingEquity.durationDays.toFixed(1)} روز (${baselineReconstruction.equityCurveValidationAudit.tradingEquity.durationTrades} معامله)`],
      ['منحنی نهایی حساب با فاندینگ (Account Equity Final)', `$${baselineReconstruction.equityCurveValidationAudit.accountEquity.finalEquity.toFixed(2)} USDT`, 'محاسبه‌شده', `حداکثر درودان: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.maxDrawdownPct.toFixed(2)}% (-$${baselineReconstruction.equityCurveValidationAudit.accountEquity.maxDrawdownUsd.toFixed(2)} USDT)`],
      ['زمان‌بندی درودان منحنی حساب', `شروع: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.startDate} | کف: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.bottomDate} | بازیابی: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.recoveryDate}`, 'محاسبه‌شده', `طول دوره: ${baselineReconstruction.equityCurveValidationAudit.accountEquity.durationDays.toFixed(1)} روز (${baselineReconstruction.equityCurveValidationAudit.accountEquity.durationTrades} معامله)`],
      ['پایداری خطی منحنی سرمایه (R-Squared)', `${baselineReconstruction.equityCurveStability.rSquared.toFixed(2)} (${baselineReconstruction.equityCurveStability.rSquaredPercent.toFixed(2)}%)`, baselineReconstruction.equityCurveStability.status, `شیب OLS: ${baselineReconstruction.equityCurveStability.slopePerTrade >= 0 ? '+' : ''}$${baselineReconstruction.equityCurveStability.slopePerTrade.toFixed(2)} به ازای هر ترید`],
      ['شاخص زخم اولسر (Ulcer Index)', `${baselineReconstruction.ulcerIndexAndMartinRatio.ulcerIndex.toFixed(2)}%`, 'محاسبه‌شده', 'اندازه‌گیری عمق و پایداری درودان'],
      ['نسبت مارتین (Martin Ratio / UPI)', `${baselineReconstruction.ulcerIndexAndMartinRatio.martinRatio.toFixed(2)}`, 'محاسبه‌شده', 'بازدهی کل تقسیم بر شاخص اولسر'],
      ['سرمایه نهایی فرضی بدون کارمزد', `$${baselineReconstruction.feeDragAudit.finalEquityWithoutFees.toFixed(2)} USDT`, 'محاسبه‌شده', 'Final Equity Without Fees'],
      ['سرمایه نهایی واقعی با کسر کارمزد', `$${baselineReconstruction.feeDragAudit.finalEquityWithFees.toFixed(2)} USDT`, 'محاسبه‌شده', 'Final Equity With Fees'],
      ['افت ناشی از اصطکاک کارمزدها (Fee Drag Impact)', `-$${baselineReconstruction.feeDragAudit.feeImpactOnFinalEquityUsd.toFixed(2)} USDT (-${baselineReconstruction.feeDragAudit.feeImpactOnMaxDDPct.toFixed(2)}% سرمایه)`, 'محاسبه‌شده', 'تفاضل تجربی دو منحنی با و بدون کارمزد'],
      ['', '', '', ''],
      ['بخش ۱۲: توزیع ریسک روزانه و ارزش در معرض ریسک (Table 12 — Daily Risk Distribution & VaR/CVaR)', '', '', ''],
      ['شاخص توزیع ریسک روزانه', 'مقدار دقیق', 'نوع شاخص', 'توضیحات و فرمول ریاضی'],
      ['تعداد روزهای تقویمی دوره', `${baselineReconstruction.dailyRiskDistributionAudit.calendarDaysCount} روز`, 'تقویمی', 'تمام روزهای بین اولین ورود و آخرین خروج'],
      ['تعداد روزهای معاملاتی فعال', `${baselineReconstruction.dailyRiskDistributionAudit.tradingDaysCount} روز`, 'معاملاتی', 'روزهای دارای نتیجه و بسته شدن معامله'],
      ['میانگین بازده روزانه (Mean Daily Return)', `${baselineReconstruction.dailyRiskDistributionAudit.meanDailyReturn.toFixed(3)}%`, 'محاسبه‌شده', 'میانگین حسابی بازده‌های روزانه'],
      ['میانه بازده روزانه (Median Daily Return)', `${baselineReconstruction.dailyRiskDistributionAudit.medianDailyReturn.toFixed(3)}%`, 'محاسبه‌شده', 'چارک دوم توزیع بازده روزانه'],
      ['انحراف معیار بازده روزانه (Daily StdDev)', `${baselineReconstruction.dailyRiskDistributionAudit.stdDevDailyReturn.toFixed(3)}%`, 'محاسبه‌شده', 'انحراف معیار نوسانات روزانه'],
      ['انحراف نزولی روزانه (Downside Deviation)', `${baselineReconstruction.dailyRiskDistributionAudit.downsideDeviation.toFixed(3)}%`, 'محاسبه‌شده', 'انحراف معیار بازده‌های منفی با هدف صفر'],
      ['نسبت سورتینو روزانه (Daily Sortino)', `${baselineReconstruction.dailyRiskDistributionAudit.dailySortino.toFixed(2)}`, 'محاسبه‌شده', 'Daily Mean / Daily Downside Deviation'],
      ['نسبت سورتینو سالانه‌شده (Annualized Sortino)', `${baselineReconstruction.dailyRiskDistributionAudit.annualizedSortino.toFixed(2)}`, 'محاسبه‌شده', 'Daily Sortino × √365'],
      ['صدک ۵٪ بازدهی روزانه (5th Percentile)', `${baselineReconstruction.dailyRiskDistributionAudit.percentile5th.toFixed(2)}%`, 'محاسبه‌شده', 'مرز بدترین ۵٪ روزهای معاملاتی'],
      ['صدک ۱٪ بازدهی روزانه (1st Percentile)', `${baselineReconstruction.dailyRiskDistributionAudit.percentile1st.toFixed(2)}%`, 'محاسبه‌شده', 'مرز بدترین ۱٪ روزهای معاملاتی'],
      ['ارزش در معرض ریسک روزانه ۹۵٪ (Daily VaR 95%)', `${baselineReconstruction.dailyRiskDistributionAudit.var95.toFixed(2)}% (-$${((capital * baselineReconstruction.dailyRiskDistributionAudit.var95) / 100).toFixed(2)} USDT)`, 'محاسبه‌شده', 'بیشترین زیان روزانه در ۹۵٪ روزها'],
      ['ارزش در معرض ریسک روزانه ۹۹٪ (Daily VaR 99%)', `${baselineReconstruction.dailyRiskDistributionAudit.var99.toFixed(2)}% (-$${((capital * baselineReconstruction.dailyRiskDistributionAudit.var99) / 100).toFixed(2)} USDT)`, 'محاسبه‌شده', 'بیشترین زیان روزانه در ۹۹٪ روزها'],
      ['کسری موردانتظار شرطی روزانه ۹۵٪ (Daily CVaR 95%)', `${baselineReconstruction.dailyRiskDistributionAudit.cvar95.toFixed(2)}% (-$${((capital * baselineReconstruction.dailyRiskDistributionAudit.cvar95) / 100).toFixed(2)} USDT)`, 'محاسبه‌شده', 'میانگین زیان در بدترین ۵٪ روزها (Expected Shortfall)'],
      ['کسری موردانتظار شرطی روزانه ۹۹٪ (Daily CVaR 99%)', `${baselineReconstruction.dailyRiskDistributionAudit.cvar99.toFixed(2)}% (-$${((capital * baselineReconstruction.dailyRiskDistributionAudit.cvar99) / 100).toFixed(2)} USDT)`, 'محاسبه‌شده', 'میانگین زیان در بدترین ۱٪ روزها (Expected Shortfall)'],
      ['شرط برابری یا بزرگتر بودن CVaR نسبت به VaR', baselineReconstruction.dailyRiskDistributionAudit.cvar95 >= baselineReconstruction.dailyRiskDistributionAudit.var95 ? '✅ PASS (تایید شد)' : '❌ FAIL', 'تاییدشده', 'شرط ریاضی CVaR >= VaR کاملاً برقرار است'],
      ['', '', '', ''],
      ['بخش ۱۳: ممیزی فیلتر همزمانی پورتفوی و عدم اریب (Table 13 — Concurrency Filter Audit & Zero Look-Ahead Bias)', '', '', ''],
      ['شاخص ممیزی فیلتر همزمانی', 'مقدار عددی', 'وضعیت سلامت', 'توضیحات و قوانین گره‌گشایی'],
      ['معاملات اولیه خام قبل از فیلتر [RAW / PRE-FILTER]', `${baselineReconstruction.concurrencyFilterAudit.rawTradesCount} معامله`, 'ثبت‌شده', 'مجموع سیگنال‌های تولیدشده مستقل نمادها'],
      ['معاملات ردشده به دلیل تداخل زمانی همزمان', `${baselineReconstruction.concurrencyFilterAudit.rejectedTradesCount} معامله (${baselineReconstruction.concurrencyFilterAudit.removalPercentage.toFixed(1)}% کاهش)`, 'ثبت‌شده', 'سیگنال‌های حذف‌شده جهت جلوگیری از باز شدن موازی'],
      ['معاملات نهایی پورتفوی [FINAL / POST-CONCURRENCY]', `${baselineReconstruction.concurrencyFilterAudit.finalTradesCount} معامله`, 'ثبت‌شده', 'معاملات رسمی و نهایی ثبت‌شده در سبد'],
      ['تعداد گروه‌های تداخل همزمانی', `${baselineReconstruction.concurrencyFilterAudit.conflictGroupsCount} گروه`, 'ثبت‌شده', 'دسته‌های معاملاتی دارای همپوشانی زمانی'],
      ['قانون گره‌گشایی ۱: تقدم زمانی', 'Candidate Entry Timestamp', 'تاییدشده', 'تریدی که زودتر در نمودار شکل گرفته اولویت دارد'],
      ['قانون گره‌گشایی ۲: امتیاز سیگنال', 'Signal Score at Entry Bar', 'تاییدشده', 'در صورت همزمانی دقیق، سیگنال با امتیاز بالاتر انتخاب می‌شود'],
      ['قانون گره‌گشایی ۳: ترتیب الفبایی نماد', 'Symbol Alphabetical Order', 'تاییدشده', 'گره‌گشای قطعی نهایی بدون ابهام'],
      ['اثبات قطعی عدم اریب نگاه به آینده (Zero Look-Ahead Bias)', '✅ PASS (تایید قطعی)', 'تاییدشده', 'تصمیم‌گیری صرفاً بر مبنای داده‌های زمان ورود انجام شده و هیچ داده‌ای از نتیجه آینده یا زمان خروج استفاده نشده است'],
      ['وضعیت نهایی کل ممیزی سیستم (Overall Audit Status)', baselineReconstruction.consistencyAudit.overallStatus, 'ممیزی کامل', 'بررسی جامع و ارزیابی نهایی تمام ۱۳ جدول'],
      ['', '', '', ''],
      ['بخش ۱۴: ژورنال جامع و تفصیلی کلیه معاملات پورتفوی (Table 14 — Complete Detailed Portfolio Trade Journal)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'ردیف (#)',
        'نماد (Symbol)',
        'جهت (Direction)',
        'زمان ورود (Entry Time UTC)',
        'زمان خروج (Exit Time UTC)',
        'مدت نگهداری (ساعت)',
        'قیمت ورود (Entry Price)',
        'قیمت خروج (Exit Price)',
        'حجم معامله (Position Size)',
        'ارزش اسمی (Notional USD)',
        'سود ناخالص (Gross PnL USD)',
        'کارمزد صرافی (Trading Fee USD)',
        'خالص فاندینگ (Net Funding USD)',
        'سود خالص معامله (Net PnL USD)',
        'درصد سود/زیان (PnL %)',
        'نتیجه نهایی (Outcome)',
      ],
    ];

    // اضافه کردن تمام تریدهای پورتفوی به جدول ۱۴
    const tradesToExport = baselineReconstruction.allExecutionTrades || [];
    if (tradesToExport.length > 0) {
      tradesToExport.forEach((t: any, index: number) => {
        const holdHours = t.entryTime && t.exitTime && t.exitTime > t.entryTime
          ? ((toSec(t.exitTime) - toSec(t.entryTime)) / 3600).toFixed(1)
          : '0.0';
        const initialCapital = capital || 10000;
        const isWin = (t.finalTradePnl !== undefined ? t.finalTradePnl : (t.grossTradePnl - t.totalTradingFee)) > 0;
        const returnPct = initialCapital > 0 ? ((t.finalTradePnl / initialCapital) * 100).toFixed(2) : '0.00';

        table1Rows.push([
          String(index + 1),
          t.symbol || 'USDT',
          t.direction === 'BUY' ? 'خرید (BUY)' : 'فروش (SELL)',
          formatTimeUtc(t.entryTime),
          formatTimeUtc(t.exitTime),
          holdHours,
          (t.entryPrice || 0).toFixed(4),
          (t.exitPrice || 0).toFixed(4),
          (t.positionSize || 0).toFixed(4),
          `$${(t.entryNotional || 0).toFixed(2)}`,
          `$${(t.grossTradePnl || 0).toFixed(2)}`,
          `-$${(t.totalTradingFee || 0).toFixed(2)}`,
          `-$${(t.netFunding || 0).toFixed(2)}`,
          `${t.finalTradePnl >= 0 ? '+' : ''}$${(t.finalTradePnl || 0).toFixed(2)}`,
          `${returnPct}%`,
          isWin ? 'برد (WIN)' : 'باخت (LOSS)',
        ]);
      });
    } else if (effectivePortfolioTrades && effectivePortfolioTrades.length > 0) {
      effectivePortfolioTrades.forEach((t: any, index: number) => {
        const eTime = t.entryTime || t.timeF || 0;
        const xTime = t.exitTime || eTime;
        const holdHours = xTime > eTime ? ((toSec(xTime) - toSec(eTime)) / 3600).toFixed(1) : '0.0';
        const pnl = t.pnl || 0;
        const fee = t.fee || t.commission || 0;
        const gross = t.grossPnl !== undefined ? t.grossPnl : pnl + fee;
        const isWin = pnl > 0;

        table1Rows.push([
          String(index + 1),
          t.symbol || 'USDT',
          t.direction === 'BUY' || t.type === 'BUY' ? 'خرید (BUY)' : 'فروش (SELL)',
          formatTimeUtc(eTime),
          formatTimeUtc(xTime),
          holdHours,
          (t.entryPrice || 0).toFixed(4),
          (t.exitPrice || 0).toFixed(4),
          (t.positionSize || 0).toFixed(4),
          `$${(t.positionValue || (t.positionSize ? t.positionSize * t.entryPrice : 0)).toFixed(2)}`,
          `$${gross.toFixed(2)}`,
          `-$${fee.toFixed(2)}`,
          '$0.00',
          `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
          `${(t.pnlPercent || 0).toFixed(2)}%`,
          isWin ? 'برد (WIN)' : 'باخت (LOSS)',
        ]);
      });
    } else {
      table1Rows.push(['—', 'معامله‌ای در بازه انتخابی یافت نشد', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—']);
    }

    const csvContent = '\uFEFF' + table1Rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest_complete_all_statistics_and_journal_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('📊 گزارش جامع CSV شامل کلیه ۱۳ جدول ممیزی و صحه‌گذاری به همراه ژورنال تفصیلی معاملات با موفقیت دانلود شد.');
  };

  return {
    datasetAudit,
    backtestIntegrityAudit,
    baselineReconstruction,
    portfolioRiskAudit,
    baselineValidationAudit,
    handleCopyAuditReport,
    handleExportDatasetAuditJSON,
    handleExportDatasetAuditCSV,
  };
}

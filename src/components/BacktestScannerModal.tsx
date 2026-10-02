import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Play,
  Square,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Percent,
  Search,
  ExternalLink,
  Flame,
  CheckCircle2,
  RefreshCw,
  Sliders,
  DollarSign,
  Activity,
  Layers,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LineChart,
  Download,
  Upload,
  Copy,
  Check,
  FileSpreadsheet,
  Trash2,
  Cpu,
  Lock,
  Unlock,
  FastForward,
  RotateCcw,
  Sparkles,
  Award,
  AlertCircle,
  Database,
  Clock,
  Compass,
  FileJson,
  Filter,
} from 'lucide-react';
import { CryptoPair, CandleData, Timeframe, ZigZagSettings } from '../types/crypto';
import { StrategyConfig, StrategyTrade } from '../types/strategy';
import { fetchUSDTMarketPairs, fetchKlines } from '../services/binance';
import { calculateATR, calculateAtrZigZag, analyzeZigZagLegs } from '../utils/indicators';
import { runStrategy1Backtest, runStrategy2Backtest } from '../utils/strategyEngine';

export interface BacktestResultItem {
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
  profitFactor: number;
  avgRiskReward: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  optimalRiskForDD20: number;
  lastTradeStatus?: 'WIN' | 'LOSS' | 'ACTIVE';
  trades: StrategyTrade[];
}

export interface OptimizationTrial {
  id: number;
  hash: string;
  timestamp: string;
  // ۸ پارامتر استراتژی
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
  // خروجی‌های شبیه‌سازی
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  netProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  isValid: boolean; // آیا هر ۳ شرط درودان، وین‌ریت و تعداد معامله برقرار است؟
  bayesianReason?: string; // علت و توجیه ریاضی بیزی برای این آزمایش
}

interface BacktestScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zigzagSettings: ZigZagSettings;
  onUpdateZigZagSettings?: (newSettings: ZigZagSettings) => void;
  currentTimeframe: Timeframe;
  onSelectPairAndClose: (pair: CryptoPair) => void;
}

type ScannerSortCol =
  | 'symbol'
  | 'totalTrades'
  | 'winRate'
  | 'netProfit'
  | 'profitFactor'
  | 'maxDrawdownPercent'
  | 'optimalRiskForDD20';

type OptSortCol =
  | 'netProfit'
  | 'winRate'
  | 'maxDrawdown'
  | 'totalTrades'
  | 'profitFactor'
  | 'atrPeriod'
  | 'minCandles'
  | 'atrMultiplier'
  | 'maxRiskReward';

type SortDirection = 'asc' | 'desc';

// دامنه‌های مقادیر گسسته برای ۸ پارامتر
const DOMAINS = {
  atrPeriod: [15, 25, 35, 45, 55, 65, 75, 85, 100],
  minCandles: [1, 2, 3, 4, 5, 6, 7, 8],
  minCandlesForLongLeg: [10, 14, 18, 20, 24, 28, 32, 36],
  atrMultiplier: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0],
  longLegAtrMultiplier: [6, 8, 10, 12, 14, 16, 18],
  maxBlueLegPercent: [35, 45, 55, 60, 65, 75, 85],
  maxBreakoutAtrMultiplier: [2.0, 3.0, 4.0, 5.0, 6.0, 7.0],
  maxRiskReward: [1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0],
};

function generateConfigHash(p: {
  atrPeriod: number;
  minCandles: number;
  minCandlesForLongLeg: number;
  atrMultiplier: number;
  longLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
  maxRiskReward: number;
}): string {
  return `${p.atrPeriod}_${p.minCandles}_${p.minCandlesForLongLeg}_${p.atrMultiplier}_${p.longLegAtrMultiplier}_${p.maxBlueLegPercent}_${p.maxBreakoutAtrMultiplier}_${p.maxRiskReward}`;
}

export const BacktestScannerModal: React.FC<BacktestScannerModalProps> = ({
  isOpen,
  onClose,
  zigzagSettings,
  onUpdateZigZagSettings,
  currentTimeframe,
  onSelectPairAndClose,
}) => {
  // Navigation Tabs: 'scanner' (اسکن دستی بازار) | 'optimizer' (بهینه‌ساز خودکار بیزی)
  const [activeTab, setActiveTab] = useState<'scanner' | 'optimizer'>('scanner');

  // Strategy selection
  const [selectedStrategyId, setSelectedStrategyId] = useState<'strategy_1_e_breakout' | 'strategy_2_next_pivot'>(
    'strategy_1_e_breakout'
  );

  // General Parameters
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [maxCandlesToEnter, setMaxCandlesToEnter] = useState<number>(100);
  const [timeframe, setTimeframe] = useState<Timeframe>(currentTimeframe === '1m' ? '5m' : currentTimeframe);
  const [candleHistoryLimit, setCandleHistoryLimit] = useState<number>(500);
  const [universeOption, setUniverseOption] = useState<'all_1m' | 'top_30' | 'top_50'>('all_1m');

  // Cached Candles in Memory to avoid repeated downloads!
  const cachedCandlesMapRef = useRef<Map<string, { pair: CryptoPair; candles: CandleData[] }>>(new Map());
  const [cachedCount, setCachedCount] = useState<number>(0);

  // Scanner status & results
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentSymbol: string }>({
    current: 0,
    total: 0,
    currentSymbol: '',
  });

  const [results, setResults] = useState<BacktestResultItem[]>(() => {
    try {
      const saved = localStorage.getItem('backtest_scanned_results_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [allCollectedTrades, setAllCollectedTrades] = useState<StrategyTrade[]>(() => {
    try {
      const saved = localStorage.getItem('backtest_scanned_trades_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Chart View Options in Scanner Tab
  const [activeChartTab, setActiveChartTab] = useState<'both' | 'equity' | 'drawdown'>('both');

  // Table Sorting & Search in Scanner
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [scannerSortCol, setScannerSortCol] = useState<ScannerSortCol>('netProfit');
  const [scannerSortDir, setScannerSortDir] = useState<SortDirection>('desc');

  const abortControllerRef = useRef<boolean>(false);

  // ==========================================
  // ۸ پارامتر بهینه‌سازی با چک‌باکس قفل
  // ==========================================
  const [optAtrPeriod, setOptAtrPeriod] = useState<number>(zigzagSettings.atrPeriod || 55);
  const [lockAtrPeriod, setLockAtrPeriod] = useState<boolean>(false);

  const [optMinCandles, setOptMinCandles] = useState<number>(zigzagSettings.minCandles || 3);
  const [lockMinCandles, setLockMinCandles] = useState<boolean>(false);

  const [optMinCandlesLong, setOptMinCandlesLong] = useState<number>(zigzagSettings.minCandlesForLongLeg || 20);
  const [lockMinCandlesLong, setLockMinCandlesLong] = useState<boolean>(false);

  const [optAtrMultiplier, setOptAtrMultiplier] = useState<number>(zigzagSettings.atrMultiplier || 3.0);
  const [lockAtrMultiplier, setLockAtrMultiplier] = useState<boolean>(false);

  const [optLongLegAtrMult, setOptLongLegAtrMult] = useState<number>(zigzagSettings.longLegAtrMultiplier || 10.0);
  const [lockLongLegAtrMult, setLockLongLegAtrMult] = useState<boolean>(false);

  const [optMaxBlueLegPercent, setOptMaxBlueLegPercent] = useState<number>(zigzagSettings.maxBlueLegPercent ?? 60);
  const [lockMaxBlueLegPercent, setLockMaxBlueLegPercent] = useState<boolean>(false);

  const [optMaxBreakoutAtr, setOptMaxBreakoutAtr] = useState<number>(zigzagSettings.maxBreakoutAtrMultiplier ?? 5.0);
  const [lockMaxBreakoutAtr, setLockMaxBreakoutAtr] = useState<boolean>(false);

  // پارامتر هشتم: نسبت ریسک به ریوارد (Max Risk Reward)
  const [optMaxRiskReward, setOptMaxRiskReward] = useState<number>(5.0);
  const [lockMaxRiskReward, setLockMaxRiskReward] = useState<boolean>(false);

  // شروط اولیه ارزیابی مدل
  const [targetMaxDrawdown, setTargetMaxDrawdown] = useState<number>(20.0);
  const [targetMinWinRate, setTargetMinWinRate] = useState<number>(40.0);
  const [targetMinTrades, setTargetMinTrades] = useState<number>(100);

  // وضعیت و تایمر ۱۵ دقیقه‌ای بهینه‌ساز
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(900); // 15 دقیقه = 900 ثانیه
  const sessionSecondsRef = useRef<number>(900);
  const stopOptimizerRef = useRef<boolean>(false);

  // ریجستری هش‌های تست‌شده برای جلوگیری قطعی از هرگونه تست تکراری
  const visitedHashesRef = useRef<Set<string>>(new Set());

  // جدول تاریخچه تمام آزمایش‌ها
  const [optHistory, setOptHistory] = useState<OptimizationTrial[]>(() => {
    try {
      const saved = localStorage.getItem('zigzag_optimizer_history_v4');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // فیلتر ردیف‌های قبول در جدول بهینه‌ساز
  const [filterOnlyValid, setFilterOnlyValid] = useState<boolean>(false);

  // مرتب‌سازی جدول بهینه‌ساز (پیش‌فرض: سود خالص نزولی)
  const [optSortColumn, setOptSortColumn] = useState<OptSortCol>('netProfit');
  const [optSortDirection, setOptSortDirection] = useState<SortDirection>('desc');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // بازیابی هش‌های قبلی
  useEffect(() => {
    for (const item of optHistory) {
      if (item.hash) visitedHashesRef.current.add(item.hash);
      else visitedHashesRef.current.add(generateConfigHash(item));
    }
  }, [optHistory]);

  // ذخیره‌سازی محلی
  useEffect(() => {
    if (results.length > 0) {
      try {
        localStorage.setItem('backtest_scanned_results_v2', JSON.stringify(results));
      } catch {}
    }
  }, [results]);

  useEffect(() => {
    if (allCollectedTrades.length > 0) {
      try {
        localStorage.setItem('backtest_scanned_trades_v2', JSON.stringify(allCollectedTrades));
      } catch {}
    }
  }, [allCollectedTrades]);

  useEffect(() => {
    if (optHistory.length > 0) {
      try {
        localStorage.setItem('zigzag_optimizer_history_v4', JSON.stringify(optHistory.slice(0, 300)));
      } catch {}
    }
  }, [optHistory]);

  // کنترل تایمر ۱۵ دقیقه‌ای پیوسته
  useEffect(() => {
    let interval: any;
    if (isOptimizing && sessionSecondsLeft > 0) {
      interval = setInterval(() => {
        setSessionSecondsLeft((prev) => {
          const next = prev - 1;
          sessionSecondsRef.current = next;
          if (next <= 0) {
            clearInterval(interval);
            stopOptimizerRef.current = true;
            setIsOptimizing(false);
            showToast('⏸️ سشن ۱۵ دقیقه‌ای به پایان رسید و تمام پیشرفت‌ها خودکار ذخیره شدند.');
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOptimizing, sessionSecondsLeft]);

  // =========================================================
  // اسکن کامل بازار: تمام ارزهای بالای ۱ میلیون دلار
  // =========================================================
  const handleStartScan = async (useCachedOnly: boolean = false) => {
    setIsScanning(true);
    abortControllerRef.current = false;
    setErrorMsg(null);
    setResults([]);
    setAllCollectedTrades([]);

    try {
      // دریافت تمام جفت‌ارزهای با حجم ۲۴ ساعته بالای ۱ میلیون دلار
      const allPairs = await fetchUSDTMarketPairs(1_000_000);
      let targetPairs: CryptoPair[] = allPairs;

      if (universeOption === 'top_30') targetPairs = allPairs.slice(0, 30);
      else if (universeOption === 'top_50') targetPairs = allPairs.slice(0, 50);
      else targetPairs = allPairs; // اسکن تمام ارزهای بازار بالای ۱ میلیون دلار بدون محدودیت!

      const total = targetPairs.length;
      setProgress({ current: 0, total, currentSymbol: '' });

      const collectedResults: BacktestResultItem[] = [];
      const collectedTrades: StrategyTrade[] = [];

      const batchSize = 3;
      for (let i = 0; i < total; i += batchSize) {
        if (abortControllerRef.current) break;
        const batch = targetPairs.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (pair) => {
            if (abortControllerRef.current) return;
            setProgress((prev) => ({ ...prev, currentSymbol: pair.symbol }));

            try {
              let candles: CandleData[] = [];
              const cached = cachedCandlesMapRef.current.get(pair.symbol);
              if (useCachedOnly && cached && cached.candles.length >= 50) {
                candles = cached.candles;
              } else {
                const fetched = await fetchKlines(pair.symbol, timeframe, candleHistoryLimit);
                candles = fetched.candles;
                if (candles.length >= 50) {
                  cachedCandlesMapRef.current.set(pair.symbol, { pair, candles });
                  setCachedCount(cachedCandlesMapRef.current.size);
                }
              }

              if (candles.length < 50) return;

              const atrMetrics = calculateATR(candles, zigzagSettings.atrPeriod);
              const { points } = calculateAtrZigZag(
                candles,
                atrMetrics.atrValues,
                zigzagSettings.atrMultiplier,
                zigzagSettings.minCandles
              );
              const legs = analyzeZigZagLegs(
                points,
                zigzagSettings.minCandlesForLongLeg,
                zigzagSettings.longLegAtrMultiplier,
                zigzagSettings.maxBlueLegPercent ?? 60,
                zigzagSettings.maxBreakoutAtrMultiplier ?? 5
              );

              const tempConfig: StrategyConfig = {
                capital,
                selectedStrategyId,
                riskPercent,
                maxRiskReward: optMaxRiskReward,
                maxCandlesToEnter,
                maxTradesPerLeg: 1,
                showOnChart: true,
              };

              let backtestRes;
              if (selectedStrategyId === 'strategy_2_next_pivot') {
                backtestRes = runStrategy2Backtest(
                  candles,
                  points,
                  legs,
                  tempConfig,
                  atrMetrics.atrValues,
                  zigzagSettings.atrMultiplier,
                  zigzagSettings.minCandles
                );
              } else {
                backtestRes = runStrategy1Backtest(candles, points, legs, tempConfig);
              }

              const { trades, metrics } = backtestRes;

              let optimalRiskForDD20 = 0;
              if (metrics.maxDrawdownPercent > 0) {
                optimalRiskForDD20 = parseFloat(((riskPercent * 19.0) / metrics.maxDrawdownPercent).toFixed(2));
              } else if (metrics.totalTrades > 0) {
                optimalRiskForDD20 = 5.0;
              }

              const lastTrade = trades.length > 0 ? trades[trades.length - 1] : undefined;

              const resultItem: BacktestResultItem = {
                pair,
                candlesCount: candles.length,
                totalTrades: metrics.totalTrades,
                winTrades: metrics.winTrades,
                lossTrades: metrics.lossTrades,
                activeTrades: metrics.activeTrades,
                winRate: metrics.winRate,
                netProfit: metrics.netProfit,
                netProfitPercent: metrics.netProfitPercent,
                totalProfit: metrics.totalProfit,
                totalLoss: metrics.totalLoss,
                profitFactor: metrics.profitFactor,
                avgRiskReward: metrics.avgRiskReward,
                maxDrawdown: metrics.maxDrawdown,
                maxDrawdownPercent: metrics.maxDrawdownPercent,
                optimalRiskForDD20,
                lastTradeStatus: lastTrade?.status === 'WIN' || lastTrade?.status === 'LOSS' || lastTrade?.status === 'ACTIVE'
                  ? lastTrade.status
                  : undefined,
                trades,
              };

              collectedResults.push(resultItem);
              setResults([...collectedResults]);

              const finishedTrades = trades.filter((t) => t.status === 'WIN' || t.status === 'LOSS');
              collectedTrades.push(...finishedTrades);
              setAllCollectedTrades([...collectedTrades]);
            } catch (e) {
              console.warn(`Error scanning ${pair.symbol}:`, e);
            }
          })
        );

        setProgress((prev) => ({ ...prev, current: Math.min(total, i + batch.length) }));
      }
    } catch {
      setErrorMsg('خطا در دریافت لیست ارزها از بایننس. لطفاً مجدداً بررسی کنید.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleStopScan = () => {
    abortControllerRef.current = true;
    setIsScanning(false);
  };

  const handleClearResults = () => {
    setResults([]);
    setAllCollectedTrades([]);
    try {
      localStorage.removeItem('backtest_scanned_results_v2');
      localStorage.removeItem('backtest_scanned_trades_v2');
    } catch {}
  };

  // =========================================================
  // آمار کلی و تحلیلی برای تب اسکن دستی بازار (بازگردانی کامل)
  // =========================================================
  const totalScanned = results.length;
  const profitableCount = results.filter((r) => r.netProfit > 0).length;
  const totalTradesSum = results.reduce((acc, r) => acc + r.totalTrades, 0);
  const totalWinTradesSum = results.reduce((acc, r) => acc + r.winTrades, 0);
  const totalNetProfitSum = results.reduce((acc, r) => acc + r.netProfit, 0);
  const totalProfitSum = results.reduce((acc, r) => acc + r.totalProfit, 0);
  const totalLossSum = results.reduce((acc, r) => acc + r.totalLoss, 0);

  const portfolioProfitFactor =
    totalLossSum > 0
      ? parseFloat((totalProfitSum / totalLossSum).toFixed(2))
      : totalProfitSum > 0
      ? 99.9
      : 0;

  const portfolioWinRate =
    totalTradesSum > 0
      ? parseFloat(((totalWinTradesSum / totalTradesSum) * 100).toFixed(1))
      : 0;

  // محاسبه منحنی سرمایه و درودان برای چارت تب اسکن
  const equityPoints = useMemo(() => {
    if (allCollectedTrades.length === 0) return [];
    const sortedTrades = [...allCollectedTrades].sort((a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0));

    let currentEquity = capital;
    let peakEquity = capital;

    return sortedTrades.map((t, index) => {
      currentEquity += t.pnl;
      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const ddPercent = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;

      return {
        tradeIndex: index + 1,
        equity: parseFloat(currentEquity.toFixed(2)),
        drawdown: parseFloat(ddPercent.toFixed(2)),
        pnl: t.pnl,
        symbol: t.id.split('-')[2] || '',
        direction: t.direction,
        status: t.status,
      };
    });
  }, [allCollectedTrades, capital]);

  const chartStats = useMemo(() => {
    if (equityPoints.length === 0) {
      return { minEq: capital, maxEq: capital, maxDd: 0 };
    }
    const eqs = equityPoints.map((p) => p.equity);
    const dds = equityPoints.map((p) => p.drawdown);
    return {
      minEq: Math.min(...eqs, capital),
      maxEq: Math.max(...eqs, capital),
      maxDd: Math.max(...dds, 0.1),
    };
  }, [equityPoints, capital]);

  const portfolioMaxDrawdown = useMemo(() => {
    if (chartStats.maxDd > 0.1) return parseFloat(chartStats.maxDd.toFixed(2));
    if (results.length > 0) return parseFloat(Math.max(...results.map((r) => r.maxDrawdownPercent), 0).toFixed(2));
    return 0;
  }, [chartStats.maxDd, results]);

  const portfolioOptimalRisk = useMemo(() => {
    if (portfolioMaxDrawdown > 0) {
      return parseFloat(((riskPercent * 19.0) / portfolioMaxDrawdown).toFixed(2));
    }
    return 0;
  }, [portfolioMaxDrawdown, riskPercent]);

  // فیلتر و مرتب‌سازی جدول اسکن بازار
  const filteredScannerResults = useMemo(() => {
    return results
      .filter((r) => {
        const matchSearch =
          r.pair.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
          r.pair.baseAsset.toLowerCase().includes(searchFilter.toLowerCase());
        const matchProfitable = !onlyProfitable || r.netProfit > 0;
        return matchSearch && matchProfitable;
      })
      .sort((a, b) => {
        if (scannerSortCol === 'symbol') {
          const valA = a.pair.baseAsset;
          const valB = b.pair.baseAsset;
          return scannerSortDir === 'desc'
            ? String(valB).localeCompare(String(valA))
            : String(valA).localeCompare(String(valB));
        }
        const valA: any = a[scannerSortCol as keyof BacktestResultItem];
        const valB: any = b[scannerSortCol as keyof BacktestResultItem];
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return scannerSortDir === 'desc' ? numB - numA : numA - numB;
      });
  }, [results, searchFilter, onlyProfitable, scannerSortCol, scannerSortDir]);

  // خروجی CSV برای اسکنر
  const handleExportScannerCSV = () => {
    if (results.length === 0) return;
    const headers = [
      'ردیف',
      'جفت‌ارز',
      'تعداد معامله',
      'برد',
      'باخت',
      'وین‌ریت (%)',
      'سود خالص (USDT)',
      'درصد سود (%)',
      'فاکتور سود',
      'حداکثر درودان (%)',
      'ریسک بهینه زیر ۲۰٪ (%)',
    ];
    const rows = filteredScannerResults.map((r, idx) => [
      idx + 1,
      r.pair.symbol,
      r.totalTrades,
      r.winTrades,
      r.lossTrades,
      r.winRate,
      r.netProfit,
      r.netProfitPercent,
      r.profitFactor,
      r.maxDrawdownPercent,
      r.optimalRiskForDD20,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `market_scan_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // موتور مدل‌سازی تعاملی چندپارامتری و یادگیری بیزی بر مبنای لاگ تاریخچه
  // (Multi-Parameter Interaction & Bayesian Acquisition Engine)
  // =========================================================================
  const evaluateSingleCombination = (params: {
    atrPeriod: number;
    minCandles: number;
    minCandlesForLongLeg: number;
    atrMultiplier: number;
    longLegAtrMultiplier: number;
    maxBlueLegPercent: number;
    maxBreakoutAtrMultiplier: number;
    maxRiskReward: number;
  }) => {
    const cachedEntries = Array.from(cachedCandlesMapRef.current.values());
    if (cachedEntries.length === 0) return null;

    let totalTradesSum = 0;
    let winTradesSum = 0;
    let lossTradesSum = 0;
    let netProfitSum = 0;
    let grossProfitSum = 0;
    let grossLossSum = 0;
    const allTrades: StrategyTrade[] = [];

    const tempConfig: StrategyConfig = {
      capital,
      selectedStrategyId,
      riskPercent,
      maxRiskReward: params.maxRiskReward,
      maxCandlesToEnter,
      maxTradesPerLeg: 1,
      showOnChart: false,
    };

    for (const item of cachedEntries) {
      const candles = item.candles;
      const atrMetrics = calculateATR(candles, params.atrPeriod);
      const { points } = calculateAtrZigZag(
        candles,
        atrMetrics.atrValues,
        params.atrMultiplier,
        params.minCandles
      );
      const legs = analyzeZigZagLegs(
        points,
        params.minCandlesForLongLeg,
        params.longLegAtrMultiplier,
        params.maxBlueLegPercent,
        params.maxBreakoutAtrMultiplier
      );

      let res;
      if (selectedStrategyId === 'strategy_2_next_pivot') {
        res = runStrategy2Backtest(
          candles,
          points,
          legs,
          tempConfig,
          atrMetrics.atrValues,
          params.atrMultiplier,
          params.minCandles
        );
      } else {
        res = runStrategy1Backtest(candles, points, legs, tempConfig);
      }

      totalTradesSum += res.metrics.totalTrades;
      winTradesSum += res.metrics.winTrades;
      lossTradesSum += res.metrics.lossTrades;
      netProfitSum += res.metrics.netProfit;
      grossProfitSum += res.metrics.totalProfit;
      grossLossSum += res.metrics.totalLoss;

      const closed = res.trades.filter((t) => t.status === 'WIN' || t.status === 'LOSS');
      allTrades.push(...closed);
    }

    allTrades.sort((a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0));
    let curEq = capital;
    let peakEq = capital;
    let maxDd = 0;
    for (const t of allTrades) {
      curEq += t.pnl;
      if (curEq > peakEq) peakEq = curEq;
      const dd = peakEq > 0 ? ((peakEq - curEq) / peakEq) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }

    const winRate = totalTradesSum > 0 ? parseFloat(((winTradesSum / totalTradesSum) * 100).toFixed(1)) : 0;
    const profitFactor = grossLossSum > 0 ? parseFloat((grossProfitSum / grossLossSum).toFixed(2)) : grossProfitSum > 0 ? 99.9 : 0;
    const netProfit = parseFloat(netProfitSum.toFixed(2));
    const maxDrawdown = parseFloat(maxDd.toFixed(2));

    const isValid =
      maxDrawdown <= targetMaxDrawdown &&
      winRate >= targetMinWinRate &&
      totalTradesSum >= targetMinTrades;

    return {
      totalTrades: totalTradesSum,
      winTrades: winTradesSum,
      lossTrades: lossTradesSum,
      winRate,
      profitFactor,
      netProfit,
      maxDrawdown,
      isValid,
    };
  };

  /**
   * تولید هوشمند کاندیدای بعدی بر مبنای تحلیل دقیق لاگ آزمایش‌های گذشته:
   * ۱. تفکیک لاگ به دسته‌های موفق (Good) و ناموفق (Bad)
   * ۲. محاسبه نرخ درست‌نمایی بیزی (Bayesian Likelihood Ratio) برای هر مقدار پارامتر
   * ۳. محاسبه اثر هم‌افزایی متقابل (Interaction Synergy) بین جفت‌های کلیدی
   * ۴. امتیازدهی به کاندیداها با تابع دریافت (Acquisition Function) و تضمین عدم تکرار
   */
  const getNextBayesianCandidateFromLog = (history: OptimizationTrial[]): {
    atrPeriod: number;
    minCandles: number;
    minCandlesForLongLeg: number;
    atrMultiplier: number;
    longLegAtrMultiplier: number;
    maxBlueLegPercent: number;
    maxBreakoutAtrMultiplier: number;
    maxRiskReward: number;
  } | null => {
    // اگر هنوز تعداد تست‌های گذشته کم باشد (کمتر از ۶ تست)، کاوش تنوع اولیه انجام می‌دهیم
    if (history.length < 6) {
      for (let att = 0; att < 300; att++) {
        const candidate = {
          atrPeriod: lockAtrPeriod ? optAtrPeriod : DOMAINS.atrPeriod[att % DOMAINS.atrPeriod.length],
          minCandles: lockMinCandles ? optMinCandles : DOMAINS.minCandles[(att * 2) % DOMAINS.minCandles.length],
          minCandlesForLongLeg: lockMinCandlesLong ? optMinCandlesLong : DOMAINS.minCandlesForLongLeg[att % DOMAINS.minCandlesForLongLeg.length],
          atrMultiplier: lockAtrMultiplier ? optAtrMultiplier : DOMAINS.atrMultiplier[att % DOMAINS.atrMultiplier.length],
          longLegAtrMultiplier: lockLongLegAtrMult ? optLongLegAtrMult : DOMAINS.longLegAtrMultiplier[att % DOMAINS.longLegAtrMultiplier.length],
          maxBlueLegPercent: lockMaxBlueLegPercent ? optMaxBlueLegPercent : DOMAINS.maxBlueLegPercent[att % DOMAINS.maxBlueLegPercent.length],
          maxBreakoutAtrMultiplier: lockMaxBreakoutAtr ? optMaxBreakoutAtr : DOMAINS.maxBreakoutAtrMultiplier[att % DOMAINS.maxBreakoutAtrMultiplier.length],
          maxRiskReward: lockMaxRiskReward ? optMaxRiskReward : DOMAINS.maxRiskReward[att % DOMAINS.maxRiskReward.length],
        };
        const hash = generateConfigHash(candidate);
        if (!visitedHashesRef.current.has(hash)) return candidate;
      }
    }

    // ۱. تفکیک تاریخچه به موفق و ناموفق
    const goodTrials = history.filter(
      (h) => h.isValid || (h.maxDrawdown <= targetMaxDrawdown && h.netProfit > 0)
    );
    const badTrials = history.filter(
      (h) => h.maxDrawdown > targetMaxDrawdown || h.winRate < targetMinWinRate || h.netProfit <= 0
    );

    // ۲. محاسبه جدول فراوانی مقادیر برای هر پارامتر آزاد
    const paramKeys = [
      'atrPeriod',
      'minCandles',
      'minCandlesForLongLeg',
      'atrMultiplier',
      'longLegAtrMultiplier',
      'maxBlueLegPercent',
      'maxBreakoutAtrMultiplier',
      'maxRiskReward',
    ] as const;

    const valueScores: Record<string, Record<number, number>> = {};
    for (const key of paramKeys) {
      valueScores[key] = {};
      const domain = DOMAINS[key];
      for (const val of domain) {
        const goodCount = goodTrials.filter((t) => t[key] === val).length;
        const badCount = badTrials.filter((t) => t[key] === val).length;
        // نسبت بیزی لاپلاس:
        valueScores[key][val] = (goodCount + 1.0) / (badCount + 1.0);
      }
    }

    // ۳. تحلیل هم‌افزایی جفت‌های تاثیرگذار (Interaction Matrix)
    // مثلاً (atrMultiplier, minCandles) و (maxRiskReward, atrMultiplier)
    const synergyPairs = [
      ['atrMultiplier', 'minCandles'],
      ['maxRiskReward', 'atrMultiplier'],
      ['maxBlueLegPercent', 'longLegAtrMultiplier'],
      ['atrPeriod', 'minCandlesForLongLeg'],
    ] as const;

    const pairScores: Record<string, number> = {};
    for (const [k1, k2] of synergyPairs) {
      for (const t of goodTrials) {
        const pKey = `${k1}:${t[k1]}|${k2}:${t[k2]}`;
        pairScores[pKey] = (pairScores[pKey] || 0) + 1.5;
      }
    }

    // ۴. تولید استخر کاندیداهای جدید و انتخاب برترین کاندیدا با تابع دریافت (Acquisition)
    let bestCandidate: any = null;
    let maxAcquisition = -Infinity;

    for (let i = 0; i < 200; i++) {
      const candidate = {
        atrPeriod: lockAtrPeriod ? optAtrPeriod : DOMAINS.atrPeriod[Math.floor(Math.random() * DOMAINS.atrPeriod.length)],
        minCandles: lockMinCandles ? optMinCandles : DOMAINS.minCandles[Math.floor(Math.random() * DOMAINS.minCandles.length)],
        minCandlesForLongLeg: lockMinCandlesLong ? optMinCandlesLong : DOMAINS.minCandlesForLongLeg[Math.floor(Math.random() * DOMAINS.minCandlesForLongLeg.length)],
        atrMultiplier: lockAtrMultiplier ? optAtrMultiplier : DOMAINS.atrMultiplier[Math.floor(Math.random() * DOMAINS.atrMultiplier.length)],
        longLegAtrMultiplier: lockLongLegAtrMult ? optLongLegAtrMult : DOMAINS.longLegAtrMultiplier[Math.floor(Math.random() * DOMAINS.longLegAtrMultiplier.length)],
        maxBlueLegPercent: lockMaxBlueLegPercent ? optMaxBlueLegPercent : DOMAINS.maxBlueLegPercent[Math.floor(Math.random() * DOMAINS.maxBlueLegPercent.length)],
        maxBreakoutAtrMultiplier: lockMaxBreakoutAtr ? optMaxBreakoutAtr : DOMAINS.maxBreakoutAtrMultiplier[Math.floor(Math.random() * DOMAINS.maxBreakoutAtrMultiplier.length)],
        maxRiskReward: lockMaxRiskReward ? optMaxRiskReward : DOMAINS.maxRiskReward[Math.floor(Math.random() * DOMAINS.maxRiskReward.length)],
      };

      const hash = generateConfigHash(candidate);
      if (visitedHashesRef.current.has(hash)) continue;

      // محاسبه امتیاز دریافت بیزی: مجموع لگاریتم شانس‌ها + پاداش هم‌افزایی جفت‌ها + فاکتور اکتشاف
      let acquisition = 0;
      for (const key of paramKeys) {
        acquisition += Math.log(valueScores[key][candidate[key]] || 1.0);
      }

      for (const [k1, k2] of synergyPairs) {
        const pKey = `${k1}:${candidate[k1]}|${k2}:${candidate[k2]}`;
        if (pairScores[pKey]) acquisition += pairScores[pKey] * 0.8;
      }

      // ضریب تنوع و کاوش تصادفی (Exploration Bonus)
      acquisition += Math.random() * 0.5;

      if (acquisition > maxAcquisition) {
        maxAcquisition = acquisition;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  };

  // حلقه پیوسته بهینه‌سازی (اجرای خودکار تا ۱۵ دقیقه یا توقف کاربر)
  const handleStartAutoOptimization = async () => {
    if (cachedCandlesMapRef.current.size === 0) {
      showToast('در حال دانلود داده‌های بازار برای کش اولیه...');
      await handleStartScan(false);
    }

    setIsOptimizing(true);
    stopOptimizerRef.current = false;

    if (sessionSecondsLeft <= 0) {
      setSessionSecondsLeft(900);
      sessionSecondsRef.current = 900;
    }

    let localHistory = [...optHistory];

    while (!stopOptimizerRef.current && sessionSecondsRef.current > 0) {
      // انتخاب هوشمند کاندیدای بعدی با تحلیل لاگ تاریخچه
      const candidate = getNextBayesianCandidateFromLog(localHistory);
      if (!candidate) {
        showToast('✅ تمامی ترکیب‌های ممکن در دامنه‌های انتخابی بدون تکرار بررسی شدند.');
        break;
      }

      const hash = generateConfigHash(candidate);
      visitedHashesRef.current.add(hash);

      const evalRes = evaluateSingleCombination(candidate);
      if (evalRes) {
        const trial: OptimizationTrial = {
          id: localHistory.length + 1,
          hash,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          ...candidate,
          ...evalRes,
        };

        localHistory.push(trial);
        setOptHistory([...localHistory]);
      }

      // تاخیر کوتاه ۲۰ میلی‌ثانیه‌ای برای رندر روان و بدون فریز مرورگر
      await new Promise((r) => setTimeout(r, 20));
    }

    setIsOptimizing(false);
  };

  const handleStopOptimization = () => {
    stopOptimizerRef.current = true;
    setIsOptimizing(false);
  };

  const handleClearOptHistory = () => {
    setOptHistory([]);
    visitedHashesRef.current.clear();
    try {
      localStorage.removeItem('zigzag_optimizer_history_v4');
    } catch {}
    showToast('جدول بهینه‌ساز با موفقیت پاک شد.');
  };

  // مرتب‌سازی جدول بهینه‌ساز بر اساس ستون انتخابی (پیش‌فرض: سود خالص)
  const sortedOptHistory = useMemo(() => {
    let list = optHistory;
    if (filterOnlyValid) {
      list = list.filter((r) => r.isValid);
    }

    return [...list].sort((a, b) => {
      let valA: any = a[optSortColumn];
      let valB: any = b[optSortColumn];
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return optSortDirection === 'desc' ? numB - numA : numA - numB;
    });
  }, [optHistory, filterOnlyValid, optSortColumn, optSortDirection]);

  // بهترین ترکیب برنده مستقیماً از ردیف‌های جدول استخراج می‌شود:
  const bestWinningRow = useMemo(() => {
    if (optHistory.length === 0) return null;

    // ۱. ردیف‌هایی از جدول که هر ۳ شرط را دارا هستند:
    const validRows = optHistory.filter(
      (r) =>
        r.maxDrawdown <= targetMaxDrawdown &&
        r.winRate >= targetMinWinRate &&
        r.totalTrades >= targetMinTrades
    );

    if (validRows.length > 0) {
      // ردیفی با بیشترین سود خالص
      return [...validRows].sort((a, b) => b.netProfit - a.netProfit)[0];
    }

    // ۲. در غیر این صورت، پر سودترین ردیف جدول را نمایش بده
    return [...optHistory].sort((a, b) => b.netProfit - a.netProfit)[0];
  }, [optHistory, targetMaxDrawdown, targetMinWinRate, targetMinTrades]);

  // اعمال بهترین پارامترهای جدول به چارت زنده
  const handleApplyBestToChart = () => {
    if (!bestWinningRow || !onUpdateZigZagSettings) return;
    onUpdateZigZagSettings({
      atrPeriod: bestWinningRow.atrPeriod,
      minCandles: bestWinningRow.minCandles,
      minCandlesForLongLeg: bestWinningRow.minCandlesForLongLeg,
      atrMultiplier: bestWinningRow.atrMultiplier,
      longLegAtrMultiplier: bestWinningRow.longLegAtrMultiplier,
      maxBlueLegPercent: bestWinningRow.maxBlueLegPercent,
      maxBreakoutAtrMultiplier: bestWinningRow.maxBreakoutAtrMultiplier,
    });
    setOptMaxRiskReward(bestWinningRow.maxRiskReward);
    showToast('✨ بهترین ترکیب برنده جدول به اندیکاتور زیگ‌زاگ چارت اعمال شد!');
  };

  // خروجی JSON
  const handleExportJSON = () => {
    const payload = {
      applet: 'Binance ZigZag Strategy Optimizer',
      exportedAt: new Date().toISOString(),
      strategyId: selectedStrategyId,
      constraints: {
        targetMaxDrawdown,
        targetMinWinRate,
        targetMinTrades,
      },
      bestWinningRow,
      totalTested: optHistory.length,
      history: optHistory,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zigzag_optimizer_${selectedStrategyId}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('💾 فایل JSON شامل تمام نتایج جدول و پارامترها دانلود شد.');
  };

  const handleImportJSONClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') throw new Error('فرمت نامعتبر است');

        if (parsed.strategyId) setSelectedStrategyId(parsed.strategyId);
        if (parsed.constraints) {
          if (parsed.constraints.targetMaxDrawdown) setTargetMaxDrawdown(parsed.constraints.targetMaxDrawdown);
          if (parsed.constraints.targetMinWinRate) setTargetMinWinRate(parsed.constraints.targetMinWinRate);
          if (parsed.constraints.targetMinTrades) setTargetMinTrades(parsed.constraints.targetMinTrades);
        }

        if (Array.isArray(parsed.history)) {
          setOptHistory(parsed.history);
          for (const item of parsed.history) {
            visitedHashesRef.current.add(item.hash || generateConfigHash(item));
          }
        }

        showToast(`✅ فایل JSON با موفقیت بارگذاری شد (${parsed.history?.length || 0} تست اضافه شد).`);
      } catch (err: any) {
        alert('خطا در بارگذاری فایل: ' + (err?.message || 'فایل JSON نامعتبر است'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOptSort = (col: OptSortCol) => {
    if (optSortColumn === col) {
      setOptSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setOptSortColumn(col);
      setOptSortDirection('desc');
    }
  };

  const renderOptSortArrow = (col: OptSortCol) => {
    if (optSortColumn !== col) return <ArrowUpDown className="w-3 h-3 text-gray-500 inline-block mr-1 opacity-50" />;
    return optSortDirection === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400 inline-block mr-1" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400 inline-block mr-1" />
    );
  };

  const formatTimer = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs transition-opacity duration-200 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'
      }`}
      dir="rtl"
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

      <div
        className="w-full max-w-6xl max-h-[94vh] bg-[#121622] border border-[#2b3548] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Toast notification */}
        {toastMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-black font-extrabold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-top duration-200 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 1. Header with Tab Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#232c3d] bg-[#0d1118] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  بک‌تست چندارزی و بهینه‌ساز بیزی چندپارامتری
                </h3>
                {cachedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>{cachedCount} جفت‌ارز در حافظه کش</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                بررسی هوشمند لاگ آزمایش‌های پیشین، تحلیل اثر متقابل پارامترها و سشن‌های کنترل‌شده ۱۵ دقیقه‌ای
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-[#181f2f] p-1 rounded-xl border border-[#2d384c]">
            <button
              type="button"
              onClick={() => setActiveTab('scanner')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'scanner'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>اسکن دستی بازار</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('optimizer')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'optimizer'
                  ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-cyan-400 hover:text-cyan-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>بهینه‌ساز بیزی (۸ پارامتر)</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#20293a] transition-colors cursor-pointer mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: STANDARD BACKTEST SCANNER (با تمام آمارها و نمودارها) */}
        {/* ========================================================= */}
        {activeTab === 'scanner' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3.5">
            {/* فرم پارامترها */}
            <div className="p-3.5 border-b border-[#232c3d] bg-[#151a26] rounded-xl space-y-3 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#283244]">
                  <label className="text-[10px] font-semibold text-amber-400 block mb-1">استراتژی:</label>
                  <select
                    value={selectedStrategyId}
                    onChange={(e) => setSelectedStrategyId(e.target.value as any)}
                    disabled={isScanning}
                    className="w-full px-2 py-1.5 bg-[#171d28] border border-[#2e394e] rounded-lg text-white text-xs font-medium focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-50"
                  >
                    <option value="strategy_1_e_breakout">استراتژی ۱: شکست نقطه E (تارگت A / استاپ F)</option>
                    <option value="strategy_2_next_pivot">استراتژی ۲: اولین تشکیل لگ بعد از F (تارگت R:R)</option>
                  </select>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#283244]">
                  <label className="text-[10px] font-semibold text-gray-300 block mb-1">دامنه ارزها:</label>
                  <select
                    value={universeOption}
                    onChange={(e) => setUniverseOption(e.target.value as any)}
                    disabled={isScanning}
                    className="w-full px-2 py-1.5 bg-[#171d28] border border-[#2e394e] rounded-lg text-white text-xs font-medium focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-50"
                  >
                    <option value="all_1m">تمام ارزهای با حجم بالای ۱ میلیون دلار ($1M+) بدون سقف</option>
                    <option value="top_50">۵۰ ارز برتر بازار (Top 50)</option>
                    <option value="top_30">۳۰ ارز نقدشونده اول (Top 30)</option>
                  </select>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#283244] grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">تایم‌فریم:</label>
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                      disabled={isScanning}
                      className="w-full px-2 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-white text-xs font-medium focus:outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="5m">۵ دقیقه (5m)</option>
                      <option value="15m">۱۵ دقیقه (15m)</option>
                      <option value="1h">۱ ساعته (1h)</option>
                      <option value="4h">۴ ساعته (4h)</option>
                      <option value="1d">روزانه (1d)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">تعداد کندل:</label>
                    <select
                      value={candleHistoryLimit}
                      onChange={(e) => setCandleHistoryLimit(Number(e.target.value))}
                      disabled={isScanning}
                      className="w-full px-2 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-white text-xs font-medium focus:outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value={300}>۳۰۰ کندل</option>
                      <option value={500}>۵۰۰ کندل</option>
                      <option value={1000}>۱,۰۰۰ کندل</option>
                      <option value={5000}>۵,۰۰۰ کندل</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#283244] flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">ریسک (%):</label>
                    <input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.1}
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 1)}
                      disabled={isScanning}
                      className="w-full px-2 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-rose-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">حداکثر R:R:</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={0.5}
                      value={optMaxRiskReward}
                      onChange={(e) => setOptMaxRiskReward(parseFloat(e.target.value) || 5)}
                      disabled={isScanning}
                      className="w-full px-2 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-emerald-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                <div className="flex items-center gap-2">
                  {!isScanning ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartScan(false)}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>شروع اسکن کامل بازار (دانلود زنده $1M+)</span>
                      </button>

                      {cachedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleStartScan(true)}
                          className="px-4 py-2 rounded-xl bg-[#20293d] hover:bg-[#2d3a56] text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>اجرا روی دیتای کش‌شده ({cachedCount} ارز)</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopScan}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>توقف اسکن</span>
                    </button>
                  )}

                  {isScanning && (
                    <div className="flex items-center gap-2 text-xs text-amber-300 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>اسکن در حال انجام: <strong>{progress.currentSymbol}</strong> ({progress.current}/{progress.total})</span>
                    </div>
                  )}
                </div>

                {results.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportScannerCSV}
                      className="px-3 py-1.5 rounded-lg bg-[#1a2130] hover:bg-[#253046] text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>خروجی اکسل (CSV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearResults}
                      className="p-1.5 rounded-lg bg-[#1a2130] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2b3548] cursor-pointer"
                      title="پاک کردن نتایج اسکن"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* کارت‌های آمار استراتژی (بازگردانی دقیق طبق درخواست کاربر) */}
            {results.length > 0 && (
              <div className="p-3 bg-[#0f131c] border border-[#232c3d] rounded-xl shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#141924] border border-[#263143]">
                    <span className="text-[10px] text-gray-400 block mb-0.5">ارزهای بررسی‌شده</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold text-white font-mono">{totalScanned}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">({profitableCount} سودده)</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#141924] border border-[#263143]">
                    <span className="text-[10px] text-gray-400 block mb-0.5">مجموع سود خالص</span>
                    <span className={`text-base font-extrabold font-mono ${totalNetProfitSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalNetProfitSum >= 0 ? '+' : ''}
                      {totalNetProfitSum.toLocaleString()} <span className="text-[10px]">USDT</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#141924] border border-[#263143]">
                    <span className="text-[10px] text-gray-400 block mb-0.5">
                      وین‌ریت کل ({totalWinTradesSum}/{totalTradesSum})
                    </span>
                    <span className="text-base font-extrabold text-sky-400 font-mono">{portfolioWinRate}%</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#141924] border border-[#263143]">
                    <span className="text-[10px] text-gray-400 block mb-0.5">حداکثر درودان کل</span>
                    <div className="flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-base font-extrabold text-amber-400 font-mono">{portfolioMaxDrawdown}%</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#181f2f] border border-amber-500/40">
                    <span className="text-[10px] text-amber-300 font-semibold block mb-0.5">
                      ریسک بهینه (DD &lt; 20%)
                    </span>
                    <div className="flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-base font-extrabold text-emerald-400 font-mono">
                        {portfolioOptimalRisk > 0 ? `${portfolioOptimalRisk}%` : '—'}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-400 block mt-0.5 font-mono">
                      بر مبنای درودان {portfolioMaxDrawdown}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#141924] border border-[#263143]">
                    <span className="text-[10px] text-gray-400 block mb-0.5">پروفیت فکتور (PF)</span>
                    <div className="flex items-baseline gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span
                        className={`text-base font-extrabold font-mono ${
                          portfolioProfitFactor >= 1.5
                            ? 'text-emerald-400'
                            : portfolioProfitFactor >= 1.0
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {portfolioProfitFactor > 0 ? portfolioProfitFactor : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* نمودارهای تصویری تعاملی Equity & Drawdown (بازگردانی دقیق طبق درخواست کاربر) */}
            {equityPoints.length > 1 && (
              <div className="p-3 bg-[#0d1017] border border-[#232c3d] rounded-xl shrink-0">
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-[#1c2433]">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      نمودار تجمعی معاملات پرتفوی ({equityPoints.length} معامله ثبت‌شده)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#161c28] p-0.5 rounded-lg border border-[#263143]">
                    <button
                      type="button"
                      onClick={() => setActiveChartTab('both')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        activeChartTab === 'both' ? 'bg-amber-400 text-black font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      هر دو
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChartTab('equity')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        activeChartTab === 'equity' ? 'bg-amber-400 text-black font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      ارزش سرمایه (Equity)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChartTab('drawdown')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        activeChartTab === 'drawdown' ? 'bg-amber-400 text-black font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      افت سرمایه (Drawdown)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(activeChartTab === 'both' || activeChartTab === 'equity') && (
                    <div className="bg-[#121622] p-2 rounded-xl border border-[#212b3b] relative">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                        <span className="text-emerald-400 font-bold">رشد تجمعی ارزش سرمایه (USDT)</span>
                        <span className="font-mono">
                          پایان: <strong>{equityPoints[equityPoints.length - 1].equity.toLocaleString()}</strong> USDT
                        </span>
                      </div>
                      <div className="h-28 w-full relative">
                        <svg viewBox="0 0 500 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                          <defs>
                            <linearGradient id="eqGradScan" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d={`M 0,100 ${equityPoints
                              .map((p, idx) => {
                                const x = (idx / (equityPoints.length - 1)) * 500;
                                const yRange = chartStats.maxEq - chartStats.minEq || 1;
                                const y = 100 - ((p.equity - chartStats.minEq) / yRange) * 90 - 5;
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ')} L 500,100 Z`}
                            fill="url(#eqGradScan)"
                          />
                          <path
                            d={`M ${equityPoints
                              .map((p, idx) => {
                                const x = (idx / (equityPoints.length - 1)) * 500;
                                const yRange = chartStats.maxEq - chartStats.minEq || 1;
                                const y = 100 - ((p.equity - chartStats.minEq) / yRange) * 90 - 5;
                                return `${idx === 0 ? '' : 'L '}${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ')}`}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {(activeChartTab === 'both' || activeChartTab === 'drawdown') && (
                    <div className="bg-[#121622] p-2 rounded-xl border border-[#212b3b] relative">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                        <span className="text-rose-400 font-bold">منحنی افت سرمایه (Drawdown %)</span>
                        <span className="font-mono text-rose-400">
                          حداکثر افت: <strong>{portfolioMaxDrawdown}%</strong>
                        </span>
                      </div>
                      <div className="h-28 w-full relative">
                        <svg viewBox="0 0 500 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                          <defs>
                            <linearGradient id="ddGradScan" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
                              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.4" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="5" x2="500" y2="5" stroke="#4b5563" strokeWidth="1" />
                          <path
                            d={`M 0,5 ${equityPoints
                              .map((p, idx) => {
                                const x = (idx / (equityPoints.length - 1)) * 500;
                                const y = 5 + (p.drawdown / Math.max(20, chartStats.maxDd)) * 90;
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ')} L 500,5 Z`}
                            fill="url(#ddGradScan)"
                          />
                          <path
                            d={`M ${equityPoints
                              .map((p, idx) => {
                                const x = (idx / (equityPoints.length - 1)) * 500;
                                const y = 5 + (p.drawdown / Math.max(20, chartStats.maxDd)) * 90;
                                return `${idx === 0 ? '' : 'L '}${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ')}`}
                            fill="none"
                            stroke="#f43f5e"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* فیلتر و جدول نتایج اسکن */}
            {results.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[#121622] p-2 rounded-xl border border-[#232c3d]">
                <div className="flex items-center gap-3 flex-1 max-w-sm">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="جستجوی نماد (BTC, ETH, SOL)..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 bg-[#0e121a] border border-[#283244] rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={onlyProfitable}
                      onChange={(e) => setOnlyProfitable(e.target.checked)}
                      className="rounded bg-[#171d28] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>فقط سودده</span>
                  </label>
                </div>
                <span className="text-[11px] text-gray-400">
                  تعداد کل ارزهای اسکن‌شده: <strong>{filteredScannerResults.length}</strong>
                </span>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-[#242e40]">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#0e121a] text-gray-300 font-semibold border-b border-[#232c3d]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">جفت‌ارز</th>
                    <th className="py-2.5 px-3 text-center">تعداد معامله</th>
                    <th className="py-2.5 px-3 text-center">وین‌ریت</th>
                    <th className="py-2.5 px-3 text-center">سود خالص</th>
                    <th className="py-2.5 px-3 text-center">Profit Factor</th>
                    <th className="py-2.5 px-3 text-center">درصد درودان</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400 font-bold">ریسک بهینه (DD &lt; 20%)</th>
                    <th className="py-2.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2736] font-mono">
                  {filteredScannerResults.map((item, idx) => (
                    <tr key={item.pair.symbol} className="hover:bg-[#161c28]">
                      <td className="py-2.5 px-3 text-gray-500 text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-white">{item.pair.baseAsset}/USDT</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-bold">{item.totalTrades}</span>
                        <span className="text-[10px] text-gray-500 ml-1">({item.winTrades}W / {item.lossTrades}L)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-sky-400 font-bold">{item.winRate}%</td>
                      <td className={`py-2.5 px-3 text-center font-bold ${item.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.netProfit >= 0 ? '+' : ''}{item.netProfit.toLocaleString()} ({item.netProfitPercent}%)
                      </td>
                      <td className="py-2.5 px-3 text-center">{item.profitFactor}</td>
                      <td className="py-2.5 px-3 text-center text-amber-400">{item.maxDrawdownPercent}%</td>
                      <td className="py-2.5 px-3 text-center text-emerald-300 font-bold bg-emerald-950/20">{item.optimalRiskForDD20}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectPairAndClose(item.pair)}
                          className="px-2 py-1 rounded bg-[#202738] hover:bg-amber-400 hover:text-black font-sans text-[11px] font-bold"
                        >
                          مشاهده چارت
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: OPTIMIZER (بهینه‌ساز بیزی چندپارامتری هوشمند) */}
        {/* ========================================================= */}
        {activeTab === 'optimizer' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3.5">
            {/* ۱. کادر مشخص‌کننده استراتژی و دکمه‌های JSON */}
            <div className="p-3 rounded-2xl bg-[#141b27] border border-[#28374d] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center text-black font-bold shadow-md shadow-cyan-500/20">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">استراتژی تحت بهینه‌سازی:</span>
                    <span className="text-xs font-extrabold text-cyan-300 font-sans px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40">
                      {selectedStrategyId === 'strategy_1_e_breakout'
                        ? 'استراتژی ۱: شکست نقطه E (تارگت A / استاپ F)'
                        : 'استراتژی ۲: اولین تشکیل لگ بعد از F (تارگت R:R)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                    تایم‌فریم تست: <strong className="text-white font-mono">{timeframe}</strong> | ریسک تست: <strong className="text-white font-mono">{riskPercent}%</strong> | سرمایه: <strong className="text-white font-mono">{capital.toLocaleString()} USDT</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedStrategyId}
                  onChange={(e) => setSelectedStrategyId(e.target.value as any)}
                  disabled={isOptimizing}
                  className="px-3 py-1.5 bg-[#0e121a] border border-[#2e3c52] rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer disabled:opacity-50"
                >
                  <option value="strategy_1_e_breakout">تغییر استراتژی به: شکست نقطه E</option>
                  <option value="strategy_2_next_pivot">تغییر استراتژی به: تشکیل لگ بعد از F</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="px-3 py-1.5 rounded-xl bg-[#1b2230] hover:bg-[#253046] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="دانلود کامل نتایج جدول و پارامترها به صورت JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleImportJSONClick}
                  className="px-3 py-1.5 rounded-xl bg-[#1b2230] hover:bg-[#253046] text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="بارگذاری نتایج از فایل JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>بارگذاری JSON</span>
                </button>

                {optHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearOptHistory}
                    className="p-1.5 rounded-xl bg-[#1b2230] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2b3548] cursor-pointer"
                    title="پاک کردن جدول تاریخچه آزمایش‌ها"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ۲. شروط اولیه ارزیابی مدل */}
            <div className="p-3 rounded-2xl bg-[#161d2b] border border-[#26354a] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-[#0e121a] p-2 rounded-xl border border-[#222d3e]">
                <label className="text-[10px] text-gray-300 block mb-1">
                  حداکثر درودان مجاز (Max Drawdown %):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step={0.5}
                    min={5}
                    max={50}
                    value={targetMaxDrawdown}
                    onChange={(e) => setTargetMaxDrawdown(parseFloat(e.target.value) || 20)}
                    className="w-full px-2 py-1 bg-[#161c28] border border-[#2d384c] rounded-lg text-amber-400 font-mono font-bold text-xs text-center focus:outline-none"
                  />
                  <span className="text-xs font-bold text-gray-400">%</span>
                </div>
              </div>

              <div className="bg-[#0e121a] p-2 rounded-xl border border-[#222d3e]">
                <label className="text-[10px] text-gray-300 block mb-1">
                  حداقل وین‌ریت مجاز (Min Win Rate %):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step={1}
                    min={10}
                    max={90}
                    value={targetMinWinRate}
                    onChange={(e) => setTargetMinWinRate(parseFloat(e.target.value) || 40)}
                    className="w-full px-2 py-1 bg-[#161c28] border border-[#2d384c] rounded-lg text-sky-400 font-mono font-bold text-xs text-center focus:outline-none"
                  />
                  <span className="text-xs font-bold text-gray-400">%</span>
                </div>
              </div>

              <div className="bg-[#0e121a] p-2 rounded-xl border border-[#222d3e]">
                <label className="text-[10px] text-gray-300 block mb-1">
                  حداقل تعداد کل معاملات (Min Total Trades):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step={10}
                    min={20}
                    max={1000}
                    value={targetMinTrades}
                    onChange={(e) => setTargetMinTrades(parseInt(e.target.value, 10) || 100)}
                    className="w-full px-2 py-1 bg-[#161c28] border border-[#2d384c] rounded-lg text-emerald-400 font-mono font-bold text-xs text-center focus:outline-none"
                  />
                  <span className="text-xs font-bold text-gray-400">معامله</span>
                </div>
              </div>
            </div>

            {/* ۳. تنظیمات ۸ پارامتر با ورودی و چک‌باکس قفل */}
            <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#242e40]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">
                  تنظیمات ۸ پارامتر استراتژی برای بهینه‌سازی بیزی:
                </span>
                <span className="text-[11px] text-gray-400">
                  * هر پارامتری که تیک زده شود، <strong className="text-amber-400">قفل</strong> و مقدار آن ثابت می‌ماند.
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* ۱. atrPeriod */}
                <div className={`p-2 rounded-xl border ${lockAtrPeriod ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۱. دوره ATR</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockAtrPeriod}
                        onChange={(e) => setLockAtrPeriod(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockAtrPeriod ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    value={optAtrPeriod}
                    disabled={lockAtrPeriod}
                    onChange={(e) => setOptAtrPeriod(parseInt(e.target.value, 10) || 55)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۲. minCandles */}
                <div className={`p-2 rounded-xl border ${lockMinCandles ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۲. حداقل کندل</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockMinCandles}
                        onChange={(e) => setLockMinCandles(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockMinCandles ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    value={optMinCandles}
                    disabled={lockMinCandles}
                    onChange={(e) => setOptMinCandles(parseInt(e.target.value, 10) || 3)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۳. minCandlesForLongLeg */}
                <div className={`p-2 rounded-xl border ${lockMinCandlesLong ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۳. کندل لگ بلند</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockMinCandlesLong}
                        onChange={(e) => setLockMinCandlesLong(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockMinCandlesLong ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    value={optMinCandlesLong}
                    disabled={lockMinCandlesLong}
                    onChange={(e) => setOptMinCandlesLong(parseInt(e.target.value, 10) || 20)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۴. atrMultiplier */}
                <div className={`p-2 rounded-xl border ${lockAtrMultiplier ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۴. ضریب عادی</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockAtrMultiplier}
                        onChange={(e) => setLockAtrMultiplier(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockAtrMultiplier ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step={0.1}
                    value={optAtrMultiplier}
                    disabled={lockAtrMultiplier}
                    onChange={(e) => setOptAtrMultiplier(parseFloat(e.target.value) || 3.0)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۵. longLegAtrMultiplier */}
                <div className={`p-2 rounded-xl border ${lockLongLegAtrMult ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۵. ضریب لگ بزرگ</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockLongLegAtrMult}
                        onChange={(e) => setLockLongLegAtrMult(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockLongLegAtrMult ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step={0.5}
                    value={optLongLegAtrMult}
                    disabled={lockLongLegAtrMult}
                    onChange={(e) => setOptLongLegAtrMult(parseFloat(e.target.value) || 10.0)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۶. maxBlueLegPercent */}
                <div className={`p-2 rounded-xl border ${lockMaxBlueLegPercent ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۶. سقف لگ آبی %</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockMaxBlueLegPercent}
                        onChange={(e) => setLockMaxBlueLegPercent(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockMaxBlueLegPercent ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step={5}
                    value={optMaxBlueLegPercent}
                    disabled={lockMaxBlueLegPercent}
                    onChange={(e) => setOptMaxBlueLegPercent(parseFloat(e.target.value) || 60)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۷. maxBreakoutAtrMultiplier */}
                <div className={`p-2 rounded-xl border ${lockMaxBreakoutAtr ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۷. نفوذ شکست (ATR)</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockMaxBreakoutAtr}
                        onChange={(e) => setLockMaxBreakoutAtr(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockMaxBreakoutAtr ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step={0.5}
                    value={optMaxBreakoutAtr}
                    disabled={lockMaxBreakoutAtr}
                    onChange={(e) => setOptMaxBreakoutAtr(parseFloat(e.target.value) || 5.0)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-white font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>

                {/* ۸. maxRiskReward */}
                <div className={`p-2 rounded-xl border ${lockMaxRiskReward ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-[#2a364a]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-200">۸. ریسک به ریوارد (R:R)</label>
                    <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockMaxRiskReward}
                        onChange={(e) => setLockMaxRiskReward(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockMaxRiskReward ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step={0.5}
                    value={optMaxRiskReward}
                    disabled={lockMaxRiskReward}
                    onChange={(e) => setOptMaxRiskReward(parseFloat(e.target.value) || 5.0)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-emerald-400 font-bold font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                  />
                </div>
              </div>

              {/* کنترل اجرای سشن ۱۵ دقیقه‌ای */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-[#232c3d]">
                <div className="flex items-center gap-2">
                  {!isOptimizing ? (
                    <button
                      type="button"
                      onClick={handleStartAutoOptimization}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 hover:brightness-110 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {sessionSecondsLeft <= 0 ? 'ادامه سشن ۱۵ دقیقه‌ای جدید' : 'شروع بهینه‌سازی خودکار بیزی (سشن پیوسته ۱۵ دقیقه‌ای)'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopOptimization}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-500/20"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>توقف فرآیند (Pause)</span>
                    </button>
                  )}

                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                    isOptimizing
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                      : 'bg-[#171d2b] border-[#2b374c] text-gray-300'
                  }`}>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>زمان باقی‌مانده سشن: {formatTimer(sessionSecondsLeft)}</span>
                  </div>

                  <span className="text-[11px] text-gray-400">
                    ({optHistory.length} آزمایش در جدول ثبت شده)
                  </span>
                </div>

                {bestWinningRow && (
                  <button
                    type="button"
                    onClick={handleApplyBestToChart}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="اعمال مستقیم برنده جدول به اندیکاتور زیگ‌زاگ چارت"
                  >
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>اعمال بهترین ترکیب جدول به چارت اصلی</span>
                  </button>
                )}
              </div>
            </div>

            {/* ۴. کارت ترکیب برنده (مستقیماً از ردیف‌های جدول استخراج شده است) */}
            {bestWinningRow && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-[#151c28] to-[#121622] border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-amber-400">بهترین ترکیب برنده از جدول (Winning Row)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-400/20 text-amber-300">ردیف #{bestWinningRow.id}</span>
                      {bestWinningRow.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✅ پاس‌کننده هر ۳ شرط (DD &lt; {targetMaxDrawdown}% | WR &gt; {targetMinWinRate}% | Trades &ge; {targetMinTrades})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          ⚠️ پر سودترین ردیف جدول (در انتظار پاس شدن شروط)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-300 mt-1 font-mono flex flex-wrap gap-2">
                      <span>سود خالص: <strong className="text-emerald-400">+{bestWinningRow.netProfit.toLocaleString()}</strong> USDT</span>
                      <span>•</span>
                      <span>وین‌ریت: <strong className="text-sky-400">{bestWinningRow.winRate}%</strong></span>
                      <span>•</span>
                      <span>درودان: <strong className="text-amber-400">{bestWinningRow.maxDrawdown}%</strong></span>
                      <span>•</span>
                      <span>معاملات: <strong className="text-white">{bestWinningRow.totalTrades}</strong></span>
                      <span>•</span>
                      <span>Profit Factor: <strong className="text-emerald-400">{bestWinningRow.profitFactor}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 font-mono bg-[#0d1017] px-3 py-1.5 rounded-xl border border-[#232c3d]">
                  ATR:{bestWinningRow.atrPeriod} | MinC:{bestWinningRow.minCandles} | MinLong:{bestWinningRow.minCandlesForLongLeg} | Mult:{bestWinningRow.atrMultiplier}x | LongMult:{bestWinningRow.longLegAtrMultiplier}x | Blue%:{bestWinningRow.maxBlueLegPercent}% | Break:{bestWinningRow.maxBreakoutAtrMultiplier}x | R:R:{bestWinningRow.maxRiskReward}
                </div>
              </div>
            )}

            {/* ۵. جدول تاریخچه تمام آزمایش‌ها (۸ پارامتر + نتایج، مرتب‌شده بر اساس سود خالص) */}
            <div className="flex-1 min-h-60 rounded-xl border border-[#242e40] overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-[#0e121a] border-b border-[#232c3d] flex items-center justify-between text-xs font-bold text-gray-300">
                <div className="flex items-center gap-3">
                  <span>جدول آزمایش ترکیبات بیزی ({sortedOptHistory.length} ردیف)</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 font-normal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterOnlyValid}
                      onChange={(e) => setFilterOnlyValid(e.target.checked)}
                      className="rounded bg-[#171d28] border-gray-600 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>فقط ردیف‌های قبول (پاس‌کننده هر ۳ شرط)</span>
                  </label>
                </div>
                <span className="text-[11px] text-gray-400 font-normal">
                  * سیستم قبل از هر تست لاگ را تحلیل کرده و جدول را بر اساس <strong className="text-emerald-400">بیشترین سود خالص</strong> مرتب می‌کند.
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#10141c] text-gray-400 border-b border-[#232c3d] select-none">
                    <tr>
                      <th className="py-2.5 px-2.5">#</th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('atrPeriod')}>
                        دوره ATR {renderOptSortArrow('atrPeriod')}
                      </th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('minCandles')}>
                        حداقل کندل {renderOptSortArrow('minCandles')}
                      </th>
                      <th className="py-2.5 px-2 text-center">کندل لگ بلند</th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('atrMultiplier')}>
                        ضریب عادی {renderOptSortArrow('atrMultiplier')}
                      </th>
                      <th className="py-2.5 px-2 text-center">ضریب بزرگ</th>
                      <th className="py-2.5 px-2 text-center">سقف آبی%</th>
                      <th className="py-2.5 px-2 text-center">نفوذ شکست</th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('maxRiskReward')}>
                        R:R {renderOptSortArrow('maxRiskReward')}
                      </th>
                      <th className="py-2.5 px-2.5 text-center cursor-pointer text-emerald-400 font-bold" onClick={() => handleOptSort('netProfit')}>
                        سود خالص (USDT) {renderOptSortArrow('netProfit')}
                      </th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('winRate')}>
                        وین‌ریت {renderOptSortArrow('winRate')}
                      </th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('maxDrawdown')}>
                        درودان {renderOptSortArrow('maxDrawdown')}
                      </th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('totalTrades')}>
                        معاملات {renderOptSortArrow('totalTrades')}
                      </th>
                      <th className="py-2.5 px-2 text-center cursor-pointer" onClick={() => handleOptSort('profitFactor')}>
                        PF {renderOptSortArrow('profitFactor')}
                      </th>
                      <th className="py-2.5 px-2.5 text-center">وضعیت شروط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2736] font-mono text-[11px]">
                    {sortedOptHistory.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="py-8 text-center text-gray-500 font-sans">
                          هنوز آزمایشی ثبت نشده است. دکمه «شروع بهینه‌سازی خودکار بیزی» را بزنید تا ترکیبات بررسی شوند.
                        </td>
                      </tr>
                    ) : (
                      sortedOptHistory.map((row) => {
                        const isTheBest = bestWinningRow && bestWinningRow.id === row.id;
                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-[#161c28] transition-colors ${
                              isTheBest ? 'bg-amber-950/30 border-r-4 border-amber-400' : ''
                            }`}
                          >
                            <td className="py-2 px-2.5">
                              <span className="font-bold text-white">#{row.id}</span>
                              {isTheBest && (
                                <span className="mr-1 text-[10px] text-amber-400 font-sans font-bold">🏆 برنده</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.atrPeriod}</td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.minCandles}</td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.minCandlesForLongLeg}</td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.atrMultiplier}×</td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.longLegAtrMultiplier}×</td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.maxBlueLegPercent}%</td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.maxBreakoutAtrMultiplier}×</td>
                            <td className="py-2 px-2 text-center font-bold text-cyan-300">{row.maxRiskReward}</td>
                            <td className={`py-2 px-2.5 text-center font-extrabold ${row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {row.netProfit >= 0 ? '+' : ''}{row.netProfit.toLocaleString()}
                            </td>
                            <td className={`py-2 px-2 text-center font-bold ${row.winRate >= targetMinWinRate ? 'text-sky-400' : 'text-rose-400'}`}>
                              {row.winRate}%
                            </td>
                            <td className={`py-2 px-2 text-center font-bold ${row.maxDrawdown <= targetMaxDrawdown ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {row.maxDrawdown}%
                            </td>
                            <td className={`py-2 px-2 text-center font-bold ${row.totalTrades >= targetMinTrades ? 'text-gray-200' : 'text-amber-400'}`}>
                              {row.totalTrades}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-300">{row.profitFactor}</td>
                            <td className="py-2 px-2.5 text-center font-sans">
                              {row.isValid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  ✅ قبول
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  ❌ رد
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#232c3d] bg-[#0d1118] shrink-0 flex items-center justify-between text-xs text-gray-400">
          <div>
            * داده‌های بازار در حافظه کش ذخیره می‌شوند تا تست‌های بهینه‌سازی بدون نیاز به دانلود مجدد اجرا شوند. تمام حالت‌های تست‌شده ثبت شده و از آزمون تکراری جلوگیری می‌شود.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#202738] hover:bg-[#2b3548] text-white font-bold transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

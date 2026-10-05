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
  ArrowLeft,
  ArrowRight,
  LineChart,
  Download,
  Camera,
  ZoomIn,
  ZoomOut,
  MoveHorizontal,
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
import { fetchUSDTMarketPairs, fetchFuturesMarketPairs, fetchKlines } from '../services/binance';
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
  totalFee: number;
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
}

export interface ParameterRange {
  min: number;
  max: number;
  bestVal: number;
  bestValProfit?: number;
  step: number;
}

export interface AdaptiveRanges {
  atrPeriod: ParameterRange;
  minCandles: ParameterRange;
  minCandlesForLongLeg: ParameterRange;
  atrMultiplier: ParameterRange;
  longLegAtrMultiplier: ParameterRange;
  maxBlueLegPercent: ParameterRange;
  maxBreakoutAtrMultiplier: ParameterRange;
  maxRiskReward: ParameterRange;
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
  | 'totalFee'
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

// دامنه‌های اولیه پیش‌فرض
const DEFAULT_RANGES: AdaptiveRanges = {
  atrPeriod: { min: 15, max: 100, bestVal: 55, step: 5 },
  minCandles: { min: 1, max: 8, bestVal: 3, step: 1 },
  minCandlesForLongLeg: { min: 10, max: 36, bestVal: 20, step: 2 },
  atrMultiplier: { min: 1.5, max: 5.0, bestVal: 3.0, step: 0.5 },
  longLegAtrMultiplier: { min: 6.0, max: 18.0, bestVal: 10.0, step: 1.0 },
  maxBlueLegPercent: { min: 35, max: 85, bestVal: 60, step: 5 },
  maxBreakoutAtrMultiplier: { min: 2.0, max: 7.0, bestVal: 5.0, step: 0.5 },
  maxRiskReward: { min: 1.0, max: 10.0, bestVal: 2.0, step: 0.5 },
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

// حافظه کش ماندگار کندل‌های دانلودشده در طول سشن مرورگر
const GLOBAL_CANDLE_CACHE = new Map<string, { pair: CryptoPair; candles: CandleData[]; timeframe: string }>();

export const BacktestScannerModal: React.FC<BacktestScannerModalProps> = ({
  isOpen,
  onClose,
  zigzagSettings,
  onUpdateZigZagSettings,
  currentTimeframe,
  onSelectPairAndClose,
}) => {
  // Navigation Tabs: 'scanner' (اسکن دستی بازار) | 'optimizer' (بهینه‌ساز بیزی رنج‌محور)
  const [activeTab, setActiveTab] = useState<'scanner' | 'optimizer'>('scanner');

  // Strategy selection
  const [selectedStrategyId, setSelectedStrategyId] = useState<'strategy_1_e_breakout' | 'strategy_2_next_pivot'>(
    'strategy_1_e_breakout'
  );

  // General Parameters
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [entryCommissionPercent, setEntryCommissionPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_entry_commission_percent');
      if (saved !== null) return parseFloat(saved);
    } catch {}
    return 0.06; // کارمزد ورود 0.06% پیش‌فرض
  });
  const [exitCommissionPercent, setExitCommissionPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_exit_commission_percent');
      if (saved !== null) return parseFloat(saved);
    } catch {}
    return 0.06; // کارمزد خروج 0.06% پیش‌فرض
  });
  const commissionPercent = parseFloat((entryCommissionPercent + exitCommissionPercent).toFixed(4));
  const [maxCandlesToEnter, setMaxCandlesToEnter] = useState<number>(100);
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [candleHistoryLimit, setCandleHistoryLimit] = useState<number>(5000);
  const [universeOption, setUniverseOption] = useState<'all_futures' | 'top_50' | 'top_30' | 'all_1m'>(() => {
    try {
      const saved = localStorage.getItem('backtest_universe_option');
      if (saved && (saved === 'all_futures' || saved === 'top_50' || saved === 'top_30' || saved === 'all_1m')) {
        return saved as any;
      }
    } catch {}
    return 'all_futures'; // دریافت پیش‌فرض ارزهای فیوچرز
  });

  // Cached Candles in Memory to avoid repeated downloads!
  const [cachedCount, setCachedCount] = useState<number>(() => GLOBAL_CANDLE_CACHE.size);

  // تعداد ورکر همزمان برای دانلود و اسکن موازی سریع (Workers Concurrency)
  const [scanWorkersCount, setScanWorkersCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_scan_workers_v2');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 12; // پیش‌فرض ۱۲ ورکر برای سرعت بالا در ۶۵۰ ارز
  });

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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            ...item,
            totalFee: typeof item.totalFee === 'number' ? item.totalFee : 0,
            netProfit: typeof item.netProfit === 'number' ? item.netProfit : 0,
            netProfitPercent: typeof item.netProfitPercent === 'number' ? item.netProfitPercent : 0,
            totalProfit: typeof item.totalProfit === 'number' ? item.totalProfit : 0,
            totalLoss: typeof item.totalLoss === 'number' ? item.totalLoss : 0,
            totalTrades: typeof item.totalTrades === 'number' ? item.totalTrades : 0,
            winTrades: typeof item.winTrades === 'number' ? item.winTrades : 0,
            lossTrades: typeof item.lossTrades === 'number' ? item.lossTrades : 0,
            winRate: typeof item.winRate === 'number' ? item.winRate : 0,
            profitFactor: typeof item.profitFactor === 'number' ? item.profitFactor : 0,
            maxDrawdownPercent: typeof item.maxDrawdownPercent === 'number' ? item.maxDrawdownPercent : 0,
            optimalRiskForDD20: typeof item.optimalRiskForDD20 === 'number' ? item.optimalRiskForDD20 : 0,
          }));
        }
      }
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

  // بیشترین درودان ثبت‌شده در طول اسکن که تضمین می‌کند درودان فقط می‌تواند زیاد شود و هرگز کم نمی‌شود
  const [scanMaxDrawdown, setScanMaxDrawdown] = useState<number>(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Full-width Zoom & Mouse Drag-to-Pan for Equity Chart
  const chartScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100% Fit (تمام‌عرض با زوم اوت خودکار)
  const isDraggingChartRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartScrollLeftRef = useRef<number>(0);
  const [isChartDragging, setIsChartDragging] = useState<boolean>(false);
  const [hoveredEquityPoint, setHoveredEquityPoint] = useState<{
    index: number;
    x: number;
    y: number;
    point: (typeof equityPoints)[0];
  } | null>(null);

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

  const [optMaxRiskReward, setOptMaxRiskReward] = useState<number>(2.0);
  const [lockMaxRiskReward, setLockMaxRiskReward] = useState<boolean>(false);

  // همگام‌سازی با تنظیمات زیگ‌زاگ وارده توسط کاربر در چارت
  useEffect(() => {
    if (zigzagSettings) {
      if (zigzagSettings.atrPeriod) setOptAtrPeriod(zigzagSettings.atrPeriod);
      if (zigzagSettings.minCandles) setOptMinCandles(zigzagSettings.minCandles);
      if (zigzagSettings.minCandlesForLongLeg) setOptMinCandlesLong(zigzagSettings.minCandlesForLongLeg);
      if (zigzagSettings.atrMultiplier) setOptAtrMultiplier(zigzagSettings.atrMultiplier);
      if (zigzagSettings.longLegAtrMultiplier) setOptLongLegAtrMult(zigzagSettings.longLegAtrMultiplier);
      if (zigzagSettings.maxBlueLegPercent !== undefined) setOptMaxBlueLegPercent(zigzagSettings.maxBlueLegPercent);
      if (zigzagSettings.maxBreakoutAtrMultiplier !== undefined) setOptMaxBreakoutAtr(zigzagSettings.maxBreakoutAtrMultiplier);
    }
  }, [zigzagSettings]);

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

  // =========================================================================
  // مدل بهینه‌سازی سبک و کم‌حجم (فقط ۱۰ تست برتر + رنج‌های بهینه‌شونده پارامترها)
  // =========================================================================
  const [totalEvaluatedCount, setTotalEvaluatedCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zigzag_opt_total_count_v5');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 0;
  });

  // رنج‌های تطبیق‌پذیر پارامترها که در طول تست‌ها مدام بهینه‌تر می‌شوند
  const [adaptiveRanges, setAdaptiveRanges] = useState<AdaptiveRanges>(() => {
    try {
      const saved = localStorage.getItem('zigzag_opt_ranges_v5');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_RANGES;
  });

  // فقط و فقط ۱۰ تست برتر در جدول و حافظه ذخیره می‌شوند
  const [top10Trials, setTop10Trials] = useState<OptimizationTrial[]>(() => {
    try {
      const saved = localStorage.getItem('zigzag_opt_top10_v5');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [optSortColumn, setOptSortColumn] = useState<OptSortCol>('netProfit');
  const [optSortDirection, setOptSortDirection] = useState<SortDirection>('desc');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // بازیابی هش‌های قبلی
  useEffect(() => {
    for (const item of top10Trials) {
      visitedHashesRef.current.add(item.hash || generateConfigHash(item));
    }
  }, [top10Trials]);

  // ذخیره‌سازی محلی فوق سبک (تنها ۱۰ مورد + رنج‌ها)
  useEffect(() => {
    try {
      localStorage.setItem('zigzag_opt_top10_v5', JSON.stringify(top10Trials));
      localStorage.setItem('zigzag_opt_ranges_v5', JSON.stringify(adaptiveRanges));
      localStorage.setItem('zigzag_opt_total_count_v5', totalEvaluatedCount.toString());
    } catch {}
  }, [top10Trials, adaptiveRanges, totalEvaluatedCount]);

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
    try {
      localStorage.setItem('backtest_universe_option', universeOption);
      localStorage.setItem('backtest_entry_commission_percent', entryCommissionPercent.toString());
      localStorage.setItem('backtest_exit_commission_percent', exitCommissionPercent.toString());
      localStorage.setItem('backtest_commission_percent', commissionPercent.toString());
    } catch {}
  }, [universeOption, entryCommissionPercent, exitCommissionPercent, commissionPercent]);

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
            showToast('⏸️ سشن ۱۵ دقیقه‌ای به پایان رسید و رنج‌های بهینه ذخیره شدند.');
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOptimizing, sessionSecondsLeft]);

  // =========================================================
  // اسکن کامل بازار: تمام ارزهای بالای ۱ میلیون دلار بدون برش
  // =========================================================
  const handleStartScan = async (useCachedOnly: boolean = false) => {
    setIsScanning(true);
    abortControllerRef.current = false;
    setErrorMsg(null);
    setResults([]);
    setAllCollectedTrades([]);
    setScanMaxDrawdown(0);

    try {
      let targetPairs: CryptoPair[] = [];
      const isFuturesUniverse = universeOption !== 'all_1m';

      if (universeOption === 'all_futures') {
        targetPairs = await fetchFuturesMarketPairs(200_000);
      } else if (universeOption === 'top_30') {
        const futures = await fetchFuturesMarketPairs(200_000);
        targetPairs = futures.slice(0, 30);
      } else if (universeOption === 'top_50') {
        const futures = await fetchFuturesMarketPairs(200_000);
        targetPairs = futures.slice(0, 50);
      } else {
        targetPairs = await fetchUSDTMarketPairs(1_000_000);
      }

      const total = targetPairs.length;
      setProgress({ current: 0, total, currentSymbol: '' });

      const collectedResults: BacktestResultItem[] = [];
      const collectedTrades: StrategyTrade[] = [];

      const queue = [...targetPairs];
      let completedCount = 0;
      let lastUiCommit = 0;

      const triggerThrottledCommit = (force: boolean = false) => {
        const now = Date.now();
        if (force || now - lastUiCommit > 250) {
          lastUiCommit = now;
          setResults([...collectedResults]);
          setAllCollectedTrades([...collectedTrades]);
        }
      };

      const runWorker = async () => {
        while (queue.length > 0 && !abortControllerRef.current) {
          const pair = queue.shift();
          if (!pair) break;

          setProgress({ current: completedCount, total, currentSymbol: pair.symbol });

          try {
            let candles: CandleData[] = [];
            const cached = GLOBAL_CANDLE_CACHE.get(pair.symbol);
            if (useCachedOnly && cached && cached.candles.length >= 50) {
              candles = cached.candles;
            } else {
              const fetched = await fetchKlines(pair.symbol, timeframe, candleHistoryLimit, isFuturesUniverse);
              candles = fetched.candles;
              if (candles.length >= 50) {
                GLOBAL_CANDLE_CACHE.set(pair.symbol, { pair, candles, timeframe });
                setCachedCount(GLOBAL_CANDLE_CACHE.size);
              }
            }

            if (candles.length >= 50) {
              const atrMetrics = calculateATR(candles, optAtrPeriod);
              const { points } = calculateAtrZigZag(
                candles,
                atrMetrics.atrValues,
                optAtrMultiplier,
                optMinCandles
              );
              const legs = analyzeZigZagLegs(
                points,
                optMinCandlesLong,
                optLongLegAtrMult,
                optMaxBlueLegPercent,
                optMaxBreakoutAtr
              );

              const tempConfig: StrategyConfig = {
                capital,
                selectedStrategyId,
                riskPercent,
                entryCommissionPercent,
                exitCommissionPercent,
                commissionPercent,
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
                  optAtrMultiplier,
                  optMinCandles
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
                totalFee: metrics.totalFee || 0,
                profitFactor: metrics.profitFactor,
                avgRiskReward: metrics.avgRiskReward,
                maxDrawdown: metrics.maxDrawdown,
                maxDrawdownPercent: metrics.maxDrawdownPercent,
                optimalRiskForDD20,
                lastTradeStatus:
                  lastTrade?.status === 'WIN' || lastTrade?.status === 'LOSS' || lastTrade?.status === 'ACTIVE'
                    ? lastTrade.status
                    : undefined,
                trades,
              };

              collectedResults.push(resultItem);
              const finishedTrades = trades.filter((t) => t.status === 'WIN' || t.status === 'LOSS');
              collectedTrades.push(...finishedTrades);
            }
          } catch (e) {
            console.warn(`Error scanning ${pair.symbol}:`, e);
          } finally {
            completedCount++;
            setProgress((prev) => ({ ...prev, current: completedCount }));
            triggerThrottledCommit(false);
          }
        }
      };

      const concurrency = Math.min(scanWorkersCount, targetPairs.length);
      await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

      triggerThrottledCommit(true);
    } catch {
      setErrorMsg('خطا در دریافت لیست ارزها از بایننس. لطفاً مجدداً بررسی کنید.');
    } finally {
      setIsScanning(false);
    }
  };

  // =========================================================
  // محاسبه و آپدیت مجدد فوری نتایج بک‌تست بر اساس پارامترهای جدید
  // روی دیتایی که قبلاً دانلود شده است (بدون دانلود مجدد از اینترنت)
  // =========================================================
  const handleRerunOnCachedData = async () => {
    if (GLOBAL_CANDLE_CACHE.size === 0) {
      showToast('⚠️ دیتای دانلودی در حافظه نیست. لطفاً ابتدا دکمه «شروع اسکن کامل بازار (دانلود زنده)» را بزنید.');
      return;
    }

    setIsScanning(true);
    abortControllerRef.current = false;
    setErrorMsg(null);
    setResults([]);
    setAllCollectedTrades([]);
    setScanMaxDrawdown(0);

    const cachedEntries = Array.from(GLOBAL_CANDLE_CACHE.values());
    const total = cachedEntries.length;
    setProgress({ current: 0, total, currentSymbol: '' });

    const collectedResults: BacktestResultItem[] = [];
    const collectedTrades: StrategyTrade[] = [];

    const queue = [...cachedEntries];
    let completedCount = 0;
    let lastUiCommit = 0;

    const triggerThrottledCommit = (force: boolean = false) => {
      const now = Date.now();
      if (force || now - lastUiCommit > 250) {
        lastUiCommit = now;
        setResults([...collectedResults]);
        setAllCollectedTrades([...collectedTrades]);
      }
    };

    const runWorker = async () => {
      while (queue.length > 0 && !abortControllerRef.current) {
        const item = queue.shift();
        if (!item) break;

        const pair = item.pair;
        const candles = item.candles;
        if (candles.length >= 50) {
          const atrMetrics = calculateATR(candles, optAtrPeriod);
          const { points } = calculateAtrZigZag(
            candles,
            atrMetrics.atrValues,
            optAtrMultiplier,
            optMinCandles
          );
          const legs = analyzeZigZagLegs(
            points,
            optMinCandlesLong,
            optLongLegAtrMult,
            optMaxBlueLegPercent,
            optMaxBreakoutAtr
          );

          const tempConfig: StrategyConfig = {
            capital,
            selectedStrategyId,
            riskPercent,
            entryCommissionPercent,
            exitCommissionPercent,
            commissionPercent,
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
              optAtrMultiplier,
              optMinCandles
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

          collectedResults.push({
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
            totalFee: metrics.totalFee || 0,
            profitFactor: metrics.profitFactor,
            avgRiskReward: metrics.avgRiskReward,
            maxDrawdown: metrics.maxDrawdown,
            maxDrawdownPercent: metrics.maxDrawdownPercent,
            optimalRiskForDD20,
            lastTradeStatus:
              lastTrade?.status === 'WIN' || lastTrade?.status === 'LOSS' || lastTrade?.status === 'ACTIVE'
                ? lastTrade.status
                : undefined,
            trades,
          });

          const finishedTrades = trades.filter((t) => t.status === 'WIN' || t.status === 'LOSS');
          collectedTrades.push(...finishedTrades);
        }

        completedCount++;
        setProgress({
          current: completedCount,
          total,
          currentSymbol: pair.symbol,
        });
        triggerThrottledCommit(false);
      }
    };

    const concurrency = Math.min(scanWorkersCount, cachedEntries.length);
    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

    triggerThrottledCommit(true);

    setIsScanning(false);
    showToast(`✅ نتایج بک‌تست بر اساس پارامترهای جدید با موفقیت روی ${collectedResults.length} جفت‌ارز به‌روزرسانی شد!`);
  };

  const handleStopScan = () => {
    abortControllerRef.current = true;
    setIsScanning(false);
  };

  const handleClearResults = () => {
    setResults([]);
    setAllCollectedTrades([]);
    setScanMaxDrawdown(0);
    try {
      localStorage.removeItem('backtest_scanned_results_v2');
      localStorage.removeItem('backtest_scanned_trades_v2');
    } catch {}
  };

  // =========================================================
  // آمار کلی و نمودارهای تب اسکن دستی بازار
  // =========================================================
  const totalScanned = results.length;
  const profitableCount = results.filter((r) => r.netProfit > 0).length;
  const totalTradesSum = results.reduce((acc, r) => acc + r.totalTrades, 0);
  const totalWinTradesSum = results.reduce((acc, r) => acc + r.winTrades, 0);
  const totalNetProfitSum = results.reduce((acc, r) => acc + r.netProfit, 0);
  const totalProfitSum = results.reduce((acc, r) => acc + r.totalProfit, 0);
  const totalLossSum = results.reduce((acc, r) => acc + r.totalLoss, 0);
  const totalFeeSum = results.reduce((acc, r) => acc + (r.totalFee || 0), 0);

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

  const equityPoints = useMemo(() => {
    if (allCollectedTrades.length === 0) return [];
    const sortedTrades = [...allCollectedTrades].sort((a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0));

    let currentEquity = capital;
    let peakEquity = capital;
    let runningMaxDrawdown = 0;
    let runningMaxDrawdownDollars = 0;

    return sortedTrades.map((t, index) => {
      currentEquity += t.pnl;
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const ddDollars = peakEquity - currentEquity;
      const ddPercent = peakEquity > 0 ? (ddDollars / peakEquity) * 100 : 0;

      // طبق فرمول استاندارد حداکثر درودان: مقدار درودان هرگز کم نمی‌شود، بلکه تنها با افت‌های عمیق‌تر افزایش می‌یابد
      if (ddPercent > runningMaxDrawdown) {
        runningMaxDrawdown = ddPercent;
      }
      if (ddDollars > runningMaxDrawdownDollars) {
        runningMaxDrawdownDollars = ddDollars;
      }

      return {
        tradeIndex: index + 1,
        equity: parseFloat(currentEquity.toFixed(2)),
        drawdown: parseFloat(runningMaxDrawdown.toFixed(2)), // حداکثر درودان تجمعی تا این معامله
        currentDrawdown: parseFloat(ddPercent.toFixed(2)), // درودان لحظه‌ای
        maxDrawdownDollars: parseFloat(runningMaxDrawdownDollars.toFixed(2)),
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

  // به‌روزرسانی حداکثر درودان در حین اسکن: مقدار درودان فقط می‌تواند افزایش یابد و هرگز کم نمی‌شود
  useEffect(() => {
    if (results.length === 0) {
      setScanMaxDrawdown(0);
      return;
    }
    const maxPair = Math.max(...results.map((r) => r.maxDrawdownPercent || 0));
    const combined = chartStats.maxDd || 0;
    const currentWorst = Math.max(maxPair, combined);
    setScanMaxDrawdown((prev) => parseFloat(Math.max(prev, currentWorst).toFixed(2)));
  }, [results, chartStats.maxDd]);

  const portfolioMaxDrawdown = useMemo(() => {
    if (results.length === 0) return 0;
    const maxPair = Math.max(...results.map((r) => r.maxDrawdownPercent || 0));
    const combined = chartStats.maxDd || 0;
    return parseFloat(Math.max(scanMaxDrawdown, maxPair, combined).toFixed(2));
  }, [results, scanMaxDrawdown, chartStats.maxDd]);

  const portfolioOptimalRisk = useMemo(() => {
    if (portfolioMaxDrawdown > 0) {
      return parseFloat(((riskPercent * 19.0) / portfolioMaxDrawdown).toFixed(2));
    }
    return 0;
  }, [portfolioMaxDrawdown, riskPercent]);

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
      'کارمزد کل (USDT)',
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
      r.totalFee || 0,
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

  const handleChartMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !chartScrollContainerRef.current) return;
    isDraggingChartRef.current = true;
    setIsChartDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = chartScrollContainerRef.current.scrollLeft;
  };

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingChartRef.current || !chartScrollContainerRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartXRef.current;
    chartScrollContainerRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
  };

  const handleChartMouseUpOrLeave = () => {
    if (isDraggingChartRef.current) {
      isDraggingChartRef.current = false;
      setIsChartDragging(false);
    }
  };

  const handleChartWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.3 : -0.3;
      setZoomLevel((prev) => Math.min(8, Math.max(1, parseFloat((prev + zoomDelta).toFixed(1)))));
    }
  };

  const handleDownloadEquityChartImage = () => {
    if (equityPoints.length < 2) {
      showToast('⚠️ داده‌های کافی برای ساخت تصویر نمودار وجود ندارد.');
      return;
    }

    try {
      const width = 1400;
      const height = 820;
      const dpr = 2; // High-DPI retina scale
      const canvas = document.createElement('canvas');
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, width, height);

      // Outer Border
      ctx.strokeStyle = '#222d3f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      // Header Banner
      ctx.fillStyle = '#111723';
      ctx.fillRect(10, 10, width - 20, 85);
      ctx.strokeStyle = '#222d3f';
      ctx.beginPath();
      ctx.moveTo(10, 95);
      ctx.lineTo(width - 10, 95);
      ctx.stroke();

      // Header Text
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('کارنامه و نمودار رشد سرمایه معاملات الگوریتمی (Equity Curve)', width - 40, 45);

      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#94a3b8';
      const stratTitle =
        selectedStrategyId === 'strategy_1_e_breakout'
          ? 'استراتژی ۱: شکست نقطه E (تارگت A / استاپ F)'
          : 'استراتژی ۲: اولین تشکیل لگ بعد از F (تارگت R:R)';
      ctx.fillText(
        `${stratTitle}  |  تایم‌فریم: ${timeframe}  |  دامنه: فیوچرز  |  تاریخ: ${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
        width - 40,
        75
      );

      // Brand Left Side
      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillText('ZigZag Algorithmic Backtester', 40, 45);
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`تعداد معاملات شبیه‌سازی‌شده: ${equityPoints.length} معامله`, 40, 72);

      // Chart Area Dimensions
      const chartX = 85;
      const chartY = 125;
      const chartW = width - 130;
      const chartH = 340;

      // Chart background
      ctx.fillStyle = '#0f141f';
      ctx.fillRect(chartX, chartY, chartW, chartH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(chartX, chartY, chartW, chartH);

      // Calculate Min and Max Equity
      const eqs = equityPoints.map((p) => p.equity);
      const minEq = Math.min(...eqs, capital);
      const maxEq = Math.max(...eqs, capital);
      const eqRange = maxEq - minEq || 1;

      // Draw Grid Lines (Horizontal)
      const gridLevels = 5;
      ctx.textAlign = 'right';
      ctx.font = '11px monospace';
      for (let g = 0; g <= gridLevels; g++) {
        const val = minEq + (eqRange * (gridLevels - g)) / gridLevels;
        const gy = chartY + (g / gridLevels) * chartH;
        ctx.strokeStyle = Math.abs(val - capital) < 5 ? 'rgba(245, 158, 11, 0.5)' : '#1e2838';
        ctx.setLineDash(Math.abs(val - capital) < 5 ? [5, 4] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(chartX, gy);
        ctx.lineTo(chartX + chartW, gy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on left
        ctx.fillStyle = Math.abs(val - capital) < 5 ? '#fbbf24' : '#64748b';
        ctx.fillText(`$${Math.round(val).toLocaleString()}`, chartX - 10, gy + 4);
      }

      // Build Curve Points
      const numPts = equityPoints.length;
      const ptCoords: { x: number; y: number; eq: number }[] = [];
      for (let i = 0; i < numPts; i++) {
        const cx = chartX + (i / (numPts - 1)) * chartW;
        const cy = chartY + chartH - ((equityPoints[i].equity - minEq) / eqRange) * chartH;
        ptCoords.push({ x: cx, y: cy, eq: equityPoints[i].equity });
      }

      // Fill Gradient under Curve
      const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      grad.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.beginPath();
      ctx.moveTo(chartX, chartY + chartH);
      ptCoords.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(chartX + chartW, chartY + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke Line Curve
      ctx.beginPath();
      ptCoords.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Final Point Marker
      if (ptCoords.length > 0) {
        const lastPt = ptCoords[ptCoords.length - 1];
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ==========================================
      // Statistics Cards Dashboard (Below Chart)
      // ==========================================
      const statsY = 495;
      const statsH = 300;

      // Stats Section Container
      ctx.fillStyle = '#101522';
      ctx.fillRect(30, statsY, width - 60, statsH);
      ctx.strokeStyle = '#222e42';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, statsY, width - 60, statsH);

      // Section Header Title
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('📊 آمار و کارنامه تحلیلی معاملات پرتفوی', width - 50, statsY + 30);

      // Metric Boxes Definition
      const finalEq = equityPoints[equityPoints.length - 1].equity;
      const netProfitVal = finalEq - capital;
      const netProfitPct = capital > 0 ? (netProfitVal / capital) * 100 : 0;

      const statCards = [
        {
          title: 'سرمایه اولیه',
          value: `$${capital.toLocaleString()}`,
          sub: 'USDT',
          color: '#ffffff',
        },
        {
          title: 'سرمایه نهایی (Equity)',
          value: `$${finalEq.toLocaleString()}`,
          sub: 'USDT',
          color: '#38bdf8',
        },
        {
          title: 'سود خالص (Net Profit)',
          value: `${netProfitVal >= 0 ? '+' : ''}$${Math.round(netProfitVal).toLocaleString()}`,
          sub: `${netProfitPct >= 0 ? '+' : ''}${netProfitPct.toFixed(1)}%`,
          color: netProfitVal >= 0 ? '#10b981' : '#f43f5e',
        },
        {
          title: 'کارمزد کل معاملات',
          value: `-$${Math.round(totalFeeSum).toLocaleString()}`,
          sub: `ورود ${entryCommissionPercent}% + خروج ${exitCommissionPercent}%`,
          color: '#fbbf24',
        },
        {
          title: 'نرخ برد (Win Rate)',
          value: `${portfolioWinRate}%`,
          sub: `${totalWinTradesSum} برد / ${totalTradesSum - totalWinTradesSum} باخت`,
          color: '#38bdf8',
        },
        {
          title: 'پروفیت فکتور (PF)',
          value: `${portfolioProfitFactor}`,
          sub: `سود: $${Math.round(totalProfitSum).toLocaleString()} | زیان: $${Math.round(totalLossSum).toLocaleString()}`,
          color: portfolioProfitFactor >= 1.5 ? '#10b981' : portfolioProfitFactor >= 1.0 ? '#fbbf24' : '#f43f5e',
        },
        {
          title: 'حداکثر افت کل (Max Drawdown)',
          value: `${portfolioMaxDrawdown}%`,
          sub: 'بیشترین افت تجربه شده',
          color: '#f43f5e',
        },
        {
          title: 'ریسک بهینه (DD < 20%)',
          value: portfolioOptimalRisk > 0 ? `${portfolioOptimalRisk}%` : '—',
          sub: `کنترل درودان زیر ۲۰٪`,
          color: '#34d399',
        },
      ];

      // Draw Grid of 2 rows x 4 cols
      const cols = 4;
      const cardW = (width - 120) / cols;
      const cardH = 100;
      const startCardY = statsY + 50;

      statCards.forEach((c, idx) => {
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        const cardX = width - 50 - (colIdx + 1) * cardW;
        const cardY = startCardY + rowIdx * (cardH + 15);

        // Card box
        ctx.fillStyle = '#161d2b';
        ctx.fillRect(cardX + 10, cardY, cardW - 20, cardH);
        ctx.strokeStyle = '#273449';
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX + 10, cardY, cardW - 20, cardH);

        // Title
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText(c.title, cardX + cardW - 25, cardY + 24);

        // Value
        ctx.fillStyle = c.color;
        ctx.font = 'bold 18px monospace';
        ctx.fillText(c.value, cardX + cardW - 25, cardY + 54);

        // Subtitle
        ctx.fillStyle = '#64748b';
        ctx.font = '10px system-ui, -apple-system, sans-serif';
        ctx.fillText(c.sub, cardX + cardW - 25, cardY + 80);
      });

      // Export Canvas as PNG
      const link = document.createElement('a');
      link.download = `equity_curve_report_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('📸 تصویر باکیفیت نمودار رشد سرمایه و کارنامه با موفقیت دانلود شد!');
    } catch (err) {
      console.error('Failed to generate chart image', err);
      showToast('❌ خطا در ساخت تصویر نمودار.');
    }
  };

  // =========================================================================
  // ارزیابی یک ترکیب ۸تایی روی تمام جفت‌ارزهای کش‌شده
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
    const cachedEntries = Array.from(GLOBAL_CANDLE_CACHE.values());
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
      entryCommissionPercent,
      exitCommissionPercent,
      commissionPercent,
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
   * تولید کاندیدای بعدی دقیقاً از داخل رنج‌های تطبیق‌پذیر بهینه‌شده
   */
  const getNextCandidateFromAdaptiveRanges = (
    ranges: AdaptiveRanges,
    visited: Set<string>
  ): {
    atrPeriod: number;
    minCandles: number;
    minCandlesForLongLeg: number;
    atrMultiplier: number;
    longLegAtrMultiplier: number;
    maxBlueLegPercent: number;
    maxBreakoutAtrMultiplier: number;
    maxRiskReward: number;
  } | null => {
    const sampleParam = (r: ParameterRange, isLocked: boolean, lockedVal: number) => {
      if (isLocked) return lockedVal;
      const count = Math.max(1, Math.round((r.max - r.min) / r.step));
      // ۷۰٪ شانس در مجاورت مقدار بهینه (bestVal) و ۳۰٪ شانس کاوش در کل رنج فعال
      if (Math.random() < 0.7 && r.bestVal !== undefined) {
        const offset = (Math.floor(Math.random() * 3) - 1) * r.step;
        const val = Math.max(r.min, Math.min(r.max, r.bestVal + offset));
        return parseFloat(val.toFixed(2));
      }
      const idx = Math.floor(Math.random() * (count + 1));
      const val = r.min + idx * r.step;
      return parseFloat(Math.min(r.max, Math.max(r.min, val)).toFixed(2));
    };

    for (let attempts = 0; attempts < 300; attempts++) {
      const candidate = {
        atrPeriod: sampleParam(ranges.atrPeriod, lockAtrPeriod, optAtrPeriod),
        minCandles: sampleParam(ranges.minCandles, lockMinCandles, optMinCandles),
        minCandlesForLongLeg: sampleParam(ranges.minCandlesForLongLeg, lockMinCandlesLong, optMinCandlesLong),
        atrMultiplier: sampleParam(ranges.atrMultiplier, lockAtrMultiplier, optAtrMultiplier),
        longLegAtrMultiplier: sampleParam(ranges.longLegAtrMultiplier, lockLongLegAtrMult, optLongLegAtrMult),
        maxBlueLegPercent: sampleParam(ranges.maxBlueLegPercent, lockMaxBlueLegPercent, optMaxBlueLegPercent),
        maxBreakoutAtrMultiplier: sampleParam(ranges.maxBreakoutAtrMultiplier, lockMaxBreakoutAtr, optMaxBreakoutAtr),
        maxRiskReward: sampleParam(ranges.maxRiskReward, lockMaxRiskReward, optMaxRiskReward),
      };

      const hash = generateConfigHash(candidate);
      if (!visited.has(hash)) {
        return candidate;
      }
    }

    return null;
  };

  /**
   * به‌روزرسانی هوشمند رنج‌های هر ۸ پارامتر بر مبنای تست‌های موفق (بدون ذخیره هزاران سطر در رم)
   */
  const refineAdaptiveRanges = (
    currentRanges: AdaptiveRanges,
    trial: OptimizationTrial
  ): AdaptiveRanges => {
    // تنها در صورتی که تست سودآور باشد یا شروط را محقق کرده باشد رنج‌ها را به سمت آن متمایل می‌کنیم
    if (!trial.isValid && trial.netProfit <= 0) return currentRanges;

    const nextRanges: AdaptiveRanges = { ...currentRanges };
    const keys: (keyof AdaptiveRanges)[] = [
      'atrPeriod',
      'minCandles',
      'minCandlesForLongLeg',
      'atrMultiplier',
      'longLegAtrMultiplier',
      'maxBlueLegPercent',
      'maxBreakoutAtrMultiplier',
      'maxRiskReward',
    ];

    for (const key of keys) {
      const val = trial[key];
      const r = { ...nextRanges[key] };
      const def = DEFAULT_RANGES[key];

      // به‌روزرسانی بهترین مقدار (Best Center)
      if (trial.isValid && trial.netProfit > (r.bestValProfit || -Infinity)) {
        r.bestVal = val;
        r.bestValProfit = trial.netProfit;
      }

      // تنظیم رنج فعال: متمرکز شدن در بازه ۲ تا ۳ گام اطراف مقادیر برنده
      const newMin = Math.max(def.min, Math.min(r.min, val - 2 * r.step));
      const newMax = Math.min(def.max, Math.max(r.max, val + 2 * r.step));

      r.min = parseFloat(newMin.toFixed(2));
      r.max = parseFloat(newMax.toFixed(2));
      nextRanges[key] = r;
    }

    return nextRanges;
  };

  /**
   * ذخیره فقط ۱۰ تست برتر (Top 10) در حافظه تا صفحه هرگز سنگین نشود
   */
  const updateTop10List = (
    currentTop10: OptimizationTrial[],
    newTrial: OptimizationTrial
  ): OptimizationTrial[] => {
    const merged = [...currentTop10, newTrial];

    // مرتب‌سازی بر اساس: ۱. قبولی در شروط  ۲. بیشترین سود خالص
    merged.sort((a, b) => {
      if (a.isValid && !b.isValid) return -1;
      if (!a.isValid && b.isValid) return 1;
      return b.netProfit - a.netProfit;
    });

    // دقیقاً ۱۰ مورد برتر را نگه می‌داریم
    return merged.slice(0, 10);
  };

  // حلقه پیوسته بهینه‌سازی (اجرای خودکار تا ۱۵ دقیقه یا توقف کاربر)
  const handleStartAutoOptimization = async () => {
    if (GLOBAL_CANDLE_CACHE.size === 0) {
      showToast('در حال دانلود اولیه داده‌های بازار برای کش...');
      await handleStartScan(false);
    }

    setIsOptimizing(true);
    stopOptimizerRef.current = false;

    if (sessionSecondsLeft <= 0) {
      setSessionSecondsLeft(900);
      sessionSecondsRef.current = 900;
    }

    let localTop10 = [...top10Trials];
    let localRanges = { ...adaptiveRanges };
    let evaluatedCount = totalEvaluatedCount;

    while (!stopOptimizerRef.current && sessionSecondsRef.current > 0) {
      // تولید کاندیدای بعدی با استفاده از رنج‌های تطبیق‌پذیر
      const candidate = getNextCandidateFromAdaptiveRanges(localRanges, visitedHashesRef.current);
      if (!candidate) {
        showToast('✅ تمامی ترکیب‌های موجود در رنج بهینه فعلی بدون تکرار آزمایش شدند.');
        break;
      }

      const hash = generateConfigHash(candidate);
      visitedHashesRef.current.add(hash);

      const evalRes = evaluateSingleCombination(candidate);
      evaluatedCount++;
      setTotalEvaluatedCount(evaluatedCount);

      if (evalRes) {
        const trial: OptimizationTrial = {
          id: evaluatedCount,
          hash,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          ...candidate,
          ...evalRes,
        };

        // ۱. به‌روزرسانی رنج‌های پارامترها
        localRanges = refineAdaptiveRanges(localRanges, trial);
        setAdaptiveRanges(localRanges);

        // ۲. به‌روزرسانی جدول (فقط ۱۰ تست برتر)
        localTop10 = updateTop10List(localTop10, trial);
        setTop10Trials(localTop10);
      }

      // تاخیر کوتاه ۲۰ میلی‌ثانیه‌ای برای روانی مطلق مرورگر
      await new Promise((r) => setTimeout(r, 20));
    }

    setIsOptimizing(false);
  };

  const handleStopOptimization = () => {
    stopOptimizerRef.current = true;
    setIsOptimizing(false);
  };

  const handleResetOptimizer = () => {
    setTop10Trials([]);
    setAdaptiveRanges(DEFAULT_RANGES);
    setTotalEvaluatedCount(0);
    visitedHashesRef.current.clear();
    setSessionSecondsLeft(900);
    sessionSecondsRef.current = 900;
    try {
      localStorage.removeItem('zigzag_opt_top10_v5');
      localStorage.removeItem('zigzag_opt_ranges_v5');
      localStorage.removeItem('zigzag_opt_total_count_v5');
    } catch {}
    showToast('🔄 تمام آزمایش‌ها، ترکیب‌ها و رنج‌های بهینه‌ساز با موفقیت پاک و بازنشانی شدند.');
  };

  // بهترین ترکیب برنده مستقیماً از ردیف اول ۱۰ تست برتر
  const bestWinningRow = useMemo(() => {
    if (top10Trials.length === 0) return null;
    return top10Trials[0];
  }, [top10Trials]);

  // مرتب‌سازی ۱۰ تست برتر بر اساس ستون انتخابی
  const sortedTop10 = useMemo(() => {
    return [...top10Trials].sort((a, b) => {
      let valA: any = a[optSortColumn];
      let valB: any = b[optSortColumn];
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return optSortDirection === 'desc' ? numB - numA : numA - numB;
    });
  }, [top10Trials, optSortColumn, optSortDirection]);

  // اعمال بهترین پارامترهای برنده به چارت زنده
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

  // خروجی JSON فوق سبک (تنها ۱۰ تست برتر + رنج‌های بهینه)
  const handleExportJSON = () => {
    const payload = {
      applet: 'Binance ZigZag Strategy Adaptive Range Optimizer',
      exportedAt: new Date().toISOString(),
      strategyId: selectedStrategyId,
      totalEvaluatedTests: totalEvaluatedCount,
      constraints: {
        targetMaxDrawdown,
        targetMinWinRate,
        targetMinTrades,
      },
      adaptiveRanges,
      top10Trials,
      bestWinningRow,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zigzag_top10_ranges_${selectedStrategyId}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('💾 فایل سبک JSON شامل ۱۰ تست برتر و رنج‌های بهینه دانلود شد.');
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
        if (parsed.totalEvaluatedTests) setTotalEvaluatedCount(parsed.totalEvaluatedTests);
        if (parsed.constraints) {
          if (parsed.constraints.targetMaxDrawdown) setTargetMaxDrawdown(parsed.constraints.targetMaxDrawdown);
          if (parsed.constraints.targetMinWinRate) setTargetMinWinRate(parsed.constraints.targetMinWinRate);
          if (parsed.constraints.targetMinTrades) setTargetMinTrades(parsed.constraints.targetMinTrades);
        }

        if (parsed.adaptiveRanges) {
          setAdaptiveRanges(parsed.adaptiveRanges);
        }

        if (Array.isArray(parsed.top10Trials)) {
          setTop10Trials(parsed.top10Trials);
          for (const item of parsed.top10Trials) {
            visitedHashesRef.current.add(item.hash || generateConfigHash(item));
          }
        }

        showToast(`✅ فایل سبک JSON بارگذاری شد (${parsed.top10Trials?.length || 0} تست برتر و رنج‌ها به‌روزرسانی شدند).`);
      } catch (err: any) {
        alert('خطا در بارگذاری فایل: ' + (err?.message || 'فایل JSON نامعتبر است'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleScannerSort = (col: ScannerSortCol) => {
    if (scannerSortCol === col) {
      setScannerSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setScannerSortCol(col);
      setScannerSortDir('desc');
    }
  };

  const renderScannerSortArrow = (col: ScannerSortCol) => {
    if (scannerSortCol !== col) return <ArrowUpDown className="w-3 h-3 text-gray-500 inline-block mr-1 opacity-50" />;
    return scannerSortDir === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 text-amber-400 inline-block mr-1" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-amber-400 inline-block mr-1" />
    );
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-1.5 bg-black/85 backdrop-blur-xs transition-opacity duration-200 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'
      }`}
      dir="rtl"
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

      <div
        className="w-[99.5vw] max-w-[99.5vw] h-[98.5vh] max-h-[98.5vh] bg-[#121622] border border-[#2b3548] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-200 relative"
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
                  بک‌تست چندارزی و بهینه‌ساز سبک رنج‌محور (Top 10)
                </h3>
                {cachedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>{cachedCount} جفت‌ارز در حافظه کش</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                بهینه‌سازی پویا با به‌روزرسانی رنج پارامترها و ذخیره تنها ۱۰ تست برتر جهت سبکی و سرعت حداکثری
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
              <span>بهینه‌ساز رنج‌محور (Top 10)</span>
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
                    <option value="all_futures">ارزهای فیوچرز بایننس (USDT-M Futures) - پیش‌فرض</option>
                    <option value="top_50">۵۰ ارز برتر فیوچرز (Top 50 Futures)</option>
                    <option value="top_30">۳۰ ارز نقدشونده اول فیوچرز (Top 30 Futures)</option>
                    <option value="all_1m">تمام ارزهای اسپات با حجم بالای ۱ میلیون دلار ($1M+)</option>
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

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#283244] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">ریسک (%):</label>
                    <input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.1}
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 1)}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-rose-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-amber-300 block mb-1">کارمزد ورود (%):</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={entryCommissionPercent}
                      onChange={(e) => setEntryCommissionPercent(parseFloat(e.target.value) || 0)}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-amber-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                      title="کارمزد ورود به هر پوزیشن (پیش‌فرض ۰.۰۶٪)"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-amber-300 block mb-1">کارمزد خروج (%):</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={exitCommissionPercent}
                      onChange={(e) => setExitCommissionPercent(parseFloat(e.target.value) || 0)}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-amber-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                      title="کارمزد خروج از هر پوزیشن (پیش‌فرض ۰.۰۶٪)"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">حداکثر R:R:</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={0.5}
                      value={optMaxRiskReward}
                      onChange={(e) => setOptMaxRiskReward(parseFloat(e.target.value) || 2)}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-emerald-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* تنظیمات زیگ‌زاگ و ATR وارد شده توسط کاربر برای بک‌تست */}
              <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#242e40]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-400">
                      تنظیمات زیگ‌زاگ و ATR برای بک‌تست (وارد شده توسط کاربر):
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 hidden sm:inline">
                      * با تغییر مقادیر زیر، دکمه روبرو را بزنید تا با دیتای دانلودشده قبلی نتایج فوراً محاسبه شوند:
                    </span>
                    <button
                      type="button"
                      onClick={handleRerunOnCachedData}
                      disabled={isScanning || cachedCount === 0}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        cachedCount > 0 && !isScanning
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-md shadow-emerald-500/25'
                          : 'bg-[#182030] text-gray-500 border border-[#2b3548] cursor-not-allowed opacity-60'
                      }`}
                      title={cachedCount === 0 ? 'ابتدا باید داده‌های بازار را با دکمه اسکن زنده دانلود کنید' : 'محاسبه مجدد فوری با پارامترهای جدید'}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>⚡ محاسبه و آپدیت با پارامترهای جدید ({cachedCount} ارز دانلودی)</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">دوره ATR:</label>
                    <input
                      type="number"
                      value={optAtrPeriod}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 55;
                        setOptAtrPeriod(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, atrPeriod: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">حداقل کندل:</label>
                    <input
                      type="number"
                      value={optMinCandles}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 3;
                        setOptMinCandles(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, minCandles: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">کندل لگ بلند:</label>
                    <input
                      type="number"
                      value={optMinCandlesLong}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 20;
                        setOptMinCandlesLong(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, minCandlesForLongLeg: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">ضریب عادی ATR:</label>
                    <input
                      type="number"
                      step={0.1}
                      value={optAtrMultiplier}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 3.0;
                        setOptAtrMultiplier(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, atrMultiplier: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">ضریب لگ بزرگ:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={optLongLegAtrMult}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 10.0;
                        setOptLongLegAtrMult(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, longLegAtrMultiplier: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">سقف لگ آبی %:</label>
                    <input
                      type="number"
                      step={5}
                      value={optMaxBlueLegPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 60;
                        setOptMaxBlueLegPercent(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, maxBlueLegPercent: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">نفوذ شکست ATR:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={optMaxBreakoutAtr}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 5.0;
                        setOptMaxBreakoutAtr(val);
                        onUpdateZigZagSettings?.({ ...zigzagSettings, maxBreakoutAtrMultiplier: val });
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
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
                        <span>
                          {universeOption === 'all_futures'
                            ? 'شروع اسکن کامل بازار (دانلود زنده فیوچرز USDT-M)'
                            : universeOption === 'top_50'
                            ? 'شروع اسکن کامل بازار (دانلود زنده ۵۰ ارز فیوچرز)'
                            : universeOption === 'top_30'
                            ? 'شروع اسکن کامل بازار (دانلود زنده ۳۰ ارز فیوچرز)'
                            : 'شروع اسکن کامل بازار (دانلود زنده اسپات $1M+)'}
                        </span>
                      </button>

                      {cachedCount > 0 && (
                        <button
                          type="button"
                          onClick={handleRerunOnCachedData}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                          title="اجرای مجدد بک‌تست با پارامترهای جدید بدون نیاز به دانلود مجدد"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>⚡ اجرای سریع با پارامترهای جدید ({cachedCount} ارز دانلودشده)</span>
                        </button>
                      )}

                      {/* انتخابگر تعداد ورکر همزمان برای افزایش سرعت اسکن ۶۵۰ ارز */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d121c] border border-[#2b374c] rounded-xl text-xs shadow-inner">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[10px] text-gray-300 font-bold whitespace-nowrap">ورکر همزمان:</span>
                        <select
                          value={scanWorkersCount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setScanWorkersCount(val);
                            try {
                              localStorage.setItem('backtest_scan_workers_v2', String(val));
                            } catch {}
                          }}
                          disabled={isScanning}
                          className="bg-[#171d2b] border border-[#2e3b50] text-cyan-300 font-mono font-bold rounded-lg px-2 py-0.5 text-xs focus:outline-none cursor-pointer disabled:opacity-50"
                          title="تعداد جفت‌ارزهایی که به طور موازی و همزمان دانلود و بک‌تست می‌شوند"
                        >
                          <option value={6}>۶ ورکر (پایه)</option>
                          <option value={10}>۱۰ ورکر (سریع)</option>
                          <option value={12}>۱۲ ورکر (توربو - پیش‌فرض)</option>
                          <option value={16}>۱۶ ورکر (فوق سریع)</option>
                          <option value={20}>۲۰ ورکر (حداکثر سرعت)</option>
                        </select>
                      </div>
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

            {/* کارت‌های آمار استراتژی در تب اسکن */}
            {results.length > 0 && (
              <div className="p-3 bg-[#0f131c] border border-[#232c3d] rounded-xl shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
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

                  <div className="p-2.5 rounded-xl bg-[#141924] border border-amber-500/30">
                    <span className="text-[10px] text-amber-300 block mb-0.5">
                      کارمزد کل ({entryCommissionPercent}% ورود + {exitCommissionPercent}% خروج)
                    </span>
                    <span className="text-base font-extrabold text-amber-400 font-mono">
                      -{totalFeeSum.toLocaleString()} <span className="text-[10px]">USDT</span>
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

            {/* نمودار رشد تجمعی ارزش سرمایه (تمام‌عرض با زوم اوت خودکار، قابلیت درگ با موس و دانلود تصویر) */}
            {equityPoints.length > 1 && (
              <div className="p-3 bg-[#0d1017] border border-[#232c3d] rounded-xl shrink-0 w-full space-y-2.5">
                {/* هدر نمودار و دکمه‌های کنترلی */}
                <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1c2433] gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      <LineChart className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          نمودار رشد تجمعی ارزش سرمایه (Equity Curve)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.2 rounded">
                          {equityPoints.length.toLocaleString()} معامله ثبت‌شده
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        سرمایه اولیه: <strong className="text-gray-200 font-mono">${capital.toLocaleString()}</strong> | سرمایه جاری: <strong className="text-emerald-300 font-mono">${equityPoints[equityPoints.length - 1].equity.toLocaleString()}</strong> ({((equityPoints[equityPoints.length - 1].equity - capital) >= 0 ? '+' : '')}{(((equityPoints[equityPoints.length - 1].equity - capital) / capital) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* کنترل بزرگ‌نمایی و نمایش تمام‌عرض (Zoom & Pan) */}
                    <div className="flex items-center gap-1.5 bg-[#131924] px-2 py-1 rounded-xl border border-[#243044]">
                      <button
                        type="button"
                        onClick={() => setZoomLevel((prev) => Math.max(1, parseFloat((prev - 0.5).toFixed(1))))}
                        disabled={zoomLevel <= 1}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2838] transition-colors disabled:opacity-30 cursor-pointer"
                        title="کوچک‌نمایی (Zoom Out)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setZoomLevel(1)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          zoomLevel === 1
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-gray-300 hover:text-white hover:bg-[#1f2838]'
                        }`}
                        title="نمایش تمام‌عرض و جا شدن تمام معاملات در صفحه بدون اسکرول (Zoom Out کامل)"
                      >
                        {zoomLevel === 1 ? 'تمام‌عرض (Fit)' : `${Math.round(zoomLevel * 100)}%`}
                      </button>

                      <button
                        type="button"
                        onClick={() => setZoomLevel((prev) => Math.min(8, parseFloat((prev + 0.5).toFixed(1))))}
                        disabled={zoomLevel >= 8}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2838] transition-colors disabled:opacity-30 cursor-pointer"
                        title="بزرگ‌نمایی (Zoom In)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>

                      {zoomLevel > 1 && (
                        <span className="text-[10px] text-amber-400 font-sans hidden sm:flex items-center gap-1 mr-1">
                          <MoveHorizontal className="w-3 h-3" />
                          <span>با موس بکشید (Drag)</span>
                        </span>
                      )}
                    </div>

                    {/* دکمه دانلود تصویر نمودار به همراه کارنامه آماری */}
                    <button
                      type="button"
                      onClick={handleDownloadEquityChartImage}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                      title="دانلود تصویر باکیفیت PNG نمودار به همراه جدول کامل آمار زیر تصویر"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>دانلود تصویر نمودار و آمار (PNG)</span>
                    </button>
                  </div>
                </div>

                {/* محفظه نمودار با اسکرول، کشیدن با موس (Mouse Drag-to-Pan) و بزرگ‌نمایی */}
                <div
                  ref={chartScrollContainerRef}
                  dir="ltr"
                  onMouseDown={handleChartMouseDown}
                  onMouseMove={handleChartMouseMove}
                  onMouseUp={handleChartMouseUpOrLeave}
                  onMouseLeave={handleChartMouseUpOrLeave}
                  onWheel={handleChartWheel}
                  style={{
                    cursor: isChartDragging ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'crosshair',
                  }}
                  className="w-full overflow-x-auto overflow-y-hidden pb-2 pt-1 rounded-xl bg-[#10141f] border border-[#202b3c] select-none scrollbar-thin scrollbar-thumb-[#2c394e] scrollbar-track-[#0c1018]"
                >
                  {(() => {
                    const svgWidth = 1000;
                    const svgHeight = 180;
                    const yRange = chartStats.maxEq - chartStats.minEq || 1;

                    return (
                      <div
                        style={{
                          width: `${100 * zoomLevel}%`,
                          minWidth: '100%',
                        }}
                        className="relative h-48 select-none"
                      >
                        <svg
                          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                          preserveAspectRatio="none"
                          className="w-full h-full overflow-visible pointer-events-auto"
                          onMouseMove={(e) => {
                            if (isChartDragging) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const mouseX = e.clientX - rect.left;
                            const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
                            const idx = Math.min(
                              equityPoints.length - 1,
                              Math.max(0, Math.round(ratio * (equityPoints.length - 1)))
                            );
                            const p = equityPoints[idx];
                            if (p) {
                              const x = (idx / (equityPoints.length - 1)) * svgWidth;
                              const y = svgHeight - 15 - ((p.equity - chartStats.minEq) / yRange) * (svgHeight - 30);
                              setHoveredEquityPoint({ index: idx, x: mouseX, y, point: p });
                            }
                          }}
                        >
                          <defs>
                            <linearGradient id="eqGradFull" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                              <stop offset="60%" stopColor="#10b981" stopOpacity="0.12" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* خطوط تراز افقی (Grid Lines) */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = chartStats.minEq + yRange * ratio;
                            const gy = svgHeight - 15 - ratio * (svgHeight - 30);
                            const isBaseline = Math.abs(val - capital) < yRange * 0.05;
                            return (
                              <g key={ratio}>
                                <line
                                  x1={0}
                                  y1={gy}
                                  x2={svgWidth}
                                  y2={gy}
                                  stroke={isBaseline ? 'rgba(245, 158, 11, 0.45)' : '#1a2230'}
                                  strokeWidth={isBaseline ? 1.2 : 0.8}
                                  strokeDasharray={isBaseline ? '4,4' : undefined}
                                />
                                <text
                                  x={svgWidth - 10}
                                  y={gy - 4}
                                  fill={isBaseline ? '#fbbf24' : '#4b5563'}
                                  fontSize="9"
                                  fontFamily="monospace"
                                  textAnchor="end"
                                >
                                  ${Math.round(val).toLocaleString()}
                                </text>
                              </g>
                            );
                          })}

                          {/* ناحیه پرشده گرادینت زیر منحنی */}
                          <path
                            d={`M 0,${svgHeight - 15} ${equityPoints
                              .map((p, idx) => {
                                const x = (idx / (equityPoints.length - 1)) * svgWidth;
                                const y = svgHeight - 15 - ((p.equity - chartStats.minEq) / yRange) * (svgHeight - 30);
                                return `L ${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ')} L ${svgWidth},${svgHeight - 15} Z`}
                            fill="url(#eqGradFull)"
                          />

                          {/* خط اصلی منحنی رشد سرمایه */}
                          <path
                            d={`M ${equityPoints
                              .map((p, idx) => {
                                const x = (idx / (equityPoints.length - 1)) * svgWidth;
                                const y = svgHeight - 15 - ((p.equity - chartStats.minEq) / yRange) * (svgHeight - 30);
                                return `${idx === 0 ? '' : 'L '}${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ')}`}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* نقطه شناور در هنگام حرکت موس (Hover Point) */}
                          {hoveredEquityPoint && (
                            <g>
                              <line
                                x1={(hoveredEquityPoint.index / (equityPoints.length - 1)) * svgWidth}
                                y1={0}
                                x2={(hoveredEquityPoint.index / (equityPoints.length - 1)) * svgWidth}
                                y2={svgHeight}
                                stroke="rgba(255, 255, 255, 0.35)"
                                strokeWidth="1"
                                strokeDasharray="3,3"
                              />
                              <circle
                                cx={(hoveredEquityPoint.index / (equityPoints.length - 1)) * svgWidth}
                                cy={hoveredEquityPoint.y}
                                r={5}
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                            </g>
                          )}
                        </svg>

                        {/* جعبه اطلاعات شناور پوینت انتخاب شده */}
                        {hoveredEquityPoint && (
                          <div
                            style={{
                              left: Math.max(10, Math.min(hoveredEquityPoint.x - 100, (100 * zoomLevel * 8) - 220)),
                              top: Math.max(10, hoveredEquityPoint.y - 65),
                            }}
                            className="absolute pointer-events-none z-30 p-2 rounded-lg bg-[#0a0e17]/95 border border-cyan-500/40 shadow-xl backdrop-blur-xs text-[10px] space-y-0.5 font-sans"
                            dir="rtl"
                          >
                            <div className="flex items-center justify-between text-gray-300 font-bold border-b border-[#202a3a] pb-1 mb-1">
                              <span>معامله #{hoveredEquityPoint.index + 1}</span>
                              <span className="font-mono text-cyan-300">{hoveredEquityPoint.point.symbol || 'USDT'}</span>
                              <span
                                className={`px-1 rounded text-[9px] font-mono ${
                                  hoveredEquityPoint.point.direction === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {hoveredEquityPoint.point.direction}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-gray-400">
                              <span>سود معامله:</span>
                              <span
                                className={`font-mono font-bold ${
                                  hoveredEquityPoint.point.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {hoveredEquityPoint.point.pnl >= 0 ? '+' : ''}${hoveredEquityPoint.point.pnl}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-gray-400">
                              <span>ارزش سرمایه:</span>
                              <span className="font-mono font-bold text-white">
                                ${hoveredEquityPoint.point.equity.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleScannerSort('symbol')}
                      title="مرتب‌سازی بر اساس نماد"
                    >
                      جفت‌ارز {renderScannerSortArrow('symbol')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleScannerSort('totalTrades')}
                      title="مرتب‌سازی بر اساس تعداد معاملات"
                    >
                      تعداد معامله {renderScannerSortArrow('totalTrades')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleScannerSort('winRate')}
                      title="مرتب‌سازی بر اساس وین‌ریت"
                    >
                      وین‌ریت {renderScannerSortArrow('winRate')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleScannerSort('netProfit')}
                      title="مرتب‌سازی بر اساس سود خالص (با کسر کارمزد)"
                    >
                      سود خالص {renderScannerSortArrow('netProfit')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center text-amber-300 cursor-pointer hover:text-amber-200 transition-colors"
                      onClick={() => handleScannerSort('totalFee')}
                      title={`کارمزد کل بر مبنای ${entryCommissionPercent}٪ ورود و ${exitCommissionPercent}٪ خروج`}
                    >
                      کارمزد کل ({commissionPercent}%) {renderScannerSortArrow('totalFee')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleScannerSort('profitFactor')}
                      title="مرتب‌سازی بر اساس Profit Factor"
                    >
                      Profit Factor {renderScannerSortArrow('profitFactor')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleScannerSort('maxDrawdownPercent')}
                      title="مرتب‌سازی بر اساس درودان"
                    >
                      درصد درودان {renderScannerSortArrow('maxDrawdownPercent')}
                    </th>
                    <th
                      className="py-2.5 px-3 text-center text-emerald-400 font-bold cursor-pointer hover:text-emerald-300 transition-colors"
                      onClick={() => handleScannerSort('optimalRiskForDD20')}
                      title="ریسک بهینه به درصد برای مهار درودان زیر ۲۰٪"
                    >
                      ریسک بهینه (DD &lt; 20%) {renderScannerSortArrow('optimalRiskForDD20')}
                    </th>
                    <th className="py-2.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2736] font-mono">
                  {filteredScannerResults.map((item, idx) => (
                    <tr key={item.pair.symbol} className="hover:bg-[#161c28] transition-colors">
                      <td className="py-2.5 px-3 text-gray-500 text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{item.pair.baseAsset}/USDT</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
                            Futures
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-bold">{item.totalTrades}</span>
                        <span className="text-[10px] text-gray-500 ml-1">({item.winTrades}W / {item.lossTrades}L)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-sky-400 font-bold">{item.winRate}%</td>
                      <td className={`py-2.5 px-3 text-center font-bold ${item.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <div>{item.netProfit >= 0 ? '+' : ''}{(item.netProfit ?? 0).toLocaleString()} ({item.netProfitPercent ?? 0}%)</div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-400 font-bold">
                        -${(item.totalFee ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">{item.profitFactor}</td>
                      <td className="py-2.5 px-3 text-center text-amber-400">{item.maxDrawdownPercent}%</td>
                      <td className="py-2.5 px-3 text-center text-emerald-300 font-bold bg-emerald-950/20">{item.optimalRiskForDD20}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectPairAndClose(item.pair)}
                          className="px-2 py-1 rounded bg-[#202738] hover:bg-amber-400 hover:text-black font-sans text-[11px] font-bold cursor-pointer transition-colors"
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
        {/* TAB 2: OPTIMIZER (مدل سبک و سریع: ۱۰ تست برتر + رنج‌های بهینه) */}
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
                    <span className="text-xs font-bold text-gray-400">استراتژی هدف:</span>
                    <span className="text-xs font-extrabold text-cyan-300 font-sans px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40">
                      {selectedStrategyId === 'strategy_1_e_breakout'
                        ? 'استراتژی ۱: شکست نقطه E (تارگت A / استاپ F)'
                        : 'استراتژی ۲: اولین تشکیل لگ بعد از F (تارگت R:R)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                    تایم‌فریم تست: <strong className="text-white font-mono">{timeframe}</strong> | ریسک: <strong className="text-white font-mono">{riskPercent}%</strong> | سرمایه: <strong className="text-white font-mono">{capital.toLocaleString()} USDT</strong>
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
                  title="دانلود فایل سبک JSON شامل ۱۰ تست برتر و رنج‌های بهینه"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی سبک JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleImportJSONClick}
                  className="px-3 py-1.5 rounded-xl bg-[#1b2230] hover:bg-[#253046] text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="بارگذاری فایل JSON رنج‌ها و ۱۰ تست برتر"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>بارگذاری JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetOptimizer}
                  disabled={isOptimizing}
                  className="px-3 py-1.5 rounded-xl bg-[#1b2230] hover:bg-rose-950/50 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="پاک کردن تمامی آزمایش‌ها، ترکیب‌ها و بازنشانی رنج‌های بهینه‌ساز"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reset (پاک کردن آزمایش‌ها)</span>
                </button>
              </div>
            </div>

            {/* ۲. رنج‌های فعال و تطبیق‌پذیر پارامترها (Adaptive Ranges Display) */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-[#171f2e] to-[#121722] border border-[#2b3a52]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">
                    رنج‌های بهینه پارامترها (Adaptive Search Ranges):
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                    کل آزمایش‌های انجام‌شده: {totalEvaluatedCount.toLocaleString()} تست
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  * رنج‌ها با هر تست موفق بهینه‌تر می‌شوند و آزمایش‌های بعدی مستقیماً از این رنج‌ها انتخاب می‌شوند.
                </span>
              </div>

              {/* نمایشگر رنج‌های ۸ پارامتر */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۱. دوره ATR:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.atrPeriod.min} - {adaptiveRanges.atrPeriod.max}]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.atrPeriod.bestVal}</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۲. حداقل کندل:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.minCandles.min} - {adaptiveRanges.minCandles.max}]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.minCandles.bestVal}</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۳. کندل لگ بلند:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.minCandlesForLongLeg.min} - {adaptiveRanges.minCandlesForLongLeg.max}]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.minCandlesForLongLeg.bestVal}</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۴. ضریب عادی:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.atrMultiplier.min}× - {adaptiveRanges.atrMultiplier.max}×]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.atrMultiplier.bestVal}×</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۵. ضریب لگ بزرگ:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.longLegAtrMultiplier.min}× - {adaptiveRanges.longLegAtrMultiplier.max}×]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.longLegAtrMultiplier.bestVal}×</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۶. سقف لگ آبی:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.maxBlueLegPercent.min}% - {adaptiveRanges.maxBlueLegPercent.max}%]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.maxBlueLegPercent.bestVal}%</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۷. نفوذ شکست ATR:</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.maxBreakoutAtrMultiplier.min}× - {adaptiveRanges.maxBreakoutAtrMultiplier.max}×]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.maxBreakoutAtrMultiplier.bestVal}×</span>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#232e42]">
                  <span className="text-[10px] text-gray-400 block mb-0.5">۸. ریسک به ریوارد (R:R):</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-cyan-300 font-bold">[{adaptiveRanges.maxRiskReward.min} - {adaptiveRanges.maxRiskReward.max}]</span>
                    <span className="text-[10px] text-amber-400">مرکز: {adaptiveRanges.maxRiskReward.bestVal}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ۳. شروط اولیه ارزیابی و تنظیمات قفل پارامترها */}
            <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#242e40] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                    حداقل تعداد کل معاملات (Min Trades):
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

              {/* گزینه‌های قفل پارامترها */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-[#222d3e]">
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
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#232c3d]">
                <div className="flex items-center gap-2">
                  {!isOptimizing ? (
                    <button
                      type="button"
                      onClick={handleStartAutoOptimization}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 hover:brightness-110 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {sessionSecondsLeft <= 0 ? 'ادامه سشن ۱۵ دقیقه‌ای جدید' : 'شروع بهینه‌سازی رنج‌محور (سشن ۱۵ دقیقه‌ای)'}
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

                  <button
                    type="button"
                    onClick={handleResetOptimizer}
                    disabled={isOptimizing}
                    className="px-3 py-1.5 rounded-xl bg-[#171d2b] hover:bg-rose-950/40 text-gray-300 hover:text-rose-400 border border-[#2b374c] hover:border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="پاک کردن تمامی آزمایش‌ها و ترکیب‌های قبلی"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reset</span>
                  </button>
                </div>

                {bestWinningRow && (
                  <button
                    type="button"
                    onClick={handleApplyBestToChart}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="اعمال مستقیم برنده جدول به اندیکاتور زیگ‌زاگ چارت"
                  >
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>اعمال بهترین ترکیب برنده به چارت اصلی</span>
                  </button>
                )}
              </div>
            </div>

            {/* ۴. کارت ترکیب برنده جدول */}
            {bestWinningRow && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-[#151c28] to-[#121622] border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-amber-400">بهترین ترکیب کشف‌شده (Top #1 Winner)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-400/20 text-amber-300">ردیف #{bestWinningRow.id}</span>
                      {bestWinningRow.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✅ پاس‌کننده هر ۳ شرط (DD &lt; {targetMaxDrawdown}% | WR &gt; {targetMinWinRate}% | Trades &ge; {targetMinTrades})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          ⚠️ پر سودترین ردیف جدول
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

            {/* ۵. جدول ۱۰ ترکیب برتر (Top 10 Elite) */}
            <div className="flex-1 min-h-60 rounded-xl border border-[#242e40] overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-[#0e121a] border-b border-[#232c3d] flex items-center justify-between text-xs font-bold text-gray-300">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>جدول ۱۰ ترکیب برتر تاریخچه (Top 10 Elite Tests)</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    (تنها ۱۰ تست برتر برای سبکی و سرعت در حافظه نگهداری می‌شوند)
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">
                  مرتب‌شده بر اساس بیشترین سود خالص
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#10141c] text-gray-400 border-b border-[#232c3d] select-none">
                    <tr>
                      <th className="py-2.5 px-2.5">رتبه</th>
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
                      <th className="py-2.5 px-2.5 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2736] font-mono text-[11px]">
                    {sortedTop10.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="py-8 text-center text-gray-500 font-sans">
                          هنوز آزمایشی ثبت نشده است. با زدن «شروع بهینه‌سازی رنج‌محور»، تست‌ها شروع شده و ۱۰ ترکیب برتر اینجا نمایش داده می‌شوند.
                        </td>
                      </tr>
                    ) : (
                      sortedTop10.map((row, idx) => {
                        const isTheBest = idx === 0;
                        return (
                          <tr
                            key={row.hash || row.id}
                            className={`hover:bg-[#161c28] transition-colors ${
                              isTheBest ? 'bg-amber-950/30 border-r-4 border-amber-400' : ''
                            }`}
                          >
                            <td className="py-2 px-2.5">
                              <span className="font-bold text-white">#{idx + 1}</span>
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
            * داده‌های بازار در حافظه کش ذخیره می‌شوند. سیستم تنها ۱۰ تست برتر و رنج‌های بهینه‌شده را ذخیره می‌کند تا سرعت و سبکی برنامه همواره حفظ شود.
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

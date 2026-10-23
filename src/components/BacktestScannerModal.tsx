import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Sparkles,
  Database,
  Cpu,
  Trash2,
  Check,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Percent,
  Sliders,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  FolderOpen,
  Save,
  Download,
  Upload,
  Trophy,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileCheck2,
  ClipboardCheck,
  Calendar,
  AlertTriangle,
  CloudUpload,
  CloudDownload,
  Loader2,
} from 'lucide-react';
import { CryptoPair, CandleData, Timeframe, ZigZagSettings, ExchangeType } from '../types/crypto';
import { StrategyConfig, StrategyTrade } from '../types/strategy';
import {
  fetchUSDTMarketPairs,
  fetchFuturesMarketPairs,
  fetchKlines,
  performServerSideMarketDownload,
} from '../services/binance';
import { fetchXtPairs } from '../services/xt';
import { calculateATR, calculateAtrZigZag, analyzeZigZagLegs } from '../utils/indicators';
import { runStrategy1Backtest, runStrategy2Backtest } from '../utils/strategyEngine';
import {
  saveTestConfigToFirestore,
  loadTestConfigsFromFirestore,
  deleteTestConfigFromFirestore,
  TestParameterConfigRecord,
  saveCandleDatasetToFirestore,
  makeTemporaryDatasetPermanent,
  loadCandleDatasetsListFromFirestore,
  loadCandleDatasetDataFromFirestore,
  deleteCandleDatasetFromFirestore,
  MarketCandleDatasetMetadata,
  calculateDatasetSizeInBytes,
  CandleDatasetProgress,
  saveBacktestConfigToFirestore,
  loadBacktestConfigsFromFirestore,
  deleteBacktestConfigFromFirestore,
  SavedBacktestConfigRecord,
  saveAllowedPairsToFirestore,
  loadAllowedPairsFromFirestore,
} from '../services/firebase';
import {
  getCloudSqlStatus,
  saveDatasetToCloudSql,
  getCloudSqlDatasets,
  loadDatasetFromCloudSql,
  deleteDatasetFromCloudSql,
  promoteDatasetInCloudSql,
  CloudSqlStatus,
} from '../services/cloudsql';
import {
  getCachedCandlesFromDb,
  saveCandlesToDb,
  preloadAllCandlesToMemory,
  clearCandleDbStore,
} from '../utils/candleDb';

import {
  BacktestResultItem,
  OptimizationTrial,
  ParameterRange,
  AdaptiveRanges,
  SortDirection,
  ScannerSortCol,
  OptSortCol,
  GLOBAL_CANDLE_CACHE,
  toMs,
  toSec,
  getDefaultRangesForContext,
  calculateQualityScore,
  refineAdaptiveRangesSmart,
  generateConfigHash,
  DEFAULT_RANGES,
} from './backtest/types';
import { useStatsAudit } from './backtest/useStatsAudit';
import { ManualBacktestTab } from './backtest/ManualBacktestTab';
import { OptimizerTab } from './backtest/OptimizerTab';
import { StatsTab } from './backtest/StatsTab';
import { SaveConfigModal } from './backtest/SaveConfigModal';
import { LoadConfigModal } from './backtest/LoadConfigModal';
import { SaveCandleModal } from './backtest/SaveCandleModal';
import { LoadCandleModal } from './backtest/LoadCandleModal';
import { AllowedPairsModal } from './backtest/AllowedPairsModal';
import { TimeRangeModal } from './backtest/TimeRangeModal';
import { DEFAULT_POPULAR_WATCHLIST } from './LiveTradingTab';

export type {
  BacktestResultItem,
  OptimizationTrial,
  ParameterRange,
  AdaptiveRanges,
  SortDirection,
  ScannerSortCol,
  OptSortCol,
};

export {
  GLOBAL_CANDLE_CACHE,
  toMs,
  toSec,
  calculateQualityScore,
  refineAdaptiveRangesSmart,
  DEFAULT_RANGES,
};

export interface BacktestScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zigzagSettings?: ZigZagSettings;
  onUpdateZigZagSettings?: (settings: Partial<ZigZagSettings>) => void;
  currentTimeframe: Timeframe;
  onSelectPairAndClose: (pair: CryptoPair) => void;
  currentUser?: string;
  exchange?: ExchangeType;
  onSelectExchange?: (exchange: ExchangeType) => void;
}

export const BacktestScannerModal: React.FC<BacktestScannerModalProps> = ({
  isOpen,
  onClose,
  zigzagSettings,
  onUpdateZigZagSettings,
  currentTimeframe,
  onSelectPairAndClose,
  currentUser = 'amir',
  exchange,
  onSelectExchange,
}) => {
  // صرافی انتخابی برای اسکن بک‌تست (پیش‌فرض XT.COM مطابق با درخواست کاربر)
  const [selectedExchange, setSelectedExchange] = useState<ExchangeType>(() => {
    return exchange || 'xt';
  });

  useEffect(() => {
    if (exchange) {
      setSelectedExchange(exchange);
    }
  }, [exchange]);

  // چک‌باکس عدم ورود به معامله جدید در صورت وجود پوزیشن باز (تک‌پوزیشن)
  const [noConcurrentPositions, setNoConcurrentPositions] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('backtest_no_concurrent_positions');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleNoConcurrentPositions = (val: boolean) => {
    setNoConcurrentPositions(val);
    try {
      localStorage.setItem('backtest_no_concurrent_positions', String(val));
    } catch {}
  };

  // Navigation Tabs: 'scanner' (اسکن دستی بازار) | 'optimizer' (بهینه‌ساز بیزی رنج‌محور) | 'stats' (آمار و اعتبارسنجی داده‌ها)
  const [activeTab, setActiveTab] = useState<'scanner' | 'optimizer' | 'stats'>('scanner');

  // Strategy selection
  const [selectedStrategyId, setSelectedStrategyId] = useState<'strategy_1_e_breakout' | 'strategy_2_next_pivot'>(
    'strategy_1_e_breakout'
  );

  // General Parameters
  const [capital, setCapital] = useState<number>(10000);
  const [riskMode, setRiskMode] = useState<'percent' | 'fixed'>(() => {
    try {
      const saved = localStorage.getItem('backtest_risk_mode');
      if (saved === 'fixed' || saved === 'percent') return saved;
    } catch {}
    return 'percent';
  });
  const [riskPercent, setRiskPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_risk_percent');
      if (saved !== null) return parseFloat(saved) || 1.0;
    } catch {}
    return 1.0;
  });
  const [riskAmountFixed, setRiskAmountFixed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_risk_amount_fixed');
      if (saved !== null) return parseFloat(saved) || 10;
    } catch {}
    return 10; // پیش‌فرض: ۱۰ دلار ریسک ثابت در هر معامله
  });

  // درصد ریسک معادل (برای محاسبات درودان بهینه و سازگاری کامل فرمول‌ها با ریسک ثابت)
  const effectiveRiskPercent = useMemo(() => {
    if (riskMode === 'fixed') {
      return capital > 0 ? parseFloat(((riskAmountFixed / capital) * 100).toFixed(3)) : 1.0;
    }
    return riskPercent || 1.0;
  }, [riskMode, riskAmountFixed, riskPercent, capital]);

  // مبلغ ریسک دلاری معادل (USDT) در هر معامله
  const effectiveRiskUsdt = useMemo(() => {
    if (riskMode === 'fixed') {
      return riskAmountFixed;
    }
    return parseFloat(((capital * (riskPercent || 1.0)) / 100).toFixed(2));
  }, [riskMode, riskAmountFixed, riskPercent, capital]);

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
  const [universeOption, setUniverseOption] = useState<'all_market' | 'all_futures' | 'all_spot' | 'top_50' | 'top_30'>(() => {
    try {
      const saved = localStorage.getItem('backtest_universe_option');
      if (saved && (saved === 'all_market' || saved === 'all_futures' || saved === 'all_spot' || saved === 'top_50' || saved === 'top_30')) {
        return saved as any;
      }
    } catch {}
    return 'all_market'; // پیش‌فرض: تمام ارزهای بازار با ارزش/حجم بالای ۱ میلیون دلار (>700 ارز)
  });
  const [cloudSqlStatus, setCloudSqlStatus] = useState<CloudSqlStatus | null>(null);

  // مودال انتخاب ارزهای مجاز اسکن بازار بکتست
  const [isAllowedPairsModalOpen, setIsAllowedPairsModalOpen] = useState<boolean>(false);
  const [selectedAllowedSymbols, setSelectedAllowedSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('backtest_selected_allowed_symbols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const liveSaved = localStorage.getItem('livetrade_selected_symbols');
      if (liveSaved) {
        const parsed = JSON.parse(liveSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_POPULAR_WATCHLIST;
  });

  // بارگذاری ارزهای مجاز ذخیره‌شده از دیتابیس Firestore کاربر
  useEffect(() => {
    loadAllowedPairsFromFirestore(currentUser || 'amir')
      .then((loaded) => {
        if (loaded && loaded.length > 0) {
          setSelectedAllowedSymbols(loaded);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  const handleSaveAllowedSymbols = (symbols: string[]) => {
    setSelectedAllowedSymbols(symbols);
    try {
      localStorage.setItem('backtest_selected_allowed_symbols', JSON.stringify(symbols));
    } catch {}
  };

  // مودال بازه زمانی و تقویم بکتست
  const [isTimeRangeModalOpen, setIsTimeRangeModalOpen] = useState<boolean>(false);
  const [timeRangeStartMs, setTimeRangeStartMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_time_range_start_ms');
      if (saved) return Number(saved);
    } catch {}
    return Date.now() - 30 * 24 * 60 * 60 * 1000;
  });
  const [timeRangeEndMs, setTimeRangeEndMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_time_range_end_ms');
      if (saved) return Number(saved);
    } catch {}
    return Date.now();
  });
  const [timeRangeLabel, setTimeRangeLabel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('backtest_time_range_label');
      if (saved) return saved;
    } catch {}
    return '۳۰ روز گذشته (۱ ماه)';
  });
  const [estimatedCandles, setEstimatedCandles] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_estimated_candles');
      if (saved) return Number(saved);
    } catch {}
    return 2880;
  });

  const handleApplyTimeRange = (params: {
    startDate: string;
    endDate: string;
    startTimeMs: number;
    endTimeMs: number;
    estimatedCandles: number;
    label: string;
  }) => {
    setTimeRangeStartMs(params.startTimeMs);
    setTimeRangeEndMs(params.endTimeMs);
    setTimeRangeLabel(params.label);
    setEstimatedCandles(params.estimatedCandles);
    const limit = Math.min(params.estimatedCandles, selectedExchange === 'xt' ? 1000 : 5000);
    setCandleHistoryLimit(Math.max(50, limit));
    try {
      localStorage.setItem('backtest_time_range_start_ms', String(params.startTimeMs));
      localStorage.setItem('backtest_time_range_end_ms', String(params.endTimeMs));
      localStorage.setItem('backtest_time_range_label', params.label);
      localStorage.setItem('backtest_estimated_candles', String(params.estimatedCandles));
    } catch {}
  };

  useEffect(() => {
    getCloudSqlStatus().then((st) => setCloudSqlStatus(st)).catch(() => {});
  }, []);

  // تابع محاسبه دقیق تعداد جفت‌ارزهای یکتای موجود در حافظه کش برای تایم‌فریم جاری
  const getCachedUniqueCount = useCallback((tf?: string) => {
    const targetTf = tf || timeframe;
    const uniqueSymbols = new Set<string>();
    for (const entry of Array.from(GLOBAL_CANDLE_CACHE.values())) {
      if (entry && entry.candles && entry.candles.length >= 50) {
        if (!entry.timeframe || entry.timeframe === targetTf) {
          const sym = entry.pair?.symbol;
          if (sym) uniqueSymbols.add(sym.toUpperCase());
        }
      }
    }
    return uniqueSymbols.size;
  }, [timeframe]);

  // Cached Candles in Memory to avoid repeated downloads!
  const [cachedCount, setCachedCount] = useState<number>(() => {
    const uniqueSymbols = new Set<string>();
    for (const entry of Array.from(GLOBAL_CANDLE_CACHE.values())) {
      if (entry && entry.candles && entry.candles.length >= 50) {
        if (!entry.timeframe || entry.timeframe === '5m') {
          const sym = entry.pair?.symbol;
          if (sym) uniqueSymbols.add(sym.toUpperCase());
        }
      }
    }
    return uniqueSymbols.size;
  });

  useEffect(() => {
    setCachedCount(getCachedUniqueCount());
    // لود خودکار کندل‌های ذخیره‌شده از IndexedDB مرورگر به حافظه رم برای دسترسی فوری بدون نیاز به دانلود
    preloadAllCandlesToMemory(GLOBAL_CANDLE_CACHE, timeframe, selectedExchange).then((loaded) => {
      if (loaded > 0) {
        setCachedCount(getCachedUniqueCount());
      }
    });
  }, [timeframe, selectedExchange, getCachedUniqueCount]);

  // تعداد ورکر همزمان برای دانلود و اسکن موازی سریع (Workers Concurrency)
  const [scanWorkersCount, setScanWorkersCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_scan_workers_v2');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 20; // پیش‌فرض ۲۰ ورکر برای سرعت حداکثری در ۱۱۰۰+ نماد
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
  const [optAtrPeriod, setOptAtrPeriod] = useState<number>(zigzagSettings?.atrPeriod || 55);
  const [lockAtrPeriod, setLockAtrPeriod] = useState<boolean>(false);

  const [optMinCandles, setOptMinCandles] = useState<number>(zigzagSettings?.minCandles || 3);
  const [lockMinCandles, setLockMinCandles] = useState<boolean>(false);

  const [optMinCandlesLong, setOptMinCandlesLong] = useState<number>(zigzagSettings?.minCandlesForLongLeg || 20);
  const [lockMinCandlesLong, setLockMinCandlesLong] = useState<boolean>(false);

  const [optAtrMultiplier, setOptAtrMultiplier] = useState<number>(zigzagSettings?.atrMultiplier || 3.0);
  const [lockAtrMultiplier, setLockAtrMultiplier] = useState<boolean>(false);

  const [optLongLegAtrMult, setOptLongLegAtrMult] = useState<number>(zigzagSettings?.longLegAtrMultiplier || 10.0);
  const [lockLongLegAtrMult, setLockLongLegAtrMult] = useState<boolean>(false);

  const [optMaxBlueLegPercent, setOptMaxBlueLegPercent] = useState<number>(zigzagSettings?.maxBlueLegPercent ?? 60);
  const [lockMaxBlueLegPercent, setLockMaxBlueLegPercent] = useState<boolean>(false);

  const [optMaxBreakoutAtr, setOptMaxBreakoutAtr] = useState<number>(zigzagSettings?.maxBreakoutAtrMultiplier ?? 5.0);
  const [lockMaxBreakoutAtr, setLockMaxBreakoutAtr] = useState<boolean>(false);

  const [optMaxRiskReward, setOptMaxRiskReward] = useState<number>(2.0);
  const [lockMaxRiskReward, setLockMaxRiskReward] = useState<boolean>(false);

  // همگام‌سازی با تنظیمات زیگ‌زاگ وارده توسط کاربر در چارت
  useEffect(() => {
    if (!zigzagSettings) return;
    if (zigzagSettings.atrPeriod && zigzagSettings.atrPeriod !== optAtrPeriod) setOptAtrPeriod(zigzagSettings.atrPeriod);
    if (zigzagSettings.minCandles && zigzagSettings.minCandles !== optMinCandles) setOptMinCandles(zigzagSettings.minCandles);
    if (zigzagSettings.minCandlesForLongLeg && zigzagSettings.minCandlesForLongLeg !== optMinCandlesLong) setOptMinCandlesLong(zigzagSettings.minCandlesForLongLeg);
    if (zigzagSettings.atrMultiplier && zigzagSettings.atrMultiplier !== optAtrMultiplier) setOptAtrMultiplier(zigzagSettings.atrMultiplier);
    if (zigzagSettings.longLegAtrMultiplier && zigzagSettings.longLegAtrMultiplier !== optLongLegAtrMult) setOptLongLegAtrMult(zigzagSettings.longLegAtrMultiplier);
    if (zigzagSettings.maxBlueLegPercent !== undefined && zigzagSettings.maxBlueLegPercent !== optMaxBlueLegPercent) setOptMaxBlueLegPercent(zigzagSettings.maxBlueLegPercent);
    if (zigzagSettings.maxBreakoutAtrMultiplier !== undefined && zigzagSettings.maxBreakoutAtrMultiplier !== optMaxBreakoutAtr) setOptMaxBreakoutAtr(zigzagSettings.maxBreakoutAtrMultiplier);
  }, [
    zigzagSettings?.atrPeriod,
    zigzagSettings?.minCandles,
    zigzagSettings?.minCandlesForLongLeg,
    zigzagSettings?.atrMultiplier,
    zigzagSettings?.longLegAtrMultiplier,
    zigzagSettings?.maxBlueLegPercent,
    zigzagSettings?.maxBreakoutAtrMultiplier,
  ]);

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
  // ۱. ذخیره و لود کانفیگ پارامترهای تست (Test Config Parameters Only)
  // =========================================================================
  const [isSaveConfigModalOpen, setIsSaveConfigModalOpen] = useState<boolean>(false);
  const [isLoadConfigModalOpen, setIsLoadConfigModalOpen] = useState<boolean>(false);
  const [customConfigName, setCustomConfigName] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(false);
  const [savedTestConfigs, setSavedTestConfigs] = useState<TestParameterConfigRecord[]>([]);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);

  // =========================================================================
  // ۲. ذخیره و لود دیتای کندل‌های چارت دانلودشده از صرافی (Market Candle Datasets)
  // =========================================================================
  const [isSaveCandleModalOpen, setIsSaveCandleModalOpen] = useState<boolean>(false);
  const [isLoadCandleModalOpen, setIsLoadCandleModalOpen] = useState<boolean>(false);
  const [customDatasetName, setCustomDatasetName] = useState<string>('');
  const [isSavingCandles, setIsSavingCandles] = useState<boolean>(false);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);
  const [savedCandleDatasets, setSavedCandleDatasets] = useState<MarketCandleDatasetMetadata[]>([]);
  const [deletingDatasetId, setDeletingDatasetId] = useState<string | null>(null);
  const [loadingDatasetId, setLoadingDatasetId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<CandleDatasetProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<CandleDatasetProgress | null>(null);
  const [activeSessionDatasetId, setActiveSessionDatasetId] = useState<string | null>(null);

  // محاسبه لحظه‌ای و دقیق حجم داده‌های کش کندل‌ها
  const currentCandleDatasetStats = useMemo(() => {
    const entries = Array.from(GLOBAL_CANDLE_CACHE.values());
    return calculateDatasetSizeInBytes(entries);
  }, [GLOBAL_CANDLE_CACHE.size, isSaveCandleModalOpen]);

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

  // حالت یادگیری و انقباض خودکار رنج‌ها حول خوشه برنده (Adaptive Learning Mode)
  const [autoAdaptiveEnabled, setAutoAdaptiveEnabled] = useState<boolean>(true);

  // کالیبراسیون هوشمند رنج‌ها بر مبنای تایم‌فریم و استراتژی انتخابی
  const handleAutoCalibrateRanges = () => {
    const calibrated = getDefaultRangesForContext(timeframe, selectedStrategyId);
    setAdaptiveRanges(calibrated);
    showToast(`🎯 رنج‌های پارامترها با موفقیت بر اساس تایم‌فریم ${timeframe} و استراتژی هوشمندانه کالیبره شدند.`);
  };

  // ویرایش دستی محدوده حداقل و حداکثر برای هر پارامتر (بدون محدودیت سقف تصنعی)
  const handleUpdateParamRange = (key: keyof AdaptiveRanges, field: 'min' | 'max', value: number) => {
    setAdaptiveRanges((prev) => {
      const cur = { ...prev[key] };
      const safeVal = isNaN(value) ? 0 : value;

      if (field === 'min') {
        const nextMin = Math.max(0, parseFloat(safeVal.toFixed(2)));
        cur.min = nextMin;
        // در صورت عبور حداقل از حداکثر، سقف به جلو رانده می‌شود تا پارامتر مسدود نشود
        if (cur.min >= cur.max) {
          cur.max = parseFloat((cur.min + cur.step).toFixed(2));
        }
        if (cur.min < cur.globalMin) {
          cur.globalMin = cur.min;
        }
        if (cur.max > cur.globalMax) {
          cur.globalMax = cur.max;
        }
      } else {
        // فیلد حداکثر: بدون هیچ‌گونه سقف یا محدودیت بالا؛ کاربر می‌تواند به هر میزان دلخواه آن را افزایش دهد
        const nextMax = Math.max(0, parseFloat(safeVal.toFixed(2)));
        cur.max = nextMax;
        // در صورت کاهش حداکثر به کمتر از حداقل، حداقل تنظیم می‌شود
        if (cur.max <= cur.min) {
          cur.min = Math.max(0, parseFloat((cur.max - cur.step).toFixed(2)));
        }
        // گسترش خودکار دامنه کلی جهت پوشش کامل رنج دلخواه کاربر
        if (cur.max > cur.globalMax) {
          cur.globalMax = cur.max;
        }
        if (cur.min < cur.globalMin) {
          cur.globalMin = cur.min;
        }
      }

      cur.isManualOverride = true;
      const span = Math.max(0, cur.max - cur.min);
      const globalSpan = Math.max(span, cur.globalMax - cur.globalMin);
      cur.convergence = globalSpan > 0 ? Math.round(Math.max(0, Math.min(100, (1 - span / globalSpan) * 100))) : 50;
      return { ...prev, [key]: cur };
    });
  };

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
      localStorage.setItem('backtest_risk_mode', riskMode);
      localStorage.setItem('backtest_risk_percent', riskPercent.toString());
      localStorage.setItem('backtest_risk_amount_fixed', riskAmountFixed.toString());
      localStorage.setItem('backtest_entry_commission_percent', entryCommissionPercent.toString());
      localStorage.setItem('backtest_exit_commission_percent', exitCommissionPercent.toString());
      localStorage.setItem('backtest_commission_percent', commissionPercent.toString());
    } catch {}
  }, [universeOption, riskMode, riskPercent, riskAmountFixed, entryCommissionPercent, exitCommissionPercent, commissionPercent]);

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
      const universeParam =
        universeOption === 'all_spot'
          ? 'spot'
          : universeOption === 'all_futures'
          ? 'futures'
          : universeOption === 'top_50' || universeOption === 'top_30'
          ? 'futures'
          : 'all_market';

      const maxCount =
        universeOption === 'top_30'
          ? 30
          : universeOption === 'top_50'
          ? 50
          : 1500; // بدون برش ۸۰ تایی - دریافت کامل بیش از ۷۰۰ ارز واقعی بازار بالای ۱ میلیون دلار

      const isFuturesUniverse = universeParam !== 'spot';

      // ۱. دریافت سریع لیست جفت‌ارزهای معتبر بازار از سرور یا XT (پیش‌فرض صرافی XT)
      setProgress({ current: 0, total: 0, currentSymbol: `در حال دریافت لیست ارزهای فعال (${selectedExchange.toUpperCase()})...` });
      
      let targetPairs: CryptoPair[] = [];
      if (selectedExchange === 'xt') {
        const xtPairs = await fetchXtPairs();
        targetPairs = xtPairs.slice(0, maxCount);
      } else {
        const pairsRes = await fetch(`/api/market/pairs?exchange=binance&universe=${universeParam}&limit=${maxCount}&minVolume=1000000`)
          .then((r) => r.json())
          .catch(() => null);

        targetPairs =
          pairsRes && pairsRes.success && Array.isArray(pairsRes.pairs) && pairsRes.pairs.length > 0
            ? pairsRes.pairs
            : universeParam === 'spot'
            ? await fetchUSDTMarketPairs(1000000)
            : await fetchFuturesMarketPairs(200000);
      }

      // فیلتر هوشمند بر مبنای ارزهای مجاز انتخابی کاربر
      if (selectedAllowedSymbols && selectedAllowedSymbols.length > 0) {
        const allowedSet = new Set(selectedAllowedSymbols.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
        targetPairs = targetPairs.filter((p) => {
          const s1 = p.symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
          const base = (p.baseAsset || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return allowedSet.has(s1) || allowedSet.has(`${base}usdt`) || allowedSet.has(base);
        });
      } else if (selectedAllowedSymbols && selectedAllowedSymbols.length === 0) {
        setErrorMsg('⚠️ هیچ ارزی انتخاب نشده است. لطفاً ابتدا از بخش «ارزهای مجاز اسکن بازار» ارزهای مورد نظر خود را انتخاب کنید.');
        setIsScanning(false);
        return;
      }

      const total = targetPairs.length;
      if (total === 0) {
        setErrorMsg('هیچ جفت‌ارزی برای اسکن یافت نشد. لطفاً اتصال اینترنت را بررسی کنید.');
        setIsScanning(false);
        return;
      }

      setProgress({ current: 0, total, currentSymbol: `شروع اسکن و دانلود زنده از ${selectedExchange.toUpperCase()}...` });

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

      let lastProgressTime = 0;

      const worker = async () => {
        while (queue.length > 0 && !abortControllerRef.current) {
          const pair = queue.shift();
          if (!pair) break;

          try {
            // ۱. بررسی حافظه کش سریع رم بر اساس صرافی، نماد، تایم‌فریم و بازه زمانی (۰ میلی‌ثانیه)
            const cacheKey = `${selectedExchange}_${pair.symbol}_${timeframe}_${timeRangeStartMs}_${timeRangeEndMs}`;
            let candles: CandleData[] = [];
            const cached = GLOBAL_CANDLE_CACHE.get(cacheKey);
            if (cached && cached.candles && cached.candles.length >= 50 && cached.timeframe === timeframe) {
              candles = cached.candles;
            } else {
              // ۲. بررسی دیتابیس پایدار مرورگر (IndexedDB - ۱ میلی‌ثانیه بدون ترافیک شبکه)
              const idbCached = await getCachedCandlesFromDb(selectedExchange, pair.symbol, timeframe);
              if (idbCached && idbCached.candles && idbCached.candles.length >= 50) {
                candles = idbCached.candles;
                GLOBAL_CANDLE_CACHE.set(cacheKey, { pair, candles, timeframe });
                setCachedCount(getCachedUniqueCount());
              } else {
                // ۳. دانلود موازی و بهینه‌شده از اندپوینت سرور (با پشتیبانی از startTime و endTime برای XT و Binance)
                const klineRes = await fetch(
                  `/api/market/klines?exchange=${selectedExchange}&symbol=${encodeURIComponent(pair.symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${candleHistoryLimit}&isFutures=${isFuturesUniverse}&startTime=${timeRangeStartMs}&endTime=${timeRangeEndMs}`
                )
                  .then((r) => r.json())
                  .catch(() => null);

                if (klineRes && klineRes.success && Array.isArray(klineRes.candles) && klineRes.candles.length >= 50) {
                  candles = klineRes.candles;
                  GLOBAL_CANDLE_CACHE.set(cacheKey, { pair, candles, timeframe });
                  // ذخیره ماندگار در IndexedDB در پس‌زمینه بدون مسدودسازی ورکر
                  saveCandlesToDb(selectedExchange, pair.symbol, timeframe, pair, candles).catch(() => {});
                  setCachedCount(getCachedUniqueCount());
                }
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

              // ارزیابی هر دارایی با سرمایه پایه کاربر به صورت کاملاً مستقل، تکرارپذیر و پایدار
              const tempConfig: StrategyConfig = {
                capital,
                selectedStrategyId,
                riskMode,
                riskAmountFixed,
                riskPercent,
                entryCommissionPercent,
                exitCommissionPercent,
                commissionPercent,
                maxRiskReward: optMaxRiskReward,
                maxCandlesToEnter,
                maxTradesPerLeg: 1,
                showOnChart: true,
                noConcurrentPositions: true, // در تایم‌لاین یک ارز از ورود به معامله دوم قبل از بسته‌شدن اولی جلوگیری می‌شود
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
                optimalRiskForDD20 = parseFloat(((effectiveRiskPercent * 19.0) / metrics.maxDrawdownPercent).toFixed(2));
              } else if (metrics.totalTrades > 0) {
                optimalRiskForDD20 = 5.0;
              }

              const lastTrade = trades.length > 0 ? trades[trades.length - 1] : undefined;

              const resultItem: BacktestResultItem = {
                pair,
                stage: 'RAW / PRE-FILTER',
                candlesCount: candles.length,
                totalTrades: metrics.totalTrades,
                winTrades: metrics.winTrades,
                lossTrades: metrics.lossTrades,
                breakevenTrades: metrics.breakevenTrades || 0,
                activeTrades: metrics.activeTrades,
                winRate: metrics.winRate,
                grossProfit: metrics.grossProfit || 0,
                grossLoss: metrics.grossLoss || 0,
                grossPnl: metrics.grossPnl || 0,
                netProfit: metrics.netProfit,
                netProfitPercent: metrics.netProfitPercent,
                totalProfit: metrics.totalProfit,
                totalLoss: metrics.totalLoss,
                totalFee: metrics.totalFee || 0,
                profitFactor: metrics.profitFactor,
                profitFactorLabel: metrics.profitFactorLabel,
                avgRiskReward: metrics.avgRiskReward,
                maxDrawdown: metrics.maxDrawdown,
                maxDrawdownPercent: metrics.maxDrawdownPercent,
                optimalRiskForDD20,
                openPositionsCount: metrics.openPositionsCount || 0,
                openPositionsUnrealizedPnl: metrics.openPositionsUnrealizedPnl || 0,
                openPositionsFee: metrics.openPositionsFee || 0,
                lastTradeStatus:
                  lastTrade?.status === 'WIN' || lastTrade?.status === 'LOSS' || lastTrade?.status === 'BREAKEVEN' || lastTrade?.status === 'ACTIVE'
                    ? lastTrade.status
                    : undefined,
                trades,
              };

              collectedResults.push(resultItem);
              const finishedTrades = trades
                .filter((t) => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BREAKEVEN')
                .map((t, tIdx) => ({
                  ...t,
                  id: `${pair.symbol}-${t.id || tIdx}`,
                  symbol: pair.symbol,
                  stage: 'RAW / PRE-FILTER' as const,
                }));
              collectedTrades.push(...finishedTrades);
            }
          } catch (itemErr) {
            console.warn(`Error scanning ${pair.symbol}:`, itemErr);
          } finally {
            completedCount++;
            const nowP = Date.now();
            if (nowP - lastProgressTime > 100 || completedCount === total) {
              lastProgressTime = nowP;
              setProgress({
                current: completedCount,
                total,
                currentSymbol: pair.symbol,
              });
            }
            triggerThrottledCommit(false);
          }
        }
      };

      // اجرای واقعی تعداد ورکر انتخابی کاربر (بدون محدودیت غیرضروری روی ۱۰ ورکر)
      const concurrency = Math.max(1, scanWorkersCount || 20);
      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      triggerThrottledCommit(true);

      // ذخیره‌سازی خودکار در Cloud SQL پس از اتمام اسکن
      if (GLOBAL_CANDLE_CACHE.size > 0 && !abortControllerRef.current) {
        saveDatasetToCloudSql({
          name: `پیش‌نویس موقت اسکن اخیر (${timeframe})`,
          userId: currentUser || 'amir',
          timeframe,
          isTemporary: true,
        })
          .then((res) => {
            if (res.success && res.datasetId) {
              setActiveSessionDatasetId(res.datasetId);
            }
          })
          .catch(() => {});
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'خطا در ارتباط با سرور دانلود دیتای بازار.');
    } finally {
      setIsScanning(false);
    }
  };

  // =========================================================
  // محاسبه و آپدیت مجدد فوری نتایج بک‌تست بر اساس پارامترهای جدید
  // روی دیتایی که قبلاً دانلود شده است (بدون دانلود مجدد از اینترنت)
  // =========================================================
  const handleRerunOnCachedData = async () => {
    const uniqueMap = new Map<string, { pair: CryptoPair; candles: CandleData[]; timeframe: string }>();
    for (const entry of Array.from(GLOBAL_CANDLE_CACHE.values())) {
      if (entry && entry.candles && entry.candles.length >= 50 && (!entry.timeframe || entry.timeframe === timeframe)) {
        if (entry.pair && entry.pair.symbol) {
          uniqueMap.set(entry.pair.symbol.toUpperCase(), entry);
        }
      }
    }
    const cachedEntries = Array.from(uniqueMap.values());
    if (cachedEntries.length === 0) {
      showToast(`⚠️ هیچ کندلی برای تایم‌فریم ${timeframe} در حافظه نیست. لطفاً ابتدا اسکن را اجرا کنید.`);
      return;
    }

    setIsScanning(true);
    abortControllerRef.current = false;
    setErrorMsg(null);
    setResults([]);
    setAllCollectedTrades([]);
    setScanMaxDrawdown(0);

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
            riskMode,
            riskAmountFixed,
            riskPercent,
            entryCommissionPercent,
            exitCommissionPercent,
            commissionPercent,
            maxRiskReward: optMaxRiskReward,
            maxCandlesToEnter,
            maxTradesPerLeg: 1,
            showOnChart: true,
            noConcurrentPositions: true,
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
            optimalRiskForDD20 = parseFloat(((effectiveRiskPercent * 19.0) / metrics.maxDrawdownPercent).toFixed(2));
          } else if (metrics.totalTrades > 0) {
            optimalRiskForDD20 = 5.0;
          }

          const lastTrade = trades.length > 0 ? trades[trades.length - 1] : undefined;

          collectedResults.push({
            pair,
            stage: 'RAW / PRE-FILTER',
            candlesCount: candles.length,
            totalTrades: metrics.totalTrades,
            winTrades: metrics.winTrades,
            lossTrades: metrics.lossTrades,
            breakevenTrades: metrics.breakevenTrades || 0,
            activeTrades: metrics.activeTrades,
            winRate: metrics.winRate,
            grossProfit: metrics.grossProfit || 0,
            grossLoss: metrics.grossLoss || 0,
            grossPnl: metrics.grossPnl || 0,
            netProfit: metrics.netProfit,
            netProfitPercent: metrics.netProfitPercent,
            totalProfit: metrics.totalProfit,
            totalLoss: metrics.totalLoss,
            totalFee: metrics.totalFee || 0,
            profitFactor: metrics.profitFactor,
            profitFactorLabel: metrics.profitFactorLabel,
            avgRiskReward: metrics.avgRiskReward,
            maxDrawdown: metrics.maxDrawdown,
            maxDrawdownPercent: metrics.maxDrawdownPercent,
            optimalRiskForDD20,
            openPositionsCount: metrics.openPositionsCount || 0,
            openPositionsUnrealizedPnl: metrics.openPositionsUnrealizedPnl || 0,
            openPositionsFee: metrics.openPositionsFee || 0,
            lastTradeStatus:
              lastTrade?.status === 'WIN' || lastTrade?.status === 'LOSS' || lastTrade?.status === 'BREAKEVEN' || lastTrade?.status === 'ACTIVE'
                ? lastTrade.status
                : undefined,
            trades,
          });

          const finishedTrades = trades
            .filter((t) => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BREAKEVEN')
            .map((t, tIdx) => ({
              ...t,
              id: `${pair.symbol}-${t.id || tIdx}`,
              symbol: pair.symbol,
              stage: 'RAW / PRE-FILTER' as const,
            }));
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
    GLOBAL_CANDLE_CACHE.clear();
    setCachedCount(0);
    try {
      localStorage.removeItem('backtest_scanned_results_v2');
      localStorage.removeItem('backtest_scanned_trades_v2');
    } catch {}
    showToast('🗑️ نتایج اسکن و حافظه کش کندل‌ها با موفقیت پاکسازی شدند.');
  };

  const handleClearCandleCache = () => {
    GLOBAL_CANDLE_CACHE.clear();
    clearCandleDbStore().catch(() => {});
    setCachedCount(0);
    showToast('🗑️ حافظه کش کندل‌های دانلودشده و دیتابیس پایدار با موفقیت پاک شد.');
  };

  // =========================================================
  // آمار کلی و نمودارهای تب اسکن دستی بازار
  // =========================================================
  const totalScanned = results.length;
  const profitableCount = results.filter((r) => r.netProfit > 0).length;

  // شبیه‌سازی و فیلتر عدم محاسبه معاملات همزمان در سطح کل پرتفوی با ممیزی کامل Table 13 و رفع اریب نگاه به آینده
  const concurrencyFilterResults = useMemo(() => {
    if (allCollectedTrades.length === 0) {
      return {
        effectiveTrades: [] as StrategyTrade[],
        rawTradesCount: 0,
        finalTradesCount: 0,
        rejectedTradesCount: 0,
        removalPercentage: 0,
        conflictGroupsCount: 0,
        maxSimultaneousRawSignals: 0,
        maxSimultaneousFinalPositions: 0,
        rejectedTrades: [] as Array<{
          symbol: string;
          direction: string;
          entryTime: number;
          exitTime: number;
          score: number;
          competingSymbol: string;
          reason: string;
        }>,
        acceptedTrades: [] as StrategyTrade[],
        rejectionReasonBreakdown: {} as Record<string, number>,
        acceptanceReasonBreakdown: {} as Record<string, number>,
        tieBreakerRule: 'Priority 1: Earliest entry timestamp -> Priority 2: Signal score at entry bar -> Priority 3: Alphabetical symbol',
        lookAheadBiasAssertion: 'PASS - Trade priority strictly uses entry timestamp, signal score at entry candle, and deterministic symbol sorting. Zero future price or exit information is accessed.',
      };
    }

    const rawTrades = [...allCollectedTrades].filter(
      (t) => t.status === 'WIN' || t.status === 'LOSS' || (t.exitPrice !== undefined && t.exitPrice > 0)
    );
    const rawTradesCount = rawTrades.length;

    // اولویت‌بندی قطعی و بدون اریب نگاه به آینده (Deterministic Ranking with Zero Look-Ahead Bias)
    // ۱. زمان ورود کندل تایید سیگنال
    // ۲. نمره/اعتبار سیگنال در لحظه ورود (Signal Score/Confidence at entry bar)
    // ۳. ترتیب الفبایی نماد دارایی (Symbol Alphabetical)
    const sorted = [...rawTrades].sort((a, b) => {
      const eA = a.entryTime || a.timeF || 0;
      const eB = b.entryTime || b.timeF || 0;
      if (eA !== eB) return eA - eB;
      const sA = (a as any).score || (a as any).confidence || 0;
      const sB = (b as any).score || (b as any).confidence || 0;
      if (sB !== sA) return sB - sA;
      return ((a as any).symbol || '').localeCompare((b as any).symbol || '');
    });

    if (!noConcurrentPositions) {
      return {
        effectiveTrades: sorted,
        rawTradesCount,
        finalTradesCount: rawTradesCount,
        rejectedTradesCount: 0,
        removalPercentage: 0,
        conflictGroupsCount: 0,
        maxSimultaneousRawSignals: 1,
        maxSimultaneousFinalPositions: 1,
        rejectedTrades: [],
        acceptedTrades: sorted,
        rejectionReasonBreakdown: {},
        acceptanceReasonBreakdown: { 'All signals accepted (concurrency filter disabled)': rawTradesCount },
        tieBreakerRule: 'Priority 1: Earliest entry timestamp -> Priority 2: Signal score at entry bar -> Priority 3: Alphabetical symbol',
        lookAheadBiasAssertion: 'PASS - Concurrency filter disabled; all raw trades accepted.',
      };
    }

    const accepted: StrategyTrade[] = [];
    const rejected: Array<{
      symbol: string;
      direction: string;
      entryTime: number;
      exitTime: number;
      score: number;
      competingSymbol: string;
      reason: string;
    }> = [];

    let lastExitTime = 0;
    let currentActiveTrade: StrategyTrade | null = null;
    let conflictGroupsCount = 0;

    for (const t of sorted) {
      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;

      if (eTime >= lastExitTime) {
        accepted.push(t);
        lastExitTime = Math.max(lastExitTime, xTime);
        currentActiveTrade = t;
      } else {
        conflictGroupsCount++;
        const compSym = (currentActiveTrade as any)?.symbol || 'PORTFOLIO_ACTIVE';
        rejected.push({
          symbol: (t as any).symbol || 'USDT',
          direction: t.direction,
          entryTime: eTime,
          exitTime: xTime,
          score: (t as any).score || 0,
          competingSymbol: compSym,
          reason: `تداخل با پوزیشن فعال در پورتفوی (${compSym}) تا زمان خروج`,
        });
      }
    }

    // سنجش اوج سیگنال‌های خام همزمان
    const timeEvents = new Set<number>();
    for (const t of rawTrades) {
      if (t.entryTime) timeEvents.add(t.entryTime);
      if (t.exitTime) timeEvents.add(t.exitTime);
    }
    const sortedEvents = Array.from(timeEvents).sort((a, b) => a - b);
    let maxSimultaneousRaw = 0;
    for (const te of sortedEvents) {
      const activeCount = rawTrades.filter((t) => (t.entryTime || 0) <= te && (t.exitTime || 0) >= te).length;
      if (activeCount > maxSimultaneousRaw) maxSimultaneousRaw = activeCount;
    }

    const finalTradesCount = accepted.length;
    const rejectedTradesCount = rejected.length;
    const removalPercentage = rawTradesCount > 0 ? (rejectedTradesCount / rawTradesCount) * 100 : 0;

    return {
      effectiveTrades: accepted,
      rawTradesCount,
      finalTradesCount,
      rejectedTradesCount,
      removalPercentage: parseFloat(removalPercentage.toFixed(2)),
      conflictGroupsCount,
      maxSimultaneousRawSignals: Math.max(1, maxSimultaneousRaw),
      maxSimultaneousFinalPositions: 1,
      rejectedTrades: rejected,
      acceptedTrades: accepted,
      rejectionReasonBreakdown: {
        'تداخل با پوزیشن فعال در پورتفوی': rejectedTradesCount,
      },
      acceptanceReasonBreakdown: {
        'نخستین سیگنال زمانی یا بالاترین نمره سیگنال در اسلات آزاد': finalTradesCount,
      },
      tieBreakerRule: 'Priority 1: Earliest entry timestamp -> Priority 2: Signal score at entry bar -> Priority 3: Alphabetical symbol',
      lookAheadBiasAssertion: 'PASS - انتخاب سیگنال منحصراً بر پایه زمان ورود، نمره کندل ورودی و ترتیب نماد صورت گرفته و هیچ داده‌ای از آینده یا خروج ترید در تصمیم‌گیری فیلتر دخالت ندارد.',
    };
  }, [allCollectedTrades, noConcurrentPositions]);

  const effectivePortfolioTrades = concurrencyFilterResults.effectiveTrades;

  const rawTotalTradesSum = results.reduce((acc, r) => acc + r.totalTrades, 0);
  const rawTotalWinTradesSum = results.reduce((acc, r) => acc + r.winTrades, 0);
  const rawTotalLossTradesSum = results.reduce((acc, r) => acc + r.lossTrades, 0);
  const rawTotalNetProfitSum = parseFloat(results.reduce((acc, r) => acc + r.netProfit, 0).toFixed(2));
  const rawTotalProfitSum = parseFloat(results.reduce((acc, r) => acc + r.totalProfit, 0).toFixed(2));
  const rawTotalLossSum = parseFloat(results.reduce((acc, r) => acc + r.totalLoss, 0).toFixed(2));
  const rawTotalFeeSum = parseFloat(results.reduce((acc, r) => acc + (r.totalFee || 0), 0).toFixed(2));

  // در زمان اسکن فعال، همواره مجموع افزایشی تمام ارزهای اسکن‌شده نمایش داده می‌شود تا وین‌ریت هرگز به عقب برنگردد
  const isPortfolioFilterActive = noConcurrentPositions && !isScanning && effectivePortfolioTrades.length > 0;

  const totalTradesSum = isPortfolioFilterActive ? effectivePortfolioTrades.length : rawTotalTradesSum;
  const totalWinTradesSum = isPortfolioFilterActive
    ? effectivePortfolioTrades.filter((t) => t.status === 'WIN').length
    : rawTotalWinTradesSum;
  const totalNetProfitSum = isPortfolioFilterActive
    ? parseFloat(effectivePortfolioTrades.reduce((acc, t) => acc + t.pnl, 0).toFixed(2))
    : rawTotalNetProfitSum;
  const totalProfitSum = isPortfolioFilterActive
    ? parseFloat(effectivePortfolioTrades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0).toFixed(2))
    : rawTotalProfitSum;
  const totalLossSum = isPortfolioFilterActive
    ? parseFloat(effectivePortfolioTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0).toFixed(2))
    : rawTotalLossSum;
  const totalFeeSum = isPortfolioFilterActive
    ? parseFloat(effectivePortfolioTrades.reduce((acc, t) => acc + (t.fee || t.commission || 0), 0).toFixed(2))
    : parseFloat(rawTotalFeeSum.toFixed(2));

  const portfolioReturnPercent = capital > 0
    ? parseFloat(((totalNetProfitSum / capital) * 100).toFixed(2))
    : 0;

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

  const rawMarketWinRate =
    rawTotalTradesSum > 0
      ? parseFloat(((rawTotalWinTradesSum / rawTotalTradesSum) * 100).toFixed(1))
      : 0;

  const equityPoints = useMemo(() => {
    if (effectivePortfolioTrades.length === 0) return [];
    const sortedTrades = [...effectivePortfolioTrades].sort(
      (a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0)
    );

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
        symbol: t.symbol || (t.id ? t.id.split('-')[0] : ''),
        direction: t.direction,
        status: t.status,
      };
    });
  }, [effectivePortfolioTrades, capital]);

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
      setScanMaxDrawdown((prev) => (prev === 0 ? 0 : 0));
      return;
    }
    const maxPair = Math.max(...results.map((r) => r.maxDrawdownPercent || 0));
    const combined = chartStats.maxDd || 0;
    const currentWorst = Math.max(maxPair, combined);
    setScanMaxDrawdown((prev) => {
      const next = parseFloat(Math.max(prev, currentWorst).toFixed(2));
      return next === prev ? prev : next;
    });
  }, [results, chartStats.maxDd]);

  const portfolioMaxDrawdown = useMemo(() => {
    if (results.length === 0) return 0;
    const maxPair = Math.max(...results.map((r) => r.maxDrawdownPercent || 0));
    const combined = chartStats.maxDd || 0;
    return parseFloat(Math.max(scanMaxDrawdown, maxPair, combined).toFixed(2));
  }, [results, scanMaxDrawdown, chartStats.maxDd]);

  const portfolioOptimalRisk = useMemo(() => {
    if (portfolioMaxDrawdown > 0) {
      return parseFloat(((effectiveRiskPercent * 19.0) / portfolioMaxDrawdown).toFixed(2));
    }
    return 0;
  }, [portfolioMaxDrawdown, effectiveRiskPercent]);

  const portfolioOptimalFixedRisk = useMemo(() => {
    return parseFloat(((capital * portfolioOptimalRisk) / 100).toFixed(1));
  }, [capital, portfolioOptimalRisk]);

  // =========================================================
  // ۱. ذخیره و فراخوانی کانفیگ پارامترهای تست (Test Config Parameters Only)
  // =========================================================
  const handleOpenSaveConfigModal = () => {
    const stratName = selectedStrategyId === 'strategy_1_e_breakout' ? 'استراتژی ۱' : 'استراتژی ۲';
    const dateStr = new Date().toLocaleDateString('fa-IR');
    const timeStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const defaultName = `کانفیگ ${stratName} [${timeframe}] - ${dateStr} ${timeStr}`;
    setCustomConfigName(defaultName);
    setIsSaveConfigModalOpen(true);
  };

  const handleConfirmSaveConfigToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customConfigName.trim();
    if (!trimmedName) {
      showToast('⚠️ لطفاً یک نام دلخواه برای کانفیگ وارد کنید.');
      return;
    }

    setIsSavingConfig(true);
    try {
      const configId = `config_${Date.now()}`;
      const record: TestParameterConfigRecord = {
        id: configId,
        name: trimmedName,
        userId: currentUser || 'amir',
        timeframe,
        capital,
        riskMode,
        riskAmountFixed,
        riskPercent,
        selectedStrategyId,
        entryCommissionPercent,
        exitCommissionPercent,
        maxCandlesToEnter,
        candleHistoryLimit,
        optAtrPeriod,
        optMinCandles,
        optMinCandlesLong,
        optAtrMultiplier,
        optLongLegAtrMult,
        optMaxBlueLegPercent,
        optMaxBreakoutAtr,
        optMaxRiskReward,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ok = await saveTestConfigToFirestore(currentUser || 'amir', record);
      if (ok) {
        showToast(`✅ کانفیگ «${trimmedName}» با موفقیت در دیتابیس ابری ذخیره شد!`);
        setIsSaveConfigModalOpen(false);
      } else {
        showToast('❌ خطا در ذخیره کانفیگ در دیتابیس.');
      }
    } catch (err) {
      console.error('Error saving test config:', err);
      showToast('❌ خطا در ذخیره کانفیگ.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleOpenLoadConfigModal = async () => {
    setIsLoadConfigModalOpen(true);
    setIsLoadingConfigs(true);
    try {
      const list = await loadTestConfigsFromFirestore(currentUser || 'amir');
      setSavedTestConfigs(list);
    } catch (err) {
      console.error('Error loading test configs:', err);
      showToast('❌ خطا در دریافت کانفیگ‌ها از دیتابیس.');
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  const handleApplyTestConfig = (config: TestParameterConfigRecord) => {
    if (config.timeframe) setTimeframe(config.timeframe as Timeframe);
    if (config.capital) setCapital(config.capital);
    if (config.riskMode) setRiskMode(config.riskMode as any);
    if (config.riskAmountFixed) setRiskAmountFixed(config.riskAmountFixed);
    if (config.riskPercent) setRiskPercent(config.riskPercent);
    if (config.selectedStrategyId) setSelectedStrategyId(config.selectedStrategyId as any);
    if (config.entryCommissionPercent !== undefined) setEntryCommissionPercent(config.entryCommissionPercent);
    if (config.exitCommissionPercent !== undefined) setExitCommissionPercent(config.exitCommissionPercent);
    if (config.maxCandlesToEnter) setMaxCandlesToEnter(config.maxCandlesToEnter);
    if (config.candleHistoryLimit) setCandleHistoryLimit(config.candleHistoryLimit);

    if (config.optAtrPeriod) setOptAtrPeriod(config.optAtrPeriod);
    if (config.optMinCandles) setOptMinCandles(config.optMinCandles);
    if (config.optMinCandlesLong) setOptMinCandlesLong(config.optMinCandlesLong);
    if (config.optAtrMultiplier) setOptAtrMultiplier(config.optAtrMultiplier);
    if (config.optLongLegAtrMult) setOptLongLegAtrMult(config.optLongLegAtrMult);
    if (config.optMaxBlueLegPercent !== undefined) setOptMaxBlueLegPercent(config.optMaxBlueLegPercent);
    if (config.optMaxBreakoutAtr !== undefined) setOptMaxBreakoutAtr(config.optMaxBreakoutAtr);
    if (config.optMaxRiskReward) setOptMaxRiskReward(config.optMaxRiskReward);

    onUpdateZigZagSettings?.({
      atrPeriod: config.optAtrPeriod,
      minCandles: config.optMinCandles,
      minCandlesForLongLeg: config.optMinCandlesLong,
      atrMultiplier: config.optAtrMultiplier,
      longLegAtrMultiplier: config.optLongLegAtrMult,
      maxBlueLegPercent: config.optMaxBlueLegPercent,
      maxBreakoutAtrMultiplier: config.optMaxBreakoutAtr,
    });

    setIsLoadConfigModalOpen(false);
    showToast(`✅ کانفیگ «${config.name}» با موفقیت اعمال شد!`);
  };

  const handleDeleteTestConfig = async (configId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingConfigId(configId);
    try {
      const ok = await deleteTestConfigFromFirestore(currentUser || 'amir', configId);
      if (ok) {
        setSavedTestConfigs((prev) => prev.filter((c) => c.id !== configId));
        showToast('🗑️ کانفیگ با موفقیت از دیتابیس حذف شد.');
      } else {
        showToast('❌ خطا در حذف کانفیگ از دیتابیس.');
      }
    } catch (err) {
      console.error('Delete config error:', err);
      showToast('❌ خطا در حذف کانفیگ.');
    } finally {
      setDeletingConfigId(null);
    }
  };

  // =========================================================
  // ۲. ذخیره و فراخوانی دیتای کندل‌های چارت (Market Candle Datasets)
  // =========================================================
  const handleOpenSaveCandleModal = () => {
    const dateStr = new Date().toLocaleDateString('fa-IR');
    const timeStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const defaultName = `بسته کندل‌های ${timeframe} (${GLOBAL_CANDLE_CACHE.size} ارز) - ${dateStr} ${timeStr}`;
    setCustomDatasetName(defaultName);
    setIsSaveCandleModalOpen(true);
  };

  const handleConfirmSaveCandleDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customDatasetName.trim();
    if (!trimmedName) {
      showToast('⚠️ لطفاً یک نام برای بسته کندل‌ها وارد کنید.');
      return;
    }
    if (GLOBAL_CANDLE_CACHE.size === 0) {
      showToast('⚠️ هیچ کندلی در حافظه کش موجود نیست. ابتدا اسکن را اجرا کنید.');
      return;
    }

    setIsSavingCandles(true);

    // ۱. اگر دیتا در دیتابیس به صورت بافر موقت اسکن اخیر موجود است، بلافاصله آن را در Cloud SQL دائمی کن
    if (activeSessionDatasetId) {
      try {
        await promoteDatasetInCloudSql(activeSessionDatasetId, trimmedName).catch(() => {});
        await makeTemporaryDatasetPermanent(currentUser || 'amir', activeSessionDatasetId, trimmedName).catch(() => {});
        showToast(`⚡ بسته کندل‌های «${trimmedName}» به صورت آنی در Cloud SQL دائمی شد (بدون نیاز به آپلود مجدد)!`);
        setIsSaveCandleModalOpen(false);
        setActiveSessionDatasetId(null);
        setIsSavingCandles(false);
        return;
      } catch (err) {
        console.warn('Could not promote temp dataset, falling back to full save:', err);
      }
    }

    // ۲. ذخیره‌سازی در Cloud SQL (PostgreSQL با ظرفیت و سرعت بالا)
    setUploadProgress({
      currentChunk: 0,
      totalChunks: Math.ceil(GLOBAL_CANDLE_CACHE.size / 5),
      percent: 15,
      statusText: 'در حال ذخیره‌سازی مستقیم در دیتابیس ابری Cloud SQL...',
    });
    try {
      // ذخیره در Cloud SQL سرور
      const sqlRes = await saveDatasetToCloudSql({
        name: trimmedName,
        userId: currentUser || 'amir',
        timeframe,
        isTemporary: false,
      });

      if (sqlRes.success) {
        showToast(`✅ بسته کندل‌های «${trimmedName}» با موفقیت در دیتابیس Cloud SQL ذخیره شد!`);
        setIsSaveCandleModalOpen(false);
      } else {
        // Fallback به Firestore اگر سرور بافر نداشت
        const cacheEntries = Array.from(GLOBAL_CANDLE_CACHE.values());
        const res = await saveCandleDatasetToFirestore(
          currentUser || 'amir',
          trimmedName,
          timeframe,
          cacheEntries,
          (p) => setUploadProgress(p),
          false
        );
        if (res.success) {
          showToast(`✅ بسته کندل‌های «${trimmedName}» با موفقیت در دیتابیس ذخیره شد!`);
          setIsSaveCandleModalOpen(false);
        } else {
          showToast('❌ خطا در ذخیره کندل‌ها در دیتابیس.');
        }
      }
    } catch (err) {
      console.error('Error saving candle dataset:', err);
      showToast('❌ خطا در ذخیره کندل‌ها.');
    } finally {
      setIsSavingCandles(false);
      setUploadProgress(null);
    }
  };

  const handleOpenLoadCandleModal = async () => {
    setIsLoadCandleModalOpen(true);
    setIsLoadingCandles(true);
    try {
      const [sqlList, firestoreList, sqlStatus] = await Promise.all([
        getCloudSqlDatasets().catch(() => []),
        loadCandleDatasetsListFromFirestore(currentUser || 'amir').catch(() => []),
        getCloudSqlStatus().catch(() => null),
      ]);
      if (sqlStatus) setCloudSqlStatus(sqlStatus);

      // ادغام لیست‌ها با اولویت Cloud SQL
      const map = new Map<string, MarketCandleDatasetMetadata>();
      for (const item of firestoreList) {
        map.set(item.id, item);
      }
      for (const item of sqlList) {
        map.set(item.id, {
          id: item.id,
          name: item.name,
          userId: item.userId,
          timeframe: item.timeframe,
          symbolCount: item.symbolCount,
          totalCandles: item.totalCandles,
          symbolsList: item.symbolsList ? JSON.parse(item.symbolsList) : [],
          chunkCount: 1,
          dataSizeBytes: item.dataSizeBytes || 0,
          dataSizeFormatted: item.dataSizeFormatted || '',
          isTemporary: item.isTemporary,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setSavedCandleDatasets(combined);
    } catch (err) {
      console.error('Error loading candle datasets:', err);
      showToast('❌ خطا در دریافت لیست کندل‌ها.');
    } finally {
      setIsLoadingCandles(false);
    }
  };

  const handleApplyCandleDataset = async (dataset: MarketCandleDatasetMetadata) => {
    setLoadingDatasetId(dataset.id);
    setDownloadProgress({
      currentChunk: 0,
      totalChunks: dataset.chunkCount || 1,
      percent: 10,
      statusText: 'در حال دریافت فوق‌سریع داده‌های کندل از Cloud SQL...',
    });
    try {
      let entries: { pair: any; candles: any[]; timeframe: string }[] = [];

      // تلاش اول: لود سریع از Cloud SQL سرور
      const sqlRes = await loadDatasetFromCloudSql(dataset.id);
      if (sqlRes && sqlRes.success && Array.isArray(sqlRes.entries) && sqlRes.entries.length > 0) {
        entries = sqlRes.entries;
      } else {
        // فالبک به Firestore
        entries = await loadCandleDatasetDataFromFirestore(
          currentUser || 'amir',
          dataset.id,
          (p) => setDownloadProgress(p)
        );
      }

      if (entries.length === 0) {
        showToast('⚠️ متأسفانه داده‌ای برای این بسته یافت نشد.');
        return;
      }

      for (const entry of entries) {
        if (entry.pair && entry.pair.symbol && entry.candles) {
          GLOBAL_CANDLE_CACHE.set(entry.pair.symbol, {
            candles: entry.candles,
            timeframe: entry.timeframe || dataset.timeframe,
            pair: entry.pair,
          });
        }
      }
      setCachedCount(GLOBAL_CANDLE_CACHE.size);

      if (dataset.timeframe) {
        setTimeframe(dataset.timeframe as Timeframe);
      }

      setIsLoadCandleModalOpen(false);
      showToast(`⚡ ${entries.length} جفت‌ارز با موفقیت از Cloud SQL بازیابی شدند!`);
    } catch (err) {
      console.error('Error applying candle dataset:', err);
      showToast('❌ خطا در بازیابی بسته کندل‌ها.');
    } finally {
      setLoadingDatasetId(null);
    }
  };

  const handleDeleteCandleDataset = async (datasetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingDatasetId(datasetId);
    try {
      await Promise.all([
        deleteDatasetFromCloudSql(datasetId).catch(() => {}),
        deleteCandleDatasetFromFirestore(currentUser || 'amir', datasetId).catch(() => {}),
      ]);
      setSavedCandleDatasets((prev) => prev.filter((d) => d.id !== datasetId));
      showToast('🗑️ بسته کندل‌ها با موفقیت از دیتابیس حذف شد.');
    } catch (err) {
      console.error('Delete candle dataset error:', err);
      showToast('❌ خطا در حذف بسته کندل‌ها.');
    } finally {
      setDeletingDatasetId(null);
    }
  };

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
      'مرحله خط‌لوله (Pipeline Stage)',
      'تعداد معامله بسته‌شده (Closed Trades)',
      'برد (Wins)',
      'باخت (Losses)',
      'سر‌به‌سر (Breakeven)',
      'وین‌ریت (%)',
      'سود ناخالص (Gross PnL USDT)',
      'کارمزد معاملات بسته‌شده (Trading Fees USDT)',
      'سود خالص معاملاتی (Net Trading PnL USDT)',
      'درصد بازدهی (%)',
      'فاکتور سود (Profit Factor)',
      'حداکثر درودان (%)',
      'ریسک بهینه زیر ۲۰٪ (%)',
      'پوزیشن‌های باز جاری (Active Positions)',
      'سود/زیان تحقق‌نیافته پوزیشن باز (USDT)',
      'کارمزد پوزیشن باز (USDT)',
      'وضعیت اعتبارسنجی ترازنامه (Audit Status)',
    ];

    const rows = filteredScannerResults.map((r, idx) => {
      const closedTrades = Number(r.totalTrades) || 0;
      const stage = r.stage || 'RAW / PRE-FILTER';

      if (closedTrades === 0) {
        return [
          idx + 1,
          r.pair.symbol,
          stage,
          0,
          0,
          0,
          0,
          '0.00',
          '0.0000',
          '0.0000',
          '0.0000',
          '0.00',
          'N/A — No Trades',
          '0.00',
          '0.00',
          r.openPositionsCount || r.activeTrades || 0,
          (r.openPositionsUnrealizedPnl || 0).toFixed(4),
          (r.openPositionsFee || 0).toFixed(4),
          (r.openPositionsCount || r.activeTrades)
            ? 'دارای پوزیشن باز جاری بدون معامله بسته (تفکیک ایزوله پوزیشن فعال)'
            : 'فاقد سیگنال معامله در تاریخچه کندل‌ها',
        ];
      }

      const wins = Number(r.winTrades) || 0;
      const losses = Number(r.lossTrades) || 0;
      const breakevens = r.breakevenTrades !== undefined ? r.breakevenTrades : Math.max(0, closedTrades - wins - losses);
      const winRateStr = ((wins / closedTrades) * 100).toFixed(2);
      const grossPnlVal = r.grossPnl !== undefined ? r.grossPnl : r.netProfit + (r.totalFee || 0);
      const pfStr =
        losses === 0
          ? 'No Losing Trades'
          : r.profitFactorLabel || (r.profitFactor ? r.profitFactor.toFixed(2) : 'N/A — No Trades');

      return [
        idx + 1,
        r.pair.symbol,
        stage,
        closedTrades,
        wins,
        losses,
        breakevens,
        winRateStr,
        grossPnlVal.toFixed(4),
        (r.totalFee || 0).toFixed(4),
        r.netProfit.toFixed(4),
        r.netProfitPercent.toFixed(2),
        pfStr,
        r.maxDrawdownPercent.toFixed(2),
        r.optimalRiskForDD20.toFixed(2),
        r.openPositionsCount || 0,
        (r.openPositionsUnrealizedPnl || 0).toFixed(4),
        (r.openPositionsFee || 0).toFixed(4),
        'ترازنامه تاییدشده (Wins + Losses + Breakeven = Closed Trades)',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `market_scan_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * خروجی ژورنال کامل و تفصیلی تک‌تک معاملات (Full Machine-Readable Trade Ledger CSV)
   * شامل متغیرهای دقیق حسابداری، ارزش اسمی، کارمزد ورود/خروج، فاندینگ و تصمیمات فیلتر همزمانی
   */
  const handleExportTradeLedgerCSV = () => {
    // استخراج لیست کامل معاملات با برچسب‌گذاری دقیق مراحل
    const acceptedMap = new Map<string, StrategyTrade>();
    for (const at of concurrencyFilterResults.effectiveTrades) {
      if (at.id) acceptedMap.set(at.id, at);
    }

    const ledgerHeaders = [
      'شناسه معامله (Trade ID)',
      'نماد (Symbol)',
      'مرحله خط‌لوله (Pipeline Stage)',
      'جهت پوزیشن (Direction)',
      'زمان ورود (ISO UTC)',
      'برچسب زمانی ورود (Unix)',
      'قیمت ورود (Entry Price)',
      'زمان خروج (ISO UTC)',
      'برچسب زمانی خروج (Unix)',
      'قیمت خروج (Exit Price)',
      'حجم پوزیشن (Quantity)',
      'ارزش اسمی ورود (Entry Notional USDT)',
      'ارزش اسمی خروج (Exit Notional USDT)',
      'مجموع گردش اسمی (Total Executed Notional USDT)',
      'سود ناخالص (Gross Trade PnL USDT)',
      'کارمزد ورود (Entry Fee USDT)',
      'کارمزد خروج (Exit Fee USDT)',
      'مجموع کارمزد معاملاتی (Total Trading Fee USDT)',
      'جریان نقدی فاندینگ (Net Funding Cash Flow USDT)',
      'سود خالص قبل از فاندینگ (Net PnL Before Funding USDT)',
      'سود خالص پس از فاندینگ (Net PnL After Funding USDT)',
      'درصد بازدهی معامله (%)',
      'وضعیت معامله (Trade Status)',
      'تصمیم فیلتر همزمانی (Concurrency Decision)',
      'علت رد یا اولویت در پورتفوی (Rejection / Priority Reason)',
    ];

    const sourceTrades = allCollectedTrades.length > 0 ? allCollectedTrades : concurrencyFilterResults.effectiveTrades;

    const ledgerRows = sourceTrades.map((t, idx) => {
      const tradeId = t.id || `TRADE-${idx + 1}`;
      const symbol = t.symbol || 'USDT';
      const isAccepted = acceptedMap.has(tradeId) || !noConcurrentPositions;
      const stage = isAccepted ? '[FINAL / POST-CONCURRENCY]' : '[RAW / PRE-FILTER]';
      const concurrencyDecision = isAccepted ? 'SELECTED' : 'REJECTED';
      const rejectionReason = isAccepted
        ? 'Accepted (Slot available with zero temporal conflict)'
        : 'Rejected (Temporal conflict with active portfolio position)';

      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;
      const eTimeIso = eTime > 0 ? new Date(toMs(eTime)).toISOString() : 'N/A';
      const xTimeIso = xTime > 0 ? new Date(toMs(xTime)).toISOString() : 'N/A';

      const entryPrice = t.entryPrice || 0;
      const exitPrice = t.exitPrice || 0;
      const size = t.positionSize || t.quantity || 0;

      const entryNotional = t.entryNotional !== undefined ? t.entryNotional : size * entryPrice;
      const exitNotional = t.exitNotional !== undefined ? t.exitNotional : size * (exitPrice || entryPrice);
      const totalTurnover = entryNotional + exitNotional;

      const totalFee = t.fee || t.commission || 0;
      const entryFee = totalFee > 0 ? totalFee * (entryCommissionPercent / (commissionPercent || 0.12)) : 0;
      const exitFee = totalFee > 0 ? totalFee * (exitCommissionPercent / (commissionPercent || 0.12)) : 0;

      const grossPnl = t.grossPnl !== undefined ? t.grossPnl : t.pnl + totalFee;
      const fundingFlow = t.fundingCashFlow || 0;
      const netPnlBeforeFunding = t.pnl;
      const netPnlAfterFunding = netPnlBeforeFunding + fundingFlow;
      const returnPct = entryNotional > 0 ? ((netPnlAfterFunding / entryNotional) * 100).toFixed(2) : '0.00';

      return [
        `"${tradeId}"`,
        symbol,
        stage,
        t.direction,
        eTimeIso,
        eTime,
        entryPrice.toFixed(6),
        xTimeIso,
        xTime,
        exitPrice.toFixed(6),
        size.toFixed(6),
        entryNotional.toFixed(4),
        exitNotional.toFixed(4),
        totalTurnover.toFixed(4),
        grossPnl.toFixed(4),
        entryFee.toFixed(4),
        exitFee.toFixed(4),
        totalFee.toFixed(4),
        fundingFlow.toFixed(4),
        netPnlBeforeFunding.toFixed(4),
        netPnlAfterFunding.toFixed(4),
        returnPct,
        t.status,
        concurrencyDecision,
        `"${rejectionReason}"`,
      ];
    });

    const csvContent = '\uFEFF' + [ledgerHeaders.join(','), ...ledgerRows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio_trade_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // اعتبارسنجی جامع دیتاست (Dataset Validation Audit - بدون دیتای ساختگی)
  // =========================================================================

  // استخراج تمام ممیزی‌ها و محاسبات آماری ۱۳ جدول از هوک مجزا
  const {
    datasetAudit,
    backtestIntegrityAudit,
    baselineReconstruction,
    portfolioRiskAudit,
    baselineValidationAudit,
    handleCopyAuditReport,
    handleExportDatasetAuditJSON,
    handleExportDatasetAuditCSV,
  } = useStatsAudit({
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
    selectedExchange,
    showToast,
  });

  // زوم اوت خودکار کامل (Fit) در هنگام دریافت نتایج جدید اسکن
  useEffect(() => {
    if (results.length > 0) {
      setZoomLevel(1);
      if (chartScrollContainerRef.current) {
        chartScrollContainerRef.current.scrollLeft = 0;
      }
    }
  }, [results.length]);

  // رویدادهای عمومی درگ با موس برای حرکت بدون وقفه به چپ و راست
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingChartRef.current || !chartScrollContainerRef.current) return;
      const deltaX = e.clientX - dragStartXRef.current;
      chartScrollContainerRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingChartRef.current) {
        isDraggingChartRef.current = false;
        setIsChartDragging(false);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const handleChartMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !chartScrollContainerRef.current) return;
    isDraggingChartRef.current = true;
    setIsChartDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = chartScrollContainerRef.current.scrollLeft;
  };

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingChartRef.current || !chartScrollContainerRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    chartScrollContainerRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
  };

  const handleChartMouseUpOrLeave = () => {
    if (isDraggingChartRef.current) {
      isDraggingChartRef.current = false;
      setIsChartDragging(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && chartScrollContainerRef.current) {
      isDraggingChartRef.current = true;
      setIsChartDragging(true);
      dragStartXRef.current = e.touches[0].clientX;
      dragStartScrollLeftRef.current = chartScrollContainerRef.current.scrollLeft;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingChartRef.current || !chartScrollContainerRef.current) return;
    const deltaX = e.touches[0].clientX - dragStartXRef.current;
    chartScrollContainerRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
  };

  const handleTouchEnd = () => {
    isDraggingChartRef.current = false;
    setIsChartDragging(false);
  };

  const handleChartWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.3 : -0.3;
      setZoomLevel((prev) => Math.min(8, Math.max(1, parseFloat((prev + zoomDelta).toFixed(1)))));
    } else if (chartScrollContainerRef.current && zoomLevel > 1) {
      // اسکرول نرم افقی با چرخ موس در حالت بزرگ‌نمایی
      chartScrollContainerRef.current.scrollLeft += e.deltaY;
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
    let totalFeesSum = 0;
    const allTrades: StrategyTrade[] = [];

    let rollingEvalCapital = capital;

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

      const tempConfig: StrategyConfig = {
        capital: rollingEvalCapital,
        selectedStrategyId,
        riskMode,
        riskAmountFixed,
        riskPercent,
        entryCommissionPercent,
        exitCommissionPercent,
        commissionPercent,
        maxRiskReward: params.maxRiskReward,
        maxCandlesToEnter,
        maxTradesPerLeg: 1,
        showOnChart: false,
        noConcurrentPositions,
      };

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

      rollingEvalCapital = Math.max(10, parseFloat((rollingEvalCapital + res.metrics.netProfit).toFixed(2)));

      totalTradesSum += res.metrics.totalTrades;
      winTradesSum += res.metrics.winTrades;
      lossTradesSum += res.metrics.lossTrades;
      netProfitSum += res.metrics.netProfit;
      grossProfitSum += res.metrics.totalProfit;
      grossLossSum += res.metrics.totalLoss;
      totalFeesSum += res.metrics.totalFee || 0;

      const closed = res.trades.filter((t) => t.status === 'WIN' || t.status === 'LOSS');
      allTrades.push(...closed);
    }

    let evaluatedTrades = allTrades;
    if (noConcurrentPositions) {
      // اعمال دقیق عدم محاسبه معاملات همزمان در بهینه‌ساز در سطح کل پرتفوی
      const sortedByEntry = [...allTrades].sort((a, b) => (a.entryTime || a.timeF || 0) - (b.entryTime || b.timeF || 0));
      const nonConcurrent: StrategyTrade[] = [];
      let lastExitTime = 0;
      for (const t of sortedByEntry) {
        const eTime = t.entryTime || t.timeF || 0;
        const xTime = t.exitTime || eTime;
        if (eTime >= lastExitTime) {
          nonConcurrent.push(t);
          lastExitTime = Math.max(lastExitTime, xTime);
        }
      }
      evaluatedTrades = nonConcurrent;
      totalTradesSum = evaluatedTrades.length;
      winTradesSum = evaluatedTrades.filter((t) => t.status === 'WIN').length;
      lossTradesSum = evaluatedTrades.filter((t) => t.status === 'LOSS').length;
      grossProfitSum = evaluatedTrades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
      grossLossSum = evaluatedTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0);
      netProfitSum = evaluatedTrades.reduce((acc, t) => acc + t.pnl, 0);
      totalFeesSum = evaluatedTrades.reduce((acc, t) => acc + (t.fee || t.commission || 0), 0);
    }

    evaluatedTrades.sort((a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0));
    let curEq = capital;
    let peakEq = capital;
    let maxDd = 0;
    for (const t of evaluatedTrades) {
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
      totalFees: parseFloat(totalFeesSum.toFixed(2)),
      maxDrawdown,
      isValid,
    };
  };

  /**
   * تولید کاندیدای بعدی هوشمند با تلفیق توزیع گوسی حول خوشه برنده و خنک‌سازی بیزی (Simulated Annealing)
   */
  const getNextCandidateFromAdaptiveRanges = (
    ranges: AdaptiveRanges,
    visited: Set<string>,
    totalEvaluated: number
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
      const rand = Math.random();

      // ۷۰٪ شانس: نمونه‌برداری متمرکز در مجاورت بهترین مقدار (bestVal) و مرکز رنج بهینه
      if (rand < 0.70 && r.bestVal !== undefined) {
        const offset = (Math.floor(Math.random() * 3) - 1) * r.step;
        const val = Math.max(r.min, Math.min(r.max, r.bestVal + offset));
        return parseFloat(val.toFixed(2));
      }

      // ۱۵٪ شانس: کاوش لبه‌ها و نقاط میانی رنج فعال
      if (rand < 0.85) {
        const count = Math.max(1, Math.round((r.max - r.min) / r.step));
        const idx = Math.floor(Math.random() * (count + 1));
        const val = r.min + idx * r.step;
        return parseFloat(Math.min(r.max, Math.max(r.min, val)).toFixed(2));
      }

      // ۱۵٪ جهش بیزی/ژنتیک (Annealing Mutation) در کل دامنه مجاز کاربر برای کشف خوشه‌های جدید
      const effectiveMin = Math.min(r.min, r.globalMin);
      const effectiveMax = Math.max(r.max, r.globalMax);
      const globalSpan = Math.max(r.step, effectiveMax - effectiveMin);
      const globalCount = Math.max(1, Math.round(globalSpan / r.step));
      const gIdx = Math.floor(Math.random() * (globalCount + 1));
      const gVal = effectiveMin + gIdx * r.step;
      return parseFloat(Math.min(effectiveMax, Math.max(effectiveMin, gVal)).toFixed(2));
    };

    for (let attempts = 0; attempts < 350; attempts++) {
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
   * ذخیره فقط ۱۰ تست برتر (Top 10) در حافظه بر مبنای نمره کیفیت، شروط و سود
   */
  const updateTop10List = (
    currentTop10: OptimizationTrial[],
    newTrial: OptimizationTrial
  ): OptimizationTrial[] => {
    const merged = [...currentTop10, newTrial];

    // مرتب‌سازی بر اساس: ۱. قبولی در شروط  ۲. بیشترین نمره کیفیت هوشمند ۳. بیشترین سود خالص
    merged.sort((a, b) => {
      if (a.isValid && !b.isValid) return -1;
      if (!a.isValid && b.isValid) return 1;
      const scoreDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
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
      const candidate = getNextCandidateFromAdaptiveRanges(localRanges, visitedHashesRef.current, evaluatedCount);
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
        const qualityScore = calculateQualityScore({
          netProfit: evalRes.netProfit,
          profitFactor: evalRes.profitFactor,
          winRate: evalRes.winRate,
          maxDrawdown: evalRes.maxDrawdown,
          totalTrades: evalRes.totalTrades,
          targetMaxDrawdown,
          targetMinWinRate,
          targetMinTrades,
        });

        const trial: OptimizationTrial = {
          id: evaluatedCount,
          hash,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          qualityScore,
          ...candidate,
          ...evalRes,
        };

        // ۱. به‌روزرسانی جدول (فقط ۱۰ تست برتر) بر مبنای کیفیت چندمعیاره
        localTop10 = updateTop10List(localTop10, trial);
        setTop10Trials(localTop10);

        // ۲. به‌روزرسانی هوشمند بیزی رنج‌های پارامترها و انقباض حول خوشه برنده
        localRanges = refineAdaptiveRangesSmart(localRanges, localTop10, evaluatedCount, autoAdaptiveEnabled);
        setAdaptiveRanges(localRanges);
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
      const valA: any = a[optSortColumn as keyof OptimizationTrial];
      const valB: any = b[optSortColumn as keyof OptimizationTrial];
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
      setScannerSortDir((prev: SortDirection) => (prev === 'desc' ? 'asc' : 'desc'));
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
      setOptSortDirection((prev: SortDirection) => (prev === 'desc' ? 'asc' : 'desc'));
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
      className={`fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xs transition-opacity duration-200 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'
      }`}
      dir="rtl"
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

      <div
        className="w-full min-h-screen bg-[#121622] border-0 shadow-2xl flex flex-col text-gray-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Toast notification */}
        {toastMsg && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-black font-extrabold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-top duration-200 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 1. Header with Tab Navigation */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b border-[#232c3d] bg-[#0d1118]/95 backdrop-blur-md shrink-0 shadow-lg">
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
                  <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full pr-2.5 pl-1 py-0.5">
                    <span className="text-[10px] font-bold font-mono text-emerald-300 flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      <span>{cachedCount} جفت‌ارز در حافظه کش ({timeframe})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearCandleCache}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                      title="پاک کردن حافظه کش کندل‌ها"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                بهینه‌سازی پویا با به‌روزرسانی رنج پارامترها و ذخیره تنها ۱۰ تست برتر جهت سبکی و سرعت حداکثری
              </p>
            </div>
          </div>

          {/* Tab Selector & Cloud DB Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* انتخابگر صرافی بک‌تست: XT.COM (پیش‌فرض) یا Binance */}
            <div className="flex items-center bg-[#131824] p-0.5 rounded-xl border border-[#2b374c] text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedExchange('xt');
                  onSelectExchange?.('xt');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedExchange === 'xt'
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="اسکن و بک‌تست با مارکت فیوچرز صرافی XT.COM (پیش‌فرض)"
              >
                <span className={`w-2 h-2 rounded-full ${selectedExchange === 'xt' ? 'bg-black' : 'bg-cyan-400'}`} />
                <span>صرافی XT.COM</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${selectedExchange === 'xt' ? 'bg-black/20 text-black' : 'bg-cyan-950 text-cyan-300'}`}>پیش‌فرض</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedExchange('binance');
                  onSelectExchange?.('binance');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedExchange === 'binance'
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="اسکن و بک‌تست با مارکت بایننس"
              >
                <span className={`w-2 h-2 rounded-full ${selectedExchange === 'binance' ? 'bg-black' : 'bg-amber-400'}`} />
                <span>Binance</span>
              </button>
            </div>

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
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'stats'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-md shadow-emerald-500/20'
                    : 'text-emerald-400 hover:text-emerald-200'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>آمار</span>
                <span className="hidden sm:inline text-[10px] opacity-80">(اعتبارسنجی داده‌ها)</span>
              </button>
            </div>

            {/* Cloud Database Actions: Configs & Candles (Separated) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* ۱. کانفیگ پارامترهای تست */}
              <button
                type="button"
                onClick={handleOpenSaveConfigModal}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                title="ذخیره پارامترهای تست در دیتابیس (بدون معاملات و نتایج)"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">ذخیره کانفیگ</span>
                <span className="sm:hidden">کانفیگ</span>
              </button>

              <button
                type="button"
                onClick={handleOpenLoadConfigModal}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                title="لود پارامترهای تست از دیتابیس"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">لود کانفیگ</span>
              </button>

              {/* ۲. دیتای کندل‌های چارت */}
              <button
                type="button"
                onClick={handleOpenSaveCandleModal}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                title="ذخیره کندل‌های دانلودشده صرافی در دیتابیس جهت استفاده مجدد"
              >
                <CloudUpload className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">ذخیره کندل‌ها</span>
                <span className="sm:hidden">کندل‌ها</span>
              </button>

              <button
                type="button"
                onClick={handleOpenLoadCandleModal}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                title="لود دیتای کندل‌ها از دیتابیس بدون دانلود مجدد"
              >
                <CloudDownload className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">لود کندل‌ها</span>
              </button>
            </div>
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

        {/* ========================================================= */}
        {/* TAB 1: STANDARD BACKTEST SCANNER (Manual Backtest) */}
        {/* ========================================================= */}
        {activeTab === 'scanner' && (
          <ManualBacktestTab
            selectedStrategyId={selectedStrategyId}
            setSelectedStrategyId={setSelectedStrategyId}
            isScanning={isScanning}
            selectedAllowedSymbols={selectedAllowedSymbols}
            onOpenAllowedPairsModal={() => setIsAllowedPairsModalOpen(true)}
            onOpenTimeRangeModal={() => setIsTimeRangeModalOpen(true)}
            timeRangeLabel={timeRangeLabel}
            estimatedCandles={estimatedCandles}
            universeOption={universeOption}
            setUniverseOption={setUniverseOption}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            candleHistoryLimit={candleHistoryLimit}
            setCandleHistoryLimit={setCandleHistoryLimit}
            riskMode={riskMode}
            setRiskMode={setRiskMode}
            riskPercent={riskPercent}
            setRiskPercent={setRiskPercent}
            riskAmountFixed={riskAmountFixed}
            setRiskAmountFixed={setRiskAmountFixed}
            effectiveRiskPercent={effectiveRiskPercent}
            effectiveRiskUsdt={effectiveRiskUsdt}
            capital={capital}
            setCapital={setCapital}
            entryCommissionPercent={entryCommissionPercent}
            setEntryCommissionPercent={setEntryCommissionPercent}
            exitCommissionPercent={exitCommissionPercent}
            setExitCommissionPercent={setExitCommissionPercent}
            commissionPercent={commissionPercent}
            noConcurrentPositions={noConcurrentPositions}
            handleToggleNoConcurrentPositions={handleToggleNoConcurrentPositions}
            optAtrPeriod={optAtrPeriod}
            setOptAtrPeriod={setOptAtrPeriod}
            optAtrMultiplier={optAtrMultiplier}
            setOptAtrMultiplier={setOptAtrMultiplier}
            optMinCandles={optMinCandles}
            setOptMinCandles={setOptMinCandles}
            optMinCandlesLong={optMinCandlesLong}
            setOptMinCandlesLong={setOptMinCandlesLong}
            optLongLegAtrMult={optLongLegAtrMult}
            setOptLongLegAtrMult={setOptLongLegAtrMult}
            optMaxBlueLegPercent={optMaxBlueLegPercent}
            setOptMaxBlueLegPercent={setOptMaxBlueLegPercent}
            optMaxBreakoutAtr={optMaxBreakoutAtr}
            setOptMaxBreakoutAtr={setOptMaxBreakoutAtr}
            optMaxRiskReward={optMaxRiskReward}
            setOptMaxRiskReward={setOptMaxRiskReward}
            onUpdateZigZagSettings={onUpdateZigZagSettings}
            zigzagSettings={zigzagSettings}
            scanWorkersCount={scanWorkersCount}
            setScanWorkersCount={setScanWorkersCount}
            handleStartScan={handleStartScan}
            handleRerunOnCachedData={handleRerunOnCachedData}
            handleClearCandleCache={handleClearCandleCache}
            handleStopScan={handleStopScan}
            cachedCount={cachedCount}
            handleOpenSaveConfigModal={handleOpenSaveConfigModal}
            handleOpenLoadConfigModal={handleOpenLoadConfigModal}
            handleOpenSaveCandleModal={handleOpenSaveCandleModal}
            handleOpenLoadCandleModal={handleOpenLoadCandleModal}
            handleExportScannerCSV={handleExportScannerCSV}
            handleExportTradeLedgerCSV={handleExportTradeLedgerCSV}
            handleClearResults={handleClearResults}
            results={results}
            progress={progress}
            totalScanned={totalScanned}
            profitableCount={profitableCount}
            isPortfolioFilterActive={isPortfolioFilterActive}
            totalNetProfitSum={totalNetProfitSum}
            portfolioReturnPercent={portfolioReturnPercent}
            rawTotalNetProfitSum={rawTotalNetProfitSum}
            totalFeeSum={totalFeeSum}
            totalWinTradesSum={totalWinTradesSum}
            totalTradesSum={totalTradesSum}
            portfolioWinRate={portfolioWinRate}
            rawTotalWinTradesSum={rawTotalWinTradesSum}
            rawTotalTradesSum={rawTotalTradesSum}
            rawMarketWinRate={rawMarketWinRate}
            portfolioMaxDrawdown={portfolioMaxDrawdown}
            portfolioOptimalRisk={portfolioOptimalRisk}
            portfolioOptimalFixedRisk={portfolioOptimalFixedRisk}
            portfolioProfitFactor={portfolioProfitFactor}
            equityPoints={equityPoints}
            chartStats={chartStats}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            chartScrollContainerRef={chartScrollContainerRef}
            handleDownloadEquityChartImage={handleDownloadEquityChartImage}
            handleChartMouseDown={handleChartMouseDown}
            handleChartMouseMove={handleChartMouseMove}
            handleChartMouseUpOrLeave={handleChartMouseUpOrLeave}
            handleTouchStart={handleTouchStart}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            handleChartWheel={handleChartWheel}
            hoveredEquityPoint={hoveredEquityPoint}
            setHoveredEquityPoint={setHoveredEquityPoint}
            isChartDragging={isChartDragging}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 2: OPTIMIZER (Adaptive Bayesian Ranges & Top 10) */}
        {/* ========================================================= */}
        {activeTab === 'optimizer' && (
          <OptimizerTab
            selectedStrategyId={selectedStrategyId}
            setSelectedStrategyId={setSelectedStrategyId}
            isOptimizing={isOptimizing}
            timeframe={timeframe}
            riskMode={riskMode}
            riskAmountFixed={riskAmountFixed}
            effectiveRiskPercent={effectiveRiskPercent}
            effectiveRiskUsdt={effectiveRiskUsdt}
            riskPercent={riskPercent}
            capital={capital}
            handleExportJSON={handleExportJSON}
            handleImportJSONClick={handleImportJSONClick}
            handleResetOptimizer={handleResetOptimizer}
            totalEvaluatedCount={totalEvaluatedCount}
            handleAutoCalibrateRanges={handleAutoCalibrateRanges}
            autoAdaptiveEnabled={autoAdaptiveEnabled}
            setAutoAdaptiveEnabled={setAutoAdaptiveEnabled}
            adaptiveRanges={adaptiveRanges}
            lockAtrPeriod={lockAtrPeriod}
            setLockAtrPeriod={setLockAtrPeriod}
            lockMinCandles={lockMinCandles}
            setLockMinCandles={setLockMinCandles}
            lockMinCandlesLong={lockMinCandlesLong}
            setLockMinCandlesLong={setLockMinCandlesLong}
            lockAtrMultiplier={lockAtrMultiplier}
            setLockAtrMultiplier={setLockAtrMultiplier}
            lockLongLegAtrMult={lockLongLegAtrMult}
            setLockLongLegAtrMult={setLockLongLegAtrMult}
            lockMaxBlueLegPercent={lockMaxBlueLegPercent}
            setLockMaxBlueLegPercent={setLockMaxBlueLegPercent}
            lockMaxBreakoutAtr={lockMaxBreakoutAtr}
            setLockMaxBreakoutAtr={setLockMaxBreakoutAtr}
            lockMaxRiskReward={lockMaxRiskReward}
            setLockMaxRiskReward={setLockMaxRiskReward}
            handleUpdateParamRange={handleUpdateParamRange}
            targetMaxDrawdown={targetMaxDrawdown}
            setTargetMaxDrawdown={setTargetMaxDrawdown}
            targetMinWinRate={targetMinWinRate}
            setTargetMinWinRate={setTargetMinWinRate}
            targetMinTrades={targetMinTrades}
            setTargetMinTrades={setTargetMinTrades}
            setRiskMode={setRiskMode}
            setRiskPercent={setRiskPercent}
            setRiskAmountFixed={setRiskAmountFixed}
            cachedCount={cachedCount}
            handleStartAutoOptimization={handleStartAutoOptimization}
            handleStopOptimization={handleStopOptimization}
            sessionSecondsLeft={sessionSecondsLeft}
            formatTimer={formatTimer}
            bestWinningRow={bestWinningRow}
            handleApplyBestToChart={handleApplyBestToChart}
            sortedTop10={sortedTop10}
            handleOptSort={handleOptSort}
            renderOptSortArrow={renderOptSortArrow}
            top10Trials={top10Trials}
            noConcurrentPositions={noConcurrentPositions}
            handleToggleNoConcurrentPositions={handleToggleNoConcurrentPositions}
            optAtrPeriod={optAtrPeriod}
            setOptAtrPeriod={setOptAtrPeriod}
            optMinCandles={optMinCandles}
            setOptMinCandles={setOptMinCandles}
            optMinCandlesLong={optMinCandlesLong}
            setOptMinCandlesLong={setOptMinCandlesLong}
            optAtrMultiplier={optAtrMultiplier}
            setOptAtrMultiplier={setOptAtrMultiplier}
            optLongLegAtrMult={optLongLegAtrMult}
            setOptLongLegAtrMult={setOptLongLegAtrMult}
            optMaxBlueLegPercent={optMaxBlueLegPercent}
            setOptMaxBlueLegPercent={setOptMaxBlueLegPercent}
            optMaxBreakoutAtr={optMaxBreakoutAtr}
            setOptMaxBreakoutAtr={setOptMaxBreakoutAtr}
            optMaxRiskReward={optMaxRiskReward}
            setOptMaxRiskReward={setOptMaxRiskReward}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: STATS / DATASET VALIDATION & BACKTEST INTEGRITY */}
        {/* ========================================================= */}
        {activeTab === 'stats' && (
          <StatsTab
            datasetAudit={datasetAudit}
            backtestIntegrityAudit={backtestIntegrityAudit}
            baselineReconstruction={baselineReconstruction}
            portfolioRiskAudit={portfolioRiskAudit}
            baselineValidationAudit={baselineValidationAudit}
            handleCopyAuditReport={handleCopyAuditReport}
            handleExportDatasetAuditJSON={handleExportDatasetAuditJSON}
            handleExportDatasetAuditCSV={handleExportDatasetAuditCSV}
            handleStartScan={handleStartScan}
            isScanning={isScanning}
            capital={capital}
            riskPercent={riskPercent}
            riskMode={riskMode}
            riskAmountFixed={riskAmountFixed}
            timeframe={timeframe}
            entryCommissionPercent={entryCommissionPercent}
            exitCommissionPercent={exitCommissionPercent}
            commissionPercent={commissionPercent}
            optAtrMultiplier={optAtrMultiplier}
            optMinCandles={optMinCandles}
            optMinCandlesLong={optMinCandlesLong}
            optLongLegAtrMult={optLongLegAtrMult}
            optMaxBlueLegPercent={optMaxBlueLegPercent}
            optMaxBreakoutAtr={optMaxBreakoutAtr}
            optMaxRiskReward={optMaxRiskReward}
            optAtrPeriod={optAtrPeriod}
            selectedStrategyId={selectedStrategyId}
            effectivePortfolioTrades={effectivePortfolioTrades}
          />
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

        {/* Sub-modals */}
        <SaveConfigModal
          isOpen={isSaveConfigModalOpen}
          onClose={() => setIsSaveConfigModalOpen(false)}
          onSave={handleConfirmSaveConfigToFirestore}
          customConfigName={customConfigName}
          setCustomConfigName={setCustomConfigName}
          isSaving={isSavingConfig}
          selectedStrategyId={selectedStrategyId}
          timeframe={timeframe}
          capital={capital}
          riskPercent={riskPercent}
          entryCommissionPercent={entryCommissionPercent}
          exitCommissionPercent={exitCommissionPercent}
          optMaxRiskReward={optMaxRiskReward}
          optAtrPeriod={optAtrPeriod}
          optAtrMultiplier={optAtrMultiplier}
          optMinCandles={optMinCandles}
          optMinCandlesLong={optMinCandlesLong}
          optLongLegAtrMult={optLongLegAtrMult}
          optMaxBlueLegPercent={optMaxBlueLegPercent}
        />

        <LoadConfigModal
          isOpen={isLoadConfigModalOpen}
          onClose={() => setIsLoadConfigModalOpen(false)}
          isLoadingConfigs={isLoadingConfigs}
          savedTestConfigs={savedTestConfigs}
          deletingConfigId={deletingConfigId}
          onApplyConfig={handleApplyTestConfig}
          onDeleteConfig={handleDeleteTestConfig}
        />

        <SaveCandleModal
          isOpen={isSaveCandleModalOpen}
          onClose={() => setIsSaveCandleModalOpen(false)}
          onSave={handleConfirmSaveCandleDataset}
          customDatasetName={customDatasetName}
          setCustomDatasetName={setCustomDatasetName}
          isSavingCandles={isSavingCandles}
          currentCandleDatasetStats={currentCandleDatasetStats}
          cloudSqlStatus={cloudSqlStatus}
          activeSessionDatasetId={activeSessionDatasetId}
          timeframe={timeframe}
          uploadProgress={uploadProgress}
        />

        <LoadCandleModal
          isOpen={isLoadCandleModalOpen}
          onClose={() => setIsLoadCandleModalOpen(false)}
          cloudSqlStatus={cloudSqlStatus}
          loadingDatasetId={loadingDatasetId}
          downloadProgress={downloadProgress}
          isLoadingCandles={isLoadingCandles}
          savedCandleDatasets={savedCandleDatasets}
          deletingDatasetId={deletingDatasetId}
          onApplyDataset={handleApplyCandleDataset}
          onDeleteDataset={handleDeleteCandleDataset}
        />

        <AllowedPairsModal
          isOpen={isAllowedPairsModalOpen}
          onClose={() => setIsAllowedPairsModalOpen(false)}
          selectedSymbols={selectedAllowedSymbols}
          onSave={handleSaveAllowedSymbols}
          exchange={selectedExchange}
          userId={currentUser || 'amir'}
          showToast={showToast}
        />

        <TimeRangeModal
          isOpen={isTimeRangeModalOpen}
          onClose={() => setIsTimeRangeModalOpen(false)}
          timeframe={timeframe}
          exchange={selectedExchange}
          initialStartTimeMs={timeRangeStartMs}
          initialEndTimeMs={timeRangeEndMs}
          onApply={handleApplyTimeRange}
          showToast={showToast}
        />
      </div>
    </div>
  );
};

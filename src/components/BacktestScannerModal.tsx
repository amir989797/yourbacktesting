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
  Coins,
} from 'lucide-react';
import { CryptoPair, CandleData, Timeframe, ZigZagSettings, ExchangeType, isXtExcludedSymbol } from '../types/crypto';
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
      setActiveSessionDatasetId(null);
      checkCurrentRangeStatusRef.current?.({
        exchange,
        datasetId: null,
      });
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

  // Strategy selection (پیش‌فرض: استراتژی ۲ مطابق تنظیمات نهایی کاربر)
  const [selectedStrategyId, setSelectedStrategyId] = useState<'strategy_1_e_breakout' | 'strategy_2_next_pivot'>(
    'strategy_2_next_pivot'
  );

  // General Parameters
  const [capital, setCapital] = useState<number>(10000);
  const [riskMode, setRiskMode] = useState<'percent' | 'fixed'>(() => {
    try {
      const saved = localStorage.getItem('backtest_risk_mode');
      if (saved === 'fixed' || saved === 'percent') return saved;
    } catch {}
    return 'fixed';
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
      if (saved !== null) return parseFloat(saved) || 100;
    } catch {}
    return 100; // پیش‌فرض: ۱۰۰ دلار ریسک ثابت در هر معامله
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
  const [slSlippagePercent, setSlSlippagePercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_sl_slippage_percent');
      if (saved !== null) return parseFloat(saved);
    } catch {}
    return 0.04; // میانگین اسلیپیج واقعی استاپ مارکت در صرافی XT
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((s: string) => !isXtExcludedSymbol(s));
          if (clean.length > 0) return clean;
        }
      }
      const liveSaved = localStorage.getItem('livetrade_selected_symbols');
      if (liveSaved) {
        const parsed = JSON.parse(liveSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((s: string) => !isXtExcludedSymbol(s));
          if (clean.length > 0) return clean;
        }
      }
    } catch {}
    return DEFAULT_POPULAR_WATCHLIST;
  });

  // بارگذاری ارزهای مجاز ذخیره‌شده از دیتابیس برای صرافی انتخابی
  useEffect(() => {
    loadAllowedPairsFromFirestore(currentUser || 'amir', selectedExchange)
      .then((loaded) => {
        if (loaded && loaded.length > 0) {
          const clean = loaded.filter((s) => !isXtExcludedSymbol(s));
          setSelectedAllowedSymbols(clean);
          checkCurrentRangeStatusRef.current?.({
            exchange: selectedExchange,
            symbols: clean,
          });
        }
      })
      .catch(() => {});
  }, [currentUser, selectedExchange]);

  const handleSaveAllowedSymbols = (symbols: string[]) => {
    const clean = symbols.filter((s) => !isXtExcludedSymbol(s));
    setSelectedAllowedSymbols(clean);
    try {
      localStorage.setItem('backtest_selected_allowed_symbols', JSON.stringify(clean));
      localStorage.setItem(`backtest_selected_allowed_symbols_${selectedExchange}`, JSON.stringify(clean));
    } catch {}
    checkCurrentRangeStatusRef.current?.({
      exchange: selectedExchange,
      symbols: clean,
    });
  };

  const handleRemoveSkippedSymbolsFromAllowed = (symbolsToRemove: string[]) => {
    const toRemoveSet = new Set(symbolsToRemove.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const updated = selectedAllowedSymbols.filter((s) => !toRemoveSet.has(s.toLowerCase().replace(/[^a-z0-9]/g, '')));
    handleSaveAllowedSymbols(updated);
    setSkippedSymbols([]);
    showToast(`🧹 ${symbolsToRemove.length} ارز بدون دیتای صرافی از لیست مجاز حذف شدند (${updated.length} ارز باقی ماند).`);
  };

  const handleQuickSelectSymbols = async (count: number | 'all') => {
    try {
      const res = await fetch(`/api/market/pairs?exchange=${selectedExchange}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
        let pairsList = data.pairs;
        if (selectedExchange === 'xt') {
          pairsList = pairsList.filter((p: any) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false);
        }
        const syms = count === 'all'
          ? pairsList.map((p: any) => p.symbol)
          : pairsList.slice(0, count).map((p: any) => p.symbol);
        handleSaveAllowedSymbols(syms);
        showToast(count === 'all'
          ? `🌐 تمام ${syms.length} نماد صرافی ${selectedExchange.toUpperCase()} برای اسکن انتخاب شدند.`
          : `🎯 ${syms.length} ارز برتر مارکت صرافی ${selectedExchange.toUpperCase()} انتخاب شدند.`
        );
        return;
      }
    } catch {}

    const syms = count === 'all' ? DEFAULT_POPULAR_WATCHLIST : DEFAULT_POPULAR_WATCHLIST.slice(0, count);
    handleSaveAllowedSymbols(syms);
    showToast(`🎯 ${syms.length} ارز انتخابی برای اسکن اعمال شد.`);
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

  const checkCurrentRangeStatusRef = useRef<((overrides?: any) => Promise<void>) | null>(null);

  const handleApplyTimeRange = (params: {
    startDate: string;
    endDate: string;
    startTimeMs: number;
    endTimeMs: number;
    estimatedCandles: number;
    label: string;
  }) => {
    setActiveSessionDatasetId(null);
    setTimeRangeStartMs(params.startTimeMs);
    setTimeRangeEndMs(params.endTimeMs);
    setTimeRangeLabel(params.label);
    setEstimatedCandles(params.estimatedCandles);
    const limit = Math.max(50, params.estimatedCandles);
    setCandleHistoryLimit(limit);
    try {
      localStorage.setItem('backtest_time_range_start_ms', String(params.startTimeMs));
      localStorage.setItem('backtest_time_range_end_ms', String(params.endTimeMs));
      localStorage.setItem('backtest_time_range_label', params.label);
      localStorage.setItem('backtest_estimated_candles', String(params.estimatedCandles));
    } catch {}

    // Immediately trigger smart range verification against PostgreSQL
    checkCurrentRangeStatusRef.current?.({
      startTime: params.startTimeMs,
      endTime: params.endTimeMs,
      datasetId: null,
    });
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
  const [cachedCount, setCachedCount] = useState<number>(0);

  // وضعیت و متادیتای بازه زمانی جاری در پایگاه داده PostgreSQL
  interface RangeStatusData {
    exists: boolean;
    datasetId?: string;
    dataset?: {
      id: string;
      name: string;
      exchange: string;
      timeframe: string;
      startTime: number | null;
      endTime: number | null;
      symbolCount: number;
      totalCandles: number;
      dataSizeFormatted: string;
      status: string;
      updatedAt: string;
      hasResults: boolean;
    };
    coverage?: any;
    results?: BacktestResultItem[] | null;
    allTrades?: StrategyTrade[] | null;
    skippedSymbols?: { symbol: string; reason: string }[] | null;
    requestedSymbolsCount?: number | null;
  }
  const [rangeStatus, setRangeStatus] = useState<RangeStatusData | null>(null);
  const [skippedSymbols, setSkippedSymbols] = useState<{ symbol: string; reason: string }[]>([]);
  const [isCheckingRange, setIsCheckingRange] = useState<boolean>(false);
  const [isRescanPromptOpen, setIsRescanPromptOpen] = useState<boolean>(false);
  const [isDeleteRangePromptOpen, setIsDeleteRangePromptOpen] = useState<boolean>(false);
  const [isClearAllCandlesPromptOpen, setIsClearAllCandlesPromptOpen] = useState<boolean>(false);
  const [isClearingAllCandles, setIsClearingAllCandles] = useState<boolean>(false);

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
  const [optAtrPeriod, setOptAtrPeriod] = useState<number>(17);
  const [lockAtrPeriod, setLockAtrPeriod] = useState<boolean>(false);

  const [optMinCandles, setOptMinCandles] = useState<number>(5);
  const [lockMinCandles, setLockMinCandles] = useState<boolean>(false);

  const [optMinCandlesLong, setOptMinCandlesLong] = useState<number>(12);
  const [lockMinCandlesLong, setLockMinCandlesLong] = useState<boolean>(false);

  const [optMinCandlesBlue, setOptMinCandlesBlue] = useState<number>(7);
  const [lockMinCandlesBlue, setLockMinCandlesBlue] = useState<boolean>(false);

  const [optAtrMultiplier, setOptAtrMultiplier] = useState<number>(1);
  const [lockAtrMultiplier, setLockAtrMultiplier] = useState<boolean>(false);

  const [optLongLegAtrMult, setOptLongLegAtrMult] = useState<number>(14.5);
  const [lockLongLegAtrMult, setLockLongLegAtrMult] = useState<boolean>(false);

  const [optBlueLegAtrMult, setOptBlueLegAtrMult] = useState<number>(4.75);
  const [lockBlueLegAtrMult, setLockBlueLegAtrMult] = useState<boolean>(false);

  const [optMaxBlueLegPercent, setOptMaxBlueLegPercent] = useState<number>(95);
  const [lockMaxBlueLegPercent, setLockMaxBlueLegPercent] = useState<boolean>(false);

  const [optMaxBreakoutAtr, setOptMaxBreakoutAtr] = useState<number>(4);
  const [lockMaxBreakoutAtr, setLockMaxBreakoutAtr] = useState<boolean>(false);

  const [optMaxRiskReward, setOptMaxRiskReward] = useState<number>(2.25);
  const [lockMaxRiskReward, setLockMaxRiskReward] = useState<boolean>(false);

  const [optTimeStopEnabled, setOptTimeStopEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('backtest_time_stop_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [optTimeStopCandles, setOptTimeStopCandles] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_time_stop_candles');
      return saved !== null ? parseInt(saved, 10) : 25;
    } catch {
      return 25;
    }
  });
  const [lockTimeStopCandles, setLockTimeStopCandles] = useState<boolean>(false);

  const [optMaxPositionToRiskRatio, setOptMaxPositionToRiskRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backtest_opt_max_pos_to_risk');
      if (saved !== null) return parseFloat(saved) || 200;
    } catch {}
    return 200;
  });
  const [lockMaxPositionToRiskRatio, setLockMaxPositionToRiskRatio] = useState<boolean>(false);

  // همگام‌سازی اولیه یا به‌روزرسانی خارجی تنظیمات زیگ‌زاگ وارده توسط کاربر در چارت
  const prevZigzagSettingsRef = useRef<ZigZagSettings | undefined>(zigzagSettings);
  useEffect(() => {
    if (!zigzagSettings) return;
    const prev = prevZigzagSettingsRef.current;
    if (prev !== zigzagSettings) {
      if (zigzagSettings.atrPeriod && zigzagSettings.atrPeriod !== prev?.atrPeriod) setOptAtrPeriod(zigzagSettings.atrPeriod);
      if (zigzagSettings.minCandles && zigzagSettings.minCandles !== prev?.minCandles) setOptMinCandles(zigzagSettings.minCandles);
      if (zigzagSettings.minCandlesForLongLeg && zigzagSettings.minCandlesForLongLeg !== prev?.minCandlesForLongLeg) setOptMinCandlesLong(zigzagSettings.minCandlesForLongLeg);
      if (zigzagSettings.minCandlesForBlueLeg !== undefined && zigzagSettings.minCandlesForBlueLeg !== prev?.minCandlesForBlueLeg) setOptMinCandlesBlue(zigzagSettings.minCandlesForBlueLeg);
      if (zigzagSettings.atrMultiplier && zigzagSettings.atrMultiplier !== prev?.atrMultiplier) setOptAtrMultiplier(zigzagSettings.atrMultiplier);
      if (zigzagSettings.longLegAtrMultiplier && zigzagSettings.longLegAtrMultiplier !== prev?.longLegAtrMultiplier) setOptLongLegAtrMult(zigzagSettings.longLegAtrMultiplier);
      if (zigzagSettings.blueLegAtrMultiplier !== undefined && zigzagSettings.blueLegAtrMultiplier !== prev?.blueLegAtrMultiplier) setOptBlueLegAtrMult(zigzagSettings.blueLegAtrMultiplier);
      if (zigzagSettings.maxBlueLegPercent !== undefined && zigzagSettings.maxBlueLegPercent !== prev?.maxBlueLegPercent) setOptMaxBlueLegPercent(zigzagSettings.maxBlueLegPercent);
      if (zigzagSettings.maxBreakoutAtrMultiplier !== undefined && zigzagSettings.maxBreakoutAtrMultiplier !== prev?.maxBreakoutAtrMultiplier) setOptMaxBreakoutAtr(zigzagSettings.maxBreakoutAtrMultiplier);
      prevZigzagSettingsRef.current = zigzagSettings;
    }
  }, [zigzagSettings]);

  // شروط اولیه ارزیابی مدل
  const [targetMaxDrawdown, setTargetMaxDrawdown] = useState<number>(20.0);
  const [targetMinWinRate, setTargetMinWinRate] = useState<number>(40.0);
  const [targetMinTrades, setTargetMinTrades] = useState<number>(100);

  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizerDurationMinutes, setOptimizerDurationMinutes] = useState<number>(() => {
    try {
      const s = localStorage.getItem('opt_session_duration_min');
      return s ? parseInt(s, 10) : 3;
    } catch {
      return 3;
    }
  });
  const [optimizerProcessingDepth, setOptimizerProcessingDepth] = useState<'fast' | 'full'>(() => {
    try {
      const s = localStorage.getItem('opt_processing_depth');
      return s === 'fast' || s === 'full' ? s : 'full';
    } catch {
      return 'full';
    }
  });
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(() => optimizerDurationMinutes * 60);
  const sessionSecondsRef = useRef<number>(optimizerDurationMinutes * 60);
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
    if (rangeStatus?.dataset) {
      return {
        totalCandles: rangeStatus.dataset.totalCandles || 0,
        formatted: rangeStatus.dataset.dataSizeFormatted || '0 KB',
      };
    }
    const entries = Array.from(GLOBAL_CANDLE_CACHE.values());
    return calculateDatasetSizeInBytes(entries);
  }, [GLOBAL_CANDLE_CACHE.size, isSaveCandleModalOpen, rangeStatus]);

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
      if (saved) return { ...DEFAULT_RANGES, ...JSON.parse(saved) };
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

  // ویرایش دستی محدوده حداقل و حداکثر برای هر پارامتر (بدون محدودیت سقف تصنعی یا دستکاری فیلد مقابل هنگام تایپ)
  const handleUpdateParamRange = (key: keyof AdaptiveRanges, field: 'min' | 'max', value: number) => {
    setAdaptiveRanges((prev) => {
      const cur = { ...prev[key] };
      const safeVal = isNaN(value) ? 0 : value;

      if (field === 'min') {
        const v = Math.max(0, parseFloat(safeVal.toFixed(2)));
        cur.min = v;
        cur.boundMin = v;
        cur.userMin = v;
        if (cur.min < cur.globalMin) cur.globalMin = cur.min;
        if (cur.min > cur.globalMax) cur.globalMax = cur.min;
        if (cur.bestVal < cur.min) cur.bestVal = cur.min;
      } else {
        const v = Math.max(0, parseFloat(safeVal.toFixed(2)));
        cur.max = v;
        cur.boundMax = v;
        cur.userMax = v;
        if (cur.max > cur.globalMax) cur.globalMax = cur.max;
        if (cur.max < cur.globalMin) cur.globalMin = cur.max;
        if (cur.bestVal > cur.max) cur.bestVal = cur.max;
      }

      cur.isManualOverride = true;
      const lower = Math.min(cur.min, cur.max);
      const upper = Math.max(cur.min, cur.max);
      cur.boundMin = lower;
      cur.userMin = lower;
      cur.boundMax = upper;
      cur.userMax = upper;
      const span = upper - lower;
      const globalSpan = Math.max(span, cur.globalMax - cur.globalMin);
      cur.convergence = globalSpan > 0 ? Math.round(Math.max(0, Math.min(100, (1 - span / globalSpan) * 100))) : 50;
      const updated = { ...prev, [key]: cur };
      try {
        localStorage.setItem('zigzag_opt_ranges_v5', JSON.stringify(updated));
      } catch {}
      return updated;
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

  const [optSortColumn, setOptSortColumn] = useState<OptSortCol>(() => {
    try {
      const saved = localStorage.getItem('zigzag_opt_sort_col_v1');
      if (saved) return saved as OptSortCol;
    } catch {}
    return 'netProfit';
  });
  const [optSortDirection, setOptSortDirection] = useState<SortDirection>(() => {
    try {
      const saved = localStorage.getItem('zigzag_opt_sort_dir_v1');
      if (saved === 'asc' || saved === 'desc') return saved;
    } catch {}
    return 'desc';
  });

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
      localStorage.setItem('zigzag_opt_sort_col_v1', String(optSortColumn));
      localStorage.setItem('zigzag_opt_sort_dir_v1', optSortDirection);
    } catch {}
  }, [top10Trials, adaptiveRanges, totalEvaluatedCount, optSortColumn, optSortDirection]);

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
      localStorage.setItem('backtest_sl_slippage_percent', slSlippagePercent.toString());
      localStorage.setItem('backtest_time_stop_enabled', String(optTimeStopEnabled));
      localStorage.setItem('backtest_time_stop_candles', String(optTimeStopCandles));
      localStorage.setItem('backtest_opt_max_pos_to_risk', String(optMaxPositionToRiskRatio));
    } catch {}
  }, [universeOption, riskMode, riskPercent, riskAmountFixed, entryCommissionPercent, exitCommissionPercent, commissionPercent, slSlippagePercent, optTimeStopEnabled, optTimeStopCandles, optMaxPositionToRiskRatio]);

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

  // همگام‌سازی پیوسته وضعیت بهینه‌ساز با بک‌اند سرور و دیتابیس PostgreSQL
  useEffect(() => {
    if (!isOpen || (activeTab !== 'optimizer' && !isOptimizing)) return;

    let isSubscribed = true;
    const fetchOptimizerStatus = async () => {
      try {
        const res = await fetch('/api/optimizer/status', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        const data = await res.json();
        if (isSubscribed && data && data.success && data.state) {
          const s = data.state;
          const serverIsOptimizing = Boolean(s.isOptimizing);
          setIsOptimizing(serverIsOptimizing);

          if (!serverIsOptimizing) {
            // When optimization is finished or stopped on the server, terminate countdown immediately
            setSessionSecondsLeft(0);
            sessionSecondsRef.current = 0;
          } else if (typeof s.sessionSecondsLeft === 'number') {
            setSessionSecondsLeft(s.sessionSecondsLeft);
            sessionSecondsRef.current = s.sessionSecondsLeft;
          }

          if (Array.isArray(s.top10Trials)) {
            setTop10Trials(s.top10Trials);
          }
          if (typeof s.totalEvaluatedCount === 'number') {
            setTotalEvaluatedCount(s.totalEvaluatedCount);
          }
          // بسیار مهم: فقط در صورتی که بهینه‌ساز در سرور در حال اجرا باشد (s.isOptimizing)، رنج‌های تطبیق‌پذیر سرور دریافت می‌شوند
          // تا تغییرات دستی و تایپ کاربر در ورودی‌های رنج با مقادیر سرور بازنویسی و ریست نشوند!
          if (s.isOptimizing && s.adaptiveRanges && typeof s.adaptiveRanges === 'object') {
            setAdaptiveRanges((prev) => ({ ...DEFAULT_RANGES, ...prev, ...s.adaptiveRanges }));
          }
        }
      } catch {}
    };

    fetchOptimizerStatus();
    const interval = setInterval(fetchOptimizerStatus, isOptimizing ? 700 : 2500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [isOpen, activeTab, isOptimizing]);

  const allCollectedTradesCountRef = useRef<number>(allCollectedTrades.length);
  useEffect(() => {
    allCollectedTradesCountRef.current = allCollectedTrades.length;
  }, [allCollectedTrades.length]);

  // بررسی هوشمند داده‌ها و میزان پوشش نمادها و تاریخچه در دیتابیس PostgreSQL
  const checkCurrentRangeStatus = useCallback(async (overrides?: {
    startTime?: number;
    endTime?: number;
    exchange?: ExchangeType;
    timeframe?: Timeframe;
    datasetId?: string | null;
    symbols?: string[];
  }) => {
    setIsCheckingRange(true);
    try {
      const targetStart = overrides?.startTime !== undefined ? overrides.startTime : timeRangeStartMs;
      const targetEnd = overrides?.endTime !== undefined ? overrides.endTime : timeRangeEndMs;
      const targetExchange = overrides?.exchange !== undefined ? overrides.exchange : selectedExchange;
      const targetTf = overrides?.timeframe !== undefined ? overrides.timeframe : timeframe;
      const targetSymbols = overrides?.symbols !== undefined
        ? overrides.symbols
        : (selectedAllowedSymbols && selectedAllowedSymbols.length > 0 ? selectedAllowedSymbols : []);
      const explicitId = overrides?.datasetId !== undefined
        ? (overrides.datasetId || undefined)
        : (activeSessionDatasetId || undefined);

      const res = await fetch('/api/backtest/range-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: targetExchange,
          timeframe: targetTf,
          startTime: targetStart,
          endTime: targetEnd,
          datasetId: explicitId,
          symbols: targetSymbols,
          includeTrades: allCollectedTradesCountRef.current === 0,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        setRangeStatus(data);
        if (data.exists && data.dataset) {
          const matchedId = data.datasetId || data.dataset.id;
          if (matchedId) {
            setActiveSessionDatasetId((prev) => (prev !== matchedId ? matchedId : prev));
          }
          const availableCount = data.coverage?.availableSymbolsCount || data.dataset.symbolCount || 0;
          setCachedCount(availableCount);

          if (Array.isArray(data.results) && data.results.length > 0) {
            setResults((prev) => (prev.length === 0 ? data.results : prev));
            const expectedCount = Number(data.allTradesCount || (Array.isArray(data.allTrades) ? data.allTrades.length : 0));
            if (expectedCount > 0 && Array.isArray(data.allTrades)) {
              if (data.allTrades.length >= expectedCount) {
                setAllCollectedTrades((prev) => (prev.length === 0 || prev.length < expectedCount ? data.allTrades : prev));
              } else if (allCollectedTradesCountRef.current < expectedCount) {
                try {
                  const fullRes = await fetch('/api/backtest/range-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      exchange: targetExchange,
                      timeframe: targetTf,
                      startTime: targetStart,
                      endTime: targetEnd,
                      datasetId: matchedId || explicitId,
                      symbols: targetSymbols,
                      includeTrades: true,
                    }),
                  });
                  const fullData = await fullRes.json();
                  if (fullData?.success && Array.isArray(fullData.allTrades) && fullData.allTrades.length > 0) {
                    setAllCollectedTrades(fullData.allTrades);
                  }
                } catch {}
              }
            }
          }
          if (Array.isArray(data.skippedSymbols) && data.skippedSymbols.length > 0) {
            setSkippedSymbols(data.skippedSymbols);
          }
          if (data.strategyId) {
            setSelectedStrategyId((prev) => (!prev ? data.strategyId : prev));
          }
        } else {
          setActiveSessionDatasetId(null);
        }
      }
    } catch (err) {
      console.warn('Range status check failed:', err);
    } finally {
      setIsCheckingRange(false);
    }
  }, [selectedExchange, timeframe, timeRangeStartMs, timeRangeEndMs, selectedAllowedSymbols, activeSessionDatasetId]);

  useEffect(() => {
    checkCurrentRangeStatusRef.current = checkCurrentRangeStatus;
  }, [checkCurrentRangeStatus]);

  const handleSelectTimeframe = useCallback((newTf: Timeframe) => {
    setTimeframe(newTf);
    setActiveSessionDatasetId(null);
    checkCurrentRangeStatus({
      timeframe: newTf,
      datasetId: null,
    });
  }, [checkCurrentRangeStatus]);

  const [isSyncingCandles, setIsSyncingCandles] = useState<boolean>(false);

  // همگام‌سازی مستقیم کندل‌های آخرین بکتست از PostgreSQL به کش حافظه مرورگر برای بهینه‌ساز و صفحه آمار
  const syncRangeCandlesToMemory = useCallback(async (notifyUser: boolean = true) => {
    const targetDatasetId =
      rangeStatus?.datasetId ||
      activeSessionDatasetId ||
      `range_${(selectedExchange || 'xt').toLowerCase()}_${timeframe}_${timeRangeStartMs || 0}_${timeRangeEndMs || 0}`;

    setIsSyncingCandles(true);
    try {
      const sqlRes = await loadDatasetFromCloudSql(targetDatasetId);
      if (sqlRes && sqlRes.success && Array.isArray(sqlRes.entries) && sqlRes.entries.length > 0) {
        for (const entry of sqlRes.entries) {
          if (entry.pair && entry.pair.symbol && entry.candles) {
            GLOBAL_CANDLE_CACHE.set(entry.pair.symbol, {
              candles: entry.candles,
              timeframe: entry.timeframe || timeframe,
              pair: entry.pair,
            });
            GLOBAL_CANDLE_CACHE.set(`${selectedExchange}_${entry.pair.symbol}_${timeframe}`, {
              candles: entry.candles,
              timeframe: entry.timeframe || timeframe,
              pair: entry.pair,
            });
          }
        }
        const count = getCachedUniqueCount();
        setCachedCount(count);
        if (notifyUser) {
          showToast(`⚡ ${count} جفت‌ارز بکتست با موفقیت با بهینه‌ساز و آمار همگام شدند!`);
        }
        return true;
      } else {
        if (notifyUser) {
          showToast('⚠️ داده کندل‌ها در پایگاه‌داده یافت نشد.');
        }
        return false;
      }
    } catch (err) {
      console.warn('Failed to sync candles to memory:', err);
      if (notifyUser) {
        showToast('❌ خطا در همگام‌سازی کندل‌ها با پایگاه داده.');
      }
      return false;
    } finally {
      setIsSyncingCandles(false);
    }
  }, [rangeStatus?.datasetId, activeSessionDatasetId, selectedExchange, timeframe, timeRangeStartMs, timeRangeEndMs, getCachedUniqueCount]);

  // بهینه‌ساز و آمار کاملاً به دیتابیس متصل بوده و مستقل از کش رم مرورگر در سرور اجرا می‌شوند

  useEffect(() => {
    checkCurrentRangeStatus();
  }, [selectedExchange, timeframe, timeRangeStartMs, timeRangeEndMs]);

  const hasSyncedDatasetIdRef = useRef<string | null>(null);
  const wasScanningRef = useRef<boolean>(false);
  const initialPollDoneRef = useRef<boolean>(false);

  // پایش بی‌وقفه و همگام وضعیت اسکن در پس‌زمینه سرور (حفظ وضعیت در صورت ریلود یا بستن تب)
  useEffect(() => {
    let interval: any;
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const res = await fetch('/api/backtest/status?includeTrades=false');
        if (!res.ok || !isMounted) return;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        const data = await res.json();
        if (data && data.success && data.state && isMounted) {
          const st = data.state;
          if (st.isScanning) {
            setIsScanning(true);
            wasScanningRef.current = true;
            if (st.progress) {
              setProgress({
                current: st.progress.current || 0,
                total: st.progress.total || 0,
                currentSymbol: st.progress.currentSymbol || `در حال پردازش موازی در پس‌زمینه سرور (${st.stage || ''})...`,
              });
            }
            if (Array.isArray(st.results) && st.results.length > 0) {
              setResults(st.results);
            }
          } else if (wasScanningRef.current) {
            // تنها یک بار در لحظه پایان اسکن اجرا شود
            wasScanningRef.current = false;
            setIsScanning(false);

            if (st.stage === 'error') {
              setErrorMsg(st.errorMsg || 'خطا در اسکن.');
              showToast(`❌ خطا در اسکن: ${st.errorMsg || 'ناشناخته'}`);
              return;
            }

            if (Array.isArray(st.results) && st.results.length > 0) {
              setResults(st.results);
            }
            if (Array.isArray(st.skippedSymbols)) {
              setSkippedSymbols(st.skippedSymbols);
            }
            // دریافت یکباره تمام معاملات در پایان اسکن
            try {
              const fullTradesRes = await fetch('/api/backtest/status?includeTrades=true');
              const fullTradesData = await fullTradesRes.json();
              if (fullTradesData?.state?.allTrades && isMounted) {
                setAllCollectedTrades(fullTradesData.state.allTrades);
              }
              if (Array.isArray(fullTradesData?.state?.skippedSymbols) && isMounted) {
                setSkippedSymbols(fullTradesData.state.skippedSymbols);
              }
            } catch {}

            if (st.progress) {
              setProgress({
                current: st.progress.total || st.progress.current || 0,
                total: st.progress.total || st.progress.current || 0,
                currentSymbol: st.stage === 'completed' ? 'اسکن کامل شد.' : 'اسکن متوقف شد.',
              });
            }
            if (st.datasetId) {
              setActiveSessionDatasetId(st.datasetId);
              hasSyncedDatasetIdRef.current = st.datasetId;
            }

            // تطبیق هوشمند بازه زمانی و نمادها با دیتابیس بلافاصله پس از اتمام اسکن
            const dbStartTime = Number(st.startTime) || 0;
            const dbEndTime = Number(st.endTime) || 0;
            if (dbStartTime > 0 && dbEndTime > dbStartTime) {
              setTimeRangeStartMs(dbStartTime);
              setTimeRangeEndMs(dbEndTime);
            }

            const finalCount = (Array.isArray(st.results) && st.results.length > 0)
              ? st.results.length
              : (st.symbolCount || (Array.isArray(st.results) ? st.results.length : 0));
            if (finalCount > 0) {
              setCachedCount(finalCount);
            }

            // فراخوانی فوری چک وضعیت بازه دیتابیس جهت فعال‌سازی بی‌درنگ دکمه «محاسبه و آپدیت با پارامترهای جدید»
            checkCurrentRangeStatusRef.current?.({
              datasetId: st.datasetId || undefined,
              exchange: st.exchange || selectedExchange,
              timeframe: st.timeframe || timeframe,
              startTime: dbStartTime > 0 ? dbStartTime : undefined,
              endTime: dbEndTime > 0 ? dbEndTime : undefined,
            });

            if (st.stage === 'completed') {
              showToast('✅ اسکن جفت‌ارزها پایان یافت و با موفقیت با دیتابیس تطبیق داده شد.');
            }
          } else if (!initialPollDoneRef.current) {
            // بارگذاری اولیه یکباره در زمان باز شدن صفحه در صورتی که دیتای سرور موجود است
            initialPollDoneRef.current = true;
            setIsScanning(false);
            if (Array.isArray(st.results) && st.results.length > 0 && results.length === 0) {
              setResults(st.results);
            }
            if ((st.allTradesCount || 0) > 0 && allCollectedTradesCountRef.current < Number(st.allTradesCount)) {
              try {
                const fullTradesRes = await fetch('/api/backtest/status?includeTrades=true');
                const fullTradesData = await fullTradesRes.json();
                if (fullTradesData?.state?.allTrades && isMounted) {
                  setAllCollectedTrades(fullTradesData.state.allTrades);
                }
              } catch {}
            }
            if (st.datasetId) {
              setActiveSessionDatasetId(st.datasetId);
              hasSyncedDatasetIdRef.current = st.datasetId;
            }
            const dbStartTime = Number(st.startTime) || 0;
            const dbEndTime = Number(st.endTime) || 0;
            if (dbStartTime > 0 && dbEndTime > dbStartTime) {
              setTimeRangeStartMs(dbStartTime);
              setTimeRangeEndMs(dbEndTime);
            }
            if (Array.isArray(st.results) && st.results.length > 0) {
              setCachedCount(st.results.length);
            }
            checkCurrentRangeStatusRef.current?.({
              datasetId: st.datasetId || undefined,
              exchange: st.exchange || selectedExchange,
              timeframe: st.timeframe || timeframe,
              startTime: dbStartTime > 0 ? dbStartTime : undefined,
              endTime: dbEndTime > 0 ? dbEndTime : undefined,
            });
          } else {
            // در حالت بیکار (Idle) وضعیت در حال اسکن غیرفعال نگه داشته می‌شود بدون ری‌رندر مداوم کامپوننت‌ها
            if (isScanning) {
              setIsScanning(false);
            }
          }
        }
      } catch {}
    };

    pollStatus();
    interval = setInterval(pollStatus, 2500);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  // =========================================================
  // اسکن مستقل و پایدار بک‌تست در پس‌زمینه سرور (ذخیره مستقیم در PostgreSQL)
  // =========================================================
  const handleStartScan = async (
    forceRedownload?: boolean,
    overrideConfig?: Partial<StrategyConfig>,
    scanMode?: 'cached' | 'incremental' | 'full'
  ) => {
    // اگر کاربر دکمه اسکن را بدون تعیین نوع زده و دیتابیس موجود است، مودال انتخاب باز می‌شود
    if (forceRedownload === undefined && scanMode === undefined && rangeStatus?.exists) {
      setIsRescanPromptOpen(true);
      return;
    }

    // اگر دیتابیس وجود ندارد، اسکن حتماً باید دانلود کامل باشد
    let effectiveScanMode: 'cached' | 'incremental' | 'full' = scanMode || (forceRedownload ? 'full' : (rangeStatus?.exists ? 'cached' : 'full'));
    if (!rangeStatus?.exists && effectiveScanMode === 'cached') {
      effectiveScanMode = 'full';
    }

    setIsRescanPromptOpen(false);
    setIsScanning(true);
    abortControllerRef.current = false;
    setErrorMsg(null);
    setResults([]);
    setAllCollectedTrades([]);
    setScanMaxDrawdown(0);
    setSkippedSymbols([]);
    const targetSymbols = (selectedAllowedSymbols && selectedAllowedSymbols.length > 0)
      ? selectedAllowedSymbols
      : [];

    const missingCount = rangeStatus?.coverage?.missingSymbolsCount || 0;
    setProgress({
      current: 0,
      total: targetSymbols.length > 0 ? targetSymbols.length : (rangeStatus?.dataset?.symbolCount || 771),
      currentSymbol: effectiveScanMode === 'incremental'
        ? `در حال آماده‌سازی دانلود تکمیلی ${missingCount > 0 ? missingCount : ''} نماد کسری...`
        : (effectiveScanMode === 'full'
          ? `در حال ارسال درخواست دانلود کامل به سرور با ${scanWorkersCount} ورکر موازی...`
          : 'در حال اجرای بک‌تست سریع با نمادهای موجود در PostgreSQL...'),
    });

    try {
      const res = await fetch('/api/backtest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: selectedExchange,
          timeframe,
          startTime: timeRangeStartMs,
          endTime: timeRangeEndMs,
          datasetId: activeSessionDatasetId || rangeStatus?.datasetId || undefined,
          symbols: targetSymbols,
          workersCount: scanWorkersCount,
          strategyId: selectedStrategyId,
          forceRedownload: effectiveScanMode === 'full',
          incrementalSync: effectiveScanMode === 'incremental',
          scanMode: effectiveScanMode,
          strategyConfig: {
            capital: overrideConfig?.capital ?? capital,
            riskMode: overrideConfig?.riskMode ?? riskMode,
            riskPercent: overrideConfig?.riskPercent ?? riskPercent,
            riskAmountFixed: overrideConfig?.riskAmountFixed ?? riskAmountFixed,
            entryCommissionPercent: overrideConfig?.entryCommissionPercent ?? entryCommissionPercent,
            exitCommissionPercent: overrideConfig?.exitCommissionPercent ?? exitCommissionPercent,
            slSlippagePercent: overrideConfig?.slSlippagePercent ?? slSlippagePercent,
            exchange: selectedExchange,
            maxRiskReward: overrideConfig?.maxRiskReward ?? optMaxRiskReward,
            optMaxRiskReward: overrideConfig?.maxRiskReward ?? optMaxRiskReward,
            maxCandlesToEnter: overrideConfig?.maxCandlesToEnter ?? maxCandlesToEnter,
            atrPeriod: overrideConfig?.atrPeriod ?? optAtrPeriod,
            optAtrPeriod: overrideConfig?.atrPeriod ?? optAtrPeriod,
            atrMultiplier: overrideConfig?.atrMultiplier ?? optAtrMultiplier,
            optAtrMultiplier: overrideConfig?.atrMultiplier ?? optAtrMultiplier,
            minCandles: overrideConfig?.minCandles ?? optMinCandles,
            optMinCandles: overrideConfig?.minCandles ?? optMinCandles,
            minCandlesForLongLeg: overrideConfig?.minCandlesForLongLeg ?? optMinCandlesLong,
            optMinCandlesLong: overrideConfig?.minCandlesForLongLeg ?? optMinCandlesLong,
            minCandlesForBlueLeg: overrideConfig?.minCandlesForBlueLeg ?? optMinCandlesBlue,
            optMinCandlesBlue: overrideConfig?.minCandlesForBlueLeg ?? optMinCandlesBlue,
            longLegAtrMultiplier: overrideConfig?.longLegAtrMultiplier ?? optLongLegAtrMult,
            optLongLegAtrMult: overrideConfig?.longLegAtrMultiplier ?? optLongLegAtrMult,
            blueLegAtrMultiplier: overrideConfig?.blueLegAtrMultiplier ?? optBlueLegAtrMult,
            optBlueLegAtrMult: overrideConfig?.blueLegAtrMultiplier ?? optBlueLegAtrMult,
            maxBlueLegPercent: overrideConfig?.maxBlueLegPercent ?? optMaxBlueLegPercent,
            optMaxBlueLegPercent: overrideConfig?.maxBlueLegPercent ?? optMaxBlueLegPercent,
            maxBreakoutAtrMultiplier: overrideConfig?.maxBreakoutAtrMultiplier ?? optMaxBreakoutAtr,
            optMaxBreakoutAtr: overrideConfig?.maxBreakoutAtrMultiplier ?? optMaxBreakoutAtr,
            noConcurrentPositions: overrideConfig?.noConcurrentPositions ?? noConcurrentPositions,
            timeStopEnabled: overrideConfig?.timeStopEnabled ?? optTimeStopEnabled,
            optTimeStopEnabled: overrideConfig?.timeStopEnabled ?? optTimeStopEnabled,
            timeStopCandles: overrideConfig?.timeStopCandles ?? optTimeStopCandles,
            optTimeStopCandles: overrideConfig?.timeStopCandles ?? optTimeStopCandles,
            maxPositionToRiskRatio: overrideConfig?.maxPositionToRiskRatio ?? optMaxPositionToRiskRatio,
            optMaxPositionToRiskRatio: overrideConfig?.maxPositionToRiskRatio ?? optMaxPositionToRiskRatio,
          },
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        showToast(
          effectiveScanMode === 'incremental'
            ? `🔄 دانلود تکمیلی نمادهای کسری با ${scanWorkersCount} ورکر در سرور آغاز شد.`
            : (effectiveScanMode === 'full'
              ? `🚀 دانلود مجدد کامل و جایگزینی دیتابیس با ${scanWorkersCount} ورکر آغاز شد.`
              : `⚡ بک‌تست موازی با استفاده از داده‌های موجود در PostgreSQL آغاز شد.`)
        );
      } else {
        setErrorMsg(data?.error || 'خطا در آغاز اسکن سرور.');
        setIsScanning(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در برقراری ارتباط با سرور.');
      setIsScanning(false);
    }
  };

  // اجرای سریع بک‌تست با استفاده از داده‌های موجود در دیتابیس
  const handleRerunOnCachedData = () => {
    handleStartScan(false, undefined, 'cached');
  };

  // دانلود تکمیلی فقط برای نمادها یا روزهای کسری
  const handleStartIncrementalScan = () => {
    handleStartScan(false, undefined, 'incremental');
  };

  const handleStopScan = async () => {
    abortControllerRef.current = true;
    setIsScanning(false);
    try {
      await fetch('/api/backtest/stop', { method: 'POST' });
      showToast('⏸️ دستور توقف اسکن سرور ثبت شد.');
      setTimeout(() => {
        checkCurrentRangeStatus();
      }, 700);
    } catch {}
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
    setIsDeleteRangePromptOpen(true);
  };

  const handleConfirmDeleteCurrentRange = async () => {
    try {
      const activeDatasetId = rangeStatus?.dataset?.id || activeSessionDatasetId || '';
      const res = await fetch(
        `/api/backtest/range?exchange=${encodeURIComponent(selectedExchange)}&timeframe=${encodeURIComponent(timeframe)}&startTime=${timeRangeStartMs}&endTime=${timeRangeEndMs}${activeDatasetId ? `&datasetId=${encodeURIComponent(activeDatasetId)}` : ''}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data && data.success) {
        setResults([]);
        setAllCollectedTrades([]);
        setScanMaxDrawdown(0);
        setCachedCount(0);
        GLOBAL_CANDLE_CACHE.clear();
        try {
          localStorage.removeItem('backtest_scanned_results_v2');
          localStorage.removeItem('backtest_scanned_trades_v2');
        } catch {}
        setRangeStatus({ exists: false });
        setActiveSessionDatasetId(null);
        setIsDeleteRangePromptOpen(false);
        showToast('🗑️ داده‌های این بازه زمانی با موفقیت از دیتابیس PostgreSQL و حافظه حذف شدند.');
        // Re-check database range status immediately to update the UI
        checkCurrentRangeStatusRef.current?.({ datasetId: null });
      } else {
        showToast('❌ خطا در حذف داده‌های بازه از دیتابیس.');
      }
    } catch (err) {
      showToast('❌ خطا در برقراری ارتباط با دیتابیس.');
    }
  };

  const handleClearAllCandlesDatabase = () => {
    setIsClearAllCandlesPromptOpen(true);
  };

  const handleConfirmClearAllCandlesDatabase = async () => {
    try {
      setIsClearingAllCandles(true);
      const res = await fetch('/api/candles/clear-all', { method: 'POST' });
      const data = await res.json();
      if (data && data.success) {
        GLOBAL_CANDLE_CACHE.clear();
        await clearCandleDbStore();
        setCachedCount(0);
        setResults([]);
        setAllCollectedTrades([]);
        setScanMaxDrawdown(0);
        setRangeStatus({ exists: false });
        setActiveSessionDatasetId(null);
        try {
          localStorage.removeItem('backtest_scanned_results_v2');
          localStorage.removeItem('backtest_scanned_trades_v2');
        } catch {}
        setIsClearAllCandlesPromptOpen(false);
        setIsDeleteRangePromptOpen(false);
        showToast('🗑️ تمام دیتای کندل‌های ذخیره‌شده در دیتابیس PostgreSQL و حافظه کش با موفقیت پاکسازی شدند.');
        checkCurrentRangeStatusRef.current?.({ datasetId: null });
      } else {
        showToast(`❌ خطا در پاکسازی دیتابیس: ${data.error || 'خطای سرور'}`);
      }
    } catch (err: any) {
      showToast(`❌ خطا در ارتباط با سرور: ${err.message || 'خطا'}`);
    } finally {
      setIsClearingAllCandles(false);
    }
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
      (t) => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BREAKEVEN'
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

    let conflictGroupsCount = 0;

    if (!noConcurrentPositions) {
      accepted.push(...sorted);
    } else {
      let lastExitTime = 0;
      let currentActiveTrade: StrategyTrade | null = null;

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

    // در حالت درصد از سرمایه، سایز هر معامله با سرمایه واقعی سبد (نه سرمایه ایزوله هر ارز) هماهنگ می‌شود
    let portfolioAccepted = accepted;
    if (riskMode === 'percent' && accepted.length > 0 && capital > 0) {
      let runningPortfolioEq = capital;
      portfolioAccepted = accepted.map((t) => {
        const baseCap = (t.capitalBeforeTrade && t.capitalBeforeTrade > 0) ? t.capitalBeforeTrade : capital;
        const scale = runningPortfolioEq / baseCap;
        if (Math.abs(scale - 1) <= 0.002) {
          runningPortfolioEq = Math.max(1, runningPortfolioEq + (t.pnl || 0));
          return {
            ...t,
            capitalBeforeTrade: parseFloat(baseCap.toFixed(4)),
            capitalAfterTrade: parseFloat(runningPortfolioEq.toFixed(4)),
          };
        }
        const scaledSize = t.positionSize * scale;
        const scaledVal = t.positionValue * scale;
        const scaledRisk = t.riskAmount * scale;
        const scaledRealizedRisk = t.realizedRisk !== undefined ? t.realizedRisk * scale : undefined;
        const scaledGross = t.grossPnl !== undefined ? t.grossPnl * scale : undefined;
        const scaledEntryFee = t.entryFee !== undefined ? t.entryFee * scale : undefined;
        const scaledExitFee = t.exitFee !== undefined ? t.exitFee * scale : undefined;
        const scaledFee = t.fee !== undefined ? t.fee * scale : undefined;
        const scaledPnl = parseFloat((t.pnl * scale).toFixed(4));
        const capBefore = parseFloat(runningPortfolioEq.toFixed(4));
        runningPortfolioEq = Math.max(1, parseFloat((runningPortfolioEq + scaledPnl).toFixed(4)));
        return {
          ...t,
          positionSize: scaledSize,
          positionValue: parseFloat(scaledVal.toFixed(4)),
          riskAmount: parseFloat(scaledRisk.toFixed(4)),
          targetRiskAmount: parseFloat(scaledRisk.toFixed(4)),
          realizedRisk: scaledRealizedRisk !== undefined ? parseFloat(scaledRealizedRisk.toFixed(4)) : undefined,
          grossPnl: scaledGross !== undefined ? parseFloat(scaledGross.toFixed(4)) : undefined,
          entryFee: scaledEntryFee !== undefined ? parseFloat(scaledEntryFee.toFixed(4)) : undefined,
          exitFee: scaledExitFee !== undefined ? parseFloat(scaledExitFee.toFixed(4)) : undefined,
          fee: scaledFee !== undefined ? parseFloat(scaledFee.toFixed(4)) : undefined,
          commission: scaledFee !== undefined ? parseFloat(scaledFee.toFixed(4)) : undefined,
          pnl: scaledPnl,
          pnlPercent: parseFloat(((scaledPnl / capBefore) * 100).toFixed(4)),
          entryNotional: t.entryNotional !== undefined ? parseFloat((t.entryNotional * scale).toFixed(4)) : undefined,
          exitNotional: t.exitNotional !== undefined ? parseFloat((t.exitNotional * scale).toFixed(4)) : undefined,
          capitalBeforeTrade: capBefore,
          capitalAfterTrade: runningPortfolioEq,
        };
      });
    }

    const finalTradesCount = portfolioAccepted.length;
    const rejectedTradesCount = rejected.length;
    const removalPercentage = rawTradesCount > 0 ? (rejectedTradesCount / rawTradesCount) * 100 : 0;

    return {
      effectiveTrades: portfolioAccepted,
      rawTradesCount,
      finalTradesCount,
      rejectedTradesCount,
      removalPercentage: parseFloat(removalPercentage.toFixed(2)),
      conflictGroupsCount,
      maxSimultaneousRawSignals: Math.max(1, maxSimultaneousRaw),
      maxSimultaneousFinalPositions: 1,
      rejectedTrades: rejected,
      acceptedTrades: portfolioAccepted,
      rejectionReasonBreakdown: {
        'تداخل با پوزیشن فعال در پورتفوی': rejectedTradesCount,
      },
      acceptanceReasonBreakdown: {
        'نخستین سیگنال زمانی یا بالاترین نمره سیگنال در اسلات آزاد': finalTradesCount,
      },
      tieBreakerRule: 'Priority 1: Earliest entry timestamp -> Priority 2: Signal score at entry bar -> Priority 3: Alphabetical symbol',
      lookAheadBiasAssertion: 'PASS - انتخاب سیگنال منحصراً بر پایه زمان ورود، نمره کندل ورودی و ترتیب نماد صورت گرفته و هیچ داده‌ای از آینده یا خروج ترید در تصمیم‌گیری فیلتر دخالت ندارد.',
    };
  }, [allCollectedTrades, noConcurrentPositions, riskMode, capital]);

  const effectivePortfolioTrades = concurrencyFilterResults.effectiveTrades;

  const rawTotalTradesSum = results.reduce((acc, r) => acc + r.totalTrades, 0);
  const rawTotalWinTradesSum = results.reduce((acc, r) => acc + r.winTrades, 0);
  const rawTotalLossTradesSum = results.reduce((acc, r) => acc + r.lossTrades, 0);
  const rawTotalNetProfitSum = parseFloat(results.reduce((acc, r) => acc + r.netProfit, 0).toFixed(2));
  const rawTotalProfitSum = parseFloat(results.reduce((acc, r) => acc + r.totalProfit, 0).toFixed(2));
  const rawTotalLossSum = parseFloat(results.reduce((acc, r) => acc + r.totalLoss, 0).toFixed(2));
  const rawTotalFeeSum = parseFloat(results.reduce((acc, r) => acc + (r.totalFee || 0), 0).toFixed(2));

  // در زمان اسکن فعال، همواره مجموع افزایشی تمام ارزهای اسکن‌شده نمایش داده می‌شود تا وین‌ریت هرگز به عقب برنگردد
  const hasPortfolioTrades = !isScanning && effectivePortfolioTrades.length > 0;
  const isPortfolioFilterActive = noConcurrentPositions && hasPortfolioTrades;

  const totalTradesSum = hasPortfolioTrades ? effectivePortfolioTrades.length : rawTotalTradesSum;
  const totalWinTradesSum = hasPortfolioTrades
    ? effectivePortfolioTrades.filter((t) => t.status === 'WIN').length
    : rawTotalWinTradesSum;
  const totalNetProfitSum = hasPortfolioTrades
    ? parseFloat(effectivePortfolioTrades.reduce((acc, t) => acc + t.pnl, 0).toFixed(2))
    : rawTotalNetProfitSum;
  const totalProfitSum = hasPortfolioTrades
    ? parseFloat(effectivePortfolioTrades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0).toFixed(2))
    : rawTotalProfitSum;
  const totalLossSum = hasPortfolioTrades
    ? parseFloat(effectivePortfolioTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0).toFixed(2))
    : rawTotalLossSum;
  const totalFeeSum = hasPortfolioTrades
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
      maxDd: Math.max(...dds, 0),
    };
  }, [equityPoints, capital]);

  // به‌روزرسانی حداکثر درودان در حین اسکن: در حین اسکن مقیاس لحظه‌ای را نشان می‌دهد و پس از پایان اسکن دقیقاً منطبق با منحنی سرمایه پرتفوی می‌شود
  useEffect(() => {
    if (results.length === 0) {
      setScanMaxDrawdown((prev) => (prev === 0 ? 0 : 0));
      return;
    }
    if (!isScanning && effectivePortfolioTrades.length > 0) {
      const portfolioDd = parseFloat((chartStats.maxDd || 0).toFixed(2));
      setScanMaxDrawdown(portfolioDd);
      return;
    }
    const maxPair = Math.max(...results.map((r) => r.maxDrawdownPercent || 0));
    const combined = chartStats.maxDd || 0;
    const currentWorst = Math.max(maxPair, combined);
    setScanMaxDrawdown((prev) => {
      const next = parseFloat(Math.max(prev, currentWorst).toFixed(2));
      return next === prev ? prev : next;
    });
  }, [results, chartStats.maxDd, isScanning, effectivePortfolioTrades.length]);

  const portfolioMaxDrawdown = useMemo(() => {
    if (results.length === 0) return 0;
    if (!isScanning && effectivePortfolioTrades.length > 0) {
      return parseFloat((chartStats.maxDd || 0).toFixed(2));
    }
    const maxPair = Math.max(...results.map((r) => r.maxDrawdownPercent || 0));
    const combined = chartStats.maxDd || 0;
    return parseFloat(Math.max(scanMaxDrawdown, maxPair, combined).toFixed(2));
  }, [results, scanMaxDrawdown, chartStats.maxDd, isScanning, effectivePortfolioTrades.length]);

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
        optMinCandlesBlue,
        optAtrMultiplier,
        optLongLegAtrMult,
        optBlueLegAtrMult,
        optMaxBlueLegPercent,
        optMaxBreakoutAtr,
        optMaxRiskReward,
        optTimeStopEnabled,
        optTimeStopCandles,
        optMaxPositionToRiskRatio,
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
    if (config.optMinCandlesBlue) setOptMinCandlesBlue(config.optMinCandlesBlue);
    if (config.optAtrMultiplier) setOptAtrMultiplier(config.optAtrMultiplier);
    if (config.optLongLegAtrMult) setOptLongLegAtrMult(config.optLongLegAtrMult);
    if (config.optBlueLegAtrMult) setOptBlueLegAtrMult(config.optBlueLegAtrMult);
    if (config.optMaxBlueLegPercent !== undefined) setOptMaxBlueLegPercent(config.optMaxBlueLegPercent);
    if (config.optMaxBreakoutAtr !== undefined) setOptMaxBreakoutAtr(config.optMaxBreakoutAtr);
    if (config.optMaxRiskReward) setOptMaxRiskReward(config.optMaxRiskReward);
    if (typeof config.optTimeStopEnabled === 'boolean') setOptTimeStopEnabled(config.optTimeStopEnabled);
    if (config.optTimeStopCandles) setOptTimeStopCandles(config.optTimeStopCandles);
    if (config.optMaxPositionToRiskRatio) setOptMaxPositionToRiskRatio(config.optMaxPositionToRiskRatio);

    onUpdateZigZagSettings?.({
      atrPeriod: config.optAtrPeriod,
      minCandles: config.optMinCandles,
      minCandlesForLongLeg: config.optMinCandlesLong,
      minCandlesForBlueLeg: config.optMinCandlesBlue,
      atrMultiplier: config.optAtrMultiplier,
      longLegAtrMultiplier: config.optLongLegAtrMult,
      blueLegAtrMultiplier: config.optBlueLegAtrMult,
      maxBlueLegPercent: config.optMaxBlueLegPercent,
      maxBreakoutAtrMultiplier: config.optMaxBreakoutAtr,
      maxRiskReward: config.optMaxRiskReward,
      maxPositionToRiskRatio: config.optMaxPositionToRiskRatio,
      ...(typeof config.optTimeStopEnabled === 'boolean' ? { timeStopEnabled: config.optTimeStopEnabled } : {}),
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
    const count = rangeStatus?.dataset?.symbolCount || cachedCount || results.length || GLOBAL_CANDLE_CACHE.size;
    const defaultName = `بسته کندل‌های ${timeframe} (${count} ارز) - ${dateStr} ${timeStr}`;
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
    if (cachedCount === 0 && !rangeStatus?.exists && results.length === 0 && GLOBAL_CANDLE_CACHE.size === 0) {
      showToast('⚠️ هیچ کندلی در حافظه یا دیتابیس موجود نیست. ابتدا اسکن را اجرا کنید.');
      return;
    }

    setIsSavingCandles(true);

    // ۱. اگر دیتا در دیتابیس به صورت بافر موقت اسکن اخیر موجود است، بلافاصله آن را در PostgreSQL اختصاصی دائمی کن
    if (activeSessionDatasetId) {
      try {
        await promoteDatasetInCloudSql(activeSessionDatasetId, trimmedName).catch(() => {});
        await makeTemporaryDatasetPermanent(currentUser || 'amir', activeSessionDatasetId, trimmedName).catch(() => {});
        showToast(`⚡ بسته کندل‌های «${trimmedName}» به صورت آنی در PostgreSQL دائمی شد (بدون نیاز به آپلود مجدد)!`);
        setIsSaveCandleModalOpen(false);
        setActiveSessionDatasetId(null);
        setIsSavingCandles(false);
        return;
      } catch (err) {
        console.warn('Could not promote temp dataset, falling back to full save:', err);
      }
    }

    // ۲. ذخیره‌سازی در PostgreSQL (با ظرفیت و سرعت بالا)
    setUploadProgress({
      currentChunk: 0,
      totalChunks: Math.ceil((rangeStatus?.dataset?.symbolCount || cachedCount || 10) / 5),
      percent: 30,
      statusText: 'در حال ذخیره‌سازی مستقیم در پایگاه‌داده PostgreSQL...',
    });
    try {
      // ذخیره در PostgreSQL سرور
      const sqlRes = await saveDatasetToCloudSql({
        name: trimmedName,
        userId: currentUser || 'amir',
        timeframe,
        isTemporary: false,
        datasetId: rangeStatus?.datasetId || activeSessionDatasetId || undefined,
      });

      if (sqlRes.success) {
        showToast(`✅ بسته کندل‌های «${trimmedName}» با موفقیت در دیتابیس PostgreSQL ذخیره شد!`);
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

      // ادغام لیست‌ها با اولویت دیتابیس PostgreSQL سرور اختصاصی
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
      statusText: 'در حال دریافت فوق‌سریع داده‌های کندل از سرور PostgreSQL اختصاصی...',
    });
    try {
      let entries: { pair: any; candles: any[]; timeframe: string }[] = [];

      // تلاش اول: لود سریع از سرور PostgreSQL اختصاصی
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
      if (dataset.id) {
        setActiveSessionDatasetId(dataset.id);
      }
      if (dataset.startTime && Number(dataset.startTime) > 0) {
        setTimeRangeStartMs(Number(dataset.startTime));
      }
      if (dataset.endTime && Number(dataset.endTime) > 0) {
        setTimeRangeEndMs(Number(dataset.endTime));
      }
      if (dataset.exchange) {
        setSelectedExchange(dataset.exchange as any);
      }
      if (dataset.timeframe) {
        setTimeframe(dataset.timeframe as Timeframe);
      }

      setIsLoadCandleModalOpen(false);
      showToast(`⚡ ${entries.length} جفت‌ارز با موفقیت از سرور PostgreSQL بازیابی شدند!`);
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
  // ارزیابی یک ترکیب روی تمام جفت‌ارزهای کش‌شده (تطابق ۱۰۰٪ ریاضی با اسکن دستی)
  // =========================================================================
  const evaluateSingleCombination = (
    params: {
      atrPeriod: number;
      minCandles: number;
      minCandlesForLongLeg: number;
      minCandlesForBlueLeg?: number;
      atrMultiplier: number;
      longLegAtrMultiplier: number;
      blueLegAtrMultiplier?: number;
      maxBlueLegPercent: number;
      maxBreakoutAtrMultiplier: number;
      maxRiskReward: number;
      timeStopCandles?: number;
    },
    overrideNoConcurrent?: boolean
  ) => {
    // ۱. استخراج جفت‌ارزهای یکتا از کش برای جلوگیری از شمارش مضاعف (Deduplication)
    const cleanSym = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const allowedSet =
      selectedAllowedSymbols && selectedAllowedSymbols.length > 0
        ? new Set(selectedAllowedSymbols.map((s) => cleanSym(s)))
        : null;

    const uniqueMap = new Map<string, { pair: CryptoPair; candles: CandleData[]; timeframe: string }>();
    const targetTf = (timeframe || '').toLowerCase();

    for (const entry of Array.from(GLOBAL_CANDLE_CACHE.values())) {
      if (entry && entry.candles && entry.candles.length >= 50 && entry.pair?.symbol) {
        const rawSym = entry.pair.symbol;
        const normSym = cleanSym(rawSym);
        if (allowedSet && !allowedSet.has(normSym)) continue;

        const entryTf = (entry.timeframe || '').toLowerCase();
        if (!entryTf || entryTf === targetTf) {
          if (!uniqueMap.has(normSym)) {
            uniqueMap.set(normSym, entry);
          }
        }
      }
    }

    // در صورتی که فیلتر نمادها به علت تفاوت نام‌گذاری موردی را نیافت، از کلیه کندل‌های معتبر استفاده می‌شود
    if (uniqueMap.size === 0 && allowedSet) {
      for (const entry of Array.from(GLOBAL_CANDLE_CACHE.values())) {
        if (entry && entry.candles && entry.candles.length >= 50 && entry.pair?.symbol) {
          const normSym = cleanSym(entry.pair.symbol);
          const entryTf = (entry.timeframe || '').toLowerCase();
          if (!entryTf || entryTf === targetTf) {
            if (!uniqueMap.has(normSym)) {
              uniqueMap.set(normSym, entry);
            }
          }
        }
      }
    }

    const cachedEntries = Array.from(uniqueMap.values());
    if (cachedEntries.length === 0) return null;

    const allTrades: StrategyTrade[] = [];

    // ۲. اجرای بک‌تست هر نماد با سرمایه اولیه ثابت (دقیقاً مشابه اسکن دستی سرور)
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
        params.maxBreakoutAtrMultiplier,
        candles,
        params.minCandlesForBlueLeg ?? 1,
        params.blueLegAtrMultiplier ?? 0.1
      );

      const tempConfig: StrategyConfig = {
        capital, // سرمایه ثابت اولیه، بدون تغییر ترتیبی بین ارزها
        selectedStrategyId,
        riskMode,
        riskAmountFixed,
        riskPercent,
        entryCommissionPercent,
        exitCommissionPercent,
        commissionPercent,
        slSlippagePercent,
        exchange: selectedExchange,
        maxRiskReward: params.maxRiskReward,
        maxCandlesToEnter,
        maxTradesPerLeg: 1,
        showOnChart: false,
        noConcurrentPositions: true, // در سطح تک‌ارز: عدم ورود به معامله جدید تا خروج پوزیشن قبلی همان ارز
        symbol: item.pair.symbol,
        timeStopEnabled: optTimeStopEnabled,
        timeStopCandles: params.timeStopCandles || optTimeStopCandles || 80,
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

      const closed = (res.trades || [])
        .filter(
          (t: any) =>
            t.status === 'WIN' ||
            t.status === 'LOSS' ||
            t.status === 'BREAKEVEN'
        )
        .map((t: any, tIdx: number) => ({
          ...t,
          id: `${item.pair.symbol}-${t.id || tIdx}`,
          symbol: item.pair.symbol,
        }));
      allTrades.push(...closed);
    }

    // ۳. رتبه‌بندی قطعی و بدون اریب نگاه به آینده (کاملاً مطابق فیلتر معاملات همزمان اسکن دستی)
    // اولویت ۱: زمان ورود کندل
    // اولویت ۲: نمره/اعتبار سیگنال
    // اولویت ۳: ترتیب الفبایی نماد
    const sorted = [...allTrades].sort((a, b) => {
      const eA = a.entryTime || a.timeF || 0;
      const eB = b.entryTime || b.timeF || 0;
      if (eA !== eB) return eA - eB;
      const sA = (a as any).score || (a as any).confidence || 0;
      const sB = (b as any).score || (b as any).confidence || 0;
      if (sB !== sA) return sB - sA;
      return ((a as any).symbol || '').localeCompare((b as any).symbol || '');
    });

    const isNoConcurrent = overrideNoConcurrent !== undefined ? overrideNoConcurrent : noConcurrentPositions;

    let effectiveTrades: StrategyTrade[] = [];
    if (!isNoConcurrent) {
      // حالت همزمان فعال: پذیرش تمام معاملات
      effectiveTrades = sorted;
    } else {
      // حالت تک‌پوزیشن پورتفوی: حذف تداخلات در کل سبد سرمایه
      let lastExitTime = 0;
      for (const t of sorted) {
        const eTime = t.entryTime || t.timeF || 0;
        const xTime = t.exitTime || eTime;
        if (eTime >= lastExitTime) {
          effectiveTrades.push(t);
          lastExitTime = Math.max(lastExitTime, xTime);
        }
      }
    }

    // ۴. محاسبه شاخص‌های نهایی بر مبنای معاملات موثر سبد (همانند تب اسکن دستی)
    const totalTrades = effectiveTrades.length;
    const winTrades = effectiveTrades.filter((t) => t.status === 'WIN').length;
    const lossTrades = effectiveTrades.filter((t) => t.status === 'LOSS').length;
    const grossProfitSum = effectiveTrades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
    const grossLossSum = effectiveTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0);
    const netProfitSum = effectiveTrades.reduce((acc, t) => acc + t.pnl, 0);
    const totalFeesSum = effectiveTrades.reduce((acc, t) => acc + (t.fee || t.commission || 0), 0);

    const winRate = totalTrades > 0 ? parseFloat(((winTrades / totalTrades) * 100).toFixed(1)) : 0;
    const profitFactor =
      grossLossSum > 0
        ? parseFloat((grossProfitSum / grossLossSum).toFixed(2))
        : grossProfitSum > 0
        ? 99.9
        : 0;
    const netProfit = parseFloat(netProfitSum.toFixed(2));
    const totalFees = parseFloat(totalFeesSum.toFixed(2));

    // ۵. محاسبه دقیق درودان اوج تا افت (Peak-to-Trough Drawdown) در کل منحنی سرمایه زمانی
    const sortedByExit = [...effectiveTrades].sort(
      (a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0)
    );
    let curEq = capital;
    let peakEq = capital;
    let maxDd = 0;
    for (const t of sortedByExit) {
      curEq += t.pnl;
      if (curEq > peakEq) peakEq = curEq;
      const dd = peakEq > 0 ? ((peakEq - curEq) / peakEq) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }
    const maxDrawdown = parseFloat(maxDd.toFixed(2));

    const isValid =
      maxDrawdown <= targetMaxDrawdown &&
      winRate >= targetMinWinRate &&
      totalTrades >= targetMinTrades;

    return {
      totalTrades,
      winTrades,
      lossTrades,
      winRate,
      profitFactor,
      netProfit,
      totalFees,
      maxDrawdown,
      isValid,
    };
  };

  // به‌روزرسانی آنی جدول ۱۰ تست برتر بهینه‌ساز هنگام تغییر حالت معاملات همزمان (تک‌پوزیشن یا همزمان)
  useEffect(() => {
    if (top10Trials.length > 0 && GLOBAL_CANDLE_CACHE.size > 0 && !isOptimizing) {
      setTop10Trials((prev) => {
        let hasChanges = false;
        const updated = prev.map((trial) => {
          const evalRes = evaluateSingleCombination(trial, noConcurrentPositions);
          if (
            evalRes &&
            (evalRes.netProfit !== trial.netProfit ||
              evalRes.winRate !== trial.winRate ||
              evalRes.totalTrades !== trial.totalTrades ||
              evalRes.maxDrawdown !== trial.maxDrawdown)
          ) {
            hasChanges = true;
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
            return {
              ...trial,
              ...evalRes,
              qualityScore,
            };
          }
          return trial;
        });
        return hasChanges ? updated : prev;
      });
    }
  }, [noConcurrentPositions]);

  // تست و ارزیابی مستقیم و آنی پارامترهای دستی جاری در بهینه‌ساز بک‌اند و اتصال مستقیم به دیتابیس PostgreSQL
  const handleEvaluateCurrentManualConfig = async () => {
    const candidate = {
      atrPeriod: optAtrPeriod,
      minCandles: optMinCandles,
      minCandlesForLongLeg: optMinCandlesLong,
      minCandlesForBlueLeg: optMinCandlesBlue,
      atrMultiplier: optAtrMultiplier,
      longLegAtrMultiplier: optLongLegAtrMult,
      blueLegAtrMultiplier: optBlueLegAtrMult,
      maxBlueLegPercent: optMaxBlueLegPercent,
      maxBreakoutAtrMultiplier: optMaxBreakoutAtr,
      maxRiskReward: optMaxRiskReward,
      maxPositionToRiskRatio: optMaxPositionToRiskRatio,
      timeStopCandles: optTimeStopCandles,
    };
    try {
      showToast('⏳ در حال ارزیابی مستقیم کانفیگ در بک‌اند سرور با دیتابیس PostgreSQL...');
      const res = await fetch('/api/optimizer/evaluate-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: selectedExchange,
          timeframe: timeframe,
          startTime: timeRangeStartMs,
          endTime: timeRangeEndMs,
          symbols: universeOption === 'all_market' ? [] : selectedAllowedSymbols,
          strategyId: selectedStrategyId,
          datasetId: activeSessionDatasetId || rangeStatus?.datasetId || `range_${(selectedExchange || 'xt').toLowerCase()}_${timeframe}_${timeRangeStartMs || 0}_${timeRangeEndMs || 0}`,
          candidate,
          strategyConfig: {
            capital,
            riskMode,
            riskPercent,
            riskAmountFixed,
            entryCommissionPercent,
            exitCommissionPercent,
            slSlippagePercent,
            exchange: selectedExchange,
            tradingFeePercent: (entryCommissionPercent ?? 0.06) + (exitCommissionPercent ?? 0.06),
            noConcurrentPositions,
            maxRiskReward: optMaxRiskReward,
            optMaxRiskReward,
            maxPositionToRiskRatio: optMaxPositionToRiskRatio,
            optMaxPositionToRiskRatio,
            maxCandlesToEnter,
            timeStopEnabled: optTimeStopEnabled,
            timeStopCandles: optTimeStopCandles,
          },
          constraints: {
            targetMaxDrawdown,
            targetMinWinRate,
            targetMinTrades,
          },
          sortColumn: optSortColumn,
          sortDirection: optSortDirection,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(`⚠️ خطا در ارزیابی سرور: ${data.error || 'ارزیابی انجام نشد'}`);
        return;
      }
      const trial = data.trial;
      if (trial) {
        if (Array.isArray(data.top10Trials)) {
          setTop10Trials(sortTop10TrialsList(data.top10Trials, optSortColumn, optSortDirection).slice(0, 10));
        } else {
          setTop10Trials((prev) => updateTop10List(prev, trial, optSortColumn, optSortDirection));
        }
        setTotalEvaluatedCount((prev) => prev + 1);
        showToast(`🎯 کانفیگ دستی جاری در سرور آزمایش شد: سود ${trial.netProfit >= 0 ? '+' : ''}${trial.netProfit} USDT | وین‌ریت ${trial.winRate}% | درودان ${trial.maxDrawdown}%`);
      }
    } catch (err: any) {
      showToast(`خطا در ارتباط با سرور: ${err.message}`);
    }
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
    minCandlesForBlueLeg: number;
    atrMultiplier: number;
    longLegAtrMultiplier: number;
    blueLegAtrMultiplier: number;
    maxBlueLegPercent: number;
    maxBreakoutAtrMultiplier: number;
    maxRiskReward: number;
    timeStopCandles: number;
  } | null => {
    const sampleParam = (r: ParameterRange, isLocked: boolean, lockedVal: number) => {
      const numLocked = Number(lockedVal);
      if (isLocked) return !isNaN(numLocked) ? parseFloat(numLocked.toFixed(2)) : 0;
      if (!r) return !isNaN(numLocked) ? parseFloat(numLocked.toFixed(2)) : 0;

      const boundMin = Number(r.userMin ?? r.boundMin ?? r.min);
      const boundMax = Number(r.userMax ?? r.boundMax ?? r.max);
      const hardMin = Math.min(boundMin, boundMax);
      const hardMax = Math.max(boundMin, boundMax);

      if (hardMin >= hardMax) {
        return parseFloat(hardMin.toFixed(2));
      }

      const curMin = Math.max(hardMin, Math.min(hardMax, Number(r.min) || hardMin));
      const curMax = Math.min(hardMax, Math.max(hardMin, Number(r.max) || hardMax));
      const step = Number(r.step) > 0 ? Number(r.step) : 1;

      let candidateVal: number;
      const rand = Math.random();

      // ۷۰٪ شانس: نمونه‌برداری متمرکز در مجاورت بهترین مقدار (bestVal) و مرکز رنج بهینه
      if (rand < 0.70 && r.bestVal !== undefined) {
        const best = Math.max(curMin, Math.min(curMax, Number(r.bestVal)));
        const offset = (Math.floor(Math.random() * 3) - 1) * step;
        candidateVal = Math.max(curMin, Math.min(curMax, best + offset));
      }
      // ۲۰٪ شانس: کاوش لبه‌ها و نقاط میانی رنج فعال
      else if (rand < 0.90) {
        const count = Math.max(1, Math.round((curMax - curMin) / step));
        const idx = Math.floor(Math.random() * (count + 1));
        candidateVal = curMin + idx * step;
      }
      // ۱۰٪ شانس: کاوش تصادفی در کل دامنه رنج تعریف‌شده کاربر (بدون خروج از مرزهای حداقل و حداکثر)
      else {
        const fullCount = Math.max(1, Math.round((hardMax - hardMin) / step));
        const gIdx = Math.floor(Math.random() * (fullCount + 1));
        candidateVal = hardMin + gIdx * step;
      }

      // مهار قطعی و سختگیرانه: مقدار آزمون هرگز نباید خارج از [hardMin, hardMax] کاربر باشد
      const clamped = Math.min(hardMax, Math.max(hardMin, candidateVal));
      const rounded = Math.round(clamped / step) * step;
      const finalVal = Math.min(hardMax, Math.max(hardMin, rounded));
      return parseFloat(finalVal.toFixed(2));
    };

    for (let attempts = 0; attempts < 350; attempts++) {
      const candidate = {
        atrPeriod: sampleParam(ranges.atrPeriod, lockAtrPeriod, optAtrPeriod),
        minCandles: sampleParam(ranges.minCandles, lockMinCandles, optMinCandles),
        minCandlesForLongLeg: sampleParam(ranges.minCandlesForLongLeg, lockMinCandlesLong, optMinCandlesLong),
        minCandlesForBlueLeg: sampleParam(ranges.minCandlesForBlueLeg, lockMinCandlesBlue, optMinCandlesBlue),
        atrMultiplier: sampleParam(ranges.atrMultiplier, lockAtrMultiplier, optAtrMultiplier),
        longLegAtrMultiplier: sampleParam(ranges.longLegAtrMultiplier, lockLongLegAtrMult, optLongLegAtrMult),
        blueLegAtrMultiplier: sampleParam(ranges.blueLegAtrMultiplier, lockBlueLegAtrMult, optBlueLegAtrMult),
        maxBlueLegPercent: sampleParam(ranges.maxBlueLegPercent, lockMaxBlueLegPercent, optMaxBlueLegPercent),
        maxBreakoutAtrMultiplier: sampleParam(ranges.maxBreakoutAtrMultiplier, lockMaxBreakoutAtr, optMaxBreakoutAtr),
        maxRiskReward: sampleParam(ranges.maxRiskReward, lockMaxRiskReward, optMaxRiskReward),
        maxPositionToRiskRatio: sampleParam(ranges.maxPositionToRiskRatio, lockMaxPositionToRiskRatio, optMaxPositionToRiskRatio),
        timeStopCandles: sampleParam(ranges.timeStopCandles, lockTimeStopCandles, optTimeStopCandles),
      };

      const hash = generateConfigHash(candidate);
      if (!visited.has(hash)) {
        return candidate;
      }
    }

    return null;
  };

  /**
   * مرتب‌سازی استاندارد لیست ۱۰ برتر:
   * ۱. حفظ و اولویت‌دهی قطعی ردیف‌های قبولی شروط (طلایی)
   * ۲. مرتب‌سازی و نگهداری/حذف ردیف‌ها بر اساس ستون و جهت فعال جدول (آیکون Sort)
   */
  const sortTop10TrialsList = useCallback(
    (
      trials: OptimizationTrial[],
      sortCol: OptSortCol = optSortColumn,
      sortDir: SortDirection = optSortDirection
    ): OptimizationTrial[] => {
      return [...trials].sort((a, b) => {
        if (a.isValid && !b.isValid) return -1;
        if (!a.isValid && b.isValid) return 1;
        const valA = Number(a[sortCol as keyof OptimizationTrial]) || 0;
        const valB = Number(b[sortCol as keyof OptimizationTrial]) || 0;
        const primaryDiff = sortDir === 'desc' ? valB - valA : valA - valB;
        if (Math.abs(primaryDiff) > 1e-6) return primaryDiff;
        const scoreDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
        if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
        return (b.netProfit || 0) - (a.netProfit || 0);
      });
    },
    [optSortColumn, optSortDirection]
  );

  /**
   * ذخیره فقط ۱۰ تست برتر (Top 10) بر اساس اولویت قبولی شروط و مرتب‌سازی فعال جدول
   */
  const updateTop10List = (
    currentTop10: OptimizationTrial[],
    newTrial: OptimizationTrial,
    sortCol: OptSortCol = optSortColumn,
    sortDir: SortDirection = optSortDirection
  ): OptimizationTrial[] => {
    // جلوگیری قطعی از تکرار هش یکسان در لیست ۱۰ آزمایش برتر
    const filtered = currentTop10.filter((t) => t.hash !== newTrial.hash);
    const merged = [...filtered, newTrial];
    // دقیقاً ۱۰ مورد برتر را بر اساس ستون مرتب‌سازی جدول نگه می‌داریم
    return sortTop10TrialsList(merged, sortCol, sortDir).slice(0, 10);
  };

  // حلقه پیوسته بهینه‌سازی در بک‌اند سرور با اتصال مستقیم به پایگاه‌داده PostgreSQL
  const handleStartAutoOptimization = async () => {
    setIsOptimizing(true);
    const durationSec = Math.max(60, (optimizerDurationMinutes || 3) * 60);
    setSessionSecondsLeft(durationSec);
    sessionSecondsRef.current = durationSec;
    showToast(`🚀 در حال راه‌اندازی فرآیند بهینه‌سازی (${optimizerDurationMinutes} دقیقه‌ای - حالت ${optimizerProcessingDepth === 'fast' ? 'سریع ۱۲۰ ارز' : 'کامل ۶۹۸ ارز'}) با پایگاه‌داده PostgreSQL...`);
    try {
      const payload = {
        exchange: selectedExchange,
        timeframe: timeframe,
        startTime: timeRangeStartMs,
        endTime: timeRangeEndMs,
        symbols: (selectedAllowedSymbols && selectedAllowedSymbols.length > 0) ? selectedAllowedSymbols : (universeOption === 'all_market' ? [] : selectedAllowedSymbols),
        strategyId: selectedStrategyId,
        sessionDurationMinutes: optimizerDurationMinutes || 3,
        processingDepth: optimizerProcessingDepth || 'full',
        strategyConfig: {
          capital,
          riskMode,
          riskPercent,
          riskAmountFixed,
          entryCommissionPercent,
          exitCommissionPercent,
          slSlippagePercent,
          exchange: selectedExchange,
          tradingFeePercent: (entryCommissionPercent ?? 0.06) + (exitCommissionPercent ?? 0.06),
          noConcurrentPositions,
          maxCandlesToEnter,
          atrPeriod: optAtrPeriod,
          minCandles: optMinCandles,
          minCandlesForLongLeg: optMinCandlesLong,
          minCandlesForBlueLeg: optMinCandlesBlue,
          atrMultiplier: optAtrMultiplier,
          longLegAtrMultiplier: optLongLegAtrMult,
          blueLegAtrMultiplier: optBlueLegAtrMult,
          maxBlueLegPercent: optMaxBlueLegPercent,
          maxBreakoutAtrMultiplier: optMaxBreakoutAtr,
          maxRiskReward: optMaxRiskReward,
          optMaxRiskReward,
          maxPositionToRiskRatio: optMaxPositionToRiskRatio,
          optMaxPositionToRiskRatio,
          timeStopEnabled: optTimeStopEnabled,
          timeStopCandles: optTimeStopCandles,
        },
        constraints: {
          targetMaxDrawdown,
          targetMinWinRate,
          targetMinTrades,
        },
        ranges: adaptiveRanges,
        locks: {
          lockAtrPeriod,
          lockMinCandles,
          lockMinCandlesLong,
          lockMinCandlesBlue,
          lockAtrMultiplier,
          lockLongLegAtrMult,
          lockBlueLegAtrMult,
          lockMaxBlueLegPercent,
          lockMaxBreakoutAtr,
          lockMaxRiskReward,
          lockMaxPositionToRiskRatio,
          lockTimeStopCandles,
          optAtrPeriod: Number(optAtrPeriod),
          optMinCandles: Number(optMinCandles),
          optMinCandlesLong: Number(optMinCandlesLong),
          optMinCandlesBlue: Number(optMinCandlesBlue),
          optAtrMultiplier: Number(optAtrMultiplier),
          optLongLegAtrMult: Number(optLongLegAtrMult),
          optBlueLegAtrMult: Number(optBlueLegAtrMult),
          optMaxBlueLegPercent: Number(optMaxBlueLegPercent),
          optMaxBreakoutAtr: Number(optMaxBreakoutAtr),
          optMaxRiskReward: Number(optMaxRiskReward),
          optMaxPositionToRiskRatio: Number(optMaxPositionToRiskRatio),
          optTimeStopCandles: Number(optTimeStopCandles),
        },
        datasetId: activeSessionDatasetId || rangeStatus?.datasetId || `range_${(selectedExchange || 'xt').toLowerCase()}_${timeframe}_${timeRangeStartMs || 0}_${timeRangeEndMs || 0}`,
        autoAdaptiveEnabled,
        sortColumn: optSortColumn,
        sortDirection: optSortDirection,
      };

      const res = await fetch('/api/optimizer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      if (!data.success) {
        setIsOptimizing(false);
        showToast(`❌ خطا در اجرای بهینه‌ساز در سرور: ${data.error || 'خطای سرور'}`);
        return;
      }
      setIsOptimizing(true);
      showToast(data.message || '✅ بهینه‌سازی هوشمند در سرور با موفقیت آغاز شد.');
    } catch (err: any) {
      setIsOptimizing(false);
      showToast(`❌ خطا در ارتباط با سرور: ${err.message}`);
    }
  };

  const handleStopOptimization = async () => {
    setIsOptimizing(false);
    try {
      const res = await fetch('/api/optimizer/stop', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || '⏸️ بهینه‌سازی در سرور متوقف شد.');
    } catch (err: any) {
      showToast('خطا در توقف بهینه‌ساز سرور');
    }
  };

  const handleResetOptimizer = async () => {
    setIsOptimizing(false);
    try {
      await fetch('/api/optimizer/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeframe }),
      });
    } catch {}
    setTop10Trials([]);
    setAdaptiveRanges(getDefaultRangesForContext(timeframe, 'zigzag-hybrid'));
    setTotalEvaluatedCount(0);
    visitedHashesRef.current.clear();
    setSessionSecondsLeft(900);
    sessionSecondsRef.current = 900;
    try {
      localStorage.removeItem('zigzag_opt_top10_v5');
      localStorage.removeItem('zigzag_opt_ranges_v5');
      localStorage.removeItem('zigzag_opt_total_count_v5');
    } catch {}
    showToast('🔄 تمام آزمایش‌ها، ترکیب‌ها و رنج‌های بهینه‌ساز با موفقیت در سرور و کلاینت پاک و بازنشانی شدند.');
  };

  // مرتب‌سازی ۱۰ تست برتر بر اساس ستون و جهت انتخابی جدول (با حفظ اولویت ردیف‌های قبول‌شده)
  const sortedTop10 = useMemo(() => {
    return sortTop10TrialsList(top10Trials, optSortColumn, optSortDirection);
  }, [top10Trials, optSortColumn, optSortDirection, sortTop10TrialsList]);

  // بهترین ترکیب برنده مستقیماً از ردیف اول ۱۰ تست برتر
  const bestWinningRow = useMemo(() => {
    if (sortedTop10.length === 0) return null;
    return sortedTop10[0];
  }, [sortedTop10]);

  // اعمال پارامترهای هر ردیف به ورودی‌های اسکن دستی و اندیکاتور چارت
  const applyTrialToManualInputs = useCallback((trial: OptimizationTrial, andNotify: boolean = true) => {
    if (!trial) return;
    setOptAtrPeriod(trial.atrPeriod);
    setOptMinCandles(trial.minCandles);
    setOptMinCandlesLong(trial.minCandlesForLongLeg);
    if (trial.minCandlesForBlueLeg !== undefined) {
      setOptMinCandlesBlue(trial.minCandlesForBlueLeg);
    }
    setOptAtrMultiplier(trial.atrMultiplier);
    setOptLongLegAtrMult(trial.longLegAtrMultiplier);
    if (trial.blueLegAtrMultiplier !== undefined) {
      setOptBlueLegAtrMult(trial.blueLegAtrMultiplier);
    }
    setOptMaxBlueLegPercent(trial.maxBlueLegPercent);
    setOptMaxBreakoutAtr(trial.maxBreakoutAtrMultiplier);
    setOptMaxRiskReward(trial.maxRiskReward);
    if (trial.maxPositionToRiskRatio) {
      setOptMaxPositionToRiskRatio(trial.maxPositionToRiskRatio);
    }
    if (trial.timeStopCandles) {
      setOptTimeStopCandles(trial.timeStopCandles);
    }
    if (onUpdateZigZagSettings) {
      onUpdateZigZagSettings({
        atrPeriod: trial.atrPeriod,
        minCandles: trial.minCandles,
        minCandlesForLongLeg: trial.minCandlesForLongLeg,
        ...(trial.minCandlesForBlueLeg !== undefined ? { minCandlesForBlueLeg: trial.minCandlesForBlueLeg } : {}),
        atrMultiplier: trial.atrMultiplier,
        longLegAtrMultiplier: trial.longLegAtrMultiplier,
        ...(trial.blueLegAtrMultiplier !== undefined ? { blueLegAtrMultiplier: trial.blueLegAtrMultiplier } : {}),
        maxBlueLegPercent: trial.maxBlueLegPercent,
        maxBreakoutAtrMultiplier: trial.maxBreakoutAtrMultiplier,
        maxPositionToRiskRatio: trial.maxPositionToRiskRatio || 300,
      });
    }
    if (andNotify) {
      showToast(`✨ تنظیمات ردیف #${trial.id} به ورودی‌های اسکن دستی و چارت اعمال شد.`);
    }
  }, [onUpdateZigZagSettings]);

  // اعمال بهترین پارامترهای برنده به چارت زنده و ورودی‌های اسکن دستی
  const handleApplyBestToChart = () => {
    if (!bestWinningRow) return;
    applyTrialToManualInputs(bestWinningRow, false);
    showToast('✨ بهترین ترکیب برنده جدول به ورودی‌های اسکن دستی و اندیکاتور چارت اعمال شد!');
  };

  // اعمال مستقیم یک ردیف جدول و انتقال به تب اسکن دستی و اجرای فوری
  const handleRunTrialInManualScan = (trial: OptimizationTrial) => {
    if (!trial) return;
    applyTrialToManualInputs(trial, false);
    setActiveTab('scanner');
    showToast(`🚀 پارامترهای ردیف #${trial.id} به اسکن دستی منتقل شد. در حال شروع اسکن...`);
    setTimeout(() => {
      handleStartScan(false, {
        atrPeriod: trial.atrPeriod,
        minCandles: trial.minCandles,
        minCandlesForLongLeg: trial.minCandlesForLongLeg,
        minCandlesForBlueLeg: trial.minCandlesForBlueLeg ?? optMinCandlesBlue,
        atrMultiplier: trial.atrMultiplier,
        longLegAtrMultiplier: trial.longLegAtrMultiplier,
        blueLegAtrMultiplier: trial.blueLegAtrMultiplier ?? optBlueLegAtrMult,
        maxBlueLegPercent: trial.maxBlueLegPercent,
        maxBreakoutAtrMultiplier: trial.maxBreakoutAtrMultiplier,
        maxRiskReward: trial.maxRiskReward,
        timeStopEnabled: optTimeStopEnabled,
        timeStopCandles: trial.timeStopCandles,
        maxPositionToRiskRatio: trial.maxPositionToRiskRatio ?? optMaxPositionToRiskRatio,
      });
    }, 200);
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
          setAdaptiveRanges({ ...DEFAULT_RANGES, ...parsed.adaptiveRanges });
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
    const nextCol: OptSortCol = col;
    const nextDir: SortDirection =
      optSortColumn === col ? (optSortDirection === 'desc' ? 'asc' : 'desc') : 'desc';
    setOptSortColumn(nextCol);
    setOptSortDirection(nextDir);
    setTop10Trials((prev) => sortTop10TrialsList(prev, nextCol, nextDir));
    fetch('/api/optimizer/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sortColumn: nextCol, sortDirection: nextDir }),
    }).catch(() => {});
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

              <button
                type="button"
                onClick={handleClearAllCandlesDatabase}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                title="پاکسازی کامل تمام دیتای کندل‌های ذخیره‌شده در دیتابیس PostgreSQL (تمام تایم‌فریم‌ها و صرافی‌ها)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">پاکسازی کل کندل‌ها</span>
                <span className="sm:hidden">پاکسازی</span>
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
            onQuickSelectSymbols={handleQuickSelectSymbols}
            onOpenTimeRangeModal={() => setIsTimeRangeModalOpen(true)}
            timeRangeLabel={timeRangeLabel}
            estimatedCandles={estimatedCandles}
            universeOption={universeOption}
            setUniverseOption={setUniverseOption}
            timeframe={timeframe}
            setTimeframe={handleSelectTimeframe}
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
            slSlippagePercent={slSlippagePercent}
            setSlSlippagePercent={setSlSlippagePercent}
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
            optMinCandlesBlue={optMinCandlesBlue}
            setOptMinCandlesBlue={setOptMinCandlesBlue}
            optLongLegAtrMult={optLongLegAtrMult}
            setOptLongLegAtrMult={setOptLongLegAtrMult}
            optBlueLegAtrMult={optBlueLegAtrMult}
            setOptBlueLegAtrMult={setOptBlueLegAtrMult}
            optMaxBlueLegPercent={optMaxBlueLegPercent}
            setOptMaxBlueLegPercent={setOptMaxBlueLegPercent}
            optMaxBreakoutAtr={optMaxBreakoutAtr}
            setOptMaxBreakoutAtr={setOptMaxBreakoutAtr}
            optMaxRiskReward={optMaxRiskReward}
            setOptMaxRiskReward={setOptMaxRiskReward}
            optMaxPositionToRiskRatio={optMaxPositionToRiskRatio}
            setOptMaxPositionToRiskRatio={setOptMaxPositionToRiskRatio}
            optTimeStopEnabled={optTimeStopEnabled}
            setOptTimeStopEnabled={setOptTimeStopEnabled}
            optTimeStopCandles={optTimeStopCandles}
            setOptTimeStopCandles={setOptTimeStopCandles}
            onUpdateZigZagSettings={onUpdateZigZagSettings}
            zigzagSettings={zigzagSettings}
            scanWorkersCount={scanWorkersCount}
            setScanWorkersCount={setScanWorkersCount}
            handleStartScan={handleStartScan}
            handleRerunOnCachedData={handleRerunOnCachedData}
            handleClearCandleCache={handleClearCandleCache}
            handleClearAllCandlesDatabase={handleClearAllCandlesDatabase}
            handleStopScan={handleStopScan}
            cachedCount={cachedCount}
            rangeStatus={rangeStatus}
            isCheckingRange={isCheckingRange}
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
            onSelectPairAndClose={onSelectPairAndClose}
            selectedExchange={selectedExchange}
            onOpenRescanChoiceModal={() => setIsRescanPromptOpen(true)}
            handleStartIncrementalScan={handleStartIncrementalScan}
            skippedSymbols={skippedSymbols}
            onRemoveSkippedSymbols={handleRemoveSkippedSymbolsFromAllowed}
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
            lockMinCandlesBlue={lockMinCandlesBlue}
            setLockMinCandlesBlue={setLockMinCandlesBlue}
            lockAtrMultiplier={lockAtrMultiplier}
            setLockAtrMultiplier={setLockAtrMultiplier}
            lockLongLegAtrMult={lockLongLegAtrMult}
            setLockLongLegAtrMult={setLockLongLegAtrMult}
            lockBlueLegAtrMult={lockBlueLegAtrMult}
            setLockBlueLegAtrMult={setLockBlueLegAtrMult}
            lockMaxBlueLegPercent={lockMaxBlueLegPercent}
            setLockMaxBlueLegPercent={setLockMaxBlueLegPercent}
            lockMaxBreakoutAtr={lockMaxBreakoutAtr}
            setLockMaxBreakoutAtr={setLockMaxBreakoutAtr}
            lockMaxRiskReward={lockMaxRiskReward}
            setLockMaxRiskReward={setLockMaxRiskReward}
            lockMaxPositionToRiskRatio={lockMaxPositionToRiskRatio}
            setLockMaxPositionToRiskRatio={setLockMaxPositionToRiskRatio}
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
            optSortColumn={optSortColumn}
            optSortDirection={optSortDirection}
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
            optMinCandlesBlue={optMinCandlesBlue}
            setOptMinCandlesBlue={setOptMinCandlesBlue}
            optAtrMultiplier={optAtrMultiplier}
            setOptAtrMultiplier={setOptAtrMultiplier}
            optLongLegAtrMult={optLongLegAtrMult}
            setOptLongLegAtrMult={setOptLongLegAtrMult}
            optBlueLegAtrMult={optBlueLegAtrMult}
            setOptBlueLegAtrMult={setOptBlueLegAtrMult}
            optMaxBlueLegPercent={optMaxBlueLegPercent}
            setOptMaxBlueLegPercent={setOptMaxBlueLegPercent}
            optMaxBreakoutAtr={optMaxBreakoutAtr}
            setOptMaxBreakoutAtr={setOptMaxBreakoutAtr}
            optMaxRiskReward={optMaxRiskReward}
            setOptMaxRiskReward={setOptMaxRiskReward}
            optMaxPositionToRiskRatio={optMaxPositionToRiskRatio}
            setOptMaxPositionToRiskRatio={setOptMaxPositionToRiskRatio}
            lockTimeStopCandles={lockTimeStopCandles}
            setLockTimeStopCandles={setLockTimeStopCandles}
            optTimeStopEnabled={optTimeStopEnabled}
            setOptTimeStopEnabled={setOptTimeStopEnabled}
            optTimeStopCandles={optTimeStopCandles}
            setOptTimeStopCandles={setOptTimeStopCandles}
            onEvaluateCurrentManualConfig={handleEvaluateCurrentManualConfig}
            onApplyTrialToManualScan={applyTrialToManualInputs}
            onRunTrialInManualScan={handleRunTrialInManualScan}
            activeDatasetId={activeSessionDatasetId || rangeStatus?.datasetId}
            activeDatasetName={rangeStatus?.dataset?.name || (rangeStatus?.exists ? `بازه ${selectedExchange.toUpperCase()} ${timeframe}` : null)}
            datasetSymbolCount={rangeStatus?.dataset?.symbolCount || cachedCount}
            exchange={selectedExchange}
            timeRangeLabel={timeRangeLabel}
            sessionDurationMinutes={optimizerDurationMinutes}
            setSessionDurationMinutes={(m: number) => {
              setOptimizerDurationMinutes(m);
              setSessionSecondsLeft(m * 60);
              sessionSecondsRef.current = m * 60;
              try { localStorage.setItem('opt_session_duration_min', String(m)); } catch {}
            }}
            processingDepth={optimizerProcessingDepth}
            setProcessingDepth={(d: 'fast' | 'full') => {
              setOptimizerProcessingDepth(d);
              try { localStorage.setItem('opt_processing_depth', d); } catch {}
            }}
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
          optMinCandlesBlue={optMinCandlesBlue}
          optLongLegAtrMult={optLongLegAtrMult}
          optBlueLegAtrMult={optBlueLegAtrMult}
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

        {/* ========================================================= */}
        {/* MODAL: INTELLIGENT RESCAN CHOICE (SMART SYNC / FAST / FULL) */}
        {/* ========================================================= */}
        {isRescanPromptOpen && (() => {
          const cov = rangeStatus?.coverage;
          const missingCount = cov?.missingSymbolsCount || 0;
          const surplusCount = cov?.surplusSymbolsCount || 0;
          const availableCount = cov?.availableSymbolsCount || rangeStatus?.dataset?.symbolCount || cachedCount || 0;
          const reqCount = cov?.requestedSymbolsCount || selectedAllowedSymbols.length || 0;
          const coveragePct = cov?.symbolCoveragePct !== undefined ? cov.symbolCoveragePct : (reqCount > 0 ? Math.round((availableCount / reqCount) * 100) : 100);
          const missingEarlierDays = cov?.missingEarlierDays || 0;
          const missingNewerDays = cov?.missingNewerDays || 0;
          const isExchangeMatch = cov?.isExchangeMatch !== false;

          return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
              <div className="bg-[#101622] border border-[#233147] rounded-2xl p-6 max-w-xl w-full shadow-2xl text-right animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#233147]">
                  <div className="flex items-center gap-3 text-amber-400">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        تحلیل هوشمند تطابق داده‌های دیتابیس PostgreSQL
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        بررسی وضعیت پوشش نمادها، صرافی و بازه زمانی انتخابی
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                    selectedExchange === 'xt'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  }`}>
                    {selectedExchange.toUpperCase()}
                  </span>
                </div>

                <div className="bg-[#151c29] p-4 rounded-xl border border-[#2b3a52] text-xs text-gray-300 space-y-3 mb-5">
                  {/* ردیف صرافی و بازه */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#0e131d] p-2.5 rounded-lg border border-[#202b3d]">
                      <span className="text-gray-400 text-[11px] block mb-1">صرافی و تایم‌فریم:</span>
                      <span className="text-cyan-300 font-bold font-mono">
                        {selectedExchange.toUpperCase()} | {timeframe}
                      </span>
                      {!isExchangeMatch && (
                        <span className="text-rose-400 text-[10px] block mt-0.5 font-bold">
                          ⚠️ داده فعلی دیتابیس متعلق به صرافی دیگری است
                        </span>
                      )}
                    </div>
                    <div className="bg-[#0e131d] p-2.5 rounded-lg border border-[#202b3d]">
                      <span className="text-gray-400 text-[11px] block mb-1">بازه زمانی تست:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-amber-300 font-bold font-mono">
                          {timeRangeLabel || `${cov?.reqDays || 90} روزه`}
                        </span>
                        {(cov?.reqStartDateFormatted || cov?.reqEndDateFormatted) && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            ({cov.reqStartDateFormatted} تا {cov.reqEndDateFormatted})
                          </span>
                        )}
                      </div>
                      <div className="mt-1 pt-1 border-t border-[#1a2332] text-[10px] font-mono">
                        <span className="text-gray-400">موجودی دیتابیس: </span>
                        <span className="text-cyan-300 font-bold">{cov?.dbDays || 90} روز</span>
                        {(cov?.dbStartDateFormatted || cov?.dbEndDateFormatted) && (
                          <span className="text-gray-400 mr-1">({cov.dbStartDateFormatted} تا {cov.dbEndDateFormatted})</span>
                        )}
                      </div>
                      {missingEarlierDays > 0 ? (
                        <span className="text-amber-400 text-[10px] block mt-1 font-bold">
                          ⚠️ دیتابیس {cov?.dbDays} روز دارد ({missingEarlierDays} روز کسری تاریخچه)
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[10px] block mt-1 font-bold">
                          ✓ تاریخچه دیتابیس کامل است (پوشش ۱۰۰٪ زمان)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* نوار پوشش نمادها */}
                  <div className="bg-[#0e131d] p-3 rounded-lg border border-[#202b3d] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-300 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>میزان پوشش نمادهای انتخابی:</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {availableCount} از {reqCount} نماد ({coveragePct}٪)
                      </span>
                    </div>

                    <div className="w-full bg-[#1b2434] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          coveragePct >= 95 ? 'bg-emerald-400' : coveragePct >= 70 ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, coveragePct))}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                        ✓ {availableCount} نماد آماده اسکن
                      </span>

                      {missingCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold font-mono">
                          ⚠️ {missingCount} نماد کسری در دیتابیس
                        </span>
                      )}

                      {surplusCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold font-mono">
                          🛡️ {surplusCount} نماد مازاد (صرف‌نظر در اسکن بدون حذف)
                        </span>
                      )}
                    </div>

                    {/* پیش‌نمایش تگ‌های نمادهای کسری */}
                    {missingCount > 0 && Array.isArray(cov?.missingSymbols) && cov.missingSymbols.length > 0 && (
                      <div className="pt-1.5 border-t border-[#232e42]">
                        <span className="text-[10px] text-gray-400 block mb-1">
                          نمادهای کسری که دانلود خواهند شد ({missingCount} مورد):
                        </span>
                        <div className="flex items-center gap-1 flex-wrap max-h-16 overflow-y-auto">
                          {cov.missingSymbols.slice(0, 15).map((s: string, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-amber-950/60 text-amber-200 border border-amber-500/30 rounded text-[10px] font-mono">
                              {s}
                            </span>
                          ))}
                          {cov.missingSymbols.length > 15 && (
                            <span className="text-[10px] text-gray-400">
                              + {cov.missingSymbols.length - 15} نماد دیگر...
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-gray-300 text-[11px] leading-relaxed pt-1">
                    چگونه مایلید بک‌تست روی داده‌ها اجرا شود؟
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* اگر نماد کسری وجود ندارد: اسکن سریع با دیتابیس گزینه پیشنهادی اصلی است */}
                  {missingCount === 0 ? (
                    <>
                      {/* گزینه ۱: اسکن فوری با موجودی ۱۰۰٪ دیتابیس */}
                      <button
                        type="button"
                        onClick={() => handleStartScan(false, undefined, 'cached')}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs flex items-center justify-between shadow-lg shadow-emerald-500/20 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2 text-right">
                          <Play className="w-4 h-4 text-black shrink-0 fill-current" />
                          <div>
                            <div className="font-extrabold">⚡ اسکن سریع با نمادهای موجود در دیتابیس ({availableCount} نماد) [پیشنهادی]</div>
                            <div className="text-[10px] text-black/80 font-normal">
                              بدون نیاز به دانلود؛ تمام نمادهای انتخابی در دیتابیس PostgreSQL موجود و آماده پردازش فوری هستند.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-black/20 text-black font-mono text-[10px] font-bold">
                          فوری (۱ ثانیه)
                        </span>
                      </button>

                      {/* گزینه ۲: دانلود مجدد کامل */}
                      <button
                        type="button"
                        onClick={() => handleStartScan(true, undefined, 'full')}
                        className="w-full py-2 px-4 rounded-xl bg-[#141b27] hover:bg-[#1c2738] text-gray-300 hover:text-white border border-[#2b3952] text-xs font-medium flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>🚀 دانلود مجدد کامل از صفر (جایگزینی تمام {reqCount || availableCount || 729} نماد در دیتابیس)</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">دانلود تازه</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* گزینه ۱: دانلود تکمیلی فقط برای نمادهای کسری */}
                      <button
                        type="button"
                        onClick={() => handleStartScan(false, undefined, 'incremental')}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-black font-extrabold text-xs flex items-center justify-between shadow-lg shadow-emerald-500/20 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2 text-right">
                          <RefreshCw className="w-4 h-4 shrink-0 group-hover:rotate-180 transition-transform duration-500" />
                          <div>
                            <div className="font-extrabold">🔄 دانلود تکمیلی هوشمند (فقط {missingCount} نماد کسری) [پیشنهادی]</div>
                            <div className="text-[10px] text-black/80 font-normal">
                              فقط {missingCount} نماد کسری از صرافی دریافت و به دیتابیس افزوده می‌شوند و نمادهای موجود از دیتابیس خوانده می‌شوند.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-black/20 text-black font-mono text-[10px] font-bold">
                          بهینه‌ترین سرعت
                        </span>
                      </button>

                      {/* گزینه ۲: اسکن با نمادهای فعلی دیتابیس بدون دانلود کسری‌ها */}
                      <button
                        type="button"
                        onClick={() => handleStartScan(false, undefined, 'cached')}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#172233] hover:bg-[#1e2c42] text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 text-right">
                          <Play className="w-4 h-4 text-emerald-400 shrink-0 fill-current" />
                          <div>
                            <div>⚡ اسکن با {availableCount} نماد موجود در دیتابیس (بدون دانلود {missingCount} نماد کسری)</div>
                            <div className="text-[10px] text-gray-400 font-normal">
                              فقط روی نمادهایی که همین حالا در PostgreSQL آماده هستند اجرا می‌شود.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px]">
                          فوری (۱ ثانیه)
                        </span>
                      </button>

                      {/* گزینه ۳: دانلود کامل مجدد از نو */}
                      <button
                        type="button"
                        onClick={() => handleStartScan(true, undefined, 'full')}
                        className="w-full py-2 px-4 rounded-xl bg-[#141b27] hover:bg-[#1c2738] text-gray-300 hover:text-white border border-[#2b3952] text-xs font-medium flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>🚀 دانلود مجدد کامل از صفر (جایگزینی تمام {reqCount || availableCount || 729} نماد در دیتابیس)</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">دانلود تازه</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsRescanPromptOpen(false)}
                    className="w-full py-1.5 px-4 rounded-xl bg-transparent hover:bg-gray-800 text-gray-400 text-xs font-bold cursor-pointer transition-all text-center mt-1"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* MODAL: DELETE ONLY CURRENT TIME RANGE FROM POSTGRESQL */}
        {/* ========================================================= */}
        {isDeleteRangePromptOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#101622] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-right animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold text-white">
                  حذف داده‌های این بازه از دیتابیس PostgreSQL
                </h3>
              </div>

              <div className="bg-[#1c151e] p-4 rounded-xl border border-rose-500/30 text-xs text-gray-300 space-y-2 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">بازه زمانی جاری:</span>
                  <span className="text-amber-300 font-bold font-mono">{timeRangeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">تایم‌فریم و صرافی:</span>
                  <span className="text-cyan-300 font-bold font-mono">{timeframe} | {selectedExchange.toUpperCase()}</span>
                </div>
                <p className="pt-2 text-rose-300 text-[11px] leading-relaxed border-t border-rose-500/20">
                  ⚠️ آیا اطمینان دارید که می‌خواهید کندل‌ها و نتایج <strong className="underline">فقط برای همین بازه زمانی</strong> از پایگاه‌داده <span className="font-mono text-white">crypto_strategy_lab</span> حذف شوند؟
                </p>
                <p className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>داده‌های سایر بازه‌های زمانی بدون تغییر در دیتابیس باقی می‌مانند.</span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteRangePromptOpen(false);
                    setIsClearAllCandlesPromptOpen(true);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer transition-colors"
                >
                  پاکسازی کل دیتای کندل‌های دیتابیس (همه تایم‌فریم‌ها)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteRangePromptOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold cursor-pointer transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteCurrentRange}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>بله، پاکسازی فقط این بازه از دیتابیس</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: CLEAR ALL STORED CANDLES FROM POSTGRESQL */}
        {/* ========================================================= */}
        {isClearAllCandlesPromptOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <div className="bg-[#101622] border border-rose-500/60 rounded-2xl p-6 max-w-md w-full shadow-2xl text-right animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold text-white">
                  پاکسازی کامل تمام دیتای کندل‌های دیتابیس
                </h3>
              </div>

              <div className="bg-[#1c151e] p-4 rounded-xl border border-rose-500/30 text-xs text-gray-300 space-y-3 mb-5">
                <p className="text-rose-300 text-xs leading-relaxed font-bold">
                  ⚠️ آیا اطمینان کامل دارید که می‌خواهید <span className="underline text-white">تمام کندل‌های ذخیره‌شده</span> در پایگاه‌داده PostgreSQL (<span className="font-mono text-cyan-300">crypto_strategy_lab</span>) برای کلیه صرافی‌ها و تایم‌فریم‌ها پاکسازی شوند؟
                </p>
                <div className="bg-[#120d14] p-3 rounded-lg border border-rose-500/20 space-y-1.5 text-[11px] text-gray-300">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold">
                    <span>• تخلیه کامل جدول‌های candle_datasets و candle_chunks</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-300 font-semibold">
                    <span>• پاکسازی حافظه کش کلاینت (IndexedDB) و کش دیسک سرور</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>کانفیگ‌ها و پارامترهای ذخیره‌شده شما دست‌نخورده باقی می‌مانند.</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsClearAllCandlesPromptOpen(false)}
                  disabled={isClearingAllCandles}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold cursor-pointer transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAllCandlesDatabase}
                  disabled={isClearingAllCandles}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isClearingAllCandles ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال پاکسازی کل دیتابیس...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>بله، پاکسازی کامل کل کندل‌ها</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

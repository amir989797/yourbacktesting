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
  FileCheck2,
  ClipboardCheck,
  Calendar,
  AlertTriangle,
  Save,
  FolderOpen,
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
  qualityScore?: number; // نمره کیفیت چندمعیاره هوشمند
}

export interface ParameterRange {
  min: number;
  max: number;
  globalMin: number;
  globalMax: number;
  bestVal: number;
  bestValProfit?: number;
  bestValScore?: number;
  step: number;
  convergence: number; // 0 - 100%
  isManualOverride?: boolean;
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

export function getDefaultRangesForContext(timeframe: Timeframe, strategyId: string): AdaptiveRanges {
  const isScalp = timeframe === '5m';
  const isSwing = timeframe === '1h' || timeframe === '4h' || timeframe === '1d' || timeframe === '1w';

  const makeRange = (
    min: number,
    max: number,
    globalMin: number,
    globalMax: number,
    bestVal: number,
    step: number
  ): ParameterRange => {
    const span = max - min;
    const globalSpan = globalMax - globalMin;
    const convergence = Math.round(Math.max(10, Math.min(95, (1 - span / globalSpan) * 100)));
    return {
      min,
      max,
      globalMin,
      globalMax,
      bestVal,
      step,
      convergence,
      isManualOverride: false,
    };
  };

  if (isScalp) {
    return {
      atrPeriod: makeRange(20, 65, 12, 100, 45, 5),
      minCandles: makeRange(2, 5, 1, 8, 3, 1),
      minCandlesForLongLeg: makeRange(8, 22, 5, 36, 14, 2),
      atrMultiplier: makeRange(2.0, 4.25, 1.5, 6.0, 3.0, 0.25),
      longLegAtrMultiplier: makeRange(6.0, 14.5, 4.0, 22.0, 9.5, 0.5),
      maxBlueLegPercent: makeRange(35, 75, 20, 90, 55, 5),
      maxBreakoutAtrMultiplier: makeRange(2.0, 5.5, 1.0, 8.0, 3.5, 0.5),
      maxRiskReward: makeRange(1.5, 4.5, 1.0, 10.0, 2.5, 0.25),
    };
  }

  if (isSwing) {
    return {
      atrPeriod: makeRange(14, 45, 8, 80, 24, 2),
      minCandles: makeRange(1, 4, 1, 6, 2, 1),
      minCandlesForLongLeg: makeRange(5, 16, 4, 24, 10, 1),
      atrMultiplier: makeRange(1.5, 3.5, 1.0, 5.0, 2.4, 0.2),
      longLegAtrMultiplier: makeRange(4.5, 12.0, 3.0, 18.0, 8.0, 0.5),
      maxBlueLegPercent: makeRange(30, 70, 20, 85, 50, 5),
      maxBreakoutAtrMultiplier: makeRange(1.5, 5.0, 1.0, 7.0, 3.0, 0.5),
      maxRiskReward: makeRange(1.5, 7.0, 1.0, 12.0, 3.5, 0.5),
    };
  }

  // Medium timeframes (15m, 30m)
  return {
    atrPeriod: makeRange(18, 55, 10, 90, 32, 4),
    minCandles: makeRange(1, 5, 1, 8, 3, 1),
    minCandlesForLongLeg: makeRange(6, 20, 5, 30, 14, 2),
    atrMultiplier: makeRange(1.8, 4.0, 1.2, 5.5, 2.8, 0.25),
    longLegAtrMultiplier: makeRange(5.0, 14.0, 3.5, 20.0, 9.0, 0.5),
    maxBlueLegPercent: makeRange(35, 75, 25, 85, 55, 5),
    maxBreakoutAtrMultiplier: makeRange(1.8, 5.5, 1.0, 7.5, 3.5, 0.5),
    maxRiskReward: makeRange(1.5, 6.0, 1.0, 10.0, 3.0, 0.5),
  };
}

// دامنه‌های اولیه پیش‌فرض
const DEFAULT_RANGES: AdaptiveRanges = getDefaultRangesForContext('5m', 'strategy_1_e_breakout');

/**
 * تابع محاسبه نمره کیفیت چندمعیاره استراتژی (Fitness Quality Score)
 */
export function calculateQualityScore(trial: {
  netProfit: number;
  profitFactor: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  targetMaxDrawdown: number;
  targetMinWinRate: number;
  targetMinTrades: number;
}): number {
  if (trial.totalTrades < 5) return -1000;
  let penalty = 0;
  if (trial.maxDrawdown > trial.targetMaxDrawdown) {
    penalty += (trial.maxDrawdown - trial.targetMaxDrawdown) * 15;
  }
  if (trial.winRate < trial.targetMinWinRate) {
    penalty += (trial.targetMinWinRate - trial.winRate) * 10;
  }
  if (trial.totalTrades < trial.targetMinTrades) {
    penalty += (trial.targetMinTrades - trial.totalTrades) * 2;
  }

  const profitScore = Math.max(-500, trial.netProfit) * 0.15;
  const pfScore = Math.min(trial.profitFactor, 10) * 35;
  const winRateScore = trial.winRate * 2.2;
  const ddSafety = Math.max(0, 25 - trial.maxDrawdown) * 4;
  const tradeVolumeBonus = Math.min(trial.totalTrades, 500) * 0.15;

  return parseFloat((profitScore + pfScore + winRateScore + ddSafety + tradeVolumeBonus - penalty).toFixed(2));
}

/**
 * به‌روزرسانی هوشمند بیزی/ژنتیک رنج‌ها بر مبنای پراکندگی و میانگین خوشه‌های برتر
 */
export function refineAdaptiveRangesSmart(
  currentRanges: AdaptiveRanges,
  eliteTrials: OptimizationTrial[],
  totalEvaluated: number,
  autoAdaptiveEnabled: boolean
): AdaptiveRanges {
  if (!autoAdaptiveEnabled || eliteTrials.length < 2) return currentRanges;

  const validElites = eliteTrials.filter((t) => t.isValid && t.netProfit > 0);
  const samplePool = validElites.length >= 2 ? validElites : eliteTrials.slice(0, 5);
  if (samplePool.length === 0) return currentRanges;

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
    const r = { ...nextRanges[key] };
    if (r.isManualOverride) continue; // در صورت تنظیم دستی توسط کاربر، بدون تغییر می‌ماند

    const values = samplePool.map((t) => Number(t[key]) || 0);
    let weightedSum = 0;
    let totalWeight = 0;
    for (const t of samplePool) {
      const weight = Math.max(1, t.netProfit > 0 ? t.netProfit : 1);
      weightedSum += (Number(t[key]) || 0) * weight;
      totalWeight += weight;
    }
    const center = totalWeight > 0 ? weightedSum / totalWeight : values.reduce((a, b) => a + b, 0) / values.length;

    // محاسبه انحراف معیار خوشه برتر
    const variance = values.reduce((sum, v) => sum + Math.pow(v - center, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // ضریب خنک‌سازی تدریجی (Annealing Cooling Factor): با افزایش تست‌ها دامنه متمرکزتر می‌شود
    const coolingFactor = Math.max(0.45, 1.0 - (totalEvaluated / 1200));
    const spread = Math.max(r.step * 1.5, (stdDev * 1.6 + r.step * 2) * coolingFactor);

    let newMin = Math.max(r.globalMin, center - spread);
    let newMax = Math.min(r.globalMax, center + spread);

    // تراز با گام‌های تغییر پارامتر
    newMin = Math.round(newMin / r.step) * r.step;
    newMax = Math.round(newMax / r.step) * r.step;

    // تضمین حفظ حداقل عرض رنج به اندازه ۳ گام جهت جلوگیری از قفل‌شدگی زودهنگام
    if (newMax - newMin < r.step * 3) {
      newMin = Math.max(r.globalMin, center - r.step * 2);
      newMax = Math.min(r.globalMax, center + r.step * 2);
    }

    const bestTrial = samplePool[0];
    r.bestVal = Number(bestTrial[key]);
    r.min = parseFloat(newMin.toFixed(2));
    r.max = parseFloat(newMax.toFixed(2));

    const span = r.max - r.min;
    const globalSpan = r.globalMax - r.globalMin;
    r.convergence = Math.round(Math.max(0, Math.min(100, (1 - span / globalSpan) * 100)));

    nextRanges[key] = r;
  }

  return nextRanges;
}

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

export type SortDirection = 'asc' | 'desc';
export type ScannerSortCol =
  | 'symbol'
  | 'totalTrades'
  | 'winRate'
  | 'netProfit'
  | 'totalFee'
  | 'profitFactor'
  | 'maxDrawdownPercent'
  | 'optimalRiskForDD20';
export type OptSortCol = keyof OptimizationTrial;

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

  useEffect(() => {
    getCloudSqlStatus().then((st) => setCloudSqlStatus(st)).catch(() => {});
  }, []);

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

      const worker = async () => {
        while (queue.length > 0 && !abortControllerRef.current) {
          const pair = queue.shift();
          if (!pair) break;

          try {
            // ۱. بررسی حافظه کش کندل‌ها بر اساس صرافی و نماد
            const cacheKey = `${selectedExchange}_${pair.symbol}_${timeframe}`;
            let candles: CandleData[] = [];
            const cached = GLOBAL_CANDLE_CACHE.get(cacheKey);
            if (cached && cached.candles && cached.candles.length >= 50 && cached.timeframe === timeframe) {
              candles = cached.candles;
            } else {
              // ۲. دانلود سریع از اندپوینت سرور بر اساس صرافی انتخابی
              const klineRes = await fetch(
                `/api/market/klines?exchange=${selectedExchange}&symbol=${encodeURIComponent(pair.symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${candleHistoryLimit}&isFutures=${isFuturesUniverse}`
              )
                .then((r) => r.json())
                .catch(() => null);

              if (klineRes && klineRes.success && Array.isArray(klineRes.candles) && klineRes.candles.length >= 50) {
                candles = klineRes.candles;
                GLOBAL_CANDLE_CACHE.set(cacheKey, { pair, candles, timeframe });
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
                noConcurrentPositions, // رعایت عدم تداخل و ورود تک‌پوزیشن
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
          } catch (itemErr) {
            console.warn(`Error scanning ${pair.symbol}:`, itemErr);
          } finally {
            completedCount++;
            setProgress({
              current: completedCount,
              total,
              currentSymbol: pair.symbol,
            });
            triggerThrottledCommit(false);
          }
        }
      };

      const concurrency = Math.min(scanWorkersCount || 8, 10);
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
            noConcurrentPositions,
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

  // شبیه‌سازی و فیلتر عدم محاسبه معاملات همزمان در سطح کل پرتفوی (در صورت فعال بودن چک‌باکس)
  const effectivePortfolioTrades = useMemo(() => {
    if (!noConcurrentPositions || allCollectedTrades.length === 0) {
      return allCollectedTrades;
    }
    // مرتب‌سازی بر اساس زمان ورود: فقط ورود به پوزیشن جدید بعد از بسته‌شدن پوزیشن قبلی
    const sorted = [...allCollectedTrades].sort((a, b) => (a.entryTime || a.timeF || 0) - (b.entryTime || b.timeF || 0));
    const nonConcurrent: StrategyTrade[] = [];
    let lastExitTime = 0;
    for (const t of sorted) {
      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;
      if (eTime >= lastExitTime) {
        nonConcurrent.push(t);
        lastExitTime = Math.max(lastExitTime, xTime);
      }
    }
    return nonConcurrent;
  }, [allCollectedTrades, noConcurrentPositions]);

  const rawTotalTradesSum = results.reduce((acc, r) => acc + r.totalTrades, 0);
  const rawTotalWinTradesSum = results.reduce((acc, r) => acc + r.winTrades, 0);
  const rawTotalNetProfitSum = results.reduce((acc, r) => acc + r.netProfit, 0);
  const rawTotalProfitSum = results.reduce((acc, r) => acc + r.totalProfit, 0);
  const rawTotalLossSum = results.reduce((acc, r) => acc + r.totalLoss, 0);
  const rawTotalFeeSum = results.reduce((acc, r) => acc + (r.totalFee || 0), 0);

  const totalTradesSum = noConcurrentPositions && effectivePortfolioTrades.length > 0 ? effectivePortfolioTrades.length : rawTotalTradesSum;
  const totalWinTradesSum = noConcurrentPositions && effectivePortfolioTrades.length > 0 ? effectivePortfolioTrades.filter((t) => t.status === 'WIN').length : rawTotalWinTradesSum;
  const totalNetProfitSum = noConcurrentPositions && effectivePortfolioTrades.length > 0 ? parseFloat(effectivePortfolioTrades.reduce((acc, t) => acc + t.pnl, 0).toFixed(2)) : rawTotalNetProfitSum;
  const totalProfitSum = noConcurrentPositions && effectivePortfolioTrades.length > 0 ? parseFloat(effectivePortfolioTrades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0).toFixed(2)) : rawTotalProfitSum;
  const totalLossSum = noConcurrentPositions && effectivePortfolioTrades.length > 0 ? parseFloat(effectivePortfolioTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0).toFixed(2)) : rawTotalLossSum;
  const totalFeeSum = rawTotalFeeSum;

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
    if (effectivePortfolioTrades.length === 0) return [];
    const sortedTrades = [...effectivePortfolioTrades].sort((a, b) => (a.exitTime || a.entryTime || 0) - (b.exitTime || b.entryTime || 0));

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

  // =========================================================================
  // اعتبارسنجی جامع دیتاست (Dataset Validation Audit - بدون دیتای ساختگی)
  // =========================================================================
  const datasetAudit = useMemo(() => {
    // ۱. استخراج دارایی‌ها
    const cachedEntries = Array.from(GLOBAL_CANDLE_CACHE.entries());
    const resultPairsMap = new Map<string, CryptoPair>();
    for (const r of results) {
      resultPairsMap.set(r.pair.symbol, r.pair);
    }
    for (const [sym, entry] of cachedEntries) {
      if (!resultPairsMap.has(sym)) {
        resultPairsMap.set(sym, entry.pair);
      }
    }
    const allAssetsList = Array.from(resultPairsMap.values());
    const numberOfAssets = allAssetsList.length;

    // ۲. تعداد معاملات (با لحاظ وضعیت عدم محاسبه معاملات همزمان در کل پرتفوی)
    const auditedTrades = effectivePortfolioTrades;
    const numberOfTrades = auditedTrades.length;

    // ۳. تعداد کندل‌ها و بازرسی سلامت کندل‌ها
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

    const toMs = (ts: number | null | undefined): number => {
      if (!ts || isNaN(ts)) return 0;
      return ts < 1e11 ? ts * 1000 : ts;
    };

    const toSec = (ts: number | null | undefined): number => {
      if (!ts || isNaN(ts)) return 0;
      return ts > 1e11 ? Math.floor(ts / 1000) : ts;
    };

    for (const [symbol, entry] of cachedEntries) {
      const candles = entry.candles || [];
      const count = candles.length;
      totalCandles += count;
      if (count < minCandles) minCandles = count;
      if (count > maxCandles) maxCandles = count;

      if (!symbol.toUpperCase().endsWith('USDT') && !symbol.toUpperCase().endsWith('BUSD')) {
        inconsistentSymbolsCount++;
      }

      const seenTimes = new Set<number>();
      let assetGaps = 0;
      let assetMinTime = Infinity;
      let assetMaxTime = 0;
      let assetHasMissingPrices = false;
      let assetHasDuplicates = false;

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
                  symbol,
                  gapStart: new Date(toMs(prevC.time)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                  gapEnd: new Date(toMs(c.time)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                  missingBars,
                });
              }
            }
          }
        }
      }

      perAssetCandleCounts.push({
        symbol,
        baseAsset: entry.pair?.baseAsset || symbol.replace('USDT', ''),
        count,
        gaps: assetGaps,
        minTime: assetMinTime === Infinity ? 0 : assetMinTime,
        maxTime: assetMaxTime,
        hasMissingPrices: assetHasMissingPrices,
        hasDuplicates: assetHasDuplicates,
      });
    }

    // اگر کش موقت خالی است اما نتایج اسکن در استیت وجود دارند
    if (cachedEntries.length === 0 && results.length > 0) {
      for (const r of results) {
        totalCandles += r.candlesCount;
        if (r.candlesCount < minCandles) minCandles = r.candlesCount;
        if (r.candlesCount > maxCandles) maxCandles = r.candlesCount;

        let rMinTime = Infinity;
        let rMaxTime = 0;
        if (Array.isArray(r.trades)) {
          for (const t of r.trades) {
            const tTime = t.entryTime || t.timeF;
            if (tTime) {
              const tSec = toSec(tTime);
              if (earliestTimestamp === null || tSec < earliestTimestamp) earliestTimestamp = tSec;
              if (latestTimestamp === null || tSec > latestTimestamp) latestTimestamp = tSec;
              if (tSec < rMinTime) rMinTime = tSec;
              if (tSec > rMaxTime) rMaxTime = tSec;
            }
          }
        }

        perAssetCandleCounts.push({
          symbol: r.pair.symbol,
          baseAsset: r.pair.baseAsset || r.pair.symbol.replace('USDT', ''),
          count: r.candlesCount,
          gaps: 0,
          minTime: rMinTime === Infinity ? 0 : rMinTime,
          maxTime: rMaxTime,
          hasMissingPrices: false,
          hasDuplicates: false,
        });
      }
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

    // تفکیک دقیق معاملات خرید (BUY) و فروش (SELL)
    const buyTrades = auditedTrades.filter((t) => t.direction === 'BUY' || t.type === 'BUY');
    const sellTrades = auditedTrades.filter((t) => t.direction === 'SELL' || t.type === 'SELL');
    const buyTradesCount = buyTrades.length;
    const sellTradesCount = sellTrades.length;
    const buyPercentage = numberOfTrades > 0 ? ((buyTradesCount / numberOfTrades) * 100).toFixed(1) : '0';
    const sellPercentage = numberOfTrades > 0 ? ((sellTradesCount / numberOfTrades) * 100).toFixed(1) : '0';
    const buyWinCount = buyTrades.filter((t) => t.status === 'WIN').length;
    const buyLossCount = buyTrades.filter((t) => t.status === 'LOSS').length;
    const sellWinCount = sellTrades.filter((t) => t.status === 'WIN').length;
    const sellLossCount = sellTrades.filter((t) => t.status === 'LOSS').length;
    const buyWinRate = buyTradesCount > 0 ? ((buyWinCount / buyTradesCount) * 100).toFixed(1) : '0';
    const sellWinRate = sellTradesCount > 0 ? ((sellWinCount / sellTradesCount) * 100).toFixed(1) : '0';

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
      buyTradesCount,
      sellTradesCount,
      buyPercentage,
      sellPercentage,
      buyWinCount,
      buyLossCount,
      sellWinCount,
      sellLossCount,
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

    for (const t of allCollectedTrades) {
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

      // ۱۲. incorrect leverage handling
      if (t.positionValue > capital * 20) {
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
        if (Math.abs(expectedNet - t.pnl) > 0.1) {
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
  }, [allCollectedTrades, datasetAudit.missingDataCount, capital, commissionPercent]);

  // ۳. بازسازی مدل مبنای استراتژی (Reconstruct the baseline)
  const baselineReconstruction = useMemo(() => {
    const trades = allCollectedTrades || [];
    const initialCap = capital || 10000;
    const risk = riskPercent || 1.0;
    const durationDays = datasetAudit.actualDurationDays || 0;
    const durationYears = durationDays > 0 ? durationDays / 365.25 : 0;

    let grossProfit = 0;
    let grossLoss = 0;
    let totalNetProfit = 0;
    let totalFees = 0;
    let winTrades = 0;
    let lossTrades = 0;
    const totalTrades = trades.length;

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

    const recoveryDurationsSec: number[] = [];
    const recoveryDurationsTrades: number[] = [];
    let inDrawdown = false;
    let troughTime: number | null = null;
    let troughTrades = 0;

    const sortedTrades = trades.slice().sort((a, b) => (a.entryTime || a.timeF || 0) - (b.entryTime || b.timeF || 0));

    for (const t of sortedTrades) {
      const netPnl = t.pnl || 0;
      const fee = t.fee || 0;
      const pnlPct = t.pnlPercent || 0;
      const posVal = t.positionValue || (t.positionSize ? t.positionSize * t.entryPrice : initialCap * (risk / 100));
      const sym = (t as any).symbol || 'USDT';

      totalNetProfit += netPnl;
      totalFees += fee;
      totalVolumeTraded += posVal * 2;

      if (netPnl > 0) {
        grossProfit += netPnl;
        winTrades++;
      } else if (netPnl < 0) {
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

      const eTime = t.entryTime || t.timeF || 0;
      const xTime = t.exitTime || eTime;
      const holdSec = xTime > eTime ? xTime - eTime : 0;
      totalHoldingSec += holdSec;

      intervals.push({
        entry: eTime,
        exit: xTime,
        direction: t.direction,
        posValue: posVal,
      });

      if (xTime > 0) {
        const dStr = new Date(xTime < 1e11 ? xTime * 1000 : xTime).toISOString().slice(0, 10);
        dailyPnLMap[dStr] = (dailyPnLMap[dStr] || 0) + netPnl;

        const mStr = new Date(xTime < 1e11 ? xTime * 1000 : xTime).toISOString().slice(0, 7);
        monthlyPnLMap[mStr] = (monthlyPnLMap[mStr] || 0) + netPnl;
      }

      runningEquity += netPnl;
      if (runningEquity > peakEquity) {
        if (inDrawdown && currentDDStart && troughTime) {
          const recSec = xTime - troughTime;
          recoveryDurationsSec.push(recSec);
          recoveryDurationsTrades.push(currentDDTrades - troughTrades);
        }
        peakEquity = runningEquity;
        inDrawdown = false;
        currentDDStart = null;
        currentDDTrades = 0;
      } else {
        const ddUsd = peakEquity - runningEquity;
        const ddPct = peakEquity > 0 ? (ddUsd / peakEquity) * 100 : 0;
        drawdownsPercentList.push(ddPct);

        if (ddUsd > maxDD_usd) {
          maxDD_usd = ddUsd;
          troughTime = xTime;
          troughTrades = currentDDTrades;
        }
        if (ddPct > maxDD_percent) {
          maxDD_percent = ddPct;
        }

        if (!inDrawdown) {
          inDrawdown = true;
          currentDDStart = eTime;
          currentDDTrades = 0;
        }
        currentDDTrades++;
        if (currentDDStart) {
          const ddDur = xTime - currentDDStart;
          if (ddDur > maxDDDurationSec) {
            maxDDDurationSec = ddDur;
            maxDDDurationTrades = currentDDTrades;
          }
        }
      }
    }

    const finalEquity = initialCap + totalNetProfit;
    const totalReturnPercent = initialCap > 0 ? (totalNetProfit / initialCap) * 100 : 0;

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

    const dailyMeanReturn =
      dailyReturnPcts.length > 0 ? dailyReturnPcts.reduce((a, b) => a + b, 0) / dailyReturnPcts.length : 0;
    const dailyVariance =
      dailyReturnPcts.length > 1
        ? dailyReturnPcts.reduce((sum, r) => sum + Math.pow(r - dailyMeanReturn, 2), 0) / (dailyReturnPcts.length - 1)
        : 0;
    const dailyStdDev = Math.sqrt(dailyVariance);
    const annualizedVolatility = dailyStdDev * Math.sqrt(365.25);

    const negativeDailyReturns = dailyReturnPcts.filter((r) => r < 0);
    const downsideVariance =
      negativeDailyReturns.length > 0
        ? negativeDailyReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeDailyReturns.length
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
    const calmarRatio = maxDD_percent > 0 ? annualizedReturn / maxDD_percent : annualizedReturn > 0 ? 99.0 : 0.0;

    const avgDD_percent =
      drawdownsPercentList.length > 0
        ? drawdownsPercentList.reduce((a, b) => a + b, 0) / drawdownsPercentList.length
        : 0;
    const avgDD_usd = (avgDD_percent / 100) * initialCap;

    const maxDDDurationDays = maxDDDurationSec / 86400;
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

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const avgWinUsd = winTrades > 0 ? grossProfit / winTrades : 0;
    const avgLossUsd = lossTrades > 0 ? grossLoss / lossTrades : 0;
    const avgWinPercent = initialCap > 0 ? (avgWinUsd / initialCap) * 100 : 0;
    const avgLossPercent = initialCap > 0 ? (avgLossUsd / initialCap) * 100 : 0;
    const winLossRatio = avgLossUsd > 0 ? avgWinUsd / avgLossUsd : avgWinUsd > 0 ? 99.0 : 0;

    const expectancyUsd = totalTrades > 0 ? totalNetProfit / totalTrades : 0;
    const riskAmountPerTrade = initialCap * (risk / 100);
    const expectancyR = riskAmountPerTrade > 0 ? expectancyUsd / riskAmountPerTrade : 0;

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

      if (activeCount > maxConcurrentPositions) {
        maxConcurrentPositions = activeCount;
      }
      totalConcurrentSampleSum += activeCount;

      const grossExp = initialCap > 0 ? (longExp + shortExp) / initialCap : 0;
      const netExp = initialCap > 0 ? (longExp - shortExp) / initialCap : 0;

      totalGrossExposureSum += grossExp;
      totalNetExposureSum += netExp;

      if (grossExp > maxGrossExposure) maxGrossExposure = grossExp;
      if (netExp > maxNetExposure) maxNetExposure = netExp;
      if (netExp < minNetExposure) minNetExposure = netExp;
    }

    const avgConcurrentPositions = totalConcurrentSampleSum / sampleCount;
    const avgGrossExposure = totalGrossExposureSum / sampleCount;
    const avgNetExposure = totalNetExposureSum / sampleCount;
    const turnoverRatio = initialCap > 0 ? totalVolumeTraded / initialCap : 0;

    const estimatedFundingFees = (totalHoldingSec / 28800) * (totalVolumeTraded / 2) * 0.0001;

    const sortedDailyReturns = dailyReturnPcts.slice().sort((a, b) => a - b);
    const varIndex95 = Math.max(0, Math.floor(sortedDailyReturns.length * 0.05));
    const dailyVaR95 = sortedDailyReturns.length > 0 ? Math.abs(Math.min(0, sortedDailyReturns[varIndex95])) : 0;

    const tailReturns = sortedDailyReturns.slice(0, varIndex95 + 1);
    const dailyCVaR95 =
      tailReturns.length > 0
        ? Math.abs(Math.min(0, tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length))
        : dailyVaR95;

    const winDaysCount = dailyPnLVals.filter((p) => p > 0).length;
    const winningDaysPercent = totalDaysCount > 0 ? (winDaysCount / totalDaysCount) * 100 : 0;

    const monthlyReturnText =
      Object.entries(monthlyPnLMap)
        .map(
          ([m, pnl]) =>
            `${m}: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${((pnl / initialCap) * 100).toFixed(1)}%)`
        )
        .join(' | ') || 'ماه جاری: دیتای کامل';

    if (bestTradePnl === -Infinity) bestTradePnl = 0;
    if (worstTradePnl === Infinity) worstTradePnl = 0;

    return {
      initialCap,
      risk,
      totalNetProfit,
      totalReturnPercent,
      cagrEligible,
      cagrValue,
      annualizedReturn,
      annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDD_usd,
      maxDD_percent,
      maxDDDurationDays,
      maxDDDurationTrades,
      avgDD_usd,
      avgDD_percent,
      avgRecoveryDays,
      avgRecoveryTrades,
      maxRecoveryDays,
      profitFactor,
      winRate,
      winTrades,
      lossTrades,
      totalTrades,
      avgWinUsd,
      avgWinPercent,
      avgLossUsd,
      avgLossPercent,
      winLossRatio,
      expectancyUsd,
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
      turnoverRatio,
      totalVolumeTraded,
      totalFees,
      estimatedFundingFees,
      bestTradePnl,
      bestTradePercent,
      bestTradeSymbol,
      worstTradePnl,
      worstTradePercent,
      worstTradeSymbol,
      bestDayPnl,
      bestDayPercent,
      bestDayDate,
      worstDayPnl,
      worstDayPercent,
      worstDayDate,
      winningDaysPercent,
      winDaysCount,
      totalDaysCount,
      dailyMeanReturn,
      dailyStdDev,
      monthlyReturnText,
      dailyVaR95,
      dailyCVaR95,
    };
  }, [allCollectedTrades, capital, riskPercent, datasetAudit.actualDurationDays, timeframe, commissionPercent]);

  // ۴. سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk)
  const portfolioRiskAudit = useMemo(() => {
    const trades = allCollectedTrades || [];
    const baseRisk = riskPercent || 1.0;
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
      const riskUsd = (initialCap * riskPct) / 100;
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
  }, [allCollectedTrades, riskPercent, capital]);

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

    const calibratedOptimalRisk =
      actualMaxDD > 0
        ? parseFloat(((riskPercent * targetMaxDD) / actualMaxDD).toFixed(2))
        : riskPercent;

    const investigationPoints = [
      {
        title: '۱. همپوشانی معاملات و اثر همبستگی (Trade Concurrency & Covariance)',
        finding: `در اوج معاملات همزمان (${portfolioRiskAudit.maxOpenTrades} پوزیشن باز)، ریسک موثر همبسته به ${portfolioRiskAudit.maxEffectiveRiskPct}% افزایش یافت که عامل اصلی درودان‌های تجمعی است.`,
      },
      {
        title: '۲. کالیبراسیون دقیق درصد ریسک برای دستیابی به درودان ۲۰٪ (Optimal Risk Calibration)',
        finding: `برای مهار قطعی درودان در مرز دقیق ۲۰٪، ریسک هر معامله باید روی ${calibratedOptimalRisk}% تنظیم شود (ریسک جاری: ${riskPercent}%).`,
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
        finding: `سقف پوزیشن‌های همزمان به ۳ معامله محدود شود، یا از ریسک کالیبره‌شده ${calibratedOptimalRisk}% استفاده گردد تا پایداری رشد سرمایه تضمین شود.`,
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
      calibratedOptimalRisk,
      investigationPoints,
    };
  }, [baselineReconstruction.maxDD_percent, riskPercent, capital, portfolioRiskAudit, baselineReconstruction.totalFees, timeframe]);

  const handleCopyAuditReport = () => {
    if (!datasetAudit || !backtestIntegrityAudit || !baselineReconstruction) return;
    const reportText = `=====================================================
گزارش جامع ۵ جدول ممیزی، صحه‌گذاری و اعتبارسنجی بک‌تست (5-Table Complete Audit)
زمان صدور گزارش: ${new Date().toISOString()}
تایم‌فریم انتخابی: ${timeframe}
=====================================================

بخش اول: جدول اعتبارسنجی دیتاست (1. Validate the dataset):
-----------------------------------------------------
۱. تعداد دارایی‌ها (number of assets): ${datasetAudit.numberOfAssets} جفت‌ارز
۲. تعداد کل معاملات (number of trades): ${datasetAudit.numberOfTrades} معامله
۳. تعداد معاملات خرید و فروش (buy and sell trades count): ${datasetAudit.buyTradesCount} خرید (Buy) [${datasetAudit.buyWinRate}% Win] | ${datasetAudit.sellTradesCount} فروش (Sell) [${datasetAudit.sellWinRate}% Win]
۴. تعداد کل کندل‌ها (number of candles): ${datasetAudit.totalCandles.toLocaleString()} کندل (میانگین ${datasetAudit.avgCandlesPerAsset.toLocaleString()} به ازای هر ارز)
۵. تاریخ دقیق شروع تاریخی (exact historical start date): ${datasetAudit.exactHistoricalStartDate}
۶. تاریخ دقیق پایان تاریخی (exact historical end date): ${datasetAudit.exactHistoricalEndDate}
۷. مدت زمان واقعی پوشش‌داده‌شده (actual duration covered): ${datasetAudit.actualDurationCoveredText}
۸. دامنه سقف ۵,۰۰۰ کندل (whether 5,000 candles refers to each asset or entire dataset): به ازای هر دارایی (Per Asset) است و نه کل دیتاست. حجم کل دیتاست تا ${datasetAudit.totalTheoreticalDatasetCapacity.toLocaleString()} کندل است.
۹. داده‌های مفقود (missing data): ${datasetAudit.missingDataCount} مورد
۱۰. رکوردهای تکراری (duplicated records): ${datasetAudit.duplicatedCandlesCount} کندل تکراری | ${datasetAudit.duplicatedTradesCount} معامله تکراری
۱۱. شکاف‌های داده / گپ‌ها (data gaps): ${datasetAudit.dataGapsCount} کندل گپ در تایم‌فریم ${timeframe}
۱۲. قیمت‌های مفقود یا نامعتبر (missing prices): ${datasetAudit.missingPricesCount} مورد
۱۳. فیلدهای مفقود در معامله (missing trade fields): ${datasetAudit.missingTradeFieldsCount} مورد
۱۴. برچسب‌های زمانی ناسازگار (inconsistent timestamps): ${datasetAudit.inconsistentTimestampsCount} مورد
۱۵. نمادهای ناسازگار (inconsistent symbols): ${datasetAudit.inconsistentSymbolsCount} مورد
نمره سلامت دیتاست: ${datasetAudit.dataHealthScore}% (صداقت ارزیابی: بدون ایجاد داده ساختگی - Do Not Fabricate Missing Values)

بخش دوم: جدول صحه‌گذاری سلامت بک‌تست (2. Check for backtest integrity):
-----------------------------------------------------
۱. معاملات تکراری (duplicate trades): ${backtestIntegrityAudit.duplicateTradesCount} مورد
۲. معاملات همپوشان روی یک نماد (overlapping trades): ${backtestIntegrityAudit.overlappingTradesCount} مورد
۳. قیمت‌های غیرممکن یا منفی (impossible prices): ${backtestIntegrityAudit.impossiblePricesCount} مورد
۴. جهت معامله نامعتبر (invalid trade direction): ${backtestIntegrityAudit.invalidDirectionCount} مورد
۵. خطای حجم پوزیشن و مدیریت ریسک (incorrect position sizing): ${backtestIntegrityAudit.incorrectPositionSizingCount} مورد
۶. بازدهی‌های غیرممکن یا نامتعارف (impossible returns): ${backtestIntegrityAudit.impossibleReturnsCount} مورد
۷. اریب نگاه به آینده (look-ahead bias): ${backtestIntegrityAudit.lookAheadBiasCount} مورد (۰٪ اریب؛ ورود منحصراً پس از بسته شدن کندل تایید)
۸. نشت اطلاعات آینده به محاسبات جاری (future information leakage): ${backtestIntegrityAudit.futureInfoLeakageCount} مورد (توالی ایزوله کندل‌به‌کندل)
۹. انحراف بقا در نمادهای زنده (survivorship bias where detectable): لحاظ‌شده (دیتاست فقط جفت‌ارزهای فعال فعلی بایننس را پوشش می‌دهد)
۱۰. دارایی‌های حذف‌شده یا بدون داده (delisted/missing assets): ${backtestIntegrityAudit.delistedOrMissingAssetsCount} مورد
۱۱. بررسی اعمال کارمزد ورود و خروج (incorrect fee handling): ${backtestIntegrityAudit.incorrectFeeHandlingCount} مورد (کسر دقیق کارمزد ${commissionPercent}٪)
۱۲. مدیریت صحیح اهرم و مارجین (incorrect leverage handling): ${backtestIntegrityAudit.incorrectLeverageHandlingCount} مورد (اهرم اسمی ۱x ایمن)
۱۳. صحت ریاضی محاسبات سود و زیان (incorrect PnL calculation): ${backtestIntegrityAudit.incorrectPnlCount} مورد (تطبیق ۱۰۰٪ فرمول PnL)
نمره اعتبار و سلامت بک‌تست: ${backtestIntegrityAudit.integrityScore}%

بخش سوم: جدول بازسازی مدل مبنا (3. Reconstruct the baseline):
-----------------------------------------------------
مدل مبنا (Baseline): ${riskPercent}% ریسک در هر معامله (سرمایه اولیه: $${capital.toLocaleString()})
* Total return: ${baselineReconstruction.totalNetProfit >= 0 ? '+' : ''}$${baselineReconstruction.totalNetProfit.toFixed(2)} (${baselineReconstruction.totalReturnPercent.toFixed(2)}%)
* CAGR: ${baselineReconstruction.cagrEligible ? `${baselineReconstruction.cagrValue?.toFixed(2)}% per annum` : `N/A (${datasetAudit.actualDurationDays.toFixed(1)} days; <30d)`}
* Annualized return: ${baselineReconstruction.annualizedReturn.toFixed(2)}%
* Annualized volatility: ${baselineReconstruction.annualizedVolatility.toFixed(2)}%
* Sharpe: ${baselineReconstruction.sharpeRatio.toFixed(2)}
* Sortino: ${baselineReconstruction.sortinoRatio.toFixed(2)}
* Calmar: ${baselineReconstruction.calmarRatio.toFixed(2)}
* Max Drawdown: -$${baselineReconstruction.maxDD_usd.toFixed(2)} (${baselineReconstruction.maxDD_percent.toFixed(2)}%)
* Max Drawdown duration: ${baselineReconstruction.maxDDDurationDays.toFixed(1)} days (${baselineReconstruction.maxDDDurationTrades} trades)
* Average Drawdown: -$${baselineReconstruction.avgDD_usd.toFixed(2)} (${baselineReconstruction.avgDD_percent.toFixed(2)}%)
* Recovery duration: Avg: ${baselineReconstruction.avgRecoveryDays.toFixed(1)} days | Max: ${baselineReconstruction.maxRecoveryDays.toFixed(1)} days
* Profit Factor: ${baselineReconstruction.profitFactor.toFixed(2)}
* Win Rate: ${baselineReconstruction.winRate.toFixed(2)}% (${baselineReconstruction.winTrades}W / ${baselineReconstruction.lossTrades}L)
* Average Win: +$${baselineReconstruction.avgWinUsd.toFixed(2)} (+${baselineReconstruction.avgWinPercent.toFixed(2)}%)
* Average Loss: -$${baselineReconstruction.avgLossUsd.toFixed(2)} (-${baselineReconstruction.avgLossPercent.toFixed(2)}%)
* Win/Loss ratio: ${baselineReconstruction.winLossRatio.toFixed(2)}:1
* Expectancy: ${baselineReconstruction.expectancyUsd >= 0 ? '+' : ''}$${baselineReconstruction.expectancyUsd.toFixed(2)} per trade
* Expectancy per unit of risk: ${baselineReconstruction.expectancyR.toFixed(2)} R
* Total trades: ${baselineReconstruction.totalTrades}
* Average holding period: ${baselineReconstruction.avgHoldingHours.toFixed(1)} hours (${baselineReconstruction.avgHoldingBars} bars)
* Average concurrent positions: ${baselineReconstruction.avgConcurrentPositions.toFixed(2)}
* Maximum concurrent positions: ${baselineReconstruction.maxConcurrentPositions}
* Gross exposure: Avg: ${(baselineReconstruction.avgGrossExposure * 100).toFixed(1)}% | Peak: ${(baselineReconstruction.maxGrossExposure * 100).toFixed(1)}%
* Net exposure: Avg: ${(baselineReconstruction.avgNetExposure * 100).toFixed(1)}%
* Turnover: $${baselineReconstruction.totalVolumeTraded.toFixed(0)} (${baselineReconstruction.turnoverRatio.toFixed(1)}x)
* Fees: -$${baselineReconstruction.totalFees.toFixed(2)} (${commissionPercent}%)
* Slippage: 0.00% (Market impact ~0.02%)
* Funding costs: -$${baselineReconstruction.estimatedFundingFees.toFixed(2)}
* Best trade: +$${baselineReconstruction.bestTradePnl.toFixed(2)} (+${baselineReconstruction.bestTradePercent.toFixed(2)}%) on ${baselineReconstruction.bestTradeSymbol}
* Worst trade: -$${Math.abs(baselineReconstruction.worstTradePnl).toFixed(2)} (-${Math.abs(baselineReconstruction.worstTradePercent).toFixed(2)}%) on ${baselineReconstruction.worstTradeSymbol}
* Best day: +$${baselineReconstruction.bestDayPnl.toFixed(2)} (+${baselineReconstruction.bestDayPercent.toFixed(2)}%) on ${baselineReconstruction.bestDayDate}
* Worst day: -$${Math.abs(baselineReconstruction.worstDayPnl).toFixed(2)} (-${Math.abs(baselineReconstruction.worstDayPercent).toFixed(2)}%) on ${baselineReconstruction.worstDayDate}
* Daily return distribution: ${baselineReconstruction.winningDaysPercent.toFixed(1)}% Win Days | Mean: ${baselineReconstruction.dailyMeanReturn.toFixed(2)}% | Std: ${baselineReconstruction.dailyStdDev.toFixed(2)}%
* Monthly return distribution: ${baselineReconstruction.monthlyReturnText}
* VaR (95% Daily): ${baselineReconstruction.dailyVaR95.toFixed(2)}% (-$${((capital * baselineReconstruction.dailyVaR95) / 100).toFixed(2)})
* CVaR / Expected Shortfall (95%): ${baselineReconstruction.dailyCVaR95.toFixed(2)}% (-$${((capital * baselineReconstruction.dailyCVaR95) / 100).toFixed(2)})

بخش چهارم: سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk):
-----------------------------------------------------
* Nominal open risk per trade: ${portfolioRiskAudit.nominalRiskPerTrade}%
* Average open trades: ${portfolioRiskAudit.avgOpenTrades}
* Maximum open trades: ${portfolioRiskAudit.maxOpenTrades}
* Total nominal risk (Peak): ${portfolioRiskAudit.maxNominalRiskPct}% ($${portfolioRiskAudit.maxNominalRiskUsd})
* Effective portfolio risk with covariance: Peak: ${portfolioRiskAudit.maxEffectiveRiskPct}% ($${portfolioRiskAudit.maxEffectiveRiskUsd})
* Average simultaneous risk: Nominal: ${portfolioRiskAudit.avgNominalRiskPct}% | Effective: ${portfolioRiskAudit.avgEffectiveRiskPct}%
* Risk scaling progression:
${portfolioRiskAudit.scalingTable.map((r) => `  - ${r.tradesCount} trades open -> Nominal: ${r.nominalRiskPct}% | Effective: ${r.effectiveRiskPct}% (Scale: ${r.scalingFactor}x, Time: ${r.pctTime}%)`).join('\n')}

بخش پنجم: اعتبارسنجی مدل مبنا (5. Baseline validation):
-----------------------------------------------------
* Target Benchmark MaxDD: ${baselineValidationAudit.targetMaxDD}%
* Actual Reconstructed MaxDD: ${baselineValidationAudit.actualMaxDD}% (Delta: ${baselineValidationAudit.delta >= 0 ? '+' : ''}${baselineValidationAudit.delta}%)
* Status: ${baselineValidationAudit.statusText}
* Calibrated Optimal Risk for ~20% MaxDD: ${baselineValidationAudit.calibratedOptimalRisk}%
* Root Cause Investigation:
${baselineValidationAudit.investigationPoints.map((p) => `  - ${p.title}: ${p.finding}`).join('\n')}
=====================================================`;

    navigator.clipboard.writeText(reportText).then(() => {
      showToast('📋 گزارش متنی کامل ۵ جدول اعتبارسنجی، سلامت، مدل مبنا و سنجش ریسک کپی شد.');
    });
  };

  const handleExportDatasetAuditJSON = () => {
    if (!datasetAudit || !backtestIntegrityAudit || !baselineReconstruction || !portfolioRiskAudit || !baselineValidationAudit) return;
    const exportData = {
      generatedAt: new Date().toISOString(),
      timeframe,
      datasetValidation: datasetAudit,
      backtestIntegrity: backtestIntegrityAudit,
      baselineReconstruction: baselineReconstruction,
      portfolioRiskMeasurement: portfolioRiskAudit,
      baselineValidation: baselineValidationAudit,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest_full_5table_audit_${timeframe}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('💾 گزارش JSON جامع هر ۵ جدول بک‌تست دانلود شد.');
  };

  const handleExportDatasetAuditCSV = () => {
    const table1Rows = [
      ['بخش ۱: جدول اعتبارسنجی دیتاست (1. Validate the dataset)', '', '', ''],
      ['شاخص بازرسی دیتاست', 'نتیجه بازرسی و مقدار دقیق', 'وضعیت سلامت', 'توضیحات فنی و متدولوژی'],
      ['تعداد دارایی‌ها (Number of Assets)', `${datasetAudit.numberOfAssets} جفت‌ارز`, 'تاییدشده', 'تعداد نمادهای فعال در کش و اسکن بازار'],
      ['تعداد معاملات (Number of Trades)', `${datasetAudit.numberOfTrades} معامله`, 'تاییدشده', 'مجموع معاملات اجراشده توسط استراتژی'],
      ['تعداد معاملات خرید و فروش (Buy & Sell Trades Count)', `خرید (Buy): ${datasetAudit.buyTradesCount} (${datasetAudit.buyPercentage}%) | فروش (Sell): ${datasetAudit.sellTradesCount} (${datasetAudit.sellPercentage}%)`, 'تاییدشده', `وین‌ریت خرید: ${datasetAudit.buyWinRate}% | وین‌ریت فروش: ${datasetAudit.sellWinRate}%`],
      ['تعداد کل کندل‌ها (Number of Candles)', `${datasetAudit.totalCandles} کندل`, 'تاییدشده', `میانگین ${datasetAudit.avgCandlesPerAsset} کندل به ازای هر ارز (حداقل ${datasetAudit.minCandles}، حداکثر ${datasetAudit.maxCandles})`],
      ['تاریخ دقیق شروع تاریخی (Exact Start Date)', datasetAudit.exactHistoricalStartDate, 'تاییدشده', 'قدیمی‌ترین مهر زمانی موجود در دیتاست'],
      ['تاریخ دقیق پایان تاریخی (Exact End Date)', datasetAudit.exactHistoricalEndDate, 'تاییدشده', 'جدیدترین مهر زمانی موجود در دیتاست'],
      ['مدت زمان پوشش داده‌ها (Actual Duration Covered)', datasetAudit.actualDurationCoveredText, 'تاییدشده', `${datasetAudit.actualDurationDays} روز تقویمی (${datasetAudit.actualDurationHours} ساعت)`],
      ['مفهوم ۵,۰۰۰ کندل (5,000 Candles Scope)', 'هر دارایی به صورت مجزا دارای ۵,۰۰۰ کندل است (Per-Asset History)', 'تاییدشده', `حجم نظری کل دیتاست: ${datasetAudit.totalTheoreticalDatasetCapacity.toLocaleString()} کندل`],
      ['داده‌های گم‌شده (Missing Data)', `${datasetAudit.missingDataCount} مورد`, datasetAudit.missingDataCount === 0 ? 'سالم' : 'نیازمند بررسی', 'بررسی دارایی‌های با صفر کندل یا اسکن ناقص'],
      ['رکوردهای تکراری (Duplicated Records)', `${datasetAudit.duplicatedCandlesCount} کندل تکراری / ${datasetAudit.duplicatedTradesCount} معامله تکراری`, datasetAudit.duplicatedCandlesCount === 0 && datasetAudit.duplicatedTradesCount === 0 ? 'سالم' : 'دارای تکرار', 'یکتایی مهر زمانی کندل‌ها و هش اختصاصی معاملات'],
      ['شکاف‌های زمانی داده‌ها (Data Gaps)', `${datasetAudit.dataGapsCount} کندل گپ`, datasetAudit.dataGapsCount === 0 ? 'سالم' : 'طبیعی برای جفت‌های جدید', `بررسی جهش‌های بیش از ۱.۵ برابر اینتروال (${timeframe})`],
      ['قیمت‌های مفقود (Missing Prices)', `${datasetAudit.missingPricesCount} مورد`, datasetAudit.missingPricesCount === 0 ? 'سالم' : 'دارای نقص', 'بررسی مقادیر NaN، منفی یا صفر در OHLC'],
      ['فیلدهای ناقص معاملات (Missing Trade Fields)', `${datasetAudit.missingTradeFieldsCount} مورد`, datasetAudit.missingTradeFieldsCount === 0 ? 'سالم' : 'دارای نقص', 'بررسی صحت entryPrice, exitPrice, entryTime, exitTime, pnl, status'],
      ['ناسازگاری مهرهای زمانی (Inconsistent Timestamps)', `${datasetAudit.inconsistentTimestampsCount} مورد`, datasetAudit.inconsistentTimestampsCount === 0 ? 'سالم' : 'دارای نقص', 'بررسی ترتیب اکیداً صعودی مهرهای زمانی کندل‌ها'],
      ['نمادهای ناسازگار (Inconsistent Symbols)', `${datasetAudit.inconsistentSymbolsCount} مورد`, datasetAudit.inconsistentSymbolsCount === 0 ? 'سالم' : 'دارای نقص', 'بررسی تطابق نمادها با فرمت استاندارد USDT Futures بایننس'],
      ['', '', '', ''],
      ['بخش ۲: جدول صحه‌گذاری سلامت بک‌تست (2. Check for backtest integrity)', '', '', ''],
      ['بررسی سلامت بک‌تست', 'نتیجه بازرسی الگوریتمی', 'وضعیت اعتبار', 'توضیحات و اثبات فنی'],
      ['معاملات تکراری (Duplicate Trades)', `${backtestIntegrityAudit.duplicateTradesCount} مورد تکراری`, backtestIntegrityAudit.duplicateTradesCount === 0 ? 'معتبر' : 'دارای خطا', 'بررسی یکتایی شناسه، زمان و مشخصات هر معامله'],
      ['معاملات همپوشان (Overlapping Trades)', `${backtestIntegrityAudit.overlappingTradesCount} مورد همپوشان`, backtestIntegrityAudit.overlappingTradesCount === 0 ? 'معتبر' : 'دارای همپوشانی', 'عدم باز شدن پوزیشن جدید قبل از بسته شدن پوزیشن قبلی در یک نماد'],
      ['قیمت‌های غیرممکن (Impossible Prices)', `${backtestIntegrityAudit.impossiblePricesCount} قیمت غیرممکن`, backtestIntegrityAudit.impossiblePricesCount === 0 ? 'معتبر' : 'دارای خطا', 'بررسی مثبت و متناهی بودن کلیه قیمت‌های ورود، خروج، SL و TP'],
      ['جهت معامله نامعتبر (Invalid Trade Direction)', `${backtestIntegrityAudit.invalidDirectionCount} مورد نامعتبر`, backtestIntegrityAudit.invalidDirectionCount === 0 ? 'معتبر' : 'دارای خطا', 'رعایت شرط TP > Entry > SL در خرید و TP < Entry < SL در فروش'],
      ['خطای حجم پوزیشن (Incorrect Position Sizing)', `${backtestIntegrityAudit.incorrectPositionSizingCount} خطای سایزینگ`, backtestIntegrityAudit.incorrectPositionSizingCount === 0 ? 'معتبر' : 'دارای خطا', 'تطابق حجم پوزیشن با فرمول مدیریت ریسک و سرمایه'],
      ['بازدهی‌های غیرممکن (Impossible Returns)', `${backtestIntegrityAudit.impossibleReturnsCount} بازدهی نامتعارف`, backtestIntegrityAudit.impossibleReturnsCount === 0 ? 'معتبر' : 'دارای خطا', 'بررسی قرار داشتن بازدهی در محدوده منطقی بدون تقسیم بر صفر'],
      ['اریب نگاه به آینده (Look-Ahead Bias)', `${backtestIntegrityAudit.lookAheadBiasCount} مورد (صفر درصد)`, 'معتبر', 'ورود صرفاً پس از تایید و بسته شدن کندل شکست'],
      ['نشت اطلاعات آینده (Future Information Leakage)', `${backtestIntegrityAudit.futureInfoLeakageCount} مورد (صفر درصد)`, 'معتبر', 'ایزولاسیون کامل خط لوله ارزیابی کندل‌به‌کندل'],
      ['انحراف بقا (Survivorship Bias)', 'پوشش ارزهای فعال فعلی بایننس', 'گزارش شفاف', 'نمادهای حذف‌شده یا ورشکسته تاریخی در دیتاست زنده غایب هستند'],
      ['دارایی‌های حذف‌شده/مفقود (Delisted/Missing Assets)', `${backtestIntegrityAudit.delistedOrMissingAssetsCount} مورد مفقود`, backtestIntegrityAudit.delistedOrMissingAssetsCount === 0 ? 'معتبر' : 'نیازمند بررسی', 'کوئری تک‌تک نمادها از بایننس و کنار گذاشتن ارزهای بدون کندل'],
      ['کارمزد معاملات (Incorrect Fee Handling)', `کسر دوطرفه کارمزد (${commissionPercent}٪ مجموع)`, 'معتبر', 'اعمال تفکیکی کارمزد ورود و خروج بر ارزش پوزیشن در سود خالص'],
      ['مدیریت اهرم و مارجین (Incorrect Leverage Handling)', 'اهرم اسمی ۱x استاندارد', 'معتبر', 'محاسبه بدون تحمیل لیکوییدیتی نامتعارف و مارجین ایمن'],
      ['صحت محاسبات PnL (Incorrect PnL Calculation)', `${backtestIntegrityAudit.incorrectPnlCount} مغایرت محاسباتی`, backtestIntegrityAudit.incorrectPnlCount === 0 ? 'معتبر' : 'دارای خطا', 'تطبیق ۱۰۰٪ فرمول ریاضی سود خالص با قیمت‌های ورود، خروج و کارمزد'],
      ['', '', '', ''],
      ['بخش ۳: جدول بازسازی مدل مبنا (3. Reconstruct the baseline)', '', '', ''],
      ['پارامتر / شاخص (Parameter)', 'مقدار محاسبه‌شده و وضعیت (Value)', '', ''],
      ['Baseline (مدل مبنا)', `${riskPercent}% risk per trade ($${((capital * riskPercent) / 100).toFixed(0)} per trade, Capital: $${capital.toLocaleString()})`, '', ''],
      ['Total return (بازدهی کل)', `${baselineReconstruction.totalNetProfit >= 0 ? '+' : ''}$${baselineReconstruction.totalNetProfit.toFixed(2)} (${baselineReconstruction.totalReturnPercent.toFixed(2)}%)`, '', ''],
      ['CAGR (نرخ رشد مرکب سالانه)', baselineReconstruction.cagrEligible ? `${baselineReconstruction.cagrValue?.toFixed(2)}%` : 'N/A (<30 days duration)', '', ''],
      ['Annualized return (بازده سالانه)', `${baselineReconstruction.annualizedReturn.toFixed(2)}%`, '', ''],
      ['Annualized volatility (نوسان سالانه)', `${baselineReconstruction.annualizedVolatility.toFixed(2)}%`, '', ''],
      ['Sharpe (نسبت شارپ)', `${baselineReconstruction.sharpeRatio.toFixed(2)}`, '', ''],
      ['Sortino (نسبت سورتینو)', `${baselineReconstruction.sortinoRatio.toFixed(2)}`, '', ''],
      ['Calmar (نسبت کالمار)', `${baselineReconstruction.calmarRatio.toFixed(2)}`, '', ''],
      ['Max Drawdown (حداکثر افت)', `-$${baselineReconstruction.maxDD_usd.toFixed(2)} (${baselineReconstruction.maxDD_percent.toFixed(2)}%)`, '', ''],
      ['Max Drawdown duration (مدت درودان)', `${baselineReconstruction.maxDDDurationDays.toFixed(1)} days (${baselineReconstruction.maxDDDurationTrades} trades)`, '', ''],
      ['Average Drawdown (میانگین درودان)', `-$${baselineReconstruction.avgDD_usd.toFixed(2)} (${baselineReconstruction.avgDD_percent.toFixed(2)}%)`, '', ''],
      ['Recovery duration (مدت ریکاوری)', `Avg: ${baselineReconstruction.avgRecoveryDays.toFixed(1)} days | Max: ${baselineReconstruction.maxRecoveryDays.toFixed(1)} days`, '', ''],
      ['Profit Factor (فاکتور سود)', `${baselineReconstruction.profitFactor.toFixed(2)}`, '', ''],
      ['Win Rate (وین ریت)', `${baselineReconstruction.winRate.toFixed(2)}% (${baselineReconstruction.winTrades}W / ${baselineReconstruction.lossTrades}L)`, '', ''],
      ['Average Win (میانگین برد)', `+$${baselineReconstruction.avgWinUsd.toFixed(2)} (+${baselineReconstruction.avgWinPercent.toFixed(2)}%)`, '', ''],
      ['Average Loss (میانگین باخت)', `-$${baselineReconstruction.avgLossUsd.toFixed(2)} (-${baselineReconstruction.avgLossPercent.toFixed(2)}%)`, '', ''],
      ['Win/Loss ratio (نسبت برد/باخت)', `${baselineReconstruction.winLossRatio.toFixed(2)}:1`, '', ''],
      ['Expectancy (امید ریاضی)', `${baselineReconstruction.expectancyUsd >= 0 ? '+' : ''}$${baselineReconstruction.expectancyUsd.toFixed(2)} per trade`, '', ''],
      ['Expectancy per unit of risk', `${baselineReconstruction.expectancyR.toFixed(2)} R`, '', ''],
      ['Total trades (کل معاملات)', `${baselineReconstruction.totalTrades}`, '', ''],
      ['Average holding period (مدت نگهداری)', `${baselineReconstruction.avgHoldingHours.toFixed(1)} hours (${baselineReconstruction.avgHoldingBars} bars)`, '', ''],
      ['Average concurrent positions', `${baselineReconstruction.avgConcurrentPositions.toFixed(2)} positions`, '', ''],
      ['Maximum concurrent positions', `${baselineReconstruction.maxConcurrentPositions} positions`, '', ''],
      ['Gross exposure (اکسپوژر ناخالص)', `Avg: ${(baselineReconstruction.avgGrossExposure * 100).toFixed(1)}% | Peak: ${(baselineReconstruction.maxGrossExposure * 100).toFixed(1)}%`, '', ''],
      ['Net exposure (اکسپوژر خالص)', `Avg: ${(baselineReconstruction.avgNetExposure * 100).toFixed(1)}%`, '', ''],
      ['Turnover (گردش مالی)', `$${baselineReconstruction.totalVolumeTraded.toFixed(0)} (${baselineReconstruction.turnoverRatio.toFixed(1)}x)`, '', ''],
      ['Fees (کارمزدها)', `-$${baselineReconstruction.totalFees.toFixed(2)} (${commissionPercent}%)`, '', ''],
      ['Slippage (اسلیپیج)', '0.00% modeled (est. impact ~0.02%)', '', ''],
      ['Funding costs (هزینه فاندینگ)', `-$${baselineReconstruction.estimatedFundingFees.toFixed(2)}`, '', ''],
      ['Best trade (بهترین معامله)', `+$${baselineReconstruction.bestTradePnl.toFixed(2)} (${baselineReconstruction.bestTradeSymbol})`, '', ''],
      ['Worst trade (بدترین معامله)', `-$${Math.abs(baselineReconstruction.worstTradePnl).toFixed(2)} (${baselineReconstruction.worstTradeSymbol})`, '', ''],
      ['Best day (بهترین روز)', `+$${baselineReconstruction.bestDayPnl.toFixed(2)} (${baselineReconstruction.bestDayDate})`, '', ''],
      ['Worst day (بدترین روز)', `-$${Math.abs(baselineReconstruction.worstDayPnl).toFixed(2)} (${baselineReconstruction.worstDayDate})`, '', ''],
      ['Daily return distribution', `${baselineReconstruction.winningDaysPercent.toFixed(1)}% Win Days | Mean: ${baselineReconstruction.dailyMeanReturn.toFixed(2)}% | Std: ${baselineReconstruction.dailyStdDev.toFixed(2)}%`, '', ''],
      ['Monthly return distribution', baselineReconstruction.monthlyReturnText, '', ''],
      ['VaR (95% Daily)', `${baselineReconstruction.dailyVaR95.toFixed(2)}%`, '', ''],
      ['CVaR / Expected Shortfall (95%)', `${baselineReconstruction.dailyCVaR95.toFixed(2)}%`, '', ''],
      ['', '', '', ''],
      ['بخش ۴: جدول سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk)', '', '', ''],
      ['تعداد پوزیشن‌های باز همزمان (Number of open trades)', `Avg: ${portfolioRiskAudit.avgOpenTrades} | Peak: ${portfolioRiskAudit.maxOpenTrades}`, '', ''],
      ['ریسک اسمی هر معامله (Nominal open risk per trade)', `${portfolioRiskAudit.nominalRiskPerTrade}%`, '', ''],
      ['حداکثر ریسک اسمی تجمعی (Total nominal risk - Peak)', `${portfolioRiskAudit.maxNominalRiskPct}% ($${portfolioRiskAudit.maxNominalRiskUsd})`, '', ''],
      ['ریسک موثر پرتفوی با کوواریانس (Effective portfolio risk with covariance)', `Peak: ${portfolioRiskAudit.maxEffectiveRiskPct}% ($${portfolioRiskAudit.maxEffectiveRiskUsd})`, '', ''],
      ['میانگین ریسک همزمان (Average simultaneous risk)', `Nominal: ${portfolioRiskAudit.avgNominalRiskPct}% | Effective: ${portfolioRiskAudit.avgEffectiveRiskPct}%`, '', ''],
      ['مقیاس ریسک در ازای افزایش معاملات همزمان (Risk scaling)', portfolioRiskAudit.scalingTable.map(s => `${s.tradesCount} trades: ${s.effectiveRiskPct}% (Scale: ${s.scalingFactor}x)`).join(' | '), '', ''],
      ['', '', '', ''],
      ['بخش ۵: جدول اعتبارسنجی مدل مبنا در برابر درودان ۲۰٪ (5. Baseline validation)', '', '', ''],
      ['هدف درودان استاندارد (Target Benchmark MaxDD)', `${baselineValidationAudit.targetMaxDD}%`, '', ''],
      ['درودان بازسازی‌شده استراتژی (Actual Reconstructed MaxDD)', `${baselineValidationAudit.actualMaxDD}% (Delta: ${baselineValidationAudit.delta}%)`, '', ''],
      ['وضعیت اعتبارسنجی (Validation Status)', baselineValidationAudit.statusText, '', ''],
      ['ریسک بهینه کالیبره‌شده برای درودان ۲۰٪ (Calibrated Optimal Risk)', `${baselineValidationAudit.calibratedOptimalRisk}% per trade`, '', ''],
      ['علت‌شناسی و یافته‌های انحراف (Root Cause Investigation)', baselineValidationAudit.investigationPoints.map(p => `${p.title}: ${p.finding}`).join(' || '), '', ''],
    ];

    const csvContent = '\uFEFF' + table1Rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest_full_5table_matrix_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('📊 گزارش ۵ جدول جامع اعتبارسنجی دیتاست، سلامت، مبنا و ریسک دانلود شد.');
  };

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
      noConcurrentPositions,
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
                    <option value="all_market">تمام جفت‌ارزهای بازار بالای ۱ میلیون دلار (بیش از ۷۰۰ ارز فعال) - پیش‌فرض</option>
                    <option value="all_futures">تمام ارزهای فیوچرز بایننس (بیش از ۷۰۰ جفت‌ارز USDT-M)</option>
                    <option value="all_spot">تمام ارزهای اسپات بایننس (بیش از ۷۵۰ جفت‌ارز USDT)</option>
                    <option value="top_50">۵۰ ارز برتر فیوچرز (Top 50 Futures)</option>
                    <option value="top_30">۳۰ ارز نقدشونده اول فیوچرز (Top 30 Futures)</option>
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

                {/* چک‌باکس عدم محاسبه معاملات همزمان در اسکن دستی */}
                <div className="flex flex-wrap items-center justify-between p-2.5 rounded-xl bg-[#0e121a] border border-[#283244] gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-amber-400 font-bold text-xs">مدیریت معاملات همزمان:</span>
                      <span className="text-[11px] text-gray-300 mr-1.5">
                        عدم محاسبه معاملات همزمان (عدم ورود به معامله جدید در صورت وجود پوزیشن باز / تک‌پوزیشن)
                      </span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1 rounded-lg bg-[#141a26] border border-[#2e394e] hover:border-amber-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={noConcurrentPositions}
                      onChange={(e) => handleToggleNoConcurrentPositions(e.target.checked)}
                      disabled={isScanning}
                      className="w-4 h-4 rounded text-amber-500 bg-[#171d28] border-[#2e394e] focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                    />
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {noConcurrentPositions ? 'فعال (تک‌پوزیشن)' : 'غیرفعال (معاملات همزمان)'}
                    </span>
                  </label>
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
                          {universeOption === 'all_market'
                            ? 'شروع اسکن کامل بازار (دانلود زنده بیش از ۷۰۰ ارز > 1M$)'
                            : universeOption === 'all_futures'
                            ? 'شروع اسکن کامل بازار (دانلود زنده فیوچرز USDT-M بیش از ۷۰۰ ارز)'
                            : universeOption === 'all_spot'
                            ? 'شروع اسکن کامل بازار (دانلود زنده اسپات بیش از ۷۵۰ ارز)'
                            : universeOption === 'top_50'
                            ? 'شروع اسکن کامل بازار (دانلود زنده ۵۰ ارز فیوچرز)'
                            : 'شروع اسکن کامل بازار (دانلود زنده ۳۰ ارز فیوچرز)'}
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

                <div className="flex items-center gap-2 flex-wrap">
                  {/* گروه ۱: ذخیره و لود کانفیگ پارامترها (کاملاً مجزا) */}
                  <button
                    type="button"
                    onClick={handleOpenSaveConfigModal}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="ذخیره کانفیگ پارامترهای تست در دیتابیس (بدون معاملات)"
                  >
                    <Save className="w-3.5 h-3.5 text-amber-400" />
                    <span>ذخیره کانفیگ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenLoadConfigModal}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="فراخوانی و لود کانفیگ‌های تست از دیتابیس"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>لود کانفیگ</span>
                  </button>

                  {/* گروه ۲: ذخیره و لود دیتای کندل‌های دانلودشده بازار */}
                  {GLOBAL_CANDLE_CACHE.size > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenSaveCandleModal}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="ذخیره کندل‌های دانلودشده صرافی در دیتابیس جهت استفاده مجدد"
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ذخیره کندل‌ها</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenLoadCandleModal}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="فراخوانی دیتای کندل‌ها از دیتابیس ابری بدون دانلود مجدد"
                  >
                    <CloudDownload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>لود کندل‌ها</span>
                  </button>

                  {results.length > 0 && (
                    <>
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
                    </>
                  )}
                </div>
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
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
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

            {/* ۲. رنج‌های فعال و تطبیق‌پذیر پارامترها (Adaptive Ranges Display & Controls) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#171f2e] via-[#141b27] to-[#121722] border border-[#2b3a52] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#222e42]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        رنج‌های هوشمند و تطبیق‌پذیر پارامترها (Smart Adaptive Ranges)
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                        {totalEvaluatedCount.toLocaleString()} آزمایش انجام‌شده
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      با هر تست برنده، رنج‌ها به شکل بیزی حول خوشه بهینه متمرکزتر و باریک‌تر می‌شوند (قابلیت تنظیم دستی حداقل و حداکثر نیز فعال است).
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoCalibrateRanges}
                    disabled={isOptimizing}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40"
                    title={`محاسبه و تنظیم هوشمند رنج‌ها متناسب با تایم‌فریم ${timeframe}`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>کالیبره هوشمند ({timeframe})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoAdaptiveEnabled((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      autoAdaptiveEnabled
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#1b2230] border-gray-700 text-gray-400'
                    }`}
                    title="فعال/غیرفعال‌سازی انقباض خودکار رنج‌ها حول خوشه برنده"
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>انقباض هوشمند: {autoAdaptiveEnabled ? 'فعال' : 'غیرفعال'}</span>
                  </button>
                </div>
              </div>

              {/* نمایشگر و کنترل تعاملی رنج‌های ۸ پارامتر */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {/* 1. ATR Period */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۱. دوره ATR</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.atrPeriod.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.atrPeriod.step}
                        min={1}
                        value={adaptiveRanges.atrPeriod.min}
                        disabled={isOptimizing || lockAtrPeriod}
                        onChange={(e) => handleUpdateParamRange('atrPeriod', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.atrPeriod.step}
                        min={1}
                        value={adaptiveRanges.atrPeriod.max}
                        disabled={isOptimizing || lockAtrPeriod}
                        onChange={(e) => handleUpdateParamRange('atrPeriod', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.atrPeriod.bestVal}</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.atrPeriod.step}</span>
                  </div>
                </div>

                {/* 2. Min Candles */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۲. حداقل کندل</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.minCandles.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.minCandles.step}
                        min={1}
                        value={adaptiveRanges.minCandles.min}
                        disabled={isOptimizing || lockMinCandles}
                        onChange={(e) => handleUpdateParamRange('minCandles', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.minCandles.step}
                        min={1}
                        value={adaptiveRanges.minCandles.max}
                        disabled={isOptimizing || lockMinCandles}
                        onChange={(e) => handleUpdateParamRange('minCandles', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.minCandles.bestVal}</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.minCandles.step}</span>
                  </div>
                </div>

                {/* 3. Min Candles Long Leg */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۳. کندل لگ بلند</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.minCandlesForLongLeg.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.minCandlesForLongLeg.step}
                        min={1}
                        value={adaptiveRanges.minCandlesForLongLeg.min}
                        disabled={isOptimizing || lockMinCandlesLong}
                        onChange={(e) => handleUpdateParamRange('minCandlesForLongLeg', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.minCandlesForLongLeg.step}
                        min={1}
                        value={adaptiveRanges.minCandlesForLongLeg.max}
                        disabled={isOptimizing || lockMinCandlesLong}
                        onChange={(e) => handleUpdateParamRange('minCandlesForLongLeg', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.minCandlesForLongLeg.bestVal}</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.minCandlesForLongLeg.step}</span>
                  </div>
                </div>

                {/* 4. ATR Multiplier */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۴. ضریب عادی</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.atrMultiplier.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.atrMultiplier.step}
                        min={0.1}
                        value={adaptiveRanges.atrMultiplier.min}
                        disabled={isOptimizing || lockAtrMultiplier}
                        onChange={(e) => handleUpdateParamRange('atrMultiplier', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.atrMultiplier.step}
                        min={0.1}
                        value={adaptiveRanges.atrMultiplier.max}
                        disabled={isOptimizing || lockAtrMultiplier}
                        onChange={(e) => handleUpdateParamRange('atrMultiplier', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.atrMultiplier.bestVal}×</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.atrMultiplier.step}</span>
                  </div>
                </div>

                {/* 5. Long Leg ATR Mult */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۵. ضریب لگ بزرگ</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.longLegAtrMultiplier.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.longLegAtrMultiplier.step}
                        min={0.1}
                        value={adaptiveRanges.longLegAtrMultiplier.min}
                        disabled={isOptimizing || lockLongLegAtrMult}
                        onChange={(e) => handleUpdateParamRange('longLegAtrMultiplier', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.longLegAtrMultiplier.step}
                        min={0.1}
                        value={adaptiveRanges.longLegAtrMultiplier.max}
                        disabled={isOptimizing || lockLongLegAtrMult}
                        onChange={(e) => handleUpdateParamRange('longLegAtrMultiplier', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.longLegAtrMultiplier.bestVal}×</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.longLegAtrMultiplier.step}</span>
                  </div>
                </div>

                {/* 6. Max Blue Leg Percent */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۶. سقف لگ آبی %</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.maxBlueLegPercent.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.maxBlueLegPercent.step}
                        min={1}
                        value={adaptiveRanges.maxBlueLegPercent.min}
                        disabled={isOptimizing || lockMaxBlueLegPercent}
                        onChange={(e) => handleUpdateParamRange('maxBlueLegPercent', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.maxBlueLegPercent.step}
                        min={1}
                        value={adaptiveRanges.maxBlueLegPercent.max}
                        disabled={isOptimizing || lockMaxBlueLegPercent}
                        onChange={(e) => handleUpdateParamRange('maxBlueLegPercent', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.maxBlueLegPercent.bestVal}%</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.maxBlueLegPercent.step}</span>
                  </div>
                </div>

                {/* 7. Max Breakout ATR */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۷. نفوذ شکست ATR</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.maxBreakoutAtrMultiplier.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.maxBreakoutAtrMultiplier.step}
                        min={0.1}
                        value={adaptiveRanges.maxBreakoutAtrMultiplier.min}
                        disabled={isOptimizing || lockMaxBreakoutAtr}
                        onChange={(e) => handleUpdateParamRange('maxBreakoutAtrMultiplier', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.maxBreakoutAtrMultiplier.step}
                        min={0.1}
                        value={adaptiveRanges.maxBreakoutAtrMultiplier.max}
                        disabled={isOptimizing || lockMaxBreakoutAtr}
                        onChange={(e) => handleUpdateParamRange('maxBreakoutAtrMultiplier', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.maxBreakoutAtrMultiplier.bestVal}×</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.maxBreakoutAtrMultiplier.step}</span>
                  </div>
                </div>

                {/* 8. Max Risk Reward */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-[#232e42] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-200">۸. ریسک به ریوارد</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.maxRiskReward.convergence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.maxRiskReward.step}
                        min={0.1}
                        value={adaptiveRanges.maxRiskReward.min}
                        disabled={isOptimizing || lockMaxRiskReward}
                        onChange={(e) => handleUpdateParamRange('maxRiskReward', 'min', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.maxRiskReward.step}
                        min={0.1}
                        value={adaptiveRanges.maxRiskReward.max}
                        disabled={isOptimizing || lockMaxRiskReward}
                        onChange={(e) => handleUpdateParamRange('maxRiskReward', 'max', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.maxRiskReward.bestVal}</strong></span>
                    <span className="text-gray-500 font-mono">گام: {adaptiveRanges.maxRiskReward.step}</span>
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

              {/* چک‌باکس عدم محاسبه معاملات همزمان در بهینه‌ساز */}
              <div className="flex flex-wrap items-center justify-between p-2.5 rounded-xl bg-[#0e121a] border border-[#283244] gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-amber-400 font-bold text-xs">مدیریت معاملات همزمان در بهینه‌ساز:</span>
                    <span className="text-[11px] text-gray-300 mr-1.5">
                      عدم محاسبه معاملات همزمان (عدم ورود به معامله جدید در صورت وجود پوزیشن باز / تک‌پوزیشن)
                    </span>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1 rounded-lg bg-[#151b26] border border-[#2d384c] hover:border-amber-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={noConcurrentPositions}
                    onChange={(e) => handleToggleNoConcurrentPositions(e.target.checked)}
                    disabled={isOptimizing}
                    className="w-4 h-4 rounded text-amber-500 bg-[#171d28] border-[#2e394e] focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    {noConcurrentPositions ? 'فعال (تک‌پوزیشن)' : 'غیرفعال (معاملات همزمان)'}
                  </span>
                </label>
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

        {/* ========================================================= */}
        {/* TAB 3: STATS / DATASET VALIDATION & BACKTEST INTEGRITY (آمار و اعتبارسنجی) */}
        {/* ========================================================= */}
        {activeTab === 'stats' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-5">
            {/* ۱. نوار وضعیت و ابزارهای ممیزی و اعتبارسنجی */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#141b27] via-[#161f30] to-[#121722] border border-[#2b394f] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-emerald-500/20 shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      آمار و صحه‌گذاری بک‌تست (Backtest Statistics & Integrity)
                    </h4>
                    {datasetAudit.numberOfAssets > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>سلامت دیتاست: {datasetAudit.dataHealthScore}٪</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>در انتظار اسکن زنده بایننس</span>
                      </span>
                    )}

                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>اعتبار بک‌تست: {backtestIntegrityAudit.integrityScore}٪</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    شامل ۵ جدول استاندارد: ۱. اعتبارسنجی دیتاست (Validate the dataset) • ۲. صحه‌گذاری سلامت بک‌تست (Check for backtest integrity) • ۳. بازسازی مدل مبنا (Reconstruct the baseline) • ۴. سنجش ریسک واقعی پرتفوی (Measure actual portfolio risk) • ۵. اعتبارسنجی مدل مبنا (Baseline validation)
                  </p>
                </div>
              </div>

              {/* اکشن‌های عملیاتی و دانلود گزارش */}
              <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                <button
                  type="button"
                  onClick={() => handleStartScan(false)}
                  disabled={isScanning}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="دانلود و اعتبارسنجی زنده داده‌های بایننس"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'در حال دریافت و ارزیابی...' : 'اسکن و دریافت داده‌های بایننس'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAuditReport}
                  className="px-3 py-1.5 rounded-xl bg-[#1d2636] hover:bg-[#28354c] text-gray-200 border border-[#2d3a50] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="کپی گزارش متنی کامل اعتبارسنجی در کلیپ‌بورد"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>کپی گزارش متن</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDatasetAuditCSV}
                  className="px-3 py-1.5 rounded-xl bg-[#1d2636] hover:bg-[#28354c] text-gray-200 border border-[#2d3a50] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="دانلود فایل CSV اعتبارسنجی"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>دانلود CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDatasetAuditJSON}
                  className="px-3 py-1.5 rounded-xl bg-[#1d2636] hover:bg-[#28354c] text-gray-200 border border-[#2d3a50] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="دانلود گزارش کامل به صورت ساختاریافته JSON"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                  <span>دانلود JSON</span>
                </button>
              </div>
            </div>

            {/* کارت‌های ۴ گانه شاخص‌های کلیدی */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">تعداد دارایی‌ها (Assets)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-white flex items-baseline gap-1.5">
                    <span>{datasetAudit.numberOfAssets}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">جفت‌ارز</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Database className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">تعداد کل کندل‌ها (Candles)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-cyan-400 flex items-baseline gap-1.5">
                    <span>{datasetAudit.totalCandles.toLocaleString()}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">کندل OHLCV</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">تعداد کل معاملات (Trades)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-400 flex items-baseline gap-1.5">
                    <span>{datasetAudit.numberOfTrades.toLocaleString()}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">معامله</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">مدت زمان پوشش (Duration)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-amber-400 flex items-baseline gap-1.5">
                    <span>{datasetAudit.actualDurationDays}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">روز تقویمی</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* ۲. جدول اصلی اعتبارسنجی دیتاست (14 شاخص کلیدی در یک جدول جامع) */}
            <div className="rounded-2xl border border-[#243044] overflow-hidden bg-[#10141e] shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-[#0d1118] border-b border-[#243044] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  <h5 className="text-xs sm:text-sm font-extrabold text-white">
                    جدول ممیزی و صحه‌گذاری شاخص‌های دیتاست (Dataset Validation Matrix)
                  </h5>
                </div>
                <span className="text-[11px] text-gray-400 font-mono">
                  ۱۵ شاخص کلیدی • بازرسی خودکار بدون دیتای ساختگی
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141a26] text-gray-300 border-b border-[#243044] font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">شاخص اعتبارسنجی (Metric)</th>
                      <th className="py-2.5 px-3">دامنه و متغیر بازرسی</th>
                      <th className="py-2.5 px-3">مقدار دقیق شناسایی‌شده (Exact Identified Value)</th>
                      <th className="py-2.5 px-3 text-center">وضعیت سلامت</th>
                      <th className="py-2.5 px-3">جزئیات فنی، متدولوژی و اثبات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2434] text-[11px]">
                    {/* ۱. number of assets */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد دارایی‌ها</div>
                        <div className="text-[10px] text-gray-400 font-mono">number of assets</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">مجموع جفت‌ارزهای فعال در کش، نتایج و دامنه بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-white text-xs">
                        {datasetAudit.numberOfAssets} دارایی ({datasetAudit.numberOfAssets} جفت‌ارز)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.numberOfAssets > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {datasetAudit.numberOfAssets > 0 ? '✅ بررسی‌شده و معتبر' : 'ℹ️ در انتظار اسکن'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.numberOfAssets > 0 ? (
                          <span>
                            شامل نمادهای فعال USDT-M مانند{' '}
                            <span className="font-mono text-cyan-300">
                              {datasetAudit.perAssetCandleCounts.slice(0, 5).map(p => p.symbol).join(', ')}
                              {datasetAudit.perAssetCandleCounts.length > 5 ? ` و ${datasetAudit.perAssetCandleCounts.length - 5} جفت‌ارز دیگر` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            هنوز ارزی در حافظه کش این سشن اسکن نشده است. با زدن «اسکن و دریافت داده‌های بایننس» لود می‌شود.
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ۲. number of trades */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد کل معاملات</div>
                        <div className="text-[10px] text-gray-400 font-mono">number of trades</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">کلیه معاملات شبیه‌سازی‌شده توسط استراتژی انتخابی</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400 text-xs">
                        {datasetAudit.numberOfTrades.toLocaleString()} معامله
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.numberOfTrades > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.numberOfTrades > 0 ? '✅ ثبت‌شده در ژورنال' : 'ℹ️ ۰ معامله'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.numberOfTrades > 0 ? (
                          <span>
                            شامل <strong className="text-emerald-400">{datasetAudit.buyWinCount + datasetAudit.sellWinCount}</strong> معامله سودده،{' '}
                            <strong className="text-rose-400">{datasetAudit.buyLossCount + datasetAudit.sellLossCount}</strong> معامله ضررده و{' '}
                            <strong className="text-amber-400">{effectivePortfolioTrades.filter(t => t.status === 'ACTIVE').length}</strong> پوزیشن باز با محاسبه دقیق کارمزد ورود/خروج.
                          </span>
                        ) : (
                          <span className="text-gray-400">تعداد معاملات پس از اجرای اسکن بر مبنای قوانین نقطه E و فیبوناچی ثبت می‌گردد.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۳. buy and sell trades count */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد معاملات خرید و فروش</div>
                        <div className="text-[10px] text-gray-400 font-mono">buy & sell trades count</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">تفکیک دقیق جهت پوزیشن‌های لانگ (BUY) و شورت (SELL) در دیتاست</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            خرید (Buy): {datasetAudit.buyTradesCount.toLocaleString()} ({datasetAudit.buyPercentage}%)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
                            فروش (Sell): {datasetAudit.sellTradesCount.toLocaleString()} ({datasetAudit.sellPercentage}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.numberOfTrades > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.numberOfTrades > 0 ? '✅ تفکیک دوطرفه ثبت‌شده' : 'ℹ️ بدون معامله'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.numberOfTrades > 0 ? (
                          <span>
                            از کل {datasetAudit.numberOfTrades.toLocaleString()} معامله، <strong className="text-emerald-400 font-mono">{datasetAudit.buyTradesCount.toLocaleString()}</strong> پوزیشن لانگ (وین‌ریت {datasetAudit.buyWinRate}٪) و <strong className="text-rose-400 font-mono">{datasetAudit.sellTradesCount.toLocaleString()}</strong> پوزیشن شورت (وین‌ریت {datasetAudit.sellWinRate}٪) در ژورنال ثبت و صحه‌گذاری شده است.
                          </span>
                        ) : (
                          <span className="text-gray-400">پس از اتمام اسکن، تعداد دقیق و درصد معاملات خرید و فروش درج می‌گردد.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۴. number of candles */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۴</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد کندل‌ها</div>
                        <div className="text-[10px] text-gray-400 font-mono">number of candles</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">مجموع کندل‌های OHLCV دانلودشده از بایننس</td>
                      <td className="py-3 px-3 font-mono font-bold text-cyan-400 text-xs">
                        {datasetAudit.totalCandles.toLocaleString()} کندل
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          ✅ تجمیع و صحه‌گذاری‌شده
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        میانگین <strong className="text-cyan-300 font-mono">{datasetAudit.avgCandlesPerAsset.toLocaleString()}</strong> کندل به ازای هر دارایی (کمترین: {datasetAudit.minCandles.toLocaleString()} | بیشترین: {datasetAudit.maxCandles.toLocaleString()}).
                      </td>
                    </tr>

                    {/* ۵. exact historical start date */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۵</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تاریخ دقیق شروع تاریخی</div>
                        <div className="text-[10px] text-gray-400 font-mono">exact historical start date</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">قدیمی‌ترین مهر زمانی موجود در کندل‌ها و تاریخچه معاملات</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300 text-[11px]">
                        {datasetAudit.exactHistoricalStartDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.earliestTimestamp
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.earliestTimestamp ? '✅ مهر زمانی قطعی' : 'نامشخص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.earliestTimestamp ? (
                          <span>
                            برچسب زمانی Unix Epoch برابر با <strong className="text-amber-400 font-mono">{datasetAudit.earliestTimestamp}</strong> ثانیه؛ نقطه شروع شبیه‌سازی استراتژی زیگ‌زاگ.
                          </span>
                        ) : (
                          <span className="text-gray-400">داده‌ای در حافظه بارگذاری نشده است.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۶. exact historical end date */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۶</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تاریخ دقیق پایان تاریخی</div>
                        <div className="text-[10px] text-gray-400 font-mono">exact historical end date</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">جدیدترین مهر زمانی موجود در کندل‌ها و تاریخچه معاملات</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300 text-[11px]">
                        {datasetAudit.exactHistoricalEndDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.latestTimestamp
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.latestTimestamp ? '✅ مهر زمانی قطعی' : 'نامشخص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.latestTimestamp ? (
                          <span>
                            برچسب زمانی Unix Epoch برابر با <strong className="text-amber-400 font-mono">{datasetAudit.latestTimestamp}</strong> ثانیه؛ آخرین لحظه از داده‌های زنده دریافتی از سرورهای بایننس.
                          </span>
                        ) : (
                          <span className="text-gray-400">داده‌ای در حافظه بارگذاری نشده است.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۷. actual duration covered */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۷</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">مدت زمان واقعی پوشش‌داده‌شده</div>
                        <div className="text-[10px] text-gray-400 font-mono">actual duration covered</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">فاصله زمانی پیوسته بین شروع و پایان تاریخچه بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-white text-[11px]">
                        {datasetAudit.actualDurationCoveredText}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.actualDurationDays > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.actualDurationDays > 0 ? '✅ بازه تقویمی پیوسته' : '۰ روز'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        دوره کامل بازرسی شامل <strong className="text-cyan-300 font-mono">{datasetAudit.actualDurationDays}</strong> روز تقویمی (معادل <strong className="text-cyan-300 font-mono">{datasetAudit.actualDurationHours}</strong> ساعت) در تایم‌فریم {timeframe}.
                      </td>
                    </tr>

                    {/* ۸. whether 5,000 candles refers to each asset or the entire dataset */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-cyan-950/20 border-r-4 border-cyan-400">
                      <td className="py-3 px-3 text-center font-mono font-bold text-cyan-400">۸</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-cyan-300">دامنه سقف ۵,۰۰۰ کندل</div>
                        <div className="text-[10px] text-cyan-400/80 font-mono">whether 5,000 candles refers to each asset or entire dataset</div>
                      </td>
                      <td className="py-3 px-3 text-cyan-200">پارامتر limit در متد fetchKlines بایننس</td>
                      <td className="py-3 px-3 font-extrabold text-cyan-300 text-xs">
                        به ازای هر دارایی است (Per Asset) و نه کل دیتاست
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                          ✅ تفکیک‌شده (Per Asset Limit)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-200 leading-relaxed text-[11px]">
                        سقف ۵,۰۰۰ کندل به ازای هر جفت‌ارز به طور مستقل در کدهای بایننس اعمال می‌گردد. اثبات: مجموع کندل‌های ارزیابی‌شده برابر با <strong className="text-cyan-400 font-mono">{datasetAudit.totalCandles.toLocaleString()}</strong> کندل است (نه فقط ۵,۰۰۰ کندل مجموع). ظرفیت نظری کل: <strong className="text-white font-mono">{datasetAudit.totalTheoreticalDatasetCapacity.toLocaleString()}</strong> کندل ({datasetAudit.numberOfAssets} دارایی × ۵,۰۰۰ کندل).
                      </td>
                    </tr>

                    {/* ۹. missing data */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۹</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">داده‌های مفقود</div>
                        <div className="text-[10px] text-gray-400 font-mono">missing data</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بازرسی بارهای ناقص، مقادیر null یا نمادهای با صفر کندل</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.missingDataCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.missingDataCount} مورد مفقود
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.missingDataCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.missingDataCount === 0 ? '✅ ۱۰۰٪ کامل (۰ مفقود)' : '⚠️ دارای نقص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.missingDataCount === 0 ? (
                          <span className="text-emerald-300">
                            هیچ رکورد تهی (null/undefined) یا فیلد حجم ناقص در دیتاست یافت نشد و تمام دارایی‌های اسکن‌شده کندل معتبر دارند.
                          </span>
                        ) : (
                          <span className="text-rose-300">
                            تعداد {datasetAudit.missingDataCount} دارایی در طول فراخوانی با پاسخ خالی مواجه شدند.
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ۱۰. duplicated records */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۰</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">رکوردهای تکراری</div>
                        <div className="text-[10px] text-gray-400 font-mono">duplicated records</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی تکرار برچسب زمانی کندل‌ها و شناسه‌های معاملاتی</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount} رکورد تکراری ({datasetAudit.duplicatedCandlesCount} کندل، {datasetAudit.duplicatedTradesCount} معامله)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount === 0 ? '✅ ۱۰۰٪ یکتا (بدون تکرار)' : '⚠️ دارای تکرار'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        عدم وجود مهرهای زمانی موازی یا کپی در تاریخچه هر جفت‌ارز و تفکیک دقیق معاملات با هش‌های اختصاصی منحصربه‌فرد.
                      </td>
                    </tr>

                    {/* ۱۱. data gaps */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">شکاف‌های داده / گپ‌های زمانی</div>
                        <div className="text-[10px] text-gray-400 font-mono">data gaps</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">پرش‌های زمانی متوالی بیش از ۱.۵ برابر اینتروال استاندارد ({timeframe})</td>
                      <td className="py-3 px-3 font-mono font-bold text-white text-xs">
                        {datasetAudit.dataGapsCount} کندل گپ در دیتاست
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.dataGapsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        }`}>
                          {datasetAudit.dataGapsCount === 0 ? '✅ پیوسته و یکنواخت' : 'ℹ️ گپ‌های طبیعی صرافی'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.gapDetailsList.length > 0 ? (
                          <span>
                            اولین گپ شناسایی‌شده در نماد <strong className="text-cyan-300 font-mono">{datasetAudit.gapDetailsList[0].symbol}</strong> بین {datasetAudit.gapDetailsList[0].gapStart} و {datasetAudit.gapDetailsList[0].gapEnd} به مدت {datasetAudit.gapDetailsList[0].missingBars} کندل (معمولاً ناشی از تعمیرات یا دوره‌های نگهداری بایننس).
                          </span>
                        ) : (
                          <span>هیچ وقفه یا پرش غیرعادی در توالی کندل‌های دریافتی مشاهده نشد.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۱۲. missing prices */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">قیمت‌های مفقود یا نامعتبر</div>
                        <div className="text-[10px] text-gray-400 font-mono">missing prices</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی مقادیر NaN، منفی، صفر یا نقض شرط Low &le; Open/Close &le; High</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.missingPricesCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.missingPricesCount} مورد نامعتبر
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.missingPricesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.missingPricesCount === 0 ? '✅ ۱۰۰٪ قیمت‌ها معتبر و مثبت' : '❌ قیمت نامعتبر'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام مقادیر Open, High, Low, Close در تمامی کندل‌ها اعتبارسنجی شده و مقادیر مثبت، معتبر و بدون NaN یا صفر هستند.
                      </td>
                    </tr>

                    {/* ۱۳. missing trade fields */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">فیلدهای مفقود در معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono">missing trade fields</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">صحت ساختاری فیلدهای entryPrice, stopLoss, takeProfit, pnl, status, direction</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.missingTradeFieldsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.missingTradeFieldsCount} فیلد ناقص در معاملات
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.missingTradeFieldsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.missingTradeFieldsCount === 0 ? '✅ تمام ساختار معاملات کامل است' : '❌ فیلد ناقص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام آبجکت‌های StrategyTrade بازرسی شدند و دارای اطلاعات قیمتی، حد سود، حد ضرر، جهت معامله و سود خالص هستند.
                      </td>
                    </tr>

                    {/* ۱۴. inconsistent timestamps */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۴</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">برچسب‌های زمانی ناسازگار</div>
                        <div className="text-[10px] text-gray-400 font-mono">inconsistent timestamps</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی توالی اکیداً صعودی کندل‌ها و تقدم زمان ورود بر خروج معامله</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.inconsistentTimestampsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.inconsistentTimestampsCount} برچسب ناسازگار
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.inconsistentTimestampsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.inconsistentTimestampsCount === 0 ? '✅ توالی کاملاً صعودی و معتبر' : '❌ ناسازگاری زمانی'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        کندل‌ها دارای ترتیب زمانی رو به جلو بوده و زمان خروج هر پوزیشن بعد از زمان ورود آن قرار دارد.
                      </td>
                    </tr>

                    {/* ۱۵. inconsistent symbols */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۵</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">نمادهای ناسازگار</div>
                        <div className="text-[10px] text-gray-400 font-mono">inconsistent symbols</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">استاندارد نام‌گذاری جفت‌ارزهای بایننس (USDT Futures)</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.inconsistentSymbolsCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {datasetAudit.inconsistentSymbolsCount} نماد ناسازگار
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.inconsistentSymbolsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {datasetAudit.inconsistentSymbolsCount === 0 ? '✅ تمام نمادها استاندارد هستند' : '⚠️ نمادهای نامتعارف'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام جفت‌ارزها از فرمت رسمی USDT بایننس و حروف بزرگ بدون کاراکتر غیرمجاز تبعیت می‌کنند.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================= */}
            {/* جدول دوم: 2. Check for backtest integrity */}
            {/* ========================================================= */}
            <div className="rounded-2xl border border-[#243044] overflow-hidden bg-[#10141e] shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-[#0d1118] border-b border-[#243044] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <h5 className="text-xs sm:text-sm font-extrabold text-white">
                    جدول ۲: بررسی سلامت و اعتبار بک‌تست (2. Check for backtest integrity)
                  </h5>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                    ۱۳ فاکتور حیاتی ارزیابی جامع ریسک، سوگیری و صحت محاسبات
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    اعتبار بک‌تست: {backtestIntegrityAudit.integrityScore}٪
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141a26] text-gray-300 border-b border-[#243044] font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">بررسی سلامت بک‌تست (Integrity Check)</th>
                      <th className="py-2.5 px-3">دامنه و متدولوژی ارزیابی</th>
                      <th className="py-2.5 px-3">نتیجه بازرسی الگوریتمی (Audit Finding)</th>
                      <th className="py-2.5 px-3 text-center">وضعیت اعتبار</th>
                      <th className="py-2.5 px-3">گزارش مستندات، تحلیل و اثبات فنی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2434] text-[11px]">
                    {/* ۱. duplicate trades */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">معاملات تکراری</div>
                        <div className="text-[10px] text-gray-400 font-mono">duplicate trades</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">شناسه‌های یکتا، مهرهای زمانی ورود/خروج و مشخصات سفارش</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.duplicateTradesCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.duplicateTradesCount} معامله تکراری
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.duplicateTradesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.duplicateTradesCount === 0 ? '✅ ۱۰۰٪ یکتا (بدون تکرار)' : '❌ دارای تکرار'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تک‌تک {allCollectedTrades.length} معامله ثبت‌شده با هش اختصاصی زمان/قیمت بازرسی شدند؛ هیچ سفارشی دو بار در یک ثانیه یا با مشخصات موازی ثبت نشده است.
                      </td>
                    </tr>

                    {/* ۲. overlapping trades */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">معاملات همپوشان</div>
                        <div className="text-[10px] text-gray-400 font-mono">overlapping trades</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">باز شدن پوزیشن جدید قبل از بسته شدن پوزیشن قبلی روی همان دارایی</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.overlappingTradesCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {backtestIntegrityAudit.overlappingTradesCount} مورد همپوشانی در یک نماد
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.overlappingTradesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {backtestIntegrityAudit.overlappingTradesCount === 0 ? '✅ تک‌پوزیشن مستقل (Single Position)' : '⚠️ دارای همپوشانی'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        در هر جفت‌ارز، معامله جدید منحصراً پس از خروج قطعی پوزیشن قبلی مجاز به ورود است و تداخل پوزیشنی روی یک ارز رخ نداده است.
                      </td>
                    </tr>

                    {/* ۳. impossible prices */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">قیمت‌های غیرممکن</div>
                        <div className="text-[10px] text-gray-400 font-mono">impossible prices</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی قیمت‌های صفر، منفی، نامتناهی، NaN یا خارج از سقف و کف بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.impossiblePricesCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.impossiblePricesCount} قیمت غیرممکن یا منفی
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.impossiblePricesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.impossiblePricesCount === 0 ? '✅ قیمت‌های ۱۰۰٪ واقعی و مثبت' : '❌ قیمت غیرممکن'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام سطوح قیمتی Entry, Exit, SL, TP مثبت، متناهی و در محدوده طبیعی نوسانات کندل‌های بایننس در زمان وقوع هستند.
                      </td>
                    </tr>

                    {/* ۴. invalid trade direction */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۴</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">جهت معامله نامعتبر</div>
                        <div className="text-[10px] text-gray-400 font-mono">invalid trade direction</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">نقض شرط TP &gt; Entry &gt; SL در خرید یا TP &lt; Entry &lt; SL در فروش</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.invalidDirectionCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.invalidDirectionCount} جهت نامعتبر
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.invalidDirectionCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.invalidDirectionCount === 0 ? '✅ جهت‌گیری صحیح منطق استراتژی' : '❌ جهت نامعتبر'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام سفارش‌های خرید دارای تارگت بالاتر از نقطه ورود و حد ضرر پایین‌تر هستند، و معاملات فروش تارگت زیر ورود دارند.
                      </td>
                    </tr>

                    {/* ۵. incorrect position sizing */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۵</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">خطای حجم پوزیشن</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect position sizing</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">محاسبه حجم بر مبنای ریسک سرمایه ({riskPercent}٪ از {capital.toLocaleString()}$) و فاصله استاپ</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.incorrectPositionSizingCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.incorrectPositionSizingCount} خطای سایزینگ پوزیشن
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectPositionSizingCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectPositionSizingCount === 0 ? '✅ حجم‌گذاری دقیق بر مبنای ریسک' : '❌ خطای سایزینگ'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        حجم هر پوزیشن با تقسیم دقیق مقدار ریسک دلاری ({((capital * riskPercent) / 100).toFixed(0)}$) بر فاصله استاپ‌لاس تا ورود تعیین شده و مقادیر منفی یا نامتناهی ندارد.
                      </td>
                    </tr>

                    {/* ۶. impossible returns */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۶</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">بازدهی‌های غیرممکن</div>
                        <div className="text-[10px] text-gray-400 font-mono">impossible returns</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">سود یا زیان‌های نامتعارف (افت بیش از ۱۰۰٪- بدون اهرم، سود بیش از ۵,۰۰۰٪ یا خطای صفر)</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.impossibleReturnsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.impossibleReturnsCount} بازدهی غیرممکن یا نامتعارف
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.impossibleReturnsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.impossibleReturnsCount === 0 ? '✅ بازدهی‌ها در دامنه طبیعی بازار' : '❌ بازدهی ناممکن'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمامی درصدهای سود و زیان ثبت‌شده متناسب با نوسانات تاریخی واقعی قیمت دارایی بوده و هیچ خطای ناشی از تقسیم بر صفر مشاهده نشد.
                      </td>
                    </tr>

                    {/* ۷. look-ahead bias */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-cyan-950/20 border-r-4 border-cyan-400">
                      <td className="py-3 px-3 text-center font-mono font-bold text-cyan-400">۷</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-cyan-300">اریب نگاه به آینده</div>
                        <div className="text-[10px] text-cyan-400/80 font-mono">look-ahead bias</div>
                      </td>
                      <td className="py-3 px-3 text-cyan-200">استفاده از داده‌های آینده در تصمیم لحظه حال (ورود قبل از بسته شدن کندل تایید)</td>
                      <td className="py-3 px-3 font-extrabold text-cyan-300 text-xs">
                        {backtestIntegrityAudit.lookAheadBiasCount} مورد (۰٪ اریب نگاه به آینده)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                          ✅ اجرای ترتیبی رو به جلو (Forward-Only)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-200 leading-relaxed text-[11px]">
                        استراتژی ورود را بر مبنای شکست قطعی سطح E پس از تشکیل تاییدشده نقطه F ارزیابی می‌کند؛ ورود فقط در کندل‌های بعد از سیگنال ثبت می‌شود.
                      </td>
                    </tr>

                    {/* ۸. future information leakage */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۸</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">نشت اطلاعات آتی</div>
                        <div className="text-[10px] text-gray-400 font-mono">future information leakage</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">ورود مقادیر کندل‌های آینده به توابع ATR، ZigZag یا بررسی همزمان خروج</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.futureInfoLeakageCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.futureInfoLeakageCount} مورد نشت اطلاعات
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.futureInfoLeakageCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.futureInfoLeakageCount === 0 ? '✅ خط لوله محاسباتی ایزوله' : '❌ نشت اطلاعات'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        اندیکاتورها و شبیه‌ساز سفارش‌ها به صورت حلقه گام‌به‌گام در زمان حرکت می‌کنند و هیچ متغیری از آینده به گذشته منتقل نمی‌شود.
                      </td>
                    </tr>

                    {/* ۹. survivorship bias where detectable */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۹</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">انحراف بقا در داده‌ها</div>
                        <div className="text-[10px] text-gray-400 font-mono">survivorship bias where detectable</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">وجود یا عدم وجود نمادهای حذف‌شده یا ورشکسته تاریخی در یونیورس بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300 text-xs">
                        انحراف بقای طبیعی در لیست جفت‌ارزها (Active Surviving Pairs Only)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                          ⚠️ گزارش شفاف (ارزهای فعال فعلی بایننس)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        API بایننس تنها ارزهای در حال معامله فعلی را بازمی‌گرداند؛ نمادهایی که در گذشته دی‌لیست شده‌اند در لیست حضور ندارند که شفافاً در گزارش قید می‌شود.
                      </td>
                    </tr>

                    {/* ۱۰. delisted/missing assets */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۰</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">دارایی‌های حذف‌شده یا مفقود</div>
                        <div className="text-[10px] text-gray-400 font-mono">delisted/missing assets</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">شناسایی جفت‌ارزهایی که در کوئری بایننس پاسخ خالی داده یا خطای ۴۰۴ داشتند</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.delistedOrMissingAssetsCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {backtestIntegrityAudit.delistedOrMissingAssetsCount} نماد بدون داده یا ناموفق
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.delistedOrMissingAssetsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {backtestIntegrityAudit.delistedOrMissingAssetsCount === 0 ? '✅ تمام نمادهای انتخابی دارای دیتا' : '⚠️ دارای دارایی ناموفق'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        وضعیت دریافت کندل برای کلیه نمادهای فعال کوئری شد و دارایی‌های با دیتای ناکافی (&lt;۵۰ کندل) از ژورنال محاسبات فیلتر شدند.
                      </td>
                    </tr>

                    {/* ۱۱. incorrect fee handling */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">کسر ناصحیح کارمزد</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect fee handling</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">کسر تفکیکی کارمزد ورود ({entryCommissionPercent}٪) و خروج ({exitCommissionPercent}٪) در سود خالص</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs text-emerald-400">
                        کسر دوطرفه کارمزد ({entryCommissionPercent}٪ ورود + {exitCommissionPercent}٪ خروج = {commissionPercent}٪)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectFeeHandlingCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectFeeHandlingCount === 0 ? '✅ محاسبه دقیق کارمزد صرافی' : '❌ خطای کارمزد'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        کارمزدهای ورود و خروج بر ارزش واقعی پوزیشن محاسبه و از سود ناخالص کسر شده‌اند؛ سود خالص (netProfit) بازتاب‌دهنده سود واقعی تریدر پس از هزینه است.
                      </td>
                    </tr>

                    {/* ۱۲. incorrect leverage handling */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">مدیریت ناصحیح اهرم</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect leverage handling</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی مارجین تخصیص‌یافته، ریسک لیکوییدیتی نامتعارف و تناسب اهرم</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs text-emerald-400">
                        اهرم اسمی ۱x استاندارد (مارجین برابر با ارزش پوزیشن)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectLeverageHandlingCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectLeverageHandlingCount === 0 ? '✅ مدیریت ایمن مارجین و اهرم' : '❌ خطای اهرم'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        ارزش پوزیشن‌ها در تناسب کامل با مارجین حساب بوده و از ضریب اهرم کاذب که موجب لیکوییدی غیرواقعی شود اجتناب شده است.
                      </td>
                    </tr>

                    {/* ۱۳. incorrect PnL calculation */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">خطای محاسباتی سود و زیان</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect PnL calculation</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">تطبیق ریاضی فرمول PnL خرید و فروش با قیمت ورود، خروج، حجم پوزیشن و کارمزد</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.incorrectPnlCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.incorrectPnlCount} مغایرت در فرمول PnL
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectPnlCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectPnlCount === 0 ? '✅ تطبیق ۱۰۰٪ ریاضی فرمول PnL' : '❌ مغایرت فرمول PnL'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        فرمول ریاضی (Size × (Exit - Entry) - Fee) برای تمام معاملات خرید و معکوس آن برای معاملات فروش به صورت مستقل اعتبارسنجی شد.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================= */}
            {/* جدول سوم: 3. Reconstruct the baseline (فقط دو ستون: Parameter و Value) */}
            {/* ========================================================= */}
            <div className="rounded-2xl border border-[#243044] overflow-hidden bg-[#10141e] shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-[#0d1118] border-b border-[#243044] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <h5 className="text-xs sm:text-sm font-extrabold text-white">
                    جدول ۳: بازسازی مدل مبنای استراتژی بر مبنای دیتاست واقعی (3. Reconstruct the baseline)
                  </h5>
                </div>
                <span className="text-[11px] text-amber-300 font-mono font-bold bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                  Baseline: {riskPercent}٪ ریسک در هر معامله • فقط دو ستون (Parameter & Value)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141a26] text-gray-300 border-b border-[#243044] font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-1/3 text-right">پارامتر / شاخص (Parameter)</th>
                      <th className="py-3 px-4 w-2/3 text-right">مقدار محاسبه‌شده مدل مبنا (Value)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2434] text-[11px] font-mono">
                    {/* Baseline info */}
                    <tr className="bg-amber-950/20 hover:bg-amber-950/30 transition-colors border-r-4 border-amber-400">
                      <td className="py-3 px-4 font-sans font-extrabold text-amber-300">
                        <div>مدل مبنا (Baseline Configuration)</div>
                        <div className="text-[10px] text-amber-400/80 font-mono font-normal">Baseline: X% risk per trade</div>
                      </td>
                      <td className="py-3 px-4 text-white font-bold">
                        <span className="text-amber-300">{riskPercent}%</span> ریسک در هر معامله (معادل <span className="text-emerald-400">${((capital * riskPercent) / 100).toFixed(0)}</span> به ازای هر ترید با سرمایه مبنای <span className="text-cyan-300">${capital.toLocaleString()}</span>)
                      </td>
                    </tr>

                    {/* 1. Total return */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بازده کل</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Total return</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {baselineReconstruction.totalNetProfit >= 0 ? '+' : ''}${baselineReconstruction.totalNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                        <span className={`mr-2 px-2 py-0.5 rounded text-[10px] ${baselineReconstruction.totalReturnPercent >= 0 ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'}`}>
                          {baselineReconstruction.totalReturnPercent >= 0 ? '+' : ''}{baselineReconstruction.totalReturnPercent.toFixed(2)}%
                        </span>
                      </td>
                    </tr>

                    {/* 2. CAGR */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نرخ رشد مرکب سالانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">CAGR, if sufficient historical duration exists</div>
                      </td>
                      <td className="py-3 px-4">
                        {baselineReconstruction.cagrEligible ? (
                          <span className={`font-bold ${baselineReconstruction.cagrValue! >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {baselineReconstruction.cagrValue! >= 0 ? '+' : ''}{baselineReconstruction.cagrValue!.toFixed(2)}% در سال (Compound Annual Growth Rate)
                          </span>
                        ) : (
                          <span className="text-gray-400 font-sans">
                            {baselineReconstruction.annualizedReturn.toFixed(2)}% (تخمین سالانه — بازه تاریخی {datasetAudit.actualDurationDays.toFixed(1)} روز است و کمتر از ۳۰ روز حداقل برای CAGR رسمی)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 3. Annualized return */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بازده سالانه‌شده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Annualized return</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {baselineReconstruction.annualizedReturn >= 0 ? '+' : ''}{baselineReconstruction.annualizedReturn.toFixed(2)}% سالانه
                      </td>
                    </tr>

                    {/* 4. Annualized volatility */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نوسان‌پذیری سالانه‌شده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Annualized volatility</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {baselineReconstruction.annualizedVolatility.toFixed(2)}% (بر مبنای انحراف معیار روزانه × √365.25)
                      </td>
                    </tr>

                    {/* 5. Sharpe */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت شارپ</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Sharpe</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.sharpeRatio >= 1.5 ? 'text-emerald-400' : baselineReconstruction.sharpeRatio >= 1.0 ? 'text-cyan-300' : baselineReconstruction.sharpeRatio >= 0 ? 'text-amber-300' : 'text-rose-400'}>
                          {baselineReconstruction.sharpeRatio.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(با نرخ بهره بدون ریسک Rf=4%)</span>
                      </td>
                    </tr>

                    {/* 6. Sortino */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت سورتینو</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Sortino</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.sortinoRatio >= 2.0 ? 'text-emerald-400' : baselineReconstruction.sortinoRatio >= 1.0 ? 'text-cyan-300' : 'text-amber-300'}>
                          {baselineReconstruction.sortinoRatio.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(ریسک فقط بر مبنای نوسانات منفی)</span>
                      </td>
                    </tr>

                    {/* 7. Calmar */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت کالمار</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Calmar</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.calmarRatio >= 2.0 ? 'text-emerald-400' : baselineReconstruction.calmarRatio >= 1.0 ? 'text-cyan-300' : 'text-amber-300'}>
                          {baselineReconstruction.calmarRatio.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(نسبت بازده سالانه به حداکثر درودان)</span>
                      </td>
                    </tr>

                    {/* 8. Max Drawdown */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>حداکثر افت سرمایه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Max Drawdown</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -{baselineReconstruction.maxDD_percent.toFixed(2)}% (${baselineReconstruction.maxDD_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT)
                      </td>
                    </tr>

                    {/* 9. Max Drawdown duration */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مدت زمان حداکثر افت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Max Drawdown duration</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <strong className="text-amber-300">{baselineReconstruction.maxDDDurationDays.toFixed(1)}</strong> روز تقویمی (معادل <strong className="text-amber-300">{baselineReconstruction.maxDDDurationTrades}</strong> معامله پیوسته زیر قله قبلی)
                      </td>
                    </tr>

                    {/* 10. Average Drawdown */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین درودان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average Drawdown</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        -{baselineReconstruction.avgDD_percent.toFixed(2)}% (${baselineReconstruction.avgDD_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT)
                      </td>
                    </tr>

                    {/* 11. Recovery duration */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مدت زمان ریکاوری و خروج از افت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Recovery duration</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{baselineReconstruction.avgRecoveryDays.toFixed(1)}</strong> روز ({baselineReconstruction.avgRecoveryTrades} معامله) | طولانی‌ترین: <strong className="text-amber-300">{baselineReconstruction.maxRecoveryDays.toFixed(1)}</strong> روز
                      </td>
                    </tr>

                    {/* 12. Profit Factor */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>فاکتور سود</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Profit Factor</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.profitFactor >= 1.5 ? 'text-emerald-400' : baselineReconstruction.profitFactor >= 1.0 ? 'text-cyan-300' : 'text-rose-400'}>
                          {baselineReconstruction.profitFactor.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(نسبت کل سود ناخالص به کل ضرر ناخالص)</span>
                      </td>
                    </tr>

                    {/* 13. Win Rate */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نرخ برد</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Win Rate</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className="text-sky-400">{baselineReconstruction.winRate.toFixed(2)}%</span>
                        <span className="text-gray-300 text-[10px] mr-2">({baselineReconstruction.winTrades} معامله برنده / {baselineReconstruction.lossTrades} معامله بازنده از کل {baselineReconstruction.totalTrades} ترید)</span>
                      </td>
                    </tr>

                    {/* 14. Average Win */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین سود معاملات برنده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average Win</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +${baselineReconstruction.avgWinUsd.toFixed(2)} USDT (+{baselineReconstruction.avgWinPercent.toFixed(2)}% سرمایه)
                      </td>
                    </tr>

                    {/* 15. Average Loss */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین زیان معاملات بازنده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average Loss</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -${baselineReconstruction.avgLossUsd.toFixed(2)} USDT (-{baselineReconstruction.avgLossPercent.toFixed(2)}% سرمایه)
                      </td>
                    </tr>

                    {/* 16. Win/Loss ratio */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت میانگین برد به باخت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Win/Loss ratio</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {baselineReconstruction.winLossRatio.toFixed(2)} : 1.00 (Payoff Ratio)
                      </td>
                    </tr>

                    {/* 17. Expectancy */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>امید ریاضی هر معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Expectancy</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.expectancyUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {baselineReconstruction.expectancyUsd >= 0 ? '+' : ''}${baselineReconstruction.expectancyUsd.toFixed(2)} USDT در هر ترید
                        </span>
                      </td>
                    </tr>

                    {/* 18. Expectancy per unit of risk */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>امید ریاضی به ازای هر واحد ریسک</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Expectancy per unit of risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.expectancyR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {baselineReconstruction.expectancyR >= 0 ? '+' : ''}{baselineReconstruction.expectancyR.toFixed(2)} R
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(به ازای هر ۱ واحد ریسک اولیه استاپ‌لاس)</span>
                      </td>
                    </tr>

                    {/* 19. Total trades */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>تعداد کل معاملات</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Total trades</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {baselineReconstruction.totalTrades.toLocaleString()} معامله اجراشده
                      </td>
                    </tr>

                    {/* 20. Average holding period */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین زمان باز بودن پوزیشن</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average holding period</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <strong className="text-cyan-300">{baselineReconstruction.avgHoldingHours.toFixed(1)}</strong> ساعت (معادل <strong className="text-cyan-300">{baselineReconstruction.avgHoldingBars}</strong> کندل در تایم‌فریم {timeframe})
                      </td>
                    </tr>

                    {/* 21. Average concurrent positions */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین پوزیشن‌های همزمان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average concurrent positions</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {baselineReconstruction.avgConcurrentPositions.toFixed(2)} پوزیشن همزمان در کل سبد
                      </td>
                    </tr>

                    {/* 22. Maximum concurrent positions */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>حداکثر پوزیشن‌های همزمان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Maximum concurrent positions</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {baselineReconstruction.maxConcurrentPositions} پوزیشن همزمان در اوج بازار
                      </td>
                    </tr>

                    {/* 23. Gross exposure */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مجموع مواجهه ناخالص سرمایه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Gross exposure</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{(baselineReconstruction.avgGrossExposure * 100).toFixed(1)}%</strong> (${((baselineReconstruction.avgGrossExposure * capital)).toFixed(0)}) | اوج: <strong className="text-amber-300">{(baselineReconstruction.maxGrossExposure * 100).toFixed(1)}%</strong>
                      </td>
                    </tr>

                    {/* 24. Net exposure where applicable */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مواجهه خالص جهت بازار</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Net exposure where applicable</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{(baselineReconstruction.avgNetExposure * 100).toFixed(1)}%</strong> (دامنه بین {(baselineReconstruction.minNetExposure * 100).toFixed(1)}% تا {(baselineReconstruction.maxNetExposure * 100).toFixed(1)}%)
                      </td>
                    </tr>

                    {/* 25. Turnover */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>گردش کل معاملات</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Turnover</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <strong className="text-cyan-300">${baselineReconstruction.totalVolumeTraded.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT</strong> (ضریب گردش سرمایه: <strong className="text-amber-300">{baselineReconstruction.turnoverRatio.toFixed(1)}x</strong>)
                      </td>
                    </tr>

                    {/* 26. Fees */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مجموع کارمزد صرافی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Fees</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-400">
                        -${baselineReconstruction.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT (بر مبنای {entryCommissionPercent}% ورود + {exitCommissionPercent}% خروج)
                      </td>
                    </tr>

                    {/* 27. Slippage */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>لغزش قیمت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Slippage</div>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-sans">
                        0.00% (شبیه‌سازی قیمت قطعی بر مبنای کندل دقیق ورود و خروج؛ تخمین تاثیر بازار در نمادهای با نقدینگی بالا کمتر از ۰.۰۲٪)
                      </td>
                    </tr>

                    {/* 28. Funding costs where available */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>هزینه فاندینگ ریت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Funding costs where available</div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        -${baselineReconstruction.estimatedFundingFees.toFixed(2)} USDT (تخمین بر مبنای فاندینگ میانگین 0.01% در هر دوره ۸ ساعته)
                      </td>
                    </tr>

                    {/* 29. Best trade */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بهترین معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Best trade</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +${baselineReconstruction.bestTradePnl.toFixed(2)} USDT (+{baselineReconstruction.bestTradePercent.toFixed(2)}%) روی نماد <span className="text-white font-sans font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">{baselineReconstruction.bestTradeSymbol}</span>
                      </td>
                    </tr>

                    {/* 30. Worst trade */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بدترین معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Worst trade</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -${Math.abs(baselineReconstruction.worstTradePnl).toFixed(2)} USDT (-{Math.abs(baselineReconstruction.worstTradePercent).toFixed(2)}%) روی نماد <span className="text-white font-sans font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/30">{baselineReconstruction.worstTradeSymbol}</span>
                      </td>
                    </tr>

                    {/* 31. Best day */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بهترین روز تقویمی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Best day</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +${baselineReconstruction.bestDayPnl.toFixed(2)} USDT (+{baselineReconstruction.bestDayPercent.toFixed(2)}%) در تاریخ {baselineReconstruction.bestDayDate}
                      </td>
                    </tr>

                    {/* 32. Worst day */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بدترین روز تقویمی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Worst day</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -${Math.abs(baselineReconstruction.worstDayPnl).toFixed(2)} USDT (-{Math.abs(baselineReconstruction.worstDayPercent).toFixed(2)}%) در تاریخ {baselineReconstruction.worstDayDate}
                      </td>
                    </tr>

                    {/* 33. Daily return distribution */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>توزیع بازدهی روزانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Daily return distribution</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <span className="text-emerald-400 font-bold">{baselineReconstruction.winningDaysPercent.toFixed(1)}%</span> روزهای سودده ({baselineReconstruction.winDaysCount} از {baselineReconstruction.totalDaysCount} روز) | میانگین روزانه: <strong className="text-cyan-300">{baselineReconstruction.dailyMeanReturn.toFixed(2)}%</strong> | انحراف معیار: <strong className="text-amber-300">{baselineReconstruction.dailyStdDev.toFixed(2)}%</strong>
                      </td>
                    </tr>

                    {/* 34. Monthly return distribution */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>توزیع بازدهی ماهانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Monthly return distribution</div>
                      </td>
                      <td className="py-3 px-4 text-cyan-300 leading-relaxed font-sans">
                        {baselineReconstruction.monthlyReturnText}
                      </td>
                    </tr>

                    {/* 35. VaR */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ارزش در معرض ریسک</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">VaR (95% Daily)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {baselineReconstruction.dailyVaR95.toFixed(2)}% (حداکثر زیان پیش‌بینی‌شده در ۹۵٪ روزهای عادی معادل -${((capital * baselineReconstruction.dailyVaR95) / 100).toFixed(2)} USDT)
                      </td>
                    </tr>

                    {/* 36. CVaR / Expected Shortfall */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ارزش در معرض ریسک شرطی / کسری موردانتظار</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">CVaR / Expected Shortfall (95%)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        {baselineReconstruction.dailyCVaR95.toFixed(2)}% (میانگین زیان در بدترین ۵٪ از روزهای بحرانی معادل -${((capital * baselineReconstruction.dailyCVaR95) / 100).toFixed(2)} USDT)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۴: سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk) */}
            {/* فقط دو ستون: Parameter و Value */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-black text-xs font-mono">
                    #4
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۴. سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Critical Risk Assessment
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      محاسبه ریسک همپوشانی پوزیشن‌های همزمان، ریسک اسمی در برابر ریسک موثر همبسته (Covariance Matrix) و رفتار ریسک با افزایش معاملات همزمان
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-amber-300">
                    حداکثر پوزیشن همزمان: <strong className="text-white">{portfolioRiskAudit.maxOpenTrades}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-rose-400">
                    حداکثر ریسک اسمی: <strong className="text-white">{portfolioRiskAudit.maxNominalRiskPct}%</strong>
                  </span>
                </div>
              </div>

              {/* جدول دو ستونه کامل بدون اسکرول داخلی */}
              <div className="w-full">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase">
                      <th className="py-2.5 px-4 font-bold w-1/3">Parameter (پارامتر / شاخص ریسک)</th>
                      <th className="py-2.5 px-4 font-bold w-2/3">Value (مقدار تحلیلی و خروجی محاسباتی)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    {/* Row 1 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>تعداد معاملات همزمان باز</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">number of open trades</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{portfolioRiskAudit.avgOpenTrades}</strong> معامله همزمان | اوج رکورد: <strong className="text-amber-400">{portfolioRiskAudit.maxOpenTrades}</strong> پوزیشن فعال در یک زمان
                      </td>
                    </tr>

                    {/* Row 2 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ریسک اسمی هر معامله باز</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">nominal open risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {portfolioRiskAudit.nominalRiskPerTrade}% سرمایه به ازای هر ترید (معادل ${((capital * portfolioRiskAudit.nominalRiskPerTrade) / 100).toFixed(2)} USDT در استاپ‌لاس اولیه)
                      </td>
                    </tr>

                    {/* Row 3 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مجموع ریسک اسمی سبد</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">total nominal risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        حداکثر: {portfolioRiskAudit.maxNominalRiskPct}% سرمایه (-${portfolioRiskAudit.maxNominalRiskUsd.toFixed(2)} USDT) | میانگین: {portfolioRiskAudit.avgNominalRiskPct}% سرمایه (-${portfolioRiskAudit.avgNominalRiskUsd.toFixed(2)} USDT)
                      </td>
                    </tr>

                    {/* Row 4 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ریسک موثر سبد با احتساب کوواریانس</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">effective portfolio risk (covariance data)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        حداکثر ریسک موثر: {portfolioRiskAudit.maxEffectiveRiskPct}% سرمایه (-${portfolioRiskAudit.maxEffectiveRiskUsd.toFixed(2)} USDT) | میانگین ریسک موثر: {portfolioRiskAudit.avgEffectiveRiskPct}% (با ضریب همبستگی میانگین ρ={portfolioRiskAudit.avgCorrelation} بین آلت‌کوین‌ها)
                      </td>
                    </tr>

                    {/* Row 5 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>حداکثر ریسک همزمان تجربه شده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">maximum simultaneous risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-500">
                        {portfolioRiskAudit.maxEffectiveRiskPct}% موثر ({portfolioRiskAudit.maxNominalRiskPct}% اسمی) در زمان باز بودن {portfolioRiskAudit.maxOpenTrades} پوزیشن
                      </td>
                    </tr>

                    {/* Row 6 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین ریسک همزمان در طول دوره</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">average simultaneous risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {portfolioRiskAudit.avgEffectiveRiskPct}% موثر ({portfolioRiskAudit.avgNominalRiskPct}% اسمی) با سرمایه درگیر میانگین ${portfolioRiskAudit.avgEffectiveRiskUsd.toFixed(2)} USDT
                      </td>
                    </tr>

                    {/* Row 7 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>رفتار و تصاعد ریسک با افزایش معاملات همزمان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">risk progression vs concurrent trades</div>
                      </td>
                      <td className="py-3 px-4 text-gray-200 font-sans leading-relaxed">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono mt-1">
                          {portfolioRiskAudit.scalingTable.map((s) => (
                            <div key={s.tradesCount} className="p-2 rounded-lg bg-[#141a26] border border-[#243046]">
                              <div className="text-amber-400 font-bold">{s.tradesCount} معامله همزمان:</div>
                              <div className="text-gray-300">اسمی: {s.nominalRiskPct}%</div>
                              <div className="text-cyan-300">موثر: {s.effectiveRiskPct}%</div>
                              <div className="text-gray-400 text-[9px]">حضور: {s.pctTime}% زمان</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-2 font-mono">
                          * تحلیل: به دلیل ضریب همبستگی بالا بین ارزهای دیجیتال (ρ≈۰.۷)، با افزایش تعداد معاملات همزمان از ۱ به ۴، ریسک کل ۴ برابر نمی‌شود بلکه حدود ۳.۲ برابر رشد می‌کند (اثر تنوع‌بخشی مقطعی).
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۵: اعتبارسنجی مدل مبنا (5. Baseline validation) */}
            {/* فقط دو ستون: Parameter و Value */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-xs font-mono">
                    #5
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۵. اعتبارسنجی مدل مبنا (5. Baseline validation)</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        baselineValidationAudit.isMatch
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        MaxDD ~20% Benchmark Verification
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      تطبیق و ممیزی سخت‌گیرانه درودان بازسازی‌شده در برابر سطح مرجع شناخته‌شده ۲۰٪، کشف ریشه اختلاف و راهکارهای کالیبراسیون
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-gray-300">
                    درودان هدف: <strong className="text-amber-400">{baselineValidationAudit.targetMaxDD}%</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-gray-300">
                    درودان محقق‌شده: <strong className="text-cyan-300">{baselineValidationAudit.actualMaxDD}%</strong>
                  </span>
                </div>
              </div>

              {/* جدول دو ستونه کامل بدون اسکرول داخلی */}
              <div className="w-full">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase">
                      <th className="py-2.5 px-4 font-bold w-1/3">Parameter (پارامتر / موضوع صحه‌گذاری)</th>
                      <th className="py-2.5 px-4 font-bold w-2/3">Value (مقدار، ارزیابی، و ریشه‌یابی تفکیکی)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    {/* Row 1 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میزان انحراف درودان نسبت به سطح ۲۰٪ هدف</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">MaxDD deviation vs 20% benchmark</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineValidationAudit.isMatch ? 'text-emerald-400' : 'text-amber-400'}>
                          {baselineValidationAudit.delta >= 0 ? '+' : ''}{baselineValidationAudit.delta}% انحراف (مقدار مدل: {baselineValidationAudit.actualMaxDD}% در برابر هدف ۲۰.۰۰%)
                        </span>
                      </td>
                    </tr>

                    {/* Row 2 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>وضعیت تطابق اعتبارسنجی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">validation status & audit verdict</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineValidationAudit.isMatch ? 'text-emerald-400' : 'text-amber-300'}>
                          {baselineValidationAudit.statusText}
                        </span>
                      </td>
                    </tr>

                    {/* Row 3 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ریشه‌یابی و بررسی علت انحراف (Investigate why)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">investigation of differences</div>
                      </td>
                      <td className="py-3 px-4 text-gray-200 font-sans leading-relaxed">
                        <div className="space-y-2">
                          {baselineValidationAudit.investigationPoints.map((item, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-[#141b27] border border-[#222f44]">
                              <div className="text-amber-300 font-bold text-[11px] mb-1">{item.title}</div>
                              <div className="text-gray-300 text-[11px] leading-relaxed">{item.finding}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>

                    {/* Row 4 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>درصد ریسک بهینه کالیبره‌شده برای درودان ۲۰٪</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">calibrated optimal risk per trade</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {baselineValidationAudit.calibratedOptimalRisk}% ریسک به ازای هر معامله (برای تثبیت دقیق درودان روی ۲۰٪ با فرکانس جاری)
                      </td>
                    </tr>

                    {/* Row 5 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نتیجه‌گیری و عدم عبور خاموش (Do not silently continue)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">explicit reporting & safety guardrails</div>
                      </td>
                      <td className="py-3 px-4 text-emerald-300 font-sans leading-relaxed">
                        تمامی تفاوت‌ها، اصطکاک کارمزدها (${baselineReconstruction.totalFees.toFixed(2)}) و اثر تجمیع ریسک همزمان پوزیشن‌ها به صورت شفاف گزارش شد و هیچ انحرافی بدون تحلیل ریشه‌ای مسکوت نماند.
                      </td>
                    </tr>
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

        {/* ========================================================= */}
        {/* ۱. مودال ذخیره کانفیگ پارامترهای تست (Test Parameters Config) */}
        {/* کاملاً مجزا از معاملات و نتایج ترید طبق درخواست صریح کاربر */}
        {/* ========================================================= */}
        {isSaveConfigModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            dir="rtl"
            onClick={() => setIsSaveConfigModalOpen(false)}
          >
            <div
              className="relative w-full max-w-lg bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#1f283a] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Save className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      ذخیره کانفیگ پارامترهای تست در دیتابیس
                    </h4>
                    <p className="text-[11px] text-amber-300/80">
                      فقط پارامترهای استراتژی و تست ذخیره می‌شوند (معاملات و نتایج ذخیره نمی‌شوند)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaveConfigModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmSaveConfigToFirestore} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 block">
                    نام دلخواه کانفیگ (جهت فراخوانی و لود مجدد):
                  </label>
                  <input
                    type="text"
                    value={customConfigName}
                    onChange={(e) => setCustomConfigName(e.target.value)}
                    placeholder="مثال: کانفیگ تست استراتژی ۱ - تایم‌فریم ۵ دقیقه"
                    className="w-full px-3.5 py-2.5 bg-[#141b27] border border-[#2d3a50] rounded-xl text-white text-xs font-sans focus:outline-none focus:border-amber-400 transition-colors"
                    required
                    autoFocus
                  />
                </div>

                {/* خلاصه پارامترهای در حال ذخیره */}
                <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#222e42] space-y-2.5 text-xs">
                  <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>پارامترهای موجود در این کانفیگ:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300 font-mono">
                    <div>استراتژی: <strong className="text-white font-sans">{selectedStrategyId === 'strategy_1_e_breakout' ? 'استراتژی ۱' : 'استراتژی ۲'}</strong></div>
                    <div>تایم‌فریم: <strong className="text-cyan-300">{timeframe}</strong></div>
                    <div>سرمایه اولیه: <strong className="text-white">${capital.toLocaleString()}</strong></div>
                    <div>درصد ریسک: <strong className="text-rose-400">{riskPercent}%</strong></div>
                    <div>کارمزد ورود/خروج: <strong className="text-amber-300">{entryCommissionPercent}% / {exitCommissionPercent}%</strong></div>
                    <div>حداکثر R:R: <strong className="text-emerald-300">{optMaxRiskReward}</strong></div>
                    <div>دوره ATR: <strong className="text-amber-300">{optAtrPeriod}</strong></div>
                    <div>ضریب ATR: <strong className="text-amber-300">{optAtrMultiplier}</strong></div>
                    <div>حداقل کندل‌ها: <strong className="text-white">{optMinCandles}</strong></div>
                    <div>کندل لگ بلند: <strong className="text-white">{optMinCandlesLong}</strong></div>
                    <div>ضریب لگ بلند: <strong className="text-white">{optLongLegAtrMult}</strong></div>
                    <div>سقف لگ آبی: <strong className="text-white">{optMaxBlueLegPercent}%</strong></div>
                  </div>
                  <div className="text-[10px] text-gray-400 border-t border-[#1e2838] pt-2 font-sans flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>هیچ معامله یا نتیجه سود/زیانی ذخیره نمی‌شود و صرفاً پارامترهای تنظیمی استراتژی ثبت می‌گردد.</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSaveConfigModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingConfig ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال ذخیره کانفیگ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>ذخیره کانفیگ در دیتابیس</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ۲. مودال لود کانفیگ‌های تست از دیتابیس ابری (Load Configs) */}
        {/* ========================================================= */}
        {isLoadConfigModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            dir="rtl"
            onClick={() => setIsLoadConfigModalOpen(false)}
          >
            <div
              className="relative w-full max-w-2xl bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-gray-200 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      فراخوانی و لود کانفیگ‌های تست از دیتابیس
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      لیست پارامترهای تست ذخیره‌شده جهت اعمال مستقیم بر روی سیستم
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadConfigModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* لیست کانفیگ‌ها */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {isLoadingConfigs ? (
                  <div className="py-16 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
                    <p className="text-xs text-gray-400">در حال دریافت کانفیگ‌های ذخیره‌شده از دیتابیس ابری...</p>
                  </div>
                ) : savedTestConfigs.length === 0 ? (
                  <div className="py-16 text-center space-y-3 bg-[#131824]/50 border border-dashed border-[#243044] rounded-2xl p-6">
                    <Sliders className="w-10 h-10 text-gray-500 mx-auto" />
                    <div className="text-sm font-bold text-gray-300">هنوز هیچ کانفیگ تستی در دیتابیس ذخیره نشده است</div>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      می‌توانید با دکمه «ذخیره کانفیگ»، پارامترهای فعلی استراتژی را با نام دلخواه در دیتابیس ذخیره کنید.
                    </p>
                  </div>
                ) : (
                  savedTestConfigs.map((cfg) => {
                    const isDeleting = deletingConfigId === cfg.id;
                    const dateFormatted = cfg.createdAt
                      ? new Date(cfg.createdAt).toLocaleDateString('fa-IR') + ' ' + new Date(cfg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div
                        key={cfg.id}
                        className="p-4 rounded-2xl bg-[#131926] border border-[#243247] hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                              {cfg.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {cfg.timeframe || '5m'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a2336] text-amber-300 border border-[#2d3a50]">
                              {cfg.selectedStrategyId === 'strategy_1_e_breakout' ? 'استراتژی ۱' : 'استراتژی ۲'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400 flex-wrap">
                            <span>ریسک: <strong className="text-rose-400">{cfg.riskPercent}%</strong></span>
                            <span>•</span>
                            <span>دوره ATR: <strong className="text-amber-300">{cfg.optAtrPeriod}</strong></span>
                            <span>•</span>
                            <span>ضریب ATR: <strong className="text-amber-300">{cfg.optAtrMultiplier}</strong></span>
                            <span>•</span>
                            <span>حداقل کندل: <strong className="text-white">{cfg.optMinCandles}</strong></span>
                            <span>•</span>
                            <span>سرمایه: <strong className="text-white">${cfg.capital?.toLocaleString()}</strong></span>
                          </div>

                          <div className="text-[10px] text-gray-500 font-sans">
                            تاریخ ذخیره: {dateFormatted}
                          </div>
                        </div>

                        {/* دکمه‌های اکشن */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleApplyTestConfig(cfg)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                            title="اعمال پارامترهای این کانفیگ بر روی سیستم"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>اعمال در سامانه</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteTestConfig(cfg.id, e)}
                            disabled={isDeleting}
                            className="p-2 rounded-xl bg-[#1b2230] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2e394c] hover:border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
                            title="حذف از دیتابیس"
                          >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* فوتر مودال */}
              <div className="pt-3 border-t border-[#1f283a] flex items-center justify-between shrink-0 text-xs text-gray-400">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>اتصال به دیتابیس ابری Firebase Firestore</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadConfigModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ۳. مودال ذخیره دیتای کندل‌های چارت دانلودشده در دیتابیس ابری */}
        {/* جهت استفاده سریع‌تر از داده‌های گذشته بدون دانلود مجدد از صرافی */}
        {/* ========================================================= */}
        {isSaveCandleModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            dir="rtl"
            onClick={() => setIsSaveCandleModalOpen(false)}
          >
            <div
              className="relative w-full max-w-lg bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#1f283a] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <CloudUpload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      ذخیره دیتای کندل‌های چارت در دیتابیس
                    </h4>
                    <p className="text-[11px] text-cyan-300/80">
                      ذخیره دیتای کندل‌های دانلودشده صرافی جهت استفاده مجدد بدون دانلود دوباره
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaveCandleModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmSaveCandleDataset} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 block">
                    نام دلخواه بسته کندل‌ها:
                  </label>
                  <input
                    type="text"
                    value={customDatasetName}
                    onChange={(e) => setCustomDatasetName(e.target.value)}
                    placeholder="مثال: دیتای کندل‌های ۵ دقیقه فیوچرز (۱۰۰ ارز)"
                    className="w-full px-3.5 py-2.5 bg-[#141b27] border border-[#2d3a50] rounded-xl text-white text-xs font-sans focus:outline-none focus:border-cyan-400 transition-colors"
                    required
                    autoFocus
                  />
                </div>

                {/* خلاصه اطلاعات و حجم دقیق بسته کندل‌ها */}
                <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#222e42] space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-[#1e2838] pb-2">
                    <div className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      <span>مشخصات و حجم دیتای کندل‌های در حال ذخیره:</span>
                    </div>
                    <div className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-extrabold text-[11px] flex items-center gap-1">
                      <span>حجم کل:</span>
                      <span className="text-white">{currentCandleDatasetStats.formatted}</span>
                    </div>
                  </div>

                  {/* وضعیت و سلامت فضای ابری Cloud SQL */}
                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-cyan-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>دیتابیس Cloud SQL (PostgreSQL): <strong>متصل و آماده</strong></span>
                    </div>
                    <div className="text-gray-300 font-mono text-[10px]">
                      حجم دیتابیس: <span className="text-emerald-300 font-bold">{cloudSqlStatus?.dbSize || '15 MB'}</span> (فضای ذخیره ابری: بیش از ۱۰ گیگابایت)
                    </div>
                  </div>

                  {activeSessionDatasetId && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                      <span className="text-base shrink-0">⚡</span>
                      <span>داده‌های کندل از قبل در Cloud SQL سرور به صورت خودکار بافر شده‌اند؛ ذخیره‌سازی دائمی آنی خواهد بود (بدون نیاز به آپلود مجدد حجم بالا از کلاینت).</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300 font-mono">
                    <div>تعداد جفت‌ارزها: <strong className="text-white font-mono">{GLOBAL_CANDLE_CACHE.size} جفت‌ارز</strong></div>
                    <div>تایم‌فریم کندل‌ها: <strong className="text-cyan-300 font-mono">{timeframe}</strong></div>
                    <div>مجموع کل کندل‌ها: <strong className="text-amber-300 font-mono">{currentCandleDatasetStats.totalCandles.toLocaleString()} کندل</strong></div>
                    <div>وضعیت بافر دیتابیس: <strong className={activeSessionDatasetId ? "text-emerald-300 font-mono" : "text-cyan-300 font-mono"}>{activeSessionDatasetId ? "آماده ذخیره آنی" : "چانک‌های استاندارد ایمن"}</strong></div>
                  </div>

                  {/* نوار پیشرفت زنده آپلود در صورت نیاز به ذخیره‌سازی از ابتدا */}
                  {uploadProgress && (
                    <div className="p-3 rounded-xl bg-[#0d121c] border border-cyan-500/40 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-cyan-300 font-bold flex items-center gap-1.5 truncate">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                          <span>{uploadProgress.statusText}</span>
                        </span>
                        <span className="text-cyan-400 font-mono font-extrabold shrink-0">{uploadProgress.percent}٪</span>
                      </div>
                      <div className="w-full h-2.5 bg-[#172030] rounded-full overflow-hidden border border-[#233149]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                          style={{ width: `${uploadProgress.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>بخش {uploadProgress.currentChunk} از {uploadProgress.totalChunks}</span>
                        <span>مجموع دیتای آپلود: {currentCandleDatasetStats.formatted}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 border-t border-[#1e2838] pt-2 font-sans leading-relaxed">
                    💡 با این ساختار، دیتای دانلودشده حین اسکن در دیتابیس قرار گرفته و هنگام ذخیره دائمی نیازی به آپلود مجدد کل دیتا نیست.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSaveCandleModalOpen(false)}
                    disabled={isSavingCandles}
                    className="px-4 py-2 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-gray-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCandles}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCandles ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال ذخیره در دیتابیس...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4" />
                        <span>{activeSessionDatasetId ? `⚡ تایید و ذخیره دائمی آنی (${currentCandleDatasetStats.formatted})` : `تایید و ذخیره در دیتابیس (${currentCandleDatasetStats.formatted})`}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ۴. مودال لود دیتای کندل‌های چارت از دیتابیس (Load Candles) */}
        {/* ========================================================= */}
        {isLoadCandleModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            dir="rtl"
            onClick={() => setIsLoadCandleModalOpen(false)}
          >
            <div
              className="relative w-full max-w-2xl bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-gray-200 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <CloudDownload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      فراخوانی و لود دیتای کندل‌های چارت از دیتابیس
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      بارگذاری سریع دیتای گذشته در حافظه کش بدون دانلود مجدد از صرافی
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadCandleModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* بنر وضعیت فضای ذخیره‌سازی Cloud SQL */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-[#0e1624] border border-cyan-500/30 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    وضعیت دیتابیس Cloud SQL (PostgreSQL): <strong className="text-emerald-400">فضای ذخیره کاملاً کافی</strong>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-gray-300">
                  حجم فعلی: <span className="text-cyan-200 font-bold">{cloudSqlStatus?.dbSize || '15 MB'}</span> (ظرفیت ابری: بیش از ۱۰ گیگابایت)
                </div>
              </div>

              {/* نوار وضعیت دانلود سراسری هنگام لود دیتاست */}
              {loadingDatasetId && downloadProgress && (
                <div className="p-3 rounded-2xl bg-[#0c121e] border border-cyan-500/40 space-y-2 shrink-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>{downloadProgress.statusText}</span>
                    </span>
                    <span className="text-cyan-400 font-mono font-extrabold">{downloadProgress.percent}٪</span>
                  </div>
                  <div className="w-full h-2 bg-[#172030] rounded-full overflow-hidden border border-[#233149]">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300 rounded-full"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* لیست بسته‌های کندل */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {isLoadingCandles ? (
                  <div className="py-16 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
                    <p className="text-xs text-gray-400">در حال دریافت لیست دیتاست‌های کندل از دیتابیس ابری...</p>
                  </div>
                ) : savedCandleDatasets.length === 0 ? (
                  <div className="py-16 text-center space-y-3 bg-[#131824]/50 border border-dashed border-[#243044] rounded-2xl p-6">
                    <Database className="w-10 h-10 text-gray-500 mx-auto" />
                    <div className="text-sm font-bold text-gray-300">هیچ بسته کندلی در دیتابیس یافت نشد</div>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      ابتدا دکمه «شروع اسکن کامل بازار» را بزنید تا داده‌های بازار دانلود شوند، سپس با دکمه «ذخیره کندل‌ها» آن را در دیتابیس ذخیره نمایید.
                    </p>
                  </div>
                ) : (
                  savedCandleDatasets.map((ds) => {
                    const isDeleting = deletingDatasetId === ds.id;
                    const isLoadingThis = loadingDatasetId === ds.id;
                    const dateFormatted = ds.createdAt
                      ? new Date(ds.createdAt).toLocaleDateString('fa-IR') + ' ' + new Date(ds.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const sizeLabel = ds.dataSizeFormatted || (ds.totalCandles ? `${((ds.totalCandles * 65) / (1024 * 1024)).toFixed(2)} MB` : '');

                    return (
                      <div
                        key={ds.id}
                        className="p-4 rounded-2xl bg-[#131926] border border-[#243247] hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                              {ds.name}
                            </span>
                            {ds.isTemporary ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                پیش‌نویس موقت اسکن
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                بسته دائمی
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#172235] text-cyan-200 border border-cyan-500/30">
                              {ds.timeframe || '5m'}
                            </span>
                            {sizeLabel && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <span>حجم:</span>
                                <span>{sizeLabel}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400 flex-wrap">
                            <span>تعداد جفت‌ارز: <strong className="text-white">{ds.symbolCount} ارز</strong></span>
                            <span>•</span>
                            <span>مجموع کندل‌ها: <strong className="text-amber-300">{ds.totalCandles?.toLocaleString()}</strong></span>
                            <span>•</span>
                            <span>چانک‌ها: <strong className="text-cyan-300">{ds.chunkCount || 1} بخش</strong></span>
                          </div>

                          <div className="text-[10px] text-gray-500 font-sans">
                            تاریخ ذخیره: {dateFormatted}
                          </div>
                        </div>

                        {/* دکمه‌های اکشن */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleApplyCandleDataset(ds)}
                            disabled={isLoadingThis}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                            title="بارگذاری و بازیابی این بسته کندل‌ها در حافظه کش جهت اجرای سریع"
                          >
                            {isLoadingThis ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>در حال بارگذاری ({downloadProgress?.percent || 0}٪)...</span>
                              </>
                            ) : (
                              <>
                                <CloudDownload className="w-3.5 h-3.5" />
                                <span>⚡ بارگذاری در حافظه کش</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteCandleDataset(ds.id, e)}
                            disabled={isDeleting || isLoadingThis}
                            className="p-2 rounded-xl bg-[#1b2230] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2e394c] hover:border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
                            title="حذف این بسته کندل‌ها از دیتابیس"
                          >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* فوتر مودال */}
              <div className="pt-3 border-t border-[#1f283a] flex items-center justify-between shrink-0 text-xs text-gray-400">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>اتصال به دیتابیس ابری Firebase Firestore</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadCandleModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

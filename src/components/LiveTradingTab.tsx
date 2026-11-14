import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Sliders,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  History,
  Layers,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Trash2,
  Terminal as TerminalIcon,
  Crosshair,
  ExternalLink,
  ChevronRight,
  Flame,
  BarChart3,
  LineChart,
  Save,
  FolderOpen,
  X,
  Loader2,
  Check,
  Eye,
  Search,
  CheckSquare,
  Square,
  Coins,
  Filter,
  AlertCircle,
} from 'lucide-react';
import {
  CandleData,
  CryptoPair,
  ExchangeType,
  ExchangeAccountBalance,
  LivePosition,
  LiveTradeOrder,
  Timeframe,
  ZigZagSettings,
  isXtExcludedSymbol,
} from '../types/crypto';
import { StrategyConfig, DEFAULT_STRATEGY_CONFIG } from '../types/strategy';
import {
  fetchXtBalance,
  fetchXtPositions,
  fetchXtOrderHistory,
  fetchXtPositionHistory,
  createXtOrder,
  closeXtPosition,
  closeAllXtPositions,
  cancelXtOrder,
  fetchXtKlines,
  optimizeXtLiveRiskReward,
  LiveRrOptimizationResult,
  toXtSymbol,
  fromXtSymbol,
} from '../services/xt';
import { fetchKlines } from '../services/binance';
import {
  saveTestConfigToFirestore,
  loadTestConfigsFromFirestore,
  deleteTestConfigFromFirestore,
  TestParameterConfigRecord,
} from '../services/firebase';
import { formatPrice } from '../utils/indicators';
import { getSymbolLotRule } from '../utils/exchangePrecision';

export function formatLivePnl(val: number): string {
  if (!val || val === 0) return '0.00';
  const abs = Math.abs(val);
  if (abs < 0.0001) return val.toFixed(6);
  if (abs < 0.01) return val.toFixed(4);
  return val.toFixed(2);
}

interface LiveTradingTabProps {
  currentPair: CryptoPair;
  exchange: ExchangeType;
  onSelectExchange: (exchange: ExchangeType) => void;
  onSelectPair?: (pair: CryptoPair) => void;
  onSelectTimeframe?: (tf: Timeframe) => void;
  onSelectLiveOrder?: (order: any) => void;
  onClose?: () => void;
  currentUser?: string;
}

interface ScanLogItem {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'trade';
  message: string;
  symbol?: string;
  timeframe?: string;
}

// دیتابیس مارکت‌کپ ارزهای معتبر مارکت (به دلار)
export const KNOWN_MARKET_CAPS: Record<string, number> = {
  BTC: 1340000000000,
  ETH: 325000000000,
  USDT: 118000000000,
  BNB: 88000000000,
  SOL: 76000000000,
  USDC: 35000000000,
  XRP: 34000000000,
  DOGE: 18500000000,
  ADA: 13200000000,
  TRX: 12800000000,
  AVAX: 10400000000,
  SUI: 8900000000,
  LINK: 7600000000,
  SHIB: 7500000000,
  DOT: 6200000000,
  NEAR: 5800000000,
  BCH: 5400000000,
  LTC: 5100000000,
  UNI: 4700000000,
  PEPE: 4100000000,
  APT: 3900000000,
  ICP: 3600000000,
  TAO: 3500000000,
  FET: 3200000000,
  RENDER: 3100000000,
  ETC: 2800000000,
  XLM: 2700000000,
  KAS: 2600000000,
  AAVE: 2500000000,
  INJ: 2400000000,
  TIA: 2200000000,
  FIL: 2100000000,
  WIF: 2000000000,
  SEI: 1900000000,
  ATOM: 1800000000,
  AR: 1700000000,
  HBAR: 1650000000,
  ARB: 1600000000,
  OP: 1550000000,
  STX: 1500000000,
  BONK: 1400000000,
  FLOKI: 1350000000,
  RUNE: 1300000000,
  PENDLE: 1250000000,
  JUP: 1200000000,
  ONDO: 1150000000,
  FTM: 1100000000,
  WLD: 1050000000,
  GALA: 850000000,
  LDO: 820000000,
  CRV: 450000000,
};

export function getEstimatedMarketCap(baseAsset: string, volume24h?: number): number {
  const upper = (baseAsset || '').toUpperCase();
  if (KNOWN_MARKET_CAPS[upper]) {
    return KNOWN_MARKET_CAPS[upper];
  }
  if (volume24h && volume24h > 0) {
    return Math.round(volume24h * 8.5);
  }
  return 60000000;
}

export function formatMarketCap(val: number): string {
  if (!val || isNaN(val)) return '$0';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export function getMaxLeverageForSymbol(rawSymbol: string): number {
  const base = rawSymbol.replace('_', '').replace('USDT', '').toUpperCase();
  if (base === 'BTC') return 100;
  if (base === 'ETH') return 75;
  if (['SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LTC', 'BCH'].includes(base)) return 50;
  if (['SUI', 'NEAR', 'AVAX', 'LINK', 'PEPE', 'SHIB', 'DOT', 'APT', 'FET', 'RENDER'].includes(base)) return 25;
  return 20;
}

export function getTimeframeMsHelper(tf: string): number {
  switch (tf) {
    case '1m': return 60 * 1000;
    case '3m': return 3 * 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '30m': return 30 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '2h': return 2 * 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '8h': return 8 * 60 * 60 * 1000;
    case '12h': return 12 * 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 5 * 60 * 1000;
  }
}

interface CandidateSignal {
  sym: string;
  posSide: 'LONG' | 'SHORT';
  side: 'BUY' | 'SELL';
  curPrice: number;
  stopLoss: number;
  takeProfit: number;
  contractQty: number;
  stepSize?: number;
  qtyPrecision?: number;
  maxLeverage: number;
  requiredMargin: number;
  notionalUsdt: number;
  riskUsdt: number;
  targetRiskUsdt?: number;
  strategyName: string;
}

export const COMPREHENSIVE_FALLBACK_PAIRS: CryptoPair[] = [
  { symbol: 'btc_usdt', baseAsset: 'BTC', quoteAsset: 'USDT', name: 'Bitcoin', category: 'Futures', volume24h: 38500000000 },
  { symbol: 'eth_usdt', baseAsset: 'ETH', quoteAsset: 'USDT', name: 'Ethereum', category: 'Futures', volume24h: 18200000000 },
  { symbol: 'sol_usdt', baseAsset: 'SOL', quoteAsset: 'USDT', name: 'Solana', category: 'Futures', volume24h: 6400000000 },
  { symbol: 'bnb_usdt', baseAsset: 'BNB', quoteAsset: 'USDT', name: 'BNB Chain', category: 'Futures', volume24h: 1800000000 },
  { symbol: 'xrp_usdt', baseAsset: 'XRP', quoteAsset: 'USDT', name: 'Ripple', category: 'Futures', volume24h: 2200000000 },
  { symbol: 'doge_usdt', baseAsset: 'DOGE', quoteAsset: 'USDT', name: 'Dogecoin', category: 'Futures', volume24h: 1900000000 },
  { symbol: 'ada_usdt', baseAsset: 'ADA', quoteAsset: 'USDT', name: 'Cardano', category: 'Futures', volume24h: 850000000 },
  { symbol: 'trx_usdt', baseAsset: 'TRX', quoteAsset: 'USDT', name: 'Tron', category: 'Futures', volume24h: 620000000 },
  { symbol: 'avax_usdt', baseAsset: 'AVAX', quoteAsset: 'USDT', name: 'Avalanche', category: 'Futures', volume24h: 740000000 },
  { symbol: 'sui_usdt', baseAsset: 'SUI', quoteAsset: 'USDT', name: 'Sui Network', category: 'Futures', volume24h: 1100000000 },
  { symbol: 'link_usdt', baseAsset: 'LINK', quoteAsset: 'USDT', name: 'Chainlink', category: 'Futures', volume24h: 580000000 },
  { symbol: 'shib_usdt', baseAsset: 'SHIB', quoteAsset: 'USDT', name: 'Shiba Inu', category: 'Futures', volume24h: 490000000 },
  { symbol: 'dot_usdt', baseAsset: 'DOT', quoteAsset: 'USDT', name: 'Polkadot', category: 'Futures', volume24h: 420000000 },
  { symbol: 'near_usdt', baseAsset: 'NEAR', quoteAsset: 'USDT', name: 'NEAR Protocol', category: 'Futures', volume24h: 530000000 },
  { symbol: 'bch_usdt', baseAsset: 'BCH', quoteAsset: 'USDT', name: 'Bitcoin Cash', category: 'Futures', volume24h: 390000000 },
  { symbol: 'ltc_usdt', baseAsset: 'LTC', quoteAsset: 'USDT', name: 'Litecoin', category: 'Futures', volume24h: 450000000 },
  { symbol: 'uni_usdt', baseAsset: 'UNI', quoteAsset: 'USDT', name: 'Uniswap', category: 'Futures', volume24h: 320000000 },
  { symbol: 'pepe_usdt', baseAsset: 'PEPE', quoteAsset: 'USDT', name: 'Pepe', category: 'Futures', volume24h: 980000000 },
  { symbol: 'apt_usdt', baseAsset: 'APT', quoteAsset: 'USDT', name: 'Aptos', category: 'Futures', volume24h: 310000000 },
  { symbol: 'icp_usdt', baseAsset: 'ICP', quoteAsset: 'USDT', name: 'Internet Computer', category: 'Futures', volume24h: 240000000 },
  { symbol: 'tao_usdt', baseAsset: 'TAO', quoteAsset: 'USDT', name: 'Bittensor', category: 'Futures', volume24h: 280000000 },
  { symbol: 'fet_usdt', baseAsset: 'FET', quoteAsset: 'USDT', name: 'Artificial Superintelligence', category: 'Futures', volume24h: 330000000 },
  { symbol: 'render_usdt', baseAsset: 'RENDER', quoteAsset: 'USDT', name: 'Render Token', category: 'Futures', volume24h: 290000000 },
  { symbol: 'etc_usdt', baseAsset: 'ETC', quoteAsset: 'USDT', name: 'Ethereum Classic', category: 'Futures', volume24h: 210000000 },
  { symbol: 'xlm_usdt', baseAsset: 'XLM', quoteAsset: 'USDT', name: 'Stellar', category: 'Futures', volume24h: 260000000 },
  { symbol: 'kas_usdt', baseAsset: 'KAS', quoteAsset: 'USDT', name: 'Kaspa', category: 'Futures', volume24h: 190000000 },
  { symbol: 'aave_usdt', baseAsset: 'AAVE', quoteAsset: 'USDT', name: 'Aave', category: 'Futures', volume24h: 230000000 },
  { symbol: 'inj_usdt', baseAsset: 'INJ', quoteAsset: 'USDT', name: 'Injective', category: 'Futures', volume24h: 180000000 },
  { symbol: 'tia_usdt', baseAsset: 'TIA', quoteAsset: 'USDT', name: 'Celestia', category: 'Futures', volume24h: 210000000 },
  { symbol: 'fil_usdt', baseAsset: 'FIL', quoteAsset: 'USDT', name: 'Filecoin', category: 'Futures', volume24h: 170000000 },
  { symbol: 'wif_usdt', baseAsset: 'WIF', quoteAsset: 'USDT', name: 'dogwifhat', category: 'Futures', volume24h: 520000000 },
  { symbol: 'sei_usdt', baseAsset: 'SEI', quoteAsset: 'USDT', name: 'Sei', category: 'Futures', volume24h: 190000000 },
  { symbol: 'atom_usdt', baseAsset: 'ATOM', quoteAsset: 'USDT', name: 'Cosmos', category: 'Futures', volume24h: 160000000 },
  { symbol: 'ar_usdt', baseAsset: 'AR', quoteAsset: 'USDT', name: 'Arweave', category: 'Futures', volume24h: 150000000 },
  { symbol: 'hbar_usdt', baseAsset: 'HBAR', quoteAsset: 'USDT', name: 'Hedera', category: 'Futures', volume24h: 180000000 },
  { symbol: 'arb_usdt', baseAsset: 'ARB', quoteAsset: 'USDT', name: 'Arbitrum', category: 'Futures', volume24h: 240000000 },
  { symbol: 'op_usdt', baseAsset: 'OP', quoteAsset: 'USDT', name: 'Optimism', category: 'Futures', volume24h: 220000000 },
  { symbol: 'stx_usdt', baseAsset: 'STX', quoteAsset: 'USDT', name: 'Stacks', category: 'Futures', volume24h: 140000000 },
  { symbol: 'bonk_usdt', baseAsset: 'BONK', quoteAsset: 'USDT', name: 'Bonk', category: 'Futures', volume24h: 310000000 },
  { symbol: 'floki_usdt', baseAsset: 'FLOKI', quoteAsset: 'USDT', name: 'Floki', category: 'Futures', volume24h: 270000000 },
  { symbol: 'rune_usdt', baseAsset: 'RUNE', quoteAsset: 'USDT', name: 'THORChain', category: 'Futures', volume24h: 160000000 },
  { symbol: 'pendle_usdt', baseAsset: 'PENDLE', quoteAsset: 'USDT', name: 'Pendle', category: 'Futures', volume24h: 180000000 },
  { symbol: 'jup_usdt', baseAsset: 'JUP', quoteAsset: 'USDT', name: 'Jupiter', category: 'Futures', volume24h: 190000000 },
  { symbol: 'ondo_usdt', baseAsset: 'ONDO', quoteAsset: 'USDT', name: 'Ondo', category: 'Futures', volume24h: 150000000 },
  { symbol: 'ftm_usdt', baseAsset: 'FTM', quoteAsset: 'USDT', name: 'Fantom', category: 'Futures', volume24h: 130000000 },
  { symbol: 'wld_usdt', baseAsset: 'WLD', quoteAsset: 'USDT', name: 'Worldcoin', category: 'Futures', volume24h: 210000000 },
  { symbol: 'gala_usdt', baseAsset: 'GALA', quoteAsset: 'USDT', name: 'Gala', category: 'Futures', volume24h: 110000000 },
  { symbol: 'crv_usdt', baseAsset: 'CRV', quoteAsset: 'USDT', name: 'Curve DAO', category: 'Futures', volume24h: 90000000 },
];

export const DEFAULT_POPULAR_WATCHLIST = [
  'btc_usdt', 'eth_usdt', 'sol_usdt', 'xrp_usdt', 'doge_usdt',
  'sui_usdt', 'ada_usdt', 'near_usdt', 'avax_usdt', 'link_usdt',
  '1000pepe_usdt', '1000shib_usdt', 'dot_usdt', 'ltc_usdt', 'apt_usdt',
];

export const LiveTradingTab: React.FC<LiveTradingTabProps> = ({
  currentPair,
  exchange,
  onSelectExchange,
  onSelectPair,
  onSelectTimeframe,
  onSelectLiveOrder,
  onClose,
  currentUser = 'amir',
}) => {
  // Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Account Balance State
  const [balance, setBalance] = useState<ExchangeAccountBalance>({
    exchange: 'xt',
    coin: 'USDT',
    walletBalance: 35.0,
    availableBalance: 35.0,
    frozenBalance: 0,
    unrealizedPnl: 0,
    totalEquity: 35.0,
    updatedAt: '',
  });
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // 2. Open Positions & Trade History
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [closingPosSymbol, setClosingPosSymbol] = useState<string | null>(null);
  const [isClosingAll, setIsClosingAll] = useState<boolean>(false);
  const [tradeHistory, setTradeHistory] = useState<LiveTradeOrder[]>(() => {
    try {
      const saved = localStorage.getItem('live_trade_history_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 3. Execution Mode: Live on XT vs Paper Simulation
  const [isLiveExecution, setIsLiveExecution] = useState<boolean>(true);

  // 4. Strategy & Order Execution Settings (پیش‌فرض: استراتژی دوم Next-Pivot)
  const [selectedStrategy, setSelectedStrategy] = useState<'strategy_1_e_breakout' | 'strategy_2_next_pivot'>('strategy_2_next_pivot');
  const [selectedTimeframes, setSelectedTimeframes] = useState<Timeframe[]>(() => {
    try {
      const saved = localStorage.getItem('livetrade_timeframes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ['5m'];
  });
  const [tradeTimeframe, setTradeTimeframe] = useState<Timeframe>(() => selectedTimeframes[0] || '5m');
  const [activeDbTrades, setActiveDbTrades] = useState<any[]>([]);
  const [allDbTrades, setAllDbTrades] = useState<any[]>([]);
  const [riskRewardRatio, setRiskRewardRatio] = useState<number>(3.0);

  const handleToggleTimeframe = (tf: Timeframe) => {
    setSelectedTimeframes((prev) => {
      let next: Timeframe[];
      if (prev.includes(tf)) {
        if (prev.length <= 1) return prev; // Keep at least one selected
        next = prev.filter((t) => t !== tf);
      } else {
        next = [...prev, tf];
      }
      setTradeTimeframe(next[0]);
      try {
        localStorage.setItem('livetrade_timeframes', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // نحوه محاسبه ریسک: درصدی از موجودی زنده ('percent') یا مبلغ ثابت دلاری ('fixed')
  const [riskMode, setRiskMode] = useState<'percent' | 'fixed'>(() => {
    try {
      const saved = localStorage.getItem('livetrade_risk_mode');
      return saved === 'fixed' ? 'fixed' : 'percent';
    } catch {
      return 'percent';
    }
  });

  // مقدار ریسک ثابت دلاری (مثلاً ۱۰۰ دلار که در هر معامله در صورت استاپ فقط همین مقدار ضرر شود)
  const [riskAmountFixed, setRiskAmountFixed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('livetrade_risk_amount_fixed');
      return saved !== null ? parseFloat(saved) : 50;
    } catch {
      return 50;
    }
  });

  // درصد ریسک در هر معامله از کل حساب (در صورت استاپ، این درصد از موجودی به‌روز ضرر می‌شود)
  const [riskPercent, setRiskPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('livetrade_risk_percent');
      return saved !== null ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  // لیست جفت‌ارزهای فعال انتخابی کاربر برای اسکن خودکار
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('livetrade_selected_symbols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((s: string) => !isXtExcludedSymbol(s));
          if (clean.length > 0) return clean;
        }
      }
    } catch {}
    return DEFAULT_POPULAR_WATCHLIST;
  });

  // مودال انتخاب ارزها و مارکت‌کپ
  const [isPairsModalOpen, setIsPairsModalOpen] = useState<boolean>(false);
  const [allAvailablePairs, setAllAvailablePairs] = useState<CryptoPair[]>(() => {
    return COMPREHENSIVE_FALLBACK_PAIRS
      .filter((p) => !isXtExcludedSymbol(p.symbol))
      .map((p) => ({
        ...p,
        marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
      })).sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
  });
  const [isLoadingAllPairs, setIsLoadingAllPairs] = useState<boolean>(false);
  const [tempSelectedSymbols, setTempSelectedSymbols] = useState<Set<string>>(
    () => new Set(selectedSymbols.filter((s) => !isXtExcludedSymbol(s)))
  );
  const [pairsSearchQuery, setPairsSearchQuery] = useState<string>('');
  const [filterOnlyOpenApi, setFilterOnlyOpenApi] = useState<boolean>(true);

  const filteredPairs = useMemo(() => {
    let list = allAvailablePairs.length > 0
      ? allAvailablePairs
      : COMPREHENSIVE_FALLBACK_PAIRS.map((p) => ({
          ...p,
          marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
        }));

    // فیلتر ارزهای بدون OpenAPI (۴۰۶ نماد غیرمجاز XT)
    if (exchange === 'xt' && filterOnlyOpenApi) {
      list = list.filter((p) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false);
    }

    // فیلتر کامل ۳۶ نماد غیرمجاز XT (فارکس، شاخص و کامودیتی)
    if (exchange === 'xt') {
      list = list.filter((p) => !isXtExcludedSymbol(p.symbol));
    }

    if (!pairsSearchQuery.trim()) return list;
    const q = pairsSearchQuery.trim().toLowerCase();
    return list.filter((p) =>
      p.symbol.toLowerCase().includes(q) ||
      (p.baseAsset && p.baseAsset.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  }, [allAvailablePairs, pairsSearchQuery, exchange, filterOnlyOpenApi]);

  const apiSupportedCount = useMemo(() => {
    return allAvailablePairs.filter((p) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false).length;
  }, [allAvailablePairs]);

  const unsupportedCount = useMemo(() => {
    return allAvailablePairs.filter((p) => p.isApiSupported === false || p.isOpenApi === false || p.tradeSwitch === false).length;
  }, [allAvailablePairs]);

  const selectedUnsupportedCount = useMemo(() => {
    const unsupportedSet = new Set(
      allAvailablePairs
        .filter((p) => p.isApiSupported === false || p.isOpenApi === false || p.tradeSwitch === false)
        .map((p) => p.symbol)
    );
    let count = 0;
    for (const s of tempSelectedSymbols) {
      if (unsupportedSet.has(s)) count++;
    }
    return count;
  }, [allAvailablePairs, tempSelectedSymbols]);

  const handleRemoveUnsupportedSymbols = () => {
    const unsupportedSet = new Set(
      allAvailablePairs
        .filter((p) => p.isApiSupported === false || p.isOpenApi === false || p.tradeSwitch === false)
        .map((p) => p.symbol)
    );
    setTempSelectedSymbols((prev) => {
      const next = new Set<string>();
      for (const s of prev) {
        if (!unsupportedSet.has(s)) next.add(s);
      }
      return next;
    });
    showToast(`🧹 تمامی ارزهای بدون پشتیبانی API با موفقیت از انتخاب‌ها حذف شدند.`);
  };

  const handleOpenPairsModal = async () => {
    setIsPairsModalOpen(true);
    setTempSelectedSymbols(new Set(selectedSymbols.filter((s) => !isXtExcludedSymbol(s))));
    try {
      setIsLoadingAllPairs(true);
      const res = await fetch(`/api/market/pairs?exchange=${exchange}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
        const mapped = data.pairs
          .filter((p: any) => !isXtExcludedSymbol(p.symbol || ''))
          .map((p: any) => ({
            ...p,
            baseAsset: p.baseAsset || p.symbol.split('_')[0].toUpperCase(),
            marketCap: p.marketCap || getEstimatedMarketCap(p.baseAsset || p.symbol.split('_')[0], p.volume24h),
          })).sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
        setAllAvailablePairs(mapped);
      }
    } catch (err) {
      console.warn('Using cached pairs for modal', err);
    } finally {
      setIsLoadingAllPairs(false);
    }
  };

  const handleSaveSelectedPairs = () => {
    const arr = Array.from(tempSelectedSymbols).filter((s) => !isXtExcludedSymbol(s));
    if (arr.length === 0) {
      showToast('⚠️ حداقل باید ۱ ارز برای اسکن انتخاب شود.');
      return;
    }
    setSelectedSymbols(arr);
    try {
      localStorage.setItem('livetrade_selected_symbols', JSON.stringify(arr));
    } catch {}
    setIsPairsModalOpen(false);
    showToast(`✅ لیست ${arr.length} ارز جهت اسکن با موفقیت ذخیره شد.`);
    addLog('info', `📋 لیست ارزهای اسکن خودکار به ${arr.length} ارز به‌روزرسانی و ذخیره گردید.`);
  };

  const handleToggleSelectAllPairs = () => {
    const eligibleSymbols = filteredPairs.map((p) => p.symbol);
    const allEligibleSelected = eligibleSymbols.every((s) => tempSelectedSymbols.has(s));
    if (allEligibleSelected) {
      setTempSelectedSymbols((prev) => {
        const next = new Set(prev);
        eligibleSymbols.forEach((s) => next.delete(s));
        return next;
      });
    } else {
      setTempSelectedSymbols((prev) => {
        const next = new Set(prev);
        eligibleSymbols.forEach((s) => next.add(s));
        return next;
      });
    }
  };

  const handleSelectTopPairs = (count: number) => {
    const list = exchange === 'xt' && filterOnlyOpenApi
      ? allAvailablePairs.filter((p) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false)
      : allAvailablePairs;
    const top = list.slice(0, count).map((p) => p.symbol);
    setTempSelectedSymbols(new Set(top));
    showToast(`🎯 ${count} ارز برتر مارکت انتخاب شدند.`);
  };

  // چک‌باکس: عدم ورود به معامله جدید در صورت وجود پوزیشن باز (تک‌پوزیشن)
  const [noConcurrentPositions, setNoConcurrentPositions] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('livetrade_no_concurrent_positions');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // خروج زمانی (Time-Stop): حداکثر تعداد کندل ماندن در معامله
  const [timeStopEnabled, setTimeStopEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('livetrade_time_stop_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [timeStopCandles, setTimeStopCandles] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('livetrade_time_stop_candles');
      return saved !== null ? parseInt(saved, 10) : 80;
    } catch {
      return 80;
    }
  });

  const [maxPositionToRiskRatio, setMaxPositionToRiskRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('livetrade_max_pos_to_risk_ratio');
      if (saved !== null) return parseFloat(saved) || 300;
    } catch {}
    return 300;
  });

  // تبدیل و فرمت زمان به ارقام انگلیسی همراه با تاریخ کامل (YYYY-MM-DD HH:mm:ss)
  const formatOrderDateTimeEn = (order: any): string => {
    const ms = order.exitTimeMs || order.entryTimeMs || order.rawTimeMs || order.timestampMs || order.time;
    if (ms && !isNaN(Number(ms))) {
      const d = new Date(Number(ms));
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (order.timeEn && typeof order.timeEn === 'string') {
      return order.timeEn;
    }
    if (order.timestamp && typeof order.timestamp === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(order.timestamp)) {
        return order.timestamp;
      }
      const parsed = Date.parse(order.timestamp);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    }
    return order.timestamp || '---';
  };

  // فرمت کوتاه ستون استراتژی صرفاً به صورت «استراتژی ۱» یا «استراتژی ۲»
  const formatStrategyShort = (strategyName?: string, matchedName?: string): string => {
    const combined = `${strategyName || ''} ${matchedName || ''}`.toLowerCase();
    if (combined.includes('1') || combined.includes('breakout') || combined.includes('شکست')) {
      return 'استراتژی ۱';
    }
    return 'استراتژی ۲';
  };

  // کلیک روی ردیف پوزیشن یا تاریخچه برای نمایش چارت جفت‌ارز و ستاپ معامله در تب اصلی چارت (مشابه تریدینگ‌ویو)
  const handleNavigateToChart = (rawSymbol: string, orderData?: any) => {
    const clean = exchange === 'xt' ? toXtSymbol(rawSymbol) : rawSymbol.replace('_', '').toUpperCase();
    const base = clean.includes('_') ? clean.split('_')[0].toUpperCase() : clean.replace(/USDT$/i, '');
    const pair: CryptoPair = {
      symbol: clean,
      baseAsset: base,
      quoteAsset: 'USDT',
      name: fromXtSymbol(clean),
      category: 'Futures',
    };
    const targetTf = (orderData?.timeframe || tradeTimeframe || '5m') as Timeframe;
    showToast(`📊 انتقال به چارت تحلیلی نماد ${fromXtSymbol(clean)} در تایم‌فریم ${targetTf}`);
    addLog('info', `📊 انتقال به تب چارت برای بررسی ${fromXtSymbol(clean)} (${targetTf})`, clean);
    if (onSelectTimeframe && targetTf) {
      onSelectTimeframe(targetTf);
    }
    if (orderData && onSelectLiveOrder) {
      const tradeTimestampMs = orderData.entryTimeMs ||
                               orderData.rawTimeMs ||
                               orderData.timestampMs ||
                               orderData.ctime ||
                               orderData.timeMs ||
                               (typeof orderData.time === 'number' ? orderData.time : undefined) ||
                               (typeof orderData.timestamp === 'number' ? orderData.timestamp : undefined);

      onSelectLiveOrder({
        ...orderData,
        symbol: clean,
        timeframe: targetTf,
        price: orderData.price || orderData.entryPrice || 0,
        stopLossPrice: orderData.stopLossPrice || orderData.stopLoss || 0,
        takeProfitPrice: orderData.takeProfitPrice || orderData.takeProfit || 0,
        side: orderData.side || orderData.positionSide || 'BUY',
        positionSide: orderData.positionSide || orderData.side || 'LONG',
        tradeTimeMs: tradeTimestampMs,
        entryTime: tradeTimestampMs || orderData.entryTime || orderData.time || orderData.timestamp,
        time: tradeTimestampMs || orderData.time || orderData.timestamp,
        timestamp: orderData.timestamp || orderData.time,
        rawTimeMs: tradeTimestampMs,
      });
    } else {
      onSelectPair?.(pair);
    }
    onClose?.();
  };

  // ذخیره و لود کانفیگ‌های تست از دیتابیس ابری (مشابه با لود کانفیگ در بکتست)
  const [isSaveConfigModalOpen, setIsSaveConfigModalOpen] = useState<boolean>(false);
  const [isLoadConfigModalOpen, setIsLoadConfigModalOpen] = useState<boolean>(false);
  const [customConfigName, setCustomConfigName] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(false);
  const [savedTestConfigs, setSavedTestConfigs] = useState<TestParameterConfigRecord[]>([]);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);

  // ZigZag Strategy Parameters
  const [atrPeriod, setAtrPeriod] = useState<number>(24);
  const [atrMultiplier, setAtrMultiplier] = useState<number>(2.4);
  const [longLegAtrMultiplier, setLongLegAtrMultiplier] = useState<number>(8.0);
  const [minCandles, setMinCandles] = useState<number>(2);
  const [minCandlesForLongLeg, setMinCandlesForLongLeg] = useState<number>(10);
  const [minCandlesForBlueLeg, setMinCandlesForBlueLeg] = useState<number>(2);
  const [blueLegAtrMultiplier, setBlueLegAtrMultiplier] = useState<number>(2.0);
  const [maxBlueLegPercent, setMaxBlueLegPercent] = useState<number>(50);
  const [maxBreakoutAtrMultiplier, setMaxBreakoutAtrMultiplier] = useState<number>(3.0);
  const [maxCandlesToEnter, setMaxCandlesToEnter] = useState<number>(35);
  const [entryCommissionPercent, setEntryCommissionPercent] = useState<number>(0.06);
  const [exitCommissionPercent, setExitCommissionPercent] = useState<number>(0.06);
  const [slSlippagePercent, setSlSlippagePercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('livetrade_sl_slippage_percent');
      if (saved !== null) return parseFloat(saved);
    } catch {}
    return exchange === 'binance' ? 0 : 0.04;
  });

  // 5. 5-Minute Auto-Scanner Loop State
  const [isAutoScanning, setIsAutoScanning] = useState<boolean>(false);
  const [serverStartedAt, setServerStartedAt] = useState<string | null>(null);
  const [elapsedActiveSeconds, setElapsedActiveSeconds] = useState<number>(0);
  const [scanSecondsLeft, setScanSecondsLeft] = useState<number>(300); // 5 minutes = 300s
  const [scanScope, setScanScope] = useState<'watchlist' | 'current' | 'all'>('watchlist');
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([]);
  const [isScanningNow, setIsScanningNow] = useState<boolean>(false);
  const [serverRunsCount, setServerRunsCount] = useState<number>(0);
  const [serverLastRunAt, setServerLastRunAt] = useState<string | null>(null);
  const [serverLastDurationMs, setServerLastDurationMs] = useState<number | null>(null);
  const [isTogglingServer, setIsTogglingServer] = useState<boolean>(false);
  const [serverActiveConfig, setServerActiveConfig] = useState<any | null>(null);
  const [serverExecutionLogs, setServerExecutionLogs] = useState<any[]>([]);
  const [serverActiveSignals, setServerActiveSignals] = useState<any[]>([]);
  const [activeLogTab, setActiveLogTab] = useState<'scanner' | 'execution' | 'signals'>('scanner');
  const [isTestTradeLoading, setIsTestTradeLoading] = useState<boolean>(false);
  const [testTradeResult, setTestTradeResult] = useState<any | null>(null);
  const [showTestTradeModal, setShowTestTradeModal] = useState<boolean>(false);
  const [selectedExecDetail, setSelectedExecDetail] = useState<any | null>(null);
  const hasInitializedConfigFromServer = useRef<boolean>(false);
  const statusEpochRef = useRef<number>(0);
  const isTogglingRef = useRef<boolean>(false);

  // History Tab Filter: 'all' | 'wins' | 'losses' | 'open'
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wins' | 'losses' | 'open'>('all');

  // Optimal R:R (1.0 - 3.0) Analyzer from Real Exchange History
  const [rrOptResult, setRrOptResult] = useState<LiveRrOptimizationResult | null>(null);
  const [isOptimizingRr, setIsOptimizingRr] = useState<boolean>(false);
  const [rrOptStep, setRrOptStep] = useState<0.1 | 0.25>(0.1);
  const [rrOptLimit, setRrOptLimit] = useState<number>(0);
  const [showRrTradeDetails, setShowRrTradeDetails] = useState<boolean>(false);

  const handleAnalyzeOptimalRr = useCallback(async () => {
    setIsOptimizingRr(true);
    try {
      const res = await optimizeXtLiveRiskReward({ limit: rrOptLimit, step: rrOptStep });
      setRrOptResult(res);
      if (res.success && res.optimal) {
        showToast(`✅ تحلیل تاریخچه صرافی کامل شد: بهترین R:R برابر 1:${res.optimal.rr} با سود خالص $${res.optimal.netPnl.toFixed(2)}`);
      } else if (res.error) {
        showToast(`❌ ${res.error}`);
      } else if (res.message) {
        showToast(`ℹ️ ${res.message}`);
      }
    } catch (err: any) {
      showToast(`❌ خطا در تحلیل R:R بهینه: ${err?.message || 'نامشخص'}`);
    } finally {
      setIsOptimizingRr(false);
    }
  }, [rrOptLimit, rrOptStep]);

  const addLog = useCallback((type: 'info' | 'success' | 'warning' | 'trade', message: string, symbol?: string) => {
    const item: ScanLogItem = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString('fa-IR'),
      type,
      message,
      symbol,
    };
    setScanLogs((prev) => [item, ...prev.slice(0, 49)]);
  }, []);

  // Save Trade History
  useEffect(() => {
    try {
      localStorage.setItem('live_trade_history_v1', JSON.stringify(tradeHistory));
    } catch {}
  }, [tradeHistory]);

  // Sync Balance & Positions from XT API + Real Closed Positions History
  const handleRefreshBalance = useCallback(async (isManual: boolean = false) => {
    if (isManual) setIsRefreshingBalance(true);
    try {
      const data = await fetchXtBalance();
      setBalance(data);
      const pos = await fetchXtPositions();
      setPositions(pos);

      // Auto-sync ALL real closed trade history directly from XT exchange engine
      try {
        const history = await fetchXtPositionHistory(undefined, 2000);
        if (history && history.length > 0) {
          setTradeHistory((prev) => {
            const exchangeIds = new Set(history.map((h) => h.id));
            const localOnly = prev.filter((p) => !exchangeIds.has(p.id) && !history.some((h) => h.symbol === p.symbol && Math.abs((h.price || 0) - (p.price || 0)) < 0.0001));
            return [...history, ...localOnly];
          });
        }
      } catch (histErr) {
        console.warn('Failed to sync XT position history:', histErr);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isManual) setIsRefreshingBalance(false);
    }
  }, []);

  // Poll balance & open positions every 5s for real-time live PnL
  useEffect(() => {
    handleRefreshBalance(true);
    const interval = setInterval(() => handleRefreshBalance(false), 5000);
    return () => clearInterval(interval);
  }, [handleRefreshBalance]);

  // Load Optimized Config from Optimizer Trials
  const handleLoadOptimizedConfig = () => {
    try {
      const savedTop10 = localStorage.getItem('zigzag_opt_top10_v5');
      if (savedTop10) {
        const trials = JSON.parse(savedTop10);
        if (Array.isArray(trials) && trials.length > 0) {
          const best = trials[0];
          if (best.atrPeriod) setAtrPeriod(best.atrPeriod);
          if (best.atrMultiplier) setAtrMultiplier(best.atrMultiplier);
          if (best.longLegAtrMultiplier) setLongLegAtrMultiplier(best.longLegAtrMultiplier);
          if (best.minCandles) setMinCandles(best.minCandles);
          if (best.minCandlesForLongLeg) setMinCandlesForLongLeg(best.minCandlesForLongLeg);
          if (best.minCandlesForBlueLeg) setMinCandlesForBlueLeg(best.minCandlesForBlueLeg);
          if (best.blueLegAtrMultiplier) setBlueLegAtrMultiplier(best.blueLegAtrMultiplier);
          if (best.maxBlueLegPercent !== undefined) setMaxBlueLegPercent(best.maxBlueLegPercent);
          if (best.maxBreakoutAtrMultiplier !== undefined) setMaxBreakoutAtrMultiplier(best.maxBreakoutAtrMultiplier);
          if (best.maxRiskReward) setRiskRewardRatio(best.maxRiskReward);
          if (best.timeStopCandles) {
            setTimeStopCandles(best.timeStopCandles);
            try { localStorage.setItem('livetrade_time_stop_candles', String(best.timeStopCandles)); } catch {}
          }
          if (best.maxPositionToRiskRatio) {
            setMaxPositionToRiskRatio(best.maxPositionToRiskRatio);
            try { localStorage.setItem('livetrade_max_pos_to_risk_ratio', String(best.maxPositionToRiskRatio)); } catch {}
          }

          addLog('success', `🎯 بهترین کانفیگ بهینه‌ساز با وین‌ریت ${best.winRate}% و سود ${best.netProfit}% بارگذاری شد.`);
          return;
        }
      }

      // Fallback calibrated presets
      setAtrPeriod(24);
      setAtrMultiplier(2.4);
      setLongLegAtrMultiplier(8.0);
      setMinCandles(2);
      setMinCandlesForLongLeg(10);
      setMinCandlesForBlueLeg(2);
      setBlueLegAtrMultiplier(2.0);
      setMaxBlueLegPercent(50);
      setMaxBreakoutAtrMultiplier(3.0);
      setMaxCandlesToEnter(35);
      setTimeStopEnabled(true);
      setTimeStopCandles(80);
      setMaxPositionToRiskRatio(300);
      setRiskRewardRatio(3.0);
      addLog('info', '⚡ کانفیگ کالیبره‌شده اسکلپ ۵ دقیقه‌ای با موفقیت بارگذاری شد.');
    } catch {
      addLog('warning', 'خطا در خواندن فایل بهینه‌ساز');
    }
  };

  // Load Active Settings from Main Chart & Strategy Panel
  const handleSyncFromChartSettings = () => {
    try {
      const savedZz = localStorage.getItem('strategy_zigzag_settings');
      if (savedZz) {
        const zz = JSON.parse(savedZz);
        if (zz.atrPeriod) setAtrPeriod(zz.atrPeriod);
        if (zz.atrMultiplier) setAtrMultiplier(zz.atrMultiplier);
        if (zz.longLegAtrMultiplier) setLongLegAtrMultiplier(zz.longLegAtrMultiplier);
        if (zz.minCandles) setMinCandles(zz.minCandles);
        if (zz.minCandlesForLongLeg) setMinCandlesForLongLeg(zz.minCandlesForLongLeg);
        if (zz.minCandlesForBlueLeg) setMinCandlesForBlueLeg(zz.minCandlesForBlueLeg);
        if (zz.blueLegAtrMultiplier) setBlueLegAtrMultiplier(zz.blueLegAtrMultiplier);
        if (zz.maxBlueLegPercent !== undefined) setMaxBlueLegPercent(zz.maxBlueLegPercent);
        if (zz.maxBreakoutAtrMultiplier !== undefined) setMaxBreakoutAtrMultiplier(zz.maxBreakoutAtrMultiplier);
        if (zz.maxRiskReward) setRiskRewardRatio(zz.maxRiskReward);
        if (zz.maxPositionToRiskRatio) {
          setMaxPositionToRiskRatio(zz.maxPositionToRiskRatio);
          try { localStorage.setItem('livetrade_max_pos_to_risk_ratio', String(zz.maxPositionToRiskRatio)); } catch {}
        }
      }

      const savedCfg = localStorage.getItem('trading_strategy_config');
      if (savedCfg) {
        const cfg = JSON.parse(savedCfg);
        if (cfg.selectedStrategyId || cfg.selectedStrategy) setSelectedStrategy(cfg.selectedStrategyId || cfg.selectedStrategy);
        if (cfg.maxRiskReward) setRiskRewardRatio(cfg.maxRiskReward);
        if (cfg.maxCandlesToEnter) setMaxCandlesToEnter(cfg.maxCandlesToEnter);
        if (cfg.riskMode === 'fixed' || cfg.riskMode === 'percent') setRiskMode(cfg.riskMode);
        if (typeof cfg.riskAmountFixed === 'number') setRiskAmountFixed(cfg.riskAmountFixed);
        if (typeof cfg.riskPercent === 'number') setRiskPercent(cfg.riskPercent);
        if (typeof cfg.entryCommissionPercent === 'number') setEntryCommissionPercent(cfg.entryCommissionPercent);
        if (typeof cfg.exitCommissionPercent === 'number') setExitCommissionPercent(cfg.exitCommissionPercent);
        if (typeof cfg.slSlippagePercent === 'number') setSlSlippagePercent(cfg.slSlippagePercent);
        if (typeof cfg.timeStopEnabled === 'boolean') setTimeStopEnabled(cfg.timeStopEnabled);
        if (typeof cfg.timeStopCandles === 'number') setTimeStopCandles(cfg.timeStopCandles);
        if (typeof cfg.maxPositionToRiskRatio === 'number') setMaxPositionToRiskRatio(cfg.maxPositionToRiskRatio);
      }

      addLog('success', '🔄 تنظیمات فعال چارت و پنل استراتژی با موفقیت در اتاق ترید لود شدند.');
    } catch {
      addLog('warning', 'خطا در بارگذاری تنظیمات از چارت');
    }
  };

  // لود کانفیگ‌های تست از دیتابیس (مشابه بکتست)
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

  // اعمال مستقیم کانفیگ انتخاب‌شده بر روی پارامترهای ترید زنده
  const handleApplyLoadedConfig = (cfg: TestParameterConfigRecord) => {
    if (cfg.optAtrPeriod) setAtrPeriod(cfg.optAtrPeriod);
    if (cfg.optAtrMultiplier) setAtrMultiplier(cfg.optAtrMultiplier);
    if (cfg.optLongLegAtrMult) setLongLegAtrMultiplier(cfg.optLongLegAtrMult);
    if (cfg.optMinCandles) setMinCandles(cfg.optMinCandles);
    if (cfg.optMinCandlesLong) setMinCandlesForLongLeg(cfg.optMinCandlesLong);
    if (cfg.optMinCandlesBlue) setMinCandlesForBlueLeg(cfg.optMinCandlesBlue);
    if (cfg.optBlueLegAtrMult) setBlueLegAtrMultiplier(cfg.optBlueLegAtrMult);
    if (cfg.optMaxBlueLegPercent !== undefined) setMaxBlueLegPercent(cfg.optMaxBlueLegPercent);
    if (cfg.optMaxBreakoutAtr !== undefined) setMaxBreakoutAtrMultiplier(cfg.optMaxBreakoutAtr);
    if (cfg.optMaxRiskReward) setRiskRewardRatio(cfg.optMaxRiskReward);
    if (cfg.selectedStrategyId) setSelectedStrategy(cfg.selectedStrategyId as any);
    if (cfg.timeframe) setTradeTimeframe(cfg.timeframe as any);
    if (cfg.riskMode === 'fixed' || cfg.riskMode === 'percent') {
      setRiskMode(cfg.riskMode);
      try { localStorage.setItem('livetrade_risk_mode', cfg.riskMode); } catch {}
    }
    if (typeof cfg.riskAmountFixed === 'number') {
      setRiskAmountFixed(cfg.riskAmountFixed);
      try { localStorage.setItem('livetrade_risk_amount_fixed', String(cfg.riskAmountFixed)); } catch {}
    }
    if (typeof cfg.riskPercent === 'number') {
      setRiskPercent(cfg.riskPercent);
      try { localStorage.setItem('livetrade_risk_percent', String(cfg.riskPercent)); } catch {}
    }
    if (typeof cfg.entryCommissionPercent === 'number') setEntryCommissionPercent(cfg.entryCommissionPercent);
    if (typeof cfg.exitCommissionPercent === 'number') setExitCommissionPercent(cfg.exitCommissionPercent);
    if (typeof cfg.maxCandlesToEnter === 'number' && cfg.maxCandlesToEnter > 0) setMaxCandlesToEnter(cfg.maxCandlesToEnter);
    if (typeof cfg.optTimeStopEnabled === 'boolean') {
      setTimeStopEnabled(cfg.optTimeStopEnabled);
      try { localStorage.setItem('livetrade_time_stop_enabled', String(cfg.optTimeStopEnabled)); } catch {}
    }
    if (typeof cfg.optTimeStopCandles === 'number' && cfg.optTimeStopCandles > 0) {
      setTimeStopCandles(cfg.optTimeStopCandles);
      try { localStorage.setItem('livetrade_time_stop_candles', String(cfg.optTimeStopCandles)); } catch {}
    }
    if (typeof cfg.optMaxPositionToRiskRatio === 'number' && cfg.optMaxPositionToRiskRatio > 0) {
      setMaxPositionToRiskRatio(cfg.optMaxPositionToRiskRatio);
      try { localStorage.setItem('livetrade_max_pos_to_risk_ratio', String(cfg.optMaxPositionToRiskRatio)); } catch {}
    }

    setIsLoadConfigModalOpen(false);
    showToast(`✅ کانفیگ «${cfg.name}» با موفقیت در اتاق ترید اعمال شد!`);
    addLog(
      'success',
      `⚡ کانفیگ «${cfg.name}» (استراتژی: ${cfg.selectedStrategyId === 'strategy_1_e_breakout' ? 'E-Breakout' : 'Next-Pivot'}، تایم‌فریم: ${cfg.timeframe || '5m'}، دوره ATR: ${cfg.optAtrPeriod}) بارگذاری شد.`
    );
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

  const handleSaveCurrentConfig = async () => {
    if (!customConfigName.trim()) {
      showToast('لطفاً نامی برای کانفیگ وارد کنید.');
      return;
    }
    setIsSavingConfig(true);
    try {
      const record: TestParameterConfigRecord = {
        id: `config_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: customConfigName.trim(),
        timeframe: tradeTimeframe,
        capital: balance.availableBalance > 0 ? balance.availableBalance : 100,
        riskMode,
        riskAmountFixed,
        riskPercent,
        selectedStrategyId: selectedStrategy,
        entryCommissionPercent,
        exitCommissionPercent,
        maxCandlesToEnter,
        candleHistoryLimit: 1000,
        optAtrPeriod: atrPeriod,
        optMinCandles: minCandles,
        optMinCandlesLong: minCandlesForLongLeg,
        optMinCandlesBlue: minCandlesForBlueLeg,
        optAtrMultiplier: atrMultiplier,
        optLongLegAtrMult: longLegAtrMultiplier,
        optBlueLegAtrMult: blueLegAtrMultiplier,
        optMaxBlueLegPercent: maxBlueLegPercent,
        optMaxBreakoutAtr: maxBreakoutAtrMultiplier,
        optMaxRiskReward: riskRewardRatio,
        optTimeStopEnabled: timeStopEnabled,
        optTimeStopCandles: timeStopCandles,
        optMaxPositionToRiskRatio: maxPositionToRiskRatio,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ok = await saveTestConfigToFirestore(currentUser || 'amir', record);
      if (ok) {
        showToast(`💾 کانفیگ «${customConfigName}» با موفقیت در دیتابیس ذخیره شد!`);
        addLog('success', `💾 کانفیگ استراتژی با نام «${customConfigName}» در دیتابیس ذخیره شد.`);
        setIsSaveConfigModalOpen(false);
        setCustomConfigName('');
      } else {
        showToast('❌ خطا در ذخیره کانفیگ در دیتابیس.');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      showToast('❌ خطا در ذخیره کانفیگ.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // =========================================================================
  // PERSISTENT SERVER-SIDE BACKGROUND AUTO-SCANNER SYNC & CONTROLS
  // =========================================================================

  // Fetch status of background scanner running on server.ts
  const fetchServerScannerStatus = useCallback(async () => {
    const epochAtStart = statusEpochRef.current;
    if (isTogglingRef.current) return;
    try {
      const res = await fetch(`/api/live-scanner/status?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      if (!res.ok) return;
      // Ignore stale responses that began before a Start/Stop toggle or while a toggle is in progress
      if (isTogglingRef.current || statusEpochRef.current !== epochAtStart) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (isTogglingRef.current || statusEpochRef.current !== epochAtStart) return;
      if (data.success && data.state) {
        const { isRunning, isScanning, secondsUntilNextRun, totalRunsCount, lastRunAt, activeSignals, logs, config, executionLogs, startedAt, elapsedSeconds } = data.state;
        const running = Boolean(isRunning);
        setIsAutoScanning(running);
        setIsScanningNow(Boolean(isScanning));

        if (running && startedAt) {
          setServerStartedAt(startedAt);
          // Precise elapsed active duration calculated relative to authoritative server clock
          const serverNow = typeof data.serverTime === 'number' ? data.serverTime : Date.now();
          const startedMs = new Date(startedAt).getTime();
          const diff = Math.max(0, Math.floor((serverNow - startedMs) / 1000));
          setElapsedActiveSeconds(typeof elapsedSeconds === 'number' ? elapsedSeconds : diff);
        } else {
          setServerStartedAt(null);
          setElapsedActiveSeconds(0);
        }

        if (typeof secondsUntilNextRun === 'number') {
          setScanSecondsLeft(secondsUntilNextRun);
        }
        setServerRunsCount(totalRunsCount || 0);
        setServerLastRunAt(lastRunAt || null);
        if (data.state.lastResult && typeof data.state.lastResult.durationMs === 'number') {
          setServerLastDurationMs(data.state.lastResult.durationMs);
        }

        if (Array.isArray(activeSignals)) {
          setServerActiveSignals(activeSignals);
        }

        if (Array.isArray(executionLogs)) {
          setServerExecutionLogs(executionLogs);
        }

        if (config) {
          setServerActiveConfig(config);
          // Only initialize local UI controls once on initial load from server config
          if (!hasInitializedConfigFromServer.current) {
            hasInitializedConfigFromServer.current = true;
            if (config.strategyId) setSelectedStrategy(config.strategyId);
            if (Array.isArray(config.timeframes) && config.timeframes.length > 0) {
              setSelectedTimeframes(config.timeframes);
              setTradeTimeframe(config.timeframes[0]);
            } else if (config.timeframe) {
              setSelectedTimeframes([config.timeframe]);
              setTradeTimeframe(config.timeframe);
            }
            if (config.exchange && typeof onSelectExchange === 'function') onSelectExchange(config.exchange);
            if (Array.isArray(config.symbols) && config.symbols.length > 0) setSelectedSymbols(config.symbols);
            if (config.riskMode) setRiskMode(config.riskMode);
            if (typeof config.riskAmountFixed === 'number') setRiskAmountFixed(config.riskAmountFixed);
            if (typeof config.riskPercent === 'number') setRiskPercent(config.riskPercent);
            if (typeof config.riskRewardRatio === 'number') setRiskRewardRatio(config.riskRewardRatio);
            if (typeof config.noConcurrentPositions === 'boolean') setNoConcurrentPositions(config.noConcurrentPositions);
            if (typeof config.isLiveExecution === 'boolean') setIsLiveExecution(config.isLiveExecution);
            if (typeof config.atrPeriod === 'number') setAtrPeriod(config.atrPeriod);
            if (typeof config.atrMultiplier === 'number') setAtrMultiplier(config.atrMultiplier);
            if (typeof config.minCandles === 'number') setMinCandles(config.minCandles);
            if (typeof config.minCandlesForLongLeg === 'number') setMinCandlesForLongLeg(config.minCandlesForLongLeg);
            if (typeof config.longLegAtrMultiplier === 'number') setLongLegAtrMultiplier(config.longLegAtrMultiplier);
            if (typeof config.minCandlesForBlueLeg === 'number') setMinCandlesForBlueLeg(config.minCandlesForBlueLeg);
            if (typeof config.blueLegAtrMultiplier === 'number') setBlueLegAtrMultiplier(config.blueLegAtrMultiplier);
            if (typeof config.maxBlueLegPercent === 'number') setMaxBlueLegPercent(config.maxBlueLegPercent);
            if (typeof config.maxBreakoutAtrMultiplier === 'number') setMaxBreakoutAtrMultiplier(config.maxBreakoutAtrMultiplier);
            if (typeof config.maxCandlesToEnter === 'number') setMaxCandlesToEnter(config.maxCandlesToEnter);
            if (typeof config.maxPositionToRiskRatio === 'number') setMaxPositionToRiskRatio(config.maxPositionToRiskRatio);
            if (typeof config.entryCommissionPercent === 'number') setEntryCommissionPercent(config.entryCommissionPercent);
            if (typeof config.exitCommissionPercent === 'number') setExitCommissionPercent(config.exitCommissionPercent);
            if (typeof config.slSlippagePercent === 'number') setSlSlippagePercent(config.slSlippagePercent);
            if (typeof config.timeStopEnabled === 'boolean') setTimeStopEnabled(config.timeStopEnabled);
            if (typeof config.timeStopCandles === 'number') setTimeStopCandles(config.timeStopCandles);
          }
        }

        // Fetch tracked live trades from PostgreSQL
        try {
          const trRes = await fetch('/api/live-trades');
          if (trRes.ok) {
            const trData = await trRes.json();
            if (trData.success) {
              if (Array.isArray(trData.activeTrades)) {
                setActiveDbTrades(trData.activeTrades);
              }
              if (Array.isArray(trData.allTrades)) {
                setAllDbTrades(trData.allTrades);
              }
            }
          }
        } catch {}

        // Sync and append logs from server
        if (Array.isArray(logs) && logs.length > 0) {
          setScanLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = logs.filter((l: any) => !existingIds.has(l.id));
            if (newLogs.length === 0) return prev;
            return [...newLogs, ...prev].slice(0, 150);
          });
        }
      }
    } catch {
      // transient network error
    }
  }, []);

  // Trigger on-demand immediate scan on server backend (100% server-side execution)
  const handleTriggerServerScanNow = useCallback(async () => {
    if (isScanningNow) return;
    setIsScanningNow(true);
    try {
      addLog('info', '🔍 ارسال درخواست اجرای اسکن فوری به سرور Node.js...');
      showToast('🔍 در حال اجرای اسکن کامل در سرور...');
      const res = await fetch(`/api/live-scanner/scan-now?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ اسکن سرور با موفقیت به پایان رسید');
        if (data.state) {
          if (Array.isArray(data.state.activeSignals)) {
            setServerActiveSignals(data.state.activeSignals);
          }
          if (Array.isArray(data.state.logs)) {
            setScanLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newLogs = data.state.logs.filter((l: any) => !existingIds.has(l.id));
              if (newLogs.length === 0) return prev;
              return [...newLogs, ...prev].slice(0, 150);
            });
          }
        }
      } else {
        showToast(`❌ پیام سرور: ${data.error || data.message}`);
      }
    } catch (err: any) {
      showToast(`❌ خطای شبکه: ${err.message}`);
    } finally {
      setIsScanningNow(false);
      await fetchServerScannerStatus();
      handleRefreshBalance();
    }
  }, [isScanningNow, addLog, fetchServerScannerStatus, handleRefreshBalance]);

  // Save changes directly to server backend
  const syncConfigToServer = useCallback(async (partialConfig: any) => {
    try {
      const res = await fetch(`/api/live-scanner/config?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
        },
        body: JSON.stringify({ config: partialConfig }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setServerActiveConfig(data.config);
        }
      }
    } catch (err) {
      console.error('Failed to sync config to server:', err);
    }
  }, []);

  // Run instant Test Live Trade with $0.10 Risk on exchange
  const handleRunTestTrade = async (symbolToTest?: string) => {
    setIsTestTradeLoading(true);
    try {
      const sym = symbolToTest || (selectedSymbols && selectedSymbols[0]) || 'btc_usdt';
      const res = await fetch('/api/live-scanner/test-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          posSide: 'LONG',
          riskUsdt: 0.10,
        }),
      });
      const data = await res.json();
      setTestTradeResult(data);
      setShowTestTradeModal(true);
      if (data.success) {
        showToast(`🧪 سفارش تستی با موفقیت ثبت شد (Order ID: ${data.orderId || 'ثبت شد'})`);
      } else {
        const err = data.exchangeResponse?.msgInfo || data.exchangeResponse?.error?.msg || data.error || 'خطا در ثبت سفارش';
        showToast(`❌ پیام صرافی: ${err}`);
      }
      fetchServerScannerStatus();
    } catch (err: any) {
      showToast(`❌ خطای شبکه در ارسال سفارش تستی: ${err.message}`);
    } finally {
      setIsTestTradeLoading(false);
    }
  };

  // Debounced auto-sync: whenever user modifies any configuration, persist to backend server
  const hasMountedSync = useRef(false);
  useEffect(() => {
    if (!hasMountedSync.current) {
      hasMountedSync.current = true;
      return;
    }
    // Prevent overwriting server config before persistent server config is initially loaded
    if (!hasInitializedConfigFromServer.current) {
      return;
    }
    const timer = setTimeout(() => {
      syncConfigToServer({
        strategyId: selectedStrategy,
        timeframe: tradeTimeframe,
        timeframes: selectedTimeframes,
        exchange,
        symbols: selectedSymbols,
        riskMode,
        riskAmountFixed,
        riskPercent,
        riskRewardRatio,
        noConcurrentPositions,
        isLiveExecution,
        atrPeriod,
        atrMultiplier,
        minCandles,
        minCandlesForLongLeg,
        longLegAtrMultiplier,
        minCandlesForBlueLeg,
        blueLegAtrMultiplier,
        maxBlueLegPercent,
        maxBreakoutAtrMultiplier,
        maxCandlesToEnter,
        entryCommissionPercent,
        exitCommissionPercent,
        slSlippagePercent,
        maxPositionToRiskRatio,
        timeStopEnabled,
        timeStopCandles,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    selectedStrategy,
    tradeTimeframe,
    selectedTimeframes,
    exchange,
    selectedSymbols,
    riskMode,
    riskAmountFixed,
    riskPercent,
    riskRewardRatio,
    noConcurrentPositions,
    isLiveExecution,
    atrPeriod,
    atrMultiplier,
    minCandles,
    minCandlesForLongLeg,
    longLegAtrMultiplier,
    minCandlesForBlueLeg,
    blueLegAtrMultiplier,
    maxBlueLegPercent,
    maxBreakoutAtrMultiplier,
    maxCandlesToEnter,
    entryCommissionPercent,
    exitCommissionPercent,
    slSlippagePercent,
    maxPositionToRiskRatio,
    timeStopEnabled,
    timeStopCandles,
    syncConfigToServer,
  ]);

  // Poll server status every 3 seconds to keep UI in sync even after refresh
  useEffect(() => {
    fetchServerScannerStatus();
    const poller = setInterval(fetchServerScannerStatus, 3000);
    return () => clearInterval(poller);
  }, [fetchServerScannerStatus]);

  // Smooth local countdown ticker and continuous elapsed session timer
  useEffect(() => {
    if (!isAutoScanning) return;
    const ticker = setInterval(() => {
      setScanSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setElapsedActiveSeconds((prev) => {
        if (serverStartedAt) {
          const diff = Math.floor((Date.now() - new Date(serverStartedAt).getTime()) / 1000);
          return Math.max(0, diff);
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(ticker);
  }, [isAutoScanning, serverStartedAt]);

  // Toggle Continuous Background Scanner on Node.js Server
  const handleToggleAutoScan = async () => {
    if (isTogglingServer || isTogglingRef.current) return;
    setIsTogglingServer(true);
    isTogglingRef.current = true;
    statusEpochRef.current += 1;

    try {
      if (!isAutoScanning) {
        const targetSymbols = selectedSymbols && selectedSymbols.length > 0
          ? selectedSymbols
          : DEFAULT_POPULAR_WATCHLIST;

        const configPayload = {
          timeframe: tradeTimeframe,
          timeframes: selectedTimeframes,
          exchange,
          strategyId: selectedStrategy,
          symbols: targetSymbols,
          isFutures: true,
          atrPeriod,
          atrMultiplier,
          minCandles,
          minCandlesForLongLeg,
          longLegAtrMultiplier,
          minCandlesForBlueLeg,
          blueLegAtrMultiplier,
          maxBlueLegPercent,
          maxBreakoutAtrMultiplier,
          maxCandlesToEnter,
          riskRewardRatio,
          riskMode,
          riskAmountFixed,
          riskPercent,
          entryCommissionPercent,
          exitCommissionPercent,
          slSlippagePercent,
          capital: balance.availableBalance > 0 ? balance.availableBalance : 1000,
          noConcurrentPositions,
          isLiveExecution,
          maxPositionToRiskRatio,
          timeStopEnabled,
          timeStopCandles,
          userId: currentUser || 'amir',
        };

        const res = await fetch(`/api/live-scanner/start?_t=${Date.now()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store',
          },
          body: JSON.stringify({ config: configPayload }),
        });

        if (res.ok) {
          const data = await res.json();
          statusEpochRef.current += 1;
          setIsAutoScanning(true);
          const started = data.state?.startedAt || new Date().toISOString();
          setServerStartedAt(started);
          setElapsedActiveSeconds(data.state?.elapsedSeconds || 0);
          setScanSecondsLeft(data.state?.secondsUntilNextRun || 300);
          setIsScanningNow(true);
          showToast('🚀 اتوپایلوت مداوم سرور فعال شد: اسکن و بررسی خودکار در پس‌زمینه سرور Node.js آغاز گردید.');
          addLog('success', `🚀 اتوپایلوت سرور فعال شد: اسکن مداوم ${targetSymbols.length} ارز در سرور به راه افتاد (پایدار حتی با بستن مرورگر).`);
        } else {
          showToast('❌ خطا در فعال‌سازی اسکنر سرور.');
        }
      } else {
        const res = await fetch(`/api/live-scanner/stop?_t=${Date.now()}`, {
          method: 'POST',
          headers: {
            'Cache-Control': 'no-cache, no-store',
          },
        });

        if (res.ok) {
          statusEpochRef.current += 1;
          setIsAutoScanning(false);
          setIsScanningNow(false);
          setServerStartedAt(null);
          setElapsedActiveSeconds(0);
          showToast('⏸️ اسکنر پس‌زمینه سرور متوقف گردید.');
          addLog('warning', '⏸️ اتوپایلوت سرور متوقف شد.');
        } else {
          showToast('❌ خطا در متوقف‌سازی اسکنر سرور.');
        }
      }
    } catch (err: any) {
      showToast(`❌ خطای شبکه: ${err.message}`);
    } finally {
      isTogglingRef.current = false;
      setIsTogglingServer(false);
      await fetchServerScannerStatus();
    }
  };

  // Close Position
  const handleClosePosition = async (pos: LivePosition) => {
    const pairName = fromXtSymbol(pos.symbol);
    addLog('info', `در حال ارسال درخواست بستن پوزیشن ${pos.side} روی ${pairName} به صرافی...`, pos.symbol);
    setClosingPosSymbol(pos.symbol);

    try {
      const isRealXtPosition = pos.exchange === 'xt' || exchange === 'xt';
      if (isRealXtPosition) {
        const res = await closeXtPosition({
          symbol: pos.symbol,
          positionSide: pos.side,
          contractQty: pos.contractQty || pos.amount,
          profitId: pos.profitId,
        });

        if (!res.success) {
          addLog('warning', `❌ خطا در بستن پوزیشن در صرافی XT: ${res.error || 'پاسخ ناموفق صرافی'}`, pos.symbol);
          showToast(`❌ خطا در بستن پوزیشن: ${res.error || 'پاسخ ناموفق صرافی'}`);
          setClosingPosSymbol(null);
          return; // Do NOT remove from UI if it failed to close on the exchange!
        }

        addLog('success', `✅ پوزیشن ${pos.side} برای ${pairName} با موفقیت در صرافی XT بسته شد.`, pos.symbol);
      } else {
        addLog('success', `📝 پوزیشن شبیه‌ساز ${pos.side} برای ${pairName} بسته شد.`, pos.symbol);
      }

      // Move to history
      const closePnl = pos.unrealizedPnl;
      const closePct = pos.pnlPercent;
      setTradeHistory((prev) => [
        {
          id: `close-${Date.now()}`,
          exchange: pos.exchange,
          symbol: pos.symbol,
          side: pos.side === 'LONG' ? 'SELL' : 'BUY',
          positionSide: pos.side,
          orderType: 'MARKET',
          price: pos.markPrice,
          amount: pos.contractQty || pos.amount,
          status: 'FILLED',
          strategyName: 'ZigZag Strategy',
          takeProfitPrice: pos.takeProfitPrice,
          stopLossPrice: pos.stopLossPrice,
          realizedPnl: closePnl,
          realizedPnlPercent: closePct,
          exitPrice: pos.markPrice,
          exitTime: new Date().toLocaleTimeString('fa-IR'),
          exitReason: 'MANUAL',
          timestamp: new Date().toLocaleTimeString('fa-IR'),
        },
        ...prev,
      ]);

      // Remove from active positions
      setPositions((prev) => prev.filter((p) => p.symbol !== pos.symbol));
      showToast(`✅ پوزیشن ${pairName} با موفقیت در صرافی بسته شد.`);

      // Sync fresh balance and positions from XT after 1 second
      setTimeout(() => {
        handleRefreshBalance(true);
      }, 1000);
    } catch (err: any) {
      addLog('warning', `❌ خطای غیرمنتظره در بستن پوزیشن: ${err.message}`, pos.symbol);
      showToast(`❌ خطا: ${err.message}`);
    } finally {
      setClosingPosSymbol(null);
    }
  };

  // Close All Open Positions on XT Futures (/future/user/v1/position/close-all)
  const handleCloseAllPositions = async () => {
    if (positions.length === 0) return;
    setIsClosingAll(true);
    addLog('info', 'در حال بستن تمام پوزیشن‌های باز در صرافی XT با قیمت مارکت (/future/user/v1/position/close-all)...');
    try {
      const res = await closeAllXtPositions();
      if (res.success) {
        showToast('✅ تمام پوزیشن‌های باز با موفقیت در صرافی بسته شدند.');
        addLog('success', '✅ تمام پوزیشن‌های باز در صرافی XT با قیمت مارکت بسته شدند.');
        setPositions([]);
        setTimeout(() => handleRefreshBalance(true), 1200);
      } else {
        showToast(`❌ خطا در بستن پوزیشن‌ها: ${res.error}`);
        addLog('warning', `❌ خطا در بستن تمام پوزیشن‌ها: ${res.error}`);
      }
    } catch (err: any) {
      showToast(`❌ خطای شبکه: ${err.message}`);
    } finally {
      setIsClosingAll(false);
    }
  };

  // Metrics summary
  const historyStats = useMemo(() => {
    const closed = tradeHistory.filter((t) => t.realizedPnl !== undefined);
    const wins = closed.filter((t) => (t.realizedPnl || 0) > 0);
    const losses = closed.filter((t) => (t.realizedPnl || 0) < 0);
    const totalPnl = closed.reduce((acc, t) => acc + (t.realizedPnl || 0), 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    return {
      total: tradeHistory.length,
      closedCount: closed.length,
      winsCount: wins.length,
      lossesCount: losses.length,
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
    };
  }, [tradeHistory]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'wins') return tradeHistory.filter((t) => (t.realizedPnl || 0) > 0);
    if (historyFilter === 'losses') return tradeHistory.filter((t) => (t.realizedPnl || 0) < 0);
    if (historyFilter === 'open') return tradeHistory.filter((t) => t.status === 'NEW' || t.status === 'FILLED');
    return tradeHistory;
  }, [tradeHistory, historyFilter]);

  const minutesLeft = Math.floor(scanSecondsLeft / 60);
  const secondsLeft = scanSecondsLeft % 60;
  const timeFormatted = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;

  const formatElapsedDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0d14] text-gray-200 overflow-y-auto">
      {/* ۱. نوار وضعیت بالا و اتصال صرافی */}
      <div className="bg-[#121722] border-b border-[#222c3e] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* برند و انتخاب صرافی */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white tracking-wide">اتاق معاملات زنده و ربات اسکنر خودکار</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                {exchange === 'xt' ? 'XT.COM FUTURES' : 'BINANCE PAPER'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              اسکن پیوسته بازار هر ۵ دقیقه، شناسایی ستاپ‌های لگ زیگ‌زاگ، ورود آنی و تنظیم خودکار حد سود و حد ضرر
            </p>
          </div>
        </div>

        {/* سوییچ صرافی و حالت شبیه‌ساز/زنده */}
        <div className="flex items-center gap-2.5">
          {/* صرافی انتخابی */}
          <div className="flex items-center bg-[#0d1017] p-1 rounded-xl border border-[#232c3d]">
            <button
              type="button"
              onClick={() => onSelectExchange('xt')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                exchange === 'xt'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>صرافی XT.COM</span>
              <span className="text-[9px] px-1 py-0.2 bg-black/20 rounded font-mono">Live API</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectExchange('binance')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                exchange === 'binance'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>بایننس (Binance)</span>
            </button>
          </div>

          {/* سوییچ اجرای واقعی یا شبیه‌ساز */}
          <button
            type="button"
            onClick={() => setIsLiveExecution((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isLiveExecution
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
            }`}
            title="تغییر حالت بین ترید واقعی با موجودی حساب و ترید شبیه‌ساز"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isLiveExecution ? 'اجرای سفارشات واقعی (Live XT)' : 'حالت آزمایشی (Paper Mode)'}</span>
          </button>

          {/* دکمه تست معامله لایو با ریسک ۰.۱۰ دلار */}
          <button
            type="button"
            onClick={() => handleRunTestTrade()}
            disabled={isTestTradeLoading}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
            title="ارسال یک پوزیشن آزمایشی زنده واقعی به صرافی XT با حداقل سایز و ریسک ۰.۱۰ دلار جهت تست سلامت ارتباط با API"
          >
            {isTestTradeLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 fill-current" />
            )}
            <span>تست معامله لایو ($0.1 Risk)</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#1b2230] hover:bg-[#252f42] text-gray-300 border border-[#2d3a50] text-xs font-bold cursor-pointer transition-all"
            >
              بازگشت به چارت
            </button>
          )}
        </div>
      </div>

      {/* ۲. کارت‌های اصلی: موجودی حساب، وضعیت سود و ضرر، کنترل اسکنر ۵ دقیقه‌ای */}
      <div className="p-4 space-y-4">
        {/* خلاصه وضعیت و کانفیگ فعال سرور (Server Single Source of Truth) */}
        {serverActiveConfig && (
          <div className="bg-[#101520] border border-[#223046] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className={`w-3.5 h-3.5 rounded-full ${isAutoScanning ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                {isAutoScanning && (
                  <div className="absolute w-5 h-5 rounded-full bg-emerald-400/40 animate-ping" />
                )}
              </div>
              <div>
                <div className="text-white font-extrabold flex flex-wrap items-center gap-2">
                  <span>کانفیگ فعال در بک‌اند سرور (Server Active Config):</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isAutoScanning
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {isAutoScanning ? '🟢 حلقه پس‌زمینه سرور فعال است' : '⏸️ متوقف'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      serverActiveConfig.isLiveExecution
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {serverActiveConfig.isLiveExecution ? '⚡ اجرای خودکار در صرافی (Real Auto-Trade)' : '📝 شبیه‌ساز (Paper Trading)'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono">
                  <span>صرافی: <strong className="text-white uppercase">{serverActiveConfig.exchange || exchange}</strong></span>
                  <span>• تایم‌فریم‌ها: <strong className="text-cyan-300">{(serverActiveConfig.timeframes && serverActiveConfig.timeframes.length > 0 ? serverActiveConfig.timeframes : [serverActiveConfig.timeframe || tradeTimeframe]).join(', ')}</strong></span>
                  <span>• استراتژی: <strong className="text-amber-300">{serverActiveConfig.strategyId === 'strategy_2_next_pivot' ? 'Next-Pivot (۲)' : 'E-Breakout (۱)'}</strong></span>
                  <span>• بودجه ریسک: <strong className="text-emerald-300">{serverActiveConfig.riskMode === 'fixed' ? `$${serverActiveConfig.riskAmountFixed || 50} ثابت (با احتساب اعشار و کارمزد صرافی)` : `${serverActiveConfig.riskPercent || 1}% بالانس`}</strong></span>
                  <span>• وضعیت همزمانی: <strong className="text-amber-300">{serverActiveConfig.noConcurrentPositions !== false ? 'تک‌پوزیشن کل (حداکثر ۱ معامله باز)' : 'هم‌زمان (حداکثر ۱ معامله در هر تایم‌فریم)'}</strong></span>
                  <span>• سقف ورود: <strong className="text-cyan-300">{serverActiveConfig.maxCandlesToEnter ?? 35}c</strong></span>
                  <span>• Time-Stop: <strong className="text-cyan-300">{serverActiveConfig.timeStopEnabled !== false ? `${serverActiveConfig.timeStopCandles ?? 80}c` : 'خاموش'}</strong></span>
                  <span>• واچ‌لیست: <strong className="text-cyan-300">{serverActiveConfig.symbols?.length || selectedSymbols?.length || 0} جفت‌ارز</strong></span>
                </div>
                {activeDbTrades.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-[#1b2536]">
                    <span className="text-gray-400 text-[11px] font-sans">معاملات فعال دیتابیس ({activeDbTrades.length}):</span>
                    {activeDbTrades.map((tr) => (
                      <div key={tr.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-[11px] text-emerald-300 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold text-cyan-300">[{tr.timeframe}]</span>
                        <span className="uppercase text-white font-bold">{tr.symbol}</span>
                        <span className="text-[10px] text-gray-400">شناسه: {tr.order_id || tr.id.slice(0, 10)}</span>
                        <span className="text-[10px] text-amber-300 font-sans">{tr.pos_side}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRunTestTrade()}
                disabled={isTestTradeLoading}
                className="px-3 py-1.5 rounded-xl bg-[#1a2333] hover:bg-[#253249] text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="تست اتصال و ارسال سفارش آزمایشی با $0.10 ریسک"
              >
                {isTestTradeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>تست سفارش لایو ($0.1)</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* کارت ۱: موجودی کل والت */}
          <div className="bg-[#10141d] p-3.5 rounded-2xl border border-[#212a3a] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="flex items-center gap-1.5 font-bold text-gray-300">
                <Wallet className="w-4 h-4 text-amber-400" />
                موجودی کل حساب (Equity)
              </span>
              <button
                type="button"
                onClick={() => handleRefreshBalance(true)}
                disabled={isRefreshingBalance}
                className="p-1 rounded-lg hover:bg-[#1a2332] text-gray-400 hover:text-white transition-all cursor-pointer"
                title="به‌روزرسانی موجودی از صرافی"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                ${balance.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-amber-400 font-mono">USDT</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1a2230]">
              <span>مارجین آزاد: <strong className="text-emerald-400 font-mono">${balance.availableBalance.toFixed(2)}</strong></span>
              <span>مسدود: <strong className="text-gray-300 font-mono">${balance.frozenBalance.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* کارت ۲: سود و زیان محقق‌شده */}
          <div className="bg-[#10141d] p-3.5 rounded-2xl border border-[#212a3a]">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="flex items-center gap-1.5 font-bold text-gray-300">
                <Activity className="w-4 h-4 text-cyan-400" />
                سود/زیان کل (Realized PnL)
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{historyStats.closedCount} معامله بسته</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl font-black font-mono tracking-tight ${
                  historyStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {historyStats.totalPnl >= 0 ? `+$${historyStats.totalPnl.toFixed(2)}` : `-$${Math.abs(historyStats.totalPnl).toFixed(2)}`}
              </span>
              <span className="text-xs font-mono font-bold text-gray-400">USD</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1a2230]">
              <span>وین‌ریت: <strong className="text-amber-300 font-mono">{historyStats.winRate}%</strong></span>
              <span>برد/باخت: <strong className="text-emerald-400 font-mono">{historyStats.winsCount}</strong> / <strong className="text-rose-400 font-mono">{historyStats.lossesCount}</strong></span>
            </div>
          </div>

          {/* کارت ۳: پوزیشن‌های فعال جاری */}
          <div className="bg-[#10141d] p-3.5 rounded-2xl border border-[#212a3a]">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="flex items-center gap-1.5 font-bold text-gray-300">
                <Layers className="w-4 h-4 text-indigo-400" />
                پوزیشن‌های باز (Open Positions)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                {positions.length} پوزیشن
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                {positions.length}
              </span>
              <span className="text-xs text-gray-400">معامله در جریان</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1a2230]">
              <span>کل مارجین درگیر: <strong className="text-white font-mono">${positions.reduce((a, p) => a + p.margin, 0).toFixed(1)}</strong></span>
              <span>اهرم میانگین: <strong className="text-amber-400 font-mono">{positions.length > 0 ? (positions.reduce((a, p) => a + p.leverage, 0) / positions.length).toFixed(0) : 'Max'}x</strong></span>
            </div>
          </div>

          {/* کارت ۴: تایمر و کنترلر اتوپایلوت مداوم سرور */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            isAutoScanning ? 'bg-emerald-950/25 border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'bg-[#10141d] border-[#212a3a]'
          }`}>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>اتوپایلوت مداوم سرور (Server 24/7)</span>
              </span>
              <div className="flex items-center gap-1.5">
                {isAutoScanning ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    سرور فعال
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-400 border border-gray-700">
                    متوقف
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black font-mono tracking-wider ${isAutoScanning ? 'text-emerald-300' : 'text-gray-500'}`}>
                    {isAutoScanning ? formatElapsedDuration(elapsedActiveSeconds) : '۰۰:۰۰:۰۰'}
                  </span>
                  {isAutoScanning && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono border border-emerald-500/25">
                      زمان فعالیت
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                  {isAutoScanning ? (
                    <>
                      <span>اسکن بعدی در: <strong className="text-cyan-300 font-mono">{timeFormatted}</strong></span>
                      <span>• دور: <strong className="text-amber-300 font-mono">#{serverRunsCount}</strong></span>
                      {serverLastDurationMs !== null && (
                        <span className="text-gray-400 font-mono text-[10px]">
                          (مدت: <strong className="text-emerald-300">{(serverLastDurationMs / 1000).toFixed(1)}s</strong>)
                        </span>
                      )}
                    </>
                  ) : (
                    <span>آماده راه‌اندازی پس‌زمینه ۲۴ ساعته سرور</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleAutoScan}
                  disabled={isTogglingServer}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                    isAutoScanning
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/30'
                  }`}
                  title={isAutoScanning ? 'توقف اسکن خودکار پس‌زمینه در سرور' : 'راه‌اندازی اسکن خودکار مداوم روی سرور Node.js'}
                >
                  {isTogglingServer ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isAutoScanning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>توقف سرور</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>شروع اتوپایلوت سرور</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTriggerServerScanNow}
                  disabled={isScanningNow}
                  className="p-2 rounded-xl bg-[#1b2230] hover:bg-[#252f42] text-cyan-300 border border-[#2d3a50] transition-all cursor-pointer disabled:opacity-40"
                  title="اجرای فوری اسکن دستی در سرور (100% Server Engine)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningNow ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* نوار پیشرفت زمان اسکن */}
            <div className="w-full bg-[#171f2d] h-1.5 rounded-full overflow-hidden mt-2.5">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(0, ((300 - scanSecondsLeft) / 300) * 100))}%` }}
              />
            </div>

            <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between border-t border-[#1a2333] pt-1.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>پایداری مداوم در سرور (با بستن مرورگر زمان و لاگ‌ها حفظ می‌شوند)</span>
              </span>
              {serverLastRunAt && (
                <span className="font-mono text-gray-500 text-[9px]">
                  آخرین اسکن: {new Date(serverLastRunAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ۳. دو ستون اصلی: تنظیمات استراتژی و لود کانفیگ (سمت چپ) | کنسول پایش زنده و رادار اسکن (سمت راست) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ستون ۱ و ۲: تنظیمات استراتژی و پارامترهای ورود/خروج */}
          <div className="lg:col-span-2 bg-[#10141d] p-4 rounded-2xl border border-[#222b3c] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1c2433]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white">تنظیمات استراتژی معاملاتی و پارامترهای ستاپ</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSaveConfigModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  title="ذخیره پارامترهای فعلی استراتژی در دیتابیس ابری"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>ذخیره کانفیگ</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenLoadConfigModal}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  title="فراخوانی و لود کانفیگ‌های تست از دیتابیس (مشابه بکتست)"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>لود کانفیگ</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncFromChartSettings}
                  className="px-3 py-1.5 rounded-xl bg-[#1b2230] hover:bg-[#252f42] text-cyan-300 border border-[#2d3a50] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  title="بارگذاری پارامترهای فعال فعلی چارت و پنل استراتژی"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>همگام از چارت</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadOptimizedConfig}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm shadow-amber-500/10"
                  title="لود کردن خودکار بهترین پارامترهای بهینه‌سازی‌شده از تب Optimizer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>کانفیگ برتر بهینه‌ساز</span>
                </button>
              </div>
            </div>

            {/* ردیف انتخاب استراتژی و تایم‌فریم */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">استراتژی فعال:</label>
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-[#141924] border border-[#283346] rounded-xl text-white font-bold text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="strategy_2_next_pivot">استراتژی ۲: ستاپ پیوت بعدی (Next-Pivot / تاییدیه پولبک) [پیش‌فرض]</option>
                  <option value="strategy_1_e_breakout">استراتژی ۱: شکست نقطه E (E-Breakout)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400 block">تایم‌فریم‌های اسکن موازی:</label>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {selectedTimeframes.length} تایم‌فریم فعال
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 p-1 bg-[#141924] border border-[#283346] rounded-xl">
                  {(['1m', '3m', '5m', '15m', '30m', '1h', '4h'] as Timeframe[]).map((tf) => {
                    const isSelected = selectedTimeframes.includes(tf);
                    const activeTrade = activeDbTrades.find((t) => t.timeframe === tf);
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => handleToggleTimeframe(tf)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-xs'
                            : 'bg-[#0f141e] text-gray-400 hover:text-gray-200 border border-transparent'
                        }`}
                        title={
                          activeTrade
                            ? `تایم‌فریم ${tf}: دارای معامله باز (${activeTrade.symbol?.toUpperCase()} | Order: ${activeTrade.order_id || activeTrade.id})`
                            : `تایم‌فریم ${tf} (کلیک برای فعال/غیرفعال کردن)`
                        }
                      >
                        <span>{tf}</span>
                        {activeTrade && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="پوزیشن باز" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">ارزهای مجاز اسکن بازار:</label>
                <button
                  type="button"
                  onClick={handleOpenPairsModal}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-[#141924] hover:bg-[#1a2333] border border-[#283346] hover:border-amber-400/60 rounded-xl text-white font-bold text-xs transition-all cursor-pointer group shadow-sm"
                  title="کلیک کنید تا لیست کامل ارزها با مارکت‌کپ و چک‌باکس‌ها باز شود"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <Coins className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-amber-300 font-mono text-xs">
                      {selectedSymbols.length} ارز فعال
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 group-hover:bg-amber-500/30">
                    <Filter className="w-3 h-3" />
                    تنظیم و مارکت‌کپ
                  </span>
                </button>
              </div>
            </div>

            {/* گرید پارامترهای جامع ۱۲ گانه استراتژی ۲ و ۱ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۱. دوره ATR:</span>
                <input
                  type="number"
                  value={atrPeriod}
                  onChange={(e) => setAtrPeriod(parseInt(e.target.value, 10) || 24)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۲. ضریب ATR:</span>
                <input
                  type="number"
                  step={0.1}
                  value={atrMultiplier}
                  onChange={(e) => setAtrMultiplier(parseFloat(e.target.value) || 2.4)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۳. حداقل کندل لگ:</span>
                <input
                  type="number"
                  value={minCandles}
                  onChange={(e) => setMinCandles(parseInt(e.target.value, 10) || 2)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-amber-300/90 block font-bold">۴. کندل لگ بلند:</span>
                <input
                  type="number"
                  value={minCandlesForLongLeg}
                  onChange={(e) => setMinCandlesForLongLeg(parseInt(e.target.value, 10) || 10)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-amber-300 font-mono text-center font-bold"
                  title="حداقل تعداد کندل‌های تشکیل‌دهنده لگ اصلی/مادر"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۵. ضریب لگ بزرگ:</span>
                <input
                  type="number"
                  step={0.5}
                  value={longLegAtrMultiplier}
                  onChange={(e) => setLongLegAtrMultiplier(parseFloat(e.target.value) || 8.0)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-cyan-500/30">
                <span className="text-[10px] text-cyan-300 block font-bold" title="حداقل کندل تشکیل‌دهنده لگ CD و EF">کندل لگ CD, EF:</span>
                <input
                  type="number"
                  min={1}
                  value={minCandlesForBlueLeg}
                  onChange={(e) => setMinCandlesForBlueLeg(parseInt(e.target.value, 10) || 1)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-blue-500/30">
                <span className="text-[10px] text-blue-300 block font-bold" title="ضریب ATR لگ CD و EF">ضریب لگ CD, EF:</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.25}
                  value={blueLegAtrMultiplier}
                  onChange={(e) => setBlueLegAtrMultiplier(parseFloat(e.target.value) || 0.1)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-blue-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۶. سقف لگ آبی (%):</span>
                <input
                  type="number"
                  value={maxBlueLegPercent}
                  onChange={(e) => setMaxBlueLegPercent(parseInt(e.target.value, 10) || 50)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold"
                  title="سقف درصد نفوذ لگ برگشتی نسبت به لگ مادر"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-amber-300/90 block font-bold">۷. سقف شکست ATR:</span>
                <input
                  type="number"
                  step={0.1}
                  value={maxBreakoutAtrMultiplier}
                  onChange={(e) => setMaxBreakoutAtrMultiplier(parseFloat(e.target.value) || 3.0)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-amber-300 font-mono text-center font-bold"
                  title="سقف مجاز نفوذ شکست قیمت در نقطه E نسبت به ATR"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-amber-300/90 block font-bold">۸. سقف کندل ورود:</span>
                <input
                  type="number"
                  value={maxCandlesToEnter}
                  onChange={(e) => setMaxCandlesToEnter(parseInt(e.target.value, 10) || 35)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-amber-300 font-mono text-center font-bold"
                  title="حداکثر کندل‌های معتبر برای ورود پس از تایید ستاپ قبل از انقضا"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۹. ریسک به ریوارد (R:R):</span>
                <input
                  type="number"
                  step={0.05}
                  value={riskRewardRatio}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (!isNaN(parsed) && parsed > 0) setRiskRewardRatio(parsed);
                  }}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-amber-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۱۰. کارمزد ورود/خروج و اسلیپیج (%):</span>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step={0.01}
                    value={entryCommissionPercent}
                    onChange={(e) => setEntryCommissionPercent(parseFloat(e.target.value) || 0)}
                    className="w-1/3 px-1 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold text-[11px]"
                    title="کارمزد ورود (٪)"
                  />
                  <span className="text-gray-500 text-[10px]">/</span>
                  <input
                    type="number"
                    step={0.01}
                    value={exitCommissionPercent}
                    onChange={(e) => setExitCommissionPercent(parseFloat(e.target.value) || 0)}
                    className="w-1/3 px-1 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold text-[11px]"
                    title="کارمزد خروج (٪)"
                  />
                  <span className="text-gray-500 text-[10px]">/</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={slSlippagePercent}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setSlSlippagePercent(val);
                      try { localStorage.setItem('livetrade_sl_slippage_percent', String(val)); } catch {}
                    }}
                    className="w-1/3 px-1 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-rose-300 font-mono text-center font-bold text-[11px]"
                    title="اسلیپیج استاپ مارکت (٪)"
                  />
                </div>
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۱۱. اهرم معاملاتی:</span>
                <div
                  className="w-full mt-1 px-2 py-1 bg-[#0e121a] border border-[#2c374c] rounded text-emerald-300 font-mono text-center font-bold text-[11px] flex items-center justify-center gap-1 cursor-default"
                  title="بیشترین اهرم مجاز صرافی برای هر ارز به صورت خودکار اعمال می‌شود (BTC: 100x, SOL: 50x, ...)"
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>بیشترین اهرم (Max)</span>
                </div>
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-purple-500/40">
                <span className="text-[10px] text-purple-300 block font-bold" title="حداکثر نسبت ارزش پوزیشن به ریسک">۱۲. نسبت حجم/ریسک:</span>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  step={50}
                  value={maxPositionToRiskRatio}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 300;
                    setMaxPositionToRiskRatio(val);
                    try {
                      localStorage.setItem('livetrade_max_pos_to_risk_ratio', String(val));
                    } catch {}
                  }}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-purple-400 font-mono text-center font-bold text-xs"
                  title="حداکثر نسبت ارزش پوزیشن به ریسک (پیش‌فرض ۳۰۰ - مثلاً پوزیشن $10,000 با ریسک $100 = نسبت 100 <= 300)"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42] flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] text-gray-400 font-bold">۱۲. مدیریت ریسک:</span>
                  <div className="flex items-center bg-[#0e121a] p-0.5 rounded-md border border-[#263143] text-[9px] font-sans">
                    <button
                      type="button"
                      onClick={() => {
                        setRiskMode('percent');
                        try {
                          localStorage.setItem('livetrade_risk_mode', 'percent');
                        } catch {}
                      }}
                      className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                        riskMode === 'percent'
                          ? 'bg-amber-500 text-black shadow-xs'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      درصد %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRiskMode('fixed');
                        try {
                          localStorage.setItem('livetrade_risk_mode', 'fixed');
                        } catch {}
                      }}
                      className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                        riskMode === 'fixed'
                          ? 'bg-cyan-500 text-black shadow-xs'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      ثابت $
                    </button>
                  </div>
                </div>

                {riskMode === 'percent' ? (
                  <div>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={10}
                      value={riskPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1.0;
                        setRiskPercent(val);
                        try {
                          localStorage.setItem('livetrade_risk_percent', String(val));
                        } catch {}
                      }}
                      className="w-full px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-amber-400 font-mono text-center font-bold text-xs"
                      title="محاسبه ریسک بر اساس درصد از موجودی زنده در لحظه ورود (با رشد حساب، ریسک دلاری متناسباً افزایش می‌یابد)"
                    />
                    <div className="text-[9px] text-gray-400 text-center mt-1 flex items-center justify-center gap-1 font-mono">
                      <span>معادل:</span>
                      <strong className="text-amber-300">
                        ${(((balance.availableBalance > 0 ? balance.availableBalance : balance.totalEquity > 0 ? balance.totalEquity : 100) * (riskPercent || 1)) / 100).toFixed(1)}
                      </strong>
                      <span>USDT</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      step={5}
                      min={1}
                      max={50000}
                      value={riskAmountFixed}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 50;
                        setRiskAmountFixed(val);
                        try {
                          localStorage.setItem('livetrade_risk_amount_fixed', String(val));
                        } catch {}
                      }}
                      className="w-full px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-400 font-mono text-center font-bold text-xs"
                      title="مبلغ ثابت دلاری که در صورت برخورد به حد ضرر در هر معامله دقیقاً همین مقدار ضرر می‌شود"
                    />
                    <div className="text-[9px] text-gray-400 text-center mt-1 flex items-center justify-center gap-1 font-mono">
                      <span>معادل:</span>
                      <strong className="text-cyan-300">
                        {(((riskAmountFixed || 50) / (balance.availableBalance > 0 ? balance.availableBalance : balance.totalEquity > 0 ? balance.totalEquity : 100)) * 100).toFixed(1)}%
                      </strong>
                      <span>حساب</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* چک‌باکس عدم ورود به معامله جدید در صورت وجود پوزیشن باز (تک‌پوزیشن) */}
            <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-[#0d1119] border border-[#242f42] gap-2 mt-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white">مدیریت معاملات همزمان (تک‌پوزیشن):</div>
                  <div className="text-[11px] text-gray-400">
                    عدم ورود به معامله جدید در صورت وجود پوزیشن باز (حداکثر ۱ پوزیشن فعال در هر زمان)
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-1.5 rounded-xl bg-[#141a26] border border-[#2d384c] hover:border-amber-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={noConcurrentPositions}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setNoConcurrentPositions(val);
                    try {
                      localStorage.setItem('livetrade_no_concurrent_positions', String(val));
                    } catch {}
                  }}
                  className="w-4 h-4 rounded text-amber-500 bg-[#171d28] border-[#2e394e] focus:ring-amber-500 cursor-pointer"
                />
                <span className={`text-xs font-bold font-mono ${noConcurrentPositions ? 'text-amber-300' : 'text-gray-400'}`}>
                  {noConcurrentPositions ? 'فعال (تک‌پوزیشن)' : 'غیرفعال (همزمان)'}
                </span>
              </label>
            </div>

            {/* حد زمان ماندن در معامله (Time-Stop بر مبنای تعداد کندل) */}
            <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-[#0d1119] border border-cyan-500/30 gap-2 mt-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span>خروج زمانی (Time-Stop):</span>
                    <span className="text-[10px] text-cyan-400 font-normal">بسته شدن معامله در سود یا ضرر پس از تعداد معین کندل</span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    حداکثر تعداد کندل مجاز برای ماندن در معامله باز (پیش‌فرض: ۸۰ کندل)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={500}
                  step={5}
                  value={timeStopCandles}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 80;
                    setTimeStopCandles(val);
                    try {
                      localStorage.setItem('livetrade_time_stop_candles', String(val));
                    } catch {}
                    syncConfigToServer({ timeStopCandles: val });
                  }}
                  disabled={!timeStopEnabled}
                  className="w-20 px-2 py-1 bg-[#141a26] border border-[#2d384c] rounded-lg text-cyan-300 font-mono text-center font-bold text-xs disabled:opacity-40"
                  title="حداکثر تعداد کندل ماندن در پوزیشن"
                />
                <span className="text-xs text-gray-400 font-sans">کندل</span>
                <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl bg-[#141a26] border border-[#2d384c] hover:border-cyan-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={timeStopEnabled}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setTimeStopEnabled(val);
                      try {
                        localStorage.setItem('livetrade_time_stop_enabled', String(val));
                      } catch {}
                      syncConfigToServer({ timeStopEnabled: val });
                    }}
                    className="w-4 h-4 rounded text-cyan-500 bg-[#171d28] border-[#2e394e] focus:ring-cyan-500 cursor-pointer"
                  />
                  <span className={`text-xs font-bold font-mono ${timeStopEnabled ? 'text-cyan-300' : 'text-gray-400'}`}>
                    {timeStopEnabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </label>
              </div>
            </div>

            {/* هشدار انطباق تنظیمات زنده با بکتست نهایی */}
            {(maxCandlesToEnter !== 100 || (riskMode === 'fixed' ? riskAmountFixed : ((balance.availableBalance > 0 ? balance.availableBalance : 100) * riskPercent) / 100) < 5) && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-[11px] space-y-2 text-amber-100 mt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>توصیه‌های تطبیق کامل ترید زنده با بکتست:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {maxCandlesToEnter !== 100 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMaxCandlesToEnter(100);
                          showToast('✅ سقف کندل ورود روی 100 مطابق بکتست تنظیم شد.');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] cursor-pointer transition-colors"
                      >
                        تنظیم سقف کندل ورود روی ۱۰۰
                      </button>
                    )}
                  </div>
                </div>
                <ul className="list-disc pr-4 space-y-0.5 text-amber-200/90 leading-relaxed">
                  {maxCandlesToEnter !== 100 && (
                    <li>
                      سقف کندل ورود در زنده <strong>{maxCandlesToEnter}</strong> است (در بکتست نهایی: <strong>100</strong>).
                    </li>
                  )}
                  {(riskMode === 'fixed' ? riskAmountFixed : ((balance.availableBalance > 0 ? balance.availableBalance : 100) * riskPercent) / 100) < 5 && (
                    <li>
                      با ریسک دلاری زیر <strong>۵ دلار</strong> و کف سفارش <strong>$5 XT</strong>، رندشدن قراردادهای صحیح XT باعث نوسان نسبت حجم/ریسک و سهم کارمزد نسبت به بکتست ۱۰۰ دلاری می‌شود.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* راهنمای نحوه محاسبه دقیق حجم بر اساس Step Size صرافی بایننس و XT */}
            <div className="p-2.5 rounded-xl bg-cyan-950/25 border border-cyan-800/35 text-[11px] space-y-1 text-cyan-200 mt-3">
              <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                <span>محاسبه دقیق حجم بر اساس حداقل اعشار (Step Size) و کارمزد صرافی:</span>
              </div>
              <p className="text-gray-300 leading-relaxed text-[10px]">
                صرافی‌های بایننس و XT به دلیل قوانین گام حجم (Lot Size Step)، اجازه اعشار نامحدود نمی‌دهند (مثلاً ۰.۰۰۱ برای BTC و ۱ برای DOGE). موتور مدیریت ریسک برنامه، حجم سفارش را دقیقاً به پایین (Floor) گرد می‌کند تا در صورت فعال‌شدن Stop Loss، زیان محقق‌شده شما هرگز از سقف بودجه ریسک (مثلاً ۱۰۰ دلار) بیشتر نشود (مثلاً ۹۸.۵$ یا ۹۹.۱$ با احتساب کارمزد ورود و خروج).
              </p>
            </div>
          </div>

          {/* ستون ۳: کنسول مانیتورینگ زنده اسکنر و تاریخچه سفارشات زنده صرافی */}
          <div className="bg-[#10141d] p-4 rounded-2xl border border-[#222b3c] flex flex-col h-full space-y-2.5">
            <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1c2433] gap-2">
              <div className="flex items-center bg-[#0d121c] p-0.5 rounded-xl border border-[#242f42] text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveLogTab('scanner')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeLogTab === 'scanner'
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TerminalIcon className="w-3.5 h-3.5" />
                  <span>لاگ‌های اسکنر ({scanLogs.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLogTab('execution')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeLogTab === 'execution'
                      ? 'bg-amber-500 text-black shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>سفارشات صرافی XT ({serverExecutionLogs.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLogTab('signals')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeLogTab === 'signals'
                      ? 'bg-cyan-500 text-black shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>سیگنال‌های سرور ({serverActiveSignals.length})</span>
                </button>
              </div>

              {activeLogTab === 'scanner' && (
                <button
                  type="button"
                  onClick={() => setScanLogs([])}
                  className="text-[10px] text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="پاکسازی لاگ‌ها"
                >
                  پاکسازی
                </button>
              )}
            </div>

            {/* تب ۱: لاگ‌های اسکنر زنده */}
            {activeLogTab === 'scanner' && (
              <div className="flex-1 bg-[#0b0e14] p-2.5 rounded-xl border border-[#1b2230] font-mono text-[11px] overflow-y-auto max-h-[260px] space-y-1.5">
                {scanLogs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    اسکنر آماده است. برای شروع مداوم در سرور، دکمه «شروع اتوپایلوت سرور» را بزنید.
                  </div>
                ) : (
                  scanLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`leading-relaxed flex items-start gap-1.5 ${
                        log.type === 'trade'
                          ? 'text-amber-300 bg-amber-950/30 p-1 rounded'
                          : log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'warning'
                          ? 'text-rose-400'
                          : 'text-gray-400'
                      }`}
                    >
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">[{log.time}]</span>
                      {log.timeframe && (
                        <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
                          {log.timeframe}
                        </span>
                      )}
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* تب ۲: تاریخچه سفارشات زنده ارسال‌شده به صرافی XT */}
            {activeLogTab === 'execution' && (
              <div className="flex-1 bg-[#0b0e14] p-2 rounded-xl border border-[#1b2230] overflow-y-auto max-h-[260px] space-y-2">
                {serverExecutionLogs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8 text-xs">
                    هنوز سفارشی به صرافی ارسال نشده است. برای راستی‌آزمایی اتصال، روی «تست معامله لایو ($0.1 Risk)» کلیک کنید.
                  </div>
                ) : (
                  serverExecutionLogs.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                        item.status === 'SUCCESS'
                          ? 'bg-[#0f1717] border-emerald-500/40'
                          : 'bg-[#1a1114] border-rose-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              item.posSide === 'LONG'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {item.posSide || item.side}
                          </span>
                          <strong className="text-white uppercase font-mono">{item.symbol}</strong>
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                            {item.timeframe || '5m'}
                          </span>
                          {item.isTestTrade && (
                            <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[9px]">تست $0.1</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'SUCCESS'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {item.status === 'SUCCESS' ? '✅ موفق' : '❌ ناموفق'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedExecDetail(item)}
                            className="p-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-300 hover:text-white transition-colors cursor-pointer"
                            title="مشاهده جزییات پاسخ JSON صرافی"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-300 grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono pt-1 border-t border-[#1e293b]">
                        <div>تایم‌فریم: <strong className="text-cyan-300">{item.timeframe || '5m'}</strong></div>
                        <div>حجم: <strong className="text-cyan-300">{item.contractQty}</strong> قرارداد ({item.coinQty} کوین)</div>
                        <div>ارزش اسمی: <strong className="text-white">${item.nominalUsdt}</strong></div>
                        <div>حجم/ریسک: <strong className="text-purple-300">{item.positionToRiskRatio || (item.actualLossAtSL > 0 ? (item.nominalUsdt / item.actualLossAtSL).toFixed(1) : (item.targetRiskUsdt > 0 ? (item.nominalUsdt / item.targetRiskUsdt).toFixed(1) : '---'))}</strong></div>
                        <div>زمان: <span className="text-gray-400">{item.timeFa || item.time?.slice(11, 19)}</span></div>
                        {item.stopLoss && <div>استاپ: <span className="text-rose-400">{item.stopLoss}</span></div>}
                        {item.takeProfit && <div>تارگت: <span className="text-emerald-400">{item.takeProfit}</span></div>}
                        {item.orderId && <div>Order ID: <span className="text-amber-300">{item.orderId}</span></div>}
                      </div>

                      {item.error && (
                        <div className="text-[10px] text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-800/40">
                          <strong>خطای صرافی:</strong> {item.error}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* تب ۳: سیگنال‌های فعال کشف‌شده در بک‌اند سرور */}
            {activeLogTab === 'signals' && (
              <div className="flex-1 bg-[#0b0e14] p-2 rounded-xl border border-[#1b2230] overflow-y-auto max-h-[260px] space-y-2">
                {serverActiveSignals.length === 0 ? (
                  <div className="text-gray-500 text-center py-8 text-xs space-y-1">
                    <div>در آخرین اسکن سرور هیچ سیگنال شکست جدیدی یافت نشد.</div>
                    <div className="text-[10px] text-gray-600">
                      موتور تحلیلی مستقل سرور در هر چرخه، بازار را به صورت خودکار رصد می‌کند.
                    </div>
                  </div>
                ) : (
                  serverActiveSignals.map((sig, idx) => (
                    <div
                      key={`${sig.symbol}_${idx}`}
                      className="p-2.5 rounded-xl border border-cyan-500/30 bg-[#0d1520] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              sig.posSide === 'LONG'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {sig.posSide}
                          </span>
                          <strong className="text-white font-mono uppercase">{fromXtSymbol(sig.symbol)}</strong>
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                            {sig.timeframe || tradeTimeframe || '5m'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">({sig.strategyName})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                            مارجین: ${sig.requiredMargin}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleNavigateToChart(sig.symbol, sig)}
                            className="p-1 rounded bg-[#1f2937] hover:bg-[#374151] text-cyan-300 hover:text-white transition-colors cursor-pointer"
                            title="مشاهده چارت نماد"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-300 grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono pt-1 border-t border-[#1e293b]">
                        <div>تایم‌فریم: <strong className="text-cyan-300">{sig.timeframe || tradeTimeframe || '5m'}</strong></div>
                        <div>قیمت ورود: <strong className="text-white">{formatPrice(sig.curPrice)}</strong></div>
                        <div>اهرم: <strong className="text-amber-300">{sig.maxLeverage}x</strong></div>
                        <div>حجم مجاز: <strong className="text-cyan-300">{sig.contractQty}</strong></div>
                        <div>استاپ‌لاس: <span className="text-rose-400">{formatPrice(sig.stopLoss)}</span></div>
                        <div>تیک‌پرافیت: <span className="text-emerald-400">{formatPrice(sig.takeProfit)}</span></div>
                        <div>زیان در SL: <strong className="text-rose-300">${sig.riskUsdt}</strong></div>
                        <div>حجم/ریسک: <strong className="text-purple-300">{sig.positionToRiskRatio || (sig.riskUsdt > 0 ? +(sig.notionalUsdt / sig.riskUsdt).toFixed(1) : '---')}</strong></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ۴. جدول پوزیشن‌های باز جاری (Open Positions) */}
        <div className="bg-[#10141d] rounded-2xl border border-[#222b3c] p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1c2433]">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white">پوزیشن‌های معاملاتی باز (Active Positions)</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                {positions.length} فعال
              </span>
            </div>
            <div className="flex items-center gap-2">
              {positions.length > 0 && (
                <button
                  type="button"
                  disabled={isClosingAll}
                  onClick={handleCloseAllPositions}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="بستن فوری تمام پوزیشن‌های باز با قیمت مارکت در صرافی XT (/future/user/v1/position/close-all)"
                >
                  {isClosingAll ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-rose-400" />
                      <span>در حال بستن همه...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>بستن همه پوزیشن‌ها</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRefreshBalance(true)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>به‌روزرسانی</span>
              </button>
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs">
              در حال حاضر هیچ پوزیشن بازی وجود ندارد. پس از تایید اولین شکست در اسکن خودکار، پوزیشن به صورت خودکار اینجا ثبت می‌شود.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="text-gray-400 border-b border-[#1f2838] text-[11px]">
                    <th className="py-2 px-3">جفت‌ارز</th>
                    <th className="py-2 px-3 text-center">تایم‌فریم</th>
                    <th className="py-2 px-3 text-center">جهت</th>
                    <th className="py-2 px-3 text-center">اهرم</th>
                    <th className="py-2 px-3">حجم معامله</th>
                    <th className="py-2 px-3">قیمت ورود</th>
                    <th className="py-2 px-3">قیمت فعلی</th>
                    <th className="py-2 px-3">حد سود (TP)</th>
                    <th className="py-2 px-3">حد ضرر (SL)</th>
                    <th className="py-2 px-3 text-center">کندل مانده تا بستن (Time-Stop)</th>
                    <th className="py-2 px-3 text-center">سود/زیان و ROI شناور</th>
                    <th className="py-2 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202d] font-mono">
                  {positions.map((pos, idx) => {
                    const isLong = pos.side === 'LONG';
                    const cleanPosSym = (pos.symbol || '').toLowerCase().replace(/[-_]/g, '');
                    const matchedTrade = activeDbTrades.find(
                      (t) => (t.symbol || '').toLowerCase().replace(/[-_]/g, '') === cleanPosSym
                    );
                    const posTimeframe = pos.timeframe || matchedTrade?.timeframe || tradeTimeframe || '5m';

                    const openTimeMs = pos.openTimeMs || (matchedTrade?.created_at ? new Date(matchedTrade.created_at).getTime() : Date.now());
                    const tfMs = getTimeframeMsHelper(posTimeframe);
                    const candlesElapsed = pos.candlesElapsed !== undefined ? pos.candlesElapsed : Math.max(0, Math.floor((Date.now() - openTimeMs) / tfMs));
                    const maxTimeStopCandles = pos.maxTimeStopCandles || timeStopCandles || 80;
                    const candlesRemaining = pos.candlesRemaining !== undefined ? pos.candlesRemaining : Math.max(0, maxTimeStopCandles - candlesElapsed);
                    const isTimeStopActive = pos.timeStopEnabled !== false && timeStopEnabled;

                    const effectiveCoinQty = pos.coinQty && pos.coinQty > 0
                      ? pos.coinQty
                      : (pos.contractQty ? pos.contractQty * (pos.contractSize || 1) : pos.amount);

                    const calculatedPnl = pos.unrealizedPnl !== undefined && pos.unrealizedPnl !== null
                      ? pos.unrealizedPnl
                      : (pos.markPrice > 0 && pos.entryPrice > 0 && effectiveCoinQty > 0
                          ? (pos.markPrice - pos.entryPrice) * (isLong ? 1 : -1) * effectiveCoinQty
                          : 0);

                    const calculatedPct = pos.pnlPercent !== undefined && pos.pnlPercent !== null
                      ? pos.pnlPercent
                      : (pos.margin > 0
                          ? (calculatedPnl / pos.margin) * 100
                          : (pos.entryPrice > 0 && pos.markPrice > 0
                              ? ((pos.markPrice - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * (pos.leverage || 10) * 100
                              : 0));

                    const isClosing = closingPosSymbol === pos.symbol;

                    return (
                      <tr
                        key={`${pos.symbol}-${idx}`}
                        onClick={() => handleNavigateToChart(pos.symbol, { ...pos, timeframe: posTimeframe })}
                        className="hover:bg-[#182335] transition-colors cursor-pointer group"
                        title="کلیک روی سطر برای نمایش چارت این جفت‌ارز و خطوط ورود، حد سود و ضرر مشابه تریدینگ‌ویو"
                      >
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                          <span className="group-hover:text-amber-300 transition-colors">{fromXtSymbol(pos.symbol)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-xs">
                            {posTimeframe}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'LONG'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-300 font-bold">{pos.leverage}x</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            <div className="font-bold text-white flex items-center gap-1 font-mono">
                              <span>{pos.contractQty ?? pos.amount}</span>
                              <span className="text-[10px] text-gray-400 font-sans">قرارداد</span>
                            </div>
                            <div className="text-[10px] text-cyan-300 font-mono">
                              {pos.coinQty !== undefined ? `${pos.coinQty} ${fromXtSymbol(pos.symbol).split('/')[0]}` : ''}
                              {pos.notionalUsdt ? ` ($${pos.notionalUsdt})` : ''}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-white font-bold">${formatPrice(pos.entryPrice)}</td>
                        <td className="py-2.5 px-3 text-cyan-300 font-bold">${formatPrice(pos.markPrice)}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {pos.takeProfitPrice ? (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                                <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>${formatPrice(pos.takeProfitPrice)}</span>
                              </div>
                              {pos.entryPrice && pos.stopLossPrice && Math.abs(pos.entryPrice - pos.stopLossPrice) > 0 && (
                                <span className="text-[10px] text-amber-300 font-mono font-bold mt-0.5" title="ریسک به ریوارد تارگت">
                                  R:R 1:{(Math.abs(pos.takeProfitPrice - pos.entryPrice) / Math.abs(pos.entryPrice - pos.stopLossPrice)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-[11px]">---</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {pos.stopLossPrice ? (
                            <div className="flex items-center gap-1 text-rose-400 font-bold">
                              <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>${formatPrice(pos.stopLossPrice)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-[11px]">---</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isTimeStopActive ? (
                            <div className="inline-flex flex-col items-center">
                              <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border shadow-xs ${
                                candlesRemaining <= 10
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 animate-pulse'
                                  : candlesRemaining <= 30
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                    : 'bg-[#141d2c] text-cyan-300 border-cyan-500/30'
                              }`}>
                                {candlesRemaining} کندل مانده
                              </span>
                              <span className="text-[9px] text-gray-400 font-mono mt-0.5">
                                ({candlesElapsed} از {maxTimeStopCandles} کندل)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-[10px]">غیرفعال</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <div className={`flex items-center gap-1.5 font-bold text-xs font-mono ${calculatedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              <span className={`w-2 h-2 rounded-full ${calculatedPnl >= 0 ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-400 shadow-[0_0_8px_#ef4444]'} animate-pulse`} />
                              <span>{calculatedPnl >= 0 ? `+$${formatLivePnl(calculatedPnl)}` : `-$${formatLivePnl(Math.abs(calculatedPnl))}`}</span>
                            </div>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded mt-0.5 font-bold ${calculatedPct >= 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'}`}>
                              {calculatedPct >= 0 ? `+${calculatedPct.toFixed(2)}%` : `${calculatedPct.toFixed(2)}%`} ROI
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleNavigateToChart(pos.symbol, { ...pos, timeframe: posTimeframe })}
                              className="px-2 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                              title="مشاهده چارت زنده و خطوط ورود، استاپ و تارگت مشابه تریدینگ‌ویو"
                            >
                              <LineChart className="w-3 h-3 text-cyan-400" />
                              <span>چارت</span>
                            </button>
                            <button
                              type="button"
                              disabled={isClosing}
                              onClick={() => handleClosePosition(pos)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                isClosing
                                  ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                                  : 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 hover:scale-105 active:scale-95'
                              }`}
                              title="بستن این پوزیشن با قیمت مارکت و لغو خودکار استاپ و تارگت در صرافی XT"
                            >
                              {isClosing ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin text-rose-400" />
                                  <span>در حال بستن...</span>
                                </>
                              ) : (
                                <span>بستن</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ۵. جدول تاریخچه تریدها و مقدار سود و ضرر هر معامله */}
        <div className="bg-[#10141d] rounded-2xl border border-[#222b3c] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1c2433]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white">تاریخچه معاملات و سود/زیان تریدها (Trade History & PnL Log)</h3>
            </div>

            {/* فیلترها و دکمه‌های کنترلی */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#0d121d] border border-amber-500/30 rounded-xl px-2 py-1">
                <select
                  value={rrOptLimit}
                  onChange={(e) => setRrOptLimit(Number(e.target.value) || 0)}
                  className="bg-transparent text-[11px] text-gray-300 font-mono focus:outline-none cursor-pointer"
                  title="تعداد معاملات اخیر صرافی برای بررسی"
                >
                  <option value={0} className="bg-[#0d121d]">همه معاملات ({tradeHistory.length})</option>
                  <option value={200} className="bg-[#0d121d]">۲۰۰ معامله اخیر</option>
                  <option value={100} className="bg-[#0d121d]">۱۰۰ معامله اخیر</option>
                  <option value={50} className="bg-[#0d121d]">۵۰ معامله اخیر</option>
                  <option value={20} className="bg-[#0d121d]">۲۰ معامله اخیر</option>
                </select>
                <span className="text-gray-600 text-[10px]">|</span>
                <select
                  value={rrOptStep}
                  onChange={(e) => setRrOptStep(Number(e.target.value) === 0.25 ? 0.25 : 0.1)}
                  className="bg-transparent text-[11px] text-amber-300 font-mono focus:outline-none cursor-pointer"
                  title="گام تست نسبت R:R بین ۱ تا ۳"
                >
                  <option value={0.1} className="bg-[#0d121d]">گام 0.1</option>
                  <option value={0.25} className="bg-[#0d121d]">گام 0.25</option>
                </select>
                <button
                  type="button"
                  onClick={handleAnalyzeOptimalRr}
                  disabled={isOptimizingRr}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isOptimizingRr
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30 cursor-wait'
                      : 'bg-gradient-to-l from-amber-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 text-amber-300 border border-amber-500/40'
                  }`}
                  title="بررسی کندل‌به‌کندل تک‌تک معاملات صرافی از نقطه ورود تا حد ضرر یا R:R=3 برای یافتن بهینه‌ترین R:R بین ۱ تا ۳ با احتساب کارمزد واقعی"
                >
                  {isOptimizingRr ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                      <span>در حال بررسی کندل‌ها...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>محاسبه R:R بهینه (۱ تا ۳)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center bg-[#0d1017] p-0.5 rounded-lg border border-[#202838] text-[11px]">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`px-2 py-0.5 rounded ${historyFilter === 'all' ? 'bg-[#1b2230] text-white font-bold' : 'text-gray-400'}`}
                >
                  همه ({tradeHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('wins')}
                  className={`px-2 py-0.5 rounded ${historyFilter === 'wins' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-gray-400'}`}
                >
                  سودده ({historyStats.winsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('losses')}
                  className={`px-2 py-0.5 rounded ${historyFilter === 'losses' ? 'bg-rose-950 text-rose-300 font-bold' : 'text-gray-400'}`}
                >
                  زیان‌ده ({historyStats.lossesCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setTradeHistory([])}
                className="p-1.5 rounded-lg bg-[#141924] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#263044] transition-all cursor-pointer"
                title="پاکسازی تاریخچه معاملات"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* پنل تحلیل و شبیه‌سازی R:R بهینه (۱ تا ۳) بر اساس تاریخچه واقعی صرافی */}
          {rrOptResult && rrOptResult.success && rrOptResult.optimal && rrOptResult.actualStats && (
            <div className="bg-[#0b101b] border border-amber-500/35 rounded-2xl p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1c2638]">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-extrabold text-white">
                      نتیجه شبیه‌سازی کندل‌به‌کندل معاملات واقعی (از ورود تا استاپ یا R:R = 3)
                    </h4>
                    <p className="text-[10px] text-gray-400">
                      {rrOptResult.actualStats.testedTrades} معامله دارای SL معتبر از مجموع {rrOptResult.actualStats.totalTrades} معامله صرافی با کندل‌های دقیق ۱m/۵m و کارمزد واقعی بررسی شدند
                      {rrOptResult.actualStats.skippedTrades > 0 ? ` (${rrOptResult.actualStats.skippedTrades} معامله بدون SL رد شد)` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (rrOptResult.optimal) {
                        setRiskRewardRatio(rrOptResult.optimal.rr);
                        showToast(`🎯 نسبت R:R ترید زنده روی مقدار بهینه 1:${rrOptResult.optimal.rr} تنظیم شد و با سرور همگام‌سازی می‌گردد.`);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>اعمال R:R بهینه (1:{rrOptResult.optimal.rr})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRrOptResult(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
                    title="بستن گزارش تحلیل R:R"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* کارت‌های مقایسه عملکرد واقعی در برابر R:R بهینه */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#111827] border border-[#243044] rounded-xl p-3 space-y-1.5">
                  <div className="text-[10px] text-gray-400 font-bold">عملکرد واقعی ثبت‌شده در صرافی</div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-extrabold font-mono ${rrOptResult.actualStats.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rrOptResult.actualStats.netPnl >= 0 ? `+$${rrOptResult.actualStats.netPnl.toFixed(4)}` : `-$${Math.abs(rrOptResult.actualStats.netPnl).toFixed(4)}`}
                    </span>
                    <span className="text-[10px] font-mono text-gray-300">
                      WR: {rrOptResult.actualStats.winRate}% | PF: {rrOptResult.actualStats.profitFactor}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono flex items-center justify-between">
                    <span>برد/باخت: {rrOptResult.actualStats.wins}W / {rrOptResult.actualStats.losses}L</span>
                    <span className="text-amber-400">کارمزد: ${rrOptResult.actualStats.totalFees.toFixed(4)}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-950/50 to-cyan-950/30 border border-emerald-500/45 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-300 font-bold">بهترین R:R بهینه بین ۱ تا ۳</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs font-extrabold">
                      1:{rrOptResult.optimal.rr}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-extrabold font-mono ${rrOptResult.optimal.netPnl >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                      {rrOptResult.optimal.netPnl >= 0 ? `+$${rrOptResult.optimal.netPnl.toFixed(4)}` : `-$${Math.abs(rrOptResult.optimal.netPnl).toFixed(4)}`}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-200">
                      WR: {rrOptResult.optimal.winRate}% | PF: {rrOptResult.optimal.profitFactor}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-300 font-mono flex items-center justify-between">
                    <span>برد/باخت: {rrOptResult.optimal.wins}W / {rrOptResult.optimal.losses}L{rrOptResult.optimal.openCount > 0 ? ` / ${rrOptResult.optimal.openCount} باز` : ''}</span>
                    <span className="text-amber-300">کارمزد شبیه‌سازی: ${rrOptResult.optimal.totalFees.toFixed(4)}</span>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#243044] rounded-xl p-3 space-y-1.5">
                  <div className="text-[10px] text-gray-400 font-bold">اختلاف بازدهی و ریسک بهینه</div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-extrabold font-mono ${rrOptResult.optimal.improvementVsActual >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                      {rrOptResult.optimal.improvementVsActual >= 0 ? `+$${rrOptResult.optimal.improvementVsActual.toFixed(4)}` : `-$${Math.abs(rrOptResult.optimal.improvementVsActual).toFixed(4)}`}
                    </span>
                    <span className="text-[10px] text-gray-400">نسبت به عملکرد واقعی</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono flex items-center justify-between">
                    <span>سود ناخالص: {rrOptResult.optimal.grossProfit >= 0 ? `+$${rrOptResult.optimal.grossProfit.toFixed(4)}` : `-$${Math.abs(rrOptResult.optimal.grossProfit).toFixed(4)}`}</span>
                    <span className="text-rose-300">Max DD: ${rrOptResult.optimal.maxDrawdown.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* نمودار میله‌ای سریع تمام مقادیر R:R از 1.0 تا 3.0 */}
              {rrOptResult.rrCurve && rrOptResult.rrCurve.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-300">
                    <span className="font-bold">منحنی مقایسه سود خالص (Net PnL با کسر کارمزد) در R:Rهای ۱ تا ۳:</span>
                    <button
                      type="button"
                      onClick={() => setShowRrTradeDetails((v) => !v)}
                      className="text-cyan-300 hover:text-cyan-200 underline text-[11px] cursor-pointer"
                    >
                      {showRrTradeDetails ? 'مخفی کردن جزئیات تک‌تک معاملات' : `نمایش بررسی تک‌تک معاملات (${rrOptResult.tradeDetails?.length || 0})`}
                    </button>
                  </div>

                  <div className="overflow-x-auto pb-1">
                    <div className="flex items-end gap-1.5 min-w-[620px] h-28 bg-[#0f1523] border border-[#1f293d] rounded-xl px-3 py-2">
                      {(() => {
                        const curve = rrOptResult.rrCurve || [];
                        const maxAbs = Math.max(0.0001, ...curve.map((c) => Math.abs(c.netPnl)));
                        return curve.map((pt) => {
                          const isBest = rrOptResult.optimal?.rr === pt.rr;
                          const heightPct = Math.max(8, Math.round((Math.abs(pt.netPnl) / maxAbs) * 100));
                          return (
                            <div
                              key={pt.rr}
                              className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                              onClick={() => {
                                setRiskRewardRatio(pt.rr);
                                showToast(`🎯 R:R روی 1:${pt.rr} تنظیم شد (سود خالص شبیه‌سازی‌شده: $${pt.netPnl.toFixed(4)})`);
                              }}
                              title={`R:R 1:${pt.rr} | سود خالص: $${pt.netPnl.toFixed(4)} | WR: ${pt.winRate}% | ${pt.wins}W/${pt.losses}L | کارمزد: $${pt.totalFees.toFixed(4)} (کلیک برای اعمال)`}
                            >
                              <div className="text-[9px] font-mono text-gray-400 group-hover:text-white mb-0.5">
                                {pt.netPnl >= 0 ? `+${pt.netPnl.toFixed(2)}` : pt.netPnl.toFixed(2)}
                              </div>
                              <div
                                style={{ height: `${Math.min(72, Math.max(10, Math.round(heightPct * 0.72)))}%` }}
                                className={`w-full rounded-t transition-all ${
                                  isBest
                                    ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                                    : pt.netPnl >= 0
                                      ? 'bg-emerald-500/70 group-hover:bg-emerald-400'
                                      : 'bg-rose-500/70 group-hover:bg-rose-400'
                                }`}
                              />
                              <div className={`text-[9px] font-mono mt-1 ${isBest ? 'text-amber-300 font-extrabold' : 'text-gray-400'}`}>
                                {pt.rr}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* جدول خلاصه مقادیر تست‌شده */}
                  <div className="max-h-48 overflow-y-auto border border-[#1f293d] rounded-xl">
                    <table className="w-full text-[11px] text-right font-mono">
                      <thead className="sticky top-0 bg-[#121a2a] text-gray-400 border-b border-[#1f293d] font-sans">
                        <tr>
                          <th className="py-1.5 px-2.5">R:R</th>
                          <th className="py-1.5 px-2.5 text-center">برد / باخت / باز</th>
                          <th className="py-1.5 px-2.5 text-center">نرخ برد</th>
                          <th className="py-1.5 px-2.5 text-center">Profit Factor</th>
                          <th className="py-1.5 px-2.5 text-center">سود ناخالص</th>
                          <th className="py-1.5 px-2.5 text-center">کارمزد کل</th>
                          <th className="py-1.5 px-2.5 text-center">سود خالص</th>
                          <th className="py-1.5 px-2.5 text-center">Max DD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#182132]">
                        {rrOptResult.rrCurve.map((pt) => {
                          const isBest = rrOptResult.optimal?.rr === pt.rr;
                          return (
                            <tr
                              key={pt.rr}
                              className={isBest ? 'bg-amber-500/15 text-amber-200 font-bold' : 'hover:bg-[#151e30] text-gray-300'}
                            >
                              <td className="py-1.5 px-2.5">
                                1:{pt.rr} {isBest && <span className="text-[9px] font-sans text-amber-300 mr-1">(بهینه)</span>}
                              </td>
                              <td className="py-1.5 px-2.5 text-center">
                                <span className="text-emerald-400">{pt.wins}</span> / <span className="text-rose-400">{pt.losses}</span>
                                {pt.openCount > 0 && <span className="text-cyan-400"> / {pt.openCount}</span>}
                              </td>
                              <td className="py-1.5 px-2.5 text-center">{pt.winRate}%</td>
                              <td className="py-1.5 px-2.5 text-center">{pt.profitFactor}</td>
                              <td className={`py-1.5 px-2.5 text-center ${pt.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pt.grossProfit >= 0 ? `+$${pt.grossProfit.toFixed(4)}` : `-$${Math.abs(pt.grossProfit).toFixed(4)}`}
                              </td>
                              <td className="py-1.5 px-2.5 text-center text-amber-400">${pt.totalFees.toFixed(4)}</td>
                              <td className={`py-1.5 px-2.5 text-center font-bold ${pt.netPnl >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                {pt.netPnl >= 0 ? `+$${pt.netPnl.toFixed(4)}` : `-$${Math.abs(pt.netPnl).toFixed(4)}`}
                              </td>
                              <td className="py-1.5 px-2.5 text-center text-rose-300">${pt.maxDrawdown.toFixed(4)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* جزئیات بررسی کندل‌به‌کندل تک‌تک معاملات */}
              {showRrTradeDetails && rrOptResult.tradeDetails && rrOptResult.tradeDetails.length > 0 && (
                <div className="max-h-60 overflow-y-auto border border-[#1f293d] rounded-xl">
                  <table className="w-full text-[11px] text-right font-mono">
                    <thead className="sticky top-0 bg-[#121a2a] text-gray-400 border-b border-[#1f293d] font-sans">
                      <tr>
                        <th className="py-1.5 px-2">جفت‌ارز</th>
                        <th className="py-1.5 px-2 text-center">جهت</th>
                        <th className="py-1.5 px-2">ورود / SL</th>
                        <th className="py-1.5 px-2 text-center">خروج واقعی</th>
                        <th className="py-1.5 px-2 text-center">سقف R قبل از استاپ</th>
                        <th className="py-1.5 px-2 text-center">نتیجه در R:R {rrOptResult.optimal.rr}</th>
                        <th className="py-1.5 px-2 text-center">سود خالص شبیه‌سازی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182132]">
                      {rrOptResult.tradeDetails.map((td) => (
                        <tr key={td.id} className="hover:bg-[#151e30] text-gray-300">
                          <td className="py-1.5 px-2 font-bold text-white">{fromXtSymbol(td.symbol)}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={td.positionSide === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                              {td.positionSide}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-[10px]">
                            <div>${formatPrice(td.entryPrice)}</div>
                            <div className="text-rose-400">SL: ${formatPrice(td.stopLossPrice)}</div>
                          </td>
                          <td className="py-1.5 px-2 text-center text-[10px]">
                            <div className={td.actualNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {td.actualNetPnl >= 0 ? `+$${td.actualNetPnl.toFixed(4)}` : `-$${Math.abs(td.actualNetPnl).toFixed(4)}`}
                            </div>
                            <div className="text-gray-400">({td.actualRealizedR >= 0 ? `+${td.actualRealizedR}R` : `${td.actualRealizedR}R`})</div>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 font-bold">
                              +{td.maxFavorableR}R
                            </span>
                            <div className="text-[9px] text-gray-500 mt-0.5">
                              {td.candleResolutionUsed} • {td.candlesScanned} کندل
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {td.simAtOptimal && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-sans ${
                                  td.simAtOptimal.status === 'WIN'
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                    : td.simAtOptimal.status === 'LOSS'
                                      ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                                      : 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                                }`}
                              >
                                {td.simAtOptimal.status === 'WIN' ? 'تارگت خورد' : td.simAtOptimal.status === 'LOSS' ? 'استاپ خورد' : 'هنوز باز'}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold">
                            {td.simAtOptimal && (
                              <span className={td.simAtOptimal.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {td.simAtOptimal.netPnl >= 0 ? `+$${td.simAtOptimal.netPnl.toFixed(4)}` : `-$${Math.abs(td.simAtOptimal.netPnl).toFixed(4)}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              هنوز هیچ تراکنشی ثبت نشده است. با فعال‌سازی اسکن خودکار، معاملات انجام‌شده به همراه مقدار دقیق سود/زیان اینجا ثبت می‌شوند.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="text-gray-400 border-b border-[#1f2838] text-[11px]">
                    <th className="py-2 px-3">زمان و تاریخ ثبت</th>
                    <th className="py-2 px-3">جفت‌ارز</th>
                    <th className="py-2 px-3 text-center">تایم‌فریم</th>
                    <th className="py-2 px-3 text-center">جهت</th>
                    <th className="py-2 px-3 text-center">استراتژی</th>
                    <th className="py-2 px-3">قیمت ورود</th>
                    <th className="py-2 px-3">حد سود (TP)</th>
                    <th className="py-2 px-3">حد ضرر (SL)</th>
                    <th className="py-2 px-3 text-center">ریسک به ریوارد (R:R)</th>
                    <th className="py-2 px-3">حجم</th>
                    <th className="py-2 px-3 text-center">میزان کارمزد</th>
                    <th className="py-2 px-3 text-center">سود/زیان (PnL)</th>
                    <th className="py-2 px-3 text-center">وضعیت</th>
                    <th className="py-2 px-3 text-center">چارت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202d] font-mono">
                  {filteredHistory.map((order) => {
                    const cleanOrderSym = (order.symbol || '').toLowerCase().replace(/[-_]/g, '');
                    const matchedDb = allDbTrades.find(
                      (t) => (t.order_id && t.order_id === order.orderId) ||
                        (t.id && t.id === order.id) ||
                        ((t.symbol || '').toLowerCase().replace(/[-_]/g, '') === cleanOrderSym)
                    );
                    const orderTimeframe = order.timeframe || matchedDb?.timeframe || '5m';

                    return (
                      <tr
                        key={order.id}
                        onClick={() => handleNavigateToChart(order.symbol, { ...order, timeframe: orderTimeframe })}
                        className="hover:bg-[#182335] transition-colors cursor-pointer group"
                        title="کلیک روی سطر برای نمایش چارت و خطوط ورود، استاپ و تارگت این معامله در تب تحلیل"
                      >
                        <td className="py-2.5 px-3 text-gray-300 font-mono text-[11px] whitespace-nowrap">{formatOrderDateTimeEn(order)}</td>
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                          <span className="group-hover:text-cyan-300 transition-colors">{fromXtSymbol(order.symbol)}</span>
                          <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-sans">
                            <LineChart className="w-3 h-3" />
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                            {orderTimeframe}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              order.positionSide === 'LONG' || order.side === 'BUY'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            {order.positionSide || order.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-sans bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
                            {formatStrategyShort(order.strategyName, matchedDb?.strategy_name)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-bold">${formatPrice(order.price)}</td>
                        <td className="py-2.5 px-3 text-emerald-400">${order.takeProfitPrice ? formatPrice(order.takeProfitPrice) : '---'}</td>
                        <td className="py-2.5 px-3 text-rose-400">${order.stopLossPrice ? formatPrice(order.stopLossPrice) : '---'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const entryP = Number(order.price) || 0;
                            const slP = Number(order.stopLossPrice) || 0;
                            const tpP = Number(order.takeProfitPrice) || 0;
                            const slDist = (entryP > 0 && slP > 0) ? Math.abs(entryP - slP) : 0;
                            const tpDist = (entryP > 0 && tpP > 0) ? Math.abs(tpP - entryP) : 0;
                            const calculatedRR = slDist > 0 ? parseFloat((tpDist / slDist).toFixed(2)) : (order.riskReward || (matchedDb?.risk_reward ? Number(matchedDb.risk_reward) : null));
                            const exitP = Number(order.exitPrice) || 0;
                            const isLong = order.positionSide === 'LONG' || order.side === 'BUY';
                            let realizedR: number | null = null;
                            if (slDist > 0 && exitP > 0) {
                              realizedR = parseFloat(((exitP - entryP) * (isLong ? 1 : -1) / slDist).toFixed(2));
                            } else if (order.realizedR !== undefined) {
                              realizedR = Number(order.realizedR);
                            }

                            if (!calculatedRR && realizedR === null) {
                              return <span className="text-gray-500 text-[11px] font-mono">---</span>;
                            }

                            return (
                              <div className="inline-flex flex-col items-center">
                                {calculatedRR && (
                                  <span
                                    className="font-bold text-xs font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40 shadow-xs"
                                    title={`ریسک به ریوارد تارگت: 1 به ${calculatedRR} (فاصله تارگت: ${tpDist.toFixed(4)} | فاصله استاپ: ${slDist.toFixed(4)})`}
                                  >
                                    1:{calculatedRR}
                                  </span>
                                )}
                                {realizedR !== null && (
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded mt-0.5 font-bold ${
                                      realizedR >= 0
                                        ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-500/30'
                                        : 'text-rose-300 bg-rose-950/80 border border-rose-500/30'
                                    }`}
                                    title="ضریب بازدهی واقعی محقق شده (Realized R)"
                                  >
                                    {realizedR >= 0 ? `+${realizedR}R` : `${realizedR}R`}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-3 text-gray-300 font-mono">
                          <span>{order.amount}</span>
                          <span className="text-[10px] text-gray-500 mr-1 font-sans">قرارداد</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                          {order.fee !== undefined ? (
                            <span className="text-amber-400 font-bold">
                              ${Math.abs(order.fee).toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-gray-500">$0.0000</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {order.realizedPnl !== undefined ? (
                            <div className="inline-flex flex-col items-center">
                              <span className={`font-bold text-xs font-mono ${order.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {order.realizedPnl >= 0 ? `+$${formatLivePnl(order.realizedPnl)}` : `-$${formatLivePnl(Math.abs(order.realizedPnl))}`}
                              </span>
                              {order.realizedPnlPercent !== undefined && (
                                <span className={`text-[10px] font-mono px-1 rounded mt-0.5 ${order.realizedPnlPercent >= 0 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'}`}>
                                  {order.realizedPnlPercent >= 0 ? `+${order.realizedPnlPercent.toFixed(1)}%` : `${order.realizedPnlPercent.toFixed(1)}%`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">در جریان</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleNavigateToChart(order.symbol, { ...order, timeframe: orderTimeframe })}
                            className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 mx-auto shadow-xs"
                            title="نمایش ستاپ و خطوط روی چارت مشابه تریدینگ‌ویو"
                          >
                            <LineChart className="w-3 h-3 text-cyan-400" />
                            <span>چارت</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* مودال ۱: ذخیره کانفیگ پارامترهای ترید در دیتابیس */}
      {isSaveConfigModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          dir="rtl"
          onClick={() => setIsSaveConfigModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 space-y-4 text-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1f283a] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Save className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">ذخیره کانفیگ استراتژی ترید</h4>
                  <p className="text-[11px] text-gray-400">ذخیره پارامترهای فعال فعلی در دیتابیس ابری</p>
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-gray-300 block mb-1 font-bold">نام دلخواه برای کانفیگ:</label>
                <input
                  type="text"
                  value={customConfigName}
                  onChange={(e) => setCustomConfigName(e.target.value)}
                  placeholder="مثلاً: ستاپ اسکلپ ۵ دقیقه بیت‌کوین"
                  className="w-full px-3 py-2 bg-[#141924] border border-[#2e3b50] rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="p-3 rounded-xl bg-[#131926] border border-[#232f44] text-[11px] font-mono space-y-1 text-gray-300">
                <div className="text-amber-400 font-bold font-sans">پارامترهای در حال ذخیره:</div>
                <div>استراتژی: {selectedStrategy === 'strategy_1_e_breakout' ? 'شکست E (E-Breakout)' : 'پیوت بعدی (Next-Pivot)'}</div>
                <div>تایم‌فریم: {tradeTimeframe} | دوره ATR: {atrPeriod} | ضریب: {atrMultiplier}</div>
                <div>حداقل کندل: {minCandles} | اهرم: بیشترین اهرم مجاز (Max) | R:R: {riskRewardRatio}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveConfigModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1a2335] hover:bg-[#25324c] text-gray-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentConfig}
                  disabled={isSavingConfig || !customConfigName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer transition-all"
                >
                  {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSavingConfig ? 'در حال ذخیره...' : 'ذخیره در دیتابیس'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال ۲: فراخوانی و لود کانفیگ‌های تست از دیتابیس (مشابه لود کانفیگ بکتست) */}
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
                    لیست پارامترهای تست ذخیره‌شده جهت اعمال مستقیم بر روی اتاق ترید
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
                    می‌توانید با دکمه «ذخیره کانفیگ» در اتاق ترید یا مودال بک‌تست، پارامترهای استراتژی را ذخیره کرده و اینجا فراخوانی کنید.
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
                          onClick={() => handleApplyLoadedConfig(cfg)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>اعمال در اتاق ترید</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteTestConfig(cfg.id, e)}
                          disabled={isDeleting}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-40"
                          title="حذف کانفیگ از دیتابیس"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال انتخاب ارزهای مجاز اسکن و مارکت‌کپ */}
      {isPairsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setIsPairsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl bg-[#0d121c] border border-[#233146] rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-gray-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <span>انتخاب ارزهای مجاز اسکن بازار</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {tempSelectedSymbols.size} ارز فعال
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    ارزهای تیک‌خورده در سیکل‌های اسکن بررسی می‌شوند و معامله با بیشترین اهرم مجاز و حداقل مارجین درگیر انجام می‌پذیرد.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPairsModalOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar: Search & Quick Selection Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 bg-[#131926] p-2.5 rounded-2xl border border-[#202c3f]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="جستجوی نماد یا نام ارز (BTC, SOL, DOGE...)"
                  value={pairsSearchQuery}
                  onChange={(e) => setPairsSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 bg-[#0a0d14] border border-[#2a384d] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* دکمه فیلتر هوشمند مجازهای OpenAPI (حذف ۴۰۶ ارز بدون API در XT) */}
                {exchange === 'xt' && (
                  <button
                    type="button"
                    onClick={() => setFilterOnlyOpenApi((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterOnlyOpenApi
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                        : 'bg-[#182232] text-gray-400 border-[#2a384d] hover:text-white'
                    }`}
                    title="فیلتر ارزهایی که توسط صرافی XT برای معاملات خودکار OpenAPI مجاز نیستند"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>فقط مجازهای OpenAPI</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${filterOnlyOpenApi ? 'bg-emerald-950 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                      {filterOnlyOpenApi ? `${apiSupportedCount || allAvailablePairs.length} ارز` : `همه (${unsupportedCount} بدون API)`}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleSelectAllPairs}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1c2538] hover:bg-[#25324c] text-white text-[11px] font-bold border border-[#2f3f59] transition-colors cursor-pointer flex items-center gap-1"
                >
                  {filteredPairs.length > 0 && filteredPairs.every((p) => tempSelectedSymbols.has(p.symbol)) ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-rose-400" />
                      <span>لغو این لیست</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>انتخاب همه ({filteredPairs.length})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTopPairs(10)}
                  className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition-colors cursor-pointer"
                >
                  ۱۰ ارز برتر
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTopPairs(20)}
                  className="px-2 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 transition-colors cursor-pointer"
                >
                  ۲۰ ارز برتر
                </button>

                {/* دکمه پاکسازی نمادهای بدون API در صورت وجود در انتخاب‌ها */}
                {selectedUnsupportedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveUnsupportedSymbols}
                    className="px-2 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-bold border border-rose-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    title="حذف نمادهایی که در صرافی XT فاقد قابلیت OpenAPI هستند"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف {selectedUnsupportedCount} ارز بدون API</span>
                  </button>
                )}
              </div>
            </div>

            {/* هشدار در صورت انتخاب ارزهای فاقد پشتیبانی OpenAPI */}
            {selectedUnsupportedCount > 0 && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl px-3 py-2 flex items-center justify-between text-xs text-rose-300 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    توجه: <strong>{selectedUnsupportedCount}</strong> ارز انتخاب‌شده توسط صرافی {exchange.toUpperCase()} برای سفارش‌گذاری خودکار API مجاز نیستند (OpenAPI Disabled) و اسکنر سرور روی آنها معامله نمی‌فرستد.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveUnsupportedSymbols}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap"
                >
                  حذف خودکار این ارزها
                </button>
              </div>
            )}

            {/* List / Table of Coins with Market Cap */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 max-h-[50vh] border border-[#1b2434] rounded-2xl p-2 bg-[#090d14]">
              {isLoadingAllPairs ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-400">در حال دریافت فهرست جفت‌ارزها و مارکت‌کپ از صرافی...</p>
                </div>
              ) : filteredPairs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  {filterOnlyOpenApi
                    ? 'هیچ ارز دارای OpenAPI با این عبارت جستجو یافت نشد.'
                    : 'هیچ جفت‌ارزی با این عبارت جستجو یافت نشد.'}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-bold text-gray-400 border-b border-[#1c2637]">
                    <div className="col-span-1 text-center">انتخاب</div>
                    <div className="col-span-4">ارز و جفت‌معاملاتی</div>
                    <div className="col-span-3 text-left font-mono">مارکت‌کپ (Market Cap)</div>
                    <div className="col-span-2 text-left">بیشترین اهرم</div>
                    <div className="col-span-2 text-center">وضعیت OpenAPI</div>
                  </div>

                  {filteredPairs.map((pair, idx) => {
                    const isChecked = tempSelectedSymbols.has(pair.symbol);
                    const maxLev = getMaxLeverageForSymbol(pair.symbol);
                    const marketCap = (pair as any).marketCap || getEstimatedMarketCap(pair.baseAsset, pair.volume24h);
                    const isApiAllowed = pair.isApiSupported !== false && pair.isOpenApi !== false && pair.tradeSwitch !== false;

                    return (
                      <div
                        key={pair.symbol}
                        onClick={() => {
                          setTempSelectedSymbols((prev) => {
                            const next = new Set(prev);
                            if (next.has(pair.symbol)) {
                              next.delete(pair.symbol);
                            } else {
                              next.add(pair.symbol);
                            }
                            return next;
                          });
                        }}
                        className={`grid grid-cols-12 items-center px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                            : !isApiAllowed
                            ? 'bg-rose-950/20 border-rose-900/30 text-gray-300 hover:border-rose-700/50'
                            : 'bg-[#0f141f] border-transparent hover:border-[#253347] text-gray-300'
                        }`}
                      >
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by parent row click
                            className="w-4 h-4 rounded text-amber-500 bg-[#161d2a] border-gray-600 focus:ring-amber-400 cursor-pointer"
                          />
                        </div>

                        <div className="col-span-4 flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono w-4">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-extrabold text-white text-xs">
                              {pair.baseAsset}/USDT
                            </span>
                            <span className="text-[10px] text-gray-400 block truncate">
                              {pair.name || pair.symbol}
                            </span>
                          </div>
                        </div>

                        <div className="col-span-3 text-left font-mono font-bold text-emerald-400 text-xs">
                          {formatMarketCap(marketCap)}
                        </div>

                        <div className="col-span-2 text-left">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                            maxLev >= 75
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : maxLev >= 50
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                          }`}>
                            اهرم {maxLev}x
                          </span>
                        </div>

                        <div className="col-span-2 text-center">
                          {isApiAllowed ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                              مجاز در API
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 text-rose-400 border border-rose-500/40" title="معاملات OpenAPI توسط صرافی برای این جفت‌ارز بسته است">
                              ⛔ بدون API
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#1f283a] shrink-0">
              <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  <strong>{tempSelectedSymbols.size}</strong> ارز انتخاب شده • در صورت سیگنال چندگانه، معامله با کمترین مارجین درگیر اجرا می‌شود.
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsPairsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#182030] hover:bg-[#222d42] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelectedPairs}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره و اعمال (Save)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال مشاهده جزییات اجرای سفارش در صرافی XT */}
      {selectedExecDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setSelectedExecDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#0d121c] border border-[#233146] rounded-3xl shadow-2xl p-5 space-y-4 text-gray-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1f283a] pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedExecDetail.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {selectedExecDetail.status === 'SUCCESS' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>جزییات ارسال سفارش زنده به صرافی XT</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${selectedExecDetail.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}`}>
                      {selectedExecDetail.status === 'SUCCESS' ? 'موفق' : 'ناموفق'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400 font-mono">
                    نماد: <strong className="text-white uppercase">{selectedExecDetail.symbol}</strong> • زمان: {selectedExecDetail.timeFa || selectedExecDetail.time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExecDetail(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#121824] p-3 rounded-2xl border border-[#223044] text-xs font-mono">
                <div>جهت: <strong className="text-amber-300 uppercase">{selectedExecDetail.posSide || selectedExecDetail.side}</strong></div>
                <div>تعداد قرارداد: <strong className="text-cyan-300">{selectedExecDetail.contractQty}</strong></div>
                <div>مقدار کوین: <strong className="text-white">{selectedExecDetail.coinQty}</strong></div>
                <div>ارزش اسمی: <strong className="text-emerald-300">${selectedExecDetail.nominalUsdt}</strong></div>
                <div>استاپ‌لاس: <strong className="text-rose-400">{selectedExecDetail.stopLoss}</strong></div>
                <div>تیک‌پروفیت: <strong className="text-emerald-400">{selectedExecDetail.takeProfit}</strong></div>
                {selectedExecDetail.orderId && (
                  <div className="col-span-2 sm:col-span-3">Order ID صرافی: <strong className="text-amber-300 font-bold">{selectedExecDetail.orderId}</strong></div>
                )}
              </div>

              {selectedExecDetail.error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>پیام خطای بازگشتی از API صرافی XT:</span>
                  </div>
                  <div className="font-mono text-[11px] break-all">{selectedExecDetail.error}</div>
                </div>
              )}

              {/* Request Payload */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-300 block">بسته ارسالی به API صرافی (Request Payload):</span>
                <pre className="p-3 bg-[#0a0d14] border border-[#1d2737] rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto text-left" dir="ltr">
                  {JSON.stringify(selectedExecDetail.payload, null, 2)}
                </pre>
              </div>

              {/* Exchange Response */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-300 block">پاسخ کامل دریافت شده از صرافی (Exchange Response):</span>
                <pre className="p-3 bg-[#0a0d14] border border-[#1d2737] rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto text-left" dir="ltr">
                  {JSON.stringify(selectedExecDetail.response, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f283a] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExecDetail(null)}
                className="px-4 py-2 rounded-xl bg-[#1a2335] hover:bg-[#25324b] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال نتیجه تست معامله لایو با ریسک $0.10 */}
      {showTestTradeModal && testTradeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setShowTestTradeModal(false)}
        >
          <div
            className="relative w-full max-w-xl bg-[#0d121c] border border-[#233146] rounded-3xl shadow-2xl p-5 space-y-4 text-gray-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1f283a] pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${testTradeResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {testTradeResult.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>نتیجه تست معامله لایو در صرافی XT</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${testTradeResult.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}`}>
                      {testTradeResult.success ? 'سفارش ثبت شد ✅' : 'خطا در ثبت ❌'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    راستی‌آزمایی برقراری ارتباط کلیدهای API و موتور ارسال سفارشات زنده
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestTradeModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
              {testTradeResult.details && (
                <div className="grid grid-cols-2 gap-2 bg-[#121824] p-3 rounded-2xl border border-[#223044] text-xs font-mono">
                  <div>نماد: <strong className="text-white uppercase">{testTradeResult.details.symbol}</strong></div>
                  <div>جهت: <strong className="text-amber-300 uppercase">{testTradeResult.details.posSide} ({testTradeResult.details.side})</strong></div>
                  <div>قیمت ورود: <strong className="text-cyan-300">${testTradeResult.details.curPrice}</strong></div>
                  <div>حجم سفارش: <strong className="text-emerald-300">{testTradeResult.details.contractQty} قرارداد</strong></div>
                  <div>استاپ‌لاس: <strong className="text-rose-400">${testTradeResult.details.stopLoss}</strong></div>
                  <div>تارگت (TP): <strong className="text-emerald-400">${testTradeResult.details.takeProfit}</strong></div>
                  {testTradeResult.orderId && (
                    <div className="col-span-2">شناسه سفارش (Order ID): <strong className="text-amber-300 font-bold">{testTradeResult.orderId}</strong></div>
                  )}
                </div>
              )}

              {testTradeResult.exchangeResponse?.msgInfo && (
                <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200">
                  <strong>پیام صرافی:</strong> {testTradeResult.exchangeResponse.msgInfo}
                </div>
              )}

              {/* Raw JSON */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 block">پاسخ خام سرور و صرافی XT:</span>
                <pre className="p-3 bg-[#0a0d14] border border-[#1d2737] rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto text-left max-h-[160px]" dir="ltr">
                  {JSON.stringify(testTradeResult.exchangeResponse || testTradeResult, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f283a] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTestTradeModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold transition-all cursor-pointer shadow-md"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

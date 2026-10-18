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
} from '../types/crypto';
import { StrategyConfig, DEFAULT_STRATEGY_CONFIG } from '../types/strategy';
import {
  fetchXtBalance,
  fetchXtPositions,
  fetchXtOrderHistory,
  createXtOrder,
  closeXtPosition,
  closeAllXtPositions,
  cancelXtOrder,
  fetchXtKlines,
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
import { calculateATR, calculateAtrZigZag, analyzeZigZagLegs, formatPrice } from '../utils/indicators';
import { runStrategy1Backtest, runStrategy2Backtest } from '../utils/strategyEngine';
import { calculateExactTradeSizing, getSymbolLotRule } from '../utils/exchangePrecision';

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

const DEFAULT_POPULAR_WATCHLIST = [
  'btc_usdt', 'eth_usdt', 'sol_usdt', 'xrp_usdt', 'doge_usdt',
  'sui_usdt', 'ada_usdt', 'near_usdt', 'avax_usdt', 'link_usdt',
  'pepe_usdt', 'shib_usdt', 'dot_usdt', 'ltc_usdt', 'apt_usdt',
];

export const LiveTradingTab: React.FC<LiveTradingTabProps> = ({
  currentPair,
  exchange,
  onSelectExchange,
  onSelectPair,
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
  const [tradeTimeframe, setTradeTimeframe] = useState<Timeframe>('5m');
  const [riskRewardRatio, setRiskRewardRatio] = useState<number>(3.0);

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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_POPULAR_WATCHLIST;
  });

  // مودال انتخاب ارزها و مارکت‌کپ
  const [isPairsModalOpen, setIsPairsModalOpen] = useState<boolean>(false);
  const [allAvailablePairs, setAllAvailablePairs] = useState<CryptoPair[]>(() => {
    return COMPREHENSIVE_FALLBACK_PAIRS.map((p) => ({
      ...p,
      marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
    })).sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
  });
  const [isLoadingAllPairs, setIsLoadingAllPairs] = useState<boolean>(false);
  const [tempSelectedSymbols, setTempSelectedSymbols] = useState<Set<string>>(new Set(selectedSymbols));
  const [pairsSearchQuery, setPairsSearchQuery] = useState<string>('');

  const filteredPairs = useMemo(() => {
    const list = allAvailablePairs.length > 0
      ? allAvailablePairs
      : COMPREHENSIVE_FALLBACK_PAIRS.map((p) => ({
          ...p,
          marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
        }));
    if (!pairsSearchQuery.trim()) return list;
    const q = pairsSearchQuery.trim().toLowerCase();
    return list.filter((p) =>
      p.symbol.toLowerCase().includes(q) ||
      (p.baseAsset && p.baseAsset.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  }, [allAvailablePairs, pairsSearchQuery]);

  const handleOpenPairsModal = async () => {
    setIsPairsModalOpen(true);
    setTempSelectedSymbols(new Set(selectedSymbols));
    try {
      setIsLoadingAllPairs(true);
      const res = await fetch(`/api/market/pairs?exchange=${exchange}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
        const mapped = data.pairs.map((p: any) => ({
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
    const arr = Array.from(tempSelectedSymbols);
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
    if (tempSelectedSymbols.size === allAvailablePairs.length) {
      setTempSelectedSymbols(new Set());
    } else {
      setTempSelectedSymbols(new Set(allAvailablePairs.map((p) => p.symbol)));
    }
  };

  const handleSelectTopPairs = (count: number) => {
    const top = allAvailablePairs.slice(0, count).map((p) => p.symbol);
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
    showToast(`📊 انتقال به چارت تحلیلی نماد ${fromXtSymbol(clean)}`);
    addLog('info', `📊 انتقال به تب چارت برای بررسی ${fromXtSymbol(clean)}`, clean);
    if (orderData && onSelectLiveOrder) {
      onSelectLiveOrder({
        ...orderData,
        symbol: clean,
        price: orderData.price || orderData.entryPrice || 0,
        stopLossPrice: orderData.stopLossPrice || orderData.stopLoss || 0,
        takeProfitPrice: orderData.takeProfitPrice || orderData.takeProfit || 0,
        side: orderData.side || orderData.positionSide || 'BUY',
        positionSide: orderData.positionSide || orderData.side || 'LONG',
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
  const [maxBlueLegPercent, setMaxBlueLegPercent] = useState<number>(50);
  const [maxBreakoutAtrMultiplier, setMaxBreakoutAtrMultiplier] = useState<number>(3.0);
  const [maxCandlesToEnter, setMaxCandlesToEnter] = useState<number>(35);
  const [entryCommissionPercent, setEntryCommissionPercent] = useState<number>(0.06);
  const [exitCommissionPercent, setExitCommissionPercent] = useState<number>(0.06);

  // 5. 5-Minute Auto-Scanner Loop State
  const [isAutoScanning, setIsAutoScanning] = useState<boolean>(false);
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
  const [activeLogTab, setActiveLogTab] = useState<'scanner' | 'execution'>('scanner');
  const [isTestTradeLoading, setIsTestTradeLoading] = useState<boolean>(false);
  const [testTradeResult, setTestTradeResult] = useState<any | null>(null);
  const [showTestTradeModal, setShowTestTradeModal] = useState<boolean>(false);
  const [selectedExecDetail, setSelectedExecDetail] = useState<any | null>(null);
  const hasInitializedConfigFromServer = useRef<boolean>(false);

  // History Tab Filter: 'all' | 'wins' | 'losses' | 'open'
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wins' | 'losses' | 'open'>('all');

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

  // Sync Balance & Positions from XT API
  const handleRefreshBalance = useCallback(async (isManual: boolean = false) => {
    if (isManual) setIsRefreshingBalance(true);
    try {
      const data = await fetchXtBalance();
      setBalance(data);
      const pos = await fetchXtPositions();
      setPositions(pos);
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
          if (best.maxBlueLegPercent) setMaxBlueLegPercent(best.maxBlueLegPercent);
          if (best.maxBreakoutAtrMultiplier) setMaxBreakoutAtrMultiplier(best.maxBreakoutAtrMultiplier);
          if (best.maxRiskReward) setRiskRewardRatio(best.maxRiskReward);

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
      setMaxBlueLegPercent(50);
      setMaxBreakoutAtrMultiplier(3.0);
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
        if (zz.maxBlueLegPercent !== undefined) setMaxBlueLegPercent(zz.maxBlueLegPercent);
        if (zz.maxBreakoutAtrMultiplier !== undefined) setMaxBreakoutAtrMultiplier(zz.maxBreakoutAtrMultiplier);
        if (zz.maxRiskReward) setRiskRewardRatio(zz.maxRiskReward);
      }

      const savedCfg = localStorage.getItem('trading_strategy_config');
      if (savedCfg) {
        const cfg = JSON.parse(savedCfg);
        if (cfg.selectedStrategy) setSelectedStrategy(cfg.selectedStrategy);
        if (cfg.maxRiskReward) setRiskRewardRatio(cfg.maxRiskReward);
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
    if (cfg.optMaxBlueLegPercent !== undefined) setMaxBlueLegPercent(cfg.optMaxBlueLegPercent);
    if (cfg.optMaxBreakoutAtr !== undefined) setMaxBreakoutAtrMultiplier(cfg.optMaxBreakoutAtr);
    if (cfg.optMaxRiskReward) setRiskRewardRatio(cfg.optMaxRiskReward);
    if (cfg.selectedStrategyId) setSelectedStrategy(cfg.selectedStrategyId as any);
    if (cfg.timeframe) setTradeTimeframe(cfg.timeframe as any);

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
        riskPercent: 2,
        selectedStrategyId: selectedStrategy,
        entryCommissionPercent: 0.06,
        exitCommissionPercent: 0.06,
        maxCandlesToEnter: 35,
        candleHistoryLimit: 300,
        optAtrPeriod: atrPeriod,
        optMinCandles: minCandles,
        optMinCandlesLong: minCandlesForLongLeg,
        optAtrMultiplier: atrMultiplier,
        optLongLegAtrMult: longLegAtrMultiplier,
        optMaxBlueLegPercent: maxBlueLegPercent,
        optMaxBreakoutAtr: maxBreakoutAtrMultiplier,
        optMaxRiskReward: riskRewardRatio,
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

  // Perform a single scan cycle across selected pairs
  const runScanCycle = useCallback(async () => {
    setIsScanningNow(true);
    const scanStartTime = Date.now();
    // ارزهای مورد اسکن: دقیقاً ارزهایی که توسط کاربر تیک خورده و ذخیره شده‌اند
    const targetSymbols = selectedSymbols && selectedSymbols.length > 0
      ? selectedSymbols
      : DEFAULT_POPULAR_WATCHLIST;

    addLog(
      'info',
      `🔍 شروع اسکن ${targetSymbols.length} ارز فعال در تایم‌فریم ${tradeTimeframe} (${exchange.toUpperCase()})...`
    );

    if (noConcurrentPositions && positions.length > 0) {
      addLog('warning', `⚠️ حالت تک‌پوزیشن فعال است: ${positions.length} پوزیشن باز در حساب وجود دارد.`);
    }

    const candidateSignals: CandidateSignal[] = [];

    for (const sym of targetSymbols) {
      try {
        let candles: CandleData[] = [];
        if (exchange === 'xt') {
          candles = await fetchXtKlines(sym, tradeTimeframe, 300);
        } else {
          const res = await fetchKlines(sym.replace('_', '').toUpperCase(), tradeTimeframe, 300, true, 'binance');
          candles = res.candles;
        }

        if (!candles || candles.length < 50) continue;

        // Calculate Indicators
        const atrResult = calculateATR(candles, atrPeriod);
        const atrValues = atrResult.atrValues;

        const zzResult = calculateAtrZigZag(
          candles,
          atrValues,
          atrMultiplier,
          minCandles
        );

        const analyzedLegs = analyzeZigZagLegs(
          zzResult.points,
          minCandlesForLongLeg,
          longLegAtrMultiplier,
          maxBlueLegPercent,
          maxBreakoutAtrMultiplier
        );

        // Run Strategy Backtest up to the current candle
        const cfg: StrategyConfig = {
          ...DEFAULT_STRATEGY_CONFIG,
          capital: balance.availableBalance > 0 ? balance.availableBalance : 100,
          riskMode,
          riskAmountFixed,
          riskPercent: riskPercent || 1,
          maxRiskReward: riskRewardRatio,
          selectedStrategyId: selectedStrategy,
          maxCandlesToEnter: 35,
          noConcurrentPositions,
        };

        let evalTrades: any[] = [];
        if (selectedStrategy === 'strategy_1_e_breakout') {
          const res = runStrategy1Backtest(candles, zzResult.points, analyzedLegs, cfg);
          evalTrades = res.trades;
        } else {
          const res = runStrategy2Backtest(candles, zzResult.points, analyzedLegs, cfg, atrValues, atrMultiplier, minCandles);
          evalTrades = res.trades;
        }

        // Check if there is an active trade formed on the current or recent candle
        if (evalTrades.length > 0) {
          const lastTrade = evalTrades[evalTrades.length - 1];
          const isCurrentCandleEntry = lastTrade.entryCandleIdx >= candles.length - 2;

          if (isCurrentCandleEntry && (lastTrade.status === 'ACTIVE' || lastTrade.status === 'OPEN')) {
            // بررسی تکراری نبودن پوزیشن روی همین جفت‌ارز
            const alreadyHasPos = positions.some(
              (p) => p.symbol === sym || toXtSymbol(p.symbol) === toXtSymbol(sym)
            );
            if (alreadyHasPos) {
              addLog(
                'warning',
                `⚠️ نماد ${fromXtSymbol(sym)} از قبل دارای پوزیشن باز است؛ سیگنال جدید نادیده گرفته شد.`,
                sym
              );
              continue;
            }

            const side = lastTrade.direction === 'BUY' ? 'BUY' : 'SELL';
            const posSide = lastTrade.direction === 'BUY' ? 'LONG' : 'SHORT';
            const curPrice = candles[candles.length - 1].close;
            const stopLoss = parseFloat(Number(lastTrade.stopLoss || curPrice * (posSide === 'LONG' ? 0.98 : 1.02)).toFixed(4));
            const takeProfit = parseFloat(Number(lastTrade.takeProfit || curPrice * (posSide === 'LONG' ? 1.06 : 0.94)).toFixed(4));

            // بیشترین اهرم مجاز برای این ارز
            const maxLev = getMaxLeverageForSymbol(sym);

            // محاسبه حجم و مارجین بر مبنای بودجه ریسک و قوانین اعشار و استپ‌سایز صرافی
            const currentEquity = balance.availableBalance > 0
              ? balance.availableBalance
              : (balance.totalEquity > 0 ? balance.totalEquity : (balance.walletBalance > 0 ? balance.walletBalance : 100));
            const riskBudgetUsdt = riskMode === 'fixed' && riskAmountFixed && riskAmountFixed > 0
              ? riskAmountFixed
              : currentEquity * ((riskPercent || 1) / 100);

            const sizing = calculateExactTradeSizing(
              riskBudgetUsdt,
              curPrice,
              stopLoss,
              takeProfit,
              0.0006,
              0.0006,
              sym
            );

            const contractQty = sizing.quantizedPositionSize;
            const notionalUsdt = sizing.positionValue;
            const requiredMargin = parseFloat((notionalUsdt / maxLev).toFixed(2));
            const actualRiskUsdt = sizing.actualLossAtSL; // زیان واقعی با کوانتیزه‌کردن به استپ‌سایز صرافی

            candidateSignals.push({
              sym,
              posSide,
              side,
              curPrice,
              stopLoss,
              takeProfit,
              contractQty,
              stepSize: sizing.stepSize,
              qtyPrecision: sizing.qtyPrecision,
              maxLeverage: maxLev,
              requiredMargin,
              notionalUsdt,
              riskUsdt: actualRiskUsdt,
              targetRiskUsdt: riskBudgetUsdt,
              strategyName: selectedStrategy === 'strategy_1_e_breakout' ? 'استراتژی ۱ (E-Breakout)' : 'استراتژی ۲ (Next-Pivot)',
            });
          }
        }
      } catch (coinErr) {
        console.warn(`Error scanning ${sym}`, coinErr);
      }
    }

    const durationMs = Date.now() - scanStartTime;
    const durationFormatted = durationMs >= 60000
      ? `${Math.floor(durationMs / 60000)} دقیقه و ${((durationMs % 60000) / 1000).toFixed(1)} ثانیه`
      : `${(durationMs / 1000).toFixed(1)} ثانیه`;

    addLog(
      'info',
      `⏱️ یک دور اسکن کامل ${targetSymbols.length} ارز تکمیل شد. زمان سپری‌شده: ${durationFormatted} (${(durationMs / 1000).toFixed(2)} ثانیه).`
    );

    if (candidateSignals.length === 0) {
      addLog('info', `✅ اسکن پایان یافت (مدت زمان: ${durationFormatted}). هیچ سیگنال شکست جدیدی در کندل فعلی تایم‌فریم ${tradeTimeframe} در بین ${targetSymbols.length} ارز فعال مشاهده نشد.`);
    } else {
      // قانون کاربر: وقتی چند ترید سیگنال اومد، اونی رو ترید میکنی که مارجین کمتری رو درگیر میکنه
      candidateSignals.sort((a, b) => a.requiredMargin - b.requiredMargin);

      if (candidateSignals.length > 1) {
        const descList = candidateSignals
          .map((c) => `${fromXtSymbol(c.sym)} (مارجین: ${c.requiredMargin}$ | اهرم ${c.maxLeverage}x)`)
          .join(' ، ');
        addLog(
          'info',
          `🎯 ${candidateSignals.length} سیگنال همزمان شناسایی شد (زمان اسکن: ${durationFormatted}): [${descList}]. طبق قانون حداقل مارجین درگیر، سیگنال ${fromXtSymbol(candidateSignals[0].sym)} انتخاب شد.`
        );
      }

      const chosen = candidateSignals[0];
      const chosenName = fromXtSymbol(chosen.sym);

      // شرط ۱: تک‌پوزیشن بودن (در صورت وجود پوزیشن باز وارد معامله جدید نشو)
      if (noConcurrentPositions && positions.length > 0) {
        addLog(
          'warning',
          `⚠️ سیگنال ورود برای ${chosenName} وجود دارد اما به دلیل فعال بودن گزینه «تک‌پوزیشن» و وجود ${positions.length} پوزیشن باز، معامله جدید باز نشد.`,
          chosen.sym
        );
      } else {
        // شرط ۲: حد نصاب مارجین
        // اگر مارجین به حد نصاب نرسید ترید نمیکنی
        const availBal = balance.availableBalance > 0
          ? balance.availableBalance
          : (balance.totalEquity > 0 ? balance.totalEquity : balance.walletBalance);

        if (availBal < chosen.requiredMargin) {
          addLog(
            'warning',
            `⚠️ موجودی آزاد ناکافی! مارجین مورد نیاز برای ${chosenName}: ${chosen.requiredMargin.toFixed(2)} USDT (اهرم ${chosen.maxLeverage}x) | موجودی آزاد حساب: ${availBal.toFixed(2)} USDT. از ورود به معامله صرف‌نظر شد.`,
            chosen.sym
          );
        } else if (isLiveExecution && chosen.notionalUsdt < 5.0) {
          // در معاملات لایو واقعی صرافی، حداقل ارزش سفارش (Notional) معمولاً ۵ دلار است
          addLog(
            'warning',
            `⚠️ ارزش کل معامله (${chosen.notionalUsdt.toFixed(2)}$) کمتر از حداقل مجاز صرافی (5 USDT) است. از ارسال سفارش لایو برای ${chosenName} صرف‌نظر شد.`,
            chosen.sym
          );
        } else {
          // مارجین کافی است -> اجرای ترید با بیشترین اهرم و حداقل مارجین
          const liveEquityVal = balance.availableBalance > 0 ? balance.availableBalance : (balance.totalEquity > 0 ? balance.totalEquity : 100);
          const riskNotice = riskMode === 'fixed'
            ? `زیان واقعی در استاپ: ${chosen.riskUsdt.toFixed(2)}$ (سقف بودجه: ${chosen.targetRiskUsdt || riskAmountFixed}$ | استپ صرافی: ${chosen.stepSize ?? '-'})`
            : `زیان واقعی در استاپ (${riskPercent}%): ${chosen.riskUsdt.toFixed(2)}$ (استپ صرافی: ${chosen.stepSize ?? '-'})`;
          addLog(
            'trade',
            `⚡ سیگنال برگزیده ${chosen.posSide} برای ${chosenName} با بیشترین اهرم (${chosen.maxLeverage}x) و حداقل مارجین درگیر (${chosen.requiredMargin.toFixed(2)} USDT) اجرا می‌شود. حجم مجاز صرافی: ${chosen.contractQty} (${chosen.notionalUsdt.toFixed(1)}$) | ${riskNotice} | ورود: ${formatPrice(chosen.curPrice)} | استاپ: ${formatPrice(chosen.stopLoss)} | تارگت: ${formatPrice(chosen.takeProfit)}`,
            chosen.sym
          );

          // ارسال سفارش زنده یا شبیه‌ساز
          if (isLiveExecution && exchange === 'xt') {
            addLog('info', `🚀 در حال ارسال سفارش زنده فیوچرز به XT.COM با اهرم ${chosen.maxLeverage}x (${chosen.contractQty} قرارداد)...`, chosen.sym);
            const orderRes = await createXtOrder({
              symbol: chosen.sym,
              orderSide: chosen.side,
              orderType: 'MARKET',
              positionSide: chosen.posSide,
              amount: chosen.contractQty,
              triggerProfitPrice: chosen.takeProfit,
              triggerStopPrice: chosen.stopLoss,
            });

            if (orderRes.success) {
              addLog('success', `✅ سفارش زنده فیوچرز با موفقیت ثبت شد (Order ID: ${orderRes.orderId || 'ثبت شد'})`, chosen.sym);
            } else {
              addLog('warning', `⚠️ پیام صرافی: ${orderRes.error || 'سفارش در حالت مارجین آزمایشی نگه‌داری شد'}`, chosen.sym);
            }
          } else {
            addLog('success', `📝 معامله در حالت شبیه‌ساز (Paper Trading) با اهرم ${chosen.maxLeverage}x و مارجین ${chosen.requiredMargin.toFixed(2)}$ با موفقیت ثبت گردید.`, chosen.sym);
          }

          // ثبت در تاریخچه سفارشات
          const newOrder: LiveTradeOrder = {
            id: `order-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: String(Date.now()),
            exchange,
            symbol: chosen.sym,
            side: chosen.side,
            positionSide: chosen.posSide,
            orderType: 'MARKET',
            price: chosen.curPrice,
            amount: chosen.contractQty,
            status: 'FILLED',
            strategyName: chosen.strategyName,
            takeProfitPrice: chosen.takeProfit,
            stopLossPrice: chosen.stopLoss,
            realizedPnl: 0,
            timestamp: new Date().toLocaleTimeString('fa-IR'),
          };

          setTradeHistory((prev) => [newOrder, ...prev]);

          // افزودن به لیست پوزیشن‌های باز با اهرم بیشینه و مارجین محاسبه‌شده
          const newPos: LivePosition = {
            symbol: chosen.sym,
            exchange,
            side: chosen.posSide,
            positionSide: chosen.posSide,
            entryPrice: chosen.curPrice,
            markPrice: chosen.curPrice,
            amount: chosen.contractQty,
            leverage: chosen.maxLeverage,
            margin: chosen.requiredMargin,
            unrealizedPnl: 0,
            pnlPercent: 0,
            takeProfitPrice: chosen.takeProfit,
            stopLossPrice: chosen.stopLoss,
            updatedAt: new Date().toLocaleTimeString('fa-IR'),
          };

          setPositions((prev) => [newPos, ...prev.filter((p) => p.symbol !== chosen.sym)]);
        }
      }
    }

    setIsScanningNow(false);
    // Refresh balance and positions
    handleRefreshBalance();
  }, [
    exchange,
    selectedSymbols,
    tradeTimeframe,
    atrPeriod,
    atrMultiplier,
    minCandles,
    longLegAtrMultiplier,
    minCandlesForLongLeg,
    maxBlueLegPercent,
    maxBreakoutAtrMultiplier,
    riskRewardRatio,
    selectedStrategy,
    noConcurrentPositions,
    positions,
    balance.availableBalance,
    balance.totalEquity,
    balance.walletBalance,
    riskMode,
    riskAmountFixed,
    riskPercent,
    isLiveExecution,
    addLog,
    handleRefreshBalance,
  ]);

  // =========================================================================
  // PERSISTENT SERVER-SIDE BACKGROUND AUTO-SCANNER SYNC & CONTROLS
  // =========================================================================

  // Fetch status of background scanner running on server.ts
  const fetchServerScannerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/live-scanner/status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.state) {
        const { isRunning, isScanning, secondsUntilNextRun, totalRunsCount, lastRunAt, activeSignals, logs, config, executionLogs } = data.state;
        setIsAutoScanning(isRunning);
        setIsScanningNow(isScanning);
        if (typeof secondsUntilNextRun === 'number') {
          setScanSecondsLeft(secondsUntilNextRun);
        }
        setServerRunsCount(totalRunsCount || 0);
        setServerLastRunAt(lastRunAt || null);
        if (data.state.lastResult && typeof data.state.lastResult.durationMs === 'number') {
          setServerLastDurationMs(data.state.lastResult.durationMs);
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
            if (config.timeframe) setTradeTimeframe(config.timeframe);
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
            if (typeof config.maxBlueLegPercent === 'number') setMaxBlueLegPercent(config.maxBlueLegPercent);
            if (typeof config.maxBreakoutAtrMultiplier === 'number') setMaxBreakoutAtrMultiplier(config.maxBreakoutAtrMultiplier);
            if (typeof config.maxCandlesToEnter === 'number') setMaxCandlesToEnter(config.maxCandlesToEnter);
          }
        }

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

  // Save changes directly to server backend
  const syncConfigToServer = useCallback(async (partialConfig: any) => {
    try {
      const res = await fetch('/api/live-scanner/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const timer = setTimeout(() => {
      syncConfigToServer({
        strategyId: selectedStrategy,
        timeframe: tradeTimeframe,
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
        maxBlueLegPercent,
        maxBreakoutAtrMultiplier,
        maxCandlesToEnter,
        entryCommissionPercent,
        exitCommissionPercent,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    selectedStrategy,
    tradeTimeframe,
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
    maxBlueLegPercent,
    maxBreakoutAtrMultiplier,
    maxCandlesToEnter,
    entryCommissionPercent,
    exitCommissionPercent,
    syncConfigToServer,
  ]);

  // Poll server status every 3 seconds to keep UI in sync even after refresh
  useEffect(() => {
    fetchServerScannerStatus();
    const poller = setInterval(fetchServerScannerStatus, 3000);
    return () => clearInterval(poller);
  }, [fetchServerScannerStatus]);

  // Smooth local countdown ticker between server polling intervals
  useEffect(() => {
    if (!isAutoScanning) return;
    const ticker = setInterval(() => {
      setScanSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(ticker);
  }, [isAutoScanning]);

  // Toggle Continuous Background Scanner on Node.js Server
  const handleToggleAutoScan = async () => {
    if (isTogglingServer) return;
    setIsTogglingServer(true);

    try {
      if (!isAutoScanning) {
        const targetSymbols = selectedSymbols && selectedSymbols.length > 0
          ? selectedSymbols
          : DEFAULT_POPULAR_WATCHLIST;

        const configPayload = {
          timeframe: tradeTimeframe,
          exchange,
          strategyId: selectedStrategy,
          symbols: targetSymbols,
          isFutures: true,
          atrPeriod,
          atrMultiplier,
          minCandles,
          minCandlesForLongLeg,
          longLegAtrMultiplier,
          maxBlueLegPercent,
          maxBreakoutAtrMultiplier,
          riskRewardRatio,
          riskMode,
          riskAmountFixed,
          riskPercent,
          capital: balance.availableBalance > 0 ? balance.availableBalance : 1000,
          noConcurrentPositions,
          isLiveExecution,
          userId: currentUser || 'amir',
        };

        const res = await fetch('/api/live-scanner/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: configPayload }),
        });

        if (res.ok) {
          const data = await res.json();
          setIsAutoScanning(true);
          setScanSecondsLeft(data.state?.secondsUntilNextRun || 300);
          setIsScanningNow(true);
          showToast('🚀 اتوپایلوت مداوم سرور فعال شد: اسکن و بررسی خودکار در پس‌زمینه سرور Node.js آغاز گردید.');
          addLog('success', `🚀 اتوپایلوت سرور فعال شد: اسکن مداوم ${targetSymbols.length} ارز در سرور به راه افتاد (پایدار حتی با بستن مرورگر).`);
        } else {
          showToast('❌ خطا در فعال‌سازی اسکنر سرور.');
        }
      } else {
        const res = await fetch('/api/live-scanner/stop', {
          method: 'POST',
        });

        if (res.ok) {
          setIsAutoScanning(false);
          setIsScanningNow(false);
          showToast('⏸️ اسکنر پس‌زمینه سرور متوقف گردید.');
          addLog('warning', '⏸️ اتوپایلوت سرور متوقف شد.');
        } else {
          showToast('❌ خطا در متوقف‌سازی اسکنر سرور.');
        }
      }
    } catch (err: any) {
      showToast(`❌ خطای شبکه: ${err.message}`);
    } finally {
      setIsTogglingServer(false);
      fetchServerScannerStatus();
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
                  <span>• تایم‌فریم: <strong className="text-cyan-300">{serverActiveConfig.timeframe || tradeTimeframe}</strong></span>
                  <span>• استراتژی: <strong className="text-amber-300">{serverActiveConfig.strategyId === 'strategy_2_next_pivot' ? 'Next-Pivot (۲)' : 'E-Breakout (۱)'}</strong></span>
                  <span>• بودجه ریسک: <strong className="text-emerald-300">{serverActiveConfig.riskMode === 'fixed' ? `$${serverActiveConfig.riskAmountFixed || 50} ثابت (با احتساب اعشار و کارمزد صرافی)` : `${serverActiveConfig.riskPercent || 1}% بالانس`}</strong></span>
                  <span>• تک‌پوزیشن: <strong className={serverActiveConfig.noConcurrentPositions ? 'text-amber-300' : 'text-gray-400'}>{serverActiveConfig.noConcurrentPositions ? 'فعال' : 'غیرفعال'}</strong></span>
                  <span>• واچ‌لیست: <strong className="text-cyan-300">{serverActiveConfig.symbols?.length || selectedSymbols?.length || 0} جفت‌ارز</strong></span>
                </div>
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
                <span className="text-2xl font-black font-mono text-emerald-300 tracking-wider">
                  {timeFormatted}
                </span>
                <span className="text-[10px] text-gray-400 block -mt-0.5">
                  {isAutoScanning ? (
                    <span>
                      تا اسکن بعدی • دور: <strong className="text-cyan-300 font-mono">#{serverRunsCount}</strong>
                      {serverLastDurationMs !== null && (
                        <span className="text-gray-400 font-mono text-[10px] mr-1.5 inline-block">
                          (مدت: <strong className="text-emerald-300">{(serverLastDurationMs / 1000).toFixed(1)}s</strong>)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>آماده راه‌اندازی پس‌زمینه</span>
                  )}
                </span>
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
                  onClick={runScanCycle}
                  disabled={isScanningNow}
                  className="p-2 rounded-xl bg-[#1b2230] hover:bg-[#252f42] text-cyan-300 border border-[#2d3a50] transition-all cursor-pointer disabled:opacity-40"
                  title="اجرای فوری اسکن دستی همین حالا"
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
                <span>پایداری مداوم در سرور (حتی با بستن مرورگر)</span>
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
                <label className="text-[11px] text-gray-400 block mb-1">تایم‌فریم اسکن:</label>
                <select
                  value={tradeTimeframe}
                  onChange={(e) => setTradeTimeframe(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-[#141924] border border-[#283346] rounded-xl text-cyan-300 font-mono font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="1m">1m (اسکلپ سریع)</option>
                  <option value="5m">5m (استاندارد اسکن ۵ دقیقه‌ای)</option>
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="1h">1h (سویینگ ساعتی)</option>
                </select>
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
                  step={0.1}
                  value={riskRewardRatio}
                  onChange={(e) => setRiskRewardRatio(parseFloat(e.target.value) || 3.0)}
                  className="w-full mt-1 px-2 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-amber-300 font-mono text-center font-bold"
                />
              </div>

              <div className="bg-[#141924] p-2.5 rounded-xl border border-[#242f42]">
                <span className="text-[10px] text-gray-400 block">۱۰. کارمزد ورود/خروج (%):</span>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step={0.01}
                    value={entryCommissionPercent}
                    onChange={(e) => setEntryCommissionPercent(parseFloat(e.target.value) || 0.06)}
                    className="w-1/2 px-1.5 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold text-[11px]"
                    title="کارمزد ورود درصد"
                  />
                  <span className="text-gray-500">/</span>
                  <input
                    type="number"
                    step={0.01}
                    value={exitCommissionPercent}
                    onChange={(e) => setExitCommissionPercent(parseFloat(e.target.value) || 0.06)}
                    className="w-1/2 px-1.5 py-0.5 bg-[#0e121a] border border-[#2c374c] rounded text-cyan-300 font-mono text-center font-bold text-[11px]"
                    title="کارمزد خروج درصد"
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

            {/* راهنمای نحوه محاسبه دقیق حجم بر اساس Step Size صرافی بایننس و XT */}
            <div className="p-2.5 rounded-xl bg-cyan-950/25 border border-cyan-800/35 text-[11px] space-y-1 text-cyan-200">
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

                      <div className="text-[11px] text-gray-300 grid grid-cols-2 sm:grid-cols-3 gap-1 font-mono pt-1 border-t border-[#1e293b]">
                        <div>حجم: <strong className="text-cyan-300">{item.contractQty}</strong> قرارداد ({item.coinQty} کوین)</div>
                        <div>ارزش اسمی: <strong className="text-white">${item.nominalUsdt}</strong></div>
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
                    <th className="py-2 px-3 text-center">جهت</th>
                    <th className="py-2 px-3 text-center">اهرم</th>
                    <th className="py-2 px-3">حجم معامله</th>
                    <th className="py-2 px-3">قیمت ورود</th>
                    <th className="py-2 px-3">قیمت فعلی</th>
                    <th className="py-2 px-3">حد سود (TP)</th>
                    <th className="py-2 px-3">حد ضرر (SL)</th>
                    <th className="py-2 px-3 text-center">سود/زیان و ROI شناور</th>
                    <th className="py-2 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202d] font-mono">
                  {positions.map((pos, idx) => {
                    const isLong = pos.side === 'LONG';
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
                        onClick={() => handleNavigateToChart(pos.symbol, pos)}
                        className="hover:bg-[#182335] transition-colors cursor-pointer group"
                        title="کلیک روی سطر برای نمایش چارت این جفت‌ارز و خطوط ورود، حد سود و ضرر مشابه تریدینگ‌ویو"
                      >
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                          <span className="group-hover:text-amber-300 transition-colors">{fromXtSymbol(pos.symbol)}</span>
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
                            <div className="flex items-center gap-1 text-emerald-400 font-bold">
                              <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>${formatPrice(pos.takeProfitPrice)}</span>
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
                              onClick={() => handleNavigateToChart(pos.symbol, pos)}
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
            <div className="flex items-center gap-2">
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

          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              هنوز هیچ تراکنشی ثبت نشده است. با فعال‌سازی اسکن خودکار، معاملات انجام‌شده به همراه مقدار دقیق سود/زیان اینجا ثبت می‌شوند.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="text-gray-400 border-b border-[#1f2838] text-[11px]">
                    <th className="py-2 px-3">زمان ثبت</th>
                    <th className="py-2 px-3">جفت‌ارز</th>
                    <th className="py-2 px-3 text-center">جهت</th>
                    <th className="py-2 px-3">استراتژی</th>
                    <th className="py-2 px-3">قیمت ورود</th>
                    <th className="py-2 px-3">حد سود (TP)</th>
                    <th className="py-2 px-3">حد ضرر (SL)</th>
                    <th className="py-2 px-3">حجم</th>
                    <th className="py-2 px-3 text-center">سود/زیان (PnL)</th>
                    <th className="py-2 px-3 text-center">وضعیت</th>
                    <th className="py-2 px-3 text-center">چارت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202d] font-mono">
                  {filteredHistory.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => handleNavigateToChart(order.symbol, order)}
                      className="hover:bg-[#182335] transition-colors cursor-pointer group"
                      title="کلیک روی سطر برای نمایش چارت و خطوط ورود، استاپ و تارگت این معامله در تب تحلیل"
                    >
                      <td className="py-2.5 px-3 text-gray-400 text-[11px]">{order.timestamp}</td>
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                        <span className="group-hover:text-cyan-300 transition-colors">{fromXtSymbol(order.symbol)}</span>
                        <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-sans">
                          <LineChart className="w-3 h-3" />
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
                      <td className="py-2.5 px-3 text-gray-300 font-sans text-[11px]">{order.strategyName}</td>
                      <td className="py-2.5 px-3 text-white font-bold">${formatPrice(order.price)}</td>
                      <td className="py-2.5 px-3 text-emerald-400">${order.takeProfitPrice ? formatPrice(order.takeProfitPrice) : '---'}</td>
                      <td className="py-2.5 px-3 text-rose-400">${order.stopLossPrice ? formatPrice(order.stopLossPrice) : '---'}</td>
                      <td className="py-2.5 px-3 text-gray-300 font-mono">
                        <span>{order.amount}</span>
                        <span className="text-[10px] text-gray-500 mr-1 font-sans">قرارداد</span>
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
                          onClick={() => handleNavigateToChart(order.symbol, order)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 mx-auto shadow-xs"
                          title="نمایش ستاپ و خطوط روی چارت مشابه تریدینگ‌ویو"
                        >
                          <LineChart className="w-3 h-3 text-cyan-400" />
                          <span>چارت</span>
                        </button>
                      </td>
                    </tr>
                  ))}
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
                <button
                  type="button"
                  onClick={handleToggleSelectAllPairs}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1c2538] hover:bg-[#25324c] text-white text-[11px] font-bold border border-[#2f3f59] transition-colors cursor-pointer flex items-center gap-1"
                >
                  {tempSelectedSymbols.size === allAvailablePairs.length ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-rose-400" />
                      <span>لغو همه</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>انتخاب همه (Select All)</span>
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
              </div>
            </div>

            {/* List / Table of Coins with Market Cap */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 max-h-[50vh] border border-[#1b2434] rounded-2xl p-2 bg-[#090d14]">
              {isLoadingAllPairs ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-400">در حال دریافت فهرست جفت‌ارزها و مارکت‌کپ از صرافی...</p>
                </div>
              ) : filteredPairs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  هیچ جفت‌ارزی با این عبارت جستجو یافت نشد.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-bold text-gray-400 border-b border-[#1c2637]">
                    <div className="col-span-1 text-center">انتخاب</div>
                    <div className="col-span-4">ارز و جفت‌معاملاتی</div>
                    <div className="col-span-4 text-left font-mono">مارکت‌کپ (Market Cap)</div>
                    <div className="col-span-3 text-left">بیشترین اهرم مجاز</div>
                  </div>

                  {filteredPairs.map((pair, idx) => {
                    const isChecked = tempSelectedSymbols.has(pair.symbol);
                    const maxLev = getMaxLeverageForSymbol(pair.symbol);
                    const marketCap = (pair as any).marketCap || getEstimatedMarketCap(pair.baseAsset, pair.volume24h);

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

                        <div className="col-span-4 text-left font-mono font-bold text-emerald-400 text-xs">
                          {formatMarketCap(marketCap)}
                        </div>

                        <div className="col-span-3 text-left">
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

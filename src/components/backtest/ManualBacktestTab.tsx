import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Sliders,
  DollarSign,
  Percent,
  Cpu,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Database,
  Save,
  FolderOpen,
  CloudUpload,
  CloudDownload,
  FileSpreadsheet,
  FileCheck2,
  ShieldAlert,
  TrendingUp,
  LineChart,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Loader2,
  AlertTriangle,
  MoveHorizontal,
  Camera,
  Coins,
  Filter,
  Calendar,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  CheckCircle2,
  Layers,
  HardDrive,
  BarChart2,
  X,
} from 'lucide-react';
import { Timeframe, ZigZagSettings } from '../../types/crypto';
import { BacktestResultItem, GLOBAL_CANDLE_CACHE } from './types';

export interface ManualBacktestTabProps {
  selectedStrategyId: 'strategy_1_e_breakout' | 'strategy_2_next_pivot';
  setSelectedStrategyId: (val: 'strategy_1_e_breakout' | 'strategy_2_next_pivot') => void;
  isScanning: boolean;
  selectedAllowedSymbols: string[];
  onOpenAllowedPairsModal: () => void;
  onQuickSelectSymbols?: (count: number | 'all') => void;
  onOpenTimeRangeModal: () => void;
  timeRangeLabel?: string;
  estimatedCandles?: number;
  universeOption?: 'all_market' | 'all_futures' | 'all_spot' | 'top_50' | 'top_30';
  setUniverseOption?: (val: 'all_market' | 'all_futures' | 'all_spot' | 'top_50' | 'top_30') => void;
  timeframe: Timeframe;
  setTimeframe: (val: Timeframe) => void;
  candleHistoryLimit: number;
  setCandleHistoryLimit: (val: number) => void;
  riskMode: 'percent' | 'fixed';
  setRiskMode: (mode: 'percent' | 'fixed') => void;
  riskPercent: number;
  setRiskPercent: (val: number) => void;
  riskAmountFixed: number;
  setRiskAmountFixed: (val: number) => void;
  effectiveRiskPercent: number;
  effectiveRiskUsdt: number;
  capital: number;
  setCapital: (val: number) => void;
  entryCommissionPercent: number;
  setEntryCommissionPercent: (val: number) => void;
  exitCommissionPercent: number;
  setExitCommissionPercent: (val: number) => void;
  commissionPercent: number;
  slSlippagePercent?: number;
  setSlSlippagePercent?: (val: number) => void;
  noConcurrentPositions: boolean;
  handleToggleNoConcurrentPositions: (val: boolean) => void;
  optAtrPeriod: number;
  setOptAtrPeriod: (val: number) => void;
  optAtrMultiplier: number;
  setOptAtrMultiplier: (val: number) => void;
  optMinCandles: number;
  setOptMinCandles: (val: number) => void;
  optMinCandlesLong: number;
  setOptMinCandlesLong: (val: number) => void;
  optMinCandlesBlue?: number;
  setOptMinCandlesBlue?: (val: number) => void;
  optLongLegAtrMult: number;
  setOptLongLegAtrMult: (val: number) => void;
  optBlueLegAtrMult?: number;
  setOptBlueLegAtrMult?: (val: number) => void;
  optMaxBlueLegPercent: number;
  setOptMaxBlueLegPercent: (val: number) => void;
  optMaxBreakoutAtr: number;
  setOptMaxBreakoutAtr: (val: number) => void;
  optMaxRiskReward: number;
  setOptMaxRiskReward: (val: number) => void;
  optMaxPositionToRiskRatio?: number;
  setOptMaxPositionToRiskRatio?: (val: number) => void;
  optTimeStopEnabled: boolean;
  setOptTimeStopEnabled: (val: boolean) => void;
  optTimeStopCandles: number;
  setOptTimeStopCandles: (val: number) => void;
  onUpdateZigZagSettings?: (settings: Partial<ZigZagSettings>) => void;
  zigzagSettings?: ZigZagSettings;
  scanWorkersCount: number;
  setScanWorkersCount: (val: number) => void;
  handleStartScan: (useCachedOnly?: boolean, overrideConfig?: any, scanMode?: any) => void;
  handleRerunOnCachedData: () => void;
  handleClearCandleCache: () => void;
  handleClearAllCandlesDatabase?: () => void;
  handleStopScan: () => void;
  cachedCount: number;
  handleOpenSaveConfigModal: () => void;
  handleOpenLoadConfigModal: () => void;
  handleOpenSaveCandleModal: () => void;
  handleOpenLoadCandleModal: () => void;
  handleExportScannerCSV: () => void;
  handleExportTradeLedgerCSV: () => void;
  handleClearResults: () => void;
  results: BacktestResultItem[];
  progress: { current: number; total: number; currentSymbol: string };
  totalScanned: number;
  profitableCount: number;
  isPortfolioFilterActive: boolean;
  totalNetProfitSum: number;
  portfolioReturnPercent: number;
  rawTotalNetProfitSum: number;
  totalFeeSum: number;
  totalWinTradesSum: number;
  totalTradesSum: number;
  portfolioWinRate: number;
  rawTotalWinTradesSum: number;
  rawTotalTradesSum: number;
  rawMarketWinRate: number;
  portfolioMaxDrawdown: number;
  portfolioOptimalRisk: number;
  portfolioOptimalFixedRisk: number;
  portfolioProfitFactor: number;
  equityPoints: any[];
  chartStats: any;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  chartScrollContainerRef: React.RefObject<HTMLDivElement>;
  handleDownloadEquityChartImage: () => void;
  handleChartMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleChartMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleChartMouseUpOrLeave: () => void;
  handleTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  handleTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  handleTouchEnd: () => void;
  handleChartWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  hoveredEquityPoint: any;
  setHoveredEquityPoint: (val: any) => void;
  isChartDragging: boolean;
  rangeStatus?: any;
  isCheckingRange?: boolean;
  onSelectPairAndClose?: (pair: any) => void;
  selectedExchange?: 'xt' | 'binance';
  onOpenRescanChoiceModal?: () => void;
  handleStartIncrementalScan?: () => void;
  skippedSymbols?: { symbol: string; reason: string }[];
  onRemoveSkippedSymbols?: (symbolsToRemove: string[]) => void;
}

export const ManualBacktestTab: React.FC<ManualBacktestTabProps> = ({
  selectedStrategyId,
  setSelectedStrategyId,
  isScanning,
  rangeStatus,
  isCheckingRange,
  selectedAllowedSymbols = [],
  selectedExchange = 'xt',
  onOpenRescanChoiceModal,
  handleStartIncrementalScan,
  skippedSymbols = [],
  onRemoveSkippedSymbols,
  onOpenAllowedPairsModal,
  onQuickSelectSymbols,
  onOpenTimeRangeModal,
  timeRangeLabel,
  estimatedCandles,
  universeOption,
  setUniverseOption,
  timeframe,
  setTimeframe,
  candleHistoryLimit,
  setCandleHistoryLimit,
  riskMode,
  setRiskMode,
  riskPercent,
  setRiskPercent,
  riskAmountFixed,
  setRiskAmountFixed,
  effectiveRiskPercent,
  effectiveRiskUsdt,
  capital,
  setCapital,
  entryCommissionPercent,
  setEntryCommissionPercent,
  exitCommissionPercent,
  setExitCommissionPercent,
  commissionPercent,
  slSlippagePercent = 0.04,
  setSlSlippagePercent,
  noConcurrentPositions,
  handleToggleNoConcurrentPositions,
  optAtrPeriod,
  setOptAtrPeriod,
  optAtrMultiplier,
  setOptAtrMultiplier,
  optMinCandles,
  setOptMinCandles,
  optMinCandlesLong,
  setOptMinCandlesLong,
  optMinCandlesBlue = 3,
  setOptMinCandlesBlue,
  optLongLegAtrMult,
  setOptLongLegAtrMult,
  optBlueLegAtrMult = 3,
  setOptBlueLegAtrMult,
  optMaxBlueLegPercent,
  setOptMaxBlueLegPercent,
  optMaxBreakoutAtr,
  setOptMaxBreakoutAtr,
  optMaxRiskReward,
  setOptMaxRiskReward,
  optMaxPositionToRiskRatio = 300,
  setOptMaxPositionToRiskRatio,
  optTimeStopEnabled,
  setOptTimeStopEnabled,
  optTimeStopCandles,
  setOptTimeStopCandles,
  onUpdateZigZagSettings,
  zigzagSettings,
  scanWorkersCount,
  setScanWorkersCount,
  handleStartScan,
  handleRerunOnCachedData,
  handleClearCandleCache,
  handleClearAllCandlesDatabase,
  handleStopScan,
  cachedCount,
  handleOpenSaveConfigModal,
  handleOpenLoadConfigModal,
  handleOpenSaveCandleModal,
  handleOpenLoadCandleModal,
  handleExportScannerCSV,
  handleExportTradeLedgerCSV,
  handleClearResults,
  results,
  progress,
  totalScanned,
  profitableCount,
  isPortfolioFilterActive,
  totalNetProfitSum,
  portfolioReturnPercent,
  rawTotalNetProfitSum,
  totalFeeSum,
  totalWinTradesSum,
  totalTradesSum,
  portfolioWinRate,
  rawTotalWinTradesSum,
  rawTotalTradesSum,
  rawMarketWinRate,
  portfolioMaxDrawdown,
  portfolioOptimalRisk,
  portfolioOptimalFixedRisk,
  portfolioProfitFactor,
  equityPoints,
  chartStats,
  zoomLevel,
  setZoomLevel,
  chartScrollContainerRef,
  handleDownloadEquityChartImage,
  handleChartMouseDown,
  handleChartMouseMove,
  handleChartMouseUpOrLeave,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleChartWheel,
  hoveredEquityPoint,
  setHoveredEquityPoint,
  isChartDragging,
  onSelectPairAndClose,
}) => {
  const [isSkippedModalOpen, setIsSkippedModalOpen] = useState<boolean>(false);

  return (
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-gray-300">ارزهای مجاز اسکن بازار:</label>
                    <span className="text-[9px] text-amber-300/80 font-mono">
                      (تعداد کاملاً داینامیک)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAllowedPairsModal}
                    disabled={isScanning}
                    className="w-full flex items-center justify-between px-3 py-1.5 bg-[#171d28] hover:bg-[#1f2838] border border-[#2e394e] hover:border-amber-400/60 rounded-lg text-white font-bold text-xs transition-all cursor-pointer group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="کلیک کنید تا لیست کامل ارزها با مارکت‌کپ و چک‌باکس‌ها باز شود"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                        <Coins className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-amber-300 font-mono text-xs font-extrabold">
                        {selectedAllowedSymbols.length} ارز انتخابی فعال
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 group-hover:bg-amber-500/30">
                      <Filter className="w-3 h-3" />
                      انتخاب دلخواه
                    </span>
                  </button>

                  {/* کلیدهای سریع انتخاب داینامیک تعداد ارز */}
                  {onQuickSelectSymbols && (
                    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[#1e2738] flex-wrap text-[10px]">
                      <span className="text-gray-400 ml-0.5">سریع:</span>
                      {[10, 30, 50].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={isScanning}
                          onClick={() => onQuickSelectSymbols(num)}
                          className={`px-2 py-0.5 rounded border font-mono font-bold transition-all cursor-pointer ${
                            selectedAllowedSymbols.length === num
                              ? 'bg-amber-400 text-black border-amber-400 shadow-xs'
                              : 'bg-[#141b27] hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border-[#2d3a50]'
                          } disabled:opacity-50`}
                          title={`انتخاب فوری ${num} ارز برتر بر اساس مارکت‌کپ`}
                        >
                          {num} ارز
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isScanning}
                        onClick={() => onQuickSelectSymbols('all')}
                        className={`px-2 py-0.5 rounded border font-mono font-bold transition-all cursor-pointer ${
                          selectedAllowedSymbols.length > 50
                            ? 'bg-cyan-500 text-black border-cyan-400 shadow-xs'
                            : 'bg-[#141b27] hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-300 border-[#2d3a50]'
                        } disabled:opacity-50`}
                        title="انتخاب تمام نمادهای فعال مارکت"
                      >
                        همه
                      </button>
                    </div>
                  )}
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
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">بازه زمانی و تقویم:</label>
                    <button
                      type="button"
                      onClick={onOpenTimeRangeModal}
                      disabled={isScanning}
                      className="w-full flex items-center justify-between px-2 py-1 bg-[#171d28] hover:bg-[#1f2838] border border-[#2e394e] hover:border-amber-400/60 rounded-lg text-white font-bold text-xs transition-all cursor-pointer group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title="کلیک کنید تا تقویم و بازه زمانی تست انتخاب شود"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-105 transition-transform" />
                        <span className="text-amber-300 font-mono text-[11px] truncate">
                          {timeRangeLabel || `${candleHistoryLimit} کندل`}
                        </span>
                      </div>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-mono">
                        {estimatedCandles ? `~${estimatedCandles}` : `${candleHistoryLimit}`}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#283244] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div className="flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold text-gray-300">
                        {riskMode === 'percent' ? 'ریسک (٪):' : 'ریسک ثابت:'}
                      </label>
                      <div className="flex items-center bg-[#141b27] rounded-md p-0.5 border border-[#2d3a4e]">
                        <button
                          type="button"
                          onClick={() => setRiskMode('percent')}
                          disabled={isScanning}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                            riskMode === 'percent'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title="ریسک درصدی بر مبنای کل سرمایه اولیه"
                        >
                          ٪ درصد
                        </button>
                        <button
                          type="button"
                          onClick={() => setRiskMode('fixed')}
                          disabled={isScanning}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                            riskMode === 'fixed'
                              ? 'bg-amber-400 text-black shadow-xs'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title="مبلغ ریسک ثابت بر حسب تتر (USDT) برای هر معامله"
                        >
                          $ ثابت
                        </button>
                      </div>
                    </div>
                    {riskMode === 'percent' ? (
                      <div>
                        <input
                          type="number"
                          min={0.1}
                          max={50}
                          step={0.1}
                          value={riskPercent === 0 || riskPercent ? riskPercent : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRiskPercent(v === '' ? ('' as any) : Number(v));
                          }}
                          onBlur={() => {
                            if (!riskPercent || isNaN(riskPercent)) setRiskPercent(1.0);
                          }}
                          disabled={isScanning}
                          className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-rose-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                          title="درصد ریسک در هر معامله"
                        />
                        <span className="text-[9px] text-gray-400 block text-center font-mono mt-0.5">
                          (= {effectiveRiskUsdt.toLocaleString()}$)
                        </span>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="number"
                          min={0.1}
                          max={100000}
                          step={0.1}
                          value={riskAmountFixed === 0 || riskAmountFixed ? riskAmountFixed : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRiskAmountFixed(v === '' ? ('' as any) : Number(v));
                          }}
                          onBlur={() => {
                            if (!riskAmountFixed || isNaN(riskAmountFixed)) setRiskAmountFixed(10);
                          }}
                          disabled={isScanning}
                          className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-amber-300 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                          title="مبلغ ریسک ثابت هر معامله (USDT)"
                        />
                        <span className="text-[9px] text-gray-400 block text-center font-mono mt-0.5">
                          (= {effectiveRiskPercent}٪)
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-amber-300 block mb-1">کارمزد ورود (%):</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={entryCommissionPercent === 0 || entryCommissionPercent ? entryCommissionPercent : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEntryCommissionPercent(v === '' ? ('' as any) : Number(v));
                      }}
                      onBlur={() => {
                        if (isNaN(entryCommissionPercent) || entryCommissionPercent === null || (entryCommissionPercent as any) === '') setEntryCommissionPercent(0.06);
                      }}
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
                      value={exitCommissionPercent === 0 || exitCommissionPercent ? exitCommissionPercent : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setExitCommissionPercent(v === '' ? ('' as any) : Number(v));
                      }}
                      onBlur={() => {
                        if (isNaN(exitCommissionPercent) || exitCommissionPercent === null || (exitCommissionPercent as any) === '') setExitCommissionPercent(0.06);
                      }}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-amber-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                      title="کارمزد خروج از هر پوزیشن (پیش‌فرض ۰.۰۶٪)"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-rose-300 block mb-1" title="میانگین لغزش قیمت در استاپ‌لاس مارکت واقعی (در XT حدود ۰.۰۴٪)">اسلیپیج SL (%):</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={slSlippagePercent === 0 || slSlippagePercent ? slSlippagePercent : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSlSlippagePercent?.(v === '' ? ('' as any) : Number(v));
                      }}
                      onBlur={() => {
                        if (isNaN(slSlippagePercent) || slSlippagePercent === null || (slSlippagePercent as any) === '') setSlSlippagePercent?.(0.04);
                      }}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-rose-300 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                      title="میانگین اسلیپیج استاپ‌لاس مارکت بر حسب درصد قیمت (پیش‌فرض ۰.۰۴٪ مطابق تاریخچه XT)"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">حداکثر R:R:</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={0.5}
                      value={optMaxRiskReward === 0 || optMaxRiskReward ? optMaxRiskReward : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOptMaxRiskReward(v === '' ? ('' as any) : Number(v));
                      }}
                      onBlur={() => {
                        if (!optMaxRiskReward || isNaN(optMaxRiskReward)) setOptMaxRiskReward(2);
                      }}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-emerald-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-purple-300 block mb-1" title="حداکثر نسبت ارزش پوزیشن به ریسک">نسبت حجم/ریسک:</label>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      step={50}
                      value={optMaxPositionToRiskRatio === 0 || optMaxPositionToRiskRatio ? optMaxPositionToRiskRatio : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (setOptMaxPositionToRiskRatio) setOptMaxPositionToRiskRatio(v === '' ? ('' as any) : Number(v));
                      }}
                      onBlur={() => {
                        if ((!optMaxPositionToRiskRatio || isNaN(optMaxPositionToRiskRatio)) && setOptMaxPositionToRiskRatio) setOptMaxPositionToRiskRatio(300);
                      }}
                      disabled={isScanning}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-purple-400 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                      title="حداکثر نسبت ارزش پوزیشن به ریسک (پیش‌فرض ۳۰۰)"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold text-cyan-300">Time-Stop:</label>
                      <label className="flex items-center gap-1 cursor-pointer" title="فعال/غیرفعال‌سازی حد زمان معامله">
                        <input
                          type="checkbox"
                          checked={optTimeStopEnabled}
                          onChange={(e) => setOptTimeStopEnabled(e.target.checked)}
                          disabled={isScanning}
                          className="w-3 h-3 accent-cyan-400 rounded cursor-pointer"
                        />
                        <span className="text-[9px] text-cyan-400 font-mono">کندل</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      value={optTimeStopCandles === 0 || optTimeStopCandles ? optTimeStopCandles : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOptTimeStopCandles(v === '' ? ('' as any) : parseInt(v, 10));
                      }}
                      onBlur={() => {
                        if (!optTimeStopCandles || isNaN(optTimeStopCandles)) setOptTimeStopCandles(80);
                      }}
                      disabled={isScanning || !optTimeStopEnabled}
                      className="w-full px-1 py-1 bg-[#171d28] border border-[#2e394e] rounded-lg text-cyan-300 text-xs font-mono font-bold text-center focus:outline-none disabled:opacity-50"
                      title="حداکثر تعداد کندل ماندن در معامله (خروج زمانی چه در سود چه در ضرر)"
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
                      disabled={isScanning || !(cachedCount > 0 || rangeStatus?.exists || results.length > 0)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        (cachedCount > 0 || rangeStatus?.exists || results.length > 0) && !isScanning
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-md shadow-emerald-500/25'
                          : 'bg-[#182030] text-gray-500 border border-[#2b3548] cursor-not-allowed opacity-60'
                      }`}
                      title={!(cachedCount > 0 || rangeStatus?.exists || results.length > 0) ? 'ابتدا باید داده‌های بازار را با دکمه اسکن دانلود کنید' : 'محاسبه مجدد فوری با پارامترهای جدید بدون نیاز به دانلود'}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>⚡ محاسبه و آپدیت با پارامترهای جدید ({rangeStatus?.coverage?.availableSymbolsCount || rangeStatus?.dataset?.symbolCount || cachedCount || results.length || 0} ارز)</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">دوره ATR:</label>
                    <input
                      type="number"
                      value={optAtrPeriod === 0 || optAtrPeriod ? optAtrPeriod : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseInt(v, 10);
                        setOptAtrPeriod(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, atrPeriod: num });
                      }}
                      onBlur={() => {
                        if (!optAtrPeriod || isNaN(optAtrPeriod)) {
                          setOptAtrPeriod(55);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, atrPeriod: 55 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">حداقل کندل:</label>
                    <input
                      type="number"
                      value={optMinCandles === 0 || optMinCandles ? optMinCandles : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseInt(v, 10);
                        setOptMinCandles(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, minCandles: num });
                      }}
                      onBlur={() => {
                        if (!optMinCandles || isNaN(optMinCandles)) {
                          setOptMinCandles(3);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, minCandles: 3 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">کندل لگ بلند:</label>
                    <input
                      type="number"
                      value={optMinCandlesLong === 0 || optMinCandlesLong ? optMinCandlesLong : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseInt(v, 10);
                        setOptMinCandlesLong(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, minCandlesForLongLeg: num });
                      }}
                      onBlur={() => {
                        if (!optMinCandlesLong || isNaN(optMinCandlesLong)) {
                          setOptMinCandlesLong(20);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, minCandlesForLongLeg: 20 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">ضریب عادی ATR:</label>
                    <input
                      type="number"
                      step={0.1}
                      value={optAtrMultiplier === 0 || optAtrMultiplier ? optAtrMultiplier : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseFloat(v);
                        setOptAtrMultiplier(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, atrMultiplier: num });
                      }}
                      onBlur={() => {
                        if (!optAtrMultiplier || isNaN(optAtrMultiplier)) {
                          setOptAtrMultiplier(3.0);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, atrMultiplier: 3.0 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">ضریب لگ بلند:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={optLongLegAtrMult === 0 || optLongLegAtrMult ? optLongLegAtrMult : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseFloat(v);
                        setOptLongLegAtrMult(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, longLegAtrMultiplier: num });
                      }}
                      onBlur={() => {
                        if (!optLongLegAtrMult || isNaN(optLongLegAtrMult)) {
                          setOptLongLegAtrMult(10.0);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, longLegAtrMultiplier: 10.0 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-cyan-300 block mb-0.5" title="حداقل کندل لگ CD و EF">کندل لگ CD,EF:</label>
                    <input
                      type="number"
                      min={1}
                      value={optMinCandlesBlue === 0 || optMinCandlesBlue ? optMinCandlesBlue : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseInt(v, 10);
                        setOptMinCandlesBlue?.(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, minCandlesForBlueLeg: num });
                      }}
                      onBlur={() => {
                        if (!optMinCandlesBlue || isNaN(optMinCandlesBlue)) {
                          setOptMinCandlesBlue?.(3);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, minCandlesForBlueLeg: 3 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-cyan-500/40 rounded text-cyan-300 text-xs font-mono text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-blue-300 block mb-0.5" title="ضریب ATR لگ CD و EF">ضریب لگ CD,EF:</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.25}
                      value={optBlueLegAtrMult === 0 || optBlueLegAtrMult ? optBlueLegAtrMult : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseFloat(v);
                        setOptBlueLegAtrMult?.(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, blueLegAtrMultiplier: num });
                      }}
                      onBlur={() => {
                        if (!optBlueLegAtrMult || isNaN(optBlueLegAtrMult)) {
                          setOptBlueLegAtrMult?.(3.0);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, blueLegAtrMultiplier: 3.0 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-blue-500/40 rounded text-blue-300 text-xs font-mono text-center focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">سقف لگ آبی %:</label>
                    <input
                      type="number"
                      step={5}
                      value={optMaxBlueLegPercent === 0 || optMaxBlueLegPercent ? optMaxBlueLegPercent : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseFloat(v);
                        setOptMaxBlueLegPercent(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, maxBlueLegPercent: num });
                      }}
                      onBlur={() => {
                        if (!optMaxBlueLegPercent || isNaN(optMaxBlueLegPercent)) {
                          setOptMaxBlueLegPercent(60);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, maxBlueLegPercent: 60 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">نفوذ شکست ATR:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={optMaxBreakoutAtr === 0 || optMaxBreakoutAtr ? optMaxBreakoutAtr : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? ('' as any) : parseFloat(v);
                        setOptMaxBreakoutAtr(num);
                        if (typeof num === 'number' && !isNaN(num)) onUpdateZigZagSettings?.({ ...zigzagSettings, maxBreakoutAtrMultiplier: num });
                      }}
                      onBlur={() => {
                        if (!optMaxBreakoutAtr || isNaN(optMaxBreakoutAtr)) {
                          setOptMaxBreakoutAtr(5.0);
                          onUpdateZigZagSettings?.({ ...zigzagSettings, maxBreakoutAtrMultiplier: 5.0 });
                        }
                      }}
                      className="w-full px-1.5 py-1 bg-[#171d28] border border-[#2a364a] rounded text-white text-xs font-mono text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                {/* نوار وضعیت هوشمند تطابق بازه زمانی و نمادها */}
                {rangeStatus?.exists ? (() => {
                  const cov = rangeStatus?.coverage;
                  const missingCount = cov?.missingSymbolsCount || 0;
                  const surplusCount = cov?.surplusSymbolsCount || 0;
                  const availableCount = cov?.availableSymbolsCount || rangeStatus.dataset?.symbolCount || cachedCount || 0;
                  const reqCount = cov?.requestedSymbolsCount || selectedAllowedSymbols.length || 0;
                  const coveragePct = cov?.symbolCoveragePct !== undefined ? cov.symbolCoveragePct : (reqCount > 0 ? Math.round((availableCount / reqCount) * 100) : 100);

                  return (
                    <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-[#0c131d] border border-[#1f2d40] rounded-xl text-xs w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400 text-[11px]">وضعیت تطابق ({selectedExchange.toUpperCase()} - {timeRangeLabel || `${cov?.reqDays || 90} روز`}):</span>
                        {cov?.isTimeFullyCovered ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            پوشش ۱۰۰٪ زمان ({cov?.dbDays || 90} روز در دیتابیس)
                          </span>
                        ) : cov?.missingEarlierDays > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold font-mono flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            {cov.missingEarlierDays} روز کسری تاریخچه
                          </span>
                        ) : cov?.missingNewerDays > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold font-mono flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            {cov.missingNewerDays} روز نیاز به کندل جدیدتر
                          </span>
                        ) : null}

                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold font-mono">
                          پوشش نمادها: {availableCount} از {reqCount} ({coveragePct}٪)
                        </span>

                        {missingCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                            ⚠️ {missingCount} ارز کسری
                          </span>
                        )}

                        {surplusCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold font-mono" title="نمادهای مازاد دیتابیس در اسکن لحاظ نمی‌شوند">
                            🛡️ {surplusCount} مازاد مستثنی
                          </span>
                        )}
                      </div>

                      {onOpenRescanChoiceModal && (
                        <button
                          type="button"
                          onClick={onOpenRescanChoiceModal}
                          className="px-2.5 py-1 rounded-lg bg-[#162130] hover:bg-[#1f2e44] text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          title="مشاهده جزئیات تحلیل هوشمند دیتابیس و گزینه‌های دانلود"
                        >
                          <Sliders className="w-3 h-3 text-amber-400" />
                          <span>تحلیل هوشمند و گزینه‌های اسکن</span>
                        </button>
                      )}
                    </div>
                  );
                })() : isCheckingRange ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#121824] border border-[#233044] rounded-xl text-xs w-full">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-gray-300 text-xs font-medium">در حال تطابق هوشمند بازه زمانی و نمادها با دیتابیس PostgreSQL...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0f141f] border border-[#232d3f] rounded-xl text-xs text-gray-300 w-full">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>
                        هنوز دیتایی برای صرافی <strong className="text-amber-300">{selectedExchange.toUpperCase()}</strong> در تایم‌فریم <strong className="text-cyan-300">{timeframe}</strong> در دیتابیس موجود نیست. با اولین اسکن، کندل‌ها به صورت خودکار در PostgreSQL ذخیره خواهند شد.
                      </span>
                    </div>
                  </div>
                )}

                {!isScanning ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (rangeStatus?.exists) {
                          if (onOpenRescanChoiceModal) {
                            onOpenRescanChoiceModal();
                          } else {
                            handleStartScan(undefined);
                          }
                        } else {
                          handleStartScan(true, undefined, 'full');
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {selectedAllowedSymbols.length > 0
                          ? `شروع اسکن بکتست (${selectedAllowedSymbols.length} ارز مجاز انتخابی)`
                          : 'شروع اسکن بکتست'}
                      </span>
                    </button>

                    {/* بج دیتابیس PostgreSQL دقیقاً مطابق با اسکرین‌شات کاربر (با کلیک، مودال تحلیل هوشمند و انتخاب شیوه اسکن باز می‌شود) */}
                    {(rangeStatus?.exists || cachedCount > 0) && (
                      <button
                        type="button"
                        onClick={onOpenRescanChoiceModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0a1816]/95 hover:bg-[#0f2824] border border-emerald-500/60 hover:border-emerald-400 text-emerald-300 transition-all cursor-pointer shadow-sm text-xs font-mono font-medium hover:scale-[1.02] active:scale-[0.98]"
                        title="مشاهده تحلیل هوشمند و انتخاب شیوه اسکن با دیتابیس PostgreSQL"
                      >
                        <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-sans font-bold text-emerald-300">دیتابیس PostgreSQL :</span>
                        <span className="font-bold text-white font-mono">
                          {rangeStatus?.dataset?.symbolCount || cachedCount} نماد
                        </span>
                        <span className="text-emerald-300 font-mono">
                          ({(rangeStatus?.dataset?.totalCandles || 0).toLocaleString()} کندل{rangeStatus?.dataset?.dataSizeFormatted ? ` ${rangeStatus.dataset.dataSizeFormatted}` : ''})
                        </span>
                      </button>
                    )}

                    {/* دکمه دانلود تکمیلی کسری‌ها در صورتی که کسری وجود داشته باشد */}
                    {rangeStatus?.exists && (rangeStatus.coverage?.missingSymbolsCount > 0 || (rangeStatus.coverage?.missingEarlierDays && rangeStatus.coverage.missingEarlierDays > 0)) && (
                      <button
                        type="button"
                        onClick={handleStartIncrementalScan || (() => handleStartScan(false, undefined))}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                        title="فقط نمادها یا روزهای کسری از صرافی دانلود و به دیتابیس اضافه می‌شوند"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          🔄 دانلود تکمیلی ({rangeStatus.coverage.missingSymbolsCount} ارز کسری)
                        </span>
                      </button>
                    )}

                    {(cachedCount > 0 || rangeStatus?.exists || results.length > 0) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleRerunOnCachedData}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                          title="اجرای مجدد بک‌تست بدون هیچ دانلودی با استفاده از داده‌های موجود در PostgreSQL"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>⚡ اجرای سریع با داده‌های دیتابیس ({rangeStatus?.coverage?.availableSymbolsCount || rangeStatus?.dataset?.symbolCount || cachedCount || results.length || 0} ارز)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCandleCache}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                          title="پاک کردن داده‌های بازه زمانی فعلی از دیتابیس PostgreSQL"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {handleClearAllCandlesDatabase && (
                      <button
                        type="button"
                        onClick={handleClearAllCandlesDatabase}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                        title="پاکسازی کامل تمام دیتای کندل‌های ذخیره‌شده در تمام تایم‌فریم‌ها و صرافی‌ها از دیتابیس PostgreSQL"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>پاکسازی کل دیتای کندل‌های دیتابیس</span>
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
                          <option value={8}>۸ ورکر (پایه)</option>
                          <option value={12}>۱۲ ورکر (متوسط)</option>
                          <option value={16}>۱۶ ورکر (سریع)</option>
                          <option value={20}>۲۰ ورکر (توربو - حداکثر توان)</option>
                          <option value={24}>۲۴ ورکر (فوق سریع)</option>
                          <option value={30}>۳۰ ورکر (اولترا - پردازش چند هسته‌ای)</option>
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

                  {(results.length > 0 || cachedCount > 0) && (
                    <>
                      {results.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleExportScannerCSV}
                            className="px-3 py-1.5 rounded-lg bg-[#1a2130] hover:bg-[#253046] text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="دانلود خلاصه آماری اسکن جفت‌ارزها به صورت فایل CSV اکسل"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>خروجی اکسل (CSV)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportTradeLedgerCSV}
                            className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="دانلود ژورنال کامل و تفصیلی حسابداری تک‌تک معاملات به صورت فایل CSV قابل ممیزی"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>ژورنال تفصیلی معاملات (Ledger CSV)</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={handleClearResults}
                        className="p-1.5 rounded-lg bg-[#1a2130] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2b3548] cursor-pointer"
                        title={cachedCount > 0 ? "پاک کردن نتایج اسکن و حافظه کش کندل‌ها" : "پاک کردن نتایج اسکن"}
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
                    <span className="text-[10px] text-gray-400 block mb-0.5">
                      {isPortfolioFilterActive ? 'سود خالص (سبد تک‌پوزیشن)' : 'مجموع سود خالص (بازدهی)'}
                    </span>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className={`text-base font-extrabold font-mono ${totalNetProfitSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalNetProfitSum >= 0 ? '+' : ''}
                        {totalNetProfitSum.toLocaleString()} <span className="text-[10px]">USDT</span>
                      </span>
                      <span className={`text-[10px] font-bold font-mono ${portfolioReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ({portfolioReturnPercent >= 0 ? '+' : ''}{portfolioReturnPercent}٪)
                      </span>
                    </div>
                    {isPortfolioFilterActive && (
                      <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
                        سود کل سیگنال‌ها: {rawTotalNetProfitSum >= 0 ? '+' : ''}{rawTotalNetProfitSum.toLocaleString()}
                      </span>
                    )}
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
                      {isPortfolioFilterActive ? `وین‌ریت سبد تک‌پوزیشن (${totalWinTradesSum}/${totalTradesSum})` : `وین‌ریت کل استراتژی (${totalWinTradesSum}/${totalTradesSum})`}
                    </span>
                    <span className="text-base font-extrabold text-sky-400 font-mono">{portfolioWinRate}%</span>
                    {isPortfolioFilterActive && (
                      <span className="text-[9px] text-gray-400 font-mono block mt-0.5" title="مجموع تمام سیگنال‌های تولیدشده بازار قبل از فیلتر تک‌پوزیشن">
                        کل سیگنال‌ها: {rawTotalWinTradesSum}/{rawTotalTradesSum} ({rawMarketWinRate}%)
                      </span>
                    )}
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
                        {portfolioOptimalRisk > 0 ? (
                          riskMode === 'fixed'
                            ? `${portfolioOptimalFixedRisk}$ (${portfolioOptimalRisk}%)`
                            : `${portfolioOptimalRisk}%`
                        ) : '—'}
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

            {/* مودال جزئیات ارزهای رد شده توسط صرافی */}
            {isSkippedModalOpen && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#101622] border border-[#233147] rounded-2xl p-5 max-w-xl w-full shadow-2xl text-right animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#233147] mb-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <h3 className="font-extrabold text-sm sm:text-base text-white">
                        ارزهای رد شده به دلیل عدم ارائه دیتا در صرافی {selectedExchange.toUpperCase()} ({skippedSymbols.length} نماد)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSkippedModalOpen(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2333] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-[#141b27] p-3 rounded-xl border border-[#243247] text-xs text-gray-300 leading-relaxed mb-3">
                    <p>
                      سرور فیوچرز صرافی <span className="text-amber-300 font-bold">{selectedExchange.toUpperCase()}</span> برای جفت‌ارزهای زیر دیتای کندل ارائه نمی‌دهد (معاملات فیوچرز آنها متوقف است یا جفت‌ارزهای فارکس/کامودیتی مانند EUR و GBP و SP500 هستند). سیستم این نمادها را فیلتر کرده تا اسکن بک‌تست با دیتای واقعی و بدون کندل‌های خالی یا خطای صرافی انجام شود.
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-[#1b2536] rounded-xl p-2 bg-[#0c1017]">
                    {skippedSymbols.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#131924] border border-[#1e283a] text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-[10px] text-gray-500 font-mono text-center">{idx + 1}</span>
                          <span className="font-mono font-bold text-amber-300">{item.symbol.toUpperCase()}</span>
                        </div>
                        <span className="text-[11px] text-gray-400">{item.reason}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#233147] mt-3">
                    {onRemoveSkippedSymbols && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveSkippedSymbols(skippedSymbols.map((s) => s.symbol));
                          setIsSkippedModalOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>حذف تمام {skippedSymbols.length} نماد از لیست مجاز من</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsSkippedModalOpen(false)}
                      className="px-4 py-1.5 rounded-xl bg-[#1c2538] hover:bg-[#25324c] text-white text-xs font-bold cursor-pointer transition-all mr-auto"
                    >
                      بستن
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
};

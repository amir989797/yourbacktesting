import React from 'react';
import {
  Compass,
  Download,
  Upload,
  RotateCcw,
  Sliders,
  Sparkles,
  Lock,
  Unlock,
  Percent,
  Play,
  Square,
  Trophy,
  CheckCircle2,
  TrendingUp,
  Activity,
  ShieldAlert,
  Clock,
  Award,
  Zap,
} from 'lucide-react';
import { AdaptiveRanges, OptimizationTrial, OptSortCol } from './types';

export interface OptimizerTabProps {
  selectedStrategyId: 'strategy_1_e_breakout' | 'strategy_2_next_pivot';
  setSelectedStrategyId: (val: 'strategy_1_e_breakout' | 'strategy_2_next_pivot') => void;
  isOptimizing: boolean;
  timeframe: string;
  riskMode: 'percent' | 'fixed';
  riskAmountFixed: number;
  effectiveRiskPercent: number;
  effectiveRiskUsdt: number;
  riskPercent: number;
  capital: number;
  handleExportJSON: () => void;
  handleImportJSONClick: () => void;
  handleResetOptimizer: () => void;
  totalEvaluatedCount: number;
  handleAutoCalibrateRanges: () => void;
  autoAdaptiveEnabled: boolean;
  setAutoAdaptiveEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  adaptiveRanges: AdaptiveRanges;
  lockAtrPeriod: boolean;
  setLockAtrPeriod: (val: boolean) => void;
  lockMinCandles: boolean;
  setLockMinCandles: (val: boolean) => void;
  lockMinCandlesLong: boolean;
  setLockMinCandlesLong: (val: boolean) => void;
  lockAtrMultiplier: boolean;
  setLockAtrMultiplier: (val: boolean) => void;
  lockLongLegAtrMult: boolean;
  setLockLongLegAtrMult: (val: boolean) => void;
  lockMaxBlueLegPercent: boolean;
  setLockMaxBlueLegPercent: (val: boolean) => void;
  lockMaxBreakoutAtr: boolean;
  setLockMaxBreakoutAtr: (val: boolean) => void;
  lockMaxRiskReward: boolean;
  setLockMaxRiskReward: (val: boolean) => void;
  handleUpdateParamRange: (key: keyof AdaptiveRanges, field: 'min' | 'max', val: number) => void;
  targetMaxDrawdown: number;
  setTargetMaxDrawdown: (val: number) => void;
  targetMinWinRate: number;
  setTargetMinWinRate: (val: number) => void;
  targetMinTrades: number;
  setTargetMinTrades: (val: number) => void;
  setRiskMode: (mode: 'percent' | 'fixed') => void;
  setRiskPercent: (val: number) => void;
  setRiskAmountFixed: (val: number) => void;
  cachedCount: number;
  handleStartAutoOptimization: () => Promise<void>;
  handleStopOptimization: () => void;
  sessionSecondsLeft: number;
  formatTimer: (sec: number) => string;
  bestWinningRow: OptimizationTrial | null;
  handleApplyBestToChart: () => void;
  sortedTop10: OptimizationTrial[];
  handleOptSort: (col: OptSortCol) => void;
  renderOptSortArrow: (col: OptSortCol) => React.ReactNode;
  top10Trials: OptimizationTrial[];
  noConcurrentPositions: boolean;
  handleToggleNoConcurrentPositions: (val: boolean) => void;
  optAtrPeriod: number;
  setOptAtrPeriod: (val: number) => void;
  optMinCandles: number;
  setOptMinCandles: (val: number) => void;
  optMinCandlesLong: number;
  setOptMinCandlesLong: (val: number) => void;
  optAtrMultiplier: number;
  setOptAtrMultiplier: (val: number) => void;
  optLongLegAtrMult: number;
  setOptLongLegAtrMult: (val: number) => void;
  optMaxBlueLegPercent: number;
  setOptMaxBlueLegPercent: (val: number) => void;
  optMaxBreakoutAtr: number;
  setOptMaxBreakoutAtr: (val: number) => void;
  optMaxRiskReward: number;
  setOptMaxRiskReward: (val: number) => void;
  lockTimeStopCandles?: boolean;
  setLockTimeStopCandles?: (val: boolean) => void;
  optTimeStopCandles?: number;
  setOptTimeStopCandles?: (val: number) => void;
  onSyncCandles?: () => void;
  onEvaluateCurrentManualConfig?: () => void;
}

export const OptimizerTab: React.FC<OptimizerTabProps> = ({
  selectedStrategyId,
  setSelectedStrategyId,
  isOptimizing,
  timeframe,
  riskMode,
  riskAmountFixed,
  effectiveRiskPercent,
  effectiveRiskUsdt,
  riskPercent,
  capital,
  handleExportJSON,
  handleImportJSONClick,
  handleResetOptimizer,
  totalEvaluatedCount,
  handleAutoCalibrateRanges,
  autoAdaptiveEnabled,
  setAutoAdaptiveEnabled,
  adaptiveRanges,
  lockAtrPeriod,
  setLockAtrPeriod,
  lockMinCandles,
  setLockMinCandles,
  lockMinCandlesLong,
  setLockMinCandlesLong,
  lockAtrMultiplier,
  setLockAtrMultiplier,
  lockLongLegAtrMult,
  setLockLongLegAtrMult,
  lockMaxBlueLegPercent,
  setLockMaxBlueLegPercent,
  lockMaxBreakoutAtr,
  setLockMaxBreakoutAtr,
  lockMaxRiskReward,
  setLockMaxRiskReward,
  handleUpdateParamRange,
  targetMaxDrawdown,
  setTargetMaxDrawdown,
  targetMinWinRate,
  setTargetMinWinRate,
  targetMinTrades,
  setTargetMinTrades,
  setRiskMode,
  setRiskPercent,
  setRiskAmountFixed,
  cachedCount,
  handleStartAutoOptimization,
  handleStopOptimization,
  sessionSecondsLeft,
  formatTimer,
  bestWinningRow,
  handleApplyBestToChart,
  sortedTop10,
  handleOptSort,
  renderOptSortArrow,
  top10Trials,
  noConcurrentPositions,
  handleToggleNoConcurrentPositions,
  optAtrPeriod,
  setOptAtrPeriod,
  optMinCandles,
  setOptMinCandles,
  optMinCandlesLong,
  setOptMinCandlesLong,
  optAtrMultiplier,
  setOptAtrMultiplier,
  optLongLegAtrMult,
  setOptLongLegAtrMult,
  optMaxBlueLegPercent,
  setOptMaxBlueLegPercent,
  optMaxBreakoutAtr,
  setOptMaxBreakoutAtr,
  optMaxRiskReward,
  setOptMaxRiskReward,
  lockTimeStopCandles = false,
  setLockTimeStopCandles,
  optTimeStopCandles = 80,
  setOptTimeStopCandles,
  onSyncCandles,
  onEvaluateCurrentManualConfig,
}) => {
  return (
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
                    تایم‌فریم تست: <strong className="text-white font-mono">{timeframe}</strong> | ریسک: <strong className="text-white font-mono">{riskMode === 'fixed' ? `${riskAmountFixed} USDT (${effectiveRiskPercent}%)` : `${riskPercent}% (${effectiveRiskUsdt.toLocaleString()} USDT)`}</strong> | سرمایه: <strong className="text-white font-mono">{capital.toLocaleString()} USDT</strong>
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

                {/* 9. Time-Stop (خروج زمانی) - رنج با گام ۱۰ تا ۱۰ تا */}
                <div className="bg-[#0e121a] p-2.5 rounded-xl border border-cyan-500/40 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-300">۹. خروج زمانی (Time-Stop)</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      همگرایی {adaptiveRanges.timeStopCandles?.convergence ?? 50}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <span>حداقل:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.timeStopCandles?.step ?? 10}
                        min={10}
                        max={300}
                        value={adaptiveRanges.timeStopCandles?.min ?? 20}
                        disabled={isOptimizing || lockTimeStopCandles}
                        onChange={(e) => handleUpdateParamRange('timeStopCandles', 'min', parseFloat(e.target.value) || 10)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>حداکثر:</span>
                      <input
                        type="number"
                        step={adaptiveRanges.timeStopCandles?.step ?? 10}
                        min={10}
                        max={300}
                        value={adaptiveRanges.timeStopCandles?.max ?? 120}
                        disabled={isOptimizing || lockTimeStopCandles}
                        onChange={(e) => handleUpdateParamRange('timeStopCandles', 'max', parseFloat(e.target.value) || 120)}
                        className="w-16 px-1 py-0.5 bg-[#141a24] border border-[#263346] rounded text-cyan-300 font-mono text-xs text-center focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-[#1a2230]">
                    <span>بهترین مقدار: <strong className="text-amber-300 font-mono">{adaptiveRanges.timeStopCandles?.bestVal ?? 80} کندل</strong></span>
                    <span className="text-cyan-400 font-mono font-bold">گام: ۱۰ کندل</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ۳. شروط اولیه ارزیابی و تنظیمات قفل پارامترها */}
            <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#242e40] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
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

                <div className="bg-[#0e121a] p-2 rounded-xl border border-[#222d3e]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-300 font-semibold">
                      {riskMode === 'percent' ? 'ریسک درصدی:' : 'ریسک ثابت:'}
                    </label>
                    <div className="flex items-center bg-[#141b27] rounded-md p-0.5 border border-[#2d3a4e]">
                      <button
                        type="button"
                        onClick={() => setRiskMode('percent')}
                        disabled={isOptimizing}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                          riskMode === 'percent'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="ریسک درصدی"
                      >
                        % درصد
                      </button>
                      <button
                        type="button"
                        onClick={() => setRiskMode('fixed')}
                        disabled={isOptimizing}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                          riskMode === 'fixed'
                            ? 'bg-amber-400 text-black shadow-xs'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="ریسک ثابت دلاری/تتر"
                      >
                        $ ثابت
                      </button>
                    </div>
                  </div>
                  {riskMode === 'percent' ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step={0.1}
                        min={0.1}
                        max={50}
                        value={riskPercent}
                        disabled={isOptimizing}
                        onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 1)}
                        className="w-full px-2 py-1 bg-[#161c28] border border-[#2d384c] rounded-lg text-rose-400 font-mono font-bold text-xs text-center focus:outline-none"
                        title="درصد ریسک در هر معامله"
                      />
                      <span className="text-xs font-bold text-gray-400">%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step={1}
                        min={0.5}
                        max={100000}
                        value={riskAmountFixed}
                        disabled={isOptimizing}
                        onChange={(e) => setRiskAmountFixed(parseFloat(e.target.value) || 10)}
                        className="w-full px-2 py-1 bg-[#161c28] border border-[#2d384c] rounded-lg text-amber-300 font-mono font-bold text-xs text-center focus:outline-none"
                        title="مبلغ ریسک ثابت هر معامله (USDT)"
                      />
                      <span className="text-xs font-bold text-gray-400">USDT</span>
                    </div>
                  )}
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

                {/* ۹. قفل/تنظیم دستی Time-Stop */}
                <div className={`p-2 rounded-xl border ${lockTimeStopCandles ? 'bg-[#0e1117] border-gray-700/60 opacity-60' : 'bg-[#171e2b] border-cyan-500/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-cyan-300">۹. خروج زمانی (کندل)</label>
                    <label className="flex items-center gap-1 text-[10px] text-cyan-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockTimeStopCandles}
                        onChange={(e) => setLockTimeStopCandles?.(e.target.checked)}
                        className="rounded bg-[#0d1017] border-gray-600 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                      <span>{lockTimeStopCandles ? 'قفل' : 'آزاد'}</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step={10}
                    value={optTimeStopCandles}
                    disabled={lockTimeStopCandles}
                    onChange={(e) => setOptTimeStopCandles?.(parseInt(e.target.value, 10) || 80)}
                    className="w-full px-2 py-1 bg-[#0f131c] border border-[#2e3a4e] rounded-lg text-cyan-300 font-bold font-mono text-xs disabled:bg-[#1b202c] disabled:text-gray-500 text-center"
                    title="تعداد کندل ماندن در معامله قبل از خروج اجباری (با گام ۱۰ تا ۱۰ تا)"
                  />
                </div>
              </div>

              {/* کنترل اجرای سشن ۱۵ دقیقه‌ای */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#232c3d]">
                <div className="flex items-center gap-2 flex-wrap">
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

                  {onSyncCandles && (
                    <button
                      type="button"
                      onClick={onSyncCandles}
                      disabled={isOptimizing}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="بارگذاری و همگام‌سازی کندل‌های آخرین اسکن بکتست در حافظه بهینه‌ساز"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>همگام‌سازی کندل‌های بکتست ({cachedCount} جفت‌ارز)</span>
                    </button>
                  )}

                  {onEvaluateCurrentManualConfig && (
                    <button
                      type="button"
                      onClick={onEvaluateCurrentManualConfig}
                      disabled={isOptimizing}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="ارزیابی مستقیم پارامترهای دستی فعلی در بهینه‌ساز جهت مقایسه و تطابق ۱۰۰٪ آمار"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>تست فوری کانفیگ دستی جاری</span>
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
                    <div className="text-xs text-gray-300 mt-1 font-mono flex flex-wrap gap-2 items-center">
                      <span>سود خالص: <strong className="text-emerald-400">+{bestWinningRow.netProfit.toLocaleString()}</strong> USDT {capital > 0 ? <span className="text-[10px] text-emerald-300 font-bold">({bestWinningRow.netProfit >= 0 ? '+' : ''}{((bestWinningRow.netProfit / capital) * 100).toFixed(1)}% بازدهی)</span> : null}</span>
                      <span>•</span>
                      <span>کارمزد کل: <strong className="text-amber-400">-{((bestWinningRow.totalFees || 0)).toLocaleString()}</strong> USDT</span>
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
                  ATR:{bestWinningRow.atrPeriod} | MinC:{bestWinningRow.minCandles} | MinLong:{bestWinningRow.minCandlesForLongLeg} | Mult:{bestWinningRow.atrMultiplier}x | LongMult:{bestWinningRow.longLegAtrMultiplier}x | Blue%:{bestWinningRow.maxBlueLegPercent}% | Break:{bestWinningRow.maxBreakoutAtrMultiplier}x | R:R:{bestWinningRow.maxRiskReward} | TimeStop:{bestWinningRow.timeStopCandles || 80}c
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
                      <th className="py-2.5 px-2 text-center text-cyan-300">Time-Stop</th>
                      <th className="py-2.5 px-2.5 text-center cursor-pointer text-emerald-400 font-bold" onClick={() => handleOptSort('netProfit')}>
                        سود خالص (USDT) {renderOptSortArrow('netProfit')}
                      </th>
                      <th className="py-2.5 px-2 text-center text-amber-300 font-bold">
                        کارمزد کل
                      </th>
                      <th className="py-2.5 px-2 text-center text-cyan-300 font-bold">
                        بازدهی (%)
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
                        <td colSpan={18} className="py-8 text-center text-gray-500 font-sans">
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
                            <td className="py-2 px-2 text-center font-bold text-cyan-400">
                              {row.timeStopCandles ? `${row.timeStopCandles}c` : '80c'}
                            </td>
                            <td className={`py-2 px-2.5 text-center font-extrabold ${row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {row.netProfit >= 0 ? '+' : ''}{row.netProfit.toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-center text-amber-300 font-mono">
                              -{((row.totalFees || 0)).toLocaleString()}
                            </td>
                            <td className={`py-2 px-2 text-center font-bold ${row.netProfit >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                              {capital > 0 ? `${row.netProfit >= 0 ? '+' : ''}${((row.netProfit / capital) * 100).toFixed(1)}%` : '—'}
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
  );
};

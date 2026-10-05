import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Eye,
  EyeOff,
  Zap,
  Target,
  Sparkles,
  BarChart2,
  X,
  AlertTriangle,
  RotateCcw,
  Info,
} from 'lucide-react';
import { StrategyConfig, StrategyMetrics, StrategyTrade } from '../types/strategy';

interface StrategyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: StrategyConfig;
  onUpdateConfig: (newConfig: StrategyConfig) => void;
  trades: StrategyTrade[];
  metrics: StrategyMetrics;
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  trades,
  metrics,
}) => {
  const [activeTab, setActiveTab] = useState<'signals' | 'history'>('signals');
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [rulesTab, setRulesTab] = useState<'strategy1' | 'strategy2'>(
    config.selectedStrategyId === 'strategy_2_next_pivot' ? 'strategy2' : 'strategy1'
  );
  const [capitalInput, setCapitalInput] = useState<string>(String(config.capital));
  const [riskInput, setRiskInput] = useState<string>(String(config.riskPercent));
  const [entryCommissionInput, setEntryCommissionInput] = useState<string>(
    String(config.entryCommissionPercent ?? 0.06)
  );
  const [exitCommissionInput, setExitCommissionInput] = useState<string>(
    String(config.exitCommissionPercent ?? 0.06)
  );
  const [maxCandlesInput, setMaxCandlesInput] = useState<string>(String(config.maxCandlesToEnter));
  const [maxRRInput, setMaxRRInput] = useState<string>(String(config.maxRiskReward || 2));

  if (!isOpen) return null;

  const handleCapitalChange = (val: string) => {
    setCapitalInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onUpdateConfig({ ...config, capital: num });
    }
  };

  const handleRiskChange = (val: string) => {
    setRiskInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onUpdateConfig({ ...config, riskPercent: num });
    }
  };

  const handleEntryCommissionChange = (val: string) => {
    setEntryCommissionInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const exit = parseFloat(exitCommissionInput) || 0;
      onUpdateConfig({
        ...config,
        entryCommissionPercent: num,
        commissionPercent: parseFloat((num + exit).toFixed(4)),
      });
    }
  };

  const handleExitCommissionChange = (val: string) => {
    setExitCommissionInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const entry = parseFloat(entryCommissionInput) || 0;
      onUpdateConfig({
        ...config,
        exitCommissionPercent: num,
        commissionPercent: parseFloat((entry + num).toFixed(4)),
      });
    }
  };

  const handleMaxCandlesChange = (val: string) => {
    setMaxCandlesInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      onUpdateConfig({ ...config, maxCandlesToEnter: num });
    }
  };

  const handleMaxRRChange = (val: string) => {
    setMaxRRInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onUpdateConfig({ ...config, maxRiskReward: num });
    }
  };

  const activeTrades = trades.filter((t) => t.status === 'ACTIVE');
  const closedTrades = trades
    .filter((t) => t.status === 'WIN' || t.status === 'LOSS')
    .reverse();

  return (
    <aside
      className="w-full h-full bg-[#121620] flex flex-col shadow-2xl z-20 overflow-hidden select-none animate-in fade-in slide-in-from-right duration-200"
      dir="rtl"
    >
      {/* 1. Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#232b3a] bg-[#0e121a]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">استراتژی معاملاتی</h2>
            </div>
            <p className="text-[11px] text-gray-400">سیستم ترید الگوریتمی بر مبنای لگ‌های زیگ‌زاگ</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2635] transition-colors cursor-pointer"
          title="بستن پنل استراتژی"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Section A: Strategy Selector & Capital */}
        <div className="p-3.5 rounded-xl bg-[#171c27] border border-[#263143] space-y-3">
          {/* Strategy Dropdown */}
          <div>
            <label className="text-xs font-semibold text-gray-200 block mb-1.5">
              انتخاب استراتژی (Select Strategy):
            </label>
            <div className="relative">
              <select
                value={config.selectedStrategyId}
                onChange={(e) => onUpdateConfig({ ...config, selectedStrategyId: e.target.value })}
                className="w-full px-3 py-2 bg-[#0e121a] border border-[#2b364a] rounded-lg text-white text-xs font-medium focus:outline-none focus:border-amber-400 appearance-none cursor-pointer"
              >
                <option value="strategy_1_e_breakout">
                  استراتژی اول: شکست نقطه E (تارگت A / استاپ F)
                </option>
                <option value="strategy_2_next_pivot">
                  استراتژی دوم: ورود با تشکیل نقطه بعد از F (استاپ F / تارگت حداکثر R:R)
                </option>
                <option value="none">
                  -- غیرفعال کردن استراتژی --
                </option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Capital Input (Only Input) */}
          <div>
            <label className="text-xs font-semibold text-gray-200 block mb-1.5">
              سرمایه اولیه حساب (Capital USDT):
            </label>
            <div className="relative">
              <input
                type="number"
                min={10}
                step={100}
                value={capitalInput}
                onChange={(e) => handleCapitalChange(e.target.value)}
                className="w-full px-3 py-2 pl-12 bg-[#0e121a] border border-[#2b364a] rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400 transition-colors"
                placeholder="10000"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400 pointer-events-none">
                USDT
              </span>
            </div>
          </div>
        </div>

        {/* Placeholder if none selected */}
        {config.selectedStrategyId === 'none' && (
          <div className="p-4 text-center rounded-xl bg-[#141824] border border-[#232c3d] text-gray-400">
            <p className="text-xs">لطفاً یکی از استراتژی‌ها را از لیست بالا انتخاب کنید تا پارامترهای آن نمایش داده شود.</p>
          </div>
        )}

        {/* Section B: Strategy Parameters (3 Inputs Side by Side + Info Icon) */}
        {config.selectedStrategyId !== 'none' && (
          <div className="p-3 rounded-xl bg-[#171c27] border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#263143]">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">
                  {config.selectedStrategyId === 'strategy_2_next_pivot'
                    ? 'پارامترهای استراتژی ۲ (نقطه بعد از F)'
                    : 'پارامترهای استراتژی ۱ (شکست E)'}
                </span>
                {/* Info Icon for Strategy Explanation */}
                <button
                  type="button"
                  onClick={() => {
                    setRulesTab(config.selectedStrategyId === 'strategy_2_next_pivot' ? 'strategy2' : 'strategy1');
                    setShowRulesModal(true);
                  }}
                  className="p-1 rounded-full text-amber-400 hover:text-amber-200 hover:bg-amber-400/20 transition-all cursor-pointer"
                  title="مشاهده قوانین و توضیحات استراتژی"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...config, showOnChart: !config.showOnChart })}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  config.showOnChart
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#0e121a] text-gray-400 hover:text-white'
                }`}
                title="نمایش سیگنال‌ها روی نمودار"
              >
                {config.showOnChart ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>نمایش رو چارت</span>
              </button>
            </div>

            {/* Strategy Inputs Side-by-Side */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Risk % */}
              <div className="bg-[#0e121a] p-2 rounded-lg border border-[#252f42]">
                <div className="text-[10px] text-gray-300 font-semibold mb-1 flex items-center justify-between">
                  <span>ریسک (%)</span>
                  <span className="text-rose-400 font-mono font-bold">%</span>
                </div>
                <input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={riskInput}
                  onChange={(e) => handleRiskChange(e.target.value)}
                  className="w-full py-1 text-xs font-mono font-bold text-center text-rose-400 bg-[#161c28] border border-[#2b364a] rounded focus:outline-none focus:border-rose-400"
                  placeholder="1"
                />
              </div>

              {/* Max R:R */}
              <div className="bg-[#0e121a] p-2 rounded-lg border border-[#252f42]">
                <div className="text-[10px] text-gray-300 font-semibold mb-1 flex items-center justify-between">
                  <span>{config.selectedStrategyId === 'strategy_2_next_pivot' ? 'تارگت R:R' : 'حداکثر R:R'}</span>
                  <span className="text-emerald-400 font-mono font-bold">R</span>
                </div>
                <input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={maxRRInput}
                  onChange={(e) => handleMaxRRChange(e.target.value)}
                  className="w-full py-1 text-xs font-mono font-bold text-center text-emerald-400 bg-[#161c28] border border-[#2b364a] rounded focus:outline-none focus:border-emerald-400"
                  placeholder="2"
                />
              </div>

              {/* Entry Commission % */}
              <div className="bg-[#0e121a] p-2 rounded-lg border border-[#252f42]">
                <div className="text-[10px] text-amber-300 font-semibold mb-1 flex items-center justify-between">
                  <span>کارمزد ورود (%)</span>
                  <span className="text-amber-400 font-mono font-bold">%</span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.01}
                  value={entryCommissionInput}
                  onChange={(e) => handleEntryCommissionChange(e.target.value)}
                  className="w-full py-1 text-xs font-mono font-bold text-center text-amber-400 bg-[#161c28] border border-[#2b364a] rounded focus:outline-none focus:border-amber-400"
                  placeholder="0.06"
                  title="کارمزد ورود به پوزیشن (پیش‌فرض ۰.۰۶٪)"
                />
              </div>

              {/* Exit Commission % */}
              <div className="bg-[#0e121a] p-2 rounded-lg border border-[#252f42]">
                <div className="text-[10px] text-amber-300 font-semibold mb-1 flex items-center justify-between">
                  <span>کارمزد خروج (%)</span>
                  <span className="text-amber-400 font-mono font-bold">%</span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.01}
                  value={exitCommissionInput}
                  onChange={(e) => handleExitCommissionChange(e.target.value)}
                  className="w-full py-1 text-xs font-mono font-bold text-center text-amber-400 bg-[#161c28] border border-[#2b364a] rounded focus:outline-none focus:border-amber-400"
                  placeholder="0.06"
                  title="کارمزد خروج از پوزیشن (پیش‌فرض ۰.۰۶٪)"
                />
              </div>

              {/* Max Candles / Entry Mode */}
              {config.selectedStrategyId === 'strategy_2_next_pivot' ? (
                <div className="bg-[#0e121a] p-2 rounded-lg border border-[#252f42] flex flex-col justify-between">
                  <div className="text-[10px] text-gray-300 font-semibold mb-1 flex items-center justify-between">
                    <span>ورود به معامله</span>
                    <span className="text-amber-400 font-mono text-[9px]">فوری</span>
                  </div>
                  <div className="py-1 text-[11px] font-bold text-center text-amber-300 bg-[#161c28] border border-amber-500/20 rounded">
                    تک‌ورود بعد از F
                  </div>
                </div>
              ) : (
                <div className="bg-[#0e121a] p-2 rounded-lg border border-[#252f42]">
                  <div className="text-[10px] text-gray-300 font-semibold mb-1 flex items-center justify-between">
                    <span>مهلت ورود</span>
                    <span className="text-sky-400 font-mono text-[9px]">کندل</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={5}
                    value={maxCandlesInput}
                    onChange={(e) => handleMaxCandlesChange(e.target.value)}
                    className="w-full py-1 text-xs font-mono font-bold text-center text-sky-400 bg-[#161c28] border border-[#2b364a] rounded focus:outline-none focus:border-sky-400"
                    placeholder="100"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section C: Backtest / Performance Dashboard */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              آمار و نتایج بکتست لحظه‌ای
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              {metrics.totalTrades} معامله ثبت شده
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Net PnL Card */}
            <div className="p-3 rounded-xl bg-[#171c27] border border-[#263143]">
              <div className="text-[10px] text-gray-400 mb-0.5">سود/زیان خالص (Net PnL)</div>
              <div
                className={`text-base font-bold font-mono ${
                  metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {metrics.netProfit >= 0 ? '+' : ''}${metrics.netProfit.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-gray-400">
                {metrics.netProfitPercent >= 0 ? '+' : ''}{metrics.netProfitPercent}%
              </div>
            </div>

            {/* Total Fee Card */}
            <div className="p-3 rounded-xl bg-[#171c27] border border-amber-500/30">
              <div className="text-[10px] text-amber-300 mb-0.5 flex items-center justify-between">
                <span>کارمزد کل ({config.commissionPercent ?? 0.12}%)</span>
                <span className="text-[9px] text-gray-400">ورود: {config.entryCommissionPercent ?? 0.06}% | خروج: {config.exitCommissionPercent ?? 0.06}%</span>
              </div>
              <div className="text-base font-bold font-mono text-amber-400">
                -${(metrics.totalFee || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400">
                سود ناخالص: ${(metrics.totalProfit - metrics.totalLoss).toLocaleString()}
              </div>
            </div>

            {/* Win Rate Card */}
            <div className="p-3 rounded-xl bg-[#171c27] border border-[#263143]">
              <div className="text-[10px] text-gray-400 mb-0.5">نرخ برد (Win Rate)</div>
              <div className="text-base font-bold font-mono text-amber-400">
                {metrics.winRate}%
              </div>
              <div className="w-full bg-[#202736] h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, metrics.winRate))}%` }}
                />
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="p-3 rounded-xl bg-[#171c27] border border-[#263143]">
              <div className="text-[10px] text-gray-400 mb-0.5">حداکثر افت (Max DD)</div>
              <div className="text-base font-bold font-mono text-rose-400">
                {metrics.maxDrawdownPercent}%
              </div>
              <div className="text-[10px] text-gray-400">
                افت دلاری: -${metrics.maxDrawdown.toLocaleString()}
              </div>
            </div>

            {/* Total Equity */}
            <div className="p-3 rounded-xl bg-[#171c27] border border-[#263143]">
              <div className="text-[10px] text-gray-400 mb-0.5">سرمایه نهایی (Equity)</div>
              <div className="text-sm font-bold font-mono text-white">
                ${metrics.finalEquity.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400">
                برد: {metrics.winTrades} | باخت: {metrics.lossTrades}
              </div>
            </div>

            {/* Profit Factor & R:R */}
            <div className="p-3 rounded-xl bg-[#171c27] border border-[#263143]">
              <div className="text-[10px] text-gray-400 mb-0.5">Profit Factor & R:R</div>
              <div className="text-sm font-bold font-mono text-sky-400">
                PF: {metrics.profitFactor}
              </div>
              <div className="text-[10px] text-gray-400">
                میانگین R:R: {metrics.avgRiskReward}:1
              </div>
            </div>
          </div>
        </div>

        {/* Section D: Tabs (Active/Pending Signals vs History) */}
        <div>
          <div className="flex border-b border-[#232b3a] mb-3">
            <button
              onClick={() => setActiveTab('signals')}
              className={`flex-1 pb-2 text-xs font-bold transition-colors relative cursor-pointer ${
                activeTab === 'signals' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>معاملات باز و فعال</span>
              {activeTrades.length > 0 && (
                <span className="mr-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-400 text-black font-mono font-bold">
                  {activeTrades.length}
                </span>
              )}
              {activeTab === 'signals' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 pb-2 text-xs font-bold transition-colors relative cursor-pointer ${
                activeTab === 'history' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>تاریخچه معاملات ({closedTrades.length})</span>
              {activeTab === 'history' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}
            </button>
          </div>

          {/* Tab 1: Active Trades */}
          {activeTab === 'signals' && (
            <div className="space-y-2.5">
              {activeTrades.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-[#141824] border border-[#232c3d] text-gray-400">
                  <Clock className="w-7 h-7 mx-auto mb-2 text-gray-500 opacity-60" />
                  <p className="text-xs font-medium text-gray-300">در حال حاضر معامله باز و فعالی وجود ندارد</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    به محض شکست نقطه E پس از تشکیل لگ بعدی، نشانه‌ها روی چارت ظاهر شده و معامله باز می‌شود.
                  </p>
                </div>
              ) : (
                activeTrades.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border bg-[#121c22] border-sky-500/40 shadow-lg shadow-sky-500/5 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                            t.direction === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {t.direction === 'BUY' ? 'LONG (BUY)' : 'SHORT (SELL)'}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-300">
                          چرخه #{t.cycleIndex}
                        </span>
                        {t.attemptNumber && t.attemptNumber > 1 && (
                          <span className="px-1.5 py-0.2 text-[9px] font-medium bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                            ورود مجدد #{t.attemptNumber}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 bg-sky-400/20 text-sky-400 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        معامله باز (Active)
                      </span>
                    </div>

                    {/* Price targets & levels */}
                    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono bg-[#0c0f17] p-2 rounded-lg border border-[#202738] mb-2">
                      <div>
                        <div className="text-[9px] text-gray-400 font-sans">ورود (نقطه E)</div>
                        <div className="font-bold text-amber-300">${t.entryPrice.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-400 font-sans">استاپ (نقطه F)</div>
                        <div className="font-bold text-rose-400">${t.stopLoss.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-400 font-sans">تارگت (نقطه A)</div>
                        <div className="font-bold text-emerald-400">${t.takeProfit.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                      <span>R:R: <strong className="text-white font-mono">{t.riskReward}:1</strong></span>
                      <span
                        className={`font-mono font-bold ${
                          t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        سود جاری: {t.pnl >= 0 ? '+' : ''}${t.pnl} ({t.pnlPercent}%)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Trade History */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {closedTrades.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-[#141824] border border-[#232c3d] text-gray-400">
                  <p className="text-xs">هیچ معامله بسته‌شده‌ای در این بازه تاریخی ثبت نشده است.</p>
                </div>
              ) : (
                closedTrades.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg bg-[#151a25] border border-[#242e40] hover:border-[#384660] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded ${
                            t.direction === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {t.direction}
                        </span>
                        <span className="text-[11px] font-medium text-gray-300">
                          چرخه #{t.cycleIndex}
                        </span>
                        {t.attemptNumber && t.attemptNumber > 1 && (
                          <span className="px-1.5 py-0.2 text-[9px] font-medium bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                            ورود مجدد #{t.attemptNumber}
                          </span>
                        )}
                      </div>

                      {t.status === 'WIN' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> برد (WIN)
                        </span>
                      )}
                      {t.status === 'LOSS' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> استاپ (LOSS)
                        </span>
                      )}
                      {t.status === 'EXPIRED' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-700/30 text-gray-400">
                          منقضی (Expired)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-gray-400">
                        ورود: ${t.entryPrice.toLocaleString()} {t.exitPrice ? `| خروج: $${t.exitPrice.toLocaleString()}` : ''}
                      </span>
                      <span
                        className={`font-bold ${
                          t.pnl > 0
                            ? 'text-emerald-400'
                            : t.pnl < 0
                            ? 'text-rose-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()} ({t.pnlPercent}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                      <span>
                        R:R: {t.riskReward}:1 {t.fee !== undefined ? `| کارمزد: -$${t.fee} (ورود: $${t.entryFee ?? 0} | خروج: $${t.exitFee ?? 0})` : ''}
                      </span>
                      <span>ورود پس از {t.candlesElapsedToEntry} کندل</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Strategy Rules & Instructions Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-[#131722] border border-[#2b3548] rounded-2xl shadow-2xl p-4 text-xs space-y-3 max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#242e40]">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Info className="w-4 h-4 text-amber-400" />
                <span>قوانین استراتژی‌های معاملاتی</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2635] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Strategy Tab Switcher in Modal */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0b0e14] rounded-xl border border-[#222a38]">
              <button
                type="button"
                onClick={() => setRulesTab('strategy1')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer text-center ${
                  rulesTab === 'strategy1'
                    ? 'bg-amber-400 text-black shadow-xs'
                    : 'text-gray-400 hover:text-white hover:bg-[#19202c]'
                }`}
              >
                استراتژی ۱ (شکست E)
              </button>
              <button
                type="button"
                onClick={() => setRulesTab('strategy2')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer text-center ${
                  rulesTab === 'strategy2'
                    ? 'bg-amber-400 text-black shadow-xs'
                    : 'text-gray-400 hover:text-white hover:bg-[#19202c]'
                }`}
              >
                استراتژی ۲ (نقطه بعد از F)
              </button>
            </div>

            {/* Strategy 1 Rules Content */}
            {rulesTab === 'strategy1' && (
              <div className="space-y-2 text-gray-300 text-[11px] leading-relaxed">
                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-amber-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۱. پیش‌شرط ورود:</strong> لگ بعد از نقطه آبی <strong>F</strong> حتماً باید تشکیل و تایید شده باشد.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-sky-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۲. نقطه ورود و تعیین جهت:</strong> با شکست نقطه <strong>E</strong>:
                    <div className="mt-1 text-gray-400 space-y-0.5">
                      <div>- اگر <strong>E &gt; F</strong> باشد: ورود به پوزیشن <span className="text-emerald-400 font-bold">خرید (BUY / LONG)</span>.</div>
                      <div>- اگر <strong>E &le; F</strong> باشد: ورود به پوزیشن <span className="text-rose-400 font-bold">فروش (SELL / SHORT)</span>.</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-rose-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۳. حد ضرر (Stop Loss):</strong> دقیقاً در قیمت نقطه <strong>F</strong> قرار می‌گیرد.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-emerald-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۴. حد سود (Target):</strong> در قیمت نقطه <strong>A</strong> سازنده همان چرخه، محدود به سقف حداکثر R:R (پیش‌فرض {config.maxRiskReward || 5}:1).
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#1b1527] p-2.5 rounded-xl border border-purple-500/30">
                  <span className="text-purple-300 font-bold">•</span>
                  <div>
                    <strong className="text-purple-200">۵. ورود مجدد پس از استاپ:</strong> اگر معامله اول استاپ بخورد، <strong>فقط ۱ بار دیگر</strong> می‌تواند با شکست مجدد نقطه E وارد شود؛ مهلت ورود (تعداد کندل) از زمان استاپ تا شکست جدید محاسبه می‌شود.
                  </div>
                </div>
              </div>
            )}

            {/* Strategy 2 Rules Content */}
            {rulesTab === 'strategy2' && (
              <div className="space-y-2 text-gray-300 text-[11px] leading-relaxed">
                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-amber-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۱. پیش‌شرط چرخه:</strong> تشکیل کامل چرخه و شکل‌گیری نقطه آبی <strong>F</strong> (انتهای لگ آبی پررنگ).
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-sky-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۲. زمان و نقطه ورود (اولین لحظه تشکیل):</strong> پس از نقطه <strong>F</strong>، شمع‌به‌شمع رو به جلو بررسی می‌شود؛ به محض اینکه شرط تشکیل لگ بعدی (حداقل فاصله زمانی و نوسان حداقل ۳ برابر ATR از F) <strong>برای اولین بار</strong> برقرار شد، <strong>بلافاصله وارد معامله می‌شویم</strong> (منتظر جابجایی‌ها و تثبیت انتهای لگ نمی‌مانیم).
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-amber-300 font-bold">•</span>
                  <div>
                    <strong className="text-white">۳. تعیین جهت معامله:</strong>
                    <div className="mt-1 text-gray-400 space-y-0.5">
                      <div>- اگر نقطه بعدی بالاتر از F باشد: پوزیشن <span className="text-emerald-400 font-bold">خرید (BUY)</span>.</div>
                      <div>- اگر نقطه بعدی پایین‌تر از F باشد: پوزیشن <span className="text-rose-400 font-bold">فروش (SELL)</span>.</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-rose-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۴. حد ضرر (Stop Loss):</strong> دقیقاً در قیمت نقطه <strong>F</strong> قرار می‌گیرد.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0e121a] p-2.5 rounded-xl border border-[#202738]">
                  <span className="text-emerald-400 font-bold">•</span>
                  <div>
                    <strong className="text-white">۵. حد سود (Target):</strong> برابر با <strong>حداکثر R:R</strong> تنظیم‌شده در پارامترها (پیش‌فرض {config.maxRiskReward || 5}:1).
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#1b1527] p-2.5 rounded-xl border border-purple-500/30">
                  <span className="text-purple-300 font-bold">•</span>
                  <div>
                    <strong className="text-purple-200">۶. محدودیت ورود:</strong> برای هر نقطه <strong>F فقط یک‌بار</strong> وارد می‌شویم (هیچ ورود مجددی پس از استاپ وجود ندارد).
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs rounded-xl transition-colors cursor-pointer mt-1"
            >
              متوجه شدم و بستن
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

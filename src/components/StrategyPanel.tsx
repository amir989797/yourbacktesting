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
  const [capitalInput, setCapitalInput] = useState<string>(String(config.capital));
  const [riskInput, setRiskInput] = useState<string>(String(config.riskPercent));
  const [maxCandlesInput, setMaxCandlesInput] = useState<string>(String(config.maxCandlesToEnter));

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

  const handleMaxCandlesChange = (val: string) => {
    setMaxCandlesInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      onUpdateConfig({ ...config, maxCandlesToEnter: num });
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
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
                E-Breakout
              </span>
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
        {/* Section A: Capital & Strategy Selector */}
        <div className="p-3.5 rounded-xl bg-[#171c27] border border-[#263143] space-y-3">
          {/* Capital Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                سرمایه اولیه حساب (Capital USDT):
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                ${Number(config.capital).toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min={100}
                step={500}
                value={capitalInput}
                onChange={(e) => handleCapitalChange(e.target.value)}
                className="w-full px-3 py-2 pl-12 bg-[#0e121a] border border-[#2b364a] rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400 transition-colors"
                placeholder="مثال: 10000"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400">
                USDT
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {[1000, 5000, 10000, 25000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleCapitalChange(String(preset))}
                  className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    config.capital === preset
                      ? 'bg-amber-400 text-black font-bold'
                      : 'bg-[#0f141e] text-gray-400 hover:text-white hover:bg-[#1a2130]'
                  }`}
                >
                  ${preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy Dropdown */}
          <div className="pt-2 border-t border-[#232b3a]">
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
                <option value="none">
                  -- انتخاب استراتژی --
                </option>
                <option value="strategy_2_retest" disabled>
                  استراتژی ۲: پولبک تاییدیه خط شکست (به زودی...)
                </option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Placeholder if none selected */}
        {config.selectedStrategyId === 'none' && (
          <div className="p-4 text-center rounded-xl bg-[#141824] border border-[#232c3d] text-gray-400">
            <p className="text-xs">لطفاً استراتژی اول را از لیست بالا انتخاب کنید تا پارامترهای ریسک و قوانین آن نمایش داده شود.</p>
          </div>
        )}

        {/* Section B: Strategy 1 Configuration (Only if selected) */}
        {config.selectedStrategyId === 'strategy_1_e_breakout' && (
          <div className="p-3.5 rounded-xl bg-[#171c27] border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#263143]">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                تنظیمات و پارامترهای استراتژی اول
              </span>
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...config, showOnChart: !config.showOnChart })}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
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

            {/* Risk Percentage */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-rose-400" />
                  میزان ریسک در هر معامله (Risk %):
                </label>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {config.riskPercent}% (${((config.capital * config.riskPercent) / 100).toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={config.riskPercent}
                  onChange={(e) => handleRiskChange(e.target.value)}
                  className="flex-1 accent-rose-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                />
                <input
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={riskInput}
                  onChange={(e) => handleRiskChange(e.target.value)}
                  className="w-18 px-2 py-1 text-xs font-mono font-bold text-center text-rose-400 bg-[#0e121a] border border-[#2b364a] rounded-lg focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            {/* Max candles allowed after formation */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  مهلت ورود پس از تشکیل لگ (Max Candles):
                </label>
                <span className="text-xs font-mono font-bold text-sky-400">
                  {config.maxCandlesToEnter} کندل
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={10}
                  value={config.maxCandlesToEnter}
                  onChange={(e) => handleMaxCandlesChange(e.target.value)}
                  className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                />
                <input
                  type="number"
                  min={5}
                  max={500}
                  step={5}
                  value={maxCandlesInput}
                  onChange={(e) => handleMaxCandlesChange(e.target.value)}
                  className="w-18 px-2 py-1 text-xs font-mono font-bold text-center text-sky-400 bg-[#0e121a] border border-[#2b364a] rounded-lg focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Rule Explanation Box */}
            <div className="p-2.5 rounded-lg bg-[#0e121a] border border-[#222a38] text-[11px] leading-relaxed text-gray-300 space-y-1">
              <div className="text-amber-300 font-bold">قوانین معاملاتی استراتژی ۱:</div>
              <div className="flex items-start gap-1">
                <span className="text-amber-400">•</span>
                <span>
                  <strong>پیش‌شرط ورود:</strong> لگ بعد از نقطه آبی <strong>F</strong> حتماً باید تشکیل شده باشد.
                </span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-sky-400">•</span>
                <span>
                  <strong>ورود و تعیین جهت:</strong> با شکست نقطه <strong>E</strong>:
                  اگر <strong>E &gt; F</strong> باشد وارد پوزیشن <strong>خرید (BUY)</strong> و اگر <strong>E &le; F</strong> باشد وارد پوزیشن <strong>فروش (SELL)</strong> می‌شویم.
                </span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-rose-400">•</span>
                <span>
                  <strong>حد ضرر (Stop Loss):</strong> دقیقا در قیمت نقطه <strong>F</strong>.
                </span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-emerald-400">•</span>
                <span>
                  <strong>حد سود (Target):</strong> در قیمت نقطه <strong>A</strong> (ابتدای چرخه).
                </span>
              </div>
              <div className="flex items-start gap-1 text-gray-400">
                <span>•</span>
                <span>فقط ۱ معامله برای هر لگ و مهلت ورود حداکثر تا ۱۰۰ کندل پس از تشکیل لگ.</span>
              </div>
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
                        ورود: ${t.entryPrice.toLocaleString()}
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
                      <span>R:R: {t.riskReward}:1</span>
                      <span>ورود پس از {t.candlesElapsedToEntry} کندل</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

import React from 'react';
import {
  Activity,
  BarChart3,
  Settings,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { CryptoPair } from '../types/crypto';
import { PairSelector } from './PairSelector';
import { formatPoints } from '../utils/indicators';

interface NavbarProps {
  selectedPair: CryptoPair;
  onSelectPair: (pair: CryptoPair) => void;
  currentAtr: number;
  currentTwoAtr: number;
  currentThreeAtr: number;
  currentCandleRange?: number;
  atrPeriod?: number;
  isHoveredAtr?: boolean;
  hoveredDate?: string | null;
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  onOpenDataModal: () => void;
  onOpenSettings?: () => void;
  onOpenGuide?: () => void;
  onToggleStrategy?: () => void;
  isStrategyOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedPair,
  onSelectPair,
  currentAtr,
  currentTwoAtr,
  currentThreeAtr,
  currentCandleRange = 0,
  atrPeriod = 55,
  isHoveredAtr,
  hoveredDate,
  wsStatus,
  onOpenDataModal,
  onOpenSettings,
  onOpenGuide,
  onToggleStrategy,
  isStrategyOpen,
}) => {
  // محاسبات درصدی نسبت به باکس اول (ATR)
  const safeAtr = currentAtr > 0 ? currentAtr : 1;
  const twoAtrPct = ((currentTwoAtr / safeAtr) * 100).toFixed(0);
  const threeAtrPct = ((currentThreeAtr / safeAtr) * 100).toFixed(0);
  const candlePct = ((currentCandleRange / safeAtr) * 100).toFixed(0);

  return (
    <header className="bg-[#181d26] border-b border-[#2b313a] px-3 sm:px-4 py-2">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left side: Brand + Top-Left Pair Selector + ATR Metrics in Points */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2 pr-3 border-r border-[#2d3443]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <BarChart3 className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-sm tracking-wider">STRATEGY</span>
                <span className="font-black text-amber-400 text-sm">LAB</span>
              </div>
              <span className="text-[10px] text-gray-400 block -mt-0.5">Binance Market Data</span>
            </div>
          </div>

          {/* Top-Left Currency Selector (بالا سمت چپ انتخاب ارز) */}
          <PairSelector
            selectedPair={selectedPair}
            onSelectPair={onSelectPair}
            ticker={null}
          />

          {/* ATR Metrics Bar: همه باکس‌ها با موس تغییر می‌کنند؛ باکس اول بر اساس pts و بقیه به درصد */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
            {/* باکس اول: ATR(period) فقط بر اساس pts */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#1f2633] border transition-all shadow-xs ${
                isHoveredAtr ? 'border-amber-400/80 shadow-amber-500/10' : 'border-amber-500/30'
              }`}
              title={isHoveredAtr && hoveredDate ? `ATR کندل در ${hoveredDate}` : 'ATR کندل جاری'}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-amber-400 tracking-wider font-mono leading-tight">
                  ATR ({atrPeriod})
                </span>
                <span className="text-xs sm:text-sm font-bold font-mono text-white leading-tight">
                  {formatPoints(currentAtr)} <span className="text-[10px] text-amber-400 font-normal">pts</span>
                </span>
              </div>
            </div>

            {/* باکس دوم: 2*ATR(period) بر اساس درصد از باکس اول (۲۰۰٪) */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#1f2633] border border-sky-500/30 shadow-xs">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-sky-400 tracking-wider font-mono leading-tight">
                  2*ATR ({atrPeriod})
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs sm:text-sm font-bold font-mono text-white leading-tight">
                    {twoAtrPct}%
                  </span>
                  <span className="text-[10px] text-sky-400/80 font-mono">
                    ({formatPoints(currentTwoAtr)} pts)
                  </span>
                </div>
              </div>
            </div>

            {/* باکس سوم: 3*ATR(period) بر اساس درصد از باکس اول (۳۰۰٪) */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#1f2633] border border-purple-500/30 shadow-xs">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-purple-400 tracking-wider font-mono leading-tight">
                  3*ATR ({atrPeriod})
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs sm:text-sm font-bold font-mono text-white leading-tight">
                    {threeAtrPct}%
                  </span>
                  <span className="text-[10px] text-purple-400/80 font-mono">
                    ({formatPoints(currentThreeAtr)} pts)
                  </span>
                </div>
              </div>
            </div>

            {/* باکس چهارم: کندل (Range) بر اساس درصد از باکس اول */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#1f2633] border transition-all shadow-xs ${
                isHoveredAtr
                  ? 'border-emerald-500 bg-emerald-950/25 shadow-emerald-500/10'
                  : 'border-emerald-500/30'
              }`}
              title="دامنه کندل (High - Low) و درصد آن نسبت به ATR"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-emerald-400 tracking-wider font-mono leading-tight">
                  کندل (Range)
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs sm:text-sm font-bold font-mono text-white leading-tight">
                    {candlePct}%
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-mono">
                    ({formatPoints(currentCandleRange)} pts)
                  </span>
                </div>
              </div>
            </div>

            {/* آیکون تنظیمات کنار نوار بالا برای تغییر Period ATR و سایر موارد */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center justify-center p-2 rounded-lg bg-[#1f2633] hover:bg-[#283244] border border-[#2e3748] hover:border-amber-400/50 text-gray-400 hover:text-amber-400 transition-all cursor-pointer shadow-xs group"
                title="تنظیمات اندیکاتور زیگ‌زاگ و دوره زمانی ATR"
              >
                <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
              </button>
            )}

            {/* آیکون راهنما کنار آیکون تنظیمات برای نمایش شروط لگ‌ها */}
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="flex items-center justify-center p-2 rounded-lg bg-[#1f2633] hover:bg-[#283244] border border-[#2e3748] hover:border-sky-400/50 text-gray-400 hover:text-sky-400 transition-all cursor-pointer shadow-xs group"
                title="راهنمای شروط و رنگ‌بندی لگ‌های زیگ‌زاگ"
              >
                <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
              </button>
            )}
          </div>
        </div>

        {/* Right side: Strategy Button + Raw Data Modal + WS Status */}
        <div className="flex items-center gap-2 self-end xl:self-center">
          {/* Strategy Toggle Button */}
          {onToggleStrategy && (
            <button
              onClick={onToggleStrategy}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                isStrategyOpen
                  ? 'bg-amber-400 text-black shadow-amber-500/25 ring-2 ring-amber-400/50'
                  : 'bg-[#222834] text-amber-300 hover:text-white hover:bg-[#2b3342] border border-amber-500/40'
              }`}
              title="باز و بسته کردن پنل استراتژی معاملاتی"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>استراتژی</span>
              <span className="text-[10px] opacity-75 font-mono">E-Break</span>
            </button>
          )}

          {/* Quick Raw OHLCV Table button */}
          <button
            onClick={onOpenDataModal}
            className="px-2.5 py-1.5 rounded-lg bg-[#222834] hover:bg-[#2b3342] text-xs text-gray-300 hover:text-white border border-[#303848] transition-colors cursor-pointer flex items-center gap-1.5"
            title="مشاهده جدول خام مقادیر کندل‌ها"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">داده‌های خام کندل</span>
          </button>

          {/* WebSocket Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#131720] border border-[#262d3a] text-[11px]"
            title={`وضعیت اتصال داده زنده بایننس: ${wsStatus}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : wsStatus === 'reconnecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-gray-400 font-mono text-[10px] uppercase">
              {wsStatus === 'connected' ? 'LIVE STREAM' : wsStatus}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};


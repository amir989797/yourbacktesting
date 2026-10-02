import React from 'react';
import {
  BarChart3,
  Settings,
  HelpCircle,
  Zap,
  FlaskConical,
} from 'lucide-react';
import { CryptoPair } from '../types/crypto';
import { PairSelector } from './PairSelector';
import { formatPoints } from '../utils/indicators';

interface NavbarProps {
  selectedPair: CryptoPair;
  onSelectPair: (pair: CryptoPair) => void;
  currentAtr: number;
  currentTwoAtr?: number;
  currentThreeAtr?: number;
  currentCandleRange?: number;
  atrPeriod?: number;
  isHoveredAtr?: boolean;
  hoveredDate?: string | null;
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  onOpenDataModal?: () => void;
  onOpenSettings?: () => void;
  onOpenGuide?: () => void;
  onOpenBacktest?: () => void;
  onToggleStrategy?: () => void;
  isStrategyOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedPair,
  onSelectPair,
  currentAtr,
  currentCandleRange = 0,
  atrPeriod = 55,
  isHoveredAtr,
  hoveredDate,
  wsStatus,
  onOpenSettings,
  onOpenGuide,
  onOpenBacktest,
  onToggleStrategy,
  isStrategyOpen,
}) => {
  // محاسبات درصدی نسبت به باکس اول (ATR)
  const safeAtr = currentAtr > 0 ? currentAtr : 1;
  const candlePct = ((currentCandleRange / safeAtr) * 100).toFixed(0);

  return (
    <header className="bg-[#181d26] border-b border-[#2b313a] px-3 sm:px-4 py-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left side: Brand + Pair Selector + ATR Metrics */}
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

          {/* ATR Metrics Bar: باکس ATR بر اساس pts و باکس کندل به درصد */}
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

            {/* باکس کندل (Range) بر اساس درصد از باکس اول */}
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
          </div>
        </div>

        {/* Toolbar: تنظیمات، راهنما، بکتست، استراتژی و آیکون connecting همگی همراستا در یک نوار */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* آیکون تنظیمات */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center justify-center p-2 rounded-lg bg-[#1f2633] hover:bg-[#283244] border border-[#2e3748] hover:border-amber-400/50 text-gray-400 hover:text-amber-400 transition-all cursor-pointer shadow-xs group"
              title="تنظیمات اندیکاتور زیگ‌زاگ و دوره زمانی ATR"
            >
              <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
            </button>
          )}

          {/* آیکون راهنما */}
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="flex items-center justify-center p-2 rounded-lg bg-[#1f2633] hover:bg-[#283244] border border-[#2e3748] hover:border-sky-400/50 text-gray-400 hover:text-sky-400 transition-all cursor-pointer shadow-xs group"
              title="راهنمای شروط و رنگ‌بندی لگ‌های زیگ‌زاگ"
            >
              <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            </button>
          )}

          {/* دکمه جدید بکتست (همراستای راهنما و ستینگ) */}
          {onOpenBacktest && (
            <button
              onClick={onOpenBacktest}
              className="px-2.5 py-1.5 rounded-lg bg-[#1f2633] hover:bg-[#283244] text-xs font-bold text-amber-300 hover:text-amber-200 border border-[#2e3748] hover:border-amber-400/50 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs group"
              title="بک‌تست و اسکنر چندارزی بازار"
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>بک‌تست</span>
            </button>
          )}

          {/* دکمه استراتژی (همراستای راهنما و ستینگ) */}
          {onToggleStrategy && (
            <button
              onClick={onToggleStrategy}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                isStrategyOpen
                  ? 'bg-amber-400 text-black shadow-amber-500/25 ring-2 ring-amber-400/50'
                  : 'bg-[#1f2633] text-amber-300 hover:text-white hover:bg-[#283244] border border-[#2e3748]'
              }`}
              title="باز و بسته کردن پنل استراتژی معاملاتی"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>استراتژی</span>
            </button>
          )}

          {/* آیکون connecting (همراستای راهنما و ستینگ) */}
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#131720] border border-[#262d3a] text-[11px]"
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
            {wsStatus === 'connected' && (
              <span className="text-gray-400 font-mono text-[10px] uppercase">
                LIVE STREAM
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};



import React from 'react';
import { X, BookOpen, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ZigZagSettings } from '../types/crypto';

interface ZigZagGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: ZigZagSettings;
}

export const ZigZagGuideModal: React.FC<ZigZagGuideModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  if (!isOpen) return null;

  const atrMult = settings?.atrMultiplier ?? 3;
  const minC = settings?.minCandles ?? 3;
  const minLongC = settings?.minCandlesForLongLeg ?? 20;
  const longLegAtrMult = settings?.longLegAtrMultiplier ?? 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl max-h-[90vh] bg-[#141822] border border-[#2d3648] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252e3d] bg-[#10131a] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">راهنمای شروط و رنگ‌بندی لگ‌های زیگ‌زاگ</h3>
              <p className="text-[11px] text-gray-400">قوانین محاسبه، شکست پیوت‌ها و محدودیت ۵ برابری ATR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* SECTION 1: English Summary (طبق درخواست) */}
          <div className="p-3.5 rounded-xl bg-[#0d1017] border border-[#263143] text-left" dir="ltr">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                Summary of Leg Conditions:
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Active Settings Applied</span>
            </div>
            <div className="space-y-1.5 font-mono text-[12px] leading-relaxed text-gray-300 bg-[#121620] p-3 rounded-lg border border-[#1e2736]">
              <div className="text-gray-200">
                <span className="text-white font-bold">white leg:</span> length &gt;= {atrMult}ATR , count &gt;= {minC} candle
              </div>
              <div className="text-[#00E676]">
                <span className="text-emerald-400 font-bold">green leg (bullish giant):</span> direction = UP , length &gt;= {longLegAtrMult}ATR ({Math.round(longLegAtrMult * 100)}%) , count &gt;= {minLongC} candle <span className="text-amber-300 font-bold ml-1">[Start: A , End: B]</span>
              </div>
              <div className="text-[#FF1744]">
                <span className="text-rose-400 font-bold">red leg (bearish giant):</span> direction = DOWN , length &gt;= {longLegAtrMult}ATR ({Math.round(longLegAtrMult * 100)}%) , count &gt;= {minLongC} candle <span className="text-amber-300 font-bold ml-1">[Start: A , End: B]</span>
              </div>
              <div className="text-[#00E5FF]">
                <span className="text-cyan-400 font-bold">light blue leg:</span> 2nd or 4th leg after green/red , breaks green/red end price , breakout &lt;= 5ATR <span className="text-amber-300 font-bold ml-1">[Start: C , End: D]</span>
              </div>
              <div className="text-[#60A5FA]">
                <span className="text-blue-500 font-bold">dark blue leg:</span> 2nd or 4th leg after light blue , breaks light blue end price , breakout &lt;= 5ATR <span className="text-amber-300 font-bold ml-1">[Start: E , End: F]</span>
              </div>
            </div>
          </div>

          {/* Points Naming Guide (A, B, C, D, E, F) */}
          <div className="p-3.5 rounded-xl bg-[#121722] border border-amber-500/30">
            <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
              <span>🏷️</span>
              <span>راهنمای حروف و برچسب نقاط عطف (Points Labels):</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-[#0e1713] border border-emerald-500/30 text-emerald-300">
                <div className="font-bold text-white mb-1">لگ سبز / قرمز:</div>
                <div>شروع لگ: <strong className="text-amber-400 font-mono text-xs">A</strong></div>
                <div>پایان لگ: <strong className="text-amber-400 font-mono text-xs">B</strong></div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0c1824] border border-cyan-500/30 text-cyan-300">
                <div className="font-bold text-white mb-1">لگ آبی کم‌رنگ:</div>
                <div>شروع لگ: <strong className="text-amber-400 font-mono text-xs">C</strong></div>
                <div>پایان لگ: <strong className="text-amber-400 font-mono text-xs">D</strong></div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0d1629] border border-blue-500/30 text-blue-300">
                <div className="font-bold text-white mb-1">لگ آبی پررنگ:</div>
                <div>شروع لگ: <strong className="text-amber-400 font-mono text-xs">E</strong></div>
                <div>پایان لگ: <strong className="text-amber-400 font-mono text-xs">F</strong></div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
              * حروف قله‌ها (High) در بالای نقطه و حروف کف‌ها (Low) در پایین نقطه با فونت کوچک و نشانگر رنگی نمایش داده می‌شوند.
            </p>
          </div>

          {/* SECTION 2: Detailed Persian Explanations */}
          <div className="space-y-2.5">
            {/* 1. White Leg */}
            <div className="p-3 rounded-xl bg-[#181d28] border border-gray-700/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                <h4 className="text-xs font-bold text-white">لگ سفید (White Leg - لگ استاندارد پایه)</h4>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                تمام خطوط نوسانی پایه زیگ‌زاگ. بین هر دو قله و دره متوالی باید حداقل <strong className="text-white">{minC} کندل</strong> فاصله زمانی و حداقل <strong className="text-white">{atrMult} برابر ATR</strong> فاصله قیمتی وجود داشته باشد.
              </p>
            </div>

            {/* 2. Green Leg */}
            <div className="p-3 rounded-xl bg-[#0e241b] border border-emerald-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-[#00E676] shadow-[0_0_8px_#00E676]" />
                <h4 className="text-xs font-bold text-emerald-400">لگ سبز (Green Giant Leg - لگ صعودی پرقدرت)</h4>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                لگ صعودی که اندازه آن حداقل <strong className="text-emerald-300">{longLegAtrMult} برابر ATR</strong> (بیش از {Math.round(longLegAtrMult * 100)}٪) بوده و تعداد کندل‌های آن حداقل <strong className="text-emerald-300">{minLongC} کندل</strong> باشد.
              </p>
            </div>

            {/* 3. Red Leg */}
            <div className="p-3 rounded-xl bg-[#291217] border border-rose-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-[#FF1744] shadow-[0_0_8px_#FF1744]" />
                <h4 className="text-xs font-bold text-rose-400">لگ قرمز (Red Giant Leg - لگ نزولی پرقدرت)</h4>
              </div>
              <p className="text-[11px] text-rose-100/90 leading-relaxed">
                لگ نزولی که اندازه آن حداقل <strong className="text-rose-300">{longLegAtrMult} برابر ATR</strong> (بیش از {Math.round(longLegAtrMult * 100)}٪) بوده و تعداد کندل‌های آن حداقل <strong className="text-rose-300">{minLongC} کندل</strong> باشد.
              </p>
            </div>

            {/* 4. Light Blue Leg */}
            <div className="p-3 rounded-xl bg-[#09222c] border border-cyan-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                <h4 className="text-xs font-bold text-cyan-300">لگ آبی کم‌رنگ (Light Blue Leg - لگ دوم با شکست معتبر)</h4>
              </div>
              <p className="text-[11px] text-cyan-100/90 leading-relaxed mb-1.5">
                <strong>دومین لگ (G+2)</strong> یا در صورت عدم شکست، <strong>چهارمین لگ (G+4)</strong> بعد از سبز یا قرمز که هم‌جهت با آن است و انتهای لگ سبز یا قرمز را می‌شکند.
              </p>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#061820] border border-cyan-400/30 text-[10px] text-cyan-300">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span><strong>شرط سقف نفوذ:</strong> پس از شکست، میزان عبور قیمت نباید بیشتر از <strong>۵ برابر ATR</strong> باشد.</span>
              </div>
            </div>

            {/* 5. Dark Blue Leg */}
            <div className="p-3 rounded-xl bg-[#0d1c38] border border-blue-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]" />
                <h4 className="text-xs font-bold text-blue-300">لگ آبی پررنگ (Dark Blue Leg - لگ دوم بعد از آبی کم‌رنگ)</h4>
              </div>
              <p className="text-[11px] text-blue-100/90 leading-relaxed mb-1.5">
                <strong>دومین لگ (B+2)</strong> یا در صورت عدم شکست، <strong>چهارمین لگ (B+4)</strong> بعد از آبی کم‌رنگ که انتهای آبی کم‌رنگ را به سمت جلو می‌شکند.
              </p>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#081226] border border-blue-400/30 text-[10px] text-blue-300">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span><strong>شرط سقف نفوذ:</strong> پس از شکست، میزان عبور قیمت نباید بیشتر از <strong>۵ برابر ATR</strong> باشد.</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                * پس از ثبت لگ آبی پررنگ، سیستم تا تشکیل مجدد لگ سبز یا قرمز بعدی در حالت سفید منتظر می‌ماند.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#252e3d] bg-[#10131a] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-md"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>متوجه شدم</span>
          </button>
        </div>
      </div>
    </div>
  );
};

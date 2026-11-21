import React, { useState } from 'react';
import { X, BookOpen, CheckCircle2, ShieldAlert, Sliders } from 'lucide-react';
import { ZigZagSettings } from '../types/crypto';

interface ZigZagGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: ZigZagSettings;
}

interface ParamDefinition {
  index: number;
  title: string;
  keyName: string;
  valueLabel: string;
  accentClass: string;
  dotClass: string;
  line1: string;
  line2: string;
}

export const ZigZagGuideModal: React.FC<ZigZagGuideModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'legs' | 'params'>('legs');

  if (!isOpen) return null;

  const atrPeriod = settings?.atrPeriod ?? 55;
  const atrMult = settings?.atrMultiplier ?? 3;
  const minC = settings?.minCandles ?? 3;
  const minLongC = settings?.minCandlesForLongLeg ?? 20;
  const longLegAtrMult = settings?.longLegAtrMultiplier ?? 10;
  const minBlueC = settings?.minCandlesForBlueLeg ?? 3;
  const blueLegAtrMult = settings?.blueLegAtrMultiplier ?? 3;
  const maxBluePct = settings?.maxBlueLegPercent ?? 60;
  const maxBreakoutAtr = settings?.maxBreakoutAtrMultiplier ?? 5;
  const maxCandlesEnter = settings?.maxCandlesToEnter ?? 35;
  const minAtrPct = settings?.minAtrPercent ?? 0.25;
  const rsiThreshold = settings?.s2RsiThreshold ?? 38;
  const minEntryPivot = settings?.minEntryPivotAtr ?? 0;

  const parameterDefinitions: ParamDefinition[] = [
    {
      index: 1,
      title: 'دوره زمانی ATR',
      keyName: 'atrPeriod',
      valueLabel: `${atrPeriod} کندل`,
      accentClass: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      dotClass: 'bg-amber-400',
      line1: 'دوره هموارسازی Wilder RMA برای میانگین دامنه واقعی: TR = max(H−L, |H−PrevC|, |L−PrevC|).',
      line2: 'شروع با SMA روی P کندل اول و به‌روزرسانی بازگشتی: ATR[i] = (ATR[i-1]×(P−1) + TR[i]) / P.',
    },
    {
      index: 2,
      title: 'حداقل فاصله کندل (لگ پایه)',
      keyName: 'minCandles',
      valueLabel: `${minC} کندل`,
      accentClass: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      dotClass: 'bg-sky-400',
      line1: 'حداقل تعداد کندل لازم بین دو پیوت متوالی برای تایید برگشت زیگ‌زاگ (candleIndex − lastPivotIndex >= N).',
      line2: 'همچنین در استراتژی ۲، حداقل فاصله زمانی لازم از پیوت F برای تایید تشکیل لگ ورود بعد از F است.',
    },
    {
      index: 3,
      title: 'حداقل کندل لگ بلند (AB)',
      keyName: 'minCandlesForLongLeg',
      valueLabel: `${minLongC} کندل`,
      accentClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      dotClass: 'bg-emerald-400',
      line1: 'حداقل تعداد کندل بین پیوت شروع A و پیوت پایان B برای شناسایی یک لگ به‌عنوان لگ غول‌پیکر (سبز یا قرمز).',
      line2: 'شرط زمانی: (endIndex − startIndex) >= N که هم‌زمان با شرط ضریب ATR لگ بزرگ بررسی می‌شود.',
    },
    {
      index: 4,
      title: 'ضریب نوسان عادی ATR',
      keyName: 'atrMultiplier',
      valueLabel: `${atrMult}× ATR`,
      accentClass: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      dotClass: 'bg-purple-400',
      line1: 'حداقل حرکت قیمتی لازم جهت ثبت برگشت پیوت زیگ‌زاگ (لگ سفید): |Price − LastPivot| >= M × ATR[i].',
      line2: 'در استراتژی ۲ نیز آستانه حرکت قیمتی بعد از پیوت F برای تایید تشکیل لگ معکوس و صدور سیگنال ورود است.',
    },
    {
      index: 5,
      title: 'ضریب ATR لگ بزرگ (AB)',
      keyName: 'longLegAtrMultiplier',
      valueLabel: `${longLegAtrMult}× ATR`,
      accentClass: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
      dotClass: 'bg-rose-400',
      line1: 'حداقل نسبت طول قیمتی لگ به ATR مرجع برای برچسب‌گذاری لگ سبز (صعودی) یا قرمز (نزولی) با نقاط A و B.',
      line2: 'فرمول اعتبار لگ بزرگ: (|endPrice − startPrice| / refATR) >= M به همراه تحقق minCandlesForLongLeg.',
    },
    {
      index: 6,
      title: 'حداقل کندل لگ آبی (CD, EF)',
      keyName: 'minCandlesForBlueLeg',
      valueLabel: `${minBlueC} کندل`,
      accentClass: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      dotClass: 'bg-cyan-400',
      line1: 'حداقل تعداد کندل لازم برای معتبر بودن لگ‌های شکست هم‌جهت آبی کم‌رنگ (CD) و آبی پررنگ (EF).',
      line2: 'لگ‌های کاندید (+۲ یا +۴ بعد از AB/CD) تنها در صورت برقراری (endIndex − startIndex) >= N پذیرفته می‌شوند.',
    },
    {
      index: 7,
      title: 'ضریب ATR لگ آبی (CD, EF)',
      keyName: 'blueLegAtrMultiplier',
      valueLabel: `${blueLegAtrMult}× ATR`,
      accentClass: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      dotClass: 'bg-blue-400',
      line1: 'حداقل نسبت طول قیمتی به ATR مرجع برای تایید لگ‌های شکست آبی کم‌رنگ (CD) و آبی پررنگ (EF).',
      line2: 'شرط: (|endPrice − startPrice| / refATR) >= M که مانع از ثبت شکست‌های بسیار کوتاه و نویزی می‌شود.',
    },
    {
      index: 8,
      title: 'سقف اندازه لگ آبی (%)',
      keyName: 'maxBlueLegPercent',
      valueLabel: `${maxBluePct}%`,
      accentClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
      dotClass: 'bg-cyan-300',
      line1: 'حداکثر طول قیمتی مجاز لگ‌های CD و EF نسبت به طول لگ غول‌پیکر مادر (AB) بر حسب درصد.',
      line2: 'شرط فیلتر: legPoints < (P / 100) × AB.legPoints تا مومنتوم لگ‌های شکست از لگ اصلی کوچک‌تر بماند.',
    },
    {
      index: 9,
      title: 'سقف نفوذ شکست انتهای لگ (ATR)',
      keyName: 'maxBreakoutAtrMultiplier',
      valueLabel: `${maxBreakoutAtr}× ATR`,
      accentClass: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
      dotClass: 'bg-indigo-400',
      line1: 'حداکثر میزان عبور مجاز نقطه D از انتهای B (و نقطه F از انتهای D) پس از شکست قیمتی.',
      line2: 'شرط: |breakoutPrice − prevEndPrice| <= M × refATR؛ عبور بیشتر از این سقف شکست را باطل می‌کند.',
    },
    {
      index: 10,
      title: 'سقف کندل ورود (مهلت ورود)',
      keyName: 'maxCandlesToEnter',
      valueLabel: `${maxCandlesEnter} کندل`,
      accentClass: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
      dotClass: 'bg-sky-300',
      line1: 'حداکثر تعداد کندل مجاز از نقطه پیوت مبنا تا فعال‌شدن کندل ورود (در غیر این صورت سیگنال منقضی می‌شود).',
      line2: 'استراتژی ۱: فاصله F تا شکست سطح E | استراتژی ۲: فاصله پیوت F تا کندل ورود | استراتژی ۳: پنجره مجاز ورود.',
    },
    {
      index: 11,
      title: 'حداقل نوسان ATR (%)',
      keyName: 'minAtrPercent',
      valueLabel: minAtrPct === 0 ? 'خاموش' : `${minAtrPct}%`,
      accentClass: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
      dotClass: 'bg-teal-400',
      line1: 'فیلتر کف نوسان سراسری برای همه استراتژی‌ها جهت حذف بازارهای کم‌نوسان و جلوگیری از اثر بالای کارمزد.',
      line2: 'شرط پذیرش سیگنال: (ATR[entryIdx] / entryPrice) × 100 >= P؛ با مقدار 0 فیلتر کاملاً غیرفعال است.',
    },
    {
      index: 12,
      title: 'آستانه RSI پیوت',
      keyName: 's2RsiThreshold',
      valueLabel: rsiThreshold === 0 ? 'خاموش' : `≤${rsiThreshold} / ≥${100 - rsiThreshold}`,
      accentClass: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10',
      dotClass: 'bg-fuchsia-400',
      line1: 'فیلتر مومنتوم با RSI(14) وایلدر روی کندل پیوت مرجع (پیوت F یا پیوت اول) در تمام استراتژی‌ها.',
      line2: 'شرط ورود خرید: RSI <= T و شرط ورود فروش: RSI >= (100 − T)؛ مقدار 0 فیلتر را غیرفعال می‌کند.',
    },
    {
      index: 13,
      title: 'فاصله ورود تا پیوت (ATR)',
      keyName: 'minEntryPivotAtr',
      valueLabel: minEntryPivot === 0 ? 'خاموش' : `≥ ${minEntryPivot}× ATR`,
      accentClass: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
      dotClass: 'bg-orange-400',
      line1: 'حداقل فاصله قیمتی بین قیمت ورود و قیمت پیوت مرجع (استاپ‌لاس) بر حسب ضریب ATR برای همه استراتژی‌ها.',
      line2: 'شرط پذیرش: |entryPrice − pivotPrice| / ATR[entryIdx] >= M؛ با مقدار 0 این شرط اعمال نمی‌شود.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-[#141822] border border-[#2d3648] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
              <h3 className="text-sm font-bold text-white">راهنمای جامع زیگ‌زاگ و مرجع پارامترها</h3>
              <p className="text-[11px] text-gray-400">قوانین رنگ‌بندی لگ‌ها و مستند فنی ۱۳ پارامتر الگوریتم</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#232c3d] bg-[#121622] px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('legs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-t-2 ${
              activeTab === 'legs'
                ? 'bg-[#181f2c] text-sky-400 border-sky-400'
                : 'text-gray-400 hover:text-gray-200 border-transparent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>قوانین لگ‌ها (A تا F)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-t-2 ${
              activeTab === 'params'
                ? 'bg-[#181f2c] text-amber-400 border-amber-400'
                : 'text-gray-400 hover:text-gray-200 border-transparent'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>تعریف ۱۳ پارامتر (مرجع توسعه)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'legs' ? (
            <>
              {/* SECTION 1: English Summary */}
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
                    <span className="text-cyan-400 font-bold">light blue leg:</span> 2nd or 4th leg after green/red , length &gt;= {blueLegAtrMult}ATR , count &gt;= {minBlueC} candle , breaks green/red end price , breakout &lt;= {maxBreakoutAtr}ATR , pts &lt; {maxBluePct}% of green/red <span className="text-amber-300 font-bold ml-1">[Start: C , End: D]</span>
                  </div>
                  <div className="text-[#60A5FA]">
                    <span className="text-blue-500 font-bold">dark blue leg:</span> 2nd leg after light blue , length &gt;= {blueLegAtrMult}ATR , count &gt;= {minBlueC} candle , breaks light blue end price , breakout &lt;= {maxBreakoutAtr}ATR , pts &lt; {maxBluePct}% of green/red <span className="text-amber-300 font-bold ml-1">[Start: E , End: F]</span>
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
                  <div className="flex flex-col gap-1 px-2 py-1.5 rounded bg-[#061820] border border-cyan-400/30 text-[10px] text-cyan-300">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span><strong>شرط سقف نفوذ:</strong> پس از شکست، میزان عبور قیمت نباید بیشتر از <strong>{maxBreakoutAtr} برابر ATR</strong> باشد.</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span><strong>شرط اندازه لگ:</strong> اندازه لگ آبی باید <strong>کمتر از {maxBluePct}٪ pts لگ قرمز یا سبز</strong> باشد.</span>
                    </div>
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
                  <div className="flex flex-col gap-1 px-2 py-1.5 rounded bg-[#081226] border border-blue-400/30 text-[10px] text-blue-300">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span><strong>شرط سقف نفوذ:</strong> پس از شکست، میزان عبور قیمت نباید بیشتر از <strong>{maxBreakoutAtr} برابر ATR</strong> باشد.</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span><strong>شرط اندازه لگ:</strong> اندازه لگ آبی پررنگ نیز باید <strong>کمتر از {maxBluePct}٪ pts لگ قرمز یا سبز</strong> باشد.</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    * پس از ثبت لگ آبی پررنگ، سیستم تا تشکیل مجدد لگ سبز یا قرمز بعدی در حالت سفید منتظر می‌ماند.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="px-3 py-2 rounded-xl bg-[#0e131e] border border-amber-500/25 text-[11px] text-gray-300 flex items-center justify-between gap-2">
                <span>مستند فنی و فرمولی تمام ۱۳ پارامتر موتور زیگ‌زاگ و فیلترهای ورود جهت بازپیاده‌سازی دقیق:</span>
                <span className="shrink-0 font-mono text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  13 Params Spec
                </span>
              </div>

              {parameterDefinitions.map((param) => (
                <div
                  key={param.keyName}
                  className="p-2.5 rounded-xl bg-[#171d29] border border-[#263042] hover:border-[#37455f] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#0f131c] border border-[#2d3748] text-[10px] font-mono font-bold text-gray-300 flex items-center justify-center shrink-0">
                        {param.index}
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${param.dotClass}`} />
                      <h4 className="text-xs font-bold text-white truncate">{param.title}</h4>
                      <code
                        className="text-[10px] font-mono text-gray-400 bg-[#0d1118] border border-[#232c3d] px-1.5 py-0.5 rounded shrink-0"
                        dir="ltr"
                      >
                        {param.keyName}
                      </code>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${param.accentClass}`}
                    >
                      {param.valueLabel}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-300 leading-5 pr-7 space-y-0.5">
                    <p>{param.line1}</p>
                    <p className="text-gray-400">{param.line2}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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


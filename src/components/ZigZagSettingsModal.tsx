import React, { useState } from 'react';
import { X, Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';
import { ZigZagSettings } from '../types/crypto';

interface ZigZagSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ZigZagSettings;
  onSave: (newSettings: ZigZagSettings) => void;
}

export const DEFAULT_ZIGZAG_SETTINGS: ZigZagSettings = {
  atrPeriod: 55,
  minCandles: 3,
  minCandlesForLongLeg: 20,
  atrMultiplier: 3,
  longLegAtrMultiplier: 10,
  maxBlueLegPercent: 60,
  maxBreakoutAtrMultiplier: 5,
};

export const ZigZagSettingsModal: React.FC<ZigZagSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [atrPeriod, setAtrPeriod] = useState<number | string>(settings.atrPeriod);
  const [minCandles, setMinCandles] = useState<number | string>(settings.minCandles);
  const [minCandlesForLongLeg, setMinCandlesForLongLeg] = useState<number | string>(
    settings.minCandlesForLongLeg
  );
  const [atrMultiplier, setAtrMultiplier] = useState<number | string>(settings.atrMultiplier);
  const [longLegAtrMultiplier, setLongLegAtrMultiplier] = useState<number | string>(
    settings.longLegAtrMultiplier ?? 10
  );
  const [maxBlueLegPercent, setMaxBlueLegPercent] = useState<number | string>(
    settings.maxBlueLegPercent ?? 60
  );
  const [maxBreakoutAtrMultiplier, setMaxBreakoutAtrMultiplier] = useState<number | string>(
    settings.maxBreakoutAtrMultiplier ?? 5
  );

  // Sync state if settings prop changes
  React.useEffect(() => {
    if (isOpen) {
      setAtrPeriod(settings.atrPeriod);
      setMinCandles(settings.minCandles);
      setMinCandlesForLongLeg(settings.minCandlesForLongLeg);
      setAtrMultiplier(settings.atrMultiplier);
      setLongLegAtrMultiplier(settings.longLegAtrMultiplier ?? 10);
      setMaxBlueLegPercent(settings.maxBlueLegPercent ?? 60);
      setMaxBreakoutAtrMultiplier(settings.maxBreakoutAtrMultiplier ?? 5);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleReset = () => {
    setAtrPeriod(DEFAULT_ZIGZAG_SETTINGS.atrPeriod);
    setMinCandles(DEFAULT_ZIGZAG_SETTINGS.minCandles);
    setMinCandlesForLongLeg(DEFAULT_ZIGZAG_SETTINGS.minCandlesForLongLeg);
    setAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.atrMultiplier);
    setLongLegAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.longLegAtrMultiplier);
    setMaxBlueLegPercent(DEFAULT_ZIGZAG_SETTINGS.maxBlueLegPercent ?? 60);
    setMaxBreakoutAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.maxBreakoutAtrMultiplier ?? 5);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAtrPeriod = Math.max(1, parseInt(String(atrPeriod), 10) || 55);
    const finalMinCandles = Math.max(1, parseInt(String(minCandles), 10) || 1);
    const finalMinCandlesLong = Math.max(1, parseInt(String(minCandlesForLongLeg), 10) || 20);
    const finalAtrMult = Math.max(0.1, parseFloat(String(atrMultiplier)) || 1);
    const finalLongAtrMult = Math.max(0.1, parseFloat(String(longLegAtrMultiplier)) || 10);
    const finalMaxBlue = Math.max(1, parseFloat(String(maxBlueLegPercent)) || 60);
    const finalMaxBreakout = Math.max(0.5, parseFloat(String(maxBreakoutAtrMultiplier)) || 5);

    onSave({
      atrPeriod: finalAtrPeriod,
      minCandles: finalMinCandles,
      minCandlesForLongLeg: finalMinCandlesLong,
      atrMultiplier: finalAtrMult,
      longLegAtrMultiplier: finalLongAtrMult,
      maxBlueLegPercent: finalMaxBlue,
      maxBreakoutAtrMultiplier: finalMaxBreakout,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#161b24] border border-[#2e3748] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252e3d] bg-[#121620]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">تنظیمات اندیکاتور زیگ‌زاگ و ATR</h3>
              <p className="text-[11px] text-gray-400">پیکربندی دوره‌های زمانی و پارامترهای لگ‌ها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* 1. Period ATR */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Period ATR (دوره زمانی ATR)
              </label>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {atrPeriod} کندل
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              دوره زمانی برای محاسبه اندیکاتور ATR در نوار بالا و محاسبات پوینت‌های زیگ‌زاگ.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={200}
                value={Number(atrPeriod) || 55}
                onChange={(e) => setAtrPeriod(Number(e.target.value))}
                className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={atrPeriod}
                onChange={(e) => setAtrPeriod(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-amber-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* 2. Min Candle */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-sky-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Min Candle (حداقل فاصله کندل)
              </label>
              <span className="text-[11px] font-mono text-sky-400 font-bold">
                {minCandles} کندل
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              حداقل تعداد کندل بین هر دو نقطه عطف زیگ‌زاگ (برای فیلتر کردن نوسانات مقطعی).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={Number(minCandles) || 1}
                onChange={(e) => setMinCandles(Number(e.target.value))}
                className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={minCandles}
                onChange={(e) => setMinCandles(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-sky-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* 3. Min Candle for Long Leg */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Min Candle for Long Leg (حداقل کندل لگ بلند)
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {minCandlesForLongLeg} کندل
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              حداقل تعداد کندل لازم برای شناسایی لگ‌های غول‌پیکر سبز (صعودی) یا قرمز (نزولی).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={Number(minCandlesForLongLeg) || 20}
                onChange={(e) => setMinCandlesForLongLeg(Number(e.target.value))}
                className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={minCandlesForLongLeg}
                onChange={(e) => setMinCandlesForLongLeg(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-emerald-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* 4. ATR Multiplier (ضریب زیگ‌زاگ عادی) */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-purple-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                ضریب نوسان زیگ‌زاگ عادی (ATR Multiplier)
              </label>
              <span className="text-[11px] font-mono text-purple-400 font-bold">
                {atrMultiplier}× ATR
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              حداقل تغییرات قیمت بر مبنای مضربی از ATR جهت تایید چرخش زیگ‌زاگ (می‌توانید مقادیر کمتر از ۳ مانند ۰.۵، ۱، ۱.۵ یا ۲ را وارد کنید).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.1}
                max={10}
                step={0.1}
                value={Number(atrMultiplier) || 0.1}
                onChange={(e) => setAtrMultiplier(Number(e.target.value))}
                className="flex-1 accent-purple-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={0.1}
                max={50}
                step="any"
                value={atrMultiplier}
                onChange={(e) => setAtrMultiplier(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-purple-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* 5. Long Leg ATR Multiplier (ضریب نوسان لگ‌های بزرگ) */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-rose-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                ضریب ATR نوسان لگ‌های بزرگ (Giant Leg Multiplier)
              </label>
              <span className="text-[11px] font-mono text-rose-400 font-bold">
                {longLegAtrMultiplier}× ATR ({Math.round((Number(longLegAtrMultiplier) || 10) * 100)}%)
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              حداقل اندازه حرکت بر مبنای مضربی از ATR برای شناسایی لگ‌های غول‌پیکر سبز (صعودی) یا قرمز (نزولی).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={30}
                step={0.5}
                value={Number(longLegAtrMultiplier) || 10}
                onChange={(e) => setLongLegAtrMultiplier(Number(e.target.value))}
                className="flex-1 accent-rose-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={0.1}
                max={100}
                step="any"
                value={longLegAtrMultiplier}
                onChange={(e) => setLongLegAtrMultiplier(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-rose-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>

          {/* 6. Blue Leg Max % Ratio (محدودیت ۶۰ درصدی لگ‌های آبی) */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                سقف اندازه لگ‌های آبی (نسبت به قرمز/سبز)
              </label>
              <span className="text-[11px] font-mono text-cyan-400 font-bold">
                {maxBlueLegPercent}%
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              محدودیت درصدی برای لگ‌های آبی (C تا D و E تا F): اندازه پوینت لگ آبی باید کمتر از این درصد از لگ قرمز/سبز باشد (پیش‌فرض ۶۰٪).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Number(maxBlueLegPercent) || 60}
                onChange={(e) => setMaxBlueLegPercent(Number(e.target.value))}
                className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={1}
                max={200}
                step={1}
                value={maxBlueLegPercent}
                onChange={(e) => setMaxBlueLegPercent(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-cyan-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* 7. Max Breakout Penetration ATR (سقف نفوذ شکست انتهای لگ) */}
          <div className="p-3 rounded-xl bg-[#1a212d] border border-[#283244] hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                سقف نفوذ شکست انتهای لگ (برابر ATR)
              </label>
              <span className="text-[11px] font-mono text-indigo-400 font-bold">
                {maxBreakoutAtrMultiplier}× ATR
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
              فاصله مجاز عبور قیمت از نقطه شکست انتهای لگ نباید بیشتر از این مضرب از ATR باشد (پیش‌فرض ۵ برابر ATR).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={Number(maxBreakoutAtrMultiplier) || 5}
                onChange={(e) => setMaxBreakoutAtrMultiplier(Number(e.target.value))}
                className="flex-1 accent-indigo-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
              />
              <input
                type="number"
                min={0.5}
                max={50}
                step="any"
                value={maxBreakoutAtrMultiplier}
                onChange={(e) => setMaxBreakoutAtrMultiplier(e.target.value)}
                className="w-18 px-2.5 py-1 text-xs font-mono font-bold text-center text-indigo-400 bg-[#10141c] border border-[#323d50] rounded-lg focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#252e3d]">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پیش‌فرض (55 / 3 / 20 / 3 / 10 / 60% / 5x)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>ذخیره و اعمال</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

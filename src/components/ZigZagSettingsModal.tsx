import React, { useState, useEffect } from 'react';
import { X, Sliders, RotateCcw, Check, ShieldCheck, Zap, HelpCircle, Activity, Scale } from 'lucide-react';
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
  minCandlesForBlueLeg: 3,
  atrMultiplier: 3,
  longLegAtrMultiplier: 10,
  blueLegAtrMultiplier: 3,
  maxBlueLegPercent: 60,
  maxBreakoutAtrMultiplier: 5,
  maxCandlesToEnter: 35,
  maxPositionToRiskRatio: 300,
};

export const ZigZagSettingsModal: React.FC<ZigZagSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'risk' | 'zigzag'>('risk');

  // Strategy & Risk Sizing
  const [maxPositionToRiskRatio, setMaxPositionToRiskRatio] = useState<number | string>(
    settings.maxPositionToRiskRatio ?? 300
  );

  // ZigZag Parameters
  const [atrPeriod, setAtrPeriod] = useState<number | string>(settings.atrPeriod);
  const [minCandles, setMinCandles] = useState<number | string>(settings.minCandles);
  const [minCandlesForLongLeg, setMinCandlesForLongLeg] = useState<number | string>(
    settings.minCandlesForLongLeg
  );
  const [minCandlesForBlueLeg, setMinCandlesForBlueLeg] = useState<number | string>(
    settings.minCandlesForBlueLeg ?? 3
  );
  const [atrMultiplier, setAtrMultiplier] = useState<number | string>(settings.atrMultiplier);
  const [longLegAtrMultiplier, setLongLegAtrMultiplier] = useState<number | string>(
    settings.longLegAtrMultiplier ?? 10
  );
  const [blueLegAtrMultiplier, setBlueLegAtrMultiplier] = useState<number | string>(
    settings.blueLegAtrMultiplier ?? 3
  );
  const [maxBlueLegPercent, setMaxBlueLegPercent] = useState<number | string>(
    settings.maxBlueLegPercent ?? 60
  );
  const [maxBreakoutAtrMultiplier, setMaxBreakoutAtrMultiplier] = useState<number | string>(
    settings.maxBreakoutAtrMultiplier ?? 5
  );
  const [maxCandlesToEnter, setMaxCandlesToEnter] = useState<number | string>(
    settings.maxCandlesToEnter ?? 35
  );

  // Sync state when opened or settings change
  useEffect(() => {
    if (isOpen) {
      setMaxPositionToRiskRatio(settings.maxPositionToRiskRatio ?? 300);
      setAtrPeriod(settings.atrPeriod);
      setMinCandles(settings.minCandles);
      setMinCandlesForLongLeg(settings.minCandlesForLongLeg);
      setMinCandlesForBlueLeg(settings.minCandlesForBlueLeg ?? 3);
      setAtrMultiplier(settings.atrMultiplier);
      setLongLegAtrMultiplier(settings.longLegAtrMultiplier ?? 10);
      setBlueLegAtrMultiplier(settings.blueLegAtrMultiplier ?? 3);
      setMaxBlueLegPercent(settings.maxBlueLegPercent ?? 60);
      setMaxBreakoutAtrMultiplier(settings.maxBreakoutAtrMultiplier ?? 5);
      setMaxCandlesToEnter(settings.maxCandlesToEnter ?? 35);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleReset = () => {
    setMaxPositionToRiskRatio(DEFAULT_ZIGZAG_SETTINGS.maxPositionToRiskRatio ?? 300);
    setAtrPeriod(DEFAULT_ZIGZAG_SETTINGS.atrPeriod);
    setMinCandles(DEFAULT_ZIGZAG_SETTINGS.minCandles);
    setMinCandlesForLongLeg(DEFAULT_ZIGZAG_SETTINGS.minCandlesForLongLeg);
    setMinCandlesForBlueLeg(DEFAULT_ZIGZAG_SETTINGS.minCandlesForBlueLeg ?? 3);
    setAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.atrMultiplier);
    setLongLegAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.longLegAtrMultiplier);
    setBlueLegAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.blueLegAtrMultiplier ?? 3);
    setMaxBlueLegPercent(DEFAULT_ZIGZAG_SETTINGS.maxBlueLegPercent ?? 60);
    setMaxBreakoutAtrMultiplier(DEFAULT_ZIGZAG_SETTINGS.maxBreakoutAtrMultiplier ?? 5);
    setMaxCandlesToEnter(DEFAULT_ZIGZAG_SETTINGS.maxCandlesToEnter ?? 35);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMaxRatio = Math.max(10, parseFloat(String(maxPositionToRiskRatio)) || 300);
    const finalAtrPeriod = Math.max(1, parseInt(String(atrPeriod), 10) || 55);
    const finalMinCandles = Math.max(1, parseInt(String(minCandles), 10) || 1);
    const finalMinCandlesLong = Math.max(1, parseInt(String(minCandlesForLongLeg), 10) || 20);
    const finalMinCandlesBlue = Math.max(1, parseInt(String(minCandlesForBlueLeg), 10) || 1);
    const finalAtrMult = Math.max(0.1, parseFloat(String(atrMultiplier)) || 1);
    const finalLongAtrMult = Math.max(0.1, parseFloat(String(longLegAtrMultiplier)) || 10);
    const finalBlueAtrMult = Math.max(0.1, parseFloat(String(blueLegAtrMultiplier)) || 0.1);
    const finalMaxBlue = Math.max(1, parseFloat(String(maxBlueLegPercent)) || 60);
    const finalMaxBreakout = Math.max(0.5, parseFloat(String(maxBreakoutAtrMultiplier)) || 5);
    const finalMaxCandles = Math.max(1, parseInt(String(maxCandlesToEnter), 10) || 35);

    onSave({
      atrPeriod: finalAtrPeriod,
      minCandles: finalMinCandles,
      minCandlesForLongLeg: finalMinCandlesLong,
      minCandlesForBlueLeg: finalMinCandlesBlue,
      atrMultiplier: finalAtrMult,
      longLegAtrMultiplier: finalLongAtrMult,
      blueLegAtrMultiplier: finalBlueAtrMult,
      maxBlueLegPercent: finalMaxBlue,
      maxBreakoutAtrMultiplier: finalMaxBreakout,
      maxCandlesToEnter: finalMaxCandles,
      maxPositionToRiskRatio: finalMaxRatio,
    });
    onClose();
  };

  const curRatioNum = Number(maxPositionToRiskRatio) || 300;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#141822] border border-[#2b3547] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#232c3d] bg-[#0f131c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">پیکربندی استراتژی و اندیکاتورها</h3>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                  تنظیمات پیشرفته
                </span>
              </div>
              <p className="text-[11px] text-gray-400">مدیریت حجم به ریسک، پارامترهای ATR و موج‌های زیگ‌زاگ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#232c3d] bg-[#121622] px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('risk')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-t-2 ${
              activeTab === 'risk'
                ? 'bg-[#181f2c] text-amber-400 border-amber-400'
                : 'text-gray-400 hover:text-gray-200 border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>مدیریت سرمایه و ریسک (Risk & Position)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zigzag')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-t-2 ${
              activeTab === 'zigzag'
                ? 'bg-[#181f2c] text-sky-400 border-sky-400'
                : 'text-gray-400 hover:text-gray-200 border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>پارامترهای زیگ‌زاگ و ATR</span>
          </button>
        </div>

        {/* Form Body with Smooth Scroll */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'risk' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Highlighted Parameter Card: Max Position-to-Risk Ratio */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#172132] to-[#131a26] border border-amber-500/40 shadow-lg shadow-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        حداکثر نسبت ارزش پوزیشن به ریسک (Max Position / Risk)
                      </label>
                      <p className="text-[11px] text-gray-300">کنترل لوریج ضمنی و جلوگیری از اورلوریج در استاپ‌های بسیار نزدیک</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/30">
                    سقف مجاز: {maxPositionToRiskRatio}×
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min={50}
                    max={1000}
                    step={50}
                    value={Number(maxPositionToRiskRatio) || 300}
                    onChange={(e) => setMaxPositionToRiskRatio(Number(e.target.value))}
                    className="flex-1 accent-amber-400 cursor-pointer h-2 bg-[#252f40] rounded-lg"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={10}
                      max={2000}
                      step={50}
                      value={maxPositionToRiskRatio}
                      onChange={(e) => setMaxPositionToRiskRatio(e.target.value)}
                      className="w-24 px-3 py-1.5 text-xs font-mono font-bold text-center text-amber-300 bg-[#0f131c] border border-amber-500/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-xs text-gray-400 font-mono">برابر</span>
                  </div>
                </div>

                {/* Visual calculation example card */}
                <div className="p-3 rounded-lg bg-[#0d1118]/80 border border-[#232c3d] text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>نحوه محاسبه و کاربرد:</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">
                    نسبت ارزش کل پوزیشن (Position Value) به بودجه ریسک (Risk Amount) معامله است:
                  </p>
                  <div className="p-2 rounded bg-[#161c28] border border-[#2b3548] font-mono text-center text-[11px] text-gray-200">
                    <span className="text-sky-300 font-bold">ارزش پوزیشن: $10,000</span>
                    {' ÷ '}
                    <span className="text-rose-400 font-bold">ریسک: $100</span>
                    {' = '}
                    <span className="text-emerald-400 font-bold">نسبت ۱۰۰</span>
                    {' '}
                    <span className={100 <= curRatioNum ? 'text-emerald-400' : 'text-rose-400'}>
                      {100 <= curRatioNum ? `(≤ ${curRatioNum} ✅ معامله تایید و انجام می‌شود)` : `(> ${curRatioNum} ❌ معامله رد می‌شود)`}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    اگر استاپ‌لاس کندل به قیمت ورود فوق‌العاده نزدیک باشد، فرمول سایزینگ حجم بسیار عظیمی تولید می‌کند. این سقف ایمنی مانع از ورود به این پوزیشن‌های پرریسک می‌شود.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'zigzag' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
              {/* 1. Period ATR */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-amber-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Period ATR (دوره زمانی)
                  </label>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">{atrPeriod} کندل</span>
                </div>
                <div className="flex items-center gap-2">
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
                    value={atrPeriod}
                    onChange={(e) => setAtrPeriod(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-amber-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 2. Min Candle */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-sky-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Min Candle (حداقل فاصله کندل)
                  </label>
                  <span className="text-[11px] font-mono text-sky-400 font-bold">{minCandles} کندل</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={Number(minCandles) || 1}
                    onChange={(e) => setMinCandles(Number(e.target.value))}
                    className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={minCandles}
                    onChange={(e) => setMinCandles(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-sky-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 3. Min Candle for Long Leg */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    کندل لگ بلند (Long Leg)
                  </label>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">{minCandlesForLongLeg} کندل</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={Number(minCandlesForLongLeg) || 20}
                    onChange={(e) => setMinCandlesForLongLeg(Number(e.target.value))}
                    className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={minCandlesForLongLeg}
                    onChange={(e) => setMinCandlesForLongLeg(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-emerald-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 4. ATR Multiplier */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-purple-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    ضریب نوسان عادی (ATR Mult)
                  </label>
                  <span className="text-[11px] font-mono text-purple-400 font-bold">{atrMultiplier}× ATR</span>
                </div>
                <div className="flex items-center gap-2">
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
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-purple-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 5. Long Leg ATR Multiplier */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-rose-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    ضریب لگ بزرگ (Giant Leg)
                  </label>
                  <span className="text-[11px] font-mono text-rose-400 font-bold">{longLegAtrMultiplier}× ATR</span>
                </div>
                <div className="flex items-center gap-2">
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
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-rose-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 5b. Min Candle for CD & EF Blue Legs */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-cyan-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    کندل لگ CD, EF (حداقل تعداد کندل)
                  </label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">{minCandlesForBlueLeg} کندل</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={Number(minCandlesForBlueLeg) || 1}
                    onChange={(e) => setMinCandlesForBlueLeg(Number(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={minCandlesForBlueLeg}
                    onChange={(e) => setMinCandlesForBlueLeg(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-cyan-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 5c. ATR Multiplier for CD & EF Blue Legs */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-blue-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    ضریب ATR لگ CD, EF
                  </label>
                  <span className="text-[11px] font-mono text-blue-400 font-bold">{blueLegAtrMultiplier}× ATR</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.5}
                    max={20}
                    step={0.25}
                    value={Number(blueLegAtrMultiplier) || 0.5}
                    onChange={(e) => setBlueLegAtrMultiplier(Number(e.target.value))}
                    className="flex-1 accent-blue-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                  />
                  <input
                    type="number"
                    min={0.1}
                    max={50}
                    step="any"
                    value={blueLegAtrMultiplier}
                    onChange={(e) => setBlueLegAtrMultiplier(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-blue-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 6. Blue Leg Max % Ratio */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-cyan-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    سقف اندازه لگ آبی (Blue Leg %)
                  </label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">{maxBlueLegPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
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
                    value={maxBlueLegPercent}
                    onChange={(e) => setMaxBlueLegPercent(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-cyan-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 7. Max Breakout Penetration ATR */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-indigo-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    سقف نفوذ شکست انتهای لگ (Breakout ATR)
                  </label>
                  <span className="text-[11px] font-mono text-indigo-400 font-bold">{maxBreakoutAtrMultiplier}× ATR</span>
                </div>
                <div className="flex items-center gap-2">
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
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-indigo-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>

              {/* 10. Max Candles To Enter */}
              <div className="p-3 rounded-xl bg-[#171d29] border border-[#283244] hover:border-cyan-500/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    سقف کندل ورود (Entry Window)
                  </label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    {maxCandlesToEnter} کندل
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mb-1.5 leading-relaxed">استراتژی ۱: مهلت ورود پس از تکمیل الگو تا شکست E | استراتژی ۲: حداکثر تعداد کندل مجاز از نقطه پیوت تا فعال‌شدن کندل ورود</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={Number(maxCandlesToEnter) || 35}
                    onChange={(e) => setMaxCandlesToEnter(Number(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-[#252f40] rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    value={maxCandlesToEnter}
                    onChange={(e) => setMaxCandlesToEnter(e.target.value)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center text-cyan-400 bg-[#10141c] border border-[#323d50] rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#232c3d]">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#252e3d] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی به مقادیر پیش‌فرض</span>
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
                <span>ذخیره و اعمال تنظیمات</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

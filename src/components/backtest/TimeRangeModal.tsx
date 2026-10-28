import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Sparkles,
  Check,
  AlertTriangle,
  Info,
  Layers,
  RotateCcw,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { Timeframe } from '../../types/crypto';

export interface TimeRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeframe: Timeframe;
  exchange: 'xt' | 'binance';
  initialStartTimeMs?: number;
  initialEndTimeMs?: number;
  onApply: (params: {
    startDate: string;
    endDate: string;
    startTimeMs: number;
    endTimeMs: number;
    estimatedCandles: number;
    label: string;
  }) => void;
  showToast?: (msg: string) => void;
}

interface PresetOption {
  key: string;
  label: string;
  days: number;
  hours?: number;
}

const PRESET_OPTIONS: PresetOption[] = [
  { key: '24h', label: '۲۴ ساعت گذشته', days: 1 },
  { key: '3d', label: '۳ روز گذشته', days: 3 },
  { key: '7d', label: '۷ روز گذشته', days: 7 },
  { key: '14d', label: '۱۴ روز گذشته', days: 14 },
  { key: '30d', label: '۳۰ روز گذشته (۱ ماه)', days: 30 },
  { key: '60d', label: '۶۰ روز گذشته (۲ ماه)', days: 60 },
  { key: '90d', label: '۹۰ روز گذشته (۳ ماه)', days: 90 },
  { key: '180d', label: '۶ ماه گذشته', days: 180 },
  { key: '365d', label: '۱ سال گذشته', days: 365 },
];

// Helper to convert timeframe string to minutes
function timeframeToMinutes(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 1;
    case '5m': return 5;
    case '15m': return 15;
    case '30m': return 30;
    case '1h': return 60;
    case '4h': return 240;
    case '1d': return 1440;
    case '1w': return 10080;
    default: return 15;
  }
}

// Convert Date to ISO string suitable for datetime-local input (YYYY-MM-DDTHH:mm)
function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const TimeRangeModal: React.FC<TimeRangeModalProps> = ({
  isOpen,
  onClose,
  timeframe,
  exchange,
  initialStartTimeMs,
  initialEndTimeMs,
  onApply,
  showToast = () => {},
}) => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const [selectedPreset, setSelectedPreset] = useState<string>('30d');
  const [startDateInput, setStartDateInput] = useState<string>(() => {
    const d = new Date(initialStartTimeMs || Date.now() - 30 * 24 * 60 * 60 * 1000);
    return toLocalDatetimeInput(d);
  });
  const [endDateInput, setEndDateInput] = useState<string>(() => {
    const d = new Date(initialEndTimeMs || Date.now());
    return toLocalDatetimeInput(d);
  });

  // Open native calendar picker safely
  const triggerNativePicker = (inputRef: React.RefObject<HTMLInputElement>) => {
    if (inputRef.current) {
      if ('showPicker' in inputRef.current && typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
          return;
        } catch {}
      }
      inputRef.current.focus();
    }
  };

  // Safe parsing of user input without aggressive jumping on partial edits
  const parsedStartMs = useMemo(() => {
    if (!startDateInput) return null;
    const t = new Date(startDateInput).getTime();
    return isNaN(t) ? null : t;
  }, [startDateInput]);

  const parsedEndMs = useMemo(() => {
    if (!endDateInput) return null;
    const t = new Date(endDateInput).getTime();
    return isNaN(t) ? null : t;
  }, [endDateInput]);

  const startMs = parsedStartMs ?? (Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endMs = parsedEndMs ?? Date.now();

  // Duration in hours/days and estimated candle calculations
  const durationInfo = useMemo(() => {
    const diffMs = Math.max(0, endMs - startMs);
    const totalMinutes = Math.floor(diffMs / (60 * 1000));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remHours = totalHours % 24;

    const tfMinutes = timeframeToMinutes(timeframe);
    const estimatedCandles = Math.floor(totalMinutes / tfMinutes);

    return {
      days,
      hours: remHours,
      totalHours,
      totalMinutes,
      estimatedCandles,
    };
  }, [startMs, endMs, timeframe]);

  // Single-request limit of exchange
  const singleBatchLimit = exchange === 'xt' ? 1000 : 1500;
  const isMultiBatch = durationInfo.estimatedCandles > singleBatchLimit;
  const batchCount = Math.max(1, Math.ceil(durationInfo.estimatedCandles / singleBatchLimit));
  const estimatedDelayPerBatchMs = exchange === 'xt' ? 100 : 80;

  // Sync when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialStartTimeMs && initialEndTimeMs) {
        setStartDateInput(toLocalDatetimeInput(new Date(initialStartTimeMs)));
        setEndDateInput(toLocalDatetimeInput(new Date(initialEndTimeMs)));
        // Check if matches an existing preset
        const diffDays = Math.round((initialEndTimeMs - initialStartTimeMs) / (24 * 60 * 60 * 1000));
        const matched = PRESET_OPTIONS.find((p) => p.days === diffDays);
        setSelectedPreset(matched ? matched.key : 'custom');
      }
    }
  }, [isOpen, initialStartTimeMs, initialEndTimeMs]);

  // Apply a preset
  const handleSelectPreset = (preset: PresetOption) => {
    setSelectedPreset(preset.key);
    const end = new Date();
    const start = new Date(end.getTime() - preset.days * 24 * 60 * 60 * 1000);
    setEndDateInput(toLocalDatetimeInput(end));
    setStartDateInput(toLocalDatetimeInput(start));
  };

  const handleSetEndToNow = () => {
    const now = new Date();
    setEndDateInput(toLocalDatetimeInput(now));
    setSelectedPreset('custom');
  };

  const handleCustomDateChange = () => {
    setSelectedPreset('custom');
  };

  const handleConfirm = () => {
    if (startMs >= endMs) {
      showToast('⚠️ تاریخ شروع باید قبل از تاریخ پایان باشد.');
      return;
    }

    let label = '';
    const preset = PRESET_OPTIONS.find((p) => p.key === selectedPreset);
    if (preset) {
      label = preset.label;
    } else {
      const s = new Date(startMs).toLocaleDateString('fa-IR');
      const e = new Date(endMs).toLocaleDateString('fa-IR');
      label = `${s} تا ${e}`;
    }

    onApply({
      startDate: startDateInput,
      endDate: endDateInput,
      startTimeMs: startMs,
      endTimeMs: endMs,
      estimatedCandles: durationInfo.estimatedCandles,
      label,
    });

    onClose();
    if (isMultiBatch) {
      showToast(`⚡ بازه «${label}» با پجینیشن (${batchCount} بسته) و تاخیر API اعمال شد.`);
    } else {
      showToast(`✅ بازه زمانی «${label}» با موفقیت برای بکتست اعمال شد.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0d121c] border border-[#233146] rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-gray-200 max-h-[92vh] flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2 flex-wrap">
                <span>انتخاب بازه زمانی و تقویم بکتست</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#1a2333] text-amber-300 border border-amber-500/30">
                  تایم‌فریم: {timeframe}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {exchange === 'xt' ? 'صرافی XT' : 'صرافی Binance'}
                </span>
              </h4>
              <p className="text-[11px] text-gray-400">
                تاریخ شروع و پایان مدنظر خود را انتخاب کنید. بدون محدودیت کندل با دانلود چندمرحله‌ای خودکار.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2 shrink-0">
          <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>بازه‌های زمانی سریع و آماده:</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {PRESET_OPTIONS.map((p) => {
              const isActive = selectedPreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border text-center ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#121824] border-[#222d3e] text-gray-300 hover:bg-[#182133] hover:border-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Calendar & Time Pickers */}
        <div className="bg-[#101520] p-3.5 rounded-2xl border border-[#202b3c] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>تنظیم تقویم، تاریخ و ساعت:</span>
            </label>
            <button
              type="button"
              onClick={handleSetEndToNow}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-[#1a2333] hover:bg-[#222e43] text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>تنظیم پایان روی الان</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Start Date & Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                  <span>از تاریخ و زمان (شروع):</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {parsedStartMs ? new Date(parsedStartMs).toLocaleDateString('fa-IR') : 'نامعتبر'}
                </span>
              </div>

              {/* LTR wrapper for datetime input to prevent RTL layout bugs */}
              <div
                dir="ltr"
                className="relative flex items-center bg-[#0a0d14] border border-[#2a384d] hover:border-amber-400/60 focus-within:border-amber-400 rounded-xl transition-all"
              >
                <input
                  ref={startDateRef}
                  type="datetime-local"
                  value={startDateInput}
                  onChange={(e) => {
                    setStartDateInput(e.target.value);
                    handleCustomDateChange();
                  }}
                  className="w-full px-3 py-2.5 bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => triggerNativePicker(startDateRef)}
                  title="باز کردن تقویم"
                  className="px-2.5 py-2 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 border-l border-[#1f283a]"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[10px] text-gray-500 flex items-center justify-between px-1">
                <span>زمان میلادی: {startDateInput ? startDateInput.replace('T', ' ') : '—'}</span>
                <span>شمسی: {parsedStartMs ? new Date(parsedStartMs).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
            </div>

            {/* End Date & Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                  <span>تا تاریخ و زمان (پایان):</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {parsedEndMs ? new Date(parsedEndMs).toLocaleDateString('fa-IR') : 'نامعتبر'}
                </span>
              </div>

              {/* LTR wrapper for datetime input to prevent RTL layout bugs */}
              <div
                dir="ltr"
                className="relative flex items-center bg-[#0a0d14] border border-[#2a384d] hover:border-cyan-400/60 focus-within:border-cyan-400 rounded-xl transition-all"
              >
                <input
                  ref={endDateRef}
                  type="datetime-local"
                  value={endDateInput}
                  onChange={(e) => {
                    setEndDateInput(e.target.value);
                    handleCustomDateChange();
                  }}
                  className="w-full px-3 py-2.5 bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => triggerNativePicker(endDateRef)}
                  title="باز کردن تقویم"
                  className="px-2.5 py-2 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 border-l border-[#1f283a]"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[10px] text-gray-500 flex items-center justify-between px-1">
                <span>زمان میلادی: {endDateInput ? endDateInput.replace('T', ' ') : '—'}</span>
                <span>شمسی: {parsedEndMs ? new Date(parsedEndMs).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calculation & Exchange Limit Summary Card */}
        <div className="bg-[#121927] p-3 rounded-2xl border border-[#253349] space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-[#0b1018] p-2.5 rounded-xl border border-[#1e293a]">
              <span className="text-[10px] text-gray-400 block mb-0.5">طول بازه انتخابی:</span>
              <span className="text-amber-300 font-bold font-mono text-xs">
                {durationInfo.days > 0 ? `${durationInfo.days} روز و ` : ''}{durationInfo.hours} ساعت
              </span>
            </div>

            <div className="bg-[#0b1018] p-2.5 rounded-xl border border-[#1e293a]">
              <span className="text-[10px] text-gray-400 block mb-0.5">تعداد کل کندل‌های بازه:</span>
              <span className="font-bold font-mono text-xs text-emerald-400">
                ~{durationInfo.estimatedCandles.toLocaleString('fa-IR')} کندل
              </span>
            </div>

            <div className="bg-[#0b1018] p-2.5 rounded-xl border border-[#1e293a] col-span-2 sm:col-span-1">
              <span className="text-[10px] text-gray-400 block mb-0.5">شیوه دریافت از صرافی:</span>
              <span className="text-cyan-300 font-bold font-mono text-xs flex items-center justify-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>{batchCount} مرحله پجینیشن</span>
              </span>
            </div>
          </div>

          {/* Automated Pagination with API Delay explanation */}
          {isMultiBatch ? (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                  <span>دانلود خودکار کل بازه با پجینیشن و API Delay هوشمند</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                    {batchCount} بسته متوالی
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                    تاخیر {estimatedDelayPerBatchMs}ms
                  </span>
                </div>
                <p className="text-gray-300 text-[10.5px] leading-relaxed">
                  چون طول بازه انتخابی (~{durationInfo.estimatedCandles.toLocaleString('fa-IR')} کندل) بیشتر از محدودیت تک‌درخواست صرافی ({singleBatchLimit.toLocaleString('fa-IR')} کندل) است، سیستم کل بازه را به صورت خودکار در {batchCount} مرحله با تاخیر کنترل‌شده (API Pacing Delay) دانلود می‌کند تا بدون کوچک‌ترین خطا یا مسدودی، کل بازه زمانی پوشش داده شود.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-[#0e1624] border border-[#213045] text-[11px] text-gray-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>دریافت مستقیم و سریع:</strong>
                <p className="text-gray-400 mt-0.5 text-[10.5px]">
                  این بازه در یک درخواست فوق سریع از صرافی {exchange.toUpperCase()} دریافت و مستقیماً روی سرور و پایگاه‌داده پردازش می‌شود.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1f283a] shrink-0">
          <div className="text-[11px] text-gray-400 font-mono">
            {new Date(startMs).toLocaleDateString('fa-IR')} ⬅️ {new Date(endMs).toLocaleDateString('fa-IR')}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#182030] hover:bg-[#222d42] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>تایید و اعمال بازه زمانی</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

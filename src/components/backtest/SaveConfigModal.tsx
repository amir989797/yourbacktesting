import React from 'react';
import { Save, X, Sliders, CheckCircle2, Loader2 } from 'lucide-react';

export interface SaveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  customConfigName: string;
  setCustomConfigName: (name: string) => void;
  isSaving: boolean;
  selectedStrategyId: string;
  timeframe: string;
  capital: number;
  riskPercent: number;
  entryCommissionPercent: number;
  exitCommissionPercent: number;
  optMaxRiskReward: number;
  optAtrPeriod: number;
  optAtrMultiplier: number;
  optMinCandles: number;
  optMinCandlesLong: number;
  optLongLegAtrMult: number;
  optMaxBlueLegPercent: number;
}

export const SaveConfigModal: React.FC<SaveConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customConfigName,
  setCustomConfigName,
  isSaving,
  selectedStrategyId,
  timeframe,
  capital,
  riskPercent,
  entryCommissionPercent,
  exitCommissionPercent,
  optMaxRiskReward,
  optAtrPeriod,
  optAtrMultiplier,
  optMinCandles,
  optMinCandlesLong,
  optLongLegAtrMult,
  optMaxBlueLegPercent,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1f283a] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                ذخیره کانفیگ پارامترهای تست در دیتابیس
              </h4>
              <p className="text-[11px] text-amber-300/80">
                فقط پارامترهای استراتژی و تست ذخیره می‌شوند (معاملات و نتایج ذخیره نمی‌شوند)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300 block">
              نام دلخواه کانفیگ (جهت فراخوانی و لود مجدد):
            </label>
            <input
              type="text"
              value={customConfigName}
              onChange={(e) => setCustomConfigName(e.target.value)}
              placeholder="مثال: کانفیگ تست استراتژی ۱ - تایم‌فریم ۵ دقیقه"
              className="w-full px-3.5 py-2.5 bg-[#141b27] border border-[#2d3a50] rounded-xl text-white text-xs font-sans focus:outline-none focus:border-amber-400 transition-colors"
              required
              autoFocus
            />
          </div>

          {/* خلاصه پارامترهای در حال ذخیره */}
          <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#222e42] space-y-2.5 text-xs">
            <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>پارامترهای موجود در این کانفیگ:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300 font-mono">
              <div>استراتژی: <strong className="text-white font-sans">{selectedStrategyId === 'strategy_1_e_breakout' ? 'استراتژی ۱' : 'استراتژی ۲'}</strong></div>
              <div>تایم‌فریم: <strong className="text-cyan-300">{timeframe}</strong></div>
              <div>سرمایه اولیه: <strong className="text-white">${capital.toLocaleString()}</strong></div>
              <div>درصد ریسک: <strong className="text-rose-400">{riskPercent}%</strong></div>
              <div>کارمزد ورود/خروج: <strong className="text-amber-300">{entryCommissionPercent}% / {exitCommissionPercent}%</strong></div>
              <div>حداکثر R:R: <strong className="text-emerald-300">{optMaxRiskReward}</strong></div>
              <div>دوره ATR: <strong className="text-amber-300">{optAtrPeriod}</strong></div>
              <div>ضریب ATR: <strong className="text-amber-300">{optAtrMultiplier}</strong></div>
              <div>حداقل کندل‌ها: <strong className="text-white">{optMinCandles}</strong></div>
              <div>کندل لگ بلند: <strong className="text-white">{optMinCandlesLong}</strong></div>
              <div>ضریب لگ بلند: <strong className="text-white">{optLongLegAtrMult}</strong></div>
              <div>سقف لگ آبی: <strong className="text-white">{optMaxBlueLegPercent}%</strong></div>
            </div>
            <div className="text-[10px] text-gray-400 border-t border-[#1e2838] pt-2 font-sans flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>هیچ معامله یا نتیجه سود/زیانی ذخیره نمی‌شود و صرفاً پارامترهای تنظیمی استراتژی ثبت می‌گردد.</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره کانفیگ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>ذخیره کانفیگ در دیتابیس</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React from 'react';
import { FolderOpen, X, Sliders, Loader2, Trash2 } from 'lucide-react';
import { TestParameterConfigRecord } from '../../services/firebase';

export interface LoadConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoadingConfigs: boolean;
  savedTestConfigs: TestParameterConfigRecord[];
  deletingConfigId: string | null;
  onApplyConfig: (config: TestParameterConfigRecord) => void;
  onDeleteConfig: (configId: string, e: React.MouseEvent) => void;
}

export const LoadConfigModal: React.FC<LoadConfigModalProps> = ({
  isOpen,
  onClose,
  isLoadingConfigs,
  savedTestConfigs,
  deletingConfigId,
  onApplyConfig,
  onDeleteConfig,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0f141f] border border-[#2b394f] rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-gray-200 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                فراخوانی و لود کانفیگ‌های تست از دیتابیس
              </h4>
              <p className="text-[11px] text-gray-400">
                لیست پارامترهای تست ذخیره‌شده جهت اعمال مستقیم بر روی سیستم
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

        {/* لیست کانفیگ‌ها */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoadingConfigs ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-gray-400">در حال دریافت کانفیگ‌های ذخیره‌شده از دیتابیس ابری...</p>
            </div>
          ) : savedTestConfigs.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#131824]/50 border border-dashed border-[#243044] rounded-2xl p-6">
              <Sliders className="w-10 h-10 text-gray-500 mx-auto" />
              <div className="text-sm font-bold text-gray-300">هنوز هیچ کانفیگ تستی در دیتابیس ذخیره نشده است</div>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                می‌توانید با دکمه «ذخیره کانفیگ»، پارامترهای فعلی استراتژی را با نام دلخواه در دیتابیس ذخیره کنید.
              </p>
            </div>
          ) : (
            savedTestConfigs.map((cfg) => {
              const isDeleting = deletingConfigId === cfg.id;
              const dateFormatted = cfg.createdAt
                ? new Date(cfg.createdAt).toLocaleDateString('fa-IR') + ' ' + new Date(cfg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={cfg.id}
                  className="p-4 rounded-2xl bg-[#131926] border border-[#243247] hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                        {cfg.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {cfg.timeframe || '5m'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a2336] text-amber-300 border border-[#2d3a50]">
                        {cfg.selectedStrategyId === 'strategy_1_e_breakout' ? 'استراتژی ۱' : 'استراتژی ۲'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400 flex-wrap">
                      <span>ریسک: <strong className="text-rose-400">{cfg.riskPercent}%</strong></span>
                      <span>•</span>
                      <span>دوره ATR: <strong className="text-amber-300">{cfg.optAtrPeriod}</strong></span>
                      <span>•</span>
                      <span>ضریب ATR: <strong className="text-amber-300">{cfg.optAtrMultiplier}</strong></span>
                      <span>•</span>
                      <span>حداقل کندل: <strong className="text-white">{cfg.optMinCandles}</strong></span>
                      <span>•</span>
                      <span>سرمایه: <strong className="text-white">${cfg.capital?.toLocaleString()}</strong></span>
                    </div>

                    <div className="text-[10px] text-gray-500 font-sans">
                      تاریخ ذخیره: {dateFormatted}
                    </div>
                  </div>

                  {/* دکمه‌های اکشن */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onApplyConfig(cfg)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      title="اعمال پارامترهای این کانفیگ بر روی سیستم"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>اعمال در سامانه</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => onDeleteConfig(cfg.id, e)}
                      disabled={isDeleting}
                      className="p-2 rounded-xl bg-[#1b2230] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2e394c] hover:border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      title="حذف از دیتابیس"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* فوتر مودال */}
        <div className="pt-3 border-t border-[#1f283a] flex items-center justify-between shrink-0 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>اتصال به دیتابیس ابری Firebase Firestore</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

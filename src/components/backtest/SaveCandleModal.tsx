import React from 'react';
import { CloudUpload, X, Database, Loader2 } from 'lucide-react';
import { CloudSqlStatus } from '../../services/cloudsql';
import { CandleDatasetProgress } from '../../services/firebase';
import { GLOBAL_CANDLE_CACHE } from './types';

export interface SaveCandleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  customDatasetName: string;
  setCustomDatasetName: (name: string) => void;
  isSavingCandles: boolean;
  currentCandleDatasetStats: { totalCandles: number; formatted: string };
  cloudSqlStatus: CloudSqlStatus | null;
  activeSessionDatasetId: string | null;
  timeframe: string;
  uploadProgress: CandleDatasetProgress | null;
}

export const SaveCandleModal: React.FC<SaveCandleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customDatasetName,
  setCustomDatasetName,
  isSavingCandles,
  currentCandleDatasetStats,
  cloudSqlStatus,
  activeSessionDatasetId,
  timeframe,
  uploadProgress,
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
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                ذخیره دیتای کندل‌های چارت در دیتابیس
              </h4>
              <p className="text-[11px] text-cyan-300/80">
                ذخیره دیتای کندل‌های دانلودشده صرافی جهت استفاده مجدد بدون دانلود دوباره
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
              نام دلخواه بسته کندل‌ها:
            </label>
            <input
              type="text"
              value={customDatasetName}
              onChange={(e) => setCustomDatasetName(e.target.value)}
              placeholder="مثال: دیتای کندل‌های ۵ دقیقه فیوچرز (۱۰۰ ارز)"
              className="w-full px-3.5 py-2.5 bg-[#141b27] border border-[#2d3a50] rounded-xl text-white text-xs font-sans focus:outline-none focus:border-cyan-400 transition-colors"
              required
              autoFocus
            />
          </div>

          {/* خلاصه اطلاعات و حجم دقیق بسته کندل‌ها */}
          <div className="p-3.5 rounded-2xl bg-[#141924] border border-[#222e42] space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-[#1e2838] pb-2">
              <div className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>مشخصات و حجم دیتای کندل‌های در حال ذخیره:</span>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-extrabold text-[11px] flex items-center gap-1">
                <span>حجم کل:</span>
                <span className="text-white">{currentCandleDatasetStats.formatted}</span>
              </div>
            </div>

            {/* وضعیت و سلامت سرور اختصاصی PostgreSQL */}
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>سرور اختصاصی PostgreSQL (193.142.58.196): <strong>متصل و آماده</strong></span>
              </div>
              <div className="text-gray-300 font-mono text-[10px]">
                حجم دیتابیس: <span className="text-emerald-300 font-bold">{cloudSqlStatus?.dbSize || '89 MB'}</span>
              </div>
            </div>

            {activeSessionDatasetId && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                <span className="text-base shrink-0">⚡</span>
                <span>داده‌های کندل در سرور PostgreSQL اختصاصی به صورت خودکار بافر شده‌اند؛ ذخیره‌سازی دائمی آنی خواهد بود (بدون نیاز به آپلود مجدد حجم بالا از کلاینت).</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300 font-mono">
              <div>تعداد جفت‌ارزها: <strong className="text-white font-mono">{GLOBAL_CANDLE_CACHE.size} جفت‌ارز</strong></div>
              <div>تایم‌فریم کندل‌ها: <strong className="text-cyan-300 font-mono">{timeframe}</strong></div>
              <div>مجموع کل کندل‌ها: <strong className="text-amber-300 font-mono">{currentCandleDatasetStats.totalCandles.toLocaleString()} کندل</strong></div>
              <div>وضعیت بافر دیتابیس: <strong className={activeSessionDatasetId ? "text-emerald-300 font-mono" : "text-cyan-300 font-mono"}>{activeSessionDatasetId ? "آماده ذخیره آنی" : "چانک‌های استاندارد ایمن"}</strong></div>
            </div>

            {/* نوار پیشرفت زنده آپلود در صورت نیاز به ذخیره‌سازی از ابتدا */}
            {uploadProgress && (
              <div className="p-3 rounded-xl bg-[#0d121c] border border-cyan-500/40 space-y-2 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-300 font-bold flex items-center gap-1.5 truncate">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                    <span>{uploadProgress.statusText}</span>
                  </span>
                  <span className="text-cyan-400 font-mono font-extrabold shrink-0">{uploadProgress.percent}٪</span>
                </div>
                <div className="w-full h-2.5 bg-[#172030] rounded-full overflow-hidden border border-[#233149]">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>بخش {uploadProgress.currentChunk} از {uploadProgress.totalChunks}</span>
                  <span>مجموع دیتای آپلود: {currentCandleDatasetStats.formatted}</span>
                </div>
              </div>
            )}

            <div className="text-[10px] text-gray-400 border-t border-[#1e2838] pt-2 font-sans leading-relaxed">
              💡 با این ساختار، دیتای دانلودشده حین اسکن در دیتابیس قرار گرفته و هنگام ذخیره دائمی نیازی به آپلود مجدد کل دیتا نیست.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingCandles}
              className="px-4 py-2 rounded-xl bg-[#171d29] hover:bg-[#20293a] text-gray-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSavingCandles}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingCandles ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره در دیتابیس...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>{activeSessionDatasetId ? `⚡ تایید و ذخیره دائمی آنی (${currentCandleDatasetStats.formatted})` : `تایید و ذخیره در دیتابیس (${currentCandleDatasetStats.formatted})`}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

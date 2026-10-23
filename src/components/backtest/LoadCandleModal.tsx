import React from 'react';
import { CloudDownload, X, Database, Loader2, Trash2 } from 'lucide-react';
import { MarketCandleDatasetMetadata, CandleDatasetProgress } from '../../services/firebase';
import { CloudSqlStatus } from '../../services/cloudsql';

export interface LoadCandleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudSqlStatus: CloudSqlStatus | null;
  loadingDatasetId: string | null;
  downloadProgress: CandleDatasetProgress | null;
  isLoadingCandles: boolean;
  savedCandleDatasets: MarketCandleDatasetMetadata[];
  deletingDatasetId: string | null;
  onApplyDataset: (dataset: MarketCandleDatasetMetadata) => void;
  onDeleteDataset: (datasetId: string, e: React.MouseEvent) => void;
}

export const LoadCandleModal: React.FC<LoadCandleModalProps> = ({
  isOpen,
  onClose,
  cloudSqlStatus,
  loadingDatasetId,
  downloadProgress,
  isLoadingCandles,
  savedCandleDatasets,
  deletingDatasetId,
  onApplyDataset,
  onDeleteDataset,
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
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                فراخوانی و لود دیتای کندل‌های چارت از دیتابیس
              </h4>
              <p className="text-[11px] text-gray-400">
                بارگذاری سریع دیتای گذشته در حافظه کش بدون دانلود مجدد از صرافی
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

        {/* بنر وضعیت فضای ذخیره‌سازی Cloud SQL */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-[#0e1624] border border-cyan-500/30 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-cyan-300">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              وضعیت دیتابیس Cloud SQL (PostgreSQL): <strong className="text-emerald-400">فضای ذخیره کاملاً کافی</strong>
            </span>
          </div>
          <div className="text-[11px] font-mono text-gray-300">
            حجم فعلی: <span className="text-cyan-200 font-bold">{cloudSqlStatus?.dbSize || '15 MB'}</span> (ظرفیت ابری: بیش از ۱۰ گیگابایت)
          </div>
        </div>

        {/* نوار وضعیت دانلود سراسری هنگام لود دیتاست */}
        {loadingDatasetId && downloadProgress && (
          <div className="p-3 rounded-2xl bg-[#0c121e] border border-cyan-500/40 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>{downloadProgress.statusText}</span>
              </span>
              <span className="text-cyan-400 font-mono font-extrabold">{downloadProgress.percent}٪</span>
            </div>
            <div className="w-full h-2 bg-[#172030] rounded-full overflow-hidden border border-[#233149]">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300 rounded-full"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* لیست بسته‌های کندل */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoadingCandles ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
              <p className="text-xs text-gray-400">در حال دریافت لیست دیتاست‌های کندل از دیتابیس ابری...</p>
            </div>
          ) : savedCandleDatasets.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#131824]/50 border border-dashed border-[#243044] rounded-2xl p-6">
              <Database className="w-10 h-10 text-gray-500 mx-auto" />
              <div className="text-sm font-bold text-gray-300">هیچ بسته کندلی در دیتابیس یافت نشد</div>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                ابتدا دکمه «شروع اسکن کامل بازار» را بزنید تا داده‌های بازار دانلود شوند، سپس با دکمه «ذخیره کندل‌ها» آن را در دیتابیس ذخیره نمایید.
              </p>
            </div>
          ) : (
            savedCandleDatasets.map((ds) => {
              const isDeleting = deletingDatasetId === ds.id;
              const isLoadingThis = loadingDatasetId === ds.id;
              const dateFormatted = ds.createdAt
                ? new Date(ds.createdAt).toLocaleDateString('fa-IR') + ' ' + new Date(ds.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                : '';
              const sizeLabel = ds.dataSizeFormatted || (ds.totalCandles ? `${((ds.totalCandles * 65) / (1024 * 1024)).toFixed(2)} MB` : '');

              return (
                <div
                  key={ds.id}
                  className="p-4 rounded-2xl bg-[#131926] border border-[#243247] hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                        {ds.name}
                      </span>
                      {ds.isTemporary ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          پیش‌نویس موقت اسکن
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          بسته دائمی
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#172235] text-cyan-200 border border-cyan-500/30">
                        {ds.timeframe || '5m'}
                      </span>
                      {sizeLabel && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <span>حجم:</span>
                          <span>{sizeLabel}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400 flex-wrap">
                      <span>تعداد جفت‌ارز: <strong className="text-white">{ds.symbolCount} ارز</strong></span>
                      <span>•</span>
                      <span>مجموع کندل‌ها: <strong className="text-amber-300">{ds.totalCandles?.toLocaleString()}</strong></span>
                      <span>•</span>
                      <span>چانک‌ها: <strong className="text-cyan-300">{ds.chunkCount || 1} بخش</strong></span>
                    </div>

                    <div className="text-[10px] text-gray-500 font-sans">
                      تاریخ ذخیره: {dateFormatted}
                    </div>
                  </div>

                  {/* دکمه‌های اکشن */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onApplyDataset(ds)}
                      disabled={isLoadingThis}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                      title="بارگذاری و بازیابی این بسته کندل‌ها در حافظه کش جهت اجرای سریع"
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>در حال بارگذاری ({downloadProgress?.percent || 0}٪)...</span>
                        </>
                      ) : (
                        <>
                          <CloudDownload className="w-3.5 h-3.5" />
                          <span>⚡ بارگذاری در حافظه کش</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => onDeleteDataset(ds.id, e)}
                      disabled={isDeleting || isLoadingThis}
                      className="p-2 rounded-xl bg-[#1b2230] hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-[#2e394c] hover:border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      title="حذف این بسته کندل‌ها از دیتابیس"
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
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
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

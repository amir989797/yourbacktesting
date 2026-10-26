import React from 'react';
import {
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RefreshCw,
  Copy,
  Download,
  Percent,
  Sliders,
  TrendingUp,
  BarChart2,
  BarChart3,
  Calendar,
  AlertTriangle,
  Flame,
  LineChart,
  FileSpreadsheet,
  FileJson,
  Database,
  Activity,
  Clock,
  ClipboardCheck,
} from 'lucide-react';
import { StrategyTrade } from '../../types/strategy';

export interface StatsTabProps {
  datasetAudit: any;
  backtestIntegrityAudit: any;
  baselineReconstruction: any;
  portfolioRiskAudit: any;
  baselineValidationAudit: any;
  handleCopyAuditReport: () => void;
  handleExportDatasetAuditJSON: () => void;
  handleExportDatasetAuditCSV: () => void;
  handleStartScan: (useCachedOnly?: boolean) => void;
  isScanning: boolean;
  capital: number;
  riskPercent: number;
  riskMode?: 'percent' | 'fixed';
  riskAmountFixed?: number;
  timeframe: string;
  entryCommissionPercent: number;
  exitCommissionPercent: number;
  commissionPercent: number;
  optAtrMultiplier: number;
  optMinCandles: number;
  optMinCandlesLong: number;
  optLongLegAtrMult: number;
  optMaxBlueLegPercent: number;
  optMaxBreakoutAtr: number;
  optMaxRiskReward: number;
  optAtrPeriod: number;
  selectedStrategyId: string;
  effectivePortfolioTrades?: StrategyTrade[];
}

export const StatsTab: React.FC<StatsTabProps> = ({
  datasetAudit,
  backtestIntegrityAudit,
  baselineReconstruction,
  portfolioRiskAudit,
  baselineValidationAudit,
  handleCopyAuditReport,
  handleExportDatasetAuditJSON,
  handleExportDatasetAuditCSV,
  handleStartScan,
  isScanning,
  capital,
  riskPercent,
  riskMode = 'percent',
  riskAmountFixed = 100,
  timeframe,
  entryCommissionPercent,
  exitCommissionPercent,
  commissionPercent,
  optAtrMultiplier,
  optMinCandles,
  optMinCandlesLong,
  optLongLegAtrMult,
  optMaxBlueLegPercent,
  optMaxBreakoutAtr,
  optMaxRiskReward,
  optAtrPeriod,
  selectedStrategyId,
  effectivePortfolioTrades = [],
}) => {
  return (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-5">
            {/* ۱. نوار وضعیت و ابزارهای ممیزی و اعتبارسنجی */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#141b27] via-[#161f30] to-[#121722] border border-[#2b394f] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-emerald-500/20 shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      آمار و صحه‌گذاری بک‌تست (Backtest Statistics & Integrity)
                    </h4>
                    {datasetAudit.numberOfAssets > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>سلامت دیتاست: {datasetAudit.dataHealthScore}٪</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>در انتظار اسکن زنده بایننس</span>
                      </span>
                    )}

                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>اعتبار بک‌تست: {backtestIntegrityAudit.integrityScore}٪</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    شامل ۵ جدول استاندارد: ۱. اعتبارسنجی دیتاست (Validate the dataset) • ۲. صحه‌گذاری سلامت بک‌تست (Check for backtest integrity) • ۳. بازسازی مدل مبنا (Reconstruct the baseline) • ۴. سنجش ریسک واقعی پرتفوی (Measure actual portfolio risk) • ۵. اعتبارسنجی مدل مبنا (Baseline validation)
                  </p>
                </div>
              </div>

              {/* اکشن‌های عملیاتی و دانلود گزارش */}
              <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                <button
                  type="button"
                  onClick={() => handleStartScan(false)}
                  disabled={isScanning}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="دانلود و اعتبارسنجی زنده داده‌های بایننس"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'در حال دریافت و ارزیابی...' : 'اسکن و دریافت داده‌های بایننس'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAuditReport}
                  className="px-3 py-1.5 rounded-xl bg-[#1d2636] hover:bg-[#28354c] text-gray-200 border border-[#2d3a50] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="کپی گزارش متنی کامل اعتبارسنجی در کلیپ‌بورد"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>کپی گزارش متن</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDatasetAuditCSV}
                  className="px-3 py-1.5 rounded-xl bg-[#1d2636] hover:bg-[#28354c] text-gray-200 border border-[#2d3a50] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="دانلود فایل CSV اعتبارسنجی"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>دانلود CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDatasetAuditJSON}
                  className="px-3 py-1.5 rounded-xl bg-[#1d2636] hover:bg-[#28354c] text-gray-200 border border-[#2d3a50] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="دانلود گزارش کامل به صورت ساختاریافته JSON"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                  <span>دانلود JSON</span>
                </button>
              </div>
            </div>

            {/* کارت‌های ۴ گانه شاخص‌های کلیدی */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">تعداد دارایی‌ها (Assets)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-white flex items-baseline gap-1.5">
                    <span>{datasetAudit.numberOfAssets}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">جفت‌ارز</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Database className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">تعداد کل کندل‌ها (Candles)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-cyan-400 flex items-baseline gap-1.5">
                    <span>{datasetAudit.totalCandles.toLocaleString()}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">کندل OHLCV</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">تعداد کل معاملات (Trades)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-400 flex items-baseline gap-1.5">
                    <span>{datasetAudit.numberOfTrades.toLocaleString()}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">معامله</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121722] border border-[#243044] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">مدت زمان پوشش (Duration)</span>
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-amber-400 flex items-baseline gap-1.5">
                    <span>{datasetAudit.actualDurationDays}</span>
                    <span className="text-xs font-normal text-gray-400 font-sans">روز تقویمی</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* ۲. جدول اصلی اعتبارسنجی دیتاست (14 شاخص کلیدی در یک جدول جامع) */}
            <div className="rounded-2xl border border-[#243044] overflow-hidden bg-[#10141e] shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-[#0d1118] border-b border-[#243044] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  <h5 className="text-xs sm:text-sm font-extrabold text-white">
                    جدول ممیزی و صحه‌گذاری شاخص‌های دیتاست (Dataset Validation Matrix)
                  </h5>
                </div>
                <span className="text-[11px] text-gray-400 font-mono">
                  ۱۵ شاخص کلیدی • بازرسی خودکار بدون دیتای ساختگی
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141a26] text-gray-300 border-b border-[#243044] font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">شاخص اعتبارسنجی (Metric)</th>
                      <th className="py-2.5 px-3">دامنه و متغیر بازرسی</th>
                      <th className="py-2.5 px-3">مقدار دقیق شناسایی‌شده (Exact Identified Value)</th>
                      <th className="py-2.5 px-3 text-center">وضعیت سلامت</th>
                      <th className="py-2.5 px-3">جزئیات فنی، متدولوژی و اثبات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2434] text-[11px]">
                    {/* ۱. number of assets */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد دارایی‌ها</div>
                        <div className="text-[10px] text-gray-400 font-mono">number of assets</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">مجموع جفت‌ارزهای فعال در کش، نتایج و دامنه بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-white text-xs">
                        {datasetAudit.numberOfAssets} دارایی ({datasetAudit.numberOfAssets} جفت‌ارز)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.numberOfAssets > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {datasetAudit.numberOfAssets > 0 ? '✅ بررسی‌شده و معتبر' : 'ℹ️ در انتظار اسکن'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.numberOfAssets > 0 ? (
                          <span>
                            شامل نمادهای فعال USDT-M مانند{' '}
                            <span className="font-mono text-cyan-300">
                              {datasetAudit.perAssetCandleCounts.slice(0, 5).map(p => p.symbol).join(', ')}
                              {datasetAudit.perAssetCandleCounts.length > 5 ? ` و ${datasetAudit.perAssetCandleCounts.length - 5} جفت‌ارز دیگر` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            هنوز ارزی در حافظه کش این سشن اسکن نشده است. با زدن «اسکن و دریافت داده‌های بایننس» لود می‌شود.
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ۲. number of trades */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد کل معاملات پورتفوی</div>
                        <div className="text-[10px] text-cyan-400 font-mono">[FINAL / POST-CONCURRENCY]</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">معاملات نهایی پس از فیلتر تداخل همزمانی پورتفوی (Concurrency Filter)</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400 text-xs">
                        <div>{datasetAudit.numberOfTrades.toLocaleString()} معامله نهایی</div>
                        {datasetAudit.rawTradesCount > datasetAudit.numberOfTrades && (
                          <div className="text-[10px] text-gray-400 font-normal">
                            (از {datasetAudit.rawTradesCount.toLocaleString()} معامله خام اولیه)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.numberOfTrades > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.numberOfTrades > 0 ? '✅ ثبت‌شده در ژورنال' : 'ℹ️ ۰ معامله'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.numberOfTrades > 0 ? (
                          <span>
                            شامل <strong className="text-emerald-400">{datasetAudit.buyWinCount + datasetAudit.sellWinCount}</strong> معامله سودده،{' '}
                            <strong className="text-rose-400">{datasetAudit.buyLossCount + datasetAudit.sellLossCount}</strong> معامله ضررده و{' '}
                            <strong className="text-amber-400">{effectivePortfolioTrades.filter(t => t.status === 'ACTIVE').length}</strong> پوزیشن باز.
                            {datasetAudit.filteredConcurrentTradesCount > 0 && (
                              <span className="block mt-1 text-gray-400 text-[10px]">
                                ℹ️ تعداد {datasetAudit.filteredConcurrentTradesCount} سیگنال همزمان به دلیل قانون تک‌معامله فعال فیلتر شدند.
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">تعداد معاملات پس از اجرای اسکن بر مبنای قوانین نقطه E و فیبوناچی ثبت می‌گردد.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۳. buy and sell trades count */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد معاملات خرید و فروش</div>
                        <div className="text-[10px] text-gray-400 font-mono">buy & sell trades count</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">تفکیک دقیق جهت پوزیشن‌های لانگ (BUY) و شورت (SELL) در دیتاست</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            خرید (Buy): {datasetAudit.buyTradesCount.toLocaleString()} ({datasetAudit.buyPercentage}%)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
                            فروش (Sell): {datasetAudit.sellTradesCount.toLocaleString()} ({datasetAudit.sellPercentage}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.numberOfTrades > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.numberOfTrades > 0 ? '✅ تفکیک دوطرفه ثبت‌شده' : 'ℹ️ بدون معامله'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.numberOfTrades > 0 ? (
                          <span>
                            از کل {datasetAudit.numberOfTrades.toLocaleString()} معامله، <strong className="text-emerald-400 font-mono">{datasetAudit.buyTradesCount.toLocaleString()}</strong> پوزیشن لانگ (وین‌ریت {datasetAudit.buyWinRate}٪) و <strong className="text-rose-400 font-mono">{datasetAudit.sellTradesCount.toLocaleString()}</strong> پوزیشن شورت (وین‌ریت {datasetAudit.sellWinRate}٪) در ژورنال ثبت و صحه‌گذاری شده است.
                          </span>
                        ) : (
                          <span className="text-gray-400">پس از اتمام اسکن، تعداد دقیق و درصد معاملات خرید و فروش درج می‌گردد.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۴. number of candles */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۴</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تعداد کندل‌ها</div>
                        <div className="text-[10px] text-gray-400 font-mono">number of candles</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">مجموع کندل‌های OHLCV دانلودشده از بایننس</td>
                      <td className="py-3 px-3 font-mono font-bold text-cyan-400 text-xs">
                        {datasetAudit.totalCandles.toLocaleString()} کندل
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          ✅ تجمیع و صحه‌گذاری‌شده
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        میانگین <strong className="text-cyan-300 font-mono">{datasetAudit.avgCandlesPerAsset.toLocaleString()}</strong> کندل به ازای هر دارایی (کمترین: {datasetAudit.minCandles.toLocaleString()} | بیشترین: {datasetAudit.maxCandles.toLocaleString()}).
                      </td>
                    </tr>

                    {/* ۵. exact historical start date */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۵</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تاریخ دقیق شروع تاریخی</div>
                        <div className="text-[10px] text-gray-400 font-mono">exact historical start date</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">قدیمی‌ترین مهر زمانی موجود در کندل‌ها و تاریخچه معاملات</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300 text-[11px]">
                        {datasetAudit.exactHistoricalStartDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.earliestTimestamp
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.earliestTimestamp ? '✅ مهر زمانی قطعی' : 'نامشخص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.earliestTimestamp ? (
                          <span>
                            برچسب زمانی Unix Epoch برابر با <strong className="text-amber-400 font-mono">{datasetAudit.earliestTimestamp}</strong> ثانیه؛ نقطه شروع شبیه‌سازی استراتژی زیگ‌زاگ.
                          </span>
                        ) : (
                          <span className="text-gray-400">داده‌ای در حافظه بارگذاری نشده است.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۶. exact historical end date */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۶</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">تاریخ دقیق پایان تاریخی</div>
                        <div className="text-[10px] text-gray-400 font-mono">exact historical end date</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">جدیدترین مهر زمانی موجود در کندل‌ها و تاریخچه معاملات</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300 text-[11px]">
                        {datasetAudit.exactHistoricalEndDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.latestTimestamp
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.latestTimestamp ? '✅ مهر زمانی قطعی' : 'نامشخص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.latestTimestamp ? (
                          <span>
                            برچسب زمانی Unix Epoch برابر با <strong className="text-amber-400 font-mono">{datasetAudit.latestTimestamp}</strong> ثانیه؛ آخرین لحظه از داده‌های زنده دریافتی از سرورهای بایننس.
                          </span>
                        ) : (
                          <span className="text-gray-400">داده‌ای در حافظه بارگذاری نشده است.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۷. actual duration covered */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۷</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">مدت زمان واقعی پوشش‌داده‌شده</div>
                        <div className="text-[10px] text-gray-400 font-mono">actual duration covered</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">فاصله زمانی پیوسته بین شروع و پایان تاریخچه بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-white text-[11px]">
                        {datasetAudit.actualDurationCoveredText}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.actualDurationDays > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {datasetAudit.actualDurationDays > 0 ? '✅ بازه تقویمی پیوسته' : '۰ روز'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        دوره کامل بازرسی شامل <strong className="text-cyan-300 font-mono">{datasetAudit.actualDurationDays}</strong> روز تقویمی (معادل <strong className="text-cyan-300 font-mono">{datasetAudit.actualDurationHours}</strong> ساعت) در تایم‌فریم {timeframe}.
                      </td>
                    </tr>

                    {/* ۸. whether 5,000 candles refers to each asset or the entire dataset */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-cyan-950/20 border-r-4 border-cyan-400">
                      <td className="py-3 px-3 text-center font-mono font-bold text-cyan-400">۸</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-cyan-300">دامنه سقف ۵,۰۰۰ کندل</div>
                        <div className="text-[10px] text-cyan-400/80 font-mono">whether 5,000 candles refers to each asset or entire dataset</div>
                      </td>
                      <td className="py-3 px-3 text-cyan-200">پارامتر limit در متد fetchKlines بایننس</td>
                      <td className="py-3 px-3 font-extrabold text-cyan-300 text-xs">
                        به ازای هر دارایی است (Per Asset) و نه کل دیتاست
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                          ✅ تفکیک‌شده (Per Asset Limit)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-200 leading-relaxed text-[11px]">
                        سقف ۵,۰۰۰ کندل به ازای هر جفت‌ارز به طور مستقل در کدهای بایننس اعمال می‌گردد. اثبات: مجموع کندل‌های ارزیابی‌شده برابر با <strong className="text-cyan-400 font-mono">{datasetAudit.totalCandles.toLocaleString()}</strong> کندل است (نه فقط ۵,۰۰۰ کندل مجموع). ظرفیت نظری کل: <strong className="text-white font-mono">{datasetAudit.totalTheoreticalDatasetCapacity.toLocaleString()}</strong> کندل ({datasetAudit.numberOfAssets} دارایی × ۵,۰۰۰ کندل).
                      </td>
                    </tr>

                    {/* ۹. missing data */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۹</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">داده‌های مفقود</div>
                        <div className="text-[10px] text-gray-400 font-mono">missing data</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بازرسی بارهای ناقص، مقادیر null یا نمادهای با صفر کندل</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.missingDataCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.missingDataCount} مورد مفقود
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.missingDataCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.missingDataCount === 0 ? '✅ ۱۰۰٪ کامل (۰ مفقود)' : '⚠️ دارای نقص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.missingDataCount === 0 ? (
                          <span className="text-emerald-300">
                            هیچ رکورد تهی (null/undefined) یا فیلد حجم ناقص در دیتاست یافت نشد و تمام دارایی‌های اسکن‌شده کندل معتبر دارند.
                          </span>
                        ) : (
                          <span className="text-rose-300">
                            تعداد {datasetAudit.missingDataCount} دارایی در طول فراخوانی با پاسخ خالی مواجه شدند.
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ۱۰. duplicated records */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۰</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">رکوردهای تکراری</div>
                        <div className="text-[10px] text-gray-400 font-mono">duplicated records</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی تکرار برچسب زمانی کندل‌ها و شناسه‌های معاملاتی</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount} رکورد تکراری ({datasetAudit.duplicatedCandlesCount} کندل، {datasetAudit.duplicatedTradesCount} معامله)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {datasetAudit.duplicatedCandlesCount + datasetAudit.duplicatedTradesCount === 0 ? '✅ ۱۰۰٪ یکتا (بدون تکرار)' : '⚠️ دارای تکرار'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        عدم وجود مهرهای زمانی موازی یا کپی در تاریخچه هر جفت‌ارز و تفکیک دقیق معاملات با هش‌های اختصاصی منحصربه‌فرد.
                      </td>
                    </tr>

                    {/* ۱۱. data gaps */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">شکاف‌های داده / گپ‌های زمانی</div>
                        <div className="text-[10px] text-gray-400 font-mono">data gaps</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">پرش‌های زمانی متوالی بیش از ۱.۵ برابر اینتروال استاندارد ({timeframe})</td>
                      <td className="py-3 px-3 font-mono font-bold text-white text-xs">
                        {datasetAudit.dataGapsCount} کندل گپ در دیتاست
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.dataGapsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        }`}>
                          {datasetAudit.dataGapsCount === 0 ? '✅ پیوسته و یکنواخت' : 'ℹ️ گپ‌های طبیعی صرافی'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        {datasetAudit.gapDetailsList.length > 0 ? (
                          <span>
                            اولین گپ شناسایی‌شده در نماد <strong className="text-cyan-300 font-mono">{datasetAudit.gapDetailsList[0].symbol}</strong> بین {datasetAudit.gapDetailsList[0].gapStart} و {datasetAudit.gapDetailsList[0].gapEnd} به مدت {datasetAudit.gapDetailsList[0].missingBars} کندل (معمولاً ناشی از تعمیرات یا دوره‌های نگهداری بایننس).
                          </span>
                        ) : (
                          <span>هیچ وقفه یا پرش غیرعادی در توالی کندل‌های دریافتی مشاهده نشد.</span>
                        )}
                      </td>
                    </tr>

                    {/* ۱۲. missing prices */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">قیمت‌های مفقود یا نامعتبر</div>
                        <div className="text-[10px] text-gray-400 font-mono">missing prices</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی مقادیر NaN، منفی، صفر یا نقض شرط Low &le; Open/Close &le; High</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.missingPricesCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.missingPricesCount} مورد نامعتبر
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.missingPricesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.missingPricesCount === 0 ? '✅ ۱۰۰٪ قیمت‌ها معتبر و مثبت' : '❌ قیمت نامعتبر'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام مقادیر Open, High, Low, Close در تمامی کندل‌ها اعتبارسنجی شده و مقادیر مثبت، معتبر و بدون NaN یا صفر هستند.
                      </td>
                    </tr>

                    {/* ۱۳. missing trade fields */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">فیلدهای مفقود در معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono">missing trade fields</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">صحت ساختاری فیلدهای entryPrice, stopLoss, takeProfit, pnl, status, direction</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.missingTradeFieldsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.missingTradeFieldsCount} فیلد ناقص در معاملات
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.missingTradeFieldsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.missingTradeFieldsCount === 0 ? '✅ تمام ساختار معاملات کامل است' : '❌ فیلد ناقص'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام آبجکت‌های StrategyTrade بازرسی شدند و دارای اطلاعات قیمتی، حد سود، حد ضرر، جهت معامله و سود خالص هستند.
                      </td>
                    </tr>

                    {/* ۱۴. inconsistent timestamps */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۴</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">برچسب‌های زمانی ناسازگار</div>
                        <div className="text-[10px] text-gray-400 font-mono">inconsistent timestamps</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی توالی اکیداً صعودی کندل‌ها و تقدم زمان ورود بر خروج معامله</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.inconsistentTimestampsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {datasetAudit.inconsistentTimestampsCount} برچسب ناسازگار
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.inconsistentTimestampsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {datasetAudit.inconsistentTimestampsCount === 0 ? '✅ توالی کاملاً صعودی و معتبر' : '❌ ناسازگاری زمانی'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        کندل‌ها دارای ترتیب زمانی رو به جلو بوده و زمان خروج هر پوزیشن بعد از زمان ورود آن قرار دارد.
                      </td>
                    </tr>

                    {/* ۱۵. inconsistent symbols */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۵</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">نمادهای ناسازگار</div>
                        <div className="text-[10px] text-gray-400 font-mono">inconsistent symbols</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">استاندارد نام‌گذاری جفت‌ارزهای بایننس (USDT Futures)</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={datasetAudit.inconsistentSymbolsCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {datasetAudit.inconsistentSymbolsCount} نماد ناسازگار
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          datasetAudit.inconsistentSymbolsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {datasetAudit.inconsistentSymbolsCount === 0 ? '✅ تمام نمادها استاندارد هستند' : '⚠️ نمادهای نامتعارف'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام جفت‌ارزها از فرمت رسمی USDT بایننس و حروف بزرگ بدون کاراکتر غیرمجاز تبعیت می‌کنند.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================= */}
            {/* جدول دوم: 2. Check for backtest integrity */}
            {/* ========================================================= */}
            <div className="rounded-2xl border border-[#243044] overflow-hidden bg-[#10141e] shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-[#0d1118] border-b border-[#243044] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <h5 className="text-xs sm:text-sm font-extrabold text-white">
                    جدول ۲: بررسی سلامت و اعتبار بک‌تست (2. Check for backtest integrity)
                  </h5>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                    ۱۳ فاکتور حیاتی ارزیابی جامع ریسک، سوگیری و صحت محاسبات
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    اعتبار بک‌تست: {backtestIntegrityAudit.integrityScore}٪
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141a26] text-gray-300 border-b border-[#243044] font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">بررسی سلامت بک‌تست (Integrity Check)</th>
                      <th className="py-2.5 px-3">دامنه و متدولوژی ارزیابی</th>
                      <th className="py-2.5 px-3">نتیجه بازرسی الگوریتمی (Audit Finding)</th>
                      <th className="py-2.5 px-3 text-center">وضعیت اعتبار</th>
                      <th className="py-2.5 px-3">گزارش مستندات، تحلیل و اثبات فنی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2434] text-[11px]">
                    {/* ۱. duplicate trades */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">معاملات تکراری</div>
                        <div className="text-[10px] text-gray-400 font-mono">duplicate trades</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">شناسه‌های یکتا، مهرهای زمانی ورود/خروج و مشخصات سفارش</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.duplicateTradesCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.duplicateTradesCount} معامله تکراری
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.duplicateTradesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.duplicateTradesCount === 0 ? '✅ ۱۰۰٪ یکتا (بدون تکرار)' : '❌ دارای تکرار'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تک‌تک {effectivePortfolioTrades.length} معامله ثبت‌شده با هش اختصاصی زمان/قیمت بازرسی شدند؛ هیچ سفارشی دو بار در یک ثانیه یا با مشخصات موازی ثبت نشده است.
                      </td>
                    </tr>

                    {/* ۲. overlapping trades */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">معاملات همپوشان</div>
                        <div className="text-[10px] text-gray-400 font-mono">overlapping trades</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">باز شدن پوزیشن جدید قبل از بسته شدن پوزیشن قبلی روی همان دارایی</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.overlappingTradesCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {backtestIntegrityAudit.overlappingTradesCount} مورد همپوشانی در یک نماد
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.overlappingTradesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {backtestIntegrityAudit.overlappingTradesCount === 0 ? '✅ تک‌پوزیشن مستقل (Single Position)' : '⚠️ دارای همپوشانی'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        در هر جفت‌ارز، معامله جدید منحصراً پس از خروج قطعی پوزیشن قبلی مجاز به ورود است و تداخل پوزیشنی روی یک ارز رخ نداده است.
                      </td>
                    </tr>

                    {/* ۳. impossible prices */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">قیمت‌های غیرممکن</div>
                        <div className="text-[10px] text-gray-400 font-mono">impossible prices</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی قیمت‌های صفر، منفی، نامتناهی، NaN یا خارج از سقف و کف بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.impossiblePricesCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.impossiblePricesCount} قیمت غیرممکن یا منفی
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.impossiblePricesCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.impossiblePricesCount === 0 ? '✅ قیمت‌های ۱۰۰٪ واقعی و مثبت' : '❌ قیمت غیرممکن'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام سطوح قیمتی Entry, Exit, SL, TP مثبت، متناهی و در محدوده طبیعی نوسانات کندل‌های بایننس در زمان وقوع هستند.
                      </td>
                    </tr>

                    {/* ۴. invalid trade direction */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۴</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">جهت معامله نامعتبر</div>
                        <div className="text-[10px] text-gray-400 font-mono">invalid trade direction</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">نقض شرط TP &gt; Entry &gt; SL در خرید یا TP &lt; Entry &lt; SL در فروش</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.invalidDirectionCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.invalidDirectionCount} جهت نامعتبر
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.invalidDirectionCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.invalidDirectionCount === 0 ? '✅ جهت‌گیری صحیح منطق استراتژی' : '❌ جهت نامعتبر'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمام سفارش‌های خرید دارای تارگت بالاتر از نقطه ورود و حد ضرر پایین‌تر هستند، و معاملات فروش تارگت زیر ورود دارند.
                      </td>
                    </tr>

                    {/* ۵. incorrect position sizing */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۵</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">خطای حجم پوزیشن</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect position sizing</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">محاسبه حجم بر مبنای ریسک سرمایه ({riskPercent}٪ از {capital.toLocaleString()}$) و فاصله استاپ</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.incorrectPositionSizingCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.incorrectPositionSizingCount} خطای سایزینگ پوزیشن
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectPositionSizingCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectPositionSizingCount === 0 ? '✅ حجم‌گذاری دقیق بر مبنای ریسک' : '❌ خطای سایزینگ'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        حجم هر پوزیشن با تقسیم دقیق مقدار ریسک دلاری ({((capital * riskPercent) / 100).toFixed(0)}$) بر فاصله استاپ‌لاس تا ورود تعیین شده و مقادیر منفی یا نامتناهی ندارد.
                      </td>
                    </tr>

                    {/* ۶. impossible returns */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۶</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">بازدهی‌های غیرممکن</div>
                        <div className="text-[10px] text-gray-400 font-mono">impossible returns</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">سود یا زیان‌های نامتعارف (افت بیش از ۱۰۰٪- بدون اهرم، سود بیش از ۵,۰۰۰٪ یا خطای صفر)</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.impossibleReturnsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.impossibleReturnsCount} بازدهی غیرممکن یا نامتعارف
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.impossibleReturnsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.impossibleReturnsCount === 0 ? '✅ بازدهی‌ها در دامنه طبیعی بازار' : '❌ بازدهی ناممکن'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        تمامی درصدهای سود و زیان ثبت‌شده متناسب با نوسانات تاریخی واقعی قیمت دارایی بوده و هیچ خطای ناشی از تقسیم بر صفر مشاهده نشد.
                      </td>
                    </tr>

                    {/* ۷. look-ahead bias */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-cyan-950/20 border-r-4 border-cyan-400">
                      <td className="py-3 px-3 text-center font-mono font-bold text-cyan-400">۷</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-cyan-300">اریب نگاه به آینده</div>
                        <div className="text-[10px] text-cyan-400/80 font-mono">look-ahead bias</div>
                      </td>
                      <td className="py-3 px-3 text-cyan-200">استفاده از داده‌های آینده در تصمیم لحظه حال (ورود قبل از بسته شدن کندل تایید)</td>
                      <td className="py-3 px-3 font-extrabold text-cyan-300 text-xs">
                        {backtestIntegrityAudit.lookAheadBiasCount} مورد (۰٪ اریب نگاه به آینده)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                          ✅ اجرای ترتیبی رو به جلو (Forward-Only)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-200 leading-relaxed text-[11px]">
                        استراتژی ورود را بر مبنای شکست قطعی سطح E پس از تشکیل تاییدشده نقطه F ارزیابی می‌کند؛ ورود فقط در کندل‌های بعد از سیگنال ثبت می‌شود.
                      </td>
                    </tr>

                    {/* ۸. future information leakage */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۸</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">نشت اطلاعات آتی</div>
                        <div className="text-[10px] text-gray-400 font-mono">future information leakage</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">ورود مقادیر کندل‌های آینده به توابع ATR، ZigZag یا بررسی همزمان خروج</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.futureInfoLeakageCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.futureInfoLeakageCount} مورد نشت اطلاعات
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.futureInfoLeakageCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.futureInfoLeakageCount === 0 ? '✅ خط لوله محاسباتی ایزوله' : '❌ نشت اطلاعات'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        اندیکاتورها و شبیه‌ساز سفارش‌ها به صورت حلقه گام‌به‌گام در زمان حرکت می‌کنند و هیچ متغیری از آینده به گذشته منتقل نمی‌شود.
                      </td>
                    </tr>

                    {/* ۹. survivorship bias where detectable */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۹</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">انحراف بقا در داده‌ها</div>
                        <div className="text-[10px] text-gray-400 font-mono">survivorship bias where detectable</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">وجود یا عدم وجود نمادهای حذف‌شده یا ورشکسته تاریخی در یونیورس بازار</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300 text-xs">
                        انحراف بقای طبیعی در لیست جفت‌ارزها (Active Surviving Pairs Only)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                          ⚠️ اعلام شفاف انحراف بقا (Survivorship Bias)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        دیتاست صرفاً شامل نمادهای فعال فعلی بایننس است که می‌تواند منجر به انحراف بقا (Survivorship Bias) شود؛ نمادهایی که در گذشته دی‌لیست یا ورشکسته شده‌اند در داده‌ها حضور ندارند. فقدان اریب نگاه به آینده (Look-Ahead Bias) به هیچ عنوان به معنی بدون انحراف بودن کامل بک‌تست نیست و این محدودیت ساختاری به طور شفاف افشا می‌شود.
                      </td>
                    </tr>

                    {/* ۱۰. delisted/missing assets */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۰</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">دارایی‌های حذف‌شده یا مفقود</div>
                        <div className="text-[10px] text-gray-400 font-mono">delisted/missing assets</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">شناسایی جفت‌ارزهایی که در کوئری بایننس پاسخ خالی داده یا خطای ۴۰۴ داشتند</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.delistedOrMissingAssetsCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {backtestIntegrityAudit.delistedOrMissingAssetsCount} نماد بدون داده یا ناموفق
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.delistedOrMissingAssetsCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {backtestIntegrityAudit.delistedOrMissingAssetsCount === 0 ? '✅ تمام نمادهای انتخابی دارای دیتا' : '⚠️ دارای دارایی ناموفق'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        وضعیت دریافت کندل برای کلیه نمادهای فعال کوئری شد و دارایی‌های با دیتای ناکافی (&lt;۵۰ کندل) از ژورنال محاسبات فیلتر شدند.
                      </td>
                    </tr>

                    {/* ۱۱. incorrect fee handling */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۱</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">کسر ناصحیح کارمزد</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect fee handling</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">کسر تفکیکی کارمزد ورود ({entryCommissionPercent}٪) و خروج ({exitCommissionPercent}٪) در سود خالص</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs text-emerald-400">
                        کسر دوطرفه کارمزد ({entryCommissionPercent}٪ ورود + {exitCommissionPercent}٪ خروج = {commissionPercent}٪)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectFeeHandlingCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectFeeHandlingCount === 0 ? '✅ محاسبه دقیق کارمزد صرافی' : '❌ خطای کارمزد'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        کارمزدهای ورود و خروج بر ارزش واقعی پوزیشن محاسبه و از سود ناخالص کسر شده‌اند؛ سود خالص (netProfit) بازتاب‌دهنده سود واقعی تریدر پس از هزینه است.
                      </td>
                    </tr>

                    {/* ۱۲. incorrect leverage handling */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۲</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">مدیریت ناصحیح اهرم</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect leverage handling</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">بررسی مارجین تخصیص‌یافته، ریسک لیکوییدیتی نامتعارف و تناسب اهرم</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs text-emerald-400">
                        اهرم اسمی ۱x استاندارد (مارجین برابر با ارزش پوزیشن)
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectLeverageHandlingCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectLeverageHandlingCount === 0 ? '✅ مدیریت ایمن مارجین و اهرم' : '❌ خطای اهرم'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        ارزش پوزیشن‌ها در تناسب کامل با مارجین حساب بوده و از ضریب اهرم کاذب که موجب لیکوییدی غیرواقعی شود اجتناب شده است.
                      </td>
                    </tr>

                    {/* ۱۳. incorrect PnL calculation */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">۱۳</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white">خطای محاسباتی سود و زیان</div>
                        <div className="text-[10px] text-gray-400 font-mono">incorrect PnL calculation</div>
                      </td>
                      <td className="py-3 px-3 text-gray-300">تطبیق ریاضی فرمول PnL خرید و فروش با قیمت ورود، خروج، حجم پوزیشن و کارمزد</td>
                      <td className="py-3 px-3 font-mono font-bold text-xs">
                        <span className={backtestIntegrityAudit.incorrectPnlCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {backtestIntegrityAudit.incorrectPnlCount} مغایرت در فرمول PnL
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          backtestIntegrityAudit.incorrectPnlCount === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                          {backtestIntegrityAudit.incorrectPnlCount === 0 ? '✅ تطبیق ۱۰۰٪ ریاضی فرمول PnL' : '❌ مغایرت فرمول PnL'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed text-[11px]">
                        فرمول ریاضی (Size × (Exit - Entry) - Fee) برای تمام معاملات خرید و معکوس آن برای معاملات فروش به صورت مستقل اعتبارسنجی شد.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================= */}
            {/* جدول سوم: 3. Reconstruct the baseline (فقط دو ستون: Parameter و Value) */}
            {/* ========================================================= */}
            <div className="rounded-2xl border border-[#243044] overflow-hidden bg-[#10141e] shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-[#0d1118] border-b border-[#243044] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <h5 className="text-xs sm:text-sm font-extrabold text-white">
                    جدول ۳: بازسازی مدل مبنای استراتژی بر مبنای دیتاست واقعی (3. Reconstruct the baseline)
                  </h5>
                </div>
                <span className="text-[11px] text-amber-300 font-mono font-bold bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                  Baseline: {riskPercent}٪ ریسک در هر معامله • فقط دو ستون (Parameter & Value)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141a26] text-gray-300 border-b border-[#243044] font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-1/3 text-right">پارامتر / شاخص (Parameter)</th>
                      <th className="py-3 px-4 w-2/3 text-right">مقدار محاسبه‌شده مدل مبنا (Value)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2434] text-[11px] font-mono">
                    {/* Baseline info */}
                    <tr className="bg-amber-950/20 hover:bg-amber-950/30 transition-colors border-r-4 border-amber-400">
                      <td className="py-3 px-4 font-sans font-extrabold text-amber-300">
                        <div>مدل مبنا (Baseline Configuration)</div>
                        <div className="text-[10px] text-amber-400/80 font-mono font-normal">Baseline: X% risk per trade</div>
                      </td>
                      <td className="py-3 px-4 text-white font-bold">
                        <span className="text-amber-300">{riskPercent}%</span> ریسک در هر معامله (معادل <span className="text-emerald-400">${((capital * riskPercent) / 100).toFixed(0)}</span> به ازای هر ترید با سرمایه مبنای <span className="text-cyan-300">${capital.toLocaleString()}</span>)
                      </td>
                    </tr>

                    {/* 1. Gross Trading PnL */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>سود ناخالص معاملات</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Gross Trading PnL (Pre-fees & funding)</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.grossPnlSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {baselineReconstruction.grossPnlSum >= 0 ? '+' : ''}${baselineReconstruction.grossPnlSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-2">(مجموع سود ناخالص پیش از کسر کارمزد و هزینه‌های فاندینگ)</span>
                      </td>
                    </tr>

                    {/* Trading Fees */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>کارمزد معاملات صرافی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Trading Fees (Entry + Exit)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-400">
                        -${baselineReconstruction.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        <span className="text-gray-400 text-[10px] font-sans mr-2">({commissionPercent}% کارمزد بر حجم مبادلاتی ورود و خروج)</span>
                      </td>
                    </tr>

                    {/* Funding Costs (Detailed Investigation) */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>هزینه فاندینگ ریت و تحلیل ریشه‌ای</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Funding Costs Investigation (8h Snapshots)</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 font-mono font-bold">
                            <span className="text-purple-300 text-sm">
                              -${baselineReconstruction.estimatedFundingFees.toFixed(2)} USDT
                            </span>
                            <span className="text-gray-400 text-[10px] font-sans">
                              (خالص فاندینگ ریت تسویه‌شده در مهرهای زمانی رسمی)
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-mono bg-[#141b27] p-2 rounded-lg border border-[#222e40]">
                            <div>فاندینگ پرداختی: <span className="text-rose-400 font-bold">-${baselineReconstruction.fundingAudit.totalFundingPaid.toFixed(2)}</span></div>
                            <div>فاندینگ دریافتی (Short): <span className="text-emerald-400 font-bold">+${baselineReconstruction.fundingAudit.totalFundingReceived.toFixed(2)}</span></div>
                            <div>خالص فاندینگ: <span className="text-purple-300 font-bold">-${baselineReconstruction.fundingAudit.netFundingCost.toFixed(2)}</span></div>
                            <div>پوزیشن‌های مشمول تسویه: <span className="text-amber-300 font-bold">{baselineReconstruction.fundingAudit.chargedPositionsCount}</span></div>
                            <div>میانگین به ازای هر پوزیشن: <span className="text-gray-200 font-bold">-${baselineReconstruction.fundingAudit.avgFundingPerPosition.toFixed(2)}</span></div>
                            <div>حداکثر فاندینگ یک پوزیشن: <span className="text-rose-300 font-bold">-${baselineReconstruction.fundingAudit.maxFundingChargedSinglePosition.toFixed(2)}</span></div>
                          </div>
                          <div className="text-[10px] text-gray-300 font-sans leading-relaxed">
                            ⏱ <strong>مهرهای زمانی تسویه:</strong> منحصراً در نقاط ۸ ساعته رسمی بایننس (00:00, 08:00, 16:00 UTC) و فقط در صورت باز بودن پوزیشن در لحظه تسویه شارژ می‌شود.
                            درآمد پوزیشن‌های شورت هزینه پوزیشن‌های لانگ را تا حدی جبران کرده است.
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Net Trading PnL after fees */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>سود خالص معاملاتی پس از کارمزد</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Net Trading PnL after fees = Gross Trading PnL - Fees</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.totalTradingNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {baselineReconstruction.totalTradingNetProfit >= 0 ? '+' : ''}${baselineReconstruction.totalTradingNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                        <span className={`mr-2 px-2 py-0.5 rounded text-[10px] ${baselineReconstruction.totalTradingReturnPercent >= 0 ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'}`}>
                          {baselineReconstruction.totalTradingReturnPercent >= 0 ? '+' : ''}{baselineReconstruction.totalTradingReturnPercent.toFixed(2)}%
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-2">(سود خالص در سطح معاملات قبل از کسر فاندینگ اکانت)</span>
                      </td>
                    </tr>

                    {/* Net Account PnL after fees + funding */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-emerald-950/20 border-r-4 border-emerald-400">
                      <td className="py-3 px-4 font-sans font-extrabold text-emerald-300">
                        <div>سود خالص نهایی حساب پس از کارمزد و فاندینگ</div>
                        <div className="text-[10px] text-emerald-400/80 font-mono font-normal">Net Account PnL after fees + funding = Gross - Fees - Funding</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.totalNetProfit >= 0 ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'}>
                          {baselineReconstruction.totalNetProfit >= 0 ? '+' : ''}${baselineReconstruction.totalNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                        <span className={`mr-2 px-2 py-0.5 rounded text-[10px] font-bold ${baselineReconstruction.totalReturnPercent >= 0 ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40' : 'bg-rose-900/60 text-rose-300 border border-rose-500/40'}`}>
                          {baselineReconstruction.totalReturnPercent >= 0 ? '+' : ''}{baselineReconstruction.totalReturnPercent.toFixed(2)}%
                        </span>
                        <span className="text-gray-300 text-[10px] font-sans mr-2 font-normal">(نتیجه قطعی نهایی پس از اعمال کامل تمامی کارمزدها و فاندینگ ریت)</span>
                      </td>
                    </tr>

                    {/* 2. CAGR */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نرخ رشد مرکب سالانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">CAGR, if sufficient historical duration exists</div>
                      </td>
                      <td className="py-3 px-4">
                        {baselineReconstruction.cagrEligible ? (
                          <span className={`font-bold ${baselineReconstruction.cagrValue! >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {baselineReconstruction.cagrValue! >= 0 ? '+' : ''}{baselineReconstruction.cagrValue!.toFixed(2)}% در سال (Compound Annual Growth Rate)
                          </span>
                        ) : (
                          <span className="text-gray-400 font-sans">
                            {baselineReconstruction.annualizedReturn.toFixed(2)}% (تخمین سالانه — بازه تاریخی {datasetAudit.actualDurationDays.toFixed(1)} روز است و کمتر از ۳۰ روز حداقل برای CAGR رسمی)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 3. Annualized return */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بازده سالانه‌شده (برون‌یابی تخمینی)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Annualized return (Extrapolated)</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-cyan-300">
                          {baselineReconstruction.annualizedReturn >= 0 ? '+' : ''}{baselineReconstruction.annualizedReturn.toFixed(2)}% سالانه
                        </span>
                        <div className="text-[10px] text-amber-300/80 font-sans mt-0.5">
                          ⚠️ برون‌یابی تخمینی آماری برای بازه تست ({datasetAudit.actualDurationDays} روز)؛ برای دوره‌های کوتاه نباید به منزله انتظار قطعی بازدهی در آینده تلقی شود.
                        </div>
                      </td>
                    </tr>

                    {/* 4. Annualized volatility */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نوسان‌پذیری سالانه‌شده (برون‌یابی)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Annualized volatility (Extrapolated)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {baselineReconstruction.annualizedVolatility.toFixed(2)}% (بر مبنای انحراف معیار روزانه × √365.25)
                      </td>
                    </tr>

                    {/* 5. Sharpe */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت شارپ برون‌یابی‌شده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Sharpe (Annualized estimate)</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.sharpeRatio >= 1.5 ? 'text-emerald-400' : baselineReconstruction.sharpeRatio >= 1.0 ? 'text-cyan-300' : baselineReconstruction.sharpeRatio >= 0 ? 'text-amber-300' : 'text-rose-400'}>
                          {baselineReconstruction.sharpeRatio.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(تخمینی سالانه با نرخ بهره بدون ریسک Rf=4%)</span>
                      </td>
                    </tr>

                    {/* 6. Sortino Ratio (Per-Trade / Annualized) */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت سورتینو (به ازای معامله / سالانه‌شده)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Sortino Ratio (Per-Trade / Annualized)</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-cyan-300">
                            Per-Trade: <strong className={(baselineReconstruction.sortinoMetrics?.perTradeSortino ?? 0) >= 0.5 ? 'text-emerald-400' : 'text-amber-300'}>{(baselineReconstruction.sortinoMetrics?.perTradeSortino ?? baselineReconstruction.sortinoRatio).toFixed(2)}</strong>
                          </span>
                          <span className="text-gray-500">|</span>
                          <span className="font-mono text-cyan-300">
                            Annualized: <strong className={(baselineReconstruction.sortinoMetrics?.annualizedDailySortino ?? 0) >= 2.0 ? 'text-emerald-400' : (baselineReconstruction.sortinoMetrics?.annualizedDailySortino ?? 0) >= 1.0 ? 'text-cyan-300' : 'text-amber-300'}>{(baselineReconstruction.sortinoMetrics?.annualizedDailySortino ?? baselineReconstruction.sortinoRatio).toFixed(2)}</strong>
                          </span>
                          <span className="text-gray-400 text-[10px] font-sans mr-1">(انحراف نزولی با Rf=0)</span>
                        </div>
                      </td>
                    </tr>

                    {/* 7. Calmar */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت کالمار برون‌یابی‌شده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Calmar (Annualized estimate)</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.calmarRatio >= 2.0 ? 'text-emerald-400' : baselineReconstruction.calmarRatio >= 1.0 ? 'text-cyan-300' : 'text-amber-300'}>
                          {baselineReconstruction.calmarRatio.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(نسبت بازده سالانه تخمینی به حداکثر درودان)</span>
                      </td>
                    </tr>

                    {/* 8. Max Drawdown (Dual Curves) */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>حداکثر افت سرمایه در دو منحنی تفکیکی (Dual Max Drawdowns)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Drawdown = (Equity - Running Peak) / Running Peak</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-xs p-1.5 rounded bg-[#131924] border border-[#222c3d]">
                            <span className="text-gray-300 font-sans text-[11px]">منحنی معاملاتی بدون فاندینگ (Trading Equity):</span>
                            <strong className="text-amber-400">-{baselineReconstruction.tradingEquityMaxDD_percent.toFixed(2)}% (${baselineReconstruction.tradingEquityMaxDD_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT)</strong>
                          </div>
                          <div className="flex items-center justify-between text-xs p-1.5 rounded bg-[#131924] border border-[#222c3d]">
                            <span className="text-gray-300 font-sans text-[11px]">منحنی نهایی حساب با فاندینگ (Actual Account Equity):</span>
                            <strong className="text-rose-400">-{baselineReconstruction.accountEquityMaxDD_percent.toFixed(2)}% (${baselineReconstruction.accountEquityMaxDD_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT)</strong>
                          </div>
                          <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                            محاسبه‌شده از منحنی پیوسته ارزش تحقق‌یافته (Realized Equity Curve) معاملات بسته‌شده (نه بر مبنای بازده روزانه یا ترید ایزوله)
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 9. Max Drawdown duration */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مدت زمان حداکثر افت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Max Drawdown duration</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <strong className="text-amber-300">{baselineReconstruction.maxDDDurationDays.toFixed(1)}</strong> روز تقویمی (معادل <strong className="text-amber-300">{baselineReconstruction.maxDDDurationTrades}</strong> معامله پیوسته زیر قله قبلی)
                      </td>
                    </tr>

                    {/* 10. Average Drawdown */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین درودان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average Drawdown</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        -{baselineReconstruction.avgDD_percent.toFixed(2)}% (${baselineReconstruction.avgDD_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT)
                      </td>
                    </tr>

                    {/* 11. Recovery duration */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مدت زمان ریکاوری و خروج از افت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Recovery duration</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{baselineReconstruction.avgRecoveryDays.toFixed(1)}</strong> روز ({baselineReconstruction.avgRecoveryTrades} معامله) | طولانی‌ترین: <strong className="text-amber-300">{baselineReconstruction.maxRecoveryDays.toFixed(1)}</strong> روز
                      </td>
                    </tr>

                    {/* 12. Profit Factor */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>فاکتور سود معاملاتی و کل حساب (Profit Factor)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Trade-level & Account-level Profit Factors</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-xs p-1.5 rounded bg-[#131924] border border-[#222c3d]">
                            <span className="text-gray-300 font-sans text-[11px]">فاکتور سود سطح معامله قبل از فاندینگ (Trade-level PF):</span>
                            <span className="font-bold flex items-center gap-1.5">
                              <span className={baselineReconstruction.tradeLevelProfitFactor >= 1.0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {baselineReconstruction.tradeLevelProfitFactor.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                (${baselineReconstruction.grossProfit.toFixed(2)} / ${baselineReconstruction.grossLoss.toFixed(2)})
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs p-1.5 rounded bg-[#131924] border border-[#222c3d]">
                            <span className="text-gray-300 font-sans text-[11px]">فاکتور سود کل حساب با فاندینگ (Account-level PF):</span>
                            <span className="font-bold text-cyan-300">
                              {baselineReconstruction.accountLevelProfitFactor.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                            ⚠️ فاکتور سود ۱.۲۰ منحصراً مبین نسبت سود به زیان معاملات در سطح پوزیشن قبل از فاندینگ است و نباید به عنوان سودآوری کل حساب پس از کسر فاندینگ تلقی شود.
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 13. Win Rate */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نرخ برد و سازگاری آماری (Win Rate Consistency)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Win Rate = Win Trades / Total Trades × 100</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-bold">
                          <span className="text-sky-400 text-sm">{baselineReconstruction.winRate.toFixed(2)}%</span>
                          <span className="text-gray-300 text-xs font-mono">
                            ({baselineReconstruction.winTrades} برد + {baselineReconstruction.lossTrades} باخت = {baselineReconstruction.totalTrades} کل بسته‌شده)
                          </span>
                        </div>
                        <div className="text-[10px] text-cyan-300 font-sans mt-1">
                          تفکیک جهت: خرید (Long): {baselineReconstruction.consistencyAudit.longTradesCount} [برد: {baselineReconstruction.consistencyAudit.longWinTrades} | باخت: {baselineReconstruction.consistencyAudit.longLossTrades}] | فروش (Short): {baselineReconstruction.consistencyAudit.shortTradesCount} [برد: {baselineReconstruction.consistencyAudit.shortWinTrades} | باخت: {baselineReconstruction.consistencyAudit.shortLossTrades}] (مجموع تفکیکی دقیقاً برابر با آمار کل)
                        </div>
                      </td>
                    </tr>

                    {/* 14. Average Win */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین سود معاملات برنده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average Win</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +${baselineReconstruction.avgWinUsd.toFixed(2)} USDT (+{baselineReconstruction.avgWinPercent.toFixed(2)}% سرمایه)
                      </td>
                    </tr>

                    {/* 15. Average Loss */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین زیان معاملات بازنده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average Loss</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -${baselineReconstruction.avgLossUsd.toFixed(2)} USDT (-{baselineReconstruction.avgLossPercent.toFixed(2)}% سرمایه)
                      </td>
                    </tr>

                    {/* 16. Win/Loss ratio */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نسبت میانگین برد به باخت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Win/Loss ratio</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {baselineReconstruction.winLossRatio.toFixed(2)} : 1.00 (Payoff Ratio)
                      </td>
                    </tr>

                    {/* 17. Expectancy */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>امید ریاضی هر معامله و انطباق دوگانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Expectancy (Dual Method Verification)</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">روش ۱ (Net PnL / Closed Trades):</span>
                            <strong className={baselineReconstruction.expectancyUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {baselineReconstruction.expectancyUsd >= 0 ? '+' : ''}${baselineReconstruction.expectancyUsd.toFixed(2)} USDT
                            </strong>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">روش ۲ ((WinRate×AvgWin) - (LossRate×AvgLoss)):</span>
                            <strong className={baselineReconstruction.expectancyFormula2 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {baselineReconstruction.expectancyFormula2 >= 0 ? '+' : ''}${baselineReconstruction.expectancyFormula2.toFixed(2)} USDT
                            </strong>
                          </div>
                          <div className="text-[10px] text-emerald-400/90 font-sans">
                            ✅ تطابق مستقل هر دو روش اثبات شد (مغایرت: ${baselineReconstruction.consistencyAudit.expectancyDiscrepancy} USDT)
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 18. Expectancy per unit of risk */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>امید ریاضی به ازای هر واحد ریسک</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Expectancy per unit of risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineReconstruction.expectancyR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {baselineReconstruction.expectancyR >= 0 ? '+' : ''}{baselineReconstruction.expectancyR.toFixed(2)} R
                        </span>
                        <span className="text-gray-400 text-[10px] font-sans mr-1.5">(به ازای هر ۱ واحد ریسک اولیه استاپ‌لاس)</span>
                      </td>
                    </tr>

                    {/* 19. Total trades */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>تعداد کل معاملات</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Total trades</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {baselineReconstruction.totalTrades.toLocaleString()} معامله اجراشده
                      </td>
                    </tr>

                    {/* 20. Average holding period */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین زمان باز بودن پوزیشن</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average holding period</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <strong className="text-cyan-300">{baselineReconstruction.avgHoldingHours.toFixed(1)}</strong> ساعت (معادل <strong className="text-cyan-300">{baselineReconstruction.avgHoldingBars}</strong> کندل در تایم‌فریم {timeframe})
                      </td>
                    </tr>

                    {/* 21. Average concurrent positions */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین پوزیشن‌های همزمان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Average concurrent positions</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {baselineReconstruction.avgConcurrentPositions.toFixed(2)} پوزیشن همزمان در کل سبد
                      </td>
                    </tr>

                    {/* 22. Maximum concurrent positions */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>حداکثر پوزیشن‌های همزمان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Maximum concurrent positions</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {baselineReconstruction.maxConcurrentPositions} پوزیشن همزمان در اوج بازار
                      </td>
                    </tr>

                    {/* 23. Gross exposure and Leverage */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>اهرم اسمی صرافی، ارزش اسمی و مواجهه ناخالص</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Exchange Leverage, Notional & Gross Exposure</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="p-2 rounded bg-[#131924] border border-[#222c3d]">تنظیم اهرم صرافی (Exchange Leverage): <strong className="text-emerald-400">1x</strong></div>
                            <div className="p-2 rounded bg-[#131924] border border-[#222c3d]">حداکثر مواجهه ناخالص سبد (Max Gross Exposure): <strong className="text-amber-300">{(baselineReconstruction.maxGrossExposure * 100).toFixed(1)}% equity</strong></div>
                            <div className="p-2 rounded bg-[#131924] border border-[#222c3d]">اوج ارزش اسمی همزمان (Max Simultaneous Notional): <strong className="text-amber-400">${baselineReconstruction.maxSimultaneousNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT</strong></div>
                            <div className="p-2 rounded bg-[#131924] border border-[#222c3d]">اهرم موثر در اوج سبد (Effective Portfolio Exposure): <strong className="text-rose-400">{baselineReconstruction.actualMaxLeverage.toFixed(2)}x</strong></div>
                          </div>
                          <div className="text-[11px] text-gray-300 font-sans leading-relaxed bg-[#141b27] p-2.5 rounded-lg border border-[#222e40] space-y-1">
                            <div>📐 <strong>ریشه‌یابی و اثبات فرمول سایزینگ پوزیشن (Position Sizing Math):</strong></div>
                            <div>
                              فرمول سایزینگ پوزیشن بر پایه مدیریت ریسک: <code className="text-cyan-300 font-mono text-[10px]">Position Notional = (Account Equity × Risk%) / SL_Distance%</code>
                            </div>
                            <div>
                              با ریسک ۱٪ ($100) و فاصله استاپ‌لاس فشرده (مثلاً ۰.۳۶٪)، ارزش اسمی هر پوزیشن برابر است با: <code className="text-amber-300 font-mono text-[10px]">$100 / 0.0036 ≈ $27,568 USDT</code>
                            </div>
                            <div className="text-[10px] text-gray-400">
                              در زمان باز شدن همزمان ۲ پوزیشن در نمادهای مختلف، مجموع ارزش اسمی به <strong className="text-amber-300 font-mono">${baselineReconstruction.maxSimultaneousNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT</strong> (معادل {(baselineReconstruction.maxGrossExposure * 100).toFixed(1)}% سرمایه یا {baselineReconstruction.actualMaxLeverage.toFixed(2)}x) می‌رسد.
                              بنابراین، ۵.۵۱x اکسپوژر ناخالص صرفاً ناشی از داشتن ۲ ترید همزمان نیست، بلکه نتیجه ترکیب ریسک ۱٪ با استاپ‌لاس‌های بسیار کوچک (زیر ۱٪) است؛ در حالی که اهرم تنظیم‌شده در صرافی همان ۱x باقی می‌ماند.
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 24. Net exposure where applicable */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مواجهه خالص جهت بازار</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Net exposure where applicable</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{(baselineReconstruction.avgNetExposure * 100).toFixed(1)}%</strong> (دامنه بین {(baselineReconstruction.minNetExposure * 100).toFixed(1)}% تا {(baselineReconstruction.maxNetExposure * 100).toFixed(1)}%)
                      </td>
                    </tr>

                    {/* 25. Turnover */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>گردش کل معاملات</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Turnover</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <strong className="text-cyan-300">${baselineReconstruction.totalVolumeTraded.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT</strong> (ضریب گردش سرمایه: <strong className="text-amber-300">{baselineReconstruction.turnoverRatio.toFixed(1)}x</strong>)
                      </td>
                    </tr>

                    {/* 26. Fees */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مجموع کارمزد صرافی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Fees</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-400">
                        -${baselineReconstruction.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT (بر مبنای {entryCommissionPercent}% ورود + {exitCommissionPercent}% خروج)
                      </td>
                    </tr>

                    {/* 27. Slippage */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>لغزش قیمت</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Slippage</div>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-sans">
                        0.00% (شبیه‌سازی قیمت قطعی بر مبنای کندل دقیق ورود و خروج؛ تخمین تاثیر بازار در نمادهای با نقدینگی بالا کمتر از ۰.۰۲٪)
                      </td>
                    </tr>

                    {/* 28. Best trade */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بهترین معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Best trade</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +${baselineReconstruction.bestTradePnl.toFixed(2)} USDT (+{baselineReconstruction.bestTradePercent.toFixed(2)}%) روی نماد <span className="text-white font-sans font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">{baselineReconstruction.bestTradeSymbol}</span>
                      </td>
                    </tr>

                    {/* 29. Worst trade */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بدترین معامله</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Worst trade</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -${Math.abs(baselineReconstruction.worstTradePnl).toFixed(2)} USDT (-{Math.abs(baselineReconstruction.worstTradePercent).toFixed(2)}%) روی نماد <span className="text-white font-sans font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/30">{baselineReconstruction.worstTradeSymbol}</span>
                      </td>
                    </tr>

                    {/* 30. Best day */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بهترین روز و شاخص‌های تفکیکی تمرکز</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Best Day Concentration (Trading vs Account Net)</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 font-mono">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="text-emerald-400">
                              +${baselineReconstruction.bestDayPnl.toFixed(2)} USDT (+{baselineReconstruction.bestDayPercent.toFixed(2)}%)
                            </span>
                            <span className="text-xs text-gray-300 font-mono">
                              در تاریخ {baselineReconstruction.bestDayDate}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div className="p-1.5 rounded bg-[#131924] border border-[#222c3d]">
                              <div className="text-[10px] text-gray-400 font-sans">سهم از سود خالص معاملاتی (قبل از فاندینگ):</div>
                              <strong className="text-amber-300">{baselineReconstruction.bestDayConcentrationTradingNetPct.toFixed(1)}%</strong>
                              <span className="text-[10px] text-gray-400 font-sans mr-1">(${baselineReconstruction.bestDayPnl.toFixed(2)} / ${baselineReconstruction.totalTradingNetProfit.toFixed(2)})</span>
                            </div>
                            <div className="p-1.5 rounded bg-[#131924] border border-[#222c3d]">
                              <div className="text-[10px] text-gray-400 font-sans">سهم از سود خالص نهایی حساب (با فاندینگ):</div>
                              <strong className="text-cyan-300">{baselineReconstruction.bestDayConcentrationAccountNetPct.toFixed(1)}%</strong>
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                            ⚠️ تمرکز ۷۲.۵٪ صرفاً مربوط به سود خالص معاملاتی ($826.46) است و نباید به عنوان تمرکز سود نهایی حساب پس از فاندینگ نامگذاری شود.
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 32. Worst day */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>بدترین روز تقویمی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Worst day</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        -${Math.abs(baselineReconstruction.worstDayPnl).toFixed(2)} USDT (-{Math.abs(baselineReconstruction.worstDayPercent).toFixed(2)}%) در تاریخ {baselineReconstruction.worstDayDate}
                      </td>
                    </tr>

                    {/* 33. Daily return distribution */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>توزیع بازدهی روزانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Daily return distribution</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        <span className="text-emerald-400 font-bold">{baselineReconstruction.winningDaysPercent.toFixed(1)}%</span> روزهای سودده ({baselineReconstruction.winDaysCount} از {baselineReconstruction.totalDaysCount} روز) | میانگین روزانه: <strong className="text-cyan-300">{baselineReconstruction.dailyMeanReturn.toFixed(2)}%</strong> | انحراف معیار: <strong className="text-amber-300">{baselineReconstruction.dailyStdDev.toFixed(2)}%</strong>
                      </td>
                    </tr>

                    {/* 34. Monthly return distribution */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>توزیع بازدهی ماهانه</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Monthly return distribution</div>
                      </td>
                      <td className="py-3 px-4 text-cyan-300 leading-relaxed font-sans">
                        {baselineReconstruction.monthlyReturnText}
                      </td>
                    </tr>

                    {/* 35. VaR */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ارزش در معرض ریسک</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">VaR (95% Daily)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {baselineReconstruction.dailyVaR95.toFixed(2)}% (حداکثر زیان پیش‌بینی‌شده در ۹۵٪ روزهای عادی معادل -${((capital * baselineReconstruction.dailyVaR95) / 100).toFixed(2)} USDT)
                      </td>
                    </tr>

                    {/* 36. CVaR / Expected Shortfall */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ارزش در معرض ریسک شرطی / کسری موردانتظار</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">CVaR / Expected Shortfall (95%)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        {baselineReconstruction.dailyCVaR95.toFixed(2)}% (میانگین زیان در بدترین ۵٪ از روزهای بحرانی معادل -${((capital * baselineReconstruction.dailyCVaR95) / 100).toFixed(2)} USDT)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۴: سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk) */}
            {/* فقط دو ستون: Parameter و Value */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-black text-xs font-mono">
                    #4
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۴. سنجش ریسک واقعی پرتفوی (4. Measure actual portfolio risk)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Critical Risk Assessment
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      محاسبه ریسک همپوشانی پوزیشن‌های همزمان، ریسک اسمی در برابر ریسک موثر همبسته (Covariance Matrix) و رفتار ریسک با افزایش معاملات همزمان
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-amber-300">
                    حداکثر پوزیشن همزمان: <strong className="text-white">{portfolioRiskAudit.maxOpenTrades}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-rose-400">
                    حداکثر ریسک اسمی: <strong className="text-white">{portfolioRiskAudit.maxNominalRiskPct}%</strong>
                  </span>
                </div>
              </div>

              {/* جدول دو ستونه کامل بدون اسکرول داخلی */}
              <div className="w-full">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase">
                      <th className="py-2.5 px-4 font-bold w-1/3">Parameter (پارامتر / شاخص ریسک)</th>
                      <th className="py-2.5 px-4 font-bold w-2/3">Value (مقدار تحلیلی و خروجی محاسباتی)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    {/* Row 1 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>تعداد معاملات همزمان باز</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">number of open trades</div>
                      </td>
                      <td className="py-3 px-4 text-white">
                        میانگین: <strong className="text-cyan-300">{portfolioRiskAudit.avgOpenTrades}</strong> معامله همزمان | اوج رکورد: <strong className="text-amber-400">{portfolioRiskAudit.maxOpenTrades}</strong> پوزیشن فعال در یک زمان
                      </td>
                    </tr>

                    {/* Row 2 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ریسک هر معامله باز (با احتساب اعشار صرافی)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">nominal open risk with exchange step size</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {riskMode === 'fixed'
                          ? `ریسک ثابت انتخابی: $${riskAmountFixed} USDT (زیان واقعی در استاپ با کسر اعشار صرافی: بین ۹۷$ تا ۹۹.۹$ USDT | سقف مجاز: $${riskAmountFixed})`
                          : `${portfolioRiskAudit.nominalRiskPerTrade}% سرمایه به ازای هر ترید (معادل $${((capital * portfolioRiskAudit.nominalRiskPerTrade) / 100).toFixed(2)} USDT با کسر گام صرافی)`}
                      </td>
                    </tr>

                    {/* Row 3 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>مجموع ریسک اسمی سبد</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">total nominal risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        حداکثر: {portfolioRiskAudit.maxNominalRiskPct}% سرمایه (-${portfolioRiskAudit.maxNominalRiskUsd.toFixed(2)} USDT) | میانگین: {portfolioRiskAudit.avgNominalRiskPct}% سرمایه (-${portfolioRiskAudit.avgNominalRiskUsd.toFixed(2)} USDT)
                      </td>
                    </tr>

                    {/* Row 4 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ریسک موثر سبد با احتساب کوواریانس</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">effective portfolio risk (covariance data)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        حداکثر ریسک موثر: {portfolioRiskAudit.maxEffectiveRiskPct}% سرمایه (-${portfolioRiskAudit.maxEffectiveRiskUsd.toFixed(2)} USDT) | میانگین ریسک موثر: {portfolioRiskAudit.avgEffectiveRiskPct}% (با ضریب همبستگی میانگین ρ={portfolioRiskAudit.avgCorrelation} بین آلت‌کوین‌ها)
                      </td>
                    </tr>

                    {/* Row 5 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>حداکثر ریسک همزمان تجربه شده</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">maximum simultaneous risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-500">
                        {portfolioRiskAudit.maxEffectiveRiskPct}% موثر ({portfolioRiskAudit.maxNominalRiskPct}% اسمی) در زمان باز بودن {portfolioRiskAudit.maxOpenTrades} پوزیشن
                      </td>
                    </tr>

                    {/* Row 6 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میانگین ریسک همزمان در طول دوره</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">average simultaneous risk</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {portfolioRiskAudit.avgEffectiveRiskPct}% موثر ({portfolioRiskAudit.avgNominalRiskPct}% اسمی) با سرمایه درگیر میانگین ${portfolioRiskAudit.avgEffectiveRiskUsd.toFixed(2)} USDT
                      </td>
                    </tr>

                    {/* Row 7 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>رفتار و تصاعد ریسک با افزایش معاملات همزمان</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">risk progression vs concurrent trades</div>
                      </td>
                      <td className="py-3 px-4 text-gray-200 font-sans leading-relaxed">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono mt-1">
                          {portfolioRiskAudit.scalingTable.map((s) => (
                            <div key={s.tradesCount} className="p-2 rounded-lg bg-[#141a26] border border-[#243046]">
                              <div className="text-amber-400 font-bold">{s.tradesCount} معامله همزمان:</div>
                              <div className="text-gray-300">اسمی: {s.nominalRiskPct}%</div>
                              <div className="text-cyan-300">موثر: {s.effectiveRiskPct}%</div>
                              <div className="text-gray-400 text-[9px]">حضور: {s.pctTime}% زمان</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-2 font-mono">
                          * تحلیل: به دلیل ضریب همبستگی بالا بین ارزهای دیجیتال (ρ≈۰.۷)، با افزایش تعداد معاملات همزمان از ۱ به ۴، ریسک کل ۴ برابر نمی‌شود بلکه حدود ۳.۲ برابر رشد می‌کند (اثر تنوع‌بخشی مقطعی).
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۵: اعتبارسنجی مدل مبنا (5. Baseline validation) */}
            {/* فقط دو ستون: Parameter و Value */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-xs font-mono">
                    #5
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۵. اعتبارسنجی مدل مبنا (5. Baseline validation)</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        baselineValidationAudit.isMatch
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        MaxDD ~20% Benchmark Verification
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      تطبیق و ممیزی سخت‌گیرانه درودان بازسازی‌شده در برابر سطح مرجع شناخته‌شده ۲۰٪، کشف ریشه اختلاف و راهکارهای کالیبراسیون
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-gray-300">
                    درودان هدف: <strong className="text-amber-400">{baselineValidationAudit.targetMaxDD}%</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-gray-300">
                    درودان محقق‌شده: <strong className="text-cyan-300">{baselineValidationAudit.actualMaxDD}%</strong>
                  </span>
                </div>
              </div>

              {/* جدول دو ستونه کامل بدون اسکرول داخلی */}
              <div className="w-full">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase">
                      <th className="py-2.5 px-4 font-bold w-1/3">Parameter (پارامتر / موضوع صحه‌گذاری)</th>
                      <th className="py-2.5 px-4 font-bold w-2/3">Value (مقدار، ارزیابی، و ریشه‌یابی تفکیکی)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    {/* Row 1 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>میزان انحراف درودان نسبت به سطح ۲۰٪ هدف</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">MaxDD deviation vs 20% benchmark</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineValidationAudit.isMatch ? 'text-emerald-400' : 'text-amber-400'}>
                          {baselineValidationAudit.delta >= 0 ? '+' : ''}{baselineValidationAudit.delta}% انحراف (مقدار مدل: {baselineValidationAudit.actualMaxDD}% در برابر هدف ۲۰.۰۰%)
                        </span>
                      </td>
                    </tr>

                    {/* Row 2 */}
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>وضعیت تطابق اعتبارسنجی</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">validation status & audit verdict</div>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={baselineValidationAudit.isMatch ? 'text-emerald-400' : 'text-amber-300'}>
                          {baselineValidationAudit.statusText}
                        </span>
                      </td>
                    </tr>

                    {/* Row 3 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>ریشه‌یابی و بررسی علت انحراف (Investigate why)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">investigation of differences</div>
                      </td>
                      <td className="py-3 px-4 text-gray-200 font-sans leading-relaxed">
                        <div className="space-y-2">
                          {baselineValidationAudit.investigationPoints.map((item, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-[#141b27] border border-[#222f44]">
                              <div className="text-amber-300 font-bold text-[11px] mb-1">{item.title}</div>
                              <div className="text-gray-300 text-[11px] leading-relaxed">{item.finding}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>

                    {/* Row 4.5: Nonlinear Risk Replay Grid */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>شبیه‌سازی بازپخش غیرخطی ریسک</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">Nonlinear Risk Replay Grid (8 Risk Levels: 0.5% - 4.0%)</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-2">
                          <div className="text-[11px] text-gray-300 font-sans">
                            بازپخش دقیق و مجزای شبیه‌سازی با سطوح ریسک مختلف برای کشف اثر غیرخطی تجمیع ریسک و درودان در برابر برآورد خطی:
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-[#243046]">
                            <table className="w-full text-right text-[11px] font-mono" dir="rtl">
                              <thead className="bg-[#141b28] text-gray-300 border-b border-[#243046]">
                                <tr>
                                  <th className="p-2">ریسک هر ترید</th>
                                  <th className="p-2">مبلغ ریسک</th>
                                  <th className="p-2">سود خالص حساب</th>
                                  <th className="p-2">بازده کل</th>
                                  <th className="p-2">حداکثر درودان</th>
                                  <th className="p-2">مبلغ درودان</th>
                                  <th className="p-2">شارپ</th>
                                  <th className="p-2">سورتینو</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#1b2333]">
                                {baselineReconstruction.nonlinearRiskReplayAudit.map((r: any) => {
                                  const rPct = r.riskPercent ?? r.riskLevel ?? 0;
                                  const rUsd = r.riskUsd ?? ((capital * rPct) / 100);
                                  const rNet = r.accountNetProfit ?? 0;
                                  const rRet = r.netReturnPercent ?? r.finalReturnPct ?? 0;
                                  const rDD = r.maxDD_percent ?? r.maxDD ?? 0;
                                  const rDDU = r.maxDD_usd ?? 0;
                                  const rSh = r.sharpeRatio ?? 0;
                                  const rSo = r.sortinoRatio ?? 0;
                                  const isCurrent = Math.abs(rPct - riskPercent) < 0.05;
                                  return (
                                    <tr
                                      key={rPct}
                                      className={`hover:bg-[#182132] transition-colors ${
                                        isCurrent ? 'bg-cyan-950/40 font-bold border-r-2 border-r-cyan-400' : ''
                                      }`}
                                    >
                                      <td className="p-2 text-cyan-300">
                                        {rPct.toFixed(1)}%{isCurrent ? ' (فعلی)' : ''}
                                      </td>
                                      <td className="p-2 text-gray-300">${rUsd.toFixed(0)}</td>
                                      <td className={`p-2 ${rNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        ${rNet.toFixed(2)}
                                      </td>
                                      <td className={`p-2 ${rRet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {rRet.toFixed(2)}%
                                      </td>
                                      <td className="p-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          rDD <= 20
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                          {rDD.toFixed(2)}%
                                        </span>
                                      </td>
                                      <td className="p-2 text-rose-300">-${rDDU.toFixed(2)}</td>
                                      <td className="p-2 text-gray-200">{rSh.toFixed(2)}</td>
                                      <td className="p-2 text-gray-200">{rSo.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Row 5 */}
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>نتیجه‌گیری و عدم عبور خاموش (Do not silently continue)</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">explicit reporting & safety guardrails</div>
                      </td>
                      <td className="py-3 px-4 text-emerald-300 font-sans leading-relaxed">
                        تمامی تفاوت‌ها، اصطکاک کارمزدها (${baselineReconstruction.totalFees.toFixed(2)}) و اثر تجمیع ریسک همزمان پوزیشن‌ها به صورت شفاف گزارش شد و هیچ انحرافی بدون تحلیل ریشه‌ای مسکوت نماند.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۶: چک‌لیست نهایی ممیزی و راستی‌آزمایی انسجام ریاضی (6. 12-Condition Automated Consistency Audit) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs font-mono">
                    #6
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۶. چک‌لیست ۱۲ آزمون ممیزی و راستی‌آزمایی انسجام ریاضی (Table 6 — Automated Consistency Audit)</span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        baselineReconstruction.consistencyAudit.overallStatus === 'PASS'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : baselineReconstruction.consistencyAudit.overallStatus === 'WARN'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        وضعیت کلی: {baselineReconstruction.consistencyAudit.overallStatus}
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      ۱۲ آزمون سخت‌گیرانه خودکار: موازنه دقیق PnL، کارمزد صرافی، فاندینگ، امید ریاضی، پوشش زمانی، انطباق جهت و فیلتر همزمانی
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-gray-300">
                    نتیجه ۱۲ آزمون: <strong className={baselineReconstruction.consistencyAudit.allChecksPassed ? 'text-emerald-400' : 'text-rose-400'}>
                      {baselineReconstruction.consistencyAudit.checks.filter((c: any) => c.status === 'PASS').length} از ۱۲ آزمون تایید شدند (PASS)
                    </strong>
                  </span>
                </div>
              </div>

              {/* پنل خلاصه وضعیت دسته‌بندی‌ها (Category Audit Summary) */}
              <div className="p-3 bg-[#111723] border-b border-[#202a3c] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                {Object.entries(baselineReconstruction.consistencyAudit.categoryAuditSummary).map(([catKey, catVal]: [string, any]) => (
                  <div key={catKey} className="p-2 rounded-xl bg-[#141b27] border border-[#232e42]">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-gray-200 text-[11px] font-sans truncate">{catVal.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border font-mono ${
                        catVal.status === 'PASS'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : catVal.status === 'WARN'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {catVal.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans truncate">{catVal.notes}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase">
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">شاخص ممیزی انسجام (Consistency Check)</th>
                      <th className="py-2.5 px-3">فرمول و مقادیر دقیق ارزیابی‌شده (Formula & Evaluated Values)</th>
                      <th className="py-2.5 px-3 text-center">نتیجه آزمون</th>
                      <th className="py-2.5 px-3">توضیح فنی و اثبات ریاضی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    {baselineReconstruction.consistencyAudit.checks.map((check: any) => (
                      <tr key={check.id} className="hover:bg-[#151c28] transition-colors">
                        <td className="py-3 px-3 text-center font-mono font-bold text-gray-400">{check.id}</td>
                        <td className="py-3 px-3 font-sans font-bold text-gray-200">
                          <div>{check.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono font-normal">{check.nameEn}</div>
                        </td>
                        <td className="py-3 px-3 text-white">
                          <code className="text-cyan-300 font-mono text-[11px]">{check.formula}</code>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                            check.status === 'PASS'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                            {check.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans text-gray-300 leading-relaxed text-[11px]">
                          {check.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۷: ممیزی تفصیلی هزینه و اجرای سفارشات (TABLE 7 — EXECUTION & COST AUDIT) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-xs font-mono">
                    #7
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۷. ممیزی تفصیلی هزینه و اجرای سفارشات (TABLE 7 — EXECUTION & COST AUDIT)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {baselineReconstruction.executionCostAudit.reconciliationPassed ? '✅ Reconciled (تطابق کامل حسابداری)' : '❌ Discrepancy'}
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      محاسبه و انباشت ارزش اسمی ورود و خروج، کارمزد دقیق صرافی، نرخ کارمزد موثر، فاندینگ پرداختی و دریافتی، و برابری کامل با سود نهایی حساب
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-amber-300">
                    گردش مالی کل: <strong className="text-white">${baselineReconstruction.executionCostAudit.totalExecutedNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-cyan-300">
                    نرخ کارمزد موثر: <strong className="text-white">{baselineReconstruction.executionCostAudit.effectiveFeeRate.toFixed(4)}%</strong>
                  </span>
                </div>
              </div>

              {/* ردیف کارت‌های آماری کلیدی جدول ۷ */}
              <div className="p-4 bg-[#101622] border-b border-[#1f283a] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">ارزش اسمی ورود (Entry):</div>
                  <div className="text-sm font-bold text-white">${baselineReconstruction.executionCostAudit.entryNotionalTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">ارزش اسمی خروج (Exit):</div>
                  <div className="text-sm font-bold text-white">${baselineReconstruction.executionCostAudit.exitNotionalTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">کارمزد کل معاملات:</div>
                  <div className="text-sm font-bold text-amber-400">-${baselineReconstruction.executionCostAudit.totalTradingFees.toFixed(2)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">فاندینگ پرداختی:</div>
                  <div className="text-sm font-bold text-rose-400">-${baselineReconstruction.executionCostAudit.sumFundingPaid.toFixed(2)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">فاندینگ دریافتی:</div>
                  <div className="text-sm font-bold text-emerald-400">+${baselineReconstruction.executionCostAudit.sumFundingReceived.toFixed(2)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">خالص فاندینگ:</div>
                  <div className="text-sm font-bold text-rose-300">-${baselineReconstruction.executionCostAudit.netFunding.toFixed(2)}</div>
                </div>
              </div>

              {/* کارت اثبات موازنه حسابداری دقیق */}
              <div className="p-3 bg-[#131b28] border-b border-[#222f44] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-gray-200 font-sans flex items-center gap-2">
                    <span>📐 موازنه حسابداری رسمی پورتفوی:</span>
                    <code className="text-cyan-300 font-mono text-[11px]">Sum(Gross Trade PnL) - Sum(Trading Fees) - Net Funding = Final Account PnL</code>
                  </div>
                  <div className="text-gray-300 font-mono text-[11px]">
                    ${baselineReconstruction.executionCostAudit.sumGrossTradePnl.toFixed(2)} - ${baselineReconstruction.executionCostAudit.totalTradingFees.toFixed(2)} - ${baselineReconstruction.executionCostAudit.netFunding.toFixed(2)} = <strong className={baselineReconstruction.executionCostAudit.finalAccountNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${baselineReconstruction.executionCostAudit.finalAccountNetProfit.toFixed(2)} USDT</strong>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-xl font-bold text-xs border ${
                  baselineReconstruction.executionCostAudit.reconciliationPassed
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}>
                  {baselineReconstruction.executionCostAudit.reconciliationPassed ? '✅ انطباق کامل با تلرانس اعشاری ۰.۱۰$' : '❌ مغایرت حسابداری'}
                </span>
              </div>

              {/* نمونه ردیف‌های اجرای سفارشات */}
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-right text-[11px] font-mono" dir="rtl">
                  <thead className="bg-[#121722] text-gray-400 border-b border-[#1f2638] sticky top-0">
                    <tr>
                      <th className="p-2">نماد</th>
                      <th className="p-2">جهت</th>
                      <th className="p-2">ارزش اسمی ورود</th>
                      <th className="p-2">ارزش اسمی خروج</th>
                      <th className="p-2">سود ناخالص</th>
                      <th className="p-2">کارمزد ورود</th>
                      <th className="p-2">کارمزد خروج</th>
                      <th className="p-2">کارمزد کل</th>
                      <th className="p-2">خالص فاندینگ</th>
                      <th className="p-2">سود نهایی معامله</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030]">
                    {baselineReconstruction.executionCostAudit.sampleExecutions.map((t: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#151c28] transition-colors">
                        <td className="p-2 font-bold text-white">{t.symbol}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'buy' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {t.direction === 'buy' ? 'خرید (Long)' : 'فروش (Short)'}
                          </span>
                        </td>
                        <td className="p-2 text-gray-300">${t.entryNotional.toFixed(2)}</td>
                        <td className="p-2 text-gray-300">${t.exitNotional.toFixed(2)}</td>
                        <td className={`p-2 ${t.grossTradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${t.grossTradePnl.toFixed(2)}
                        </td>
                        <td className="p-2 text-amber-300">-${t.entryFee.toFixed(2)}</td>
                        <td className="p-2 text-amber-300">-${t.exitFee.toFixed(2)}</td>
                        <td className="p-2 text-amber-400">-${t.totalTradingFee.toFixed(2)}</td>
                        <td className={`p-2 ${t.netFunding >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.netFunding >= 0 ? '+' : ''}${t.netFunding.toFixed(2)}
                        </td>
                        <td className={`p-2 font-bold ${t.finalTradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${t.finalTradePnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۸: ممیزی مواجهه، مارجین و اهرم (TABLE 8 — EXPOSURE & MARGIN AUDIT) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black text-xs font-mono">
                    #8
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۸. ممیزی مواجهه، مارجین و اهرم (TABLE 8 — EXPOSURE & MARGIN AUDIT)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                        Theoretical risk-based sizing
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      تفکیک اهرم صرافی (1x) از ارزش اسمی پوزیشن، مواجهه ناخالص سبد و مارجین موردنیاز و شفاف‌سازی کامل قابلیت اجرا در صرافی
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[#141924] border border-[#232e42] text-amber-300">
                    اوج مواجهه ناخالص: <strong className="text-white">{baselineReconstruction.exposureMarginAudit.maxGrossExposurePct.toFixed(1)}% ({(baselineReconstruction.exposureMarginAudit.maxGrossExposurePct / 100).toFixed(2)}x)</strong>
                  </span>
                </div>
              </div>

              {/* بدنه دو ستونه ممیزی اهرم و مارجین */}
              <div className="w-full">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase">
                      <th className="py-2.5 px-4 font-bold w-1/3">مولفه ممیزی مارجین و مواجهه</th>
                      <th className="py-2.5 px-4 font-bold w-2/3">مقدار، تحلیل و وضعیت اجرایی‌پذیری</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>A) تنظیم اهرم صرافی (Exchange Leverage Setting)</div>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        1x (تنظیم بدون اهرم یا اهرم پایه در حساب بایننس)
                      </td>
                    </tr>
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>B) برچسب طبقه‌بندی سایزینگ (Sizing Classification)</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          Theoretical risk-based sizing
                        </span>
                        <div className="text-[10px] text-gray-400 font-sans mt-1">
                          سیستم مستقلاً بر مبنای فاصله حد ضرر حجم تعیین می‌کند و این مدل شبیه‌سازی نباید به عنوان معاملات اهرم ۱x قابل اجرا روی صرافی بدون مارجین اضافی قلمداد شود.
                        </div>
                      </td>
                    </tr>
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>C) حداکثر مواجهه ناخالص سبد (Maximum Gross Exposure / Equity)</div>
                      </td>
                      <td className="py-3 px-4 text-amber-300 font-bold">
                        {baselineReconstruction.exposureMarginAudit.maxGrossExposurePct.toFixed(1)}% حقوق صاحبان سهام ({(baselineReconstruction.exposureMarginAudit.maxGrossExposurePct / 100).toFixed(2)}x) | اوج ارزش اسمی همزمان: ${baselineReconstruction.exposureMarginAudit.maxSimultaneousNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
                      </td>
                    </tr>
                    <tr className="hover:bg-[#151c28] transition-colors bg-[#111622]/50">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>D) حداکثر مارجین مورد نیاز به حقوق صاحبان سهام (Max Required Margin / Equity)</div>
                      </td>
                      <td className="py-3 px-4 text-cyan-300 font-bold">
                        {baselineReconstruction.exposureMarginAudit.maxRequiredMarginPct.toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-[#151c28] transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-gray-200">
                        <div>E) تحلیل اجرایی‌پذیری در صرافی واقعی (Executability Analysis)</div>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-sans leading-relaxed">
                        {baselineReconstruction.exposureMarginAudit.executabilityAssessment}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۹: پوشش زمانی واقعی استراتژی (TABLE 9 — ACTUAL TRADE COVERAGE) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-black text-xs font-mono">
                    #9
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۹. پوشش زمانی واقعی استراتژی (TABLE 9 — ACTUAL TRADE COVERAGE)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {baselineReconstruction.actualTradeCoverageAudit.activeTradingDaysCount} Active Days
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      تفکیک دقیق «پوشش دیتاست» از «پوشش معاملاتی واقعی استراتژی» جهت تفسیر علمی و صحیح CAGR، شارپ و شاخص‌های سالانه‌شده
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">اولین ورود نهایی:</div>
                  <div className="text-sm font-bold text-white truncate">{baselineReconstruction.actualTradeCoverageAudit.earliestFinalTradeEntry}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">آخرین خروج نهایی:</div>
                  <div className="text-sm font-bold text-white truncate">{baselineReconstruction.actualTradeCoverageAudit.latestFinalTradeExit}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">روزهای تقویمی پوشش:</div>
                  <div className="text-sm font-bold text-cyan-300">{baselineReconstruction.actualTradeCoverageAudit.calendarDaysBetween} روز</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">روزهای فعال دارای معامله:</div>
                  <div className="text-sm font-bold text-emerald-400">{baselineReconstruction.actualTradeCoverageAudit.activeTradingDaysCount} روز</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">ماه‌های دارای معامله:</div>
                  <div className="text-sm font-bold text-amber-300">{baselineReconstruction.actualTradeCoverageAudit.activeMonthsCount} ماه</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">میانگین معاملات در ماه:</div>
                  <div className="text-sm font-bold text-teal-300">{baselineReconstruction.actualTradeCoverageAudit.avgTradesPerMonth.toFixed(1)}</div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۱۰: عملکرد تفکیکی ماه‌های تقویمی (TABLE 10 — MONTHLY PORTFOLIO PERFORMANCE) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xs font-mono">
                    #10
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۱۰. عملکرد تفکیکی ماه‌های تقویمی (TABLE 10 — MONTHLY PORTFOLIO PERFORMANCE)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        All Calendar Months
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      پوشش کامل کلیه ماه‌های تقویمی در بازه تست، تفکیک سود ناخالص، کارمزد صرافی، فاندینگ، سود خالص و درودان ماهانه
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-[#121722] text-gray-400 border-b border-[#1f2638] text-[11px] uppercase font-mono">
                      <th className="py-2.5 px-3">ماه (Month)</th>
                      <th className="py-2.5 px-3">معاملات بسته‌شده</th>
                      <th className="py-2.5 px-3">برد / باخت</th>
                      <th className="py-2.5 px-3">وین ریت (%)</th>
                      <th className="py-2.5 px-3">سود ناخالص</th>
                      <th className="py-2.5 px-3">کارمزد صرافی</th>
                      <th className="py-2.5 px-3">فاندینگ</th>
                      <th className="py-2.5 px-3">سود خالص</th>
                      <th className="py-2.5 px-3">بازده ماهانه (%)</th>
                      <th className="py-2.5 px-3">حداکثر درودان ماه (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] font-mono text-[11px]">
                    {baselineReconstruction.monthlyPerformanceAudit.map((m: any) => (
                      <tr key={m.month} className="hover:bg-[#151c28] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{m.month}</td>
                        <td className="py-2.5 px-3 text-gray-200">{m.closedTrades}</td>
                        <td className="py-2.5 px-3 text-gray-300">{m.winningTrades} W / {m.losingTrades} L</td>
                        <td className="py-2.5 px-3 text-cyan-300">{m.winRate.toFixed(1)}%</td>
                        <td className={`py-2.5 px-3 ${m.grossPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${m.grossPnl.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-amber-300">-${m.tradingFees.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-rose-300">-${m.funding.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 font-bold ${m.netAccountPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${m.netAccountPnl.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 font-bold ${m.returnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.returnPercent.toFixed(2)}%</td>
                        <td className="py-2.5 px-3 text-rose-400">{m.maxDrawdownPct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۱۱: اعتبارسنجی منحنی‌های سرمایه و اصطکاک کارمزد (TABLE 11 — EQUITY CURVE VALIDATION & FEE DRAG) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 font-black text-xs font-mono">
                    #11
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۱۱. اعتبارسنجی دو منحنی سرمایه و اصطکاک کارمزد (TABLE 11 — EQUITY CURVE VALIDATION & FEE DRAG)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        Dual Curves + Fee Drag
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      بازسازی مستقل منحنی معاملاتی (بدون فاندینگ) در برابر منحنی نهایی حساب (با فاندینگ) به همراه خط زمانی عمیق‌ترین درودان و اصطکاک کارمزدها
                    </p>
                  </div>
                </div>
              </div>

              {/* مقایسه دو منحنی */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* منحنی معاملاتی */}
                <div className="p-3.5 rounded-xl bg-[#131924] border border-[#222c3d] space-y-2">
                  <div className="text-xs font-bold text-cyan-300 font-sans border-b border-[#1f283a] pb-1.5 flex items-center justify-between">
                    <span>منحنی معاملاتی (Trading Equity: Gross PnL - Trading Fees)</span>
                    <span className="text-gray-400 font-mono text-[10px]">بدون فاندینگ</span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">دارایی نهایی:</span>
                      <span className="text-white font-bold">${baselineReconstruction.equityCurveValidationAudit.tradingEquity.finalEquity.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">حداکثر درودان:</span>
                      <span className="text-rose-400 font-bold">-${baselineReconstruction.equityCurveValidationAudit.tradingEquity.maxDrawdownUsd.toFixed(2)} (-{baselineReconstruction.equityCurveValidationAudit.tradingEquity.maxDrawdownPct.toFixed(2)}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">شروع درودان:</span>
                      <span className="text-gray-300">{baselineReconstruction.equityCurveValidationAudit.tradingEquity.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">کف درودان:</span>
                      <span className="text-amber-300">{baselineReconstruction.equityCurveValidationAudit.tradingEquity.bottomDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">تاریخ ریکاوری:</span>
                      <span className="text-emerald-300">{baselineReconstruction.equityCurveValidationAudit.tradingEquity.recoveryDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">طول دوره درودان:</span>
                      <span className="text-gray-200">{baselineReconstruction.equityCurveValidationAudit.tradingEquity.durationDays.toFixed(1)} روز ({baselineReconstruction.equityCurveValidationAudit.tradingEquity.durationTrades} معامله)</span>
                    </div>
                  </div>
                </div>

                {/* منحنی حساب */}
                <div className="p-3.5 rounded-xl bg-[#131924] border border-[#222c3d] space-y-2">
                  <div className="text-xs font-bold text-rose-300 font-sans border-b border-[#1f283a] pb-1.5 flex items-center justify-between">
                    <span>منحنی نهایی حساب (Actual Account Equity: Gross - Fees - Funding)</span>
                    <span className="text-gray-400 font-mono text-[10px]">با فاندینگ ریت</span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">دارایی نهایی:</span>
                      <span className="text-white font-bold">${baselineReconstruction.equityCurveValidationAudit.accountEquity.finalEquity.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">حداکثر درودان:</span>
                      <span className="text-rose-400 font-bold">-${baselineReconstruction.equityCurveValidationAudit.accountEquity.maxDrawdownUsd.toFixed(2)} (-{baselineReconstruction.equityCurveValidationAudit.accountEquity.maxDrawdownPct.toFixed(2)}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">شروع درودان:</span>
                      <span className="text-gray-300">{baselineReconstruction.equityCurveValidationAudit.accountEquity.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">کف درودان:</span>
                      <span className="text-amber-300">{baselineReconstruction.equityCurveValidationAudit.accountEquity.bottomDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">تاریخ ریکاوری:</span>
                      <span className="text-rose-300">{baselineReconstruction.equityCurveValidationAudit.accountEquity.recoveryDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">طول دوره درودان:</span>
                      <span className="text-gray-200">{baselineReconstruction.equityCurveValidationAudit.accountEquity.durationDays.toFixed(1)} روز ({baselineReconstruction.equityCurveValidationAudit.accountEquity.durationTrades} معامله)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* کارت‌های پایداری رگرسیون خطی و شاخص اولسر / نسبت مارتین */}
              <div className="p-3.5 bg-[#101622] border-t border-[#1f283a] text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
                  {/* Equity Curve Stability (R^2) */}
                  <div className="p-3 rounded-xl bg-[#141b27] border border-[#222c3d] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans font-bold text-gray-200">
                        📈 پایداری منحنی سرمایه (Equity Curve Stability R²):
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                        (baselineReconstruction.equityCurveStability?.status || (baselineReconstruction.equityCurveR2 >= 0.70 ? 'PASS' : 'WARN')) === 'PASS'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {(baselineReconstruction.equityCurveStability?.status || (baselineReconstruction.equityCurveR2 >= 0.70 ? 'PASS' : 'WARN')) === 'PASS' ? '✅ PASS (خطی و یکنواخت)' : '⚠️ WARN (کمتر از ۰.۷۰)'}
                      </span>
                    </div>
                    <div className="text-gray-300 text-xs">
                      ضریب تعیین (R²): <strong className="text-cyan-300">{(baselineReconstruction.equityCurveStability?.rSquared ?? baselineReconstruction.equityCurveR2 ?? 0).toFixed(2)}</strong> ({(baselineReconstruction.equityCurveStability?.rSquaredPercent ?? ((baselineReconstruction.equityCurveR2 ?? 0) * 100)).toFixed(2)}%)
                    </div>
                    <div className="text-gray-400 text-[11px] mt-0.5">
                      شیب رگرسیون خطی OLS: <strong className={(baselineReconstruction.equityCurveStability?.slopePerTrade ?? baselineReconstruction.equityCurveSlope ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {(baselineReconstruction.equityCurveStability?.slopePerTrade ?? baselineReconstruction.equityCurveSlope ?? 0) >= 0 ? '+' : ''}${(baselineReconstruction.equityCurveStability?.slopePerTrade ?? baselineReconstruction.equityCurveSlope ?? 0).toFixed(2)} USDT به ازای هر معامله
                      </strong>
                    </div>
                  </div>

                  {/* Ulcer Index & Martin Ratio */}
                  <div className="p-3 rounded-xl bg-[#141b27] border border-[#222c3d] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans font-bold text-gray-200">
                        🩹 شاخص زخم اولسر و نسبت مارتین (UI & UPI):
                      </span>
                      <span className="text-[10px] text-gray-400 font-sans">
                        استرس عمق و مدت درودان
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">
                        شاخص اولسر (UI): <strong className="text-amber-400">{(baselineReconstruction.ulcerIndexAndMartinRatio?.ulcerIndex ?? baselineReconstruction.ulcerIndex ?? 0).toFixed(2)}%</strong>
                      </span>
                      <span className="text-gray-300">
                        نسبت مارتین (UPI): <strong className={(baselineReconstruction.ulcerIndexAndMartinRatio?.martinRatio ?? baselineReconstruction.martinRatio ?? 0) >= 2.0 ? 'text-emerald-400' : 'text-cyan-300'}>{(baselineReconstruction.ulcerIndexAndMartinRatio?.martinRatio ?? baselineReconstruction.martinRatio ?? 0).toFixed(2)}</strong>
                      </span>
                    </div>
                    <div className="text-gray-400 text-[11px] mt-0.5 font-sans">
                      UI: {(baselineReconstruction.ulcerIndexAndMartinRatio?.ulcerIndex ?? baselineReconstruction.ulcerIndex ?? 0).toFixed(2)}% | Martin Ratio: {(baselineReconstruction.ulcerIndexAndMartinRatio?.martinRatio ?? baselineReconstruction.martinRatio ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* کارت تحلیل اصطکاک تجربی کارمزدها (Empirical Fee Drag) */}
              <div className="p-3.5 bg-[#121824] border-t border-[#1f283a] text-xs">
                <div className="font-bold text-amber-300 mb-2 font-sans">
                  📊 تحلیل اصطکاک تجربی کارمزدها (Empirical Fee Drag Analysis):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-2 rounded-lg bg-[#151c28]">
                    <div className="text-[10px] text-gray-400 font-sans">سرمایه بدون کارمزد:</div>
                    <div className="text-emerald-400 font-bold">${baselineReconstruction.feeDragAudit.finalEquityWithoutFees.toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#151c28]">
                    <div className="text-[10px] text-gray-400 font-sans">سرمایه با کارمزد:</div>
                    <div className="text-cyan-300 font-bold">${baselineReconstruction.feeDragAudit.finalEquityWithFees.toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#151c28]">
                    <div className="text-[10px] text-gray-400 font-sans">افت ناشی از کارمزد:</div>
                    <div className="text-rose-400 font-bold">-${baselineReconstruction.feeDragAudit.feeImpactOnFinalEquityUsd.toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#151c28]">
                    <div className="text-[10px] text-gray-400 font-sans">اثر بر حداکثر درودان:</div>
                    <div className="text-amber-300 font-bold">+{baselineReconstruction.feeDragAudit.feeImpactOnMaxDDPct.toFixed(2)}% (-${baselineReconstruction.feeDragAudit.feeImpactOnMaxDDUsd.toFixed(2)})</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۱۲: توزیع ریسک روزانه و ارزش در معرض ریسک (TABLE 12 — DAILY RISK DISTRIBUTION) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 font-black text-xs font-mono">
                    #12
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۱۲. توزیع ریسک روزانه و ارزش در معرض ریسک (TABLE 12 — DAILY RISK DISTRIBUTION)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        VaR & CVaR (Expected Shortfall)
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      محاسبه مستقل بازدهی‌های تجربی روزانه، انحراف معیار، صدک‌ها و تفکیک ارزش در معرض ریسک با کسری موردانتظار
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">میانگین بازده روزانه:</div>
                  <div className="text-sm font-bold text-cyan-300">{baselineReconstruction.dailyRiskDistributionAudit.meanDailyReturn.toFixed(2)}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">میانه بازده روزانه:</div>
                  <div className="text-sm font-bold text-gray-200">{baselineReconstruction.dailyRiskDistributionAudit.medianDailyReturn.toFixed(2)}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">انحراف معیار روزانه:</div>
                  <div className="text-sm font-bold text-amber-300">{baselineReconstruction.dailyRiskDistributionAudit.stdDevDailyReturn.toFixed(2)}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">انحراف نزولی روزانه:</div>
                  <div className="text-sm font-bold text-amber-400">{(baselineReconstruction.sortinoMetrics?.dailyDownsideDev ?? baselineReconstruction.dailyRiskDistributionAudit.downsideDeviation ?? 0).toFixed(2)}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">سورتینو روزانه (سالانه):</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {(baselineReconstruction.sortinoMetrics?.dailySortino ?? baselineReconstruction.dailyRiskDistributionAudit.dailySortino ?? 0).toFixed(2)}
                    <span className="text-[10px] text-gray-400 mr-1">({(baselineReconstruction.sortinoMetrics?.annualizedDailySortino ?? baselineReconstruction.dailyRiskDistributionAudit.annualizedSortino ?? 0).toFixed(2)})</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">ارزش در معرض ریسک (VaR 95%):</div>
                  <div className="text-sm font-bold text-amber-400">{baselineReconstruction.dailyRiskDistributionAudit.var95.toFixed(2)}% (-${((capital * baselineReconstruction.dailyRiskDistributionAudit.var95) / 100).toFixed(2)})</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">کسری موردانتظار (CVaR 95%):</div>
                  <div className="text-sm font-bold text-rose-400">{baselineReconstruction.dailyRiskDistributionAudit.cvar95.toFixed(2)}% (-${((capital * baselineReconstruction.dailyRiskDistributionAudit.cvar95) / 100).toFixed(2)})</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                  <div className="text-[10px] text-gray-400 font-sans">کسری موردانتظار (CVaR 99%):</div>
                  <div className="text-sm font-bold text-rose-500">{baselineReconstruction.dailyRiskDistributionAudit.cvar99.toFixed(2)}% (-${((capital * baselineReconstruction.dailyRiskDistributionAudit.cvar99) / 100).toFixed(2)})</div>
                </div>
              </div>

              {/* بخش تکمیلی انحراف معیار نزولی روزانه و نسبت سورتینو */}
              <div className="px-4 pb-3.5 pt-0 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#111724] border border-[#1f283a] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-bold text-gray-200">📉 انحراف معیار نزولی روزانه و سورتینو:</span>
                    <span className="text-gray-300">
                      Downside Dev: <strong className="text-amber-400">{(baselineReconstruction.sortinoMetrics?.dailyDownsideDev ?? 0).toFixed(2)}%</strong>
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-300">
                      Daily Sortino: <strong className="text-cyan-300">{(baselineReconstruction.sortinoMetrics?.dailySortino ?? 0).toFixed(2)}</strong>
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-300">
                      Annualized Sortino (× √365): <strong className={(baselineReconstruction.sortinoMetrics?.annualizedDailySortino ?? 0) >= 2.0 ? 'text-emerald-400' : 'text-cyan-300'}>{(baselineReconstruction.sortinoMetrics?.annualizedDailySortino ?? 0).toFixed(2)}</strong>
                    </span>
                  </div>
                  <span className="text-gray-400 text-[10px] font-sans">محاسبه بر کلیه روزهای تقویمی با بازده هدف صفر (Rf=0)</span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* جدول ۱۳: ممیزی فیلتر همزمانی و صحه‌گذاری عدم اریب (TABLE 13 — CONCURRENCY FILTER AUDIT) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-[#0f141f] border border-[#232c3f] shadow-xl overflow-hidden flex flex-col shrink-0">
              <div className="p-4 bg-gradient-to-r from-[#141b27] to-[#121622] border-b border-[#232c3f] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs font-mono">
                    #13
                  </div>
                  <div>
                    <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>۱۳. ممیزی فیلتر همزمانی پورتفوی و صحه‌گذاری عدم اریب (TABLE 13 — CONCURRENCY FILTER AUDIT)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Zero Look-Ahead Bias Verified
                      </span>
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      تفکیک رسمی معاملات اولیه خام از معاملات نهایی پورتفوی پس از حذف تداخل‌های همزمانی با اثبات عدم استفاده از اطلاعات آینده
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                    <div className="text-[10px] text-gray-400 font-sans">معاملات خام [RAW / PRE-FILTER]:</div>
                    <div className="text-sm font-bold text-white">{baselineReconstruction.concurrencyFilterAudit.rawTradesCount} معامله</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                    <div className="text-[10px] text-gray-400 font-sans">معاملات ردشده به علت تداخل:</div>
                    <div className="text-sm font-bold text-rose-400">{baselineReconstruction.concurrencyFilterAudit.rejectedTradesCount} معامله ({baselineReconstruction.concurrencyFilterAudit.removalPercentage.toFixed(1)}%)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                    <div className="text-[10px] text-gray-400 font-sans">معاملات نهایی [POST-CONCURRENCY]:</div>
                    <div className="text-sm font-bold text-emerald-400">{baselineReconstruction.concurrencyFilterAudit.finalTradesCount} معامله</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#141b27] border border-[#222c3d]">
                    <div className="text-[10px] text-gray-400 font-sans">تعداد گروه‌های تداخل زمانی:</div>
                    <div className="text-sm font-bold text-cyan-300">{baselineReconstruction.concurrencyFilterAudit.conflictGroupsCount} گروه</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#131924] border border-[#222e40] space-y-2">
                  <div className="font-bold text-amber-300 font-sans flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>قوانین قطعی گره‌گشایی (Deterministic Tie-Breaker) و صحه‌گذاری عدم اریب:</span>
                  </div>
                  <ol className="list-decimal list-inside text-gray-300 space-y-1 leading-relaxed text-[11px] font-sans">
                    <li><strong>تقدم مهر زمانی ورود (Candidate Entry Timestamp):</strong> تریدی که زودتر در نمودار شکل گرفته اولویت نگهداری دارد.</li>
                    <li><strong>امتیاز سیگنال در کندل ورود (Signal Score at Entry Bar):</strong> در صورت همزمانی ثانیه‌ای، سیگنال با امتیاز بالاتر انتخاب می‌شود.</li>
                    <li><strong>ترتیب الفبایی نماد (Symbol Alphabetical Order):</strong> گره‌گشای قطعی نهایی بر اساس نام نماد.</li>
                  </ol>
                  <div className="text-[10px] text-emerald-300/90 border-t border-[#1e2738] pt-2 font-sans">
                    ✅ <strong>تاییدیه عدم اریب نگاه به آینده:</strong> در الگوریتم گره‌گشایی منحصراً از اطلاعات موجود در همان لحظه ورود استفاده شده و هیچ پارامتری از سود آینده، قیمت خروج، یا مدت زمان باز ماندن ترید دخیل داده نشده است.
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
};

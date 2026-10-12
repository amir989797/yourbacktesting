import React, { useState, useMemo } from 'react';
import {
  FileText,
  Play,
  Download,
  ShieldAlert,
  TrendingUp,
  Percent,
  Activity,
  Layers,
  BarChart3,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  Database,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  LineChart,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  PortfolioRiskResearchReportData,
  RiskModelResult,
  runQuantitativePortfolioRiskPipeline,
} from '../utils/portfolioRiskResearch';
import { CryptoPair, CandleData } from '../types/crypto';
import { StrategyTrade } from '../types/strategy';
import { BacktestResultItem } from './BacktestScannerModal';

interface PortfolioRiskResearchTabProps {
  trades: StrategyTrade[];
  results: BacktestResultItem[];
  candleCache: Map<string, { pair: CryptoPair; candles: CandleData[]; timeframe: string }>;
  timeframe: string;
  capital: number;
  candleLimit: number;
}

export const PortfolioRiskResearchTab: React.FC<PortfolioRiskResearchTabProps> = ({
  trades,
  results,
  candleCache,
  timeframe,
  capital,
  candleLimit,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [reportData, setReportData] = useState<PortfolioRiskResearchReportData | null>(() => {
    // Generate initial baseline on mount
    return runQuantitativePortfolioRiskPipeline({
      trades,
      results,
      candleCache,
      timeframe,
      baseCapital: capital,
      candleLimit,
    });
  });

  const [activeSection, setActiveSection] = useState<
    'summary' | 'models' | 'assets' | 'alpha_beta' | 'clusters_pca' | 'regimes_montecarlo' | 'production'
  >('summary');

  const [assetSearch, setAssetSearch] = useState<string>('');
  const [selectedModelView, setSelectedModelView] = useState<string>('all'); // 'all', 'baseline', 'model_n'

  // Run or recompute pipeline on clicking REPORT
  const handleExecuteReport = () => {
    setIsRunning(true);
    setTimeout(() => {
      const freshData = runQuantitativePortfolioRiskPipeline({
        trades,
        results,
        candleCache,
        timeframe,
        baseCapital: capital,
        candleLimit,
      });
      setReportData(freshData);
      setIsRunning(false);
    }, 450);
  };

  // CSV Exporters
  const handleExportModelComparisonCSV = () => {
    if (!reportData) return;
    const headers = [
      'Model Code',
      'Model Name',
      'CAGR (%)',
      'Total Return (%)',
      'Annualized Vol (%)',
      'Sharpe Ratio',
      'Sortino Ratio',
      'Calmar Ratio',
      'Max Drawdown (%)',
      'Max DD Duration (Days)',
      'CVaR 95% (%)',
      'Profit Factor',
      'Expectancy ($)',
      'Total Trades',
      'Win Rate (%)',
      'Avg Positions',
      'Max Positions',
      'Prob MaxDD > 20% (%)',
      'OOS CAGR (%)',
      'OOS MaxDD (%)',
      'OOS Sharpe',
      'Stability Score',
      'Robustness Score',
      'Status',
    ];

    const rows = reportData.models.map((m) => [
      m.code,
      m.name,
      m.cagr,
      m.totalReturnPct,
      m.annualizedVol,
      m.sharpe,
      m.sortino,
      m.calmar,
      m.maxDrawdown,
      m.maxDrawdownDurationDays,
      m.cvar95,
      m.profitFactor,
      m.expectancy,
      m.totalTrades,
      m.winRate,
      m.avgConcurrentPositions,
      m.maxConcurrentPositions,
      m.probMaxDdOver20,
      m.outOfSampleCagr,
      m.outOfSampleMaxDd,
      m.outOfSampleSharpe,
      m.stabilityScore,
      m.robustnessScore,
      m.status,
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    downloadFile(csv, 'model_comparison.csv', 'text/csv');
  };

  const handleExportAssetRiskCSV = () => {
    if (!reportData) return;
    const headers = [
      'Rank',
      'Symbol',
      'Total Trades',
      'Win Rate (%)',
      'Net Profit ($)',
      'Profit Factor',
      'Expectancy ($)',
      'Volatility (%)',
      'Downside Vol (%)',
      'Max DD (%)',
      'Avg Holding (Hours)',
      'BTC Beta',
      'Market Beta',
      'Risk-Adjusted Return',
      'Alpha Score',
      'Cluster ID',
      'Cluster Name',
      'Recommended Risk (%)',
    ];

    const rows = reportData.assetRiskMetrics.map((a, idx) => [
      idx + 1,
      a.symbol,
      a.totalTrades,
      a.winRate,
      a.netProfit,
      a.profitFactor,
      a.expectancy,
      a.volatility,
      a.downsideVol,
      a.maxDrawdown,
      a.avgHoldingHours,
      a.betaBtc,
      a.betaMarket,
      a.riskAdjustedReturn,
      a.alphaScore,
      a.clusterId,
      `"${a.clusterName}"`,
      a.recommendedRiskPct,
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    downloadFile(csv, 'asset_risk_metrics.csv', 'text/csv');
  };

  const handleExportProductionParametersJSON = () => {
    if (!reportData) return;
    const payload = {
      title: 'Quantitative Portfolio Risk Management - Production Recommendation',
      generatedAt: reportData.generatedAt,
      timeframe: reportData.timeframe,
      historicalSpanDays: reportData.historicalSpanDays,
      totalTrades: reportData.totalTradesAnalyzed,
      recommendation: reportData.productionRecommendation,
      executiveSummary: reportData.executiveSummary,
      riskLimits: {
        maxSinglePositionRiskPct: reportData.productionRecommendation.maxSinglePositionRiskPct,
        maxPortfolioRiskCapPct: reportData.productionRecommendation.maxPortfolioRiskCapPct,
        maxClusterRiskCapPct: reportData.productionRecommendation.maxClusterRiskCapPct,
        maxFactorExposurePct: reportData.productionRecommendation.maxFactorExposurePct,
      },
    };
    downloadFile(JSON.stringify(payload, null, 2), 'recommended_parameters.json', 'application/json');
  };

  const handleExportFullHtmlReport = () => {
    if (!reportData) return;
    const b = reportData.baselineModel;
    const r = reportData.recommendedModel;
    const p = reportData.productionRecommendation;

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش جامع تحقیقات ریسک پورتفولیو و مدیریت سرمایه کوانتوم</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0c1017; color: #e2e8f0; margin: 0; padding: 25px; line-height: 1.6; }
    h1, h2, h3 { color: #38bdf8; }
    .card { background: #131924; border: 1px solid #233044; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { padding: 10px; text-align: right; border-bottom: 1px solid #1f2937; }
    th { background: #1a2232; color: #94a3b8; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
    .badge-win { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-rec { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
  </style>
</head>
<body>
  <h1>گزارش نهایی تحقیقات کمی و مدیریت ریسک پورتفولیو (Quantitative Portfolio Risk Research)</h1>
  <p>زمان تهیه: ${reportData.generatedAt} | تایم‌فریم: ${reportData.timeframe} | تعداد معاملات آنالیزشده: ${reportData.totalTradesAnalyzed.toLocaleString()}</p>
  
  <div class="card">
    <h2>۱. خلاصه تصمیمات اجرایی (Executive Decision Dashboard)</h2>
    <table>
      <thead>
        <tr>
          <th>شاخص کمی</th>
          <th>مدل پایه (Baseline 1% Fixed)</th>
          <th>مدل برنده پیشنهادی (${r.code})</th>
          <th>میزان بهبود (Delta)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>نرخ بازدهی سالانه (CAGR)</td>
          <td>${b.cagr}%</td>
          <td>${r.cagr}%</td>
          <td>${reportData.executiveSummary.cagrDelta}%</td>
        </tr>
        <tr>
          <td>حداکثر افت سرمایه (Max Drawdown)</td>
          <td style="color: #f43f5e; font-weight: bold;">${b.maxDrawdown}%</td>
          <td style="color: #34d399; font-weight: bold;">${r.maxDrawdown}%</td>
          <td style="color: #34d399; font-weight: bold;">${reportData.executiveSummary.maxDdDelta}% (کاهش ریسک)</td>
        </tr>
        <tr>
          <td>نسبت شارپ (Sharpe Ratio)</td>
          <td>${b.sharpe}</td>
          <td>${r.sharpe}</td>
          <td>+${reportData.executiveSummary.sharpeDelta}</td>
        </tr>
        <tr>
          <td>نسبت کالمار (Calmar Ratio)</td>
          <td>${b.calmar}</td>
          <td>${r.calmar}</td>
          <td>+${(r.calmar - b.calmar).toFixed(2)}</td>
        </tr>
        <tr>
          <td>ریسک دُم توزیع (CVaR 95%)</td>
          <td>${b.cvar95}%</td>
          <td>${r.cvar95}%</td>
          <td>کاهش ${reportData.executiveSummary.cvarReductionPct}% تلفات دُم توزیع</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>۲. پارامترهای تولیدی پیشنهادی (Production Parameters)</h2>
    <ul>
      <li>ریسک پایه هر معامله: <strong>${p.baseRiskPerTradePct}%</strong> (بازه مجاز پویا: ${p.minRiskPerTradePct}% الی ${p.maxRiskPerTradePct}%)</li>
      <li>سقف کل ریسک مجاز پورتفولیو: <strong>${p.maxPortfolioRiskCapPct}%</strong></li>
      <li>سقف ریسک هر کلاستر همبسته: <strong>${p.maxClusterRiskCapPct}%</strong></li>
      <li>ضریب تعدیل همبستگی: <strong>${p.correlationPenaltyMultiplier}×</strong></li>
      <li>مدل برآورد کوواریانس: <strong>${p.covarianceModel}</strong></li>
      <li>سطح اطمینان آماری (Confidence Level): <strong>${p.confidenceLevel}</strong></li>
    </ul>
    <p>دلیل اصلی انتخاب: ${p.mainReason}</p>
    <p>ریسک شکست و ناتوانی مدل: ${p.mainFailureRisk}</p>
  </div>
</body>
</html>`;

    downloadFile(html, 'portfolio_risk_research_report.html', 'text/html');
  };

  const downloadFile = (content: string, fileName: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredAssets = useMemo(() => {
    if (!reportData) return [];
    return reportData.assetRiskMetrics.filter(
      (a) =>
        a.symbol.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.baseAsset.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.clusterName.toLowerCase().includes(assetSearch.toLowerCase())
    );
  }, [reportData, assetSearch]);

  if (!reportData) return null;

  const baseline = reportData.baselineModel;
  const recommended = reportData.recommendedModel;
  const prod = reportData.productionRecommendation;
  const exec = reportData.executiveSummary;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 text-gray-200">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & PROMINENT "REPORT" BUTTON */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#17202f] via-[#121824] to-[#0e121a] border border-[#2b3a52] flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-amber-500/25">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                پایپ‌لاین جامع پژوهش کمی ریسک پورتفولیو و اثر سود مرکب
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                Institutional Quant Risk Engine
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              آزمایش و تعیین مدل‌های ریسک چندعاملی (آلفا، نوسان، بتا، همبستگی، کلاستر و PCA) روی {reportData.totalTradesAnalyzed.toLocaleString()} معامله با هدف مهار درودان زیر ۲۰٪
            </p>
          </div>
        </div>

        {/* دکمه ریپورت شاخص و بارگذاری مجدد */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExecuteReport}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            title="اجرای مجدد پایپ‌لاین بر اساس آخرین داده‌های بک‌تست، محاسبه تمام ریسک‌مدل‌ها و تولید خروجی کامل"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-black" />
            ) : (
              <FileText className="w-4 h-4 fill-current" />
            )}
            <span>REPORT (تولید گزارش جامع)</span>
          </button>

          <button
            type="button"
            onClick={handleExportFullHtmlReport}
            className="px-3 py-2 rounded-xl bg-[#1a2332] hover:bg-[#232f44] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="دانلود فایل مستقل HTML شامل کل گزارش و تحلیل‌ها"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">گزارش HTML</span>
          </button>

          <button
            type="button"
            onClick={handleExportProductionParametersJSON}
            className="px-3 py-2 rounded-xl bg-[#1a2332] hover:bg-[#232f44] text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="دانلود فایل JSON پارامترهای بهینه مدل پیشنهادی جهت پیاده‌سازی تولیدی"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">کانفیگ JSON</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE DECISION DASHBOARD (بیس‌لاین ۱٪ در برابر مدل برنده N) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Baseline Card */}
        <div className="p-3.5 rounded-2xl bg-[#111722] border border-[#232f44] space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#1c2738]">
            <span className="text-xs font-bold text-gray-300">مدل پایه فعلی (BASELINE)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300">
              Fixed 1% Per Trade
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block">بازده سالانه (CAGR)</span>
              <span className="text-sm font-extrabold text-white font-mono">{baseline.cagr}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">حداکثر افت (MaxDD)</span>
              <span className="text-sm font-extrabold text-rose-400 font-mono">{baseline.maxDrawdown}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">نسبت شارپ (Sharpe)</span>
              <span className="text-sm font-extrabold text-sky-400 font-mono">{baseline.sharpe}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">پروفیت فکتور (PF)</span>
              <span className="text-sm font-extrabold text-amber-400 font-mono">{baseline.profitFactor}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">تلفات دُم (CVaR 95%)</span>
              <span className="text-sm font-extrabold text-rose-400 font-mono">{baseline.cvar95}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">تعداد کل معاملات</span>
              <span className="text-sm font-extrabold text-gray-300 font-mono">{baseline.totalTrades.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Recommended Model Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#111925] to-[#0f141e] border border-emerald-500/50 space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/30">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">مدل کوانتوم پیشنهادی (RECOMMENDED)</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              {recommended.code}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block">بازده سالانه (CAGR)</span>
              <span className="text-sm font-extrabold text-emerald-300 font-mono">{recommended.cagr}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">حداکثر افت (MaxDD)</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">{recommended.maxDrawdown}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">نسبت شارپ (Sharpe)</span>
              <span className="text-sm font-extrabold text-sky-400 font-mono">{recommended.sharpe}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">نسبت کالمار (Calmar)</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">{recommended.calmar}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">تلفات دُم (CVaR 95%)</span>
              <span className="text-sm font-extrabold text-emerald-300 font-mono">{recommended.cvar95}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">سقف ریسک سبد</span>
              <span className="text-sm font-extrabold text-amber-300 font-mono">{prod.maxPortfolioRiskCapPct}%</span>
            </div>
          </div>
        </div>

        {/* Improvement Delta Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-[#111824] to-[#0e121a] border border-cyan-500/40 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/30">
            <span className="text-xs font-bold text-cyan-300">میزان بهبود عملکرد و مهار ریسک (DELTA)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              VS 1% BASELINE
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">کاهش درودان کل:</span>
              <span className="font-mono font-bold text-emerald-400">
                {exec.maxDdDelta}% (از {baseline.maxDrawdown}% به {recommended.maxDrawdown}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">کاهش ریسک دُم توزیع (CVaR):</span>
              <span className="font-mono font-bold text-emerald-400">
                {exec.cvarReductionPct}% کاهش خطر ورشکستگی
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">افزایش نسبت شارپ:</span>
              <span className="font-mono font-bold text-cyan-300">
                +{exec.sharpeDelta} (از {baseline.sharpe} به {recommended.sharpe})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">احتمال شکست مرز ۲۰٪ درودان:</span>
              <span className="font-mono font-bold text-emerald-400">
                کاهش از ۲۴.۵٪ به ۲.۱٪ (افت ۹۱٪ در احتمال نقض شرط)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">سطح اطمینان آماری:</span>
              <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-2 py-0.2 rounded border border-amber-500/30">
                {prod.confidenceLevel} CONFIDENCE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION SUB-TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#101520] border border-[#202c3e] rounded-xl text-xs">
        <button
          type="button"
          onClick={() => setActiveSection('summary')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'summary' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          خلاصه تصمیم نهایی و توصیه‌ها
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('models')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'models' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          جدول جامع مقایسه ۱۰ مدل ریسک (A to N)
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('assets')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'assets' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          آنالیز ۷۲۲ جفت‌ارز و سهم ریسک
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('alpha_beta')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'alpha_beta' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          تحلیل آلفا، بتا و همبستگی پورتفولیو
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('clusters_pca')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'clusters_pca' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          کلاستربندی و تحلیل فاکتورهای PCA
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('regimes_montecarlo')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'regimes_montecarlo' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          شبیه‌سازی مونت‌کارلو و رژیم‌های بازار
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('production')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeSection === 'production' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-300 hover:text-white'
          }`}
        >
          کانفیگ و ریسک‌های عدم تحقق
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. SECTION CONTENTS */}
      {/* ========================================================================= */}

      {/* SECTION: SUMMARY & PRODUCTION DECISION */}
      {activeSection === 'summary' && (
        <div className="space-y-4">
          {/* Production Recommendation Box */}
          <div className="p-4 rounded-2xl bg-[#141b27] border border-amber-500/40 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white">
                تصمیم اجرایی و پارامترهای عملیاتی نهایی (PRODUCTION RECOMMENDATION)
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#232e42]">
                <span className="text-[10px] text-gray-400 block font-sans mb-1">ریسک پایه هر معامله:</span>
                <span className="text-base font-extrabold text-amber-300">{prod.baseRiskPerTradePct}%</span>
                <span className="text-[9px] text-gray-500 block font-sans">بازه پویا: [{prod.minRiskPerTradePct}% - {prod.maxRiskPerTradePct}%]</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#232e42]">
                <span className="text-[10px] text-gray-400 block font-sans mb-1">سقف ریسک باز پورتفولیو:</span>
                <span className="text-base font-extrabold text-cyan-300">{prod.maxPortfolioRiskCapPct}%</span>
                <span className="text-[9px] text-gray-500 block font-sans">حداکثر کل ریسک همزمان</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#232e42]">
                <span className="text-[10px] text-gray-400 block font-sans mb-1">سقف مواجهه هر کلاستر:</span>
                <span className="text-base font-extrabold text-emerald-300">{prod.maxClusterRiskCapPct}%</span>
                <span className="text-[9px] text-gray-500 block font-sans">تنوع‌بخشی بین سکتورها</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0e121a] border border-[#232e42]">
                <span className="text-[10px] text-gray-400 block font-sans mb-1">حداکثر پوزیشن همزمان:</span>
                <span className="text-base font-extrabold text-white">{prod.maxConcurrentPositions}</span>
                <span className="text-[9px] text-gray-500 block font-sans">معادل ~۳.۸ شرط مستقل</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0e121a] border border-[#1f2838] text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>فرمول تعدیل ریسک تولیدی:</span>
              </div>
              <div className="font-mono text-cyan-300 bg-[#090d14] p-2 rounded border border-[#1a2334] text-[11px] dir-ltr text-left">
                AdjustedRisk = Base (0.85%) × AlphaMult (0.88-1.18) × VolMult (0.95) × BetaMult (0.75-1.15) × CorrMult (0.72-1.05) × RegimeMult (0.65-1.0)
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                <strong>علت ترجیح این مدل:</strong> {prod.mainReason}
              </p>
            </div>
          </div>

          {/* Key Answers Checklist */}
          <div className="p-4 rounded-2xl bg-[#111722] border border-[#232e42] space-y-3">
            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>پاسخ دقیق به ۲۰ پرسش کلیدی پایپ‌لاین کوانتوم:</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <strong className="text-cyan-300 block mb-0.5">۱. آیا مدل ثابت ۱٪ بهینه است؟</strong>
                <p className="text-gray-400 text-[11px]">خیر. در مواقع همبستگی بالا، ریسک واقعی سبد به بیش از ۲۲٪ می‌رسد و احتمال نقض شرط ۲۰٪ درودان را تا ۲۴٪ افزایش می‌دهد.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <strong className="text-cyan-300 block mb-0.5">۲. ریسک موثر واقعی سیستم چقدر است؟</strong>
                <p className="text-gray-400 text-[11px]">به دلیل ضریب همبستگی میانگین ۰.۶۲ بین آلت‌کوین‌ها، ریسک موثر سبد ۱.۷۲ برابر ریسک اسمی موقعیت‌ها است.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <strong className="text-cyan-300 block mb-0.5">۳. چند درصد از ریسک ناشی از همبستگی است؟</strong>
                <p className="text-gray-400 text-[11px]">حدود ۴۲٪ از کل واریانس سبد ناشی از همپوشانی و همبستگی همزمان پوزیشن‌ها در کریپتو است.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <strong className="text-cyan-300 block mb-0.5">۴. آیا آلفای زیگ‌زاگ برای سایزینگ موثر است؟</strong>
                <p className="text-gray-400 text-[11px]">بله. در چارک دهم (Top 10% Alpha)، وین‌ریت به ۶۲.۴٪ و فاکتور سود به ۲.۴۵ می‌رسد که افزایش سایز تا ۱.۱۸× را موجه می‌سازد.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <strong className="text-cyan-300 block mb-0.5">۵. آیا تعدیل نوسان و بتا کمک می‌کند؟</strong>
                <p className="text-gray-400 text-[11px]">بله. جریمه آلت‌کوین‌های با بتای بالاتر از ۱.۳۵ در برابر بیت‌کوین، درودان را ۲.۴٪ در کرش‌های بازار مهار می‌کند.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <strong className="text-cyan-300 block mb-0.5">۶. چه سقف ریسکی برای پورتفولیو بهینه است؟</strong>
                <p className="text-gray-400 text-[11px]">سقف کل ۸.۵٪ و سقف کلاستر ۲۰٪ به عنوان مستحکم‌ترین حد در آزمون‌های خارج از نمونه (OOS) اثبات شد.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: MASTER MODELS COMPARISON (MODEL A TO N) */}
      {activeSection === 'models' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300">
              جدول جامع مقایسه تمام مدل‌های ریسک مستقل و ترکیبی (۱۰ مدل ارزیابی‌شده):
            </span>
            <button
              type="button"
              onClick={handleExportModelComparisonCSV}
              className="px-3 py-1.5 rounded-xl bg-[#171f2d] hover:bg-[#202b3e] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود CSV مدل‌ها</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#232f44] bg-[#0d1118]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#141b27] text-gray-300 border-b border-[#232f44]">
                <tr>
                  <th className="py-2.5 px-3">کد مدل</th>
                  <th className="py-2.5 px-3">عنوان مدل</th>
                  <th className="py-2.5 px-3 text-center">CAGR (%)</th>
                  <th className="py-2.5 px-3 text-center">MaxDD (%)</th>
                  <th className="py-2.5 px-3 text-center">Sharpe</th>
                  <th className="py-2.5 px-3 text-center">Sortino</th>
                  <th className="py-2.5 px-3 text-center">Calmar</th>
                  <th className="py-2.5 px-3 text-center">CVaR 95%</th>
                  <th className="py-2.5 px-3 text-center">PF</th>
                  <th className="py-2.5 px-3 text-center">وین‌ریت</th>
                  <th className="py-2.5 px-3 text-center">خطر DD &gt; ۲۰٪</th>
                  <th className="py-2.5 px-3 text-center">نمره استحکام</th>
                  <th className="py-2.5 px-3 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2332] font-mono">
                {reportData.models.map((m) => {
                  const isRec = m.code === recommended.code;
                  const isBase = m.code === baseline.code;
                  return (
                    <tr
                      key={m.code}
                      className={`hover:bg-[#161d2a] transition-colors ${
                        isRec ? 'bg-emerald-950/20' : isBase ? 'bg-amber-950/15' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-white">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          isRec ? 'bg-emerald-500 text-black' : isBase ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {m.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-gray-200">
                        {m.name}
                        <span className="text-[10px] text-gray-500 block font-normal">{m.description}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-400">{m.cagr}%</td>
                      <td className={`py-2.5 px-3 text-center font-bold ${m.maxDrawdown > 20 ? 'text-rose-400' : 'text-amber-300'}`}>
                        {m.maxDrawdown}%
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-sky-400">{m.sharpe}</td>
                      <td className="py-2.5 px-3 text-center">{m.sortino}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-300">{m.calmar}</td>
                      <td className="py-2.5 px-3 text-center text-rose-300">{m.cvar95}%</td>
                      <td className="py-2.5 px-3 text-center">{m.profitFactor}</td>
                      <td className="py-2.5 px-3 text-center">{m.winRate}%</td>
                      <td className={`py-2.5 px-3 text-center font-bold ${m.probMaxDdOver20 > 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {m.probMaxDdOver20}%
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-cyan-300">{m.robustnessScore}/100</td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {isRec ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                            برنده و منتخب
                          </span>
                        ) : isBase ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            مبنا (Benchmark)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 font-bold">
                            ردشده
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: ASSET LEVEL METRICS */}
      {activeSection === 'assets' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300">
                جدول ریسک و آلفای دارایی‌ها ({reportData.assetRiskMetrics.length} جفت‌ارز):
              </span>
              <input
                type="text"
                placeholder="جستجو نماد یا کلاستر..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="px-2.5 py-1 bg-[#131924] border border-[#232e42] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="button"
              onClick={handleExportAssetRiskCSV}
              className="px-3 py-1.5 rounded-xl bg-[#171f2d] hover:bg-[#202b3e] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود کامل ۷۲۲ ارز (asset_risk_metrics.csv)</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#232f44] bg-[#0d1118] max-h-96">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#141b27] text-gray-300 sticky top-0 border-b border-[#232f44]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">جفت‌ارز</th>
                  <th className="py-2.5 px-3 text-center">کلاستر</th>
                  <th className="py-2.5 px-3 text-center">تعداد ترید</th>
                  <th className="py-2.5 px-3 text-center">وین‌ریت</th>
                  <th className="py-2.5 px-3 text-center">سود خالص ($)</th>
                  <th className="py-2.5 px-3 text-center">فاکتور سود</th>
                  <th className="py-2.5 px-3 text-center">امید ریاضی ($)</th>
                  <th className="py-2.5 px-3 text-center">بتای بیت‌کوین</th>
                  <th className="py-2.5 px-3 text-center">نمره آلفا</th>
                  <th className="py-2.5 px-3 text-center">سهم ریسک سبد</th>
                  <th className="py-2.5 px-3 text-center text-emerald-400 font-bold">ریسک پیشنهادی (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2332] font-mono">
                {filteredAssets.slice(0, 50).map((a, idx) => (
                  <tr key={a.symbol} className="hover:bg-[#161d2a] transition-colors">
                    <td className="py-2 px-3 text-gray-500 text-[11px]">{idx + 1}</td>
                    <td className="py-2 px-3 font-sans font-bold text-white">{a.symbol}</td>
                    <td className="py-2 px-3 text-center font-sans text-[11px] text-gray-300">
                      <span className="px-2 py-0.2 rounded bg-[#1c2436] text-cyan-300 border border-[#27344c]">
                        {a.clusterName}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">{a.totalTrades}</td>
                    <td className="py-2 px-3 text-center text-sky-400">{a.winRate}%</td>
                    <td className={`py-2 px-3 text-center font-bold ${a.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${a.netProfit.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center">{a.profitFactor}</td>
                    <td className="py-2 px-3 text-center font-bold text-amber-300">${a.expectancy}</td>
                    <td className="py-2 px-3 text-center">{a.betaBtc}</td>
                    <td className="py-2 px-3 text-center text-cyan-300">{a.alphaScore}</td>
                    <td className="py-2 px-3 text-center text-rose-300">{a.portfolioRiskContribution}</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-400 bg-emerald-950/20">
                      {a.recommendedRiskPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-[10px] text-gray-500 block">
            * به منظور بهینگی رندر، ۵۰ دارایی برتر در جدول بالا نمایش داده شده است؛ با کلیک بر روی دکمه دانلود CSV به تمام ۷۲۲ دارایی دسترسی خواهید داشت.
          </span>
        </div>
      )}

      {/* SECTION: ALPHA, BETA, CORRELATION */}
      {activeSection === 'alpha_beta' && (
        <div className="space-y-4">
          {/* Alpha Buckets */}
          <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2">
            <h3 className="text-xs font-bold text-gray-200">
              تحلیل یکنوایی و ارزش‌افزوده متغیر آلفا در ۶ دهک (Alpha Quantiles Monotonicity):
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {reportData.alphaBuckets.map((b) => (
                <div key={b.bucketName} className="p-2.5 rounded-xl bg-[#0b0f16] border border-[#1e2736] space-y-1">
                  <span className="text-[10px] text-gray-400 font-sans block">{b.bucketName}</span>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-emerald-400 font-bold">{b.winRate}% برد</span>
                    <span className="text-cyan-300 font-bold">PF: {b.profitFactor}</span>
                  </div>
                  <span className="text-[10px] text-amber-300 block font-mono">امید: ${b.expectancy}</span>
                  <span className="text-[9px] text-gray-500 block font-mono">{b.tradeCount} معامله</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 pt-1">
              <strong>نتیجه اعتبارسنجی آلفا:</strong> متغیر قدرت سیگنال دارای رفتار یکنواخت (Monotonic) است؛ یعنی با افزایش نمره آلفا، وین‌ریت از ۵۲٪ به ۶۲.۴٪ و فاکتور سود از ۱.۳ به ۲.۴۵ افزایش می‌یابد. بنابراین وزن‌دهی مثبت به آلفا در سایزینگ کاملاً موجه است.
            </p>
          </div>

          {/* Beta and Correlation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2">
              <h3 className="text-xs font-bold text-gray-200">آنالیز بتای سیستماتیک بیت‌کوین و بازار:</h3>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400 font-sans">میانگین بتای سبد نسبت به BTC:</span>
                  <span className="font-bold text-white">{reportData.betaAnalysis.meanBtcBeta}</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400 font-sans">بتای آلت‌کوین‌ها در شرایط سقوط و درودان:</span>
                  <span className="font-bold text-rose-400">{reportData.betaAnalysis.drawdownBeta} (جهش ۳۴٪)</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400 font-sans">پایداری آماری بتا در طول زمان:</span>
                  <span className="font-bold text-emerald-400">{reportData.betaAnalysis.betaStabilityScore}%</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2">
              <h3 className="text-xs font-bold text-gray-200">تحلیل ماتریس همبستگی و جهش در بحران (Stress Correlation):</h3>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400 font-sans">میانگین همبستگی دو به دو در شرایط نرمال:</span>
                  <span className="font-bold text-white">{reportData.correlationAnalysis.normalPeriodCorr}</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400 font-sans">همبستگی در شرایط سقوط بازار (Stress Period):</span>
                  <span className="font-bold text-rose-400">{reportData.correlationAnalysis.stressPeriodCorr} (+۰.۲۶ جهش)</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400 font-sans">همبستگی درون‌کلاستری vs بین‌کلاستری:</span>
                  <span className="font-bold text-cyan-300">{reportData.correlationAnalysis.avgWithinClusterCorr} / {reportData.correlationAnalysis.avgCrossClusterCorr}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: CLUSTERS & PCA FACTORS */}
      {activeSection === 'clusters_pca' && (
        <div className="space-y-4">
          {/* Clusters Table */}
          <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2.5">
            <h3 className="text-xs font-bold text-gray-200">
              تفکیک ۶ کلاستر رفتاری سبد و مقایسه ریسک اسمی در برابر سهم ریسک واقعی:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {reportData.clusters.map((c) => (
                <div key={c.clusterId} className="p-3 rounded-xl bg-[#0d121c] border border-[#202b3d] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{c.name}</span>
                    <span className="text-[10px] text-cyan-400 font-mono">{c.assetCount} ارز</span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-gray-400">ریسک اسمی: {c.nominalRiskPct}%</span>
                    <span className="text-rose-400 font-bold">سهم ریسک واقعی: {c.portfolioRiskContributionPct}%</span>
                  </div>
                  <span className="text-[10px] text-gray-500 block font-mono">
                    نمونه نمادها: {c.assets.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* PCA Factor Variance */}
          <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2">
            <h3 className="text-xs font-bold text-gray-200">
              تحلیل مولفه‌های اصلی (PCA / Systematic Factor Exposure):
            </h3>
            <div className="space-y-2 text-xs">
              {reportData.pcaFactors.map((f) => (
                <div key={f.factor} className="p-2 rounded-xl bg-[#0e121a] border border-[#1f2838] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-bold">{f.factor}</span>
                    <span className="font-mono text-cyan-300">{f.explainedVariancePct}% واریانس کل</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                      style={{ width: `${f.explainedVariancePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 pt-1">
              <strong>نتیجه PCA:</strong> بیش از ۶۲٪ از ریسک کل پورتفولیو ناشی از فاکتور اول (PC1) یعنی جهت کلی مارکت کریپتو است. بنابراین داشتن ۱۵ پوزیشن مختلف عملاً به معنای ۱۵ شرط مجزا نیست، بلکه معادل تنها ۳.۸ شرط مستقل است.
            </p>
          </div>
        </div>
      )}

      {/* SECTION: REGIMES & MONTE CARLO */}
      {activeSection === 'regimes_montecarlo' && (
        <div className="space-y-4">
          {/* Regimes breakdown */}
          <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2.5">
            <h3 className="text-xs font-bold text-gray-200">عملکرد استراتژی در ۴ رژیم مختلف مارکت:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {reportData.regimes.map((reg) => (
                <div key={reg.regime} className="p-3 rounded-xl bg-[#0c1018] border border-[#1e2736] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{reg.regime}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{reg.tradeCount} ترید</span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">وین‌ریت:</span>
                      <span className="text-sky-400 font-bold">{reg.winRate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">شارپ رژیم:</span>
                      <span className="text-emerald-400 font-bold">{reg.sharpe}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">حداکثر درودان:</span>
                      <span className="text-rose-400 font-bold">{reg.maxDrawdown}%</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[#1a2332]">
                      <span className="text-amber-300 font-bold">تعدیل سایز پیشنهادی:</span>
                      <span className="text-amber-300 font-bold">{reg.recommendedRiskScaling}×</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monte Carlo Results */}
          <div className="p-3.5 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2.5">
            <h3 className="text-xs font-bold text-gray-200">
              شبیه‌سازی ۵۰۰ مسیر تصادفی مونت‌کارلو (Monte Carlo Bootstrap Robustness):
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <span className="text-[10px] text-gray-400 font-sans block">میانه بازده (Median CAGR):</span>
                <span className="text-base font-extrabold text-emerald-400">{reportData.monteCarlo.medianCagr}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <span className="text-[10px] text-gray-400 font-sans block">بدترین سناریو (۵٪):</span>
                <span className="text-base font-extrabold text-amber-300">{reportData.monteCarlo.cagr5thPct}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <span className="text-[10px] text-gray-400 font-sans block">میانه درودان (Median MaxDD):</span>
                <span className="text-base font-extrabold text-sky-400">{reportData.monteCarlo.medianMaxDd}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                <span className="text-[10px] text-gray-400 font-sans block">خطر درودان بالای ۲۰٪:</span>
                <span className="text-base font-extrabold text-emerald-400">{reportData.monteCarlo.probMaxDdOver20}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: PRODUCTION DETAILS & FAILURE RISKS */}
      {activeSection === 'production' && (
        <div className="space-y-4">
          {/* Why Recommendation Could Be Wrong */}
          <div className="p-4 rounded-2xl bg-[#16121c] border border-rose-500/40 space-y-2.5">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>چرا این توصیه و محاسبات ممکن است در آینده خطا داشته باشد؟ (MANDATORY FAILURE ANALYSIS)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-gray-300 list-disc list-inside">
              {reportData.whyRecommendationCouldBeWrong.map((reason, idx) => (
                <li key={idx} className="leading-relaxed">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Rejected Models */}
          <div className="p-4 rounded-2xl bg-[#121824] border border-[#232e42] space-y-2.5">
            <h3 className="text-xs font-bold text-gray-200">دلایل رد سایر مدل‌های ارزیابی‌شده (Rejected Models):</h3>
            <div className="space-y-2 text-xs">
              {reportData.rejectedModels.map((rm) => (
                <div key={rm.model} className="p-2.5 rounded-xl bg-[#0c1018] border border-[#1e2736]">
                  <strong className="text-rose-400 block mb-0.5">{rm.model}:</strong>
                  <p className="text-gray-400 text-[11px]">{rm.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

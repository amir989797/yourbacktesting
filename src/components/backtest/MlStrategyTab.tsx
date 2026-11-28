import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Brain,
  Play,
  Square,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
  RefreshCw,
  Layers,
  Activity,
  BarChart3,
  Database,
  Sliders,
} from 'lucide-react';
import {
  ML_FEATURES_META,
  setActiveMlModel,
  type ZigZagMlModel,
  type MlSplitMetrics,
  type MlFeatureCategory,
  type MlTreeNode,
} from '../../utils/zigzagMlEngine';
import { PRETRAINED_XT_5M_ML_MODEL } from '../../utils/pretrainedZigZagMlModel';

interface SavedModelSummary {
  id: string;
  name: string;
  exchange: string;
  timeframe: string;
  datasetId: string;
  isActive: boolean;
  metrics: ZigZagMlModel['metrics'] | null;
  createdAt: string;
}

interface DatasetOption {
  id: string;
  name: string;
  exchange: string;
  timeframe: string;
  symbol_count: number;
  total_candles: number;
  chunk_count: number;
  source?: 'postgres' | 'local' | 'buffer';
}

interface TrainingJobStatus {
  isRunning: boolean;
  shouldStop: boolean;
  stage: string;
  progress: number;
  symbolsProcessed: number;
  totalSymbolsEstimate: number;
  eventsExtracted: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  logs: string[];
  lastTrainedModelId: string | null;
}

interface MlStrategyTabProps {
  onApplyMlStrategyToScanner: (model: ZigZagMlModel) => void;
  onActiveModelChanged?: (model: ZigZagMlModel) => void;
  activeDatasetId?: string | null;
  refreshTrigger?: string | number | null;
}

const CATEGORY_LABELS: Record<MlFeatureCategory, { title: string; colorClass: string; barClass: string }> = {
  legs: { title: '۴ نوع لگ زیگزاگ (سبز/قرمز، آبی CD/EF، سفید)', colorClass: 'text-sky-300', barClass: 'bg-sky-500' },
  harmonic: { title: 'نسبت‌های فیبوناچی و ساختار هارمونیک', colorClass: 'text-amber-300', barClass: 'bg-amber-500' },
  volume: { title: 'مقایسه حجم لگ‌ها (تخلیه و کلایمکس)', colorClass: 'text-emerald-300', barClass: 'bg-emerald-500' },
  structure: { title: 'ساختار قیمت، RSI، EMA و عدم تعقیب', colorClass: 'text-indigo-300', barClass: 'bg-indigo-500' },
};

function formatSignedR(val: number | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return '0.000R';
  return `${val >= 0 ? '+' : ''}${val.toFixed(3)}R`;
}

function formatDatasetCandles(total: number | undefined): string {
  const n = Number(total || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function getTreeDepth(node?: MlTreeNode): number {
  if (!node || node.isLeaf) return 0;
  return 1 + Math.max(getTreeDepth(node.l), getTreeDepth(node.r));
}

function inferModelMaxDepth(model: ZigZagMlModel): number {
  if (typeof model.maxDepth === 'number' && model.maxDepth >= 1) return model.maxDepth;
  if (!Array.isArray(model.trees) || model.trees.length === 0) return 2;
  let d = 0;
  for (const t of model.trees) {
    const td = getTreeDepth(t);
    if (td > d) d = td;
  }
  return Math.max(1, Math.min(6, d || 2));
}

function SplitCard({
  title,
  subtitle,
  metrics,
  highlight,
}: {
  title: string;
  subtitle: string;
  metrics?: MlSplitMetrics;
  highlight?: 'emerald' | 'sky';
}) {
  if (!metrics) return null;
  const isPositive = metrics.avgR >= 0;
  const hasPortfolio = typeof metrics.portfolioTrades === 'number' && metrics.portfolioTrades > 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors flex flex-col justify-between ${
        highlight === 'emerald'
          ? 'bg-emerald-950/20 border-emerald-500/40'
          : highlight === 'sky'
          ? 'bg-sky-950/20 border-sky-500/40'
          : 'bg-[#121620] border-slate-800/90'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100">{title}</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <span
            className={`text-xs font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0 ${
              metrics.profitFactor >= 1.25
                ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                : metrics.profitFactor >= 1.0
                ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                : 'text-rose-300 border-rose-500/40 bg-rose-500/10'
            }`}
          >
            PF {metrics.profitFactor.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="bg-[#0b0e14] rounded-lg p-2.5 border border-slate-800/70">
            <div className="text-[11px] text-slate-400">میانگین بازده (Avg R)</div>
            <div
              className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatSignedR(metrics.avgR)}
            </div>
          </div>
          <div className="bg-[#0b0e14] rounded-lg p-2.5 border border-slate-800/70">
            <div className="text-[11px] text-slate-400">نرخ برد (Win Rate)</div>
            <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-100 mt-0.5">
              {metrics.winRate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] border-t border-slate-800/80 pt-2.5">
          <div>
            <div className="text-slate-500">تعداد سیگنال</div>
            <div className="font-mono tabular-nums text-slate-200 font-semibold mt-0.5">
              {metrics.totalSignals.toLocaleString('en-US')}
            </div>
          </div>
          <div>
            <div className="text-slate-500">مجموع سود (R)</div>
            <div
              className={`font-mono tabular-nums font-semibold mt-0.5 ${
                metrics.sumR >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.sumR >= 0 ? '+' : ''}
              {metrics.sumR.toFixed(1)}R
            </div>
          </div>
          <div>
            <div className="text-slate-500">Long / Short</div>
            <div className="font-mono tabular-nums text-slate-200 font-semibold mt-0.5" dir="ltr">
              <span className={metrics.longAvgR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                L:{metrics.longAvgR >= 0 ? '+' : ''}
                {metrics.longAvgR.toFixed(2)}
              </span>{' '}
              <span className="text-slate-600">/</span>{' '}
              <span className={metrics.shortAvgR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                S:{metrics.shortAvgR >= 0 ? '+' : ''}
                {metrics.shortAvgR.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {hasPortfolio && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] bg-[#0b0e14]/80 -mx-1 px-2.5 py-1.5 rounded-lg">
          <span className="text-slate-400 shrink-0">سبد تک‌پوزیشن ({metrics.portfolioTrades})</span>
          <div className="font-mono tabular-nums flex items-center gap-1.5" dir="ltr">
            <span className="text-slate-200 font-semibold">
              WR {metrics.portfolioWinRate.toFixed(1)}%
            </span>
            <span className="text-slate-600">•</span>
            <span className={metrics.portfolioProfitFactor >= 1.15 ? 'text-emerald-400 font-bold' : metrics.portfolioProfitFactor >= 1.0 ? 'text-amber-300 font-bold' : 'text-rose-400 font-bold'}>
              PF {metrics.portfolioProfitFactor.toFixed(2)}
            </span>
            <span className="text-slate-600">•</span>
            <span className={metrics.portfolioSumR >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {metrics.portfolioSumR >= 0 ? '+' : ''}{metrics.portfolioSumR.toFixed(1)}R
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">DD {metrics.portfolioMaxDdR.toFixed(1)}R</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const MlStrategyTab: React.FC<MlStrategyTabProps> = ({
  onApplyMlStrategyToScanner,
  onActiveModelChanged,
  activeDatasetId,
  refreshTrigger,
}) => {
  const [activeModel, setActiveModel] = useState<ZigZagMlModel>(PRETRAINED_XT_5M_ML_MODEL);
  const [savedModels, setSavedModels] = useState<SavedModelSummary[]>([]);
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Training Studio form state (simplified high-impact controls; always BOTH directions)
  const [datasetId, setDatasetId] = useState('');
  const [modelName, setModelName] = useState('مدل XT 5m ZigZag v7 دوجهته');
  const [minCandles, setMinCandles] = useState(4);
  const [atrMultiplier, setAtrMultiplier] = useState(3.5);
  const [slAtrMult, setSlAtrMult] = useState(5.5);
  const [minSlPct, setMinSlPct] = useState(3.5);
  const [targetRR, setTargetRR] = useState(1.45);
  const [tpAtrMult, setTpAtrMult] = useState(7.98);
  const [beTriggerR, setBeTriggerR] = useState(0.75);
  const [beLockR, setBeLockR] = useState(0.20);
  const [timeStopCandles, setTimeStopCandles] = useState(150);
  const [numTrees, setNumTrees] = useState(45);
  const [maxDepth, setMaxDepth] = useState(2);
  const [l2Lambda, setL2Lambda] = useState(1000);
  const [topPercent, setTopPercent] = useState(6);
  const [objective, setObjective] = useState<'blended' | 'expected_r' | 'win_prob'>('blended');
  const [activateAfterTrain, setActivateAfterTrain] = useState(true);

  const [jobStatus, setJobStatus] = useState<TrainingJobStatus>({
    isRunning: false,
    shouldStop: false,
    stage: 'idle',
    progress: 0,
    symbolsProcessed: 0,
    totalSymbolsEstimate: 0,
    eventsExtracted: 0,
    startedAt: null,
    finishedAt: null,
    error: null,
    logs: [],
    lastTrainedModelId: null,
  });

  const pollTimerRef = useRef<number | null>(null);
  const lastSyncedModelIdRef = useRef<string | null>(null);
  const datasetsRef = useRef<DatasetOption[]>([]);

  const syncStudioFromModel = useCallback((model: ZigZagMlModel, availableDatasets?: DatasetOption[], preferredDsId?: string | null) => {
    const zp = model.zigzagParams;
    if (zp) {
      setMinCandles(zp.minCandles ?? 4);
      setAtrMultiplier(zp.atrMultiplier ?? 3.5);
    }
    const nextSl = model.slAtrMult ?? 5.5;
    const nextRR =
      model.targetRR && model.targetRR > 0
        ? Number(model.targetRR.toFixed(2))
        : (nextSl > 0 && model.tpAtrMult > 0 ? Number((model.tpAtrMult / nextSl).toFixed(2)) : 1.45);
    const nextTp =
      model.tpAtrMult && model.tpAtrMult > 0
        ? Number(model.tpAtrMult.toFixed(2))
        : Number((nextSl * nextRR).toFixed(2));

    setSlAtrMult(nextSl);
    setMinSlPct(model.minSlPct ?? 3.5);
    setTargetRR(nextRR);
    setTpAtrMult(nextTp);
    setBeTriggerR(model.beTriggerR ?? 0);
    setBeLockR(model.beLockR ?? 0);
    setTimeStopCandles(model.timeStopCandles ?? 150);
    setNumTrees(Array.isArray(model.trees) && model.trees.length > 0 ? Math.min(80, model.trees.length) : 45);
    setMaxDepth(inferModelMaxDepth(model));
    setL2Lambda(model.l2Lambda ?? 1000);
    setTopPercent(model.topPercent ?? 6);
    setObjective(model.objective ?? 'blended');

    const dsList = availableDatasets && availableDatasets.length > 0 ? availableDatasets : datasetsRef.current;
    if (preferredDsId && dsList.some((d) => d.id === preferredDsId)) {
      setDatasetId(preferredDsId);
    } else if (model.datasetId && dsList.some((d) => d.id === model.datasetId)) {
      setDatasetId(model.datasetId);
    } else if (dsList.length > 0) {
      setDatasetId(dsList[0].id);
    }
    lastSyncedModelIdRef.current = model.id;
  }, []);

  const handleSlAtrChange = (val: number) => {
    setSlAtrMult(val);
    if (val > 0 && targetRR > 0) {
      setTpAtrMult(Number((val * targetRR).toFixed(2)));
    }
  };

  const handleTargetRRChange = (val: number) => {
    setTargetRR(val);
    if (val > 0 && slAtrMult > 0) {
      setTpAtrMult(Number((slAtrMult * val).toFixed(2)));
    }
  };

  const fetchMlState = useCallback(async (forceSyncStudio = false) => {
    try {
      const resp = await fetch('/api/ml/active-model');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const loadedDatasets: DatasetOption[] = Array.isArray(data.datasets) ? data.datasets : [];
      const preferredDsId =
        (activeDatasetId && loadedDatasets.some((d) => d.id === activeDatasetId) ? activeDatasetId : null) ||
        (data.activeBacktestDatasetId && loadedDatasets.some((d) => d.id === data.activeBacktestDatasetId)
          ? data.activeBacktestDatasetId
          : null);

      datasetsRef.current = loadedDatasets;
      setDatasets(loadedDatasets);
      setDatasetId((prev) => {
        if (preferredDsId && (!prev || forceSyncStudio || !loadedDatasets.some((d) => d.id === prev))) {
          return preferredDsId;
        }
        if (prev && loadedDatasets.some((d) => d.id === prev)) return prev;
        return preferredDsId || loadedDatasets[0]?.id || '';
      });

      if (data.success && data.activeModel) {
        setActiveModel(data.activeModel);
        setActiveMlModel(data.activeModel);
        onActiveModelChanged?.(data.activeModel);
        if (forceSyncStudio || lastSyncedModelIdRef.current !== data.activeModel.id) {
          syncStudioFromModel(data.activeModel, loadedDatasets, preferredDsId);
        }
      }
      if (Array.isArray(data.savedModels)) setSavedModels(data.savedModels);
      if (data.trainingStatus) setJobStatus(data.trainingStatus);
    } catch (err: any) {
      setFeedback({ type: 'error', text: `خطا در بارگذاری وضعیت مدل ML: ${err?.message || ''}` });
    } finally {
      setLoading(false);
    }
  }, [activeDatasetId, onActiveModelChanged, syncStudioFromModel]);

  useEffect(() => {
    fetchMlState();
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [fetchMlState, refreshTrigger]);

  useEffect(() => {
    if (!jobStatus.isRunning) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    pollTimerRef.current = window.setInterval(async () => {
      try {
        const resp = await fetch('/api/ml/train-status');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.success && data.status) {
          setJobStatus(data.status);
          if (!data.status.isRunning) {
            await fetchMlState();
          }
        }
      } catch {}
    }, 1500);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobStatus.isRunning, fetchMlState]);

  const handleStartTraining = async () => {
    setFeedback(null);
    if (!datasetId || datasets.length === 0) {
      setFeedback({
        type: 'error',
        text: 'هیچ دیتاست کندلی در سرور (PostgreSQL یا کش لوکال) ذخیره نشده است. ابتدا در تب «اسکن دستی» اسکن را اجرا کنید.',
      });
      return;
    }
    try {
      const resp = await fetch('/api/ml/train-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          modelName: modelName.trim() || 'مدل XT 5m ZigZag GBDT دوجهته',
          atrPeriod: 17,
          minCandles,
          atrMultiplier,
          minCandlesForLongLeg: 12,
          longLegAtrMultiplier: 15,
          minCandlesForBlueLeg: 7,
          blueLegAtrMultiplier: 4.75,
          maxBlueLegPercent: 95,
          maxBreakoutAtrMultiplier: 4,
          slAtrMult,
          minSlPct,
          targetRR,
          tpAtrMult,
          beTriggerR,
          beLockR,
          timeStopCandles,
          minAtrPct: 0.30,
          minStretchPct: 0,
          numTrees,
          learningRate: 0.025,
          maxDepth,
          l2Lambda,
          topPercent,
          objective,
          sideFilter: 'BOTH',
          maxChunks: 1000,
          activateAfterTrain,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'شروع آموزش ناموفق بود');
      }
      setJobStatus((prev) => ({
        ...prev,
        isRunning: true,
        progress: 2,
        stage: 'در حال اتصال به دیتاست PostgreSQL...',
        error: null,
      }));
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'خطا در شروع آموزش' });
    }
  };

  const handleStopTraining = async () => {
    try {
      await fetch('/api/ml/train-stop', { method: 'POST' });
    } catch {}
  };

  const handleActivateModel = async (modelId: string) => {
    setActionBusy(modelId);
    setFeedback(null);
    try {
      const resp = await fetch('/api/ml/activate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'خطا در فعال‌سازی مدل');
      if (data.activeModel) {
        setActiveModel(data.activeModel);
        setActiveMlModel(data.activeModel);
        syncStudioFromModel(data.activeModel);
        onActiveModelChanged?.(data.activeModel);
      }
      await fetchMlState(true);
      setFeedback({
        type: 'success',
        text: 'مدل انتخاب‌شده فعال شد و تمام پارامترهای آن در استودیوی آموزشی بارگذاری شدند.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'خطا در فعال‌سازی' });
    } finally {
      setActionBusy(null);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    setActionBusy(modelId);
    setFeedback(null);
    try {
      const resp = await fetch('/api/ml/delete-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'خطا در حذف مدل');
      await fetchMlState();
      setFeedback({ type: 'success', text: 'مدل از دیتابیس حذف شد.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'خطا در حذف مدل' });
    } finally {
      setActionBusy(null);
    }
  };

  const featureMetaMap = useMemo(() => {
    const m = new Map<string, (typeof ML_FEATURES_META)[number]>();
    for (const item of ML_FEATURES_META) m.set(item.key, item);
    return m;
  }, []);

  const categoryBreakdown = useMemo(() => {
    const totals: Record<MlFeatureCategory, number> = { legs: 0, harmonic: 0, volume: 0, structure: 0 };
    const totalGain = (activeModel.featureImportance || []).reduce((s, f) => s + (f.gain || 0), 0) || 1;
    for (const fi of activeModel.featureImportance || []) {
      const meta = featureMetaMap.get(fi.name);
      if (meta) totals[meta.category] += fi.gain || 0;
    }
    return (['legs', 'harmonic', 'volume', 'structure'] as MlFeatureCategory[])
      .map((cat) => ({
        category: cat,
        pct: (totals[cat] / totalGain) * 100,
        ...CATEGORY_LABELS[cat],
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [activeModel, featureMetaMap]);

  const topFeatures = useMemo(() => {
    const list = activeModel.featureImportance || [];
    const totalGain = list.reduce((s, f) => s + (f.gain || 0), 0) || 1;
    return list.slice(0, 10).map((f) => ({
      ...f,
      pct: f.weightPct ?? (f.gain / totalGain) * 100,
      meta: featureMetaMap.get(f.name),
    }));
  }, [activeModel, featureMetaMap]);

  const rrRatio = activeModel.slAtrMult > 0 ? activeModel.tpAtrMult / activeModel.slAtrMult : 2.0;

  return (
    <div className="space-y-5 text-slate-200" dir="rtl">
      {/* Top Active Model Summary Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#121620] p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                {activeModel.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              مدل Gradient Boosted Decision Trees کاملاً علّی (بدون نگاه به آینده و بدون ریپینت) آموزش‌دیده روی داده‌های واقعی{' '}
              <span className="font-mono text-slate-200">
                {activeModel.exchange.toUpperCase()} • {activeModel.timeframe}
              </span>{' '}
              با لحاظ کارمزد کامل ورود/خروج (<span className="font-mono">0.06% + 0.06%</span>)، اسلیپیج استاپ (<span className="font-mono">0.04%</span>)، فیلتر بازارهای قفل‌شده و بررسی خودکار تایم‌فریم‌های بالاتر (<span className="font-mono">3×TF / 12×TF / 48×TF / 288×TF / EMA600</span>) در همه تایم‌فریم‌های <span className="font-mono">5m, 15m, 1h, 4h</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchMlState()}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-[#1a2030] hover:bg-[#232b40] border border-slate-700/80 text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              بروزرسانی
            </button>
            <button
              type="button"
              onClick={() => onApplyMlStrategyToScanner(activeModel)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              اعمال روی اسکن دستی (استراتژی ۴)
            </button>
          </div>
        </div>

        {/* Active Model Specs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-slate-800/80 text-xs">
          <div className="bg-[#0b0e14] rounded-lg px-3 py-2 border border-slate-800/70">
            <div className="text-[10px] text-slate-500">تنظیم زیگزاگ مدل</div>
            <div className="font-mono tabular-nums text-slate-200 mt-0.5">
              ATR({activeModel.zigzagParams.atrPeriod}) × {activeModel.zigzagParams.atrMultiplier} • Min {activeModel.zigzagParams.minCandles}
            </div>
          </div>
          <div className="bg-[#0b0e14] rounded-lg px-3 py-2 border border-slate-800/70">
            <div className="text-[10px] text-slate-500">لگ غول‌پیکر / آبی CD,EF</div>
            <div className="font-mono tabular-nums text-slate-200 mt-0.5">
              {activeModel.zigzagParams.longLegAtrMultiplier}A / {activeModel.zigzagParams.blueLegAtrMultiplier}A
            </div>
          </div>
          <div className="bg-[#0b0e14] rounded-lg px-3 py-2 border border-slate-800/70">
            <div className="text-[10px] text-slate-500">حد ضرر ضداسویپ / تارگت / BE</div>
            <div className="font-mono tabular-nums text-emerald-300 mt-0.5">
              {activeModel.minSlPct
                ? `SL max(${activeModel.minSlPct}%, ${activeModel.slAtrMult}A) • ${(activeModel.targetRR || rrRatio).toFixed(2)}R`
                : `SL ${activeModel.slAtrMult}A • TP ${activeModel.tpAtrMult}A (${rrRatio.toFixed(1)}R)`}
              {activeModel.beTriggerR && activeModel.beTriggerR > 0
                ? ` • BE ${activeModel.beTriggerR}→+${(activeModel.beLockR ?? 0).toFixed(2)}R`
                : ''}
            </div>
          </div>
          <div className="bg-[#0b0e14] rounded-lg px-3 py-2 border border-slate-800/70">
            <div className="text-[10px] text-slate-500">خروج زمانی / پیش‌فیلتر کشیدگی</div>
            <div className="font-mono tabular-nums text-slate-200 mt-0.5">
              {activeModel.timeStopCandles} کندل{activeModel.minStretchPct ? ` • Stretch ≥${activeModel.minStretchPct}%` : ''}
            </div>
          </div>
          <div className="bg-[#0b0e14] rounded-lg px-3 py-2 border border-slate-800/70">
            <div className="text-[10px] text-slate-500">ساختار درخت GBDT / جهت</div>
            <div className="font-mono tabular-nums text-slate-200 mt-0.5">
              {activeModel.trees.length} درخت (عمق {inferModelMaxDepth(activeModel)} • {activeModel.featureNames?.length || 59} ویژگی) • دوجهته (لانگ+شورت) • آستانه {activeModel.scoreThreshold.toFixed(4)}
            </div>
          </div>
          <div className="bg-[#0b0e14] rounded-lg px-3 py-2 border border-slate-800/70">
            <div className="text-[10px] text-slate-500">حجم دیتای بررسی‌شده</div>
            <div className="font-mono tabular-nums text-slate-200 mt-0.5">
              {activeModel.metrics?.totalSymbols || 0} نماد • {(activeModel.metrics?.totalEvents || 0).toLocaleString('en-US')} رویداد
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs mr-3"
          >
            بستن
          </button>
        </div>
      )}

      {/* Strict Chronological Train / Validation / OOS / Unseen-Coins Verification */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            اعتبارسنجی زمانی و ارزی سخت‌گیرانه (تقسیم ترتیبی + تست روی ارزهای کاملاً جدید)
          </h4>
          <span className="text-[11px] text-slate-500">
            آستانه ورود صرفاً روی داده Validation تنظیم شده؛ تست‌های OOS و Unseen کاملاً دست‌نخورده‌اند
          </span>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-3.5 ${
            activeModel.metrics?.unseenSymbolsOos ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
          }`}
        >
          <SplitCard
            title="داده آموزش (Train — ۴۵٪ ابتدای بازه)"
            subtitle="ساخت درخت‌های تصمیم روی ابتدای تاریخ"
            metrics={activeModel.metrics?.train}
          />
          <SplitCard
            title="داده اعتبارسنجی (Validation — ۲۵٪ میانی)"
            subtitle={`تنظیم آستانه (Top ${activeModel.topPercent || 5}%) بدون دیدن آینده`}
            metrics={activeModel.metrics?.validation}
          />
          <SplitCard
            title="تست خارج از نمونه (Untouched OOS — ۳۰٪ پایانی)"
            subtitle="ارزیابی واقعی روی آینده بازار (لانگ و شورت)"
            metrics={activeModel.metrics?.oos}
            highlight="emerald"
          />
          {activeModel.metrics?.unseenSymbolsOos && (
            <SplitCard
              title="ارزهای کاملاً جدید (Unseen Coins OOS)"
              subtitle="۲۰٪ نمادهای هرگز دیده‌نشده در بازه آینده"
              metrics={activeModel.metrics.unseenSymbolsOos}
              highlight="sky"
            />
          )}
        </div>
      </div>

      {/* Feature Importance + Discovered ZigZag Patterns */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* 4 Pillars + Top Features */}
        <div className="xl:col-span-5 rounded-xl border border-slate-800 bg-[#121620] p-4 flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-sky-400" />
              سهم ۴ ستون متادیتای زیگزاگ در تصمیم‌گیری مدل
            </h4>
            <div className="space-y-2.5">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={item.colorClass}>{item.title}</span>
                    <span className="font-mono tabular-nums text-slate-300 font-semibold">
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.barClass}`}
                      style={{ width: `${Math.min(100, Math.max(2, item.pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-3.5">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-2.5">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              ۱۰ ویژگی برتر مؤثر در پیش‌بینی سوددهی
            </h4>
            <div className="space-y-2">
              {topFeatures.map((feat, idx) => (
                <div
                  key={feat.name}
                  className="flex items-center justify-between gap-2 text-[11px] bg-[#0b0e14] rounded-lg px-2.5 py-1.5 border border-slate-800/60"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-slate-500 ml-1.5">{idx + 1}.</span>
                    <span className="text-slate-200 font-medium">
                      {feat.meta?.labelFa || feat.name}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-emerald-300 font-semibold shrink-0">
                    {feat.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Discovered Profitable ZigZag Patterns Table */}
        <div className="xl:col-span-7 rounded-xl border border-slate-800 bg-[#121620] p-4 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold text-slate-200">
              الگوهای زیگزاگ کشف‌شده توسط مدل (مقایسه Train در برابر Out-of-Sample)
            </h4>
            <span className="text-[11px] text-slate-500">با احتساب کامل کارمزد XT و اسلیپیج</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2 pl-3 font-medium">الگو و ترکیب متادیتا</th>
                  <th className="py-2 px-2 font-medium text-center">Train (WR / PF)</th>
                  <th className="py-2 px-2 font-medium text-center">OOS تعداد</th>
                  <th className="py-2 px-2 font-medium text-center">OOS WinRate</th>
                  <th className="py-2 px-2 font-medium text-center">OOS Avg R</th>
                  <th className="py-2 pr-2 font-medium text-left">OOS PF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(activeModel.discoveredPatterns || []).map((pat, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 pl-3">
                      <div className="font-semibold text-slate-100">{pat.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5" dir="ltr">
                        {pat.rule}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-400">
                      {pat.trainWinRate.toFixed(1)}% / {pat.trainPf.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-200">
                      {pat.oosCount.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-100 font-semibold">
                      {pat.oosWinRate.toFixed(1)}%
                    </td>
                    <td
                      className={`py-2.5 px-2 text-center font-mono tabular-nums font-bold ${
                        pat.oosAvgR >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSignedR(pat.oosAvgR)}
                    </td>
                    <td className="py-2.5 pr-2 text-left">
                      <span
                        className={`font-mono tabular-nums font-bold ${
                          pat.oosPf >= 1.15
                            ? 'text-emerald-400'
                            : pat.oosPf >= 1.0
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {pat.oosPf.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Training Studio + Saved Models Manager */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Training Studio */}
        <div className="xl:col-span-7 rounded-xl border border-slate-800 bg-[#121620] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              استودیوی آموزش مدل جدید روی دیتای دیتاست
            </h4>
            <button
              type="button"
              disabled={jobStatus.isRunning}
              onClick={() => syncStudioFromModel(activeModel)}
              className="px-2.5 py-1 rounded text-[11px] bg-[#0b0e14] hover:bg-slate-800 border border-slate-700/80 text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
              title="بارگذاری مجدد پارامترهای دقیق مدل فعال در فرم استودیو"
            >
              همگام با مدل فعال
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">دیتاست کندل (PostgreSQL / کش سرور)</span>
              <select
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                disabled={jobStatus.isRunning || datasets.length === 0}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              >
                {datasets.length === 0 ? (
                  <option value="">هیچ دیتاست کندلی در سرور ذخیره نشده است</option>
                ) : (
                  datasets.map((d) => {
                    const srcLabel = d.source === 'local' ? 'کش سرور' : d.source === 'buffer' ? 'حافظه اسکن' : 'PostgreSQL';
                    const dsLabel = d.name && !d.name.startsWith('range_') ? d.name : `${(d.exchange || 'xt').toUpperCase()} ${d.timeframe}`;
                    return (
                      <option key={d.id} value={d.id}>
                        {dsLabel} — {d.symbol_count} نماد ({formatDatasetCandles(d.total_candles)} کندل) [{srcLabel}]
                      </option>
                    );
                  })
                )}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">نام مدل جدید</span>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          {datasets.length === 0 && (
            <div className="rounded-lg bg-amber-950/25 border border-amber-500/35 px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
              برای آموزش مدل جدید، ابتدا از تب <strong>اسکن دستی</strong> یک بازه کندل (مثلاً ۱ ماه اخیر) را اسکن کنید تا دیتاست به‌صورت خودکار در PostgreSQL یا کش سرور ذخیره شود. مدل آماده فعلی (<span className="font-mono">v{activeModel.version || 4}</span>) بدون نیاز به دیتاست کندل در ترید زنده و بکتست کار می‌کند.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">ضریب زیگزاگ ATR</span>
              <input
                type="number"
                step="0.25"
                min={0.5}
                max={8}
                value={atrMultiplier}
                onChange={(e) => setAtrMultiplier(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">حداقل کندل لگ</span>
              <input
                type="number"
                min={2}
                max={30}
                value={minCandles}
                onChange={(e) => setMinCandles(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400">حد ضرر (SL: ATR / %)</span>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  step="0.25"
                  min={1.5}
                  max={10}
                  value={slAtrMult}
                  onChange={(e) => handleSlAtrChange(Number(e.target.value))}
                  disabled={jobStatus.isRunning}
                  title="ضریب SL برحسب ATR"
                  className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-1.5 py-1.5 font-mono text-slate-100"
                />
                <input
                  type="number"
                  step="0.25"
                  min={0.5}
                  max={12}
                  value={minSlPct}
                  onChange={(e) => setMinSlPct(Number(e.target.value))}
                  disabled={jobStatus.isRunning}
                  title="حداقل درصد SL ضداسویپ (%)"
                  className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-1.5 py-1.5 font-mono text-slate-100"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-emerald-300 font-semibold">تارگت سود (R:R)</span>
              <input
                type="number"
                step="0.1"
                min={0.5}
                max={10}
                value={targetRR}
                onChange={(e) => handleTargetRRChange(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                title={`TP = SL × ${targetRR.toFixed(2)} (${(slAtrMult * targetRR).toFixed(2)}A)`}
                className="w-full rounded-lg bg-[#0b0e14] border border-emerald-500/50 px-2 py-1.5 font-mono text-emerald-300 font-semibold"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400">محافظ سر‌به‌سر (BE Trig / Lock R)</span>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={2}
                  value={beTriggerR}
                  onChange={(e) => setBeTriggerR(Number(e.target.value))}
                  disabled={jobStatus.isRunning}
                  title="آستانه سود برحسب R برای انتقال SL (۰=غیرفعال)"
                  className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-1.5 py-1.5 font-mono text-slate-100"
                />
                <input
                  type="number"
                  step="0.05"
                  min={-0.5}
                  max={1}
                  value={beLockR}
                  onChange={(e) => setBeLockR(Number(e.target.value))}
                  disabled={jobStatus.isRunning}
                  title="میزان سود قفل‌شده پس از BE (واحد R)"
                  className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-1.5 py-1.5 font-mono text-slate-100"
                />
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">Time-Stop (کندل)</span>
              <input
                type="number"
                min={20}
                max={400}
                value={timeStopCandles}
                onChange={(e) => setTimeStopCandles(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">فیلتر نخبگان (Top Ratio)</span>
              <input
                type="number"
                step="0.5"
                min={1}
                max={25}
                value={topPercent}
                onChange={(e) => setTopPercent(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">تعداد درخت (Trees)</span>
              <input
                type="number"
                min={20}
                max={120}
                value={numTrees}
                onChange={(e) => setNumTrees(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">عمق درخت (Max Depth)</span>
              <input
                type="number"
                min={1}
                max={4}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">رگولاریزاسیون L2</span>
              <input
                type="number"
                min={100}
                max={2000}
                value={l2Lambda}
                onChange={(e) => setL2Lambda(Number(e.target.value))}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 font-mono text-slate-100"
              />
            </label>
            <label className="space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] text-slate-400">تابع هدف (Objective)</span>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as 'blended' | 'expected_r' | 'win_prob')}
                disabled={jobStatus.isRunning}
                className="w-full rounded-lg bg-[#0b0e14] border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="blended">ترکیبی (WR + Expected R)</option>
                <option value="win_prob">احتمال برد (Win Prob)</option>
                <option value="expected_r">میانگین سود (Expected R)</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={activateAfterTrain}
                onChange={(e) => setActivateAfterTrain(e.target.checked)}
                disabled={jobStatus.isRunning}
                className="rounded border-slate-600 bg-slate-900 accent-emerald-500"
              />
              فعال‌سازی خودکار مدل جدید پس از پایان آموزش
            </label>

            <div className="flex items-center gap-2">
              {jobStatus.isRunning ? (
                <button
                  type="button"
                  onClick={handleStopTraining}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  توقف آموزش
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartTraining}
                  disabled={datasets.length === 0}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5" />
                  شروع آموزش مدل جدید (ML)
                </button>
              )}
            </div>
          </div>

          {/* Live Training Progress */}
          {(jobStatus.isRunning || jobStatus.logs.length > 0) && (
            <div className="rounded-lg bg-[#0b0e14] border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">{jobStatus.stage}</span>
                <span className="font-mono tabular-nums text-sky-400 font-bold">
                  {jobStatus.progress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    jobStatus.error ? 'bg-rose-500' : 'bg-sky-500'
                  }`}
                  style={{ width: `${jobStatus.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                <span>نمادهای پردازش‌شده: {jobStatus.symbolsProcessed}</span>
                <span>رویدادهای علّی: {jobStatus.eventsExtracted.toLocaleString('en-US')}</span>
              </div>
              {jobStatus.logs.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                  {jobStatus.logs.slice(0, 8).map((line, i) => (
                    <div key={i} className="leading-snug">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved Models Manager */}
        <div className="xl:col-span-5 rounded-xl border border-slate-800 bg-[#121620] p-4 flex flex-col">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-emerald-400" />
            مدل‌های ذخیره‌شده در PostgreSQL ({savedModels.length})
          </h4>

          <div className="space-y-2.5 overflow-y-auto max-h-[380px] flex-1">
            {savedModels.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                مدل پیش‌فرض XT.COM 5m بارگذاری شده است.
              </div>
            ) : (
              savedModels.map((m) => {
                const isAct = m.id === activeModel.id || m.isActive;
                const oos = m.metrics?.oos;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (!isAct && actionBusy !== m.id) {
                        handleActivateModel(m.id);
                      } else if (isAct) {
                        syncStudioFromModel(activeModel);
                      }
                    }}
                    className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                      isAct
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-[#0b0e14] border-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                          {isAct && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          <span className="truncate">{m.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
                          {m.exchange.toUpperCase()} • {m.timeframe}
                          {oos ? (
                            <span className="mr-2">
                              | OOS: WR {oos.winRate}% • PF {oos.profitFactor} •{' '}
                              <span className={oos.avgR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {formatSignedR(oos.avgR)}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isAct && (
                          <button
                            type="button"
                            disabled={actionBusy === m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateModel(m.id);
                            }}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 cursor-pointer"
                          >
                            فعال‌سازی
                          </button>
                        )}
                        {m.id !== PRETRAINED_XT_5M_ML_MODEL.id && (
                          <button
                            type="button"
                            disabled={actionBusy === m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModel(m.id);
                            }}
                            title="حذف مدل"
                            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

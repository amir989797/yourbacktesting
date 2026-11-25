import type { CandleData } from '../types/crypto';
import {
  calculateATR,
  calculateRSI,
  analyzeZigZagLegs,
  type ZigZagPoint,
} from './indicators';

export interface MlTreeNode {
  isLeaf: boolean;
  v: number;
  f?: number;
  th?: number;
  l?: MlTreeNode;
  r?: MlTreeNode;
}

export type MlFeatureCategory = 'legs' | 'harmonic' | 'volume' | 'structure';

export interface MlFeatureMeta {
  index: number;
  key: string;
  labelFa: string;
  category: MlFeatureCategory;
  descriptionFa: string;
}

export const ML_FEATURES_META: MlFeatureMeta[] = [
  { index: 0, key: 'atrPct', labelFa: 'نوسان نسبی ATR (%) — سپر کارمزد', category: 'structure', descriptionFa: 'نسبت ATR به قیمت برای حذف بازارهای مرده و کاهش سهم کارمزد صرافی XT' },
  { index: 1, key: 'confirmDistAtr', labelFa: 'فاصله ورود تا پیوت P1 (ATR)', category: 'structure', descriptionFa: 'فاصله قیمت بسته شدن کندل تایید تا پیوت؛ ورود بدون تعقیب قیمت' },
  { index: 2, key: 'confirmBody', labelFa: 'بدنه کندل تایید (جهت ورود)', category: 'structure', descriptionFa: 'نسبت بدنه کندل تایید در جهت بازگشت برای کیفیت نقطه ورود' },
  { index: 3, key: 'l1_type', labelFa: 'نوع لگ آخر L1 (۴ رنگ زیگزاگ)', category: 'legs', descriptionFa: '۰=سفید، ۱=غول‌پیکر سبز/قرمز، ۲=آبی کم‌رنگ CD، ۳=آبی پررنگ EF' },
  { index: 4, key: 'l2_type', labelFa: 'نوع لگ قبلی L2 (۴ رنگ زیگزاگ)', category: 'legs', descriptionFa: 'رنگ لگ پیش از L1 برای تشخیص توالی‌های چندلگی زیگزاگ' },
  { index: 5, key: 'giantCnt4', labelFa: 'تعداد لگ سبز/قرمز (۴ لگ آخر)', category: 'legs', descriptionFa: 'تعداد لگ‌های غول‌پیکر در ۴ لگ اخیر زیگزاگ' },
  { index: 6, key: 'blueCnt4', labelFa: 'تعداد لگ آبی CD/EF (۴ لگ آخر)', category: 'legs', descriptionFa: 'تعداد لگ‌های آبی کم‌رنگ و پررنگ استراتژی ۲ در ۴ لگ اخیر' },
  { index: 7, key: 'whiteStreak', labelFa: 'توالی لگ‌های سفید پیاپی', category: 'legs', descriptionFa: 'تعداد لگ‌های سفید متوالی منتهی به پیوت فعلی' },
  { index: 8, key: 'l1_atr', labelFa: 'قدرت لگ آخر L1 (واحد ATR)', category: 'legs', descriptionFa: 'طول لگ آخر برحسب مضرب ATR' },
  { index: 9, key: 'l1_pct', labelFa: 'درصد حرکت لگ آخر L1 (%)', category: 'legs', descriptionFa: 'درصد تغییر قیمت از پیوت P2 تا پیوت P1' },
  { index: 10, key: 'l1_speed', labelFa: 'سرعت لگ آخر (ATR/کندل)', category: 'legs', descriptionFa: 'شدت شتاب قیمتی لگ آخر در هر کندل ۵ دقیقه‌ای' },
  { index: 11, key: 'r12', labelFa: 'نسبت فیبوناچی L1 / L2', category: 'harmonic', descriptionFa: 'نسبت اصلاحی یا امتدادی لگ آخر نسبت به لگ مخالف قبلی' },
  { index: 12, key: 'r13', labelFa: 'نسبت هارمونیک AB=CD (L1/L3)', category: 'harmonic', descriptionFa: 'مقایسه اندازه لگ آخر با لگ هم‌جهت قبلی' },
  { index: 13, key: 'imp_vs_corr', labelFa: 'نسبت شتاب به اصلاح (L1+L3)/(L2+L4)', category: 'harmonic', descriptionFa: 'توازن کلی بین دو لگ هم‌جهت و دو لگ اصلاحی' },
  { index: 14, key: 'harm_XD', labelFa: 'نسبت هارمونیک XD / XA', category: 'harmonic', descriptionFa: 'نسبت کلیدی الگوهای Gartley (0.786)، Bat (0.886)، Butterfly (1.272) و Crab (1.618)' },
  { index: 15, key: 'harm_XB', labelFa: 'نسبت هارمونیک XB / XA', category: 'harmonic', descriptionFa: 'نسبت اصلاح موج اول در ساختارهای ۵ پیوتی هارمونیک' },
  { index: 16, key: 'harm_BestErr', labelFa: 'خطای تطابق الگوی هارمونیک', category: 'harmonic', descriptionFa: 'فاصله تا نزدیک‌ترین الگوی کلاسیک Gartley / Bat / Butterfly / Crab / AB=CD' },
  { index: 17, key: 'vol_1v2', labelFa: 'مقایسه حجم L1 به L2', category: 'volume', descriptionFa: 'میانگین حجم کندل‌های لگ آخر تقسیم بر لگ مخالف قبلی' },
  { index: 18, key: 'vol_1v3', labelFa: 'تخلیه حجم لگ هم‌جهت L1 / L3', category: 'volume', descriptionFa: 'کاهش میانگین حجم در لگ دوم هم‌جهت نشانه تخلیه قدرت روند قبلی است' },
  { index: 19, key: 'volTot_1v3', labelFa: 'نسبت کل حجم L1 به L3', category: 'volume', descriptionFa: 'مقایسه مجموع حجم معاملات کل لگ آخر نسبت به لگ هم‌جهت قبلی' },
  { index: 20, key: 'volGr_1', labelFa: 'رشد حجم درونی لگ L1', category: 'volume', descriptionFa: 'تغییر حجم نیمه دوم لگ نسبت به نیمه اول آن' },
  { index: 21, key: 'vol_p1_climax', labelFa: 'اوج حجم کلایمکس در پیوت P1', category: 'volume', descriptionFa: 'حجم کندل تشکیل پیوت P1 نسبت به میانگین حجم کل لگ L1' },
  { index: 22, key: 'p1_brk_p3', labelFa: 'شکست پیوت قبلی (Sweep P3)', category: 'structure', descriptionFa: 'آیا پیوت P1 نقدینگی پشت پیوت هم‌نوع قبلی P3 را جمع کرده است' },
  { index: 23, key: 'brk_depth_p3', labelFa: 'عمق شکست پیوت P3 (ATR)', category: 'structure', descriptionFa: 'میزان نفوذ قیمت فراتر از پیوت P3 برحسب ATR' },
  { index: 24, key: 'rsi_conf', labelFa: 'اشباع RSI(14) در کندل تایید', category: 'structure', descriptionFa: 'شدت اشباع خرید یا فروش در کندل تایید ورود' },
  { index: 25, key: 'rsi_p1', labelFa: 'اشباع RSI(14) در نقطه پیوت P1', category: 'structure', descriptionFa: 'شدت اشباع RSI دقیقاً روی پیوت بازگشتی (مشابه فیلتر RSI استراتژی ۲)' },
  { index: 26, key: 'rsi_div', labelFa: 'واگرایی RSI بین P1 و P3', category: 'structure', descriptionFa: 'اختلاف مومنتوم RSI بین پیوت جدید و پیوت هم‌نوع قبلی' },
  { index: 27, key: 'ema50_ext_pct', labelFa: 'کشیدگی درصدی از EMA50 (%)', category: 'structure', descriptionFa: 'درصد فاصله قیمت از میانگین متحرک ۵۰ در جهت اشباع' },
  { index: 28, key: 'ema200_ext_pct', labelFa: 'کشیدگی درصدی از EMA200 (%)', category: 'structure', descriptionFa: 'درصد فاصله قیمت از میانگین متحرک ۲۰۰ (فیلتر کشیدگی میان‌مدت)' },
  { index: 29, key: 'ema600_ext_pct', labelFa: 'کشیدگی درصدی از EMA600 (%)', category: 'structure', descriptionFa: 'درصد فاصله قیمت از روند ۵۰ ساعته EMA600 برای نقاط برگشتی عمیق' },
  { index: 30, key: 'ema600_slope_dir', labelFa: 'شیب روند کلان EMA600 (ضد سقوط آزاد)', category: 'structure', descriptionFa: 'هم‌راستایی شیب ۵۰ ساعته بازار با جهت معامله برای جلوگیری از خرید در ریزش آزاد' },
  { index: 31, key: 'ret4h_stretch', labelFa: 'کشیدگی حرکت ۴ ساعته (%)', category: 'structure', descriptionFa: 'درصد پامپ یا دامپ ۴ ساعت اخیر پیش از تشکیل پیوت' },
  { index: 32, key: 'ret24h_stretch', labelFa: 'کشیدگی حرکت ۲۴ ساعته (%)', category: 'structure', descriptionFa: 'درصد حرکت ۲۴ ساعت اخیر برای تشخیص نقاط تخلیه شدید' },
  { index: 33, key: 'atr_expansion', labelFa: 'انبساط نوسان (ATR17 / ATR100)', category: 'structure', descriptionFa: 'نسبت نوسان کوتاه‌مدت به بلندمدت جهت تشخیص شکست رژیم نوسانی' },
  // v3 Causal Extensions (indices 34..45; 100% backward-compatible with v1/v2 34-feature models)
  { index: 34, key: 'isLong', labelFa: 'جهت معامله (لانگ / شورت)', category: 'structure', descriptionFa: 'تمایز الگوی بازگشت شورت پس از پامپ (۰) از بازگشت لانگ پس از ریزش (۱)' },
  { index: 35, key: 'ret15m_stretch', labelFa: 'کشیدگی ۱۵ دقیقه‌ای (%)', category: 'structure', descriptionFa: 'شتاب قیمتی کوتاه‌مدت ۳ کندل اخیر در جهت اشباع پیش از پیوت' },
  { index: 36, key: 'ret1h_stretch', labelFa: 'کشیدگی ۱ ساعته (%)', category: 'structure', descriptionFa: 'شتاب قیمتی ۱۲ کندل اخیر پیش از تایید بازگشت پیوت' },
  { index: 37, key: 'wick_for', labelFa: 'شدو بازگشتی موافق (Rejection Wick)', category: 'structure', descriptionFa: 'نسبت سایه کندل تایید در جهت رد قیمت و حمایت از بازگشت' },
  { index: 38, key: 'wick_against', labelFa: 'شدو مخالف جهت ورود', category: 'structure', descriptionFa: 'نسبت سایه مخالف روی کندل تایید جهت تشخیص ضعف مومنتوم' },
  { index: 39, key: 'confirm_vol_ratio', labelFa: 'نسبت حجم کندل تایید به میانگین ۲۰', category: 'volume', descriptionFa: 'قدرت حجم لحظه تایید پیوت نسبت به میانگین حجم ۲۰ کندل اخیر' },
  { index: 40, key: 'range_pos_24h', labelFa: 'موقعیت در رنج ۲۴ ساعته', category: 'structure', descriptionFa: 'جایگاه قیمت در محدوده سقف و کف ۲۴ ساعته در جهت اشباع' },
  { index: 41, key: 'range_width_24h_pct', labelFa: 'عرض نوسان ۲۴ ساعته (%)', category: 'structure', descriptionFa: 'درصد دامنه کل نوسان ۲۴ ساعت گذشته نماد' },
  { index: 42, key: 'dollar_vol_log', labelFa: 'لگاریتم نقدشوندگی دلاری ۲۴h', category: 'volume', descriptionFa: 'شاخص عمق بازار و نقدشوندگی ۲۴ ساعته نماد برای جلوگیری از اسلیپیج' },
  { index: 43, key: 'bb_z_signed', labelFa: 'انحراف معیار بولینگر (BB Z-Score)', category: 'structure', descriptionFa: 'فاصله قیمت از میانگین ۲۰ کندل برحسب انحراف معیار در جهت اشباع' },
  { index: 44, key: 'rebound_ratio', labelFa: 'نسبت بازگشت انجام‌شده از پیوت', category: 'structure', descriptionFa: 'درصد حرکت انجام‌شده از P1 تا کندل تایید نسبت به کل کشیدگی' },
  { index: 45, key: 'rsi_cool', labelFa: 'تخلیه RSI از پیوت تا کندل تایید', category: 'structure', descriptionFa: 'میزان خروج RSI از ناحیه اشباع بین کندل پیوت P1 و کندل تایید' },
];

export const ML_FEATURE_NAMES = ML_FEATURES_META.map(m => m.key);
export const ML_NUM_FEATURES = ML_FEATURES_META.length;

export interface MlSplitMetrics {
  totalSignals: number;
  winRate: number;
  avgR: number;
  sumR: number;
  profitFactor: number;
  longCount: number;
  longAvgR: number;
  shortCount: number;
  shortAvgR: number;
  portfolioTrades: number;
  portfolioWinRate: number;
  portfolioSumR: number;
  portfolioProfitFactor: number;
  portfolioMaxDdR: number;
}

export interface MlDiscoveredPattern {
  name: string;
  rule: string;
  category: MlFeatureCategory;
  trainCount: number;
  trainWinRate: number;
  trainAvgR: number;
  trainPf: number;
  oosCount: number;
  oosWinRate: number;
  oosAvgR: number;
  oosPf: number;
}

export interface ZigZagMlParams {
  atrPeriod: number;
  minCandles: number;
  atrMultiplier: number;
  minCandlesForLongLeg: number;
  longLegAtrMultiplier: number;
  minCandlesForBlueLeg: number;
  blueLegAtrMultiplier: number;
  maxBlueLegPercent: number;
  maxBreakoutAtrMultiplier: number;
}

export interface ZigZagMlModel {
  id: string;
  name: string;
  version: number;
  exchange: string;
  timeframe: string;
  datasetId: string;
  createdAt: string;
  isDefault?: boolean;
  zigzagParams: ZigZagMlParams;
  slAtrMult: number;
  minSlPct?: number;
  tpAtrMult: number;
  targetRR?: number;
  timeStopCandles: number;
  minAtrPct: number;
  minStretchPct?: number;
  baseScore: number;
  learningRate: number;
  maxDepth?: number;
  l2Lambda?: number;
  objective?: 'expected_r' | 'win_prob' | 'blended';
  sideFilter?: 'BOTH' | 'BUY' | 'SELL';
  scoreThreshold: number;
  topPercent: number;
  featureNames: string[];
  trees: MlTreeNode[];
  featureImportance: { name: string; gain: number; weightPct?: number }[];
  metrics: {
    totalSymbols: number;
    totalEvents: number;
    train: MlSplitMetrics;
    validation: MlSplitMetrics;
    oos: MlSplitMetrics;
    unseenSymbolsOos?: MlSplitMetrics;
  };
  discoveredPatterns: MlDiscoveredPattern[];
}

export interface CausalZigZagEvent {
  candleIndex: number;
  time: number;
  close: number;
  atr: number;
  side: 'BUY' | 'SELL';
  pivotPrice: number;
  pivotTime: number;
  l1Color: 'green' | 'red' | 'blue' | 'dark_blue' | 'white';
  features: Float32Array;
  patternLabelFa: string;
}

function calcEma(candles: CandleData[], period: number): Float64Array {
  const out = new Float64Array(candles.length);
  if (!candles.length) return out;
  const k = 2 / (period + 1);
  out[0] = candles[0].close;
  for (let i = 1; i < candles.length; i++) {
    out[i] = candles[i].close * k + out[i - 1] * (1 - k);
  }
  return out;
}

function legVolStats(candles: CandleData[], sIdx: number, eIdx: number) {
  const s = Math.max(0, Math.min(sIdx, eIdx));
  const e = Math.min(candles.length - 1, Math.max(sIdx, eIdx));
  let v = 0;
  let s1 = 0;
  let s2 = 0;
  const n = Math.max(1, e - s + 1);
  const mid = Math.max(1, Math.floor(n / 2));
  for (let i = s; i <= e; i++) {
    const vol = candles[i].volume || 0;
    v += vol;
    if (i < s + mid) s1 += vol;
    else s2 += vol;
  }
  const a1 = s1 / mid;
  const a2 = n > mid ? s2 / (n - mid) : a1;
  return {
    avg: v / n,
    total: v,
    growth: a1 > 0 ? Math.max(-2, Math.min(5, (a2 - a1) / a1)) : 0,
  };
}

function colorNum(c: string): number {
  if (c === 'green' || c === 'red') return 1;
  if (c === 'blue') return 2;
  if (c === 'dark_blue') return 3;
  return 0;
}

export function describeMatchedPattern(f: Float32Array, l1Color: string): string {
  if (f[29] >= 8) return 'کشیدگی شدید EMA600 + تایید پیوت';
  if ((l1Color === 'blue' || l1Color === 'dark_blue')) return 'بازگشت لگ آبی CD/EF + استاپ ضداسویپ';
  if (l1Color === 'green' || l1Color === 'red') return 'بازگشت لگ غول‌پیکر + هم‌راستایی کلان';
  if (f[16] < 0.40) return 'ساختار هارمونیک در ناحیه اشباع';
  if ((f[18] < 0.75 || f[21] > 1.8) && f[22] === 1) return 'تخلیه/کلایمکس حجم + شکست P3';
  if (f[7] >= 3 && f[26] > 0) return 'توالی سفید + واگرایی RSI';
  return 'ترکیب چندعاملی ZigZag ML v3';
}

/**
 * Strictly causal bar-by-bar ZigZag pivot confirmation and 34-feature extractor.
 * Identical logic is used during ML training, Backtesting, Chart visualization, and Live Trading.
 * Zero lookahead: features at bar `i` depend ONLY on candles `0..i`.
 */
export function extractCausalZigZagEvents(
  candles: CandleData[],
  params: ZigZagMlParams,
  minAtrPct = 0.25,
  precomputedAtr?: number[],
  excludeTailBars = 0,
  minStretchPct = 4.0
): CausalZigZagEvent[] {
  const n = candles.length;
  const events: CausalZigZagEvent[] = [];
  const minWarmup = minStretchPct > 0 ? 610 : 210;
  if (n < minWarmup + 5) return events;

  const atrValues =
    precomputedAtr && precomputedAtr.length === n
      ? precomputedAtr
      : calculateATR(candles, params.atrPeriod).atrValues;
  const atr100 = calculateATR(candles, 100).atrValues;
  const rsiValues = calculateRSI(candles, 14);
  const ema50 = calcEma(candles, 50);
  const ema200 = calcEma(candles, 200);
  const ema600 = calcEma(candles, 600);

  const mult = params.atrMultiplier;
  const minC = params.minCandles;

  let trend = 0;
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const atr = atrValues[i] > 0 ? atrValues[i] : Math.max(1e-8, c.high - c.low);
    const th = atr * mult;
    if (i >= minC) {
      if (c.high - candles[0].low >= th) {
        trend = 1;
        startIdx = i;
        break;
      }
      if (candles[0].high - c.low >= th) {
        trend = -1;
        startIdx = i;
        break;
      }
    }
  }
  if (trend === 0) return events;

  const rawPivots: ZigZagPoint[] = [
    {
      time: candles[0].time,
      value: trend === 1 ? candles[0].low : candles[0].high,
      type: trend === 1 ? 'low' : 'high',
      atrAtPoint: atrValues[0] || 1e-8,
      legPoints: 0,
      legAtrRatio: 0,
      candleIndex: 0,
    },
  ];

  let curVal = trend === 1 ? candles[startIdx].high : candles[startIdx].low;
  let curIdx = startIdx;
  const maxBar = Math.max(startIdx, n - excludeTailBars);

  for (let i = startIdx; i < maxBar; i++) {
    const c = candles[i];
    const atr = atrValues[i] > 0 ? atrValues[i] : Math.max(1e-8, c.high - c.low);
    const th = atr * mult;
    const lastP = rawPivots[rawPivots.length - 1];
    let emitted = false;

    if (trend === 1) {
      if (c.low < lastP.value) {
        lastP.value = c.low;
        lastP.time = c.time;
        lastP.candleIndex = i;
        if (rawPivots.length >= 2) {
          const prev = rawPivots[rawPivots.length - 2];
          lastP.legPoints = Math.abs(lastP.value - prev.value);
          lastP.atrAtPoint = atr;
          lastP.legAtrRatio = lastP.legPoints / atr;
        }
        curVal = c.high;
        curIdx = i;
        continue;
      }
      if (c.high > curVal) {
        curVal = c.high;
        curIdx = i;
      }
      const cDist = curIdx - (lastP.candleIndex ?? 0);
      const pDist = curVal - lastP.value;
      const pAtr = atrValues[curIdx] > 0 ? atrValues[curIdx] : atr;
      if (cDist >= minC && pDist >= mult * pAtr && curVal - c.low >= th) {
        const pk = curIdx;
        rawPivots.push({
          time: candles[pk].time,
          value: curVal,
          type: 'high',
          candleIndex: pk,
          atrAtPoint: pAtr,
          legPoints: pDist,
          legAtrRatio: pDist / pAtr,
        });
        trend = -1;
        curVal = c.low;
        curIdx = i;
        for (let k = pk + 1; k <= i; k++) {
          if (candles[k].low < curVal) {
            curVal = candles[k].low;
            curIdx = k;
          }
        }
        emitted = true;
      }
    } else {
      if (c.high > lastP.value) {
        lastP.value = c.high;
        lastP.time = c.time;
        lastP.candleIndex = i;
        if (rawPivots.length >= 2) {
          const prev = rawPivots[rawPivots.length - 2];
          lastP.legPoints = Math.abs(lastP.value - prev.value);
          lastP.atrAtPoint = atr;
          lastP.legAtrRatio = lastP.legPoints / atr;
        }
        curVal = c.low;
        curIdx = i;
        continue;
      }
      if (c.low < curVal) {
        curVal = c.low;
        curIdx = i;
      }
      const cDist = curIdx - (lastP.candleIndex ?? 0);
      const pDist = lastP.value - curVal;
      const tAtr = atrValues[curIdx] > 0 ? atrValues[curIdx] : atr;
      if (cDist >= minC && pDist >= mult * tAtr && c.high - curVal >= th) {
        const tr = curIdx;
        rawPivots.push({
          time: candles[tr].time,
          value: curVal,
          type: 'low',
          candleIndex: tr,
          atrAtPoint: tAtr,
          legPoints: pDist,
          legAtrRatio: pDist / tAtr,
        });
        trend = 1;
        curVal = c.high;
        curIdx = i;
        for (let k = tr + 1; k <= i; k++) {
          if (candles[k].high > curVal) {
            curVal = candles[k].high;
            curIdx = k;
          }
        }
        emitted = true;
      }
    }

    if (!emitted || rawPivots.length < 7 || i < minWarmup) continue;
    const entry = c.close;
    if (entry <= 0 || atr <= 0) continue;
    const atrPct = (atr / entry) * 100;
    if (atrPct < minAtrPct) continue;

    const latestP = rawPivots[rawPivots.length - 1];
    const isBuy = latestP.type === 'low';
    const revSide: 1 | -1 = isBuy ? 1 : -1;

    const ema200ExtPct = ema200[i] > 0 ? ((entry - ema200[i]) / ema200[i]) * 100 * (-revSide) : 0;
    const ref4h = candles[Math.max(0, i - 48)].close;
    const ret4hStretch = ref4h > 0 ? ((entry - ref4h) / ref4h) * 100 * (-revSide) : 0;

    if (minStretchPct > 0 && ema200ExtPct < minStretchPct && ret4hStretch < minStretchPct) {
      continue;
    }

    const snap = rawPivots.slice(-24).map(p => ({ ...p }));
    const legs = analyzeZigZagLegs(
      snap,
      params.minCandlesForLongLeg,
      params.longLegAtrMultiplier,
      params.maxBlueLegPercent,
      params.maxBreakoutAtrMultiplier,
      undefined,
      params.minCandlesForBlueLeg,
      params.blueLegAtrMultiplier
    );
    if (legs.length < 4) continue;

    const L1 = legs[legs.length - 1];
    const L2 = legs[legs.length - 2];
    const L3 = legs[legs.length - 3];
    const L4 = legs[legs.length - 4];
    const P1 = snap[snap.length - 1];
    const P2 = snap[snap.length - 2];
    const P3 = snap[snap.length - 3];
    const P4 = snap[snap.length - 4];
    const P5 = snap[snap.length - 5];

    const p1i = P1.candleIndex ?? i;
    const p2i = P2.candleIndex ?? Math.max(0, p1i - 5);
    const p3i = P3.candleIndex ?? Math.max(0, p2i - 5);
    const p4i = P4.candleIndex ?? Math.max(0, p3i - 5);

    const v1 = legVolStats(candles, p2i, p1i);
    const v2 = legVolStats(candles, p3i, p2i);
    const v3 = legVolStats(candles, p4i, p3i);

    const eps = 1e-9;
    const r12 = Math.min(5, L1.legPoints / Math.max(eps, L2.legPoints));
    const r13 = Math.min(5, L1.legPoints / Math.max(eps, L3.legPoints));
    const xa = Math.max(eps, Math.abs(P4.value - P5.value));
    const xb = Math.abs(P3.value - P4.value) / xa;
    const xd = Math.abs(P1.value - P4.value) / xa;
    const harmErr = Math.min(
      Math.abs(xb - 0.618) + Math.abs(xd - 0.786),
      Math.abs(xb - 0.45) + Math.abs(xd - 0.886),
      Math.abs(xb - 0.786) + Math.abs(xd - 1.272),
      Math.abs(xb - 0.50) + Math.abs(xd - 1.618),
      Math.abs(r13 - 1.0)
    );

    const c1 = colorNum(L1.color);
    const c2 = colorNum(L2.color);
    const c3 = colorNum(L3.color);
    const c4 = colorNum(L4.color);
    let ws = 0;
    for (let k = legs.length - 1; k >= Math.max(0, legs.length - 6); k--) {
      if (legs[k].color === 'white') ws++;
      else break;
    }

    const cr = Math.max(eps, c.high - c.low);
    const p1c = candles[p1i];
    const rsiC = rsiValues[i] ?? 50;
    const rsiP1 = rsiValues[p1i] ?? 50;
    const rsiP3 = rsiValues[p3i] ?? 50;

    const ema50ExtPct = ema50[i] > 0 ? ((entry - ema50[i]) / ema50[i]) * 100 * (-revSide) : 0;
    const ema600ExtPct = ema600[i] > 0 ? ((entry - ema600[i]) / ema600[i]) * 100 * (-revSide) : 0;
    const ema600Prev = ema600[Math.max(0, i - 48)];
    const ema600SlopeDir = ema600Prev > 0 ? ((ema600[i] - ema600Prev) / ema600Prev) * 100 * revSide : 0;
    const ref24h = candles[Math.max(0, i - 288)].close;
    const ret24hStretch = ref24h > 0 ? ((entry - ref24h) / ref24h) * 100 * (-revSide) : 0;
    const atrExpansion = atr100[i] > 0 ? Math.min(5, atr / atr100[i]) : 1;

    // v3 Causal Extensions (indices 34..45, strictly using candles 0..i)
    const isLongVal = isBuy ? 1 : 0;
    const ref15m = candles[Math.max(0, i - 3)].close;
    const ret15mStretch = ref15m > 0 ? Math.max(-25, Math.min(40, ((entry - ref15m) / ref15m) * 100 * (-revSide))) : 0;
    const ref1h = candles[Math.max(0, i - 12)].close;
    const ret1hStretch = ref1h > 0 ? Math.max(-35, Math.min(50, ((entry - ref1h) / ref1h) * 100 * (-revSide))) : 0;

    const upperWick = (c.high - Math.max(c.open, c.close)) / cr;
    const lowerWick = (Math.min(c.open, c.close) - c.low) / cr;
    const wickFor = isBuy ? lowerWick : upperWick;
    const wickAgainst = isBuy ? upperWick : lowerWick;

    let vol20Sum = 0;
    const v20Start = Math.max(0, i - 20);
    for (let k = v20Start; k < i; k++) vol20Sum += candles[k].volume || 0;
    const avgVol20 = Math.max(eps, vol20Sum / Math.max(1, i - v20Start));
    const confirmVolRatio = Math.min(10, (c.volume || 0) / avgVol20);

    let hi24 = -Infinity;
    let lo24 = Infinity;
    let dollarVol24 = 0;
    const d24Start = Math.max(0, i - 288);
    for (let k = d24Start; k <= i; k++) {
      const ck = candles[k];
      if (ck.high > hi24) hi24 = ck.high;
      if (ck.low < lo24) lo24 = ck.low;
      dollarVol24 += (ck.volume || 0) * ck.close;
    }
    const span24 = Math.max(eps, hi24 - lo24);
    const rangePos24hRaw = (entry - lo24) / span24;
    const rangePos24hSigned = isBuy ? 1 - rangePos24hRaw : rangePos24hRaw;
    const rangeWidth24hPct = Math.min(100, (span24 / entry) * 100);
    const dollarVolLog = Math.log10(Math.max(1, dollarVol24));

    let mean20 = 0;
    const bbStart = Math.max(0, i - 19);
    const bbLen = i - bbStart + 1;
    for (let k = bbStart; k <= i; k++) mean20 += candles[k].close;
    mean20 /= bbLen;
    let var20 = 0;
    for (let k = bbStart; k <= i; k++) {
      const d = candles[k].close - mean20;
      var20 += d * d;
    }
    const std20 = Math.max(eps, Math.sqrt(var20 / bbLen));
    const bbZSigned = Math.max(-6, Math.min(6, ((entry - mean20) / std20) * (-revSide)));

    const distFromP1Pct = (Math.abs(entry - P1.value) / entry) * 100;
    const maxStretchRef = Math.max(ema200ExtPct, ema600ExtPct, 0.5);
    const reboundRatio = Math.min(5, distFromP1Pct / maxStretchRef);
    const rsiSignedConf = isBuy ? 100 - rsiC : rsiC;
    const rsiSignedP1 = isBuy ? 100 - rsiP1 : rsiP1;
    const rsiCool = rsiSignedP1 - rsiSignedConf;

    const features = new Float32Array([
      atrPct,
      Math.abs(entry - P1.value) / atr,
      ((c.close - c.open) / cr) * revSide,
      c1,
      c2,
      (c1 === 1 ? 1 : 0) + (c2 === 1 ? 1 : 0) + (c3 === 1 ? 1 : 0) + (c4 === 1 ? 1 : 0),
      (c1 >= 2 ? 1 : 0) + (c2 >= 2 ? 1 : 0) + (c3 >= 2 ? 1 : 0) + (c4 >= 2 ? 1 : 0),
      ws,
      Math.min(40, L1.legAtrRatio),
      Math.min(40, (L1.legPoints / entry) * 100),
      L1.legAtrRatio / Math.max(1, L1.candleCount),
      r12,
      r13,
      Math.min(5, (L1.legPoints + L3.legPoints) / Math.max(eps, L2.legPoints + L4.legPoints)),
      Math.min(5, xd),
      Math.min(5, xb),
      Math.min(5, harmErr),
      Math.min(10, v1.avg / Math.max(eps, v2.avg)),
      Math.min(10, v1.avg / Math.max(eps, v3.avg)),
      Math.min(10, v1.total / Math.max(eps, v3.total)),
      v1.growth,
      Math.min(15, (p1c.volume || 0) / Math.max(eps, v1.avg)),
      (isBuy ? P1.value < P3.value : P1.value > P3.value) ? 1 : 0,
      Math.max(-10, Math.min(10, (isBuy ? P3.value - P1.value : P1.value - P3.value) / atr)),
      rsiSignedConf,
      rsiSignedP1,
      isBuy ? rsiP1 - rsiP3 : rsiP3 - rsiP1,
      Math.max(-30, Math.min(50, ema50ExtPct)),
      Math.max(-30, Math.min(60, ema200ExtPct)),
      Math.max(-40, Math.min(80, ema600ExtPct)),
      Math.max(-15, Math.min(15, ema600SlopeDir)),
      Math.max(-30, Math.min(60, ret4hStretch)),
      Math.max(-50, Math.min(100, ret24hStretch)),
      atrExpansion,
      isLongVal,
      ret15mStretch,
      ret1hStretch,
      wickFor,
      wickAgainst,
      confirmVolRatio,
      rangePos24hSigned,
      rangeWidth24hPct,
      dollarVolLog,
      bbZSigned,
      reboundRatio,
      rsiCool,
    ]);

    events.push({
      candleIndex: i,
      time: c.time,
      close: entry,
      atr,
      side: isBuy ? 'BUY' : 'SELL',
      pivotPrice: P1.value,
      pivotTime: P1.time,
      l1Color: L1.color,
      features,
      patternLabelFa: describeMatchedPattern(features, L1.color),
    });
  }

  return events;
}

export function predictTreeScore(node: MlTreeNode, x: Float32Array): number {
  let cur = node;
  while (!cur.isLeaf) {
    const fIdx = cur.f!;
    const val = fIdx < x.length ? x[fIdx] : 0;
    cur = val <= cur.th! ? cur.l! : cur.r!;
  }
  return cur.v;
}

export function predictZigZagMlScore(model: ZigZagMlModel, x: Float32Array): number {
  let score = model.baseScore;
  const lr = model.learningRate;
  const trees = model.trees;
  for (let i = 0; i < trees.length; i++) {
    score += lr * predictTreeScore(trees[i], x);
  }
  if (model.objective === 'win_prob') {
    const clamped = Math.max(-15, Math.min(15, score));
    return 1 / (1 + Math.exp(-clamped));
  }
  return score;
}

// ============================================================================
// Pure-TypeScript Deterministic Histogram GBDT Trainer (v3)
// ============================================================================

export interface MlTrainingSample {
  symbol?: string;
  time: number;
  exitTime: number;
  side: 1 | -1;
  rMultiple: number;
  features: Float32Array;
  score?: number;
}

export interface MlTrainOptions {
  modelName: string;
  exchange: string;
  timeframe: string;
  datasetId: string;
  totalSymbols: number;
  zigzagParams: ZigZagMlParams;
  slAtrMult: number;
  minSlPct?: number;
  tpAtrMult: number;
  targetRR?: number;
  timeStopCandles: number;
  minAtrPct: number;
  minStretchPct?: number;
  numTrees?: number;
  learningRate?: number;
  maxDepth?: number;
  minLeafSamples?: number;
  l2Lambda?: number;
  topPercent?: number;
  objective?: 'expected_r' | 'win_prob' | 'blended';
  sideFilter?: 'BOTH' | 'BUY' | 'SELL';
  colSample?: number;
}

const BINS = 14;

function buildHistogramTree(
  bx: Uint8Array,
  grad: Float64Array,
  hess: Float64Array,
  indices: Int32Array,
  depth: number,
  maxDepth: number,
  minLeaf: number,
  lambda: number,
  thresholds: number[][],
  featGain: Float64Array,
  activeFeatures: number[]
): MlTreeNode {
  let sumG = 0;
  let sumH = 0;
  const nIdx = indices.length;
  for (let i = 0; i < nIdx; i++) {
    const idx = indices[i];
    sumG += grad[idx];
    sumH += hess[idx];
  }
  const leafVal = -sumG / (sumH + lambda);
  if (depth >= maxDepth || nIdx < minLeaf * 2) {
    return { isLeaf: true, v: Number(leafVal.toFixed(5)) };
  }

  const baseGain = (sumG * sumG) / (sumH + lambda);
  let bestGain = 1e-5;
  let bestF = -1;
  let bestB = 0;
  const binG = new Float64Array(BINS);
  const binH = new Float64Array(BINS);
  const binN = new Int32Array(BINS);

  for (let fi = 0; fi < activeFeatures.length; fi++) {
    const f = activeFeatures[fi];
    const nTh = thresholds[f].length;
    if (!nTh) continue;
    binG.fill(0);
    binH.fill(0);
    binN.fill(0);
    for (let k = 0; k < nIdx; k++) {
      const idx = indices[k];
      const b = bx[idx * ML_NUM_FEATURES + f];
      binG[b] += grad[idx];
      binH[b] += hess[idx];
      binN[b]++;
    }
    let lG = 0;
    let lH = 0;
    let lN = 0;
    for (let b = 0; b < nTh; b++) {
      lG += binG[b];
      lH += binH[b];
      lN += binN[b];
      const rN = nIdx - lN;
      if (lN < minLeaf || rN < minLeaf) continue;
      const rG = sumG - lG;
      const rH = sumH - lH;
      const gain = (lG * lG) / (lH + lambda) + (rG * rG) / (rH + lambda) - baseGain;
      if (gain > bestGain) {
        bestGain = gain;
        bestF = f;
        bestB = b;
      }
    }
  }

  if (bestF === -1) return { isLeaf: true, v: Number(leafVal.toFixed(5)) };
  featGain[bestF] += bestGain;

  let lc = 0;
  for (let k = 0; k < nIdx; k++) {
    if (bx[indices[k] * ML_NUM_FEATURES + bestF] <= bestB) lc++;
  }
  const lIdx = new Int32Array(lc);
  const rIdx = new Int32Array(nIdx - lc);
  let li = 0;
  let ri = 0;
  for (let k = 0; k < nIdx; k++) {
    const idx = indices[k];
    if (bx[idx * ML_NUM_FEATURES + bestF] <= bestB) lIdx[li++] = idx;
    else rIdx[ri++] = idx;
  }

  return {
    isLeaf: false,
    v: Number(leafVal.toFixed(5)),
    f: bestF,
    th: Number(thresholds[bestF][bestB].toFixed(5)),
    l: buildHistogramTree(bx, grad, hess, lIdx, depth + 1, maxDepth, minLeaf, lambda, thresholds, featGain, activeFeatures),
    r: buildHistogramTree(bx, grad, hess, rIdx, depth + 1, maxDepth, minLeaf, lambda, thresholds, featGain, activeFeatures),
  };
}

function evaluateSplitSamples(arr: MlTrainingSample[]): MlSplitMetrics {
  const n = arr.length;
  let w = 0;
  let sum = 0;
  let pos = 0;
  let neg = 0;
  let ln = 0;
  let lsum = 0;
  let sn = 0;
  let ssum = 0;

  for (let i = 0; i < n; i++) {
    const e = arr[i];
    sum += e.rMultiple;
    if (e.rMultiple > 0) {
      w++;
      pos += e.rMultiple;
    } else {
      neg += Math.abs(e.rMultiple);
    }
    if (e.side === 1) {
      ln++;
      lsum += e.rMultiple;
    } else {
      sn++;
      ssum += e.rMultiple;
    }
  }

  // Causal 1-position portfolio with ML score & symbol deterministic tie-breaking (identical to BacktestScannerModal)
  const sorted = [...arr].sort(
    (a, b) =>
      a.time - b.time ||
      (b.score ?? 0) - (a.score ?? 0) ||
      (a.symbol || '').localeCompare(b.symbol || '')
  );
  let busy = 0;
  let pn = 0;
  let pw = 0;
  let psum = 0;
  let ppos = 0;
  let pneg = 0;
  let eq = 0;
  let pk = 0;
  let dd = 0;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.time < busy) continue;
    busy = e.exitTime;
    pn++;
    psum += e.rMultiple;
    if (e.rMultiple > 0) {
      pw++;
      ppos += e.rMultiple;
    } else {
      pneg += Math.abs(e.rMultiple);
    }
    eq += e.rMultiple;
    if (eq > pk) pk = eq;
    if (pk - eq > dd) dd = pk - eq;
  }

  return {
    totalSignals: n,
    winRate: n ? Number(((w / n) * 100).toFixed(2)) : 0,
    avgR: n ? Number((sum / n).toFixed(4)) : 0,
    sumR: Number(sum.toFixed(2)),
    profitFactor: neg > 0 ? Number((pos / neg).toFixed(2)) : n > 0 ? 99 : 0,
    longCount: ln,
    longAvgR: ln ? Number((lsum / ln).toFixed(4)) : 0,
    shortCount: sn,
    shortAvgR: sn ? Number((ssum / sn).toFixed(4)) : 0,
    portfolioTrades: pn,
    portfolioWinRate: pn ? Number(((pw / pn) * 100).toFixed(2)) : 0,
    portfolioSumR: Number(psum.toFixed(2)),
    portfolioProfitFactor: pneg > 0 ? Number((ppos / pneg).toFixed(2)) : pn > 0 ? 99 : 0,
    portfolioMaxDdR: Number(dd.toFixed(2)),
  };
}

export function simulateCausalOutcome(
  candles: CandleData[],
  entryIdx: number,
  side: 1 | -1,
  slDist: number,
  tpDist: number,
  maxBars: number,
  feeEntry = 0.0006,
  feeExit = 0.0006,
  slSlip = 0.0004
): { rMultiple: number; exitTime: number } {
  const entry = candles[entryIdx].close;
  if (entry <= 0 || slDist <= 0 || tpDist <= 0) {
    return { rMultiple: 0, exitTime: candles[entryIdx].time };
  }
  const sl = side === 1 ? entry - slDist : entry + slDist;
  const tp = side === 1 ? entry + tpDist : entry - tpDist;
  const endIdx = Math.min(candles.length - 1, entryIdx + maxBars);
  let exitPrice = candles[endIdx].close;
  let exitTime = candles[endIdx].time;

  for (let k = entryIdx + 1; k <= endIdx; k++) {
    const c = candles[k];
    if (side === 1) {
      if (c.low <= sl) {
        exitPrice = sl * (1 - slSlip);
        exitTime = c.time;
        break;
      }
      if (c.high >= tp) {
        exitPrice = tp;
        exitTime = c.time;
        break;
      }
    } else {
      if (c.high >= sl) {
        exitPrice = sl * (1 + slSlip);
        exitTime = c.time;
        break;
      }
      if (c.low <= tp) {
        exitPrice = tp;
        exitTime = c.time;
        break;
      }
    }
  }
  const rawPnl = side === 1 ? exitPrice - entry : entry - exitPrice;
  const fees = entry * feeEntry + exitPrice * feeExit;
  return { rMultiple: (rawPnl - fees) / slDist, exitTime };
}

export function trainZigZagMlModel(
  rawSamples: MlTrainingSample[],
  options: MlTrainOptions
): ZigZagMlModel {
  const sideFilter = options.sideFilter ?? 'BOTH';
  const filtered = sideFilter === 'BOTH'
    ? rawSamples
    : rawSamples.filter((s) => (sideFilter === 'BUY' ? s.side === 1 : s.side === -1));

  if (filtered.length < 300) {
    throw new Error(`تعداد نمونه‌های زیگزاگ کافی نیست (${filtered.length} نمونه). حداقل ۳۰۰ رویداد لازم است.`);
  }

  // 100% deterministic canonical sort (eliminates SQL chunk / symbol order nondeterminism)
  const samples = [...filtered].sort(
    (a, b) =>
      a.time - b.time ||
      (a.symbol || '').localeCompare(b.symbol || '') ||
      a.side - b.side
  );

  // Automatic 20% deterministic Unseen-Symbol holdout when symbol names are present
  const uniqueSymbols = Array.from(new Set(samples.map((s) => s.symbol).filter(Boolean) as string[])).sort();
  const unseenSymbolSet = new Set<string>();
  if (uniqueSymbols.length >= 20) {
    for (let i = 0; i < uniqueSymbols.length; i++) {
      if (i % 5 === 0) unseenSymbolSet.add(uniqueSymbols[i]);
    }
  }

  // Strict chronological 45% Train / 25% Validation / 30% Untouched OOS Test split
  const t45 = samples[Math.floor(samples.length * 0.45)].time;
  const t70 = samples[Math.floor(samples.length * 0.70)].time;

  const train = samples.filter((s) => s.time < t45 && (!s.symbol || !unseenSymbolSet.has(s.symbol)));
  const val = samples.filter((s) => s.time >= t45 && s.time < t70 && (!s.symbol || !unseenSymbolSet.has(s.symbol)));
  const oos = samples.filter((s) => s.time >= t70);
  const unseenOos = unseenSymbolSet.size > 0
    ? samples.filter((s) => s.time >= t70 && !!s.symbol && unseenSymbolSet.has(s.symbol))
    : [];

  if (train.length < 150 || val.length < 50) {
    throw new Error(`تعداد نمونه‌های آموزش (${train.length}) یا اعتبارسنجی (${val.length}) کافی نیست.`);
  }

  const numTrees = options.numTrees ?? 55;
  const lr = options.learningRate ?? 0.05;
  const maxDepth = options.maxDepth ?? 2;
  const minLeaf = options.minLeafSamples ?? Math.max(35, Math.min(200, Math.floor(train.length * 0.02)));
  const lambda = options.l2Lambda ?? 240;
  const topPercent = options.topPercent ?? 8;
  const objective = options.objective ?? 'blended';
  const colSample = options.colSample ?? 0.75;

  const n = train.length;
  // Deterministic exact quantile binning on sorted train samples
  const thresholds: number[][] = [];
  for (let f = 0; f < ML_NUM_FEATURES; f++) {
    const vals = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const xf = train[i].features;
      vals[i] = f < xf.length ? xf[f] : 0;
    }
    vals.sort();
    const ths: number[] = [];
    for (let q = 1; q < BINS; q++) {
      const v = vals[Math.floor((q / BINS) * n)];
      if (!ths.length || v > ths[ths.length - 1] + 1e-6) ths.push(v);
    }
    thresholds.push(ths);
  }

  const bx = new Uint8Array(n * ML_NUM_FEATURES);
  for (let i = 0; i < n; i++) {
    const xf = train[i].features;
    const base = i * ML_NUM_FEATURES;
    for (let f = 0; f < ML_NUM_FEATURES; f++) {
      const ths = thresholds[f];
      const v = f < xf.length ? xf[f] : 0;
      let b = 0;
      while (b < ths.length && v > ths[b]) b++;
      bx[base + f] = b;
    }
  }

  // Time-cluster de-weighting: 1 / sqrt(events in same hour) prevents market-wide flushes from dominating trees
  const isMs = train[0].time > 1e12;
  const hourDiv = isMs ? 3600000 : 3600;
  const hourCounts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const h = Math.floor(train[i].time / hourDiv);
    hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
  }

  const y = new Float64Array(n);
  const w = new Float64Array(n);
  let sumWY = 0;
  let sumW = 0;
  const maxClipR = Math.max(1.8, (options.targetRR ?? (options.slAtrMult > 0 ? options.tpAtrMult / options.slAtrMult : 1.5)) * 1.15);
  for (let i = 0; i < n; i++) {
    const h = Math.floor(train[i].time / hourDiv);
    const wi = 1 / Math.sqrt(hourCounts.get(h) || 1);
    w[i] = wi;
    const r = train[i].rMultiple;
    if (objective === 'win_prob') {
      y[i] = r > 0 ? 1 : 0;
    } else if (objective === 'blended') {
      const winFlag = r > 0 ? 1 : 0;
      const clippedR = Math.max(-1.2, Math.min(maxClipR, r));
      y[i] = 0.6 * winFlag + 0.4 * clippedR;
    } else {
      y[i] = Math.max(-1.4, Math.min(Math.max(2.2, maxClipR), r));
    }
    sumWY += wi * y[i];
    sumW += wi;
  }

  const isLogLoss = objective === 'win_prob';
  const baseProb = Math.min(0.95, Math.max(0.05, sumWY / Math.max(1e-9, sumW)));
  const baseScore = isLogLoss ? Math.log(baseProb / (1 - baseProb)) : sumWY / Math.max(1e-9, sumW);

  const preds = new Float64Array(n).fill(baseScore);
  const grad = new Float64Array(n);
  const hess = new Float64Array(n);
  const allIdx = new Int32Array(n);
  for (let i = 0; i < n; i++) allIdx[i] = i;
  const featGain = new Float64Array(ML_NUM_FEATURES);
  const trees: MlTreeNode[] = [];

  // Deterministic LCG PRNG for 75% feature subsampling (colsample)
  let rng = 20261121;
  const nextRand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  for (let t = 0; t < numTrees; t++) {
    for (let i = 0; i < n; i++) {
      if (isLogLoss) {
        const p = 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, preds[i]))));
        grad[i] = (p - y[i]) * w[i];
        hess[i] = Math.max(0.02, p * (1 - p)) * w[i];
      } else {
        grad[i] = (preds[i] - y[i]) * w[i];
        hess[i] = w[i];
      }
    }
    const activeFeatures: number[] = [];
    for (let f = 0; f < ML_NUM_FEATURES; f++) {
      if (colSample >= 0.999 || nextRand() < colSample) activeFeatures.push(f);
    }
    if (activeFeatures.length === 0) activeFeatures.push(0);
    const tree = buildHistogramTree(
      bx,
      grad,
      hess,
      allIdx,
      0,
      maxDepth,
      minLeaf,
      lambda,
      thresholds,
      featGain,
      activeFeatures
    );
    trees.push(tree);
    for (let i = 0; i < n; i++) preds[i] += lr * predictTreeScore(tree, train[i].features);
  }

  const predictLocal = (x: Float32Array) => {
    let s = baseScore;
    for (let i = 0; i < trees.length; i++) s += lr * predictTreeScore(trees[i], x);
    if (isLogLoss) {
      return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, s))));
    }
    return s;
  };

  // Calibrate threshold STRICTLY on Validation set (never peeking at OOS!)
  const valScored = val.map((s) => ({ ...s, score: predictLocal(s.features) }));
  const valScores = valScored.map((s) => s.score).sort((a, b) => b - a);
  const cutIdx = Math.max(0, Math.min(valScores.length - 1, Math.floor((valScores.length * topPercent) / 100)));
  const scoreThreshold = Math.floor((valScores[cutIdx] ?? 0.05) * 1e5) / 1e5;

  const selTr = train.map((s) => ({ ...s, score: predictLocal(s.features) })).filter((s) => s.score >= scoreThreshold);
  const selVa = valScored.filter((s) => s.score >= scoreThreshold);
  const selOos = oos.map((s) => ({ ...s, score: predictLocal(s.features) })).filter((s) => s.score >= scoreThreshold);
  const selUnseenOos = unseenOos
    .map((s) => ({ ...s, score: predictLocal(s.features) }))
    .filter((s) => s.score >= scoreThreshold);

  const totalGain = Array.from(featGain).reduce((a, b) => a + b, 0) || 1;
  const featureImportance = ML_FEATURE_NAMES.map((name, idx) => ({
    name,
    gain: Number(featGain[idx].toFixed(2)),
    weightPct: Number(((featGain[idx] / totalGain) * 100).toFixed(2)),
  })).sort((a, b) => b.gain - a.gain);

  const patDefs: { name: string; rule: string; category: MlFeatureCategory; test: (f: Float32Array) => boolean }[] = [
    { name: 'کشیدگی شدید EMA600 + تایید پیوت زیگزاگ', rule: 'EMA600 Ext ≥ 6% & ML Score ≥ Threshold', category: 'structure', test: f => f[29] >= 6 },
    { name: 'ساختار هارمونیک و نسبت L1<L2,L3 (تخلیه موج)', rule: 'r12 < 1.0 or r13 < 1.0 & Harmonic Error < 0.45', category: 'harmonic', test: f => f[11] < 1.0 || f[12] < 1.0 || f[16] < 0.45 },
    { name: 'بازگشت لگ غول‌پیکر (سبز/قرمز) با فیلتر جهت', rule: 'L1 = Giant (Green/Red) & ML Score ≥ Threshold', category: 'legs', test: f => f[3] === 1 },
    { name: 'بازگشت لگ آبی استراتژی ۲ (CD/EF) با استاپ ضداسویپ', rule: 'L1 = Blue/Dark-Blue (CD/EF) & Anti-Sweep SL', category: 'legs', test: f => f[3] === 2 || f[3] === 3 },
    { name: 'کلایمکس یا تخلیه حجم لگ هم‌جهت + شکست کم‌عمق P3', rule: 'Vol(L1)/Vol(L3) < 0.85 or Climax > 1.8 & Sweep P3', category: 'volume', test: f => (f[18] < 0.85 || f[21] > 1.8) && f[22] === 1 },
    { name: 'توالی لگ‌های سفید (۳+) با واگرایی RSI در پیوت کشیده', rule: 'White Streak ≥ 3 & RSI Divergence & Stretched Pivot', category: 'structure', test: f => f[7] >= 3 && f[26] > 0 },
  ];

  const oosCombined = [...selVa, ...selOos];
  const discoveredPatterns: MlDiscoveredPattern[] = patDefs.map(pd => {
    const trP = selTr.filter(s => pd.test(s.features));
    const oosP = oosCombined.filter(s => pd.test(s.features));
    const trM = evaluateSplitSamples(trP);
    const oosM = evaluateSplitSamples(oosP);
    return {
      name: pd.name,
      rule: pd.rule,
      category: pd.category,
      trainCount: trM.totalSignals,
      trainWinRate: Number(trM.winRate.toFixed(1)),
      trainAvgR: Number(trM.avgR.toFixed(3)),
      trainPf: trM.profitFactor,
      oosCount: oosM.totalSignals,
      oosWinRate: Number(oosM.winRate.toFixed(1)),
      oosAvgR: Number(oosM.avgR.toFixed(3)),
      oosPf: oosM.profitFactor,
    };
  });

  const targetRR = options.targetRR ?? (options.slAtrMult > 0 ? options.tpAtrMult / options.slAtrMult : 2.0);

  return {
    id: `ml_zz_${Date.now()}`,
    name: options.modelName,
    version: 3,
    exchange: options.exchange,
    timeframe: options.timeframe,
    datasetId: options.datasetId,
    createdAt: new Date().toISOString(),
    zigzagParams: options.zigzagParams,
    slAtrMult: options.slAtrMult,
    minSlPct: options.minSlPct ?? 3.0,
    tpAtrMult: options.tpAtrMult,
    targetRR: Number(targetRR.toFixed(2)),
    timeStopCandles: options.timeStopCandles,
    minAtrPct: options.minAtrPct,
    minStretchPct: options.minStretchPct ?? 1.5,
    baseScore: Number(baseScore.toFixed(5)),
    learningRate: lr,
    maxDepth,
    l2Lambda: lambda,
    objective,
    sideFilter,
    scoreThreshold,
    topPercent,
    featureNames: ML_FEATURE_NAMES,
    trees,
    featureImportance,
    metrics: {
      totalSymbols: options.totalSymbols,
      totalEvents: samples.length,
      train: evaluateSplitSamples(selTr),
      validation: evaluateSplitSamples(selVa),
      oos: evaluateSplitSamples(selOos),
      ...(selUnseenOos.length > 0 ? { unseenSymbolsOos: evaluateSplitSamples(selUnseenOos) } : {}),
    },
    discoveredPatterns,
  };
}

// ============================================================================
// Runtime Active Model Registry (Shared by Backtest, Chart, and Live Trading)
// ============================================================================

let activeMlModel: ZigZagMlModel | null = null;
let defaultModelFactory: (() => ZigZagMlModel) | null = null;

export function registerDefaultMlModelFactory(factory: () => ZigZagMlModel): void {
  defaultModelFactory = factory;
}

export function getActiveMlModel(): ZigZagMlModel {
  if (!activeMlModel && defaultModelFactory) {
    activeMlModel = defaultModelFactory();
  }
  if (!activeMlModel) {
    throw new Error('ZigZag ML model not initialized yet.');
  }
  return activeMlModel;
}

export function setActiveMlModel(model: ZigZagMlModel): void {
  activeMlModel = model;
}

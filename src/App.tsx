import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, Play, Pause, RefreshCw, BarChart2,
  Database, Settings, CheckCircle2, AlertTriangle, ChevronRight, Layers, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { CandleData, CryptoPair, Leg, ZigZagPoint } from './types/crypto.ts';
import { BacktestMetrics, BacktestResult, StrategyParams, Trade, ZigZagSettings } from './types/strategy.ts';
import { calculateATR, calculateZigZag, classifyLegs } from './utils/indicators.ts';
import { runBreakoutStrategy, runNextPivotStrategy } from './utils/strategyEngine.ts';
import { fetchServerPairs, fetchServerKlines, performServerSideMarketDownload } from './services/binance.ts';
import { auth, loginWithGoogle, logoutUser, loadUserSettings, saveUserSettings } from './services/firebase.ts';

export default function App() {
  // Pairs & Selected Pair
  const [pairs, setPairs] = useState<CryptoPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(false);

  // User
  const [user, setUser] = useState<any>(null);

  // Strategy & Backtest Parameters
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1);
  const [commissionPercent, setCommissionPercent] = useState<number>(0.08);
  const [maxRiskReward, setMaxRiskReward] = useState<number>(2.0);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('strategy_1_e_breakout');

  // ZigZag Parameters
  const [zigzagSettings, setZigzagSettings] = useState<ZigZagSettings>({
    atrPeriod: 14,
    minCandles: 3,
    minCandlesForLongLeg: 8,
    atrMultiplier: 2.0,
    longLegAtrMultiplier: 3.5,
    maxBlueLegPercent: 4.0,
    maxBreakoutAtrMultiplier: 2.0,
    maxRiskReward: 2.0,
  });

  // Backtest Results on active symbol
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);

  // Full Market Scanner Modal & States
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentSymbol: '' });
  const [scanResults, setScanResults] = useState<BacktestResult[]>([]);
  const [universeOption, setUniverseOption] = useState<'all_market_cap' | 'top_50' | 'top_30'>('all_market_cap');
  const [scanCandlesLimit, setScanCandlesLimit] = useState<number>(1000);

  // Chart Container Ref
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);

  // Auth Listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        loadUserSettings(u.uid).then((saved) => {
          if (saved) {
            if (saved.capital) setCapital(saved.capital);
            if (saved.riskPercent) setRiskPercent(saved.riskPercent);
            if (saved.zigzagSettings) setZigzagSettings(saved.zigzagSettings);
          }
        });
      }
    });
    return () => unsub();
  }, []);

  // Fetch Available Pairs on Mount
  useEffect(() => {
    fetchServerPairs(true, 1000).then((data) => {
      setPairs(data);
    });
  }, []);

  // Fetch Klines when Selected Pair or Timeframe changes
  useEffect(() => {
    if (!selectedPair) return;
    setIsLoadingChart(true);
    fetchServerKlines(selectedPair, timeframe, 1000, true).then((data) => {
      setCandles(data);
      setIsLoadingChart(false);
    });
  }, [selectedPair, timeframe]);

  // Compute Indicators & Run Backtest on Active Chart
  useEffect(() => {
    if (candles.length < 20) return;
    const { atrValues } = calculateATR(candles, zigzagSettings.atrPeriod);
    const { points } = calculateZigZag(candles, atrValues, zigzagSettings.atrMultiplier, zigzagSettings.minCandles);
    const legs = classifyLegs(
      points,
      zigzagSettings.minCandlesForLongLeg,
      zigzagSettings.longLegAtrMultiplier,
      zigzagSettings.maxBlueLegPercent,
      zigzagSettings.maxBreakoutAtrMultiplier
    );

    const params: StrategyParams = {
      capital,
      selectedStrategyId,
      riskPercent,
      entryCommissionPercent: commissionPercent / 2,
      exitCommissionPercent: commissionPercent / 2,
      commissionPercent,
      maxRiskReward,
      maxCandlesToEnter: 100,
      maxTradesPerLeg: 1,
      showOnChart: true,
    };

    let result;
    if (selectedStrategyId === 'strategy_2_next_pivot') {
      result = runNextPivotStrategy(
        candles,
        points,
        legs,
        params,
        atrValues,
        zigzagSettings.atrMultiplier,
        zigzagSettings.minCandles
      );
    } else {
      result = runBreakoutStrategy(candles, points, legs, params);
    }

    setTrades(result.trades);
    setMetrics(result.metrics);

    // Update Lightweight Chart
    if (candlestickSeriesRef.current && chartRef.current) {
      try {
        const formattedCandles = candles.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candlestickSeriesRef.current.setData(formattedCandles);

        if (lineSeriesRef.current && points.length > 0) {
          const formattedLine = points.map((p) => ({
            time: p.time as any,
            value: p.price,
          }));
          lineSeriesRef.current.setData(formattedLine);
        }

        chartRef.current.timeScale().fitContent();
      } catch (err) {
        console.warn('Error rendering chart series:', err);
      }
    }
  }, [candles, capital, riskPercent, commissionPercent, maxRiskReward, selectedStrategyId, zigzagSettings]);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0b0e14' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#161d2a' },
        horzLines: { color: '#161d2a' },
      },
      timeScale: {
        borderColor: '#243046',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#243046',
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Run Full Market Scan
  const handleStartScan = async () => {
    setIsScanning(true);
    setScanResults([]);
    const limitSymbols = universeOption === 'top_30' ? 30 : universeOption === 'top_50' ? 50 : 1000;
    setScanProgress({ current: 0, total: limitSymbols, currentSymbol: 'در حال اتصال به سرور و فیلتر ارزها...' });

    try {
      const response = await performServerSideMarketDownload(timeframe, scanCandlesLimit, true, limitSymbols);
      if (response && response.success && response.entries) {
        const entries = response.entries;
        const results: BacktestResult[] = [];

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const pair = entry.pair;
          const klines = entry.candles;
          setScanProgress({ current: i + 1, total: entries.length, currentSymbol: pair.symbol });

          if (klines.length >= 50) {
            const { atrValues } = calculateATR(klines, zigzagSettings.atrPeriod);
            const { points } = calculateZigZag(klines, atrValues, zigzagSettings.atrMultiplier, zigzagSettings.minCandles);
            const legs = classifyLegs(
              points,
              zigzagSettings.minCandlesForLongLeg,
              zigzagSettings.longLegAtrMultiplier,
              zigzagSettings.maxBlueLegPercent,
              zigzagSettings.maxBreakoutAtrMultiplier
            );
            const params: StrategyParams = {
              capital,
              selectedStrategyId,
              riskPercent,
              entryCommissionPercent: commissionPercent / 2,
              exitCommissionPercent: commissionPercent / 2,
              commissionPercent,
              maxRiskReward,
              maxCandlesToEnter: 100,
              maxTradesPerLeg: 1,
              showOnChart: false,
            };

            const backtest = selectedStrategyId === 'strategy_2_next_pivot'
              ? runNextPivotStrategy(klines, points, legs, params, atrValues, zigzagSettings.atrMultiplier, zigzagSettings.minCandles)
              : runBreakoutStrategy(klines, points, legs, params);

            results.push({
              pair,
              candlesCount: klines.length,
              totalTrades: backtest.metrics.totalTrades,
              winTrades: backtest.metrics.winTrades,
              lossTrades: backtest.metrics.lossTrades,
              activeTrades: backtest.metrics.activeTrades,
              winRate: backtest.metrics.winRate,
              netProfit: backtest.metrics.netProfit,
              netProfitPercent: backtest.metrics.netProfitPercent,
              totalProfit: backtest.metrics.totalProfit,
              totalLoss: backtest.metrics.totalLoss,
              totalFee: backtest.metrics.totalFee,
              profitFactor: backtest.metrics.profitFactor,
              avgRiskReward: backtest.metrics.avgRiskReward,
              maxDrawdown: backtest.metrics.maxDrawdown,
              maxDrawdownPercent: backtest.metrics.maxDrawdownPercent,
              optimalRiskForDD20: backtest.metrics.maxDrawdownPercent > 0
                ? parseFloat(((riskPercent * 20) / backtest.metrics.maxDrawdownPercent).toFixed(2))
                : 2,
              trades: backtest.trades,
            });
          }
        }

        results.sort((a, b) => b.netProfitPercent - a.netProfitPercent);
        setScanResults(results);
      }
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0e14] text-gray-200 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#1f2838] bg-[#0f141e] px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            ⚡
          </div>
          <span className="font-extrabold text-base tracking-wide text-white">
            Crypto Strategy Lab
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            Market Cap $1M+
          </span>
        </div>

        {/* Selected Pair & Timeframe selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-[#171f2d] border border-[#273349] text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
          >
            {pairs.map((p) => (
              <option key={p.symbol} value={p.symbol}>
                {p.symbol} {p.marketCap ? `(${(p.marketCap / 1e6).toFixed(0)}M Cap)` : ''}
              </option>
            ))}
          </select>

          <div className="flex bg-[#171f2d] border border-[#273349] rounded-lg p-0.5 text-xs font-semibold">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  timeframe === tf ? 'bg-amber-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-extrabold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>اسکنر و تستر بازار</span>
          </button>
        </div>

        {/* User Auth */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300 font-medium">{user.displayName || user.email}</span>
              <button
                onClick={logoutUser}
                className="text-xs px-2.5 py-1 rounded-lg bg-[#1f2838] hover:bg-[#2c3950] text-gray-300"
              >
                خروج
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#1f2838] hover:bg-[#2c3950] text-gray-200 border border-[#2f3d54] font-medium"
            >
              ورود با گوگل
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Interactive Chart */}
        <div className="flex-1 flex flex-col border-r border-[#1f2838] relative">
          {isLoadingChart && (
            <div className="absolute inset-0 bg-[#0b0e14]/70 backdrop-blur-xs flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <RefreshCw className="w-4 h-4 animate-spin" />
                در حال دریافت دیتای کندل‌استیک...
              </div>
            </div>
          )}
          <div ref={chartContainerRef} className="flex-1 w-full h-full" />
        </div>

        {/* Right Side: Strategy Parameters & Backtest Metrics Panel */}
        <div className="w-84 bg-[#0f141e] border-l border-[#1f2838] flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              تنظیمات استراتژی و بک‌تست
            </h2>
          </div>

          <div className="space-y-3 text-xs mb-6">
            <div>
              <label className="text-gray-400 block mb-1">استراتژی:</label>
              <select
                value={selectedStrategyId}
                onChange={(e) => setSelectedStrategyId(e.target.value)}
                className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-2 text-white font-medium focus:border-amber-400"
              >
                <option value="strategy_1_e_breakout">استراتژی ۱: شکست سطوح اکستریم (Breakout)</option>
                <option value="strategy_2_next_pivot">استراتژی ۲: اولین پیوت بعد از تشکیل (Next Pivot)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 block mb-1">سرمایه اولیه ($):</label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(Number(e.target.value))}
                  className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-2 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">ریسک در معامله (%):</label>
                <input
                  type="number"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-2 text-white font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 block mb-1">کارمزد معامله (%):</label>
                <input
                  type="number"
                  step="0.01"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(Number(e.target.value))}
                  className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-2 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">حداکثر R:R:</label>
                <input
                  type="number"
                  step="0.5"
                  value={maxRiskReward}
                  onChange={(e) => setMaxRiskReward(Number(e.target.value))}
                  className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-2 text-white font-medium"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f2838]">
              <div className="text-[11px] font-bold text-gray-400 mb-2">تنظیمات زیگ‌زاگ هوشمند:</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 block mb-0.5">ضریب ATR:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={zigzagSettings.atrMultiplier}
                    onChange={(e) => setZigzagSettings({ ...zigzagSettings, atrMultiplier: Number(e.target.value) })}
                    className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-500 block mb-0.5">حداقل کندل:</label>
                  <input
                    type="number"
                    value={zigzagSettings.minCandles}
                    onChange={(e) => setZigzagSettings({ ...zigzagSettings, minCandles: Number(e.target.value) })}
                    className="w-full bg-[#171f2d] border border-[#273349] rounded-lg p-1.5 text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Performance Summary on Selected Symbol */}
          {metrics && (
            <div className="bg-[#141b27] border border-[#222d40] rounded-xl p-3">
              <h3 className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                <span>نتایج تست روی {selectedPair}</span>
                <span className={`font-mono ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.netProfitPercent >= 0 ? '+' : ''}{metrics.netProfitPercent}%
                </span>
              </h3>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#0f141e] p-2 rounded-lg">
                  <span className="text-gray-400 block">وین‌ریت (WinRate):</span>
                  <span className="font-bold text-white font-mono">{metrics.winRate}%</span>
                </div>
                <div className="bg-[#0f141e] p-2 rounded-lg">
                  <span className="text-gray-400 block">تعداد معاملات:</span>
                  <span className="font-bold text-white font-mono">{metrics.totalTrades}</span>
                </div>
                <div className="bg-[#0f141e] p-2 rounded-lg">
                  <span className="text-gray-400 block">سود خالص ($):</span>
                  <span className={`font-bold font-mono ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${metrics.netProfit}
                  </span>
                </div>
                <div className="bg-[#0f141e] p-2 rounded-lg">
                  <span className="text-gray-400 block">افت سرمایه (DD):</span>
                  <span className="font-bold text-rose-400 font-mono">{metrics.maxDrawdownPercent}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Market Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101622] border border-[#232f45] w-full max-w-5xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#232f45] flex items-center justify-between bg-[#151c2b]">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">تستر و اسکنر سراسری بازار ارزهای دیجیتال</h3>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="text-gray-400 hover:text-white px-2 py-1 rounded-lg text-xs"
              >
                بستن (Esc)
              </button>
            </div>

            {/* Scanner Controls */}
            <div className="p-4 border-b border-[#232f45] bg-[#0d121c] flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 font-medium">محدوده بازار:</label>
                <select
                  value={universeOption}
                  onChange={(e: any) => setUniverseOption(e.target.value)}
                  className="bg-[#171f2d] border border-[#273349] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="all_market_cap">ارزهای فیوچرز با ارزش بازار بالای ۱ میلیون دلار ($1M+ Market Cap) - پیش‌فرض</option>
                  <option value="top_50">۵۰ ارز برتر از نظر ارزش بازار (Top 50)</option>
                  <option value="top_30">۳۰ ارز نقدشونده اول (Top 30)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 font-medium">تعداد کندل:</label>
                <select
                  value={scanCandlesLimit}
                  onChange={(e) => setScanCandlesLimit(Number(e.target.value))}
                  className="bg-[#171f2d] border border-[#273349] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value={500}>۵۰۰ کندل</option>
                  <option value={1000}>۱۰۰۰ کندل</option>
                  <option value={1500}>۱۵۰۰ کندل</option>
                </select>
              </div>

              <button
                onClick={handleStartScan}
                disabled={isScanning}
                className="mr-auto px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال اسکن بازار ({scanProgress.current}/{scanProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>شروع اسکن کامل بازار (ارزش بازار بالای ۱ میلیون دلار)</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {scanResults.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                  <BarChart2 className="w-8 h-8 opacity-30 text-amber-400" />
                  <span>دکمه «شروع اسکن کامل بازار» را بزنید تا بیش از ۴۰۰ جفت‌ارز با ارزش بازار بالای یک میلیون دلار تست شوند.</span>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-[#232f45] pb-2">
                      <th className="py-2">رتبه / جفت‌ارز</th>
                      <th className="py-2">مارکت کپ</th>
                      <th className="py-2">وین‌ریت</th>
                      <th className="py-2">تعداد معامله</th>
                      <th className="py-2">سود خالص (%)</th>
                      <th className="py-2">دراودان (DD)</th>
                      <th className="py-2">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2738]">
                    {scanResults.map((r, idx) => (
                      <tr key={r.pair.symbol} className="hover:bg-[#161f2e] transition-colors">
                        <td className="py-2.5 font-bold text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#202b3d] text-[10px] flex items-center justify-center text-gray-300">
                            {idx + 1}
                          </span>
                          {r.pair.symbol}
                        </td>
                        <td className="py-2.5 text-gray-300 font-mono">
                          {r.pair.marketCap ? `$${(r.pair.marketCap / 1e6).toFixed(1)}M` : '-'}
                        </td>
                        <td className="py-2.5 font-mono text-emerald-400 font-bold">{r.winRate}%</td>
                        <td className="py-2.5 font-mono">{r.totalTrades}</td>
                        <td className={`py-2.5 font-mono font-bold ${r.netProfitPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {r.netProfitPercent >= 0 ? '+' : ''}{r.netProfitPercent}%
                        </td>
                        <td className="py-2.5 font-mono text-rose-400">{r.maxDrawdownPercent}%</td>
                        <td className="py-2.5">
                          <button
                            onClick={() => {
                              setSelectedPair(r.pair.symbol);
                              setIsScannerOpen(false);
                            }}
                            className="px-2.5 py-1 rounded bg-[#212d40] hover:bg-amber-500 hover:text-black text-gray-200 text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            مشاهده چارت
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CryptoPair, CandleData, Timeframe, ZigZagSettings } from './types/crypto';
import { POPULAR_PAIRS, fetchKlines, subscribeToKlineStream } from './services/binance';
import { calculateATR, calculateAtrZigZag, analyzeZigZagLegs } from './utils/indicators';
import { StrategyConfig, DEFAULT_STRATEGY_CONFIG } from './types/strategy';
import { runStrategyBacktest } from './utils/strategyEngine';
import { Navbar } from './components/Navbar';
import { TradingChart } from './components/TradingChart';
import { CandleDataModal } from './components/CandleDataModal';
import { ZigZagSettingsModal, DEFAULT_ZIGZAG_SETTINGS } from './components/ZigZagSettingsModal';
import { ZigZagGuideModal } from './components/ZigZagGuideModal';
import { BacktestScannerModal } from './components/BacktestScannerModal';
import { StrategyPanel } from './components/StrategyPanel';
import { Zap } from 'lucide-react';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<CryptoPair>(POPULAR_PAIRS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('live');
  const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState<boolean>(false);

  // Strategy Panel Open/Close state (persisted)
  const [isStrategyOpen, setIsStrategyOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('is_strategy_panel_open');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true; // Open by default
  });

  const handleToggleStrategy = () => {
    setIsStrategyOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('is_strategy_panel_open', String(next));
      } catch {}
      return next;
    });
  };

  // Strategy Configuration state (persisted)
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>(() => {
    try {
      const saved = localStorage.getItem('trading_strategy_config');
      if (saved) return { ...DEFAULT_STRATEGY_CONFIG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_STRATEGY_CONFIG;
  });

  const handleUpdateStrategyConfig = (newConfig: StrategyConfig) => {
    setStrategyConfig({ ...newConfig });
    try {
      localStorage.setItem('trading_strategy_config', JSON.stringify(newConfig));
    } catch {}
  };

  // Configurable ZigZag & ATR Settings (persisted in localStorage)
  const [zigzagSettings, setZigzagSettings] = useState<ZigZagSettings>(() => {
    try {
      const saved = localStorage.getItem('strategy_zigzag_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ZIGZAG_SETTINGS;
  });

  const handleUpdateZigZagSettings = (newSettings: ZigZagSettings) => {
    setZigzagSettings({ ...newSettings });
    try {
      localStorage.setItem('strategy_zigzag_settings', JSON.stringify(newSettings));
    } catch {}
  };

  // Dynamic Hovered ATR state (مقادیر در لحظه موس برای تمام باکس‌ها)
  const [hoveredAtrData, setHoveredAtrData] = useState<{
    atr: number;
    twoAtr: number;
    threeAtr: number;
    candleRange: number;
    timeStr: string;
    isHovering: boolean;
  } | null>(null);

  // Load Klines from Binance
  const loadMarketData = useCallback(async () => {
    setIsLoading(true);
    try {
      const klineResult = await fetchKlines(selectedPair.symbol, timeframe, 5000);
      setCandles(klineResult.candles);
      setDataSource(klineResult.source);
    } catch (err) {
      console.error('Failed to load market data', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPair.symbol, timeframe]);

  // Initial and reactive load on symbol or timeframe switch
  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Subscribe to real-time WebSocket Kline stream from Binance
  useEffect(() => {
    const unsubscribe = subscribeToKlineStream(
      selectedPair.symbol,
      timeframe,
      (updatedCandle) => {
        setCandles((prevCandles) => {
          if (prevCandles.length === 0) return [updatedCandle];

          const last = prevCandles[prevCandles.length - 1];

          // If updating current open candle
          if (last.time === updatedCandle.time) {
            const next = [...prevCandles];
            next[next.length - 1] = updatedCandle;
            return next;
          } else if (updatedCandle.time > last.time) {
            // New candle started
            return [...prevCandles.slice(1), updatedCandle];
          }
          return prevCandles;
        });
      },
      (status) => {
        setWsStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedPair.symbol, timeframe]);

  // Calculate ATR(period), 2*ATR(period), 3*ATR(period) and ATR map in real-time
  const atrMetrics = useMemo(() => {
    return calculateATR(candles, zigzagSettings.atrPeriod);
  }, [candles, zigzagSettings.atrPeriod]);

  // Synchronized ZigZag points and analyzed legs for strategy engine
  const zigzagData = useMemo(() => {
    if (candles.length === 0) return { points: [], legs: [] };
    const { points } = calculateAtrZigZag(
      candles,
      atrMetrics.atrValues,
      zigzagSettings.atrMultiplier,
      zigzagSettings.minCandles
    );
    const legs = analyzeZigZagLegs(
      points,
      zigzagSettings.minCandlesForLongLeg,
      zigzagSettings.longLegAtrMultiplier
    );
    return { points, legs };
  }, [
    candles,
    atrMetrics.atrValues,
    zigzagSettings.atrMultiplier,
    zigzagSettings.minCandles,
    zigzagSettings.minCandlesForLongLeg,
    zigzagSettings.longLegAtrMultiplier,
  ]);

  // Run Strategy Backtest (Strategy 1 or Strategy 2)
  const strategyResult = useMemo(() => {
    return runStrategyBacktest(
      candles,
      zigzagData.points,
      zigzagData.legs,
      strategyConfig,
      atrMetrics.atrValues,
      zigzagSettings.atrMultiplier,
      zigzagSettings.minCandles
    );
  }, [
    candles,
    zigzagData.points,
    zigzagData.legs,
    strategyConfig,
    atrMetrics.atrValues,
    zigzagSettings.atrMultiplier,
    zigzagSettings.minCandles,
  ]);

  const isHovering = Boolean(hoveredAtrData?.isHovering);
  const currentAtr = isHovering ? hoveredAtrData!.atr : atrMetrics.currentATR;
  const currentTwoAtr = isHovering ? hoveredAtrData!.twoAtr : atrMetrics.twoATR;
  const currentThreeAtr = isHovering ? hoveredAtrData!.threeAtr : atrMetrics.threeATR;
  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const currentCandleRange = isHovering
    ? hoveredAtrData!.candleRange
    : (lastCandle ? Math.max(0, lastCandle.high - lastCandle.low) : 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0e14] text-gray-200 antialiased font-sans select-none overflow-hidden">
      {/* 1. Top Header: Pair selector + همه باکس‌های ATR به صورت دینامیک با موس */}
      <div className="shrink-0">
        <Navbar
          selectedPair={selectedPair}
          onSelectPair={(p) => setSelectedPair(p)}
          currentAtr={currentAtr}
          currentTwoAtr={currentTwoAtr}
          currentThreeAtr={currentThreeAtr}
          currentCandleRange={currentCandleRange}
          atrPeriod={zigzagSettings.atrPeriod}
          isHoveredAtr={isHovering}
          hoveredDate={hoveredAtrData?.timeStr}
          wsStatus={wsStatus}
          onOpenDataModal={() => setIsDataModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenGuide={() => setIsGuideModalOpen(true)}
          onOpenBacktest={() => setIsBacktestModalOpen(true)}
          onToggleStrategy={handleToggleStrategy}
          isStrategyOpen={isStrategyOpen}
        />
      </div>

      {/* 2. Main Workspace: Chart (2/3) + Strategy Panel (1/3) on the right */}
      <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Main Chart: takes ~2/3 (67%) when strategy is open, 100% when closed */}
        <main
          className={`h-full min-h-0 min-w-0 transition-all duration-200 flex flex-col p-1 sm:p-2 ${
            isStrategyOpen ? 'w-full lg:w-[67%] xl:w-[70%]' : 'w-full'
          }`}
        >
          <TradingChart
            candles={candles}
            symbol={selectedPair.symbol}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            isLoading={isLoading}
            dataSource={dataSource}
            onRefresh={loadMarketData}
            atrValues={atrMetrics.atrValues}
            atrMap={atrMetrics.atrMap}
            latestAtr={atrMetrics.currentATR}
            onHoverAtr={(data) => setHoveredAtrData(data)}
            zigzagSettings={zigzagSettings}
            onUpdateZigZagSettings={handleUpdateZigZagSettings}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            strategyTrades={strategyResult.trades}
            showStrategyTrades={strategyConfig.showOnChart}
            onToggleStrategyPanel={handleToggleStrategy}
            isStrategyPanelOpen={isStrategyOpen}
          />
        </main>

        {/* Quick Docked Button on the Right edge when Strategy Panel is closed */}
        {!isStrategyOpen && (
          <button
            onClick={handleToggleStrategy}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-[#1e2533] hover:bg-amber-400 text-amber-400 hover:text-black border-l border-y border-amber-500/40 rounded-l-xl px-2 py-3.5 shadow-2xl transition-all flex-col items-center gap-2 cursor-pointer group"
            title="باز کردن پنل استراتژی معاملاتی (یک‌سوم صفحه)"
          >
            <Zap className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold [writing-mode:vertical-rl] tracking-widest font-sans">
              استراتژی
            </span>
          </button>
        )}

        {/* Strategy Panel: Takes ~1/3 (33%) on the right side of the screen */}
        {isStrategyOpen && (
          <div className="w-full lg:w-[33%] xl:w-[30%] min-w-[320px] max-w-[500px] h-full shrink-0 min-h-0 overflow-hidden border-t lg:border-t-0 lg:border-l border-[#232b3a] z-20">
            <StrategyPanel
              isOpen={isStrategyOpen}
              onClose={() => setIsStrategyOpen(false)}
              config={strategyConfig}
              onUpdateConfig={handleUpdateStrategyConfig}
              trades={strategyResult.trades}
              metrics={strategyResult.metrics}
            />
          </div>
        )}
      </div>

      {/* 3. OHLCV Raw Data Inspector Modal */}
      <CandleDataModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        candles={candles}
        pair={selectedPair}
        timeframe={timeframe}
      />

      {/* 4. ZigZag & ATR Settings Modal */}
      <ZigZagSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={zigzagSettings}
        onSave={handleUpdateZigZagSettings}
      />

      {/* 5. ZigZag Leg Rules Guide Modal */}
      <ZigZagGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        settings={zigzagSettings}
      />

      {/* 6. Multi-Symbol Backtest Scanner Modal (همواره در حافظه می‌ماند تا با بستن مودال داده‌ها از بین نروند) */}
      <BacktestScannerModal
        isOpen={isBacktestModalOpen}
        onClose={() => setIsBacktestModalOpen(false)}
        zigzagSettings={zigzagSettings}
        onUpdateZigZagSettings={setZigzagSettings}
        currentTimeframe={timeframe}
        onSelectPairAndClose={(p) => {
          setSelectedPair(p);
          setIsBacktestModalOpen(false);
        }}
      />
    </div>
  );
}

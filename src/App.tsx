import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CryptoPair, CandleData, Timeframe, ZigZagSettings } from './types/crypto';
import { POPULAR_PAIRS, fetchKlines, subscribeToKlineStream } from './services/binance';
import { calculateATR } from './utils/indicators';
import { Navbar } from './components/Navbar';
import { TradingChart } from './components/TradingChart';
import { CandleDataModal } from './components/CandleDataModal';
import { ZigZagSettingsModal, DEFAULT_ZIGZAG_SETTINGS } from './components/ZigZagSettingsModal';
import { ZigZagGuideModal } from './components/ZigZagGuideModal';

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
        />
      </div>

      {/* 2. Main Full-Height & Full-Width Trading Chart (with Anchor Point & Measure tool) */}
      <main className="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col p-1 sm:p-2">
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
        />
      </main>

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
    </div>
  );
}

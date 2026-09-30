import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CryptoPair, CandleData, Timeframe } from './types/crypto';
import { POPULAR_PAIRS, fetchKlines, subscribeToKlineStream } from './services/binance';
import { calculateATR } from './utils/indicators';
import { Navbar } from './components/Navbar';
import { TradingChart } from './components/TradingChart';
import { CandleDataModal } from './components/CandleDataModal';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<CryptoPair>(POPULAR_PAIRS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('live');
  const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);

  // Dynamic Hovered ATR state
  const [hoveredAtrData, setHoveredAtrData] = useState<{
    atr: number;
    twoAtr: number;
    threeAtr: number;
    timeStr: string;
    isHovering: boolean;
  } | null>(null);

  // Load Klines from Binance
  const loadMarketData = useCallback(async () => {
    setIsLoading(true);
    try {
      const klineResult = await fetchKlines(selectedPair.symbol, timeframe, 500);
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

  // Calculate ATR(55), 2*ATR(55), 3*ATR(55) and ATR map in real-time
  const atrMetrics = useMemo(() => {
    return calculateATR(candles, 55);
  }, [candles]);

  // Active ATR to display in Navbar (either from mouse hover on a candle, or latest live candle)
  const displayAtr = hoveredAtrData?.isHovering ? hoveredAtrData.atr : atrMetrics.currentATR;
  const displayTwoAtr = hoveredAtrData?.isHovering ? hoveredAtrData.twoAtr : atrMetrics.twoATR;
  const displayThreeAtr = hoveredAtrData?.isHovering ? hoveredAtrData.threeAtr : atrMetrics.threeATR;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0e14] text-gray-200 antialiased font-sans select-none overflow-hidden">
      {/* 1. Top Header: Pair selector + ATR(55), 2*ATR(55), 3*ATR(55) in points (dynamic on hover) */}
      <div className="shrink-0">
        <Navbar
          selectedPair={selectedPair}
          onSelectPair={(p) => setSelectedPair(p)}
          atr55={displayAtr}
          twoAtr55={displayTwoAtr}
          threeAtr55={displayThreeAtr}
          isHoveredAtr={hoveredAtrData?.isHovering}
          hoveredDate={hoveredAtrData?.timeStr}
          wsStatus={wsStatus}
          onOpenDataModal={() => setIsDataModalOpen(true)}
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
    </div>
  );
}

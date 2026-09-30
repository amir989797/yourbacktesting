import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CrosshairMode,
  Logical,
  MouseEventParams,
} from 'lightweight-charts';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  BarChart2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Anchor,
  Square,
  MousePointer,
  Trash2,
  X,
} from 'lucide-react';
import { CandleData, ChartType, IndicatorSettings, Timeframe } from '../types/crypto';
import { formatPrice, formatVolume, formatPoints, prepareVolumeData, calculateSMA } from '../utils/indicators';

type ActiveTool = 'cursor' | 'anchor' | 'rectangle';

interface PointMeasurement {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  price1: number;
  price2: number;
  logical1: Logical | null;
  logical2: Logical | null;
  time1: number | null;
  time2: number | null;
  isDragging: boolean;
}

interface DrawnRectangle {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  price1: number;
  price2: number;
  logical1: Logical | null;
  logical2: Logical | null;
}

interface TradingChartProps {
  candles: CandleData[];
  symbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  isLoading: boolean;
  dataSource: 'live' | 'fallback';
  onRefresh: () => void;
  atrValues: number[];
  atrMap: Map<number, number>;
  latestAtr: number;
  onHoverAtr?: (data: {
    atr: number;
    twoAtr: number;
    threeAtr: number;
    timeStr: string;
    isHovering: boolean;
  }) => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  symbol,
  timeframe,
  onTimeframeChange,
  isLoading,
  dataSource,
  onRefresh,
  atrValues,
  atrMap,
  latestAtr,
  onHoverAtr,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lastLoadedKeyRef = useRef<string>('');

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma25SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma99SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorSettings>({
    showMa7: true,
    showMa25: true,
    showMa99: false,
    showVolume: true,
  });

  // Tools state
  const [activeTool, setActiveTool] = useState<ActiveTool>('cursor');
  const [measurement, setMeasurement] = useState<PointMeasurement | null>(null);
  const [rectangles, setRectangles] = useState<DrawnRectangle[]>([]);
  const [currentRect, setCurrentRect] = useState<DrawnRectangle | null>(null);

  const dragStartRef = useRef<{
    x: number;
    y: number;
    price: number | null;
    logical: Logical | null;
    time: number | null;
    active: boolean;
  } | null>(null);

  // Crosshair hover info
  const [hoverData, setHoverData] = useState<{
    time: string;
    rawTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    atr: number;
  } | null>(null);

  const timeframes: { value: Timeframe; label: string }[] = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '30m', label: '30m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1D' },
    { value: '1w', label: '1W' },
  ];

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 550,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#848e9c',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.45)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.45)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2a2e39',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2a2e39',
        },
      },
      rightPriceScale: {
        borderColor: '#2b313a',
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
      leftPriceScale: {
        visible: false,
        autoScale: true,
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      },
      timeScale: {
        borderColor: '#2b313a',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 0.5,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true, // Native chart panning in cursor mode
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
    });

    chartRef.current = chart;

    // 1. Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });
    candleSeriesRef.current = candleSeries;

    // 2. Line series
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#f0b90b',
      lineWidth: 2,
      visible: chartType === 'line',
    });
    lineSeriesRef.current = lineSeries;

    // 3. Area series
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(240, 185, 11, 0.4)',
      bottomColor: 'rgba(240, 185, 11, 0.0)',
      lineColor: '#f0b90b',
      lineWidth: 2,
      visible: chartType === 'area',
    });
    areaSeriesRef.current = areaSeries;

    // 4. Volume series (attached to left scale overlay)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'left',
      visible: indicators.showVolume,
    });
    volumeSeriesRef.current = volumeSeries;

    // 5. Moving Average Series
    const ma7 = chart.addSeries(LineSeries, {
      color: '#f0b90b',
      lineWidth: 1,
      title: 'MA(7)',
      visible: indicators.showMa7,
    });
    ma7SeriesRef.current = ma7;

    const ma25 = chart.addSeries(LineSeries, {
      color: '#e024c3',
      lineWidth: 1,
      title: 'MA(25)',
      visible: indicators.showMa25,
    });
    ma25SeriesRef.current = ma25;

    const ma99 = chart.addSeries(LineSeries, {
      color: '#2962ff',
      lineWidth: 1,
      title: 'MA(99)',
      visible: indicators.showMa99,
    });
    ma99SeriesRef.current = ma99;

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].target) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update chart data when candles change
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const uniqueCandles: CandleData[] = [];
    const seenTimes = new Set<number>();

    for (const c of sorted) {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        uniqueCandles.push(c);
      }
    }

    const candleData = uniqueCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const lineData = uniqueCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.close,
    }));

    const volumeData = prepareVolumeData(uniqueCandles).map((v) => ({
      time: v.time as UTCTimestamp,
      value: v.value,
      color: v.color,
    }));

    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candleData);
    }
    if (lineSeriesRef.current) {
      lineSeriesRef.current.setData(lineData);
    }
    if (areaSeriesRef.current) {
      areaSeriesRef.current.setData(lineData);
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volumeData);
    }

    // Moving Averages
    if (ma7SeriesRef.current) {
      const ma7 = calculateSMA(uniqueCandles, 7).map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }));
      ma7SeriesRef.current.setData(ma7);
    }

    if (ma25SeriesRef.current) {
      const ma25 = calculateSMA(uniqueCandles, 25).map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }));
      ma25SeriesRef.current.setData(ma25);
    }

    if (ma99SeriesRef.current) {
      const ma99 = calculateSMA(uniqueCandles, 99).map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }));
      ma99SeriesRef.current.setData(ma99);
    }

    // Auto-fit content only on pair or timeframe switch
    const currentKey = `${symbol}_${timeframe}`;
    if (lastLoadedKeyRef.current !== currentKey) {
      lastLoadedKeyRef.current = currentKey;
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, symbol, timeframe]);

  // Subscribe to Crosshair Move with precise ATR resolution
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const crosshairHandler = (param: MouseEventParams) => {
      if (
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        candles.length === 0
      ) {
        setHoverData(null);
        onHoverAtr?.({
          atr: latestAtr,
          twoAtr: latestAtr * 2,
          threeAtr: latestAtr * 3,
          timeStr: '',
          isHovering: false,
        });
        return;
      }

      let candleIdx = -1;

      if (param.logical !== undefined) {
        const roundIdx = Math.round(param.logical as number);
        if (roundIdx >= 0 && roundIdx < candles.length) {
          candleIdx = roundIdx;
        }
      }

      if (candleIdx === -1 && param.time !== undefined) {
        const targetTime = Number(param.time);
        candleIdx = candles.findIndex((c) => c.time === targetTime);
      }

      if (candleIdx === -1 && chartContainerRef.current) {
        const logical = chart.timeScale().coordinateToLogical(param.point.x);
        if (logical !== null) {
          const roundIdx = Math.round(logical);
          if (roundIdx >= 0 && roundIdx < candles.length) {
            candleIdx = roundIdx;
          }
        }
      }

      if (candleIdx >= 0 && candleIdx < candles.length) {
        const c = candles[candleIdx];
        const candleAtr = (atrValues && atrValues[candleIdx] !== undefined)
          ? atrValues[candleIdx]
          : (atrMap.get(c.time) ?? latestAtr);

        const dateObj = new Date(c.time * 1000);
        const timeFormatted = dateObj.toLocaleDateString('fa-IR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        onHoverAtr?.({
          atr: candleAtr,
          twoAtr: candleAtr * 2,
          threeAtr: candleAtr * 3,
          timeStr: timeFormatted,
          isHovering: true,
        });

        const chg = ((c.close - c.open) / c.open) * 100;

        setHoverData({
          time: timeFormatted,
          rawTime: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          change: chg,
          atr: candleAtr,
        });
      }
    };

    chart.subscribeCrosshairMove(crosshairHandler);

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler);
    };
  }, [candles, atrValues, atrMap, latestAtr, onHoverAtr]);

  // Keep Measurements and Rectangles pinned during pan/zoom
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const handleRangeOrScaleChange = () => {
      if (!chartRef.current || !candleSeriesRef.current) return;
      const timeScale = chartRef.current.timeScale();
      const series = candleSeriesRef.current;

      // Update Anchor Measurement coordinates
      if (measurement && !measurement.isDragging && measurement.logical1 !== null && measurement.price1 !== null) {
        const newX1 = timeScale.logicalToCoordinate(measurement.logical1);
        const newY1 = series.priceToCoordinate(measurement.price1);
        const newX2 = timeScale.logicalToCoordinate(measurement.logical2 ?? measurement.logical1);
        const newY2 = series.priceToCoordinate(measurement.price2 ?? measurement.price1);

        if (newX1 !== null && newY1 !== null && newX2 !== null && newY2 !== null) {
          setMeasurement((prev) => (prev ? { ...prev, x1: newX1, y1: newY1, x2: newX2, y2: newY2 } : null));
        }
      }

      // Update Drawn Rectangles coordinates
      setRectangles((prevList) =>
        prevList.map((r) => {
          if (r.logical1 !== null && r.logical2 !== null) {
            const rx1 = timeScale.logicalToCoordinate(r.logical1);
            const ry1 = series.priceToCoordinate(r.price1);
            const rx2 = timeScale.logicalToCoordinate(r.logical2);
            const ry2 = series.priceToCoordinate(r.price2);
            if (rx1 !== null && ry1 !== null && rx2 !== null && ry2 !== null) {
              return { ...r, x1: rx1, y1: ry1, x2: rx2, y2: ry2 };
            }
          }
          return r;
        })
      );
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleRangeOrScaleChange);
    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeOrScaleChange);
    };
  }, [measurement, rectangles]);

  // Handle Chart Type changes
  useEffect(() => {
    if (!candleSeriesRef.current || !lineSeriesRef.current || !areaSeriesRef.current) return;
    candleSeriesRef.current.applyOptions({ visible: chartType === 'candlestick' });
    lineSeriesRef.current.applyOptions({ visible: chartType === 'line' });
    areaSeriesRef.current.applyOptions({ visible: chartType === 'area' });
  }, [chartType]);

  // Handle Indicator visibility changes
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: indicators.showVolume });
    }
    if (ma7SeriesRef.current) {
      ma7SeriesRef.current.applyOptions({ visible: indicators.showMa7 });
    }
    if (ma25SeriesRef.current) {
      ma25SeriesRef.current.applyOptions({ visible: indicators.showMa25 });
    }
    if (ma99SeriesRef.current) {
      ma99SeriesRef.current.applyOptions({ visible: indicators.showMa99 });
    }
  }, [indicators]);

  // Handle Tool change: Enable chart panning in cursor mode, disable during drawing
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      handleScroll: {
        pressedMouseMove: activeTool === 'cursor',
        horzTouchDrag: true,
        vertTouchDrag: true,
        mouseWheel: false,
      },
    });
  }, [activeTool]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const delta = span * 0.18;
      if (span - 2 * delta > 4) {
        timeScale.setVisibleLogicalRange({
          from: range.from + delta,
          to: range.to - delta,
        });
      }
    }
  };

  const handleZoomOut = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const delta = span * 0.18;
      timeScale.setVisibleLogicalRange({
        from: range.from - delta,
        to: range.to + delta,
      });
    }
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // --- MOUSE CLICK AND DRAG FOR ANCHOR MEASURE & RECTANGLE DRAWING ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // If in normal cursor mode, allow native chart panning!
    if (activeTool === 'cursor' || e.button !== 0 || !chartContainerRef.current || !chartRef.current || !candleSeriesRef.current) {
      return;
    }

    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = candleSeriesRef.current.coordinateToPrice(y);
    const logical = chartRef.current.timeScale().coordinateToLogical(x);
    const time = chartRef.current.timeScale().coordinateToTime(x);

    dragStartRef.current = {
      x,
      y,
      price: price as number | null,
      logical,
      time: time ? Number(time) : null,
      active: true,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (
      !dragStartRef.current?.active ||
      !chartContainerRef.current ||
      !chartRef.current ||
      !candleSeriesRef.current
    ) {
      return;
    }

    const start = dragStartRef.current;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const distance = Math.hypot(currentX - start.x, currentY - start.y);

    if (distance > 4) {
      const currentPrice = candleSeriesRef.current.coordinateToPrice(currentY);
      const currentLogical = chartRef.current.timeScale().coordinateToLogical(currentX);
      const currentTime = chartRef.current.timeScale().coordinateToTime(currentX);

      if (start.price !== null && currentPrice !== null) {
        if (activeTool === 'anchor') {
          setMeasurement({
            x1: start.x,
            y1: start.y,
            x2: currentX,
            y2: currentY,
            price1: start.price,
            price2: currentPrice as number,
            logical1: start.logical,
            logical2: currentLogical,
            time1: start.time,
            time2: currentTime ? Number(currentTime) : null,
            isDragging: true,
          });
        } else if (activeTool === 'rectangle') {
          setCurrentRect({
            id: 'temp',
            x1: start.x,
            y1: start.y,
            x2: currentX,
            y2: currentY,
            price1: start.price,
            price2: currentPrice as number,
            logical1: start.logical,
            logical2: currentLogical,
          });
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (dragStartRef.current?.active) {
      dragStartRef.current.active = false;

      if (activeTool === 'anchor' && measurement?.isDragging) {
        setMeasurement((prev) => (prev ? { ...prev, isDragging: false } : null));
        // Return to cursor mode so user can pan immediately!
        setActiveTool('cursor');
      } else if (activeTool === 'rectangle' && currentRect) {
        setRectangles((prev) => [...prev, { ...currentRect, id: Date.now().toString() }]);
        setCurrentRect(null);
        setActiveTool('cursor');
      }
    }
  };

  const clearAllDrawings = () => {
    setMeasurement(null);
    setRectangles([]);
    setCurrentRect(null);
  };

  const lastCandle = candles[candles.length - 1];
  const displayInfo = hoverData || (lastCandle ? {
    time: new Date(lastCandle.time * 1000).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    rawTime: lastCandle.time,
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    close: lastCandle.close,
    volume: lastCandle.volume,
    change: ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100,
    atr: latestAtr,
  } : null);

  const isUp = (displayInfo?.change ?? 0) >= 0;

  // --- ANCHOR MEASUREMENT CALCULATIONS (The 4 exact requested items) ---
  let pointsDistance = 0;
  let percentOfAtr55 = 0;
  let candleCount = 0;
  let totalVolume = 0;

  if (measurement) {
    // 1. Distance in points
    pointsDistance = Math.abs(measurement.price2 - measurement.price1);

    // Candle indices in range
    let startIdx = 0;
    let endIdx = 0;

    if (measurement.logical1 !== null && measurement.logical2 !== null) {
      const l1 = Math.round(measurement.logical1 as number);
      const l2 = Math.round(measurement.logical2 as number);
      startIdx = Math.max(0, Math.min(l1, l2, candles.length - 1));
      endIdx = Math.max(0, Math.min(Math.max(l1, l2), candles.length - 1));
    } else if (measurement.time1 && measurement.time2) {
      const t1 = Math.min(measurement.time1, measurement.time2);
      const t2 = Math.max(measurement.time1, measurement.time2);
      startIdx = Math.max(0, candles.findIndex((c) => c.time >= t1));
      const fEnd = candles.findIndex((c) => c.time > t2);
      endIdx = fEnd === -1 ? candles.length - 1 : Math.max(0, fEnd - 1);
    }

    // 2. Percent of ATR55
    const baseAtr = (atrValues && atrValues[startIdx] !== undefined)
      ? atrValues[startIdx]
      : (latestAtr || 1);
    percentOfAtr55 = baseAtr > 0 ? (pointsDistance / baseAtr) * 100 : 0;

    // 3. Candle count
    candleCount = Math.max(1, endIdx - startIdx + 1);

    // 4. Total volume in range
    totalVolume = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      if (candles[i]) {
        totalVolume += candles[i].volume;
      }
    }
  }

  return (
    <div
      className={`flex flex-col bg-[#131722] border border-[#2b313a] rounded-lg overflow-hidden shadow-xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative w-full h-full flex-1 min-h-0'
      }`}
    >
      {/* Top Toolbar: Timeframes, Indicators, Chart Type, Zoom Controls */}
      <div className="shrink-0 flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-[#2b313a] bg-[#181d26] gap-2">
        {/* Left: Timeframe buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-semibold text-gray-400 pl-1 pr-1.5 hidden sm:inline">
            تایم‌فریم:
          </span>
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                timeframe === tf.value
                  ? 'bg-amber-400 text-black shadow-sm font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#252c38]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Right side: Chart tools & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Chart Type segmented selector */}
          <div className="flex items-center bg-[#1f2633] p-0.5 rounded-lg border border-[#2e3747]">
            <button
              onClick={() => setChartType('candlestick')}
              title="نمودار کندل‌استیک (Candlesticks)"
              className={`px-2 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                chartType === 'candlestick'
                  ? 'bg-[#2b3445] text-amber-400 font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              کندل
            </button>
            <button
              onClick={() => setChartType('line')}
              title="نمودار خطی (Line)"
              className={`px-2 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                chartType === 'line'
                  ? 'bg-[#2b3445] text-amber-400 font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              خطی
            </button>
            <button
              onClick={() => setChartType('area')}
              title="نمودار سطحی (Area)"
              className={`px-2 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                chartType === 'area'
                  ? 'bg-[#2b3445] text-amber-400 font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              مساحتی
            </button>
          </div>

          {/* Quick Indicators Toggle */}
          <div className="flex items-center gap-1.5 border-l border-[#2e3747] pl-2">
            <button
              onClick={() => setIndicators((prev) => ({ ...prev, showMa7: !prev.showMa7 }))}
              className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer font-mono font-medium ${
                indicators.showMa7
                  ? 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Moving Average 7"
            >
              MA7
            </button>

            <button
              onClick={() => setIndicators((prev) => ({ ...prev, showMa25: !prev.showMa25 }))}
              className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer font-mono font-medium ${
                indicators.showMa25
                  ? 'bg-[#e024c3]/15 text-[#e024c3] border border-[#e024c3]/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Moving Average 25"
            >
              MA25
            </button>

            <button
              onClick={() => setIndicators((prev) => ({ ...prev, showMa99: !prev.showMa99 }))}
              className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer font-mono font-medium ${
                indicators.showMa99
                  ? 'bg-[#2962ff]/15 text-[#2962ff] border border-[#2962ff]/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Moving Average 99"
            >
              MA99
            </button>

            <button
              onClick={() => setIndicators((prev) => ({ ...prev, showVolume: !prev.showVolume }))}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                indicators.showVolume
                  ? 'bg-[#0ecb81]/15 text-[#0ecb81] border border-[#0ecb81]/30 font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="نمایش/پنهان‌سازی حجم معاملات (Volume)"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>حجم</span>
            </button>
          </div>

          {/* Zoom Controls: Zoom In (+), Zoom Out (-), Reset Zoom (Fit) */}
          <div className="flex items-center gap-1 border-l border-[#2e3747] pl-2 bg-[#1b212c] p-0.5 rounded-lg">
            <button
              onClick={handleZoomIn}
              title="بزرگ‌نمایی چارت (Zoom In)"
              className="p-1.5 rounded-md text-gray-300 hover:text-amber-400 hover:bg-[#283242] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={handleZoomOut}
              title="کوچک‌نمایی چارت (Zoom Out)"
              className="p-1.5 rounded-md text-gray-300 hover:text-amber-400 hover:bg-[#283242] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetZoom}
              title="تنظیم مجدد زوم و اندازه چارت (Reset / Fit Zoom)"
              className="p-1.5 rounded-md text-gray-300 hover:text-amber-400 hover:bg-[#283242] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons: Refresh and Fullscreen */}
          <div className="flex items-center gap-1 border-l border-[#2e3747] pl-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="تازه‌سازی داده‌ها از بایننس"
              className={`p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252c38] transition-colors cursor-pointer ${
                isLoading ? 'animate-spin text-amber-400' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252c38] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* OHLCV Live / Hover Legend Bar */}
      <div className="shrink-0 px-3 py-1 bg-[#151922] border-b border-[#232934] text-xs flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono">
        {displayInfo ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-400 font-sans font-medium text-[11px] bg-[#1a202c] px-2 py-0.5 rounded border border-[#2b3545]">
              {displayInfo.time}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">O:</span>
              <span className="text-gray-200">{formatPrice(displayInfo.open)}</span>

              <span className="text-gray-500">H:</span>
              <span className="text-gray-200">{formatPrice(displayInfo.high)}</span>

              <span className="text-gray-500">L:</span>
              <span className="text-gray-200">{formatPrice(displayInfo.low)}</span>

              <span className="text-gray-500">C:</span>
              <span className={`font-semibold ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {formatPrice(displayInfo.close)}
              </span>

              <span
                className={`text-[11px] px-1.5 py-0.5 rounded ${
                  isUp ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#f6465d]/15 text-[#f6465d]'
                }`}
              >
                {isUp ? '+' : ''}
                {displayInfo.change.toFixed(2)}%
              </span>

              <span className="text-gray-500 ml-1">Vol:</span>
              <span className="text-amber-400/90">{formatVolume(displayInfo.volume)}</span>

              <span className="text-amber-400 font-sans ml-2 border-l border-[#2e3747] pl-2 font-medium">
                توان حرکتی (ATR 55):
              </span>
              <span className="text-amber-300 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                {formatPoints(displayInfo.atr)} پوینت
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">در حال بارگذاری اطلاعات کندل...</span>
        )}

        {/* Active Indicators Legend */}
        <div className="flex items-center gap-2 text-[11px]">
          {indicators.showMa7 && <span className="text-[#f0b90b]">MA(7)</span>}
          {indicators.showMa25 && <span className="text-[#e024c3]">MA(25)</span>}
          {indicators.showMa99 && <span className="text-[#2962ff]">MA(99)</span>}
          {indicators.showVolume && <span className="text-emerald-400">Vol</span>}
        </div>
      </div>

      {/* Main Chart Area with Dedicated Left Tools Section (بخش ابزارها) */}
      <div className="relative flex-1 w-full h-full min-h-0 flex bg-[#131722] overflow-hidden">
        {/* DEDICATED TOOLS SIDEBAR (بخش ابزار) */}
        <div className="w-11 shrink-0 bg-[#161b24] border-r border-[#27303e] flex flex-col items-center py-2 gap-2 z-20 shadow-md">
          {/* 1. Cursor / Normal tool */}
          <button
            onClick={() => setActiveTool('cursor')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              activeTool === 'cursor'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-[#232a38]'
            }`}
            title="نشانگر عادی چارت (Cursor)"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          {/* 2. ANCHOR TOOL (آیکون Anchor) */}
          <button
            onClick={() => setActiveTool(activeTool === 'anchor' ? 'cursor' : 'anchor')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
              activeTool === 'anchor'
                ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)] font-bold'
                : 'text-gray-400 hover:text-amber-400 hover:bg-[#232a38]'
            }`}
            title="ابزار Anchor: کلیک و درگ برای محاسبه فاصله پوینت و درصد ATR55"
          >
            <Anchor className="w-4 h-4" />
            {activeTool === 'anchor' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          {/* 3. RECTANGLE TOOL (کشیدن مربع) */}
          <button
            onClick={() => setActiveTool(activeTool === 'rectangle' ? 'cursor' : 'rectangle')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
              activeTool === 'rectangle'
                ? 'bg-sky-500 text-black shadow-[0_0_12px_rgba(14,165,233,0.5)] font-bold'
                : 'text-gray-400 hover:text-sky-400 hover:bg-[#232a38]'
            }`}
            title="ابزار کشیدن مربع / مستطیل (Rectangle Box)"
          >
            <Square className="w-4 h-4" />
            {activeTool === 'rectangle' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            )}
          </button>

          {/* Divider */}
          <div className="w-6 h-px bg-[#2a3444] my-1" />

          {/* Clear Drawings Button */}
          <button
            onClick={clearAllDrawings}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="پاک کردن همه رسم‌ها و اندازه‌گیری‌ها"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas Container */}
        <div
          className={`relative flex-1 w-full h-full min-h-0 bg-[#131722] overflow-hidden select-none ${
            activeTool !== 'cursor' ? 'cursor-crosshair' : ''
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div ref={chartContainerRef} className="w-full h-full" />

          {/* ACTIVE DRAWINGS OVERLAY */}
          <div className="absolute inset-0 pointer-events-none z-30">
            <svg className="w-full h-full absolute inset-0">
              {/* Drawn Rectangles */}
              {rectangles.map((r) => (
                <rect
                  key={r.id}
                  x={Math.min(r.x1, r.x2)}
                  y={Math.min(r.y1, r.y2)}
                  width={Math.max(1, Math.abs(r.x2 - r.x1))}
                  height={Math.max(1, Math.abs(r.y2 - r.y1))}
                  fill="rgba(56, 189, 248, 0.18)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
              ))}

              {/* Currently dragging rectangle preview */}
              {currentRect && (
                <rect
                  x={Math.min(currentRect.x1, currentRect.x2)}
                  y={Math.min(currentRect.y1, currentRect.y2)}
                  width={Math.max(1, Math.abs(currentRect.x2 - currentRect.x1))}
                  height={Math.max(1, Math.abs(currentRect.y2 - currentRect.y1))}
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}

              {/* Active Anchor Measurement: Line and Endpoints ONLY (No box) */}
              {measurement && (
                <>
                  <line
                    x1={measurement.x1}
                    y1={measurement.y1}
                    x2={measurement.x2}
                    y2={measurement.y2}
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                  <circle cx={measurement.x1} cy={measurement.y1} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  <circle cx={measurement.x2} cy={measurement.y2} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                </>
              )}
            </svg>

            {/* EXACT 4-ITEM INFO BOX - 100% IN ENGLISH */}
            {measurement && (
              <div
                className="absolute pointer-events-auto transform -translate-x-1/2 mt-2 z-40 bg-[#161c26]/95 border border-amber-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[200px]"
                style={{
                  left: `${Math.max(110, Math.min(measurement.x2, (chartContainerRef.current?.clientWidth ?? 600) - 110))}px`,
                  top: `${Math.max(10, Math.min(measurement.y2 + 8, (chartContainerRef.current?.clientHeight ?? 400) - 130))}px`,
                }}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#2b3545] mb-2 font-mono">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs tracking-wider">
                    <Anchor className="w-3.5 h-3.5" />
                    <span>ANCHOR</span>
                  </div>
                  <button
                    onClick={() => setMeasurement(null)}
                    className="p-1 rounded hover:bg-[#2b3546] text-gray-400 hover:text-white transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[12px] font-mono">
                  {/* 1. Distance in points */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Points:</span>
                    <span className="font-bold text-white">
                      {formatPoints(pointsDistance)} pts
                    </span>
                  </div>

                  {/* 2. ATR (Only percentage, concise) */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">ATR:</span>
                    <span className="font-bold text-amber-400">
                      {percentOfAtr55.toFixed(1)}%
                    </span>
                  </div>

                  {/* 3. Bars */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Bars:</span>
                    <span className="font-bold text-sky-400">
                      {candleCount}
                    </span>
                  </div>

                  {/* 4. Volume */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Volume:</span>
                    <span className="font-bold text-emerald-400">
                      {formatVolume(totalVolume)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Tool Prompt Toast */}
          {activeTool !== 'cursor' && !measurement && !currentRect && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-[#181d26]/90 border border-[#2d3748] text-gray-200 text-xs backdrop-blur-md shadow-lg flex items-center gap-2 pointer-events-none">
              {activeTool === 'anchor' ? (
                <>
                  <Anchor className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>ابزار Anchor فعال است: با کلیک و درگ روی چارت، بازه مورد نظر را انتخاب کنید.</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-sky-400 animate-pulse" />
                  <span>ابزار مربع فعال است: با کلیک و درگ روی چارت، باکس مورد نظر را بکشید.</span>
                </>
              )}
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-[#131722]/80 backdrop-blur-xs flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-gray-300">دریافت کندل‌های {symbol} از بایننس...</span>
              </div>
            </div>
          )}

          {/* Fallback notification pill if live endpoints failed */}
          {dataSource === 'fallback' && (
            <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs backdrop-blur-md">
              داده‌های شبیه‌سازی شده بازار (عدم دسترسی موقت به وب‌سرویس بایننس)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

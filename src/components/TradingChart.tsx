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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Anchor,
  Square,
  MousePointer,
  Trash2,
  X,
  Activity,
  TrendingUp,
  Sliders,
  Settings,
  Zap,
} from 'lucide-react';
import { CandleData, ChartType, Timeframe, ZigZagSettings } from '../types/crypto';
import { StrategyTrade, TradeStatus } from '../types/strategy';
import {
  formatPrice,
  formatVolume,
  formatPoints,
  prepareVolumeData,
  calculateSMA,
  calculateAtrZigZag,
  analyzeZigZagLegs,
  ZigZagPoint,
  ZigZagLeg,
} from '../utils/indicators';

type ActiveTool = 'cursor' | 'anchor' | 'rectangle' | 'ma' | 'zigzag';

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

interface ZigZagCoord {
  x: number;
  y: number;
  colorHex: string;
  isHighlighted: boolean;
  label?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  pointType?: 'high' | 'low';
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
    candleRange: number;
    timeStr: string;
    isHovering: boolean;
  }) => void;
  zigzagSettings?: ZigZagSettings;
  onUpdateZigZagSettings?: (settings: ZigZagSettings) => void;
  onOpenSettingsModal?: () => void;
  strategyTrades?: StrategyTrade[];
  showStrategyTrades?: boolean;
  onToggleStrategyPanel?: () => void;
  isStrategyPanelOpen?: boolean;
}

interface RenderedTrade {
  id: string;
  direction: 'BUY' | 'SELL';
  status: TradeStatus;
  xEntry: number;
  yEntry: number;
  xExit: number;
  yTP: number;
  ySL: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  pnl: number;
  candlesRemaining?: number;
  waitingForPostLeg?: boolean;
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
  zigzagSettings,
  onUpdateZigZagSettings,
  onOpenSettingsModal,
  strategyTrades,
  showStrategyTrades = true,
  onToggleStrategyPanel,
  isStrategyPanelOpen,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lastLoadedKeyRef = useRef<string>('');

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const zigzagSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dynamic Indicator Tool Settings
  const [maPeriod, setMaPeriod] = useState<number>(20);
  const [showMa, setShowMa] = useState<boolean>(false);

  const [zigzagAtrMultiplier, setZigzagAtrMultiplier] = useState<number>(3);
  const [showZigZag, setShowZigZag] = useState<boolean>(true);

  // Active ZigZag settings (either from props or local state)
  const activeZigZagMultiplier = zigzagSettings?.atrMultiplier ?? zigzagAtrMultiplier;
  const activeMinCandles = zigzagSettings?.minCandles ?? 3;
  const activeMinCandlesForLongLeg = zigzagSettings?.minCandlesForLongLeg ?? 20;
  const activeLongLegAtrMultiplier = zigzagSettings?.longLegAtrMultiplier ?? 10;

  // Tools state
  const [activeTool, setActiveTool] = useState<ActiveTool>('cursor');
  const [measurement, setMeasurement] = useState<PointMeasurement | null>(null);
  const [rectangles, setRectangles] = useState<DrawnRectangle[]>([]);
  const [currentRect, setCurrentRect] = useState<DrawnRectangle | null>(null);
  const [zigzagPoints, setZigzagPoints] = useState<ZigZagPoint[]>([]);
  const [zigzagLegs, setZigzagLegs] = useState<ZigZagLeg[]>([]);
  const [renderedLegs, setRenderedLegs] = useState<
    (ZigZagLeg & { x1: number; y1: number; x2: number; y2: number })[]
  >([]);
  const [zigzagCoords, setZigzagCoords] = useState<ZigZagCoord[]>([]);
  const [renderedTrades, setRenderedTrades] = useState<RenderedTrade[]>([]);

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
      visible: true,
    });
    volumeSeriesRef.current = volumeSeries;

    // 5. Configurable Moving Average Series
    const ma = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 2,
      title: `MA(${maPeriod})`,
      visible: false,
    });
    maSeriesRef.current = ma;

    // 6. Configurable ZigZag Series (ATR-based)
    const zigzag = chart.addSeries(LineSeries, {
      color: '#ffffff',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: showZigZag,
    });
    zigzagSeriesRef.current = zigzag;

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

  // Update chart data when candles, MA period, or ZigZag multiplier changes
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

    // Dynamic Moving Average calculation with user-typed period
    if (maSeriesRef.current) {
      const maData = calculateSMA(uniqueCandles, maPeriod).map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }));
      maSeriesRef.current.setData(maData);
      maSeriesRef.current.applyOptions({ title: `MA(${maPeriod})` });
    }

    // Dynamic ATR ZigZag calculation with user-configurable settings
    if (zigzagSeriesRef.current) {
      const { points: zgPoints, series: zgSeries } = calculateAtrZigZag(
        uniqueCandles,
        atrValues,
        activeZigZagMultiplier,
        activeMinCandles
      );
      const mappedZigZag = zgSeries.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }));
      zigzagSeriesRef.current.setData(mappedZigZag);
      zigzagSeriesRef.current.applyOptions({
        title: '',
        visible: showZigZag,
      });

      const analyzedLegs = analyzeZigZagLegs(
        zgPoints,
        activeMinCandlesForLongLeg,
        activeLongLegAtrMultiplier,
        zigzagSettings?.maxBlueLegPercent ?? 60,
        zigzagSettings?.maxBreakoutAtrMultiplier ?? 5
      );
      setZigzagPoints(zgPoints);
      setZigzagLegs(analyzedLegs);

      if (chartRef.current && candleSeriesRef.current && showZigZag) {
        const updateCoords = () => {
          if (!chartRef.current || !candleSeriesRef.current) return;
          const timeScale = chartRef.current.timeScale();
          const series = candleSeriesRef.current;

          const projectedLegs: (ZigZagLeg & { x1: number; y1: number; x2: number; y2: number })[] = [];
          for (const leg of analyzedLegs) {
            const x1 = timeScale.timeToCoordinate(leg.startTime as UTCTimestamp);
            const y1 = series.priceToCoordinate(leg.startPrice);
            const x2 = timeScale.timeToCoordinate(leg.endTime as UTCTimestamp);
            const y2 = series.priceToCoordinate(leg.endPrice);
            if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
              projectedLegs.push({ ...leg, x1, y1, x2, y2 });
            }
          }
          setRenderedLegs(projectedLegs);

          const coords: ZigZagCoord[] = [];
          for (let i = 0; i < zgPoints.length; i++) {
            const pt = zgPoints[i];
            const x = timeScale.timeToCoordinate(pt.time as UTCTimestamp);
            const y = series.priceToCoordinate(pt.value);
            if (x !== null && y !== null) {
              const incomingLeg = i > 0 ? analyzedLegs[i - 1] : null;
              const outgoingLeg = i < analyzedLegs.length ? analyzedLegs[i] : null;
              const activeLeg = (outgoingLeg && outgoingLeg.color !== 'white') ? outgoingLeg : incomingLeg;

              let colorHex = '#ffffff';
              let isHighlighted = false;
              if (activeLeg?.color === 'green') {
                colorHex = '#00E676';
                isHighlighted = true;
              } else if (activeLeg?.color === 'red') {
                colorHex = '#FF1744';
                isHighlighted = true;
              } else if (activeLeg?.color === 'blue') {
                colorHex = '#00E5FF';
                isHighlighted = true;
              } else if (activeLeg?.color === 'dark_blue') {
                colorHex = '#3B82F6';
                isHighlighted = true;
              }

              // Explicit letter coloring matching user rules
              if (pt.label === 'C' || pt.label === 'D') {
                colorHex = '#00E5FF'; // آبی کم‌رنگ
                isHighlighted = true;
              } else if (pt.label === 'E' || pt.label === 'F') {
                colorHex = '#3B82F6'; // آبی پررنگ
                isHighlighted = true;
              }

              coords.push({
                x,
                y,
                colorHex,
                isHighlighted,
                label: pt.label,
                pointType: pt.type,
              });
            }
          }
          setZigzagCoords(coords);
        };

        requestAnimationFrame(updateCoords);
        setTimeout(updateCoords, 60);
      }
    }

    // Auto-fit content only on pair or timeframe switch
    const currentKey = `${symbol}_${timeframe}`;
    if (lastLoadedKeyRef.current !== currentKey) {
      lastLoadedKeyRef.current = currentKey;
      chartRef.current.timeScale().fitContent();
    }
  }, [
    candles,
    symbol,
    timeframe,
    atrValues,
    maPeriod,
    zigzagSettings,
    activeZigZagMultiplier,
    activeMinCandles,
    activeMinCandlesForLongLeg,
    activeLongLegAtrMultiplier,
    showZigZag,
  ]);

  // Handle MA visibility toggle
  useEffect(() => {
    if (maSeriesRef.current) {
      maSeriesRef.current.applyOptions({ visible: showMa });
    }
  }, [showMa]);

  // Handle ZigZag visibility toggle
  useEffect(() => {
    if (zigzagSeriesRef.current) {
      zigzagSeriesRef.current.applyOptions({ visible: showZigZag });
    }
  }, [showZigZag]);

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
        const lastC = candles[candles.length - 1];
        onHoverAtr?.({
          atr: latestAtr,
          twoAtr: latestAtr * 2,
          threeAtr: latestAtr * 3,
          candleRange: lastC ? Math.max(0, lastC.high - lastC.low) : 0,
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
        const candleAtr =
          atrValues && atrValues[candleIdx] !== undefined
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
          candleRange: Math.max(0, c.high - c.low),
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

      // Update ZigZag legs and pivot points coordinates
      if (showZigZag && zigzagPoints.length > 0) {
        const projectedLegs: (ZigZagLeg & { x1: number; y1: number; x2: number; y2: number })[] = [];
        for (const leg of zigzagLegs) {
          const x1 = timeScale.timeToCoordinate(leg.startTime as UTCTimestamp);
          const y1 = series.priceToCoordinate(leg.startPrice);
          const x2 = timeScale.timeToCoordinate(leg.endTime as UTCTimestamp);
          const y2 = series.priceToCoordinate(leg.endPrice);
          if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            projectedLegs.push({ ...leg, x1, y1, x2, y2 });
          }
        }
        setRenderedLegs(projectedLegs);

        const coords: ZigZagCoord[] = [];
        for (let i = 0; i < zigzagPoints.length; i++) {
          const pt = zigzagPoints[i];
          const x = timeScale.timeToCoordinate(pt.time as UTCTimestamp);
          const y = series.priceToCoordinate(pt.value);
          if (x !== null && y !== null) {
            const incomingLeg = i > 0 ? zigzagLegs[i - 1] : null;
            const outgoingLeg = i < zigzagLegs.length ? zigzagLegs[i] : null;
            const activeLeg = (outgoingLeg && outgoingLeg.color !== 'white') ? outgoingLeg : incomingLeg;

            let colorHex = '#ffffff';
            let isHighlighted = false;
            if (activeLeg?.color === 'green') {
              colorHex = '#00E676';
              isHighlighted = true;
            } else if (activeLeg?.color === 'red') {
              colorHex = '#FF1744';
              isHighlighted = true;
            } else if (activeLeg?.color === 'blue') {
              colorHex = '#00E5FF';
              isHighlighted = true;
            } else if (activeLeg?.color === 'dark_blue') {
              colorHex = '#3B82F6';
              isHighlighted = true;
            }

            if (pt.label === 'C' || pt.label === 'D') {
              colorHex = '#00E5FF';
              isHighlighted = true;
            } else if (pt.label === 'E' || pt.label === 'F') {
              colorHex = '#3B82F6';
              isHighlighted = true;
            }

            coords.push({
              x,
              y,
              colorHex,
              isHighlighted,
              label: pt.label,
              pointType: pt.type,
            });
          }
        }
        setZigzagCoords(coords);
      }

      // Update Strategy Trades coordinates on chart navigation
      if (showStrategyTrades && strategyTrades && strategyTrades.length > 0) {
        const projs: RenderedTrade[] = [];
        for (const t of strategyTrades) {
          const startTime = (t.entryTime || t.timeF) as UTCTimestamp;
          const endTime = (t.exitTime || candles[candles.length - 1]?.time) as UTCTimestamp;
          const x1 = timeScale.timeToCoordinate(startTime);
          const x2 = timeScale.timeToCoordinate(endTime);
          const yEntry = series.priceToCoordinate(t.entryPrice);
          const yTP = series.priceToCoordinate(t.takeProfit);
          const ySL = series.priceToCoordinate(t.stopLoss);

          if (x1 !== null && yEntry !== null) {
            projs.push({
              id: t.id,
              direction: t.direction,
              status: t.status,
              xEntry: x1,
              yEntry,
              xExit: Math.max(x1 + 35, x2 ?? x1 + 60),
              yTP: yTP ?? yEntry,
              ySL: ySL ?? yEntry,
              entryPrice: t.entryPrice,
              takeProfit: t.takeProfit,
              stopLoss: t.stopLoss,
              riskReward: t.riskReward,
              pnl: t.pnl,
              candlesRemaining: t.candlesRemainingToEnter,
              waitingForPostLeg: t.waitingForPostLeg,
            });
          }
        }
        setRenderedTrades(projs);
      }
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleRangeOrScaleChange);
    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeOrScaleChange);
    };
  }, [measurement, rectangles, showZigZag, zigzagPoints, zigzagLegs, showStrategyTrades, strategyTrades, candles]);

  // Keep ZigZag visuals updated when points or visibility changes
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !showZigZag || zigzagPoints.length === 0) {
      setRenderedLegs([]);
      setZigzagCoords([]);
      return;
    }
    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;

    const projectedLegs: (ZigZagLeg & { x1: number; y1: number; x2: number; y2: number })[] = [];
    for (const leg of zigzagLegs) {
      const x1 = timeScale.timeToCoordinate(leg.startTime as UTCTimestamp);
      const y1 = series.priceToCoordinate(leg.startPrice);
      const x2 = timeScale.timeToCoordinate(leg.endTime as UTCTimestamp);
      const y2 = series.priceToCoordinate(leg.endPrice);
      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        projectedLegs.push({ ...leg, x1, y1, x2, y2 });
      }
    }
    setRenderedLegs(projectedLegs);

    const coords: ZigZagCoord[] = [];
    for (let i = 0; i < zigzagPoints.length; i++) {
      const pt = zigzagPoints[i];
      const x = timeScale.timeToCoordinate(pt.time as UTCTimestamp);
      const y = series.priceToCoordinate(pt.value);
      if (x !== null && y !== null) {
        const incomingLeg = i > 0 ? zigzagLegs[i - 1] : null;
        const outgoingLeg = i < zigzagLegs.length ? zigzagLegs[i] : null;
        const activeLeg = (outgoingLeg && outgoingLeg.color !== 'white') ? outgoingLeg : incomingLeg;

        let colorHex = '#ffffff';
        let isHighlighted = false;
        if (activeLeg?.color === 'green') {
          colorHex = '#00E676';
          isHighlighted = true;
        } else if (activeLeg?.color === 'red') {
          colorHex = '#FF1744';
          isHighlighted = true;
        } else if (activeLeg?.color === 'blue') {
          colorHex = '#00E5FF';
          isHighlighted = true;
        } else if (activeLeg?.color === 'dark_blue') {
          colorHex = '#3B82F6';
          isHighlighted = true;
        }

        if (pt.label === 'C' || pt.label === 'D') {
          colorHex = '#00E5FF';
          isHighlighted = true;
        } else if (pt.label === 'E' || pt.label === 'F') {
          colorHex = '#3B82F6';
          isHighlighted = true;
        }

        coords.push({
          x,
          y,
          colorHex,
          isHighlighted,
          label: pt.label,
          pointType: pt.type,
        });
      }
    }
    setZigzagCoords(coords);
  }, [zigzagPoints, zigzagLegs, showZigZag]);

  // Keep Strategy Trades visuals updated
  useEffect(() => {
    if (
      !chartRef.current ||
      !candleSeriesRef.current ||
      !showStrategyTrades ||
      !strategyTrades ||
      strategyTrades.length === 0
    ) {
      setRenderedTrades([]);
      return;
    }
    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;

    const projs: RenderedTrade[] = [];
    for (const t of strategyTrades) {
      const startTime = (t.entryTime || t.timeF) as UTCTimestamp;
      const endTime = (t.exitTime || candles[candles.length - 1]?.time) as UTCTimestamp;
      const x1 = timeScale.timeToCoordinate(startTime);
      const x2 = timeScale.timeToCoordinate(endTime);
      const yEntry = series.priceToCoordinate(t.entryPrice);
      const yTP = series.priceToCoordinate(t.takeProfit);
      const ySL = series.priceToCoordinate(t.stopLoss);

      if (x1 !== null && yEntry !== null) {
        projs.push({
          id: t.id,
          direction: t.direction,
          status: t.status,
          xEntry: x1,
          yEntry,
          xExit: Math.max(x1 + 35, x2 ?? x1 + 60),
          yTP: yTP ?? yEntry,
          ySL: ySL ?? yEntry,
          entryPrice: t.entryPrice,
          takeProfit: t.takeProfit,
          stopLoss: t.stopLoss,
          riskReward: t.riskReward,
          pnl: t.pnl,
          candlesRemaining: t.candlesRemainingToEnter,
          waitingForPostLeg: t.waitingForPostLeg,
        });
      }
    }
    setRenderedTrades(projs);
  }, [strategyTrades, showStrategyTrades, candles]);

  // Handle Chart Type changes
  useEffect(() => {
    if (!candleSeriesRef.current || !lineSeriesRef.current || !areaSeriesRef.current) return;
    candleSeriesRef.current.applyOptions({ visible: chartType === 'candlestick' });
    lineSeriesRef.current.applyOptions({ visible: chartType === 'line' });
    areaSeriesRef.current.applyOptions({ visible: chartType === 'area' });
  }, [chartType]);

  // Handle Tool change: Enable chart panning in cursor mode, disable during drawing
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      handleScroll: {
        pressedMouseMove: activeTool === 'cursor' || activeTool === 'ma' || activeTool === 'zigzag',
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
    // If not in a drawing tool, allow native chart panning!
    if (activeTool !== 'anchor' && activeTool !== 'rectangle') {
      return;
    }

    if (e.button !== 0 || !chartContainerRef.current || !chartRef.current || !candleSeriesRef.current) {
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
    pointsDistance = Math.abs(measurement.price2 - measurement.price1);

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

    const baseAtr = (atrValues && atrValues[startIdx] !== undefined)
      ? atrValues[startIdx]
      : (latestAtr || 1);
    percentOfAtr55 = baseAtr > 0 ? (pointsDistance / baseAtr) * 100 : 0;

    candleCount = Math.max(1, endIdx - startIdx + 1);

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
      {/* Top Toolbar: Timeframes, Chart Type, Zoom Controls (Clean - MA/Volume/ZigZag removed) */}
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

        {/* Right side: Chart type, Zoom Controls, Refresh and Fullscreen */}
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
            </div>
          </div>
        ) : (
          <span className="text-gray-500">در حال بارگذاری اطلاعات کندل...</span>
        )}

        {/* Active Indicators Status Legend */}
        <div className="flex items-center gap-2 text-[11px]">
          {showMa && <span className="text-[#38bdf8]">MA({maPeriod})</span>}
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
            title="ابزار Anchor: محاسبه فاصله پوینت و درصد ATR55"
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

          {/* 4. MOVING AVERAGE TOOL (MA) */}
          <button
            onClick={() => setActiveTool(activeTool === 'ma' ? 'cursor' : 'ma')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
              activeTool === 'ma'
                ? 'bg-[#38bdf8] text-black shadow-[0_0_12px_rgba(56,189,248,0.5)] font-bold'
                : 'text-gray-400 hover:text-[#38bdf8] hover:bg-[#232a38]'
            }`}
            title="ابزار میانگین متحرک (MA): تنظیم دوره و نمایش"
          >
            <TrendingUp className="w-4 h-4" />
            {showMa && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#38bdf8]" />
            )}
          </button>

          {/* 5. ZIGZAG TOOL */}
          <button
            onClick={() => setActiveTool(activeTool === 'zigzag' ? 'cursor' : 'zigzag')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
              activeTool === 'zigzag'
                ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)] font-bold'
                : 'text-gray-400 hover:text-amber-400 hover:bg-[#232a38]'
            }`}
            title="ابزار ZigZag: تنظیم ضریب ATR و نمایش"
          >
            <Activity className="w-4 h-4" />
            {showZigZag && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {/* 6. STRATEGY PANEL TOGGLE */}
          {onToggleStrategyPanel && (
            <button
              onClick={onToggleStrategyPanel}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
                isStrategyPanelOpen
                  ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.6)] font-bold'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/15'
              }`}
              title="باز/بستن پنل استراتژی معاملاتی (یک‌سوم صفحه)"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
            </button>
          )}

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
            activeTool === 'anchor' || activeTool === 'rectangle' ? 'cursor-crosshair' : ''
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div ref={chartContainerRef} className="w-full h-full" />

          {/* DYNAMIC TOOL SETTINGS BARS (هروقت ابزاری انتخاب شد تنظیماتش را در اونجا قرار بده) */}
          {activeTool === 'ma' && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#181d26]/95 border border-[#38bdf8]/50 shadow-2xl backdrop-blur-md text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#38bdf8] font-bold font-sans">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>تنظیمات MA</span>
              </div>
              <div className="h-4 w-px bg-[#2d3748]" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 font-sans">دوره (Period):</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maPeriod}
                  onChange={(e) => setMaPeriod(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-0.5 rounded bg-[#10131a] border border-[#38bdf8]/40 text-[#38bdf8] font-bold font-mono text-center focus:outline-none focus:border-[#38bdf8]"
                  title="دوره MA را تایپ کنید (مثلاً 14, 20, 50, 200)"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 font-sans">نمایش:</span>
                <button
                  onClick={() => setShowMa(!showMa)}
                  className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer ${
                    showMa
                      ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {showMa ? 'فعال' : 'غیرفعال'}
                </button>
              </div>
              <button
                onClick={() => setActiveTool('cursor')}
                className="p-1 rounded hover:bg-[#2b3546] text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="بستن تنظیمات"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTool === 'zigzag' && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#181d26]/95 border border-amber-500/50 shadow-2xl backdrop-blur-md text-xs font-mono">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold font-sans">
                <Activity className="w-3.5 h-3.5" />
                <span>تنظیمات ZigZag</span>
              </div>
              <div className="h-4 w-px bg-[#2d3748]" />

              {/* 1. Period ATR */}
              <div className="flex items-center gap-1.5" title="Period ATR (دوره زمانی ATR)">
                <span className="text-gray-300 font-sans text-[11px]">Period:</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={zigzagSettings?.atrPeriod ?? 55}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    if (onUpdateZigZagSettings && zigzagSettings) {
                      onUpdateZigZagSettings({ ...zigzagSettings, atrPeriod: val });
                    }
                  }}
                  className="w-14 px-1.5 py-0.5 rounded bg-[#10131a] border border-amber-500/40 text-amber-400 font-bold font-mono text-center focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* 2. Min Candle */}
              <div className="flex items-center gap-1.5" title="Min Candle (حداقل فاصله کندل بین دو پیوت)">
                <span className="text-gray-300 font-sans text-[11px]">Min Candle:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={zigzagSettings?.minCandles ?? 3}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    if (onUpdateZigZagSettings && zigzagSettings) {
                      onUpdateZigZagSettings({ ...zigzagSettings, minCandles: val });
                    }
                  }}
                  className="w-12 px-1.5 py-0.5 rounded bg-[#10131a] border border-sky-500/40 text-sky-400 font-bold font-mono text-center focus:outline-none focus:border-sky-400"
                />
              </div>

              {/* 3. Min Candle for Long Leg */}
              <div className="flex items-center gap-1.5" title="Min Candle for Long Leg (حداقل کندل برای لگ سبز/قرمز)">
                <span className="text-gray-300 font-sans text-[11px]">Long Leg:</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={zigzagSettings?.minCandlesForLongLeg ?? 20}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    if (onUpdateZigZagSettings && zigzagSettings) {
                      onUpdateZigZagSettings({ ...zigzagSettings, minCandlesForLongLeg: val });
                    }
                  }}
                  className="w-14 px-1.5 py-0.5 rounded bg-[#10131a] border border-emerald-500/40 text-emerald-400 font-bold font-mono text-center focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* 4. ATR Multiplier */}
              <div className="flex items-center gap-1.5" title="ضریب نوسان ATR عادی">
                <span className="text-gray-300 font-sans text-[11px]">ضریب:</span>
                <input
                  type="number"
                  min={0.1}
                  max={20}
                  step="any"
                  value={zigzagSettings?.atrMultiplier ?? zigzagAtrMultiplier}
                  onChange={(e) => {
                    const val = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                    setZigzagAtrMultiplier(val);
                    if (onUpdateZigZagSettings && zigzagSettings) {
                      onUpdateZigZagSettings({ ...zigzagSettings, atrMultiplier: val });
                    }
                  }}
                  className="w-13 px-1.5 py-0.5 rounded bg-[#10131a] border border-purple-500/40 text-purple-400 font-bold font-mono text-center focus:outline-none focus:border-purple-400"
                />
                <span className="text-gray-400 text-[10px]">×ATR</span>
              </div>

              {/* 5. Long Leg ATR Multiplier */}
              <div className="flex items-center gap-1.5" title="ضریب ATR لگ‌های بزرگ (سبز و قرمز)">
                <span className="text-gray-300 font-sans text-[11px]">ضریب بزرگ:</span>
                <input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={zigzagSettings?.longLegAtrMultiplier ?? 10}
                  onChange={(e) => {
                    const val = Math.max(0.5, parseFloat(e.target.value) || 0.5);
                    if (onUpdateZigZagSettings && zigzagSettings) {
                      onUpdateZigZagSettings({ ...zigzagSettings, longLegAtrMultiplier: val });
                    }
                  }}
                  className="w-13 px-1.5 py-0.5 rounded bg-[#10131a] border border-rose-500/40 text-rose-400 font-bold font-mono text-center focus:outline-none focus:border-rose-400"
                />
                <span className="text-gray-400 text-[10px]">×ATR</span>
              </div>

              {/* Full Settings Modal button */}
              {onOpenSettingsModal && (
                <button
                  onClick={onOpenSettingsModal}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#222a38] hover:bg-[#2c3748] border border-[#354256] text-amber-300 text-[11px] font-sans transition-colors cursor-pointer"
                  title="باز کردن پنل کامل تنظیمات"
                >
                  <Sliders className="w-3 h-3 text-amber-400" />
                  <span>پیشرفته</span>
                </button>
              )}

              {/* Visibility Toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowZigZag(!showZigZag)}
                  className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer ${
                    showZigZag
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {showZigZag ? 'فعال' : 'غیرفعال'}
                </button>
              </div>

              <button
                onClick={() => setActiveTool('cursor')}
                className="p-1 rounded hover:bg-[#2b3546] text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="بستن تنظیمات"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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

              {/* Multi-colored ZigZag Legs:
                  - Bold Green (#00E676) for Up legs > 1000%
                  - Bold Red (#FF1744) for Down legs > 1000%
                  - Electric Blue (#00B0FF) for first leg breaking end of red/green leg
                  - Pure White (#ffffff) for all other legs */}
              {showZigZag &&
                renderedLegs.map((leg) => {
                  let strokeColor = '#ffffff';
                  let strokeWidth = '2';

                  if (leg.color === 'green') {
                    strokeColor = '#00E676'; // سبز پررنگ
                    strokeWidth = '3.5';
                  } else if (leg.color === 'red') {
                    strokeColor = '#FF1744'; // قرمز پررنگ
                    strokeWidth = '3.5';
                  } else if (leg.color === 'blue') {
                    strokeColor = '#00E5FF'; // آبی روشن (اولین لگ شکننده < 5 ATR)
                    strokeWidth = '3.5';
                  } else if (leg.color === 'dark_blue') {
                    strokeColor = '#3B82F6'; // آبی پررنگ (لگ دوم بعد از آبی)
                    strokeWidth = '3.5';
                  }

                  return (
                    <g key={`zz-leg-${leg.index}`}>
                      {leg.color !== 'white' && (
                        <line
                          x1={leg.x1}
                          y1={leg.y1}
                          x2={leg.x2}
                          y2={leg.y2}
                          stroke={strokeColor}
                          strokeWidth="8"
                          strokeOpacity="0.25"
                          strokeLinecap="round"
                        />
                      )}
                      <line
                        x1={leg.x1}
                        y1={leg.y1}
                        x2={leg.x2}
                        y2={leg.y2}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}

              {/* ZigZag Pivot Dots and Letter Labels (A, B, C, D, E, F) */}
              {showZigZag &&
                zigzagCoords.map((pt, idx) => (
                  <g key={`zz-pt-${idx}`}>
                    {pt.isHighlighted && (
                      <circle cx={pt.x} cy={pt.y} r="8" fill={pt.colorHex} fillOpacity="0.25" />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.isHighlighted ? '5' : '3.5'}
                      fill={pt.colorHex}
                      stroke="#131722"
                      strokeWidth="1.5"
                    />
                    <circle cx={pt.x} cy={pt.y} r="1.5" fill="#131722" />

                    {/* Letter Label (A, B for Green/Red; C, D for Light Blue; E, F for Dark Blue) */}
                    {pt.label && (
                      <g className="select-none pointer-events-none">
                        <rect
                          x={pt.x - 7.5}
                          y={pt.pointType === 'high' ? pt.y - 23 : pt.y + 9}
                          width={15}
                          height={14}
                          rx={3}
                          fill="#0b0e14"
                          fillOpacity="0.95"
                          stroke={pt.colorHex}
                          strokeWidth="1.2"
                        />
                        <text
                          x={pt.x}
                          y={pt.pointType === 'high' ? pt.y - 15.5 : pt.y + 16.5}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={pt.colorHex}
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="ui-monospace, monospace"
                        >
                          {pt.label}
                        </text>
                      </g>
                    )}
                  </g>
                ))}

              {/* Strategy 1 Trades & Levels Overlay (Entry E, Stop F, Target A) */}
              {showStrategyTrades &&
                renderedTrades.map((rt) => {
                  const isBuy = rt.direction === 'BUY';
                  const isWin = rt.status === 'WIN';
                  const isLoss = rt.status === 'LOSS';
                  const isActive = rt.status === 'ACTIVE';

                  return (
                    <g key={`trade-exec-${rt.id}`}>
                      {/* Entry Price Line (Amber) */}
                      <line
                        x1={rt.xEntry}
                        y1={rt.yEntry}
                        x2={rt.xExit}
                        y2={rt.yEntry}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.85"
                      />

                      {/* Take Profit Line (Emerald / Green) */}
                      <line
                        x1={rt.xEntry}
                        y1={rt.yTP}
                        x2={rt.xExit}
                        y2={rt.yTP}
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                      <g transform={`translate(${rt.xExit + 2}, ${rt.yTP - 8})`}>
                        <rect
                          x={0}
                          y={0}
                          width={46}
                          height={14}
                          rx={2}
                          fill="#064e3b"
                          stroke="#10b981"
                          strokeWidth="0.8"
                          fillOpacity="0.9"
                        />
                        <text
                          x={23}
                          y={10}
                          textAnchor="middle"
                          fill="#34d399"
                          fontSize="8"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          TP (A)
                        </text>
                      </g>

                      {/* Stop Loss Line (Rose / Red) */}
                      <line
                        x1={rt.xEntry}
                        y1={rt.ySL}
                        x2={rt.xExit}
                        y2={rt.ySL}
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                      <g transform={`translate(${rt.xExit + 2}, ${rt.ySL - 8})`}>
                        <rect
                          x={0}
                          y={0}
                          width={46}
                          height={14}
                          rx={2}
                          fill="#881337"
                          stroke="#f43f5e"
                          strokeWidth="0.8"
                          fillOpacity="0.9"
                        />
                        <text
                          x={23}
                          y={10}
                          textAnchor="middle"
                          fill="#fb7185"
                          fontSize="8"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          SL (F)
                        </text>
                      </g>

                      {/* Vertical connector line */}
                      <line
                        x1={rt.xEntry}
                        y1={Math.min(rt.yTP, rt.ySL)}
                        x2={rt.xEntry}
                        y2={Math.max(rt.yTP, rt.ySL)}
                        stroke="#64748b"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        strokeOpacity="0.6"
                      />

                      {/* Entry Badge */}
                      <g transform={`translate(${rt.xEntry - 28}, ${isBuy ? rt.yEntry + 8 : rt.yEntry - 22})`}>
                        <rect
                          x={0}
                          y={0}
                          width={56}
                          height={16}
                          rx={3}
                          fill={isBuy ? '#064e3b' : '#881337'}
                          stroke={isBuy ? '#10b981' : '#f43f5e'}
                          strokeWidth="1"
                          fillOpacity="0.95"
                        />
                        <text
                          x={28}
                          y={11}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="8.5"
                          fontWeight="bold"
                          fontFamily="ui-monospace, monospace"
                        >
                          {isBuy ? '▲ BUY' : '▼ SELL'} {isWin ? '✓' : isLoss ? '✗' : isActive ? '●' : ''}
                        </text>
                      </g>
                    </g>
                  );
                })}
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

          {/* Active Tool Prompt Toast for Anchor / Rectangle */}
          {(activeTool === 'anchor' || activeTool === 'rectangle') && !measurement && !currentRect && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-[#181d26]/90 border border-[#2d3748] text-gray-200 text-xs backdrop-blur-md shadow-lg flex items-center gap-2 pointer-events-none">
              {activeTool === 'anchor' ? (
                <>
                  <Anchor className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>ابزار Anchor: با کلیک و درگ روی چارت، دو نقطه را مشخص کنید.</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-sky-400 animate-pulse" />
                  <span>ابزار مربع: با کلیک و درگ روی چارت، باکس مورد نظر را بکشید.</span>
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
        </div>
      </div>
    </div>
  );
};

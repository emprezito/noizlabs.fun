import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, ColorType, LineStyle } from "lightweight-charts";

interface TradingViewChartProps {
  data: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  height?: number;
}

export function TradingViewChart({ data, height = 500 }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [interval, setInterval] = useState("1H");

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // DexScreener-style professional dark theme
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0b0f" },
        textColor: "#6b7280",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#16161e", style: LineStyle.Solid },
        horzLines: { color: "#16161e", style: LineStyle.Solid },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#4b5563",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1f2937",
        },
        horzLine: {
          width: 1,
          color: "#4b5563",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1f2937",
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.05,
          bottom: 0.2,
        },
        textColor: "#6b7280",
        entireTextOnly: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const hours = date.getHours().toString().padStart(2, '0');
          const mins = date.getMinutes().toString().padStart(2, '0');
          return `${hours}:${mins}`;
        },
        rightOffset: 5,
        barSpacing: 12,
        minBarSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
    });

    chartRef.current = chart;

    // DexScreener-style candlestick colors
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      priceFormat: {
        type: 'price',
        precision: 9,
        minMove: 0.000000001,
      },
    });
    candleSeriesRef.current = candleSeries;

    // Line series (hidden by default)
    const lineSeries = chart.addLineSeries({
      color: "#8b5cf6",
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 9,
        minMove: 0.000000001,
      },
      visible: false,
    });
    lineSeriesRef.current = lineSeries;

    // Volume with transparency
    const volumeSeries = chart.addHistogramSeries({
      color: "#3b82f6",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [height]);

  // Toggle chart type
  useEffect(() => {
    if (!candleSeriesRef.current || !lineSeriesRef.current) return;
    
    if (chartType === "candle") {
      candleSeriesRef.current.applyOptions({ visible: true });
      lineSeriesRef.current.applyOptions({ visible: false });
    } else {
      candleSeriesRef.current.applyOptions({ visible: false });
      lineSeriesRef.current.applyOptions({ visible: true });
    }
  }, [chartType]);

  // Update data when it changes
  useEffect(() => {
    if (!candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const sortedData = [...data].sort((a, b) => a.time - b.time);

    const candleData: CandlestickData<Time>[] = sortedData.map((d) => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const lineData = sortedData.map((d) => ({
      time: d.time as UTCTimestamp,
      value: d.close,
    }));

    const volumeData = sortedData.map((d) => ({
      time: d.time as UTCTimestamp,
      value: d.volume || 0,
      color: d.close >= d.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
    }));

    candleSeriesRef.current.setData(candleData);
    lineSeriesRef.current.setData(lineData);
    volumeSeriesRef.current.setData(volumeData);

    // Don't auto-fit - let user control zoom
    if (chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [data]);

  const intervals = ["1m", "5m", "15m", "1H", "4H", "1D"];

  return (
    <div className="relative overflow-hidden bg-[#0b0b0f] border border-[#1f1f2e] rounded-lg">
      {/* Top toolbar - DexScreener style */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f2e] bg-[#0b0b0f]">
        {/* Left side - Chart type */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChartType("candle")}
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              chartType === "candle" 
                ? "bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30" 
                : "text-[#6b7280] hover:text-white hover:bg-white/5"
            }`}
          >
            Candles
          </button>
          <button
            onClick={() => setChartType("line")}
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              chartType === "line" 
                ? "bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/30" 
                : "text-[#6b7280] hover:text-white hover:bg-white/5"
            }`}
          >
            Line
          </button>
        </div>

        {/* Right side - Time intervals */}
        <div className="flex items-center gap-0.5">
          {intervals.map((int) => (
            <button
              key={int}
              onClick={() => setInterval(int)}
              className={`px-2 py-1 text-[10px] font-mono font-medium rounded transition-all ${
                interval === int 
                  ? "bg-white/10 text-white" 
                  : "text-[#6b7280] hover:text-white hover:bg-white/5"
              }`}
            >
              {int}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div ref={chartContainerRef} className="w-full" />
      
      {/* Bottom info bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1f1f2e] bg-[#0b0b0f]/80 text-[9px] text-[#6b7280]">
        <div className="flex items-center gap-3">
          <span>O: <span className="text-white">{data[data.length - 1]?.open.toFixed(9) || '-'}</span></span>
          <span>H: <span className="text-[#22c55e]">{data[data.length - 1]?.high.toFixed(9) || '-'}</span></span>
          <span>L: <span className="text-[#ef4444]">{data[data.length - 1]?.low.toFixed(9) || '-'}</span></span>
          <span>C: <span className="text-white">{data[data.length - 1]?.close.toFixed(9) || '-'}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Vol: <span className="text-white">{data[data.length - 1]?.volume?.toFixed(2) || '0'}</span></span>
        </div>
      </div>
    </div>
  );
}

// Generate demo OHLC data from simple price data
export function generateCandleData(
  priceHistory: Array<{ time: string; price: number; volume?: number }>
): Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> {
  if (priceHistory.length === 0) return [];

  // Group by hour and generate candles
  const candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> = [];
  
  for (let i = 0; i < priceHistory.length; i++) {
    const current = priceHistory[i];
    const variance = current.price * 0.05; // 5% variance for realistic candles
    
    const open = i === 0 ? current.price : candles[candles.length - 1]?.close || current.price;
    const close = current.price;
    const high = Math.max(open, close) + Math.random() * variance;
    const low = Math.min(open, close) - Math.random() * variance;
    
    candles.push({
      time: current.time,
      open,
      high,
      low,
      close,
      volume: current.volume || Math.random() * 5000,
    });
  }
  
  return candles;
}

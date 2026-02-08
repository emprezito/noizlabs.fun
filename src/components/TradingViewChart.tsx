import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, ColorType } from "lightweight-charts";

interface TradingViewChartProps {
  data: Array<{
    time: number; // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  height?: number;
}

export function TradingViewChart({ data, height = 400 }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [chartType, setChartType] = useState<"candle" | "line">("candle");

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with pump.fun/dexscreener dark theme
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0d" },
        textColor: "#848e9c",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1a1a2e", style: 1 },
        horzLines: { color: "#1a1a2e", style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#758696",
          style: 0,
          labelBackgroundColor: "#1e222d",
        },
        horzLine: {
          width: 1,
          color: "#758696",
          style: 0,
          labelBackgroundColor: "#1e222d",
        },
      },
      rightPriceScale: {
        borderColor: "#1a1a2e",
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
        textColor: "#848e9c",
      },
      timeScale: {
        borderColor: "#1a1a2e",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const hours = date.getHours().toString().padStart(2, '0');
          const mins = date.getMinutes().toString().padStart(2, '0');
          return `${hours}:${mins}`;
        },
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height: height,
    });

    chartRef.current = chart;

    // Add candlestick series with pump.fun green/red colors
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00c076",
      downColor: "#f6465d",
      borderDownColor: "#f6465d",
      borderUpColor: "#00c076",
      wickDownColor: "#f6465d",
      wickUpColor: "#00c076",
    });
    candleSeriesRef.current = candleSeries;

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
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

  // Update data when it changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    // Sort data by time ascending (required by lightweight-charts)
    const sortedData = [...data].sort((a, b) => a.time - b.time);

    // Convert data format - time is already Unix timestamp in seconds
    const candleData: CandlestickData<Time>[] = sortedData.map((d) => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = sortedData.map((d) => ({
      time: d.time as UTCTimestamp,
      value: d.volume || 0,
      color: d.close >= d.open ? "rgba(0, 192, 118, 0.4)" : "rgba(246, 70, 93, 0.4)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-[#0d0d0d]">
      {/* Chart Type Toggle - pump.fun style */}
      <div className="absolute top-3 left-3 z-10 flex gap-1 bg-[#1e222d] rounded-md p-1">
        <button
          onClick={() => setChartType("candle")}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            chartType === "candle" 
              ? "bg-[#00c076] text-white" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Candles
        </button>
        <button
          onClick={() => setChartType("line")}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            chartType === "line" 
              ? "bg-[#00c076] text-white" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Line
        </button>
      </div>
      
      {/* Time interval buttons - dexscreener style */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 bg-[#1e222d] rounded-md p-1">
        {["5m", "15m", "1H", "4H", "1D"].map((interval) => (
          <button
            key={interval}
            className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-[#2a2e39] rounded transition-colors"
          >
            {interval}
          </button>
        ))}
      </div>
      
      <div ref={chartContainerRef} className="w-full" />
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

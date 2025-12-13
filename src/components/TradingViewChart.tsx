import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";

interface TradingViewChartProps {
  data: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  height?: number;
}

export function TradingViewChart({ data, height = 300 }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [chartType, setChartType] = useState<"candle" | "line">("candle");

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "rgba(139, 92, 246, 0.1)" },
        horzLines: { color: "rgba(139, 92, 246, 0.1)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#8B5CF6",
          style: 2,
        },
        horzLine: {
          width: 1,
          color: "#8B5CF6",
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(139, 92, 246, 0.3)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: "rgba(139, 92, 246, 0.3)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height: height,
    });

    chartRef.current = chart;

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderDownColor: "#EF4444",
      borderUpColor: "#22C55E",
      wickDownColor: "#EF4444",
      wickUpColor: "#22C55E",
    });
    candleSeriesRef.current = candleSeries;

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: "#8B5CF6",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
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

    // Convert data format
    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map((d) => ({
      time: d.time as Time,
      value: d.volume || 0,
      color: d.close >= d.open ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative">
      {/* Chart Type Toggle */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur rounded-lg p-1">
        <button
          onClick={() => setChartType("candle")}
          className={`px-2 py-1 text-xs rounded ${
            chartType === "candle" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Candles
        </button>
        <button
          onClick={() => setChartType("line")}
          className={`px-2 py-1 text-xs rounded ${
            chartType === "line" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Line
        </button>
      </div>
      <div ref={chartContainerRef} />
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
  
  let currentOpen = priceHistory[0].price;
  
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

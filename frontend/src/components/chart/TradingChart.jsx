import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import api from '../../lib/api';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useRealtimeChart } from '../../hooks/useRealtimeChart';

const TradingChart = ({ symbol, tradingSymbol, onSymbolChange }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candleSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);

    const [timeframe, setTimeframe] = useState('5M');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastPrice, setLastPrice] = useState(null);

    // Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: { color: '#1e293b' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    color: '#3b82f6',
                    width: 1,
                    style: 3,
                },
                horzLine: {
                    color: '#3b82f6',
                    width: 1,
                    style: 3,
                },
            },
            rightPriceScale: {
                borderColor: '#334155',
            },
            timeScale: {
                borderColor: '#334155',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Candlestick Series
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // Volume Series (as histogram)
        const volumeSeries = chart.addHistogramSeries({
            color: '#3b82f6',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '',
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        // Handle Resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // 🌟 Enable real-time WebSocket updates (after chart is initialized)
    useRealtimeChart(symbol, candleSeriesRef.current, timeframe);

    // Fetch Historical Data when symbol/timeframe changes
    useEffect(() => {
        console.log("📈 Chart Effect Triggered:", { symbol, tradingSymbol, timeframe }); // 🌟 DEBUG

        if (!symbol || !candleSeriesRef.current) {
            console.log("⏳ Waiting for symbol or chart to be ready..."); // 🌟 DEBUG
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Calculate time range based on timeframe
                const to = Math.floor(Date.now() / 1000);
                const from = to - getTimeRangeInSeconds(timeframe);

                const response = await api.get(`/marketdata/history/${symbol}`, {
                    params: {
                        interval: timeframe,
                        from: from,
                        to: to,
                    },
                });

                const candles = response.data;

                if (candles && candles.length > 0) {
                    // Format data for Lightweight Charts
                    const chartData = candles.map(candle => ({
                        time: Math.floor(candle.time / 1000), // Convert to seconds
                        open: parseFloat(candle.open),
                        high: parseFloat(candle.high),
                        low: parseFloat(candle.low),
                        close: parseFloat(candle.close),
                    }));

                    const volumeData = candles.map(candle => ({
                        time: Math.floor(candle.time / 1000),
                        value: candle.volume,
                        color: candle.close >= candle.open ? '#10b98180' : '#ef444480',
                    }));

                    candleSeriesRef.current.setData(chartData);
                    volumeSeriesRef.current.setData(volumeData);

                    // Update last price
                    setLastPrice(chartData[chartData.length - 1].close);

                    // Fit content
                    chartRef.current.timeScale().fitContent();
                } else {
                    setError('No data available for this symbol');
                }
            } catch (err) {
                console.error('Chart data fetch error:', err);
                setError(err.response?.data?.message || 'Failed to load chart data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol, timeframe]);

    const getTimeRangeInSeconds = (tf) => {
        const ranges = {
            '1M': 3600,      // 1 hour
            '5M': 21600,     // 6 hours
            '15M': 86400,    // 1 day
            '1H': 604800,    // 7 days
            '1D': 7776000,   // 90 days
        };
        return ranges[tf] || 21600;
    };

    const timeframes = [
        { value: '1M', label: '1m' },
        { value: '5M', label: '5m' },
        { value: '15M', label: '15m' },
        { value: '1H', label: '1h' },
        { value: '1D', label: '1D' },
    ];

    return (
        <div className="bg-trade-panel border border-trade-border rounded-xl h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-trade-border flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">
                            {tradingSymbol || 'Select Symbol'}
                        </h3>
                        {lastPrice && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-2xl font-bold text-trade-buy">
                                    ₹{lastPrice.toFixed(2)}
                                </span>
                                <TrendingUp size={16} className="text-trade-buy" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Timeframe Selector */}
                <div className="flex gap-2">
                    {timeframes.map(tf => (
                        <button
                            key={tf.value}
                            onClick={() => setTimeframe(tf.value)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                timeframe === tf.value
                                    ? 'bg-trade-primary text-white'
                                    : 'bg-trade-bg text-trade-muted hover:text-white'
                            }`}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Canvas */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-trade-panel/50 z-10">
                        <RefreshCw className="animate-spin text-trade-primary" size={32} />
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-red-400 text-center">
                            <p className="font-medium">{error}</p>
                            <p className="text-sm text-trade-muted mt-2">
                                Try selecting a different symbol or timeframe
                            </p>
                        </div>
                    </div>
                )}

                {!symbol && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-trade-muted">
                            <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Select a symbol to view chart</p>
                            <p className="text-sm mt-2">Use the order form to search for stocks</p>
                        </div>
                    </div>
                )}

                <div
                    ref={chartContainerRef}
                    className="w-full h-full"
                    style={{ minHeight: '400px' }}
                />
            </div>
        </div>
    );
};

export default TradingChart;
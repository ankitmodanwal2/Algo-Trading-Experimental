// frontend/src/hooks/useRealtimeChart.js
import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';

/**
 * Custom hook to update chart with real-time ticks via WebSocket
 * @param {string} symbol - Instrument token to subscribe
 * @param {object} candleSeries - Lightweight Charts candlestick series reference
 * @param {string} timeframe - Current timeframe (1M, 5M, etc.)
 */
export const useRealtimeChart = (symbol, candleSeries, timeframe) => {
    const clientRef = useRef(null);
    const lastCandleRef = useRef(null);

    useEffect(() => {
        if (!symbol || !candleSeries) return;

        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws',
            reconnectDelay: 5000,
            onConnect: () => {
                console.log('[Chart] WebSocket Connected');

                // Subscribe to tick updates
                client.subscribe(`/topic/market/${symbol}`, (message) => {
                    const tick = JSON.parse(message.body);
                    updateCandle(tick);
                });
            },
            onDisconnect: () => console.log('[Chart] WebSocket Disconnected'),
        });

        const updateCandle = (tick) => {
            const price = parseFloat(tick.lastPrice);
            const timestamp = Math.floor(Date.now() / 1000);

            // Get candle interval in seconds
            const intervalSeconds = getIntervalSeconds(timeframe);
            const candleTime = Math.floor(timestamp / intervalSeconds) * intervalSeconds;

            if (!lastCandleRef.current || lastCandleRef.current.time !== candleTime) {
                // New candle - create it
                lastCandleRef.current = {
                    time: candleTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                };
                candleSeries.update(lastCandleRef.current);
            } else {
                // Update existing candle
                lastCandleRef.current.close = price;
                lastCandleRef.current.high = Math.max(lastCandleRef.current.high, price);
                lastCandleRef.current.low = Math.min(lastCandleRef.current.low, price);
                candleSeries.update(lastCandleRef.current);
            }
        };

        client.activate();
        clientRef.current = client;

        return () => {
            if (clientRef.current) {
                clientRef.current.deactivate();
            }
        };
    }, [symbol, candleSeries, timeframe]);
};

function getIntervalSeconds(timeframe) {
    const intervals = {
        '1M': 60,
        '5M': 300,
        '15M': 900,
        '1H': 3600,
        '1D': 86400,
    };
    return intervals[timeframe] || 300;
}
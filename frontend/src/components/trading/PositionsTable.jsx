import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { RefreshCw, AlertTriangle, Lock } from 'lucide-react';

const PositionsTable = () => {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPnl, setTotalPnl] = useState(0);
    const [activeBrokerId, setActiveBrokerId] = useState(null);
    const [authError, setAuthError] = useState(false); // New state to track auth failures

    // 🔒 Locks
    const isMounted = useRef(true);
    const isFetching = useRef(false);
    const pollInterval = useRef(null); // Ref to hold the interval ID

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    // 1. Fetch Broker ID
    useEffect(() => {
        const fetchBrokerId = async () => {
            try {
                const res = await api.get('/brokers/linked');
                if (isMounted.current && res.data && res.data.length > 0) {
                    // Use the most recently added broker
                    const newest = res.data[res.data.length - 1];
                    setActiveBrokerId(newest.id);
                }
            } catch (err) {
                console.error("Failed to fetch linked brokers", err);
            }
        };
        fetchBrokerId();
    }, []);

    // 2. Main Fetch Function
    const fetchPositions = async () => {
        // Stop if we already have an auth error
        if (authError || !activeBrokerId) return;

        const token = localStorage.getItem('authToken');
        if (!token) return;

        // Prevent overlapping requests
        if (isFetching.current) return;
        isFetching.current = true;

        // Only show spinner on empty table
        if (positions.length === 0) setLoading(true);

        try {
            const res = await api.get(`/brokers/${activeBrokerId}/positions`);

            if (isMounted.current && Array.isArray(res.data)) {
                setPositions(res.data);
                const total = res.data.reduce((sum, pos) => sum + (parseFloat(pos.pnl) || 0), 0);
                setTotalPnl(total);
                setError(null);
            }
        } catch (err) {
            if (!isMounted.current) return;

            // 🛑 CRITICAL: Stop polling on 401
            if (err.response?.status === 401) {
                console.error("🛑 401 Detected in Polling. Stopping interval.");
                setAuthError(true);
                if (pollInterval.current) clearInterval(pollInterval.current);
            } else {
                // For other errors, just log (don't break UI)
                console.warn("Position fetch warning:", err.message);
                // Only show UI error if table is empty
                if(positions.length === 0) setError("Trying to reconnect...");
            }
        } finally {
            isFetching.current = false;
            if (isMounted.current) setLoading(false);
        }
    };

    // 3. Polling Logic
    useEffect(() => {
        if (activeBrokerId && !authError) {
            fetchPositions(); // Initial fetch

            // Start polling
            pollInterval.current = setInterval(fetchPositions, 5000);
        }

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [activeBrokerId, authError]);

    // --- RENDER STATES ---

    if (authError) {
        return (
            <div className="bg-trade-panel border border-red-500/30 rounded-xl p-8 mt-8 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="p-3 bg-red-500/10 rounded-full mb-4">
                    <Lock size={32} className="text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Session Expired</h3>
                <p className="text-trade-muted mb-6 max-w-sm">
                    Your security token has expired or is invalid. Please log in again to view live positions.
                </p>
                <button
                    onClick={() => window.location.href = '/login'}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                    Log In Again
                </button>
            </div>
        );
    }

    if (error && positions.length === 0) {
        return (
            <div className="bg-trade-panel border border-trade-border rounded-xl p-6 mt-8 flex items-center gap-3 text-orange-400">
                <AlertTriangle size={20} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="bg-trade-panel border border-trade-border rounded-xl overflow-hidden mt-8 shadow-lg">
            <div className="px-6 py-4 border-b border-trade-border flex justify-between items-center bg-trade-panel/50">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-white">Open Positions</h3>
                    {loading && <RefreshCw size={16} className="text-trade-primary animate-spin" />}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-trade-muted">Net P&L:</span>
                    <span className={`font-mono font-bold text-lg ${totalPnl >= 0 ? 'text-trade-buy' : 'text-trade-sell'}`}>
                        {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-trade-bg/50 text-trade-muted border-b border-trade-border uppercase text-xs tracking-wider">
                    <tr>
                        <th className="px-6 py-3 font-medium">Instrument</th>
                        <th className="px-6 py-3 font-medium">Product</th>
                        <th className="px-6 py-3 font-medium">Net Qty</th>
                        <th className="px-6 py-3 font-medium">Avg. Price</th>
                        <th className="px-6 py-3 font-medium">LTP</th>
                        <th className="px-6 py-3 font-medium text-right">P&L</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-trade-border/50 text-white">
                    {positions.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="text-center py-12 text-trade-muted italic">
                                {loading ? "Syncing positions..." : "No open positions."}
                            </td>
                        </tr>
                    ) : (
                        positions.map((pos, index) => {
                            const pnl = parseFloat(pos.pnl) || 0;
                            const isProfit = pnl >= 0;
                            return (
                                <tr key={index} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-white group-hover:text-blue-200">{pos.symbol}</td>
                                    <td className="px-6 py-4 text-xs">
                                        <span className="bg-white/10 px-2 py-1 rounded text-trade-muted">{pos.productType}</span>
                                    </td>
                                    <td className={`px-6 py-4 font-bold ${pos.netQuantity > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                        {pos.netQuantity}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-trade-muted">₹{pos.avgPrice}</td>
                                    <td className="px-6 py-4 font-mono">₹{pos.ltp}</td>
                                    <td className={`px-6 py-4 font-mono font-bold text-right ${isProfit ? 'text-trade-buy' : 'text-trade-sell'}`}>
                                        {isProfit ? '+' : ''}{pnl.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PositionsTable;
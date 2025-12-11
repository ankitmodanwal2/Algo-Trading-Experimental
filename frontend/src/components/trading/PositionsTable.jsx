import React, { useEffect, useState, useRef } from 'react'; // Import useRef
import api from '../../lib/api';
import { RefreshCw, AlertCircle } from 'lucide-react';

const PositionsTable = () => {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPnl, setTotalPnl] = useState(0);
    const [activeBrokerId, setActiveBrokerId] = useState(null);

    // Track mounted state to prevent setting state on unmounted component
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const fetchBrokerId = async () => {
        try {
            const res = await api.get('/brokers/linked');
            if (isMounted.current && res.data && res.data.length > 0) {
                // Pick the most recently added broker
                const newest = res.data[res.data.length - 1];
                setActiveBrokerId(newest.id);
            }
        } catch (err) {
            console.error("Failed to fetch linked brokers", err);
        }
    };

    useEffect(() => {
        fetchBrokerId();
    }, []);

    const fetchPositions = async () => {
        // 1. Safety Check: Broker ID must exist
        if (!activeBrokerId) return;

        // 2. Safety Check: Token must exist
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn("Skipping position fetch: No Auth Token");
            return;
        }

        if (loading) return; // Prevent overlapping fetches

        // Only show loader on first load (to avoid flicker on poll)
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
            console.error("Failed to fetch positions:", err);
            // Don't show error on 401 (let global handler handle it), only others
            if (err.response?.status !== 401 && isMounted.current) {
                setError("Could not load positions.");
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    // Poll for positions
    useEffect(() => {
        let interval;
        if (activeBrokerId) {
            fetchPositions(); // Initial fetch
            interval = setInterval(fetchPositions, 5000); // Poll every 5s
        }
        return () => clearInterval(interval);
    }, [activeBrokerId]);

    if (error) {
        return (
            <div className="bg-trade-panel border border-trade-border rounded-xl p-6 mt-8 flex items-center gap-3 text-red-400">
                <AlertCircle size={20} />
                <span>{error}</span>
                <button
                    onClick={() => window.location.reload()}
                    className="ml-auto text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-white transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="bg-trade-panel border border-trade-border rounded-xl overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-trade-border flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-white">Open Positions</h3>
                    {loading && <RefreshCw size={16} className="text-trade-primary animate-spin" />}
                </div>

                <span className="text-sm text-trade-muted">
                  Total P&L:
                  <span className={`ml-2 font-bold text-lg ${totalPnl >= 0 ? 'text-trade-buy' : 'text-trade-sell'}`}>
                    {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
                  </span>
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-trade-bg text-trade-muted border-b border-trade-border">
                    <tr>
                        <th className="px-6 py-3 font-medium">Instrument</th>
                        <th className="px-6 py-3 font-medium">Product</th>
                        <th className="px-6 py-3 font-medium">Net Qty</th>
                        <th className="px-6 py-3 font-medium">Avg. Price</th>
                        <th className="px-6 py-3 font-medium">LTP</th>
                        <th className="px-6 py-3 font-medium">P&L</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-trade-border text-white">
                    {positions.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="text-center py-8 text-trade-muted">
                                {loading ? "Loading positions..." : "No open positions found."}
                            </td>
                        </tr>
                    ) : (
                        positions.map((pos, index) => {
                            const pnl = parseFloat(pos.pnl) || 0;
                            const isProfit = pnl >= 0;
                            return (
                                <tr key={index} className="hover:bg-trade-bg/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-white">{pos.symbol}</td>
                                    <td className="px-6 py-3 text-xs uppercase text-trade-muted">{pos.productType}</td>
                                    <td className={`px-6 py-3 font-bold ${pos.netQuantity > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                        {pos.netQuantity}
                                    </td>
                                    <td className="px-6 py-3">₹{pos.avgPrice}</td>
                                    <td className="px-6 py-3">₹{pos.ltp}</td>
                                    <td className={`px-6 py-3 font-bold ${isProfit ? 'text-trade-buy' : 'text-trade-sell'}`}>
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
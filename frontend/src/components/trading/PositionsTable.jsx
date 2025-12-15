import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PositionsTable = () => {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPnl, setTotalPnl] = useState(0);
    const [activeBrokerId, setActiveBrokerId] = useState(null);

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // 1. Fetch Broker ID
    const fetchBrokerId = async () => {
        try {
            const res = await api.get('/brokers/linked');
            // Handle ApiResponse wrapper
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);

            if (isMounted.current && data && data.length > 0) {
                const newest = data[data.length - 1];
                console.log("[Positions] Active Broker ID:", newest.id);
                setActiveBrokerId(newest.id);
            }
        } catch (err) {
            // silent fail
        }
    };

    useEffect(() => {
        fetchBrokerId();
    }, []);

    // 2. Fetch Positions
    const fetchPositions = async () => {
        if (!activeBrokerId) return;

        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            const res = await api.get(`/brokers/${activeBrokerId}/positions`, {
                headers: { Authorization: `Bearer ${token}` },
                silent: true
            });

            // Unwrap the ApiResponse (res.data.data)
            const payload = res.data.data || res.data;

            if (isMounted.current && Array.isArray(payload)) {
                setPositions(payload);
                const total = payload.reduce((sum, pos) => sum + (parseFloat(pos.pnl) || 0), 0);
                setTotalPnl(total);
                setError(null);
            } else {
                console.warn("[Positions] Expected array but got:", payload);
            }
        } catch (err) {
            if (err.response?.status !== 401 && isMounted.current) {
                // error handling
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    // 3. Poll for Updates
    useEffect(() => {
        let interval;
        if (activeBrokerId) {
            setLoading(true);
            fetchPositions();
            interval = setInterval(fetchPositions, 5000);
        }
        return () => clearInterval(interval);
    }, [activeBrokerId]);

    // 4. Close Position Logic
    const closePosition = async (pos) => {
            if (!activeBrokerId) return;

            // Confirmation
            if (!window.confirm(`Exit ${pos.symbol} (${pos.netQuantity} Qty)?`)) return;

            setLoading(true);
            try {
                const token = localStorage.getItem('authToken');

                // 🔥 FIX: Send complete payload with ALL required fields
                await api.post(`/brokers/${activeBrokerId}/positions/close`, {
                    securityId: pos.securityId,         // ✅ Security ID (numeric)
                    symbol: pos.symbol,                  // ✅ Trading Symbol (text)
                    exchange: pos.exchange,              // ✅ Exchange
                    productType: pos.productType,        // ✅ Product Type
                    quantity: Math.abs(pos.netQuantity), // ✅ Positive quantity
                    positionType: parseFloat(pos.netQuantity) > 0 ? "LONG" : "SHORT" // ✅ Direction
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

            toast.success(`Exit Order Placed for ${pos.symbol}`);
            fetchPositions(); // Refresh immediately
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to exit position');
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="bg-trade-panel border border-trade-border rounded-xl p-6 mt-8 flex items-center gap-3 text-red-400">
                <AlertCircle size={20} />
                <span>{error}</span>
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
                        <th className="px-6 py-3 font-medium">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-trade-border text-white">
                    {positions.length === 0 ? (
                        <tr>
                            <td colSpan="7" className="text-center py-8 text-trade-muted">
                                {loading ? "Loading positions..." : "No open positions."}
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
                                    <td className={`px-6 py-3 font-bold ${parseFloat(pos.netQuantity) > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                        {pos.netQuantity}
                                    </td>
                                    <td className="px-6 py-3">₹{parseFloat(pos.avgPrice).toFixed(2)}</td>
                                    <td className="px-6 py-3">₹{parseFloat(pos.ltp).toFixed(2)}</td>
                                    <td className={`px-6 py-3 font-bold ${isProfit ? 'text-trade-buy' : 'text-trade-sell'}`}>
                                        {isProfit ? '+' : ''}{pnl.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-3">
                                        <button
                                            onClick={() => closePosition(pos)}
                                            disabled={loading}
                                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs px-3 py-1.5 rounded border border-red-500/50 transition-colors disabled:opacity-50"
                                        >
                                            Exit
                                        </button>
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
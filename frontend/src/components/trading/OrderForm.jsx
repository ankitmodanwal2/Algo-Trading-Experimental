import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Search, X, RefreshCw, ChevronDown } from 'lucide-react';

const OrderForm = ({onSymbolSelect}) => {
    const { register, handleSubmit, setValue, watch, reset } = useForm({
        defaultValues: {
            productType: 'INTRADAY',
            orderType: 'MARKET',
            quantity: 1,
            price: 0
        }
    });

    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    // Broker Selection State
    const [brokers, setBrokers] = useState([]);
    const [activeBrokerId, setActiveBrokerId] = useState(null);

    // Dhan Specific Data
    const [selectedSecurityId, setSelectedSecurityId] = useState(null);
    const [selectedExchange, setSelectedExchange] = useState('NSE_EQ');

    const selectedOrderType = watch('orderType');
    const selectedSide = watch('side');

    // 1. Fetch ALL Brokers
    useEffect(() => {
        const fetchBrokers = async () => {
            try {
                const res = await api.get('/brokers/linked');
                const data = Array.isArray(res.data) ? res.data : (res.data.data || []);

                if (data && data.length > 0) {
                    setBrokers(data);
                    // Default to the first one, or the last used if you save it
                    setActiveBrokerId(data[data.length - 1].id);
                } else {
                    toast.error("No brokers linked!");
                }
            } catch (err) {
                console.error("Failed to fetch brokers");
            }
        };
        fetchBrokers();
    }, []);

    // Debounce Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2) {
                try {
                    const res = await api.get(`/marketdata/search?query=${searchTerm}`);
                    const data = res.data.data || res.data;
                    setResults(Array.isArray(data) ? data : []);
                    setShowResults(true);
                } catch (error) {
                    console.error("Search failed", error);
                }
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

      const handleSelectSymbol = (item) => {
          console.log("Selected item:", item); // 🌟 DEBUG LOG

          setSearchTerm(item.tradingSymbol);
          setSelectedSecurityId(item.securityId);

          let exch = item.exchangeSegment;
          if (exch === 'NSE') exch = 'NSE_EQ';
          if (exch === 'BSE') exch = 'BSE_EQ';
          setSelectedExchange(exch);

          setShowResults(false);

          // 🌟 CRITICAL: Notify Dashboard about symbol selection
          if (onSymbolSelect) {
              const symbolData = {
                  securityId: item.securityId,
                  tradingSymbol: item.tradingSymbol,
                  exchangeSegment: item.exchangeSegment,
                  name: item.name
              };
              console.log("Sending to Dashboard:", symbolData); // 🌟 DEBUG LOG
              onSymbolSelect(symbolData);
          } else {
              console.warn("⚠️ onSymbolSelect prop is missing!"); // 🌟 DEBUG LOG
          }
      };

    const toggleOrderType = () => {
        const newType = selectedOrderType === 'MARKET' ? 'LIMIT' : 'MARKET';
        setValue('orderType', newType);
        if (newType === 'MARKET') setValue('price', 0);
    };

    const onSubmit = async (data) => {
        if (!activeBrokerId) {
            toast.error("Please select a broker first.");
            return;
        }
        if (!selectedSecurityId) {
            toast.error("Please select a stock from the search list.");
            return;
        }

        setLoading(true);
        try {
            await api.post('/orders/place', {
                ...data,
                brokerAccountId: activeBrokerId,
                symbol: selectedSecurityId,
                price: data.orderType === 'MARKET' ? 0 : Number(data.price),
                meta: {
                    exchange: selectedExchange,
                    tradingSymbol: searchTerm
                }
            });

            toast.success('Order Placed Successfully');
            reset({
                productType: data.productType,
                orderType: 'MARKET',
                quantity: 1,
                price: 0
            });
            setSearchTerm('');
            setSelectedSecurityId(null);

        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to place order';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-trade-panel border border-trade-border rounded-xl p-6 relative shadow-lg">

            {/* Header + Broker Selector */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white">Place Order</h3>
                    <div className="mt-2 relative">
                        {brokers.length > 0 ? (
                            <select
                                value={activeBrokerId || ''}
                                onChange={(e) => setActiveBrokerId(e.target.value)}
                                className="appearance-none bg-trade-bg border border-trade-border text-xs text-trade-muted px-3 py-1.5 rounded pr-8 focus:border-trade-primary outline-none cursor-pointer hover:text-white transition-colors"
                            >
                                {brokers.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.brokerId.toUpperCase()} ({b.id})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-xs text-red-400">No Brokers</span>
                        )}
                        <ChevronDown size={12} className="absolute right-2 top-2 text-trade-muted pointer-events-none" />
                    </div>
                </div>

                <div className={`px-2 py-1 rounded text-xs font-bold ${selectedSide === 'BUY' ? 'bg-trade-buy/20 text-trade-buy' : 'bg-trade-sell/20 text-trade-sell'}`}>
                    {selectedSide || 'BUY'}
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Search Input */}
                <div className="relative z-20">
                    <label className="block text-xs font-medium text-trade-muted mb-1 uppercase tracking-wider">Symbol</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setSelectedSecurityId(null);
                            }}
                            className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 pl-10 text-white focus:outline-none focus:border-trade-primary transition-colors font-medium"
                            placeholder="Search (e.g. RELIANCE)"
                            autoComplete="off"
                        />
                        <Search className="absolute left-3 top-3.5 text-trade-muted" size={18} />

                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setResults([]); setSelectedSecurityId(null); }}
                                className="absolute right-3 top-3.5 text-trade-muted hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && results.length > 0 && (
                        <div className="absolute w-full mt-1 bg-trade-panel border border-trade-border rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                            {results.map((item) => (
                                <div
                                    key={item.securityId}
                                    onClick={() => handleSelectSymbol(item)}
                                    className="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-trade-border/50 last:border-0 transition-colors"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-white">{item.tradingSymbol}</span>
                                        <span className="text-[10px] uppercase font-bold text-trade-muted bg-white/5 px-1.5 py-0.5 rounded">{item.exchangeSegment}</span>
                                    </div>
                                    <div className="text-xs text-trade-muted mt-0.5 truncate">{item.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    <input type="hidden" {...register('symbol')} value={selectedSecurityId || ''} />
                </div>

                {/* Product Type */}
                <div>
                    <label className="block text-xs font-medium text-trade-muted mb-2 uppercase tracking-wider">Product</label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="cursor-pointer relative">
                            <input type="radio" value="INTRADAY" {...register('productType')} className="peer sr-only" />
                            <div className="text-center py-2.5 rounded-lg border border-trade-border bg-trade-bg text-trade-muted font-medium text-sm transition-all hover:bg-trade-border/50 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-500">
                                Intraday
                            </div>
                        </label>
                        <label className="cursor-pointer relative">
                            <input type="radio" value="CNC" {...register('productType')} className="peer sr-only" />
                            <div className="text-center py-2.5 rounded-lg border border-trade-border bg-trade-bg text-trade-muted font-medium text-sm transition-all hover:bg-trade-border/50 peer-checked:bg-purple-600 peer-checked:text-white peer-checked:border-purple-500">
                                Longterm
                            </div>
                        </label>
                    </div>
                </div>

                {/* Qty & Price */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-trade-muted mb-1 uppercase tracking-wider">Qty</label>
                        <input type="number" {...register('quantity')} className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white font-mono focus:border-trade-primary outline-none" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-medium text-trade-muted uppercase tracking-wider">
                                {selectedOrderType === 'MARKET' ? 'Market Price' : 'Price'}
                            </label>
                        </div>
                        <div className={`relative flex items-center w-full rounded-lg border transition-all ${selectedOrderType === 'MARKET' ? 'bg-trade-bg/50 border-trade-border cursor-not-allowed' : 'bg-trade-bg border-trade-border focus-within:border-trade-primary'}`}>
                            <input type="number" step="0.05" {...register('price')} disabled={selectedOrderType === 'MARKET'} className="w-full bg-transparent p-3 text-white font-mono outline-none disabled:cursor-not-allowed disabled:text-trade-muted" placeholder="0.00"/>
                            <button type="button" onClick={toggleOrderType} className="absolute right-1 top-1 bottom-1 px-3 rounded text-[10px] font-bold uppercase bg-trade-primary text-white hover:bg-blue-600">
                                {selectedOrderType === 'MARKET' ? 'MKT' : 'LMT'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Buy/Sell Switch */}
                <div className="pt-2">
                    <div className="grid grid-cols-2 gap-0 bg-trade-bg rounded-lg p-1 border border-trade-border">
                        <label className="cursor-pointer">
                            <input type="radio" value="BUY" {...register('side')} className="peer sr-only" defaultChecked />
                            <div className="text-center py-2.5 rounded-md font-bold text-sm transition-all peer-checked:bg-trade-buy peer-checked:text-white peer-checked:shadow-md text-trade-muted hover:text-white">BUY</div>
                        </label>
                        <label className="cursor-pointer">
                            <input type="radio" value="SELL" {...register('side')} className="peer sr-only" />
                            <div className="text-center py-2.5 rounded-md font-bold text-sm transition-all peer-checked:bg-trade-sell peer-checked:text-white peer-checked:shadow-md text-trade-muted hover:text-white">SELL</div>
                        </label>
                    </div>
                </div>

                <button type="submit" disabled={loading || !activeBrokerId} className={`w-full font-bold py-3.5 rounded-lg transition-all flex justify-center items-center gap-2 mt-2 text-white ${selectedSide === 'BUY' || !selectedSide ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'} disabled:opacity-50`}>
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : `EXECUTE ${selectedSide || 'BUY'}`}
                </button>
            </form>
        </div>
    );
};

export default OrderForm;
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Search, X, RefreshCw } from 'lucide-react';

const OrderForm = () => {
    // 1. Initialize form with 'MARKET' as default
    const { register, handleSubmit, setValue, watch, reset } = useForm({
        defaultValues: {
            productType: 'INTRADAY',
            orderType: 'MARKET',
            quantity: 1,
            price: 0
        }
    });

    const [loading, setLoading] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    // Track selected exchange to pass to backend
    const [selectedExchange, setSelectedExchange] = useState('NSE_EQ');

    // Watch fields for UI logic
    const selectedOrderType = watch('orderType');
    const selectedSide = watch('side');

    // Debounce Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2) {
                try {
                    const res = await api.get(`/marketdata/search?query=${searchTerm}`);
                    setResults(res.data);
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
        setValue('symbol', item.securityId);
        setSearchTerm(item.tradingSymbol);

        // Capture Exchange from search result
        const exch = item.exchangeSegment === 'NSE' ? 'NSE_EQ' : item.exchangeSegment;
        setSelectedExchange(exch);

        setShowResults(false);
    };

    // Toggle logic for the Button inside Price tab
    const toggleOrderType = () => {
        const newType = selectedOrderType === 'MARKET' ? 'LIMIT' : 'MARKET';
        setValue('orderType', newType);
        if (newType === 'MARKET') {
            setValue('price', 0);
        }
    };

    const onSubmit = async (data) => {
        const finalSymbol = data.symbol || searchTerm;

        if (!finalSymbol || finalSymbol.trim() === '') {
            toast.error('Please select a stock symbol first!');
            return;
        }

        setLoading(true);
        try {
            await api.post('/orders/place', {
                ...data,
                brokerAccountId: 1, // Ideally dynamic
                symbol: finalSymbol,
                price: data.orderType === 'MARKET' ? 0 : Number(data.price),
                // Send extra meta data
                meta: {
                    exchange: selectedExchange,
                    productType: data.productType
                }
            });
            toast.success('Order Placed Successfully');
            reset({
                productType: data.productType, // Keep last used product type
                orderType: 'MARKET',           // Reset to Market
                quantity: data.quantity,       // Keep last qty
                price: 0
            });
            setSearchTerm('');
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to place order';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-trade-panel border border-trade-border rounded-xl p-6 relative shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Place Order</h3>
                <div className={`px-2 py-1 rounded text-xs font-bold ${selectedSide === 'BUY' ? 'bg-trade-buy/20 text-trade-buy' : 'bg-trade-sell/20 text-trade-sell'}`}>
                    {selectedSide || 'BUY'}
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* --- 1. Searchable Symbol Input --- */}
                <div className="relative z-20">
                    <label className="block text-xs font-medium text-trade-muted mb-1 uppercase tracking-wider">Symbol</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setValue('symbol', e.target.value);
                            }}
                            className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 pl-10 text-white focus:outline-none focus:border-trade-primary transition-colors font-medium"
                            placeholder="Search (e.g. RELIANCE)"
                            autoComplete="off"
                        />
                        <Search className="absolute left-3 top-3.5 text-trade-muted" size={18} />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setResults([]); }}
                                className="absolute right-3 top-3.5 text-trade-muted hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {/* Dropdown Results */}
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
                    <input type="hidden" {...register('symbol', { required: true })} />
                </div>

                {/* --- 2. Product Type Selection (Intraday vs Longterm) --- */}
                <div>
                    <label className="block text-xs font-medium text-trade-muted mb-2 uppercase tracking-wider">Product</label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="cursor-pointer relative">
                            <input type="radio" value="INTRADAY" {...register('productType')} className="peer sr-only" />
                            <div className="text-center py-2.5 rounded-lg border border-trade-border bg-trade-bg text-trade-muted font-medium text-sm transition-all hover:bg-trade-border/50 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-500 peer-checked:shadow-lg peer-checked:shadow-blue-900/20">
                                Intraday
                            </div>
                        </label>
                        <label className="cursor-pointer relative">
                            <input type="radio" value="CNC" {...register('productType')} className="peer sr-only" />
                            <div className="text-center py-2.5 rounded-lg border border-trade-border bg-trade-bg text-trade-muted font-medium text-sm transition-all hover:bg-trade-border/50 peer-checked:bg-purple-600 peer-checked:text-white peer-checked:border-purple-500 peer-checked:shadow-lg peer-checked:shadow-purple-900/20">
                                Longterm
                            </div>
                        </label>
                    </div>
                </div>

                {/* --- 3. Quantity & Price (Unified) --- */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Quantity */}
                    <div>
                        <label className="block text-xs font-medium text-trade-muted mb-1 uppercase tracking-wider">Qty</label>
                        <input
                            type="number"
                            {...register('quantity')}
                            className="w-full bg-trade-bg border border-trade-border rounded-lg p-3 text-white font-mono focus:border-trade-primary outline-none"
                        />
                    </div>

                    {/* Price with Embedded Toggle */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            {/* Dynamic Label */}
                            <label className="block text-xs font-medium text-trade-muted uppercase tracking-wider">
                                {selectedOrderType === 'MARKET' ? 'Market Price' : 'Price'}
                            </label>
                        </div>

                        <div className={`relative flex items-center w-full rounded-lg border transition-all ${selectedOrderType === 'MARKET' ? 'bg-trade-bg/50 border-trade-border cursor-not-allowed' : 'bg-trade-bg border-trade-border focus-within:border-trade-primary'}`}>

                            {/* The Price Input */}
                            <input
                                type="number"
                                step="0.05"
                                {...register('price')}
                                disabled={selectedOrderType === 'MARKET'}
                                className="w-full bg-transparent p-3 text-white font-mono outline-none disabled:cursor-not-allowed disabled:text-trade-muted"
                                placeholder={selectedOrderType === 'MARKET' ? "0.00" : "0.00"}
                            />

                            {/* The Switch Button inside the tab */}
                            <button
                                type="button"
                                onClick={toggleOrderType}
                                className={`absolute right-1 top-1 bottom-1 px-3 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                                    selectedOrderType === 'MARKET'
                                        ? 'bg-trade-primary text-white hover:bg-blue-600'
                                        : 'bg-trade-border text-trade-muted hover:text-white hover:bg-white/10'
                                }`}
                                title="Click to switch Order Type"
                            >
                                {selectedOrderType === 'MARKET' ? 'MKT' : 'LMT'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- 4. Buy/Sell Action Buttons (Tabs Style) --- */}
                <div className="pt-2">
                    <div className="grid grid-cols-2 gap-0 bg-trade-bg rounded-lg p-1 border border-trade-border">
                        <label className="cursor-pointer">
                            <input type="radio" value="BUY" {...register('side')} className="peer sr-only" defaultChecked />
                            <div className="text-center py-2.5 rounded-md font-bold text-sm transition-all peer-checked:bg-trade-buy peer-checked:text-white peer-checked:shadow-md text-trade-muted hover:text-white">
                                BUY
                            </div>
                        </label>
                        <label className="cursor-pointer">
                            <input type="radio" value="SELL" {...register('side')} className="peer sr-only" />
                            <div className="text-center py-2.5 rounded-md font-bold text-sm transition-all peer-checked:bg-trade-sell peer-checked:text-white peer-checked:shadow-md text-trade-muted hover:text-white">
                                SELL
                            </div>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full font-bold py-3.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg flex justify-center items-center gap-2 mt-2 ${
                        selectedSide === 'BUY' || !selectedSide
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-emerald-900/20'
                            : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-red-900/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                >
                    {loading ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" />
                            Processing...
                        </>
                    ) : (
                        `EXECUTE ${selectedSide || 'BUY'}`
                    )}
                </button>
            </form>
        </div>
    );
};

export default OrderForm;
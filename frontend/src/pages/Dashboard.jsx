import React, { useState } from 'react';
import MarketDataTicker from '../components/trading/MarketDataTicker';
import OrderForm from '../components/trading/OrderForm';
import PositionsTable from '../components/trading/PositionsTable';
import TradingChart from '../components/chart/TradingChart';

const Dashboard = () => {
    // State to sync selected symbol between OrderForm and Chart
    const [selectedSymbol, setSelectedSymbol] = useState(null);

    const handleSymbolSelect = (symbolData) => {
        console.log("📊 Dashboard received symbol:", symbolData); // 🌟 DEBUG
        setSelectedSymbol({
            securityId: symbolData.securityId,
            tradingSymbol: symbolData.tradingSymbol,
        });
        console.log("✅ State updated:", {
            securityId: symbolData.securityId,
            tradingSymbol: symbolData.tradingSymbol
        }); // 🌟 DEBUG
    };

    return (
        <div>
            {/* Market Ticker */}
            <MarketDataTicker />

            {/* Main Trading Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Left Column: Order Form */}
                <div className="lg:col-span-1">
                    <OrderForm onSymbolSelect={handleSymbolSelect} />
                </div>

                {/* Right Column: Chart */}
                <div className="lg:col-span-2">
                    <TradingChart
                        symbol={selectedSymbol?.securityId}
                        tradingSymbol={selectedSymbol?.tradingSymbol}
                    />
                </div>
            </div>

            {/* Bottom Row: Positions */}
            <PositionsTable />
        </div>
    );
};

export default Dashboard;
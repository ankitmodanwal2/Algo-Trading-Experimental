package com.myorg.trading.broker.api;

public enum BrokerCapability {
    PLACE_ORDER,
    CANCEL_ORDER,
    MODIFY_ORDER,
    OCO,
    MARGIN_TRADING,
    INSTRUMENT_SEARCH,
    ORDER_BOOK,
    MARKET_DATA_STREAM,
    HISTORICAL_DATA,
    GET_POSITIONS
}

package com.myorg.trading.controller.dto;

import com.myorg.trading.broker.api.OrderSide;
import com.myorg.trading.broker.api.OrderType;
import lombok.Data;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Map;

@Data
public class PlaceOrderRequest {
    @NotNull
    private Long brokerAccountId;

    @NotNull
    private String symbol; // Security ID (e.g., "3499")

    @NotNull
    private OrderSide side;

    @NotNull
    private BigDecimal quantity;

    private BigDecimal price;

    @NotNull
    private OrderType orderType;

    private String productType; // INTRADAY, CNC, etc.

    // 🔥 NEW: Accept meta from frontend
    private Map<String, Object> meta; // Contains tradingSymbol, exchange, etc.
}
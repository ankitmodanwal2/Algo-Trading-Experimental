package com.myorg.trading.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Open-High-Low-Close-Volume candlestick data model.
 * Used for chart historical data.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OHLCV {
    private Instant timestamp;  // Candle start time
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal close;
    private Long volume;

    // For frontend consumption (epoch milliseconds)
    public Long getTime() {
        return timestamp != null ? timestamp.toEpochMilli() : null;
    }
}
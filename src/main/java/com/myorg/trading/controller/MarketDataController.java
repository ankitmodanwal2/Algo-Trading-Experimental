package com.myorg.trading.controller;

import com.myorg.trading.broker.api.BrokerClient;
import com.myorg.trading.broker.api.MarketDataTick;
import com.myorg.trading.broker.registry.BrokerRegistry;
import com.myorg.trading.domain.entity.BrokerAccount;
import com.myorg.trading.domain.model.OHLCV;
import com.myorg.trading.domain.model.SecurityMaster;
import com.myorg.trading.service.broker.BrokerAccountService;
import com.myorg.trading.service.marketdata.MarketDataService;
import com.myorg.trading.service.marketdata.SecurityMasterService;
import com.myorg.trading.service.user.UserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/marketdata")
public class MarketDataController {

    private final MarketDataService marketDataService;
    private final SecurityMasterService securityMasterService;
    private final BrokerRegistry brokerRegistry;
    private final BrokerAccountService brokerAccountService;
    private final UserService userService;

    public MarketDataController(
            MarketDataService marketDataService,
            SecurityMasterService securityMasterService,
            BrokerRegistry brokerRegistry,
            BrokerAccountService brokerAccountService,
            UserService userService) {
        this.marketDataService = marketDataService;
        this.securityMasterService = securityMasterService;
        this.brokerRegistry = brokerRegistry;
        this.brokerAccountService = brokerAccountService;
        this.userService = userService;
    }

    /**
     * Search symbols for autocomplete
     */
    @GetMapping("/search")
    public ResponseEntity<List<SecurityMaster>> searchSymbols(@RequestParam String query) {
        return ResponseEntity.ok(securityMasterService.search(query));
    }

    /**
     * Real-time tick stream (Server-Sent Events)
     */
    @GetMapping(value = "/stream/{instrumentToken}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<MarketDataTick> stream(@PathVariable String instrumentToken) {
        return marketDataService.streamFor(instrumentToken);
    }

    /**
     * Fetch historical candlestick data for charting
     *
     * @param symbol Security ID (e.g., "3045" for Reliance)
     * @param interval Candle interval (1M, 5M, 15M, 1H, 1D)
     * @param from Start timestamp (epoch seconds or ISO-8601)
     * @param to End timestamp (epoch seconds or ISO-8601)
     */
    @GetMapping("/history/{symbol}")
    public ResponseEntity<List<OHLCV>> getHistory(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable String symbol,
            @RequestParam(defaultValue = "5M") String interval,
            @RequestParam String from,
            @RequestParam String to) {

        Long userId = userService.getUserIdForUsername(user.getUsername());

        // Get user's first linked broker account
        List<BrokerAccount> accounts = brokerAccountService.listAccountsForUser(userId);
        if (accounts.isEmpty()) {
            throw new IllegalArgumentException("No broker account linked");
        }

        BrokerAccount account = accounts.get(0); // Use first account
        BrokerClient client = brokerRegistry.getById(account.getBrokerId());

        // Parse timestamps (support both epoch seconds and ISO-8601)
        Instant fromInstant = parseTimestamp(from);
        Instant toInstant = parseTimestamp(to);

        // Fetch and block (synchronous response for chart data)
        List<OHLCV> candles = client.getHistoricalData(
                account.getId().toString(),
                symbol,
                interval,
                fromInstant,
                toInstant
        ).block();

        return ResponseEntity.ok(candles != null ? candles : List.of());
    }

    private Instant parseTimestamp(String timestamp) {
        try {
            // Try parsing as epoch seconds
            long epochSeconds = Long.parseLong(timestamp);
            return Instant.ofEpochSecond(epochSeconds);
        } catch (NumberFormatException e) {
            // Fall back to ISO-8601
            return Instant.parse(timestamp);
        }
    }
}
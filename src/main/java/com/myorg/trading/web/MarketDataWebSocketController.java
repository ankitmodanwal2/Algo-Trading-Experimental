package com.myorg.trading.web;

import com.myorg.trading.broker.api.MarketDataTick;
import com.myorg.trading.service.marketdata.MarketDataService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Controller that pushes market ticks to subscribed clients.
 * Adapters should push ticks into MarketDataService; this controller can broadcast them.
 */
@Controller
public class MarketDataWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MarketDataService marketDataService;

    public MarketDataWebSocketController(SimpMessagingTemplate messagingTemplate, MarketDataService marketDataService) {
        this.messagingTemplate = messagingTemplate;
        this.marketDataService = marketDataService;
    }

    /**
     * Example: client subscribes to /topic/market/RELIANCE
     * When adapter pushes a tick via MarketDataService.pushTick(...),
     * you can forward to topic here or the adapter can publish directly to SimpMessagingTemplate.
     *
     * If you want server to echo client messages:
     */
    @MessageMapping("/ping")
    public void ping(String msg) {
        // echo or test endpoint
    }

    // Helper method adapters can call to broadcast a tick:
    public void broadcastTick(String instrumentToken, MarketDataTick tick) {
        messagingTemplate.convertAndSend("/topic/market/" + instrumentToken, tick);
    }
}

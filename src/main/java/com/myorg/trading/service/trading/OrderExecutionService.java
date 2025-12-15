package com.myorg.trading.service.trading;

import com.myorg.trading.broker.api.*;
import com.myorg.trading.broker.registry.BrokerRegistry;
import com.myorg.trading.domain.entity.BrokerAccount;
import com.myorg.trading.domain.entity.Order;
import com.myorg.trading.domain.entity.OrderStatus;
import com.myorg.trading.domain.repository.BrokerAccountRepository;
import com.myorg.trading.domain.repository.OrderRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class OrderExecutionService {

    private final OrderRepository orderRepository;
    private final BrokerRegistry brokerRegistry;
    private final BrokerAccountRepository brokerAccountRepository;

    public OrderExecutionService(OrderRepository orderRepository,
                                 BrokerRegistry brokerRegistry,
                                 BrokerAccountRepository brokerAccountRepository) {
        this.orderRepository = orderRepository;
        this.brokerRegistry = brokerRegistry;
        this.brokerAccountRepository = brokerAccountRepository;
    }

    @Transactional
    public void executeOrder(Long orderId, String tradingSymbol, Map<String, Object> meta) {
        Order order = orderRepository.findById(orderId).orElseThrow();

        // 🌟 CRITICAL: Log what we received
        log.info("📦 Executing Order {} with tradingSymbol: {} and meta: {}", orderId, tradingSymbol, meta);

        if (tradingSymbol == null || tradingSymbol.isBlank()) {
            log.warn("⚠️ Order {} has only numeric symbol {}, missing trading symbol", orderId, order.getSymbol());
            tradingSymbol = order.getSymbol() + "-EQ"; // Emergency fallback
        }

        BrokerAccount brokerAccount = brokerAccountRepository.findById(order.getBrokerAccountId()).orElseThrow();
        String accountId = brokerAccount.getId().toString();
        BrokerClient client = brokerRegistry.getById(brokerAccount.getBrokerId());

        String productType = order.getProductType() != null ? order.getProductType() : "INTRADAY";
        String exchange = meta != null ? (String) meta.getOrDefault("exchange", "NSE_EQ") : "NSE_EQ";

        // 🔥 FIX: Build meta map with BOTH tradingSymbol AND exchange
        Map<String, Object> metaMap = new HashMap<>();
        metaMap.put("productType", productType);
        metaMap.put("exchange", exchange);
        metaMap.put("tradingSymbol", tradingSymbol); // ✅ CRITICAL ADDITION

        log.info("✅ Final Order Payload: symbol={}, tradingSymbol={}, exchange={}, productType={}",
                order.getSymbol(), tradingSymbol, exchange, productType);

        BrokerOrderRequest brokerReq = BrokerOrderRequest.builder()
                .clientOrderId("client-" + order.getId())
                .symbol(order.getSymbol()) // Security ID (numeric)
                .side(OrderSide.valueOf(order.getSide()))
                .quantity(order.getQuantity())
                .price(order.getPrice())
                .orderType(OrderType.valueOf(order.getOrderType()))
                .timeInForce(TimeInForce.GTC)
                .meta(metaMap)
                .build();

        try {
            Mono<BrokerOrderResponse> respMono = client.placeOrder(accountId, brokerReq);
            BrokerOrderResponse resp = respMono.onErrorResume(e -> {
                return Mono.just(new BrokerOrderResponse(null, "REJECTED", e.getMessage(), null));
            }).block();

            if (resp != null && resp.getOrderId() != null) {
                order.setBrokerOrderId(resp.getOrderId());
                order.setStatus(OrderStatus.PLACED);
                order.setExecutedAt(Instant.now());
                log.info("✅ Order {} executed successfully. Broker Order ID: {}", orderId, resp.getOrderId());
            } else {
                order.setStatus(OrderStatus.FAILED);
                log.error("❌ Order {} failed: {}", orderId, resp != null ? resp.getMessage() : "Unknown error");
            }
            orderRepository.save(order);
        } catch (Exception e) {
            order.setStatus(OrderStatus.FAILED);
            orderRepository.save(order);
            log.error("❌ Order {} execution crashed", orderId, e);
            throw e;
        }
    }

    public void executeOrderAsync(Long orderId, String tradingSymbol, Map<String, Object> meta) {
        CompletableFuture.runAsync(() -> executeOrder(orderId, tradingSymbol, meta));
    }
}
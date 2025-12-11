package com.myorg.trading.service.trading;

import com.myorg.trading.broker.api.*;
import com.myorg.trading.broker.registry.BrokerRegistry;
import com.myorg.trading.domain.entity.BrokerAccount;
import com.myorg.trading.domain.entity.Order;
import com.myorg.trading.domain.entity.OrderStatus;
import com.myorg.trading.domain.repository.BrokerAccountRepository;
import com.myorg.trading.domain.repository.OrderRepository;
import com.myorg.trading.service.broker.BrokerAccountService;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Core executor: maps Order -> BrokerOrderRequest, calls BrokerClient, updates Order entity.
 */
@Service
public class OrderExecutionService {

    private final OrderRepository orderRepository;
    private final BrokerRegistry brokerRegistry;
    private final BrokerAccountRepository brokerAccountRepository;
    private final BrokerAccountService brokerAccountService;

    public OrderExecutionService(OrderRepository orderRepository,
                                 BrokerRegistry brokerRegistry,
                                 BrokerAccountRepository brokerAccountRepository,
                                 BrokerAccountService brokerAccountService) {
        this.orderRepository = orderRepository;
        this.brokerRegistry = brokerRegistry;
        this.brokerAccountRepository = brokerAccountRepository;
        this.brokerAccountService = brokerAccountService;
    }

    /**
     * Synchronous (blocking) execution — used by Quartz Job.
     */
    @Transactional
    public void executeOrder(Long orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        // ... (existing code finding account) ...
        BrokerAccount brokerAccount = brokerAccountRepository.findById(order.getBrokerAccountId()).orElseThrow();
        String accountId = brokerAccount.getId().toString();
        BrokerClient client = brokerRegistry.getById(brokerAccount.getBrokerId());

        // --- FIX: Extract Product Type from where we stored it (or default to INTRADAY) ---
        // Note: For now, we assume the Controller passed it.
        // Ideally, 'Order' entity should also save 'productType', but for now let's hardcode a default
        // or pass it via a transient field if you modified Order entity.

        // Since we didn't add 'productType' to Order Entity yet, we will default to "INTRADAY"
        // OR we can misuse 'clientOrderId' or similar if we don't want DB migration right now.
        // BETTER: Let's assume you will add it to Order entity later.
        // For THIS step, I will map it to "INTRADAY" if null to prevent crashes.

        //String productType = "INTRADAY";
        //String pType = order.getProductType() != null ? order.getProductType() : "INTRADAY";

        // ... inside executeOrder ...
        String productType = order.getProductType() != null ? order.getProductType() : "INTRADAY";

        // 🌟 FIX: Determine Exchange based on Symbol or saved Meta (if you had it)
        // For now, we will guess NSE_EQ unless the symbol looks like an option/future.
        // Ideally, store 'exchange' in Order entity.
        // Hack: Frontend sends exchange in 'symbol' field temporarily? No, that breaks securityId.
        // Let's default to NSE_EQ for now, but if you add 'exchange' column to Order later, map it here.
        String exchange = "NSE_EQ";

        // Map containing both productType and exchange
        Map<String, Object> metaMap = new HashMap<>();
        metaMap.put("productType", productType);
        metaMap.put("exchange", exchange);

        BrokerOrderRequest brokerReq = BrokerOrderRequest.builder()
                .clientOrderId("client-" + order.getId())
                .symbol(order.getSymbol())
                .side(OrderSide.valueOf(order.getSide()))
                .quantity(order.getQuantity())
                .price(order.getPrice())
                .orderType(OrderType.valueOf(order.getOrderType()))
                .timeInForce(TimeInForce.GTC)
                .meta(metaMap) // <--- Pass the map
                .build();

        try {
            Mono<BrokerOrderResponse> respMono = client.placeOrder(accountId, brokerReq);
            BrokerOrderResponse resp = respMono.onErrorResume(e -> {
                // convert to failed response
                return Mono.just(new BrokerOrderResponse(null, "REJECTED", e.getMessage(), null));
            }).block();

            if (resp != null && resp.getOrderId() != null) {
                order.setBrokerOrderId(resp.getOrderId());
                order.setStatus(OrderStatus.PLACED);
                order.setExecutedAt(Instant.now());
            } else {
                order.setStatus(OrderStatus.FAILED);
            }
            orderRepository.save(order);
        } catch (Exception e) {
            order.setStatus(OrderStatus.FAILED);
            orderRepository.save(order);
            throw e;
        }
    }

    /**
     * Async execution for API usage — delegates to thread pool.
     */
    public void executeOrderAsync(Long orderId) {
        CompletableFuture.runAsync(() -> executeOrder(orderId));
    }
}

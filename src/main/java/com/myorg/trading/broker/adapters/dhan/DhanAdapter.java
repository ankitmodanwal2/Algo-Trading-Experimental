package com.myorg.trading.broker.adapters.dhan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myorg.trading.broker.api.*;
import com.myorg.trading.broker.model.DhanCredentials;
import com.myorg.trading.config.properties.DhanProperties;
import com.myorg.trading.service.broker.BrokerAccountService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component("dhan")
public class DhanAdapter implements BrokerClient {

    private final WebClient webClient;
    private final DhanProperties props;
    private final BrokerAccountService brokerAccountService;
    private final ObjectMapper objectMapper;

    public DhanAdapter(WebClient.Builder webClientBuilder,
                       DhanProperties props,
                       BrokerAccountService brokerAccountService,
                       ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl(props.getBaseUrl()).build();
        this.props = props;
        this.brokerAccountService = brokerAccountService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getBrokerId() { return "dhan"; }

    @Override
    public Set<BrokerCapability> capabilities() {
        return Set.of(BrokerCapability.PLACE_ORDER, BrokerCapability.CANCEL_ORDER);
    }

    private Mono<DhanCredentials> getCredentials(String accountId) {
        return Mono.fromCallable(() -> brokerAccountService.readDecryptedCredentials(Long.valueOf(accountId)))
                .flatMap(opt -> opt.map(Mono::just).orElse(Mono.error(new IllegalArgumentException("No credentials found for account: " + accountId))))
                .map(json -> {
                    try {
                        return objectMapper.readValue(json, DhanCredentials.class);
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to parse Dhan credentials", e);
                    }
                });
    }

    @Override
    public Mono<Boolean> validateCredentials(String rawCredentialsJson) {
        return Mono.just(rawCredentialsJson)
                .flatMap(json -> {
                    try {
                        DhanCredentials creds = objectMapper.readValue(json, DhanCredentials.class);
                        String accessToken = creds.getAccessToken().trim();

                        return webClient.get()
                                .uri("/v2/positions")
                                .header("access-token", accessToken)
                                .header("Content-Type", "application/json")
                                .retrieve()
                                .toBodilessEntity()
                                .map(resp -> resp.getStatusCode().is2xxSuccessful())
                                .onErrorResume(e -> {
                                    if (e instanceof WebClientResponseException wcre) {
                                        String errorBody = wcre.getResponseBodyAsString();
                                        log.error("Dhan Validation Failed: Status: {}, Body: {}", wcre.getStatusCode(), errorBody);
                                        return Mono.error(new RuntimeException("Dhan Error: " + errorBody));
                                    }
                                    return Mono.error(new RuntimeException("Connection Error: " + e.getMessage()));
                                });
                    } catch (Exception e) {
                        return Mono.error(new RuntimeException("Internal Validation Error: " + e.getMessage()));
                    }
                });
    }

    @Override
    public Mono<BrokerOrderResponse> placeOrder(String accountId, BrokerOrderRequest req) {
        return getCredentials(accountId)
                .flatMap(creds -> webClient.post()
                        .uri("/v2/orders")
                        .header("access-token", creds.getAccessToken().trim())
                        .header("Content-Type", "application/json")
                        .bodyValue(mapToDhanPayload(req, creds.getClientId()))
                        .retrieve()
                        .bodyToMono(JsonNode.class)
                        .map(this::toBrokerOrderResponse)
                );
    }

    @Override
    public Mono<List<BrokerPosition>> getPositions(String accountId) {
        return getCredentials(accountId)
                .flatMap(creds -> webClient.get()
                        .uri("/v2/positions")
                        .header("access-token", creds.getAccessToken().trim())
                        .header("Content-Type", "application/json")
                        .retrieve()
                        .bodyToMono(JsonNode.class)
                        .map(rootNode -> {
                            List<BrokerPosition> positions = new ArrayList<>();
                            if (rootNode.isArray()) {
                                for (JsonNode node : rootNode) {
                                    // 1. Filter out closed positions (netQty == 0)
                                    int netQty = node.path("netQty").asInt(0);
                                    if (netQty == 0) continue;

                                    // 2. Logic to calculate Average Price (Same as Reference Project)
                                    double avgPrice = 0.0;
                                    if (netQty > 0) {
                                        avgPrice = node.path("buyAvg").asDouble(0.0);
                                        if (avgPrice == 0.0) avgPrice = node.path("avgPrice").asDouble(0.0);
                                    } else {
                                        avgPrice = node.path("sellAvg").asDouble(0.0);
                                        if (avgPrice == 0.0) avgPrice = node.path("avgPrice").asDouble(0.0);
                                    }
                                    // Fallback: Day Buy Value / Day Buy Qty
                                    if (avgPrice == 0.0) {
                                        double dayBuyVal = node.path("dayBuyValue").asDouble(0.0);
                                        int dayBuyQty = node.path("dayBuyQty").asInt(0);
                                        if (dayBuyQty > 0) avgPrice = dayBuyVal / dayBuyQty;
                                    }

                                    // 3. Logic for LTP
                                    double ltp = node.path("lastTradedPrice").asDouble(0.0);
                                    if (ltp == 0.0) ltp = node.path("ltp").asDouble(0.0);

                                    // 4. Logic for PnL
                                    double realized = node.path("realizedProfit").asDouble(0.0);
                                    double unrealized = node.path("unrealizedProfit").asDouble(0.0);

                                    positions.add(BrokerPosition.builder()
                                            .symbol(node.path("tradingSymbol").asText("Unknown"))
                                            .productType(node.path("productType").asText("INTRADAY"))
                                            .netQuantity(new BigDecimal(netQty))
                                            .avgPrice(new BigDecimal(avgPrice))
                                            .ltp(new BigDecimal(ltp))
                                            .pnl(new BigDecimal(realized + unrealized))
                                            .buyQty(new BigDecimal(node.path("buyQty").asInt(0)))
                                            .sellQty(new BigDecimal(node.path("sellQty").asInt(0)))
                                            .build());
                                }
                            }
                            return positions;
                        })
                );
    }

    private Map<String, Object> mapToDhanPayload(BrokerOrderRequest req, String clientId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("dhanClientId", clientId);
        payload.put("transactionType", req.getSide().name());

        // --- 🌟 DYNAMIC EXCHANGE LOGIC 🌟 ---
        // Defaults to NSE_EQ, but allows override via meta (passed from frontend)
        String exchange = "NSE_EQ";
        if (req.getMeta() != null && req.getMeta().containsKey("exchange")) {
            exchange = (String) req.getMeta().get("exchange");
        }
        payload.put("exchangeSegment", exchange);

        // --- DYNAMIC PRODUCT TYPE ---
        String pType = req.getMeta() != null ? (String) req.getMeta().getOrDefault("productType", "INTRADAY") : "INTRADAY";
        payload.put("productType", pType);

        payload.put("orderType", req.getOrderType().name());
        payload.put("validity", "DAY");
        payload.put("securityId", req.getSymbol());
        payload.put("quantity", req.getQuantity());

        if (req.getPrice() != null && req.getPrice().doubleValue() > 0) {
            payload.put("price", req.getPrice());
        }

        return payload;
    }

    private BrokerOrderResponse toBrokerOrderResponse(JsonNode root) {
        String orderId = root.path("orderId").asText();
        String status = root.path("orderStatus").asText();
        return new BrokerOrderResponse(orderId, status, "Placed via Dhan", null);
    }
}
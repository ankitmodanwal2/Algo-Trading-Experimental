package com.myorg.trading.broker.adapters.angelone;

import com.myorg.trading.broker.api.*;
import com.myorg.trading.config.properties.AngelOneProperties;
import com.myorg.trading.broker.token.TokenStore;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.ClientResponse;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * Angel One SmartAPI adapter (account-aware).
 * Note: this is a skeleton — adjust paths/fields to match SmartAPI docs.
 */
@Component("angelone")
public class AngelOneAdapter implements BrokerClient {

    private final WebClient webClient;
    private final AngelOneProperties props;
    private final TokenStore<AngelAuthResponse> tokenStore;

    public AngelOneAdapter(WebClient.Builder webClientBuilder, AngelOneProperties props,
                           TokenStore<AngelAuthResponse> tokenStore) {
        this.webClient = webClientBuilder.baseUrl(props.getBaseUrl()).build();
        this.props = props;
        this.tokenStore = tokenStore;
    }

    @Override
    public String getBrokerId() { return "angelone"; }

    @Override
    public Set<BrokerCapability> capabilities() {
        return Set.of(BrokerCapability.PLACE_ORDER, BrokerCapability.CANCEL_ORDER, BrokerCapability.MARKET_DATA_STREAM);
    }

    /**
     * Ensure a valid token for given accountId. Uses TokenStore to load & persist tokens.
     */
    private Mono<AngelAuthResponse> authenticateAccount(String accountId) {
        return tokenStore.getToken(accountId)
                .flatMap(t -> {
                    // t exists here; check expiry
                    if (t.isExpired()) {
                        return requestNewToken(accountId);
                    }
                    return Mono.just(t);
                })
                .switchIfEmpty(requestNewToken(accountId));
    }

    /**
     * Request a new token (account-scoped). NOTE: for many brokers you must use per-account stored credentials
     * (API key/secret) and not global client credentials. Adjust this method to read those from BrokerAccountService.
     */
    private Mono<AngelAuthResponse> requestNewToken(String accountId) {
        Map<String, Object> body = Map.of(
                "client_id", props.getClientId(),
                "client_secret", props.getClientSecret()
        );

        return webClient.post()
                .uri(props.getAuthPath())
                .bodyValue(body)
                .retrieve()
                .bodyToMono(AngelAuthResponse.class)
                .flatMap(r -> {
                    // mark obtained time so isExpired() works
                    r.markObtainedNow();
                    return tokenStore.saveToken(accountId, r).thenReturn(r);
                });
    }

    // ----------------- BrokerClient implementations (account-aware) -----------------

    @Override
    public Mono<BrokerAuthToken> authenticateIfNeeded() {
        // backward-compatible default (not account-scoped)
        return requestNewToken("default")
                .map(r -> new BrokerAuthToken(r.getAccessToken(), r.getRefreshToken(), r.getTokenType(),
                        Instant.now().plusSeconds(r.getExpiresIn() == null ? 0 : r.getExpiresIn())));
    }

    @Override
    public Mono<BrokerOrderResponse> placeOrder(String accountId, BrokerOrderRequest req) {
        return authenticateAccount(accountId)
                .flatMap(auth -> webClient.post()
                        .uri(props.getPlaceOrderPath())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + auth.getAccessToken())
                        .bodyValue(mapToAngelPayload(req))
                        .retrieve()
                        .bodyToMono(AngelOrderResponse.class)
                        .map(this::toBrokerOrderResponse)
                );
    }

    @Override
    public Mono<BrokerOrderStatus> getOrderStatus(String accountId, String brokerOrderId) {
        return authenticateAccount(accountId)
                .flatMap(auth -> webClient.get()
                        .uri(uriBuilder -> uriBuilder.path(props.getOrderStatusPath())
                                .queryParam("order_id", brokerOrderId).build())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + auth.getAccessToken())
                        .retrieve()
                        .bodyToMono(AngelOrderStatusResponse.class)
                        .map(this::toBrokerOrderStatus)
                );
    }

    @Override
    public Mono<Void> cancelOrder(String accountId, String brokerOrderId) {
        return authenticateAccount(accountId)
                .flatMap(auth -> webClient.post()
                        .uri(props.getCancelOrderPath())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + auth.getAccessToken())
                        .bodyValue(Map.of("order_id", brokerOrderId))
                        .exchangeToMono(response -> handleVoidResponse(response))
                );
    }

    /**
     * Handle responses for void endpoints: return empty on 2xx, otherwise create an error.
     */
    private Mono<Void> handleVoidResponse(ClientResponse resp) {
        if (resp.statusCode().is2xxSuccessful()) {
            return Mono.empty();
        }
        return resp.createException().flatMap(Mono::error);
    }

    @Override
    public Flux<MarketDataTick> marketDataStream(String instrumentToken) {
        // TODO: implement streaming (WebSocket / SSE) according to AngelOne's streaming API.
        return Flux.empty();
    }

    // --- mapping helpers ---
    private Object mapToAngelPayload(BrokerOrderRequest req) {
        return Map.of(
                "symbol", req.getSymbol(),
                "qty", req.getQuantity(),
                "side", req.getSide().name(),
                "orderType", req.getOrderType().name(),
                "price", req.getPrice()
        );
    }

    private BrokerOrderResponse toBrokerOrderResponse(AngelOrderResponse r) {
        if (r == null) return new BrokerOrderResponse(null, "REJECTED", "empty", Map.of());
        return new BrokerOrderResponse(r.getOrderId(), r.getStatus(), r.getMessage(), r.getRaw());
    }

    private BrokerOrderStatus toBrokerOrderStatus(AngelOrderStatusResponse s) {
        BrokerOrderStatus st = new BrokerOrderStatus();
        st.setOrderId(s.getOrderId());
        st.setStatus(s.getStatus());
        st.setFilledQuantity(s.getFilledQty());
        st.setAvgFillPrice(s.getAvgPrice());
        return st;
    }

    // NOTE: you must ensure AngelAuthResponse has markObtainedNow() and isExpired() helpers.
}

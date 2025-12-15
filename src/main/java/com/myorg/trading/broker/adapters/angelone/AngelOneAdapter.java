package com.myorg.trading.broker.adapters.angelone;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myorg.trading.broker.api.*;
import com.myorg.trading.broker.model.AngelOneCredentials;
import com.myorg.trading.broker.token.TokenStore;
import com.myorg.trading.config.properties.AngelOneProperties;
import com.myorg.trading.service.broker.BrokerAccountService;
import com.myorg.trading.util.CryptoUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.http.HttpHeaders;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.myorg.trading.domain.model.OHLCV;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Slf4j
@Component("angelone")
public class AngelOneAdapter implements BrokerClient {

    private final WebClient webClient;
    private final AngelOneProperties props;
    private final TokenStore<AngelAuthResponse> tokenStore;
    private final BrokerAccountService brokerAccountService;
    private final ObjectMapper objectMapper;
    private final AngelOneWebSocketClient wsClient;

    // Hardcoded constant for production API, can also be moved to properties
    private static final String ANGEL_BASE_URL = "https://apiconnect.angelone.in";

    public AngelOneAdapter(WebClient.Builder webClientBuilder,
                           AngelOneProperties props,
                           TokenStore<AngelAuthResponse> tokenStore,
                           BrokerAccountService brokerAccountService,
                           ObjectMapper objectMapper,
                           AngelOneWebSocketClient wsClient) {
        this.webClient = webClientBuilder.baseUrl(ANGEL_BASE_URL).build();
        this.props = props;
        this.tokenStore = tokenStore;
        this.brokerAccountService = brokerAccountService;
        this.objectMapper = objectMapper;
        this.wsClient = wsClient;
    }

    @Override
    public String getBrokerId() {
        return "angelone";
    }

    @Override
    public Set<BrokerCapability> capabilities() {
        return Set.of(BrokerCapability.PLACE_ORDER, BrokerCapability.MARKET_DATA_STREAM, BrokerCapability.GET_POSITIONS);
    }

    // --- Authentication Logic ---

    private Mono<AngelAuthResponse> authenticateAccount(String accountId) {
        return tokenStore.getToken(accountId)
                .filter(t -> !t.isExpired())
                .switchIfEmpty(Mono.defer(() -> performLogin(accountId)));
    }

    private Mono<AngelAuthResponse> performLogin(String accountId) {
        return Mono.fromCallable(() -> brokerAccountService.readDecryptedCredentials(Long.valueOf(accountId)))
                .flatMap(opt -> opt.map(Mono::just).orElse(Mono.error(new IllegalArgumentException("No credentials found for account: " + accountId))))
                .flatMap(json -> {
                    try {
                        AngelOneCredentials creds = objectMapper.readValue(json, AngelOneCredentials.class);
                        String totp = CryptoUtil.generateTotp(creds.getTotpKey());

                        Map<String, Object> loginBody = Map.of(
                                "clientcode", creds.getClientCode(),
                                "password", creds.getPassword(),
                                "totp", totp
                        );

                        return webClient.post()
                                .uri("/rest/auth/angelbroking/user/v1/loginByPassword") // Standard Login Endpoint
                                .header("Content-Type", "application/json")
                                .header("Accept", "application/json")
                                .header("X-UserType", "USER")
                                .header("X-SourceID", "WEB")
                                .header("X-PrivateKey", creds.getApiKey())
                                .header("X-ClientLocalIP", "127.0.0.1")
                                .header("X-ClientPublicIP", "127.0.0.1")
                                .header("X-MACAddress", "00:00:00:00:00:00") // Required MAC format
                                .bodyValue(loginBody)
                                .retrieve()
                                .bodyToMono(JsonNode.class)
                                .flatMap(responseJson -> {
                                    boolean status = responseJson.path("status").asBoolean(false);
                                    if (!status) {
                                        return Mono.error(new RuntimeException("Angel Login Failed: " + responseJson.path("message").asText()));
                                    }

                                    JsonNode dataNode = responseJson.path("data");
                                    if (dataNode.isMissingNode()) {
                                        return Mono.error(new RuntimeException("Missing 'data' in login response"));
                                    }

                                    AngelAuthResponse authResponse = new AngelAuthResponse();
                                    authResponse.setAccessToken(dataNode.path("jwtToken").asText());
                                    authResponse.setRefreshToken(dataNode.path("refreshToken").asText());
                                    authResponse.setSessionId(dataNode.path("feedToken").asText());
                                    authResponse.setExpiresIn(28800L); // 8 hours
                                    authResponse.markObtainedNow();

                                    // Initialize WebSocket immediately after login
                                    wsClient.connect(authResponse.getAccessToken(), creds.getApiKey(), creds.getClientCode());

                                    return tokenStore.saveToken(accountId, authResponse).thenReturn(authResponse);
                                });

                    } catch (Exception e) {
                        return Mono.error(new RuntimeException("Login Flow Failed: " + e.getMessage(), e));
                    }
                });
    }

    // --- Order Placement ---

    @Override
    public Mono<BrokerOrderResponse> placeOrder(String accountId, BrokerOrderRequest req) {
        return authenticateAccount(accountId)
                .flatMap(auth -> Mono.fromCallable(() -> brokerAccountService.readDecryptedCredentials(Long.valueOf(accountId)))
                        .flatMap(opt -> opt.map(Mono::just).orElse(Mono.error(new IllegalArgumentException("No credentials found"))))
                        .map(json -> {
                            try {
                                return objectMapper.readValue(json, AngelOneCredentials.class).getApiKey();
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        })
                        .flatMap(apiKey -> webClient.post()
                                .uri("/rest/secure/angelbroking/order/v1/placeOrder")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + auth.getAccessToken())
                                .header("X-PrivateKey", apiKey)
                                .header("X-UserType", "USER")
                                .header("X-SourceID", "WEB")
                                .header("X-ClientLocalIP", "127.0.0.1")
                                .header("X-ClientPublicIP", "127.0.0.1")
                                .header("X-MACAddress", "00:00:00:00:00:00")
                                .bodyValue(mapToAngelPayload(req))
                                .retrieve()
                                .bodyToMono(JsonNode.class) // Parse raw JSON first to check status
                                .map(this::toBrokerOrderResponse)
                        ));
    }

    private Map<String, Object> mapToAngelPayload(BrokerOrderRequest req) {
        Map<String, Object> payload = new HashMap<>();
        Map<String, Object> meta = req.getMeta() != null ? req.getMeta() : Map.of();

        payload.put("variety", "NORMAL");

        // 🔥 CRITICAL FIX: Extract the correct trading symbol from metadata
        // The frontend sends BOTH securityId (req.getSymbol()) AND tradingSymbol (in meta)
        String tradingSymbol = (String) meta.get("tradingSymbol");

        if (tradingSymbol == null || tradingSymbol.isBlank()) {
            throw new IllegalArgumentException("Missing tradingSymbol in order metadata");
        }

        // Angel requires "-EQ" suffix for NSE Equity if not already present
        String exchange = (String) meta.getOrDefault("exchange", "NSE_EQ");
        if ((exchange.equals("NSE") || exchange.equals("NSE_EQ")) && !tradingSymbol.endsWith("-EQ")) {
            tradingSymbol += "-EQ";
        }

        payload.put("tradingsymbol", tradingSymbol);

        // Symbol token should be the Security ID (numeric)
        payload.put("symboltoken", req.getSymbol());

        payload.put("transactiontype", req.getSide().name());
        payload.put("exchange", "NSE"); // Hardcoded to NSE for now, or use meta.get("exchange")
        payload.put("ordertype", req.getOrderType().name());
        payload.put("producttype", "INTRADAY");
        payload.put("duration", "DAY");
        payload.put("price", req.getPrice() != null ? req.getPrice() : "0");
        payload.put("quantity", req.getQuantity());
        payload.put("squareoff", "0");
        payload.put("stoploss", "0");

        return payload;
    }

    private BrokerOrderResponse toBrokerOrderResponse(JsonNode root) {
        boolean status = root.path("status").asBoolean();
        String message = root.path("message").asText();
        String orderId = root.path("data").path("orderid").asText();

        if (!status) {
            // Throw error so the upper layer handles it as a failure
            throw new RuntimeException("Angel Order Failed: " + message);
        }
        return new BrokerOrderResponse(orderId, "PLACED", message, null);
    }

    // --- Position Fetching ---

    @Override
    public Mono<List<BrokerPosition>> getPositions(String accountId) {
        return authenticateAccount(accountId)
                .flatMap(auth -> Mono.fromCallable(() -> brokerAccountService.readDecryptedCredentials(Long.valueOf(accountId)))
                        .flatMap(opt -> opt.map(Mono::just).orElse(Mono.error(new IllegalArgumentException("No credentials found"))))
                        .map(json -> {
                            try {
                                return objectMapper.readValue(json, AngelOneCredentials.class).getApiKey();
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        })
                        .flatMap(apiKey -> webClient.get()
                                .uri("/rest/secure/angelbroking/order/v1/getPosition")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + auth.getAccessToken())
                                .header("X-PrivateKey", apiKey)
                                .header("X-UserType", "USER")
                                .header("X-SourceID", "WEB")
                                .header("X-ClientLocalIP", "127.0.0.1")
                                .header("X-ClientPublicIP", "127.0.0.1")
                                .header("X-MACAddress", "00:00:00:00:00:00")
                                .retrieve()
                                .bodyToMono(JsonNode.class)
                                .map(rootNode -> {
                                    JsonNode dataNode = rootNode.path("data");
                                    if (dataNode.isMissingNode() || !dataNode.isArray()) {
                                        return List.<BrokerPosition>of();
                                    }

                                    List<BrokerPosition> positions = new ArrayList<>();
                                    for (JsonNode node : dataNode) {
                                        positions.add(BrokerPosition.builder()
                                                .symbol(node.path("tradingsymbol").asText())
                                                .productType(node.path("producttype").asText())
                                                .netQuantity(new BigDecimal(node.path("netqty").asText("0")))
                                                .avgPrice(new BigDecimal(node.path("avgnetprice").asText("0")))
                                                .ltp(new BigDecimal(node.path("ltp").asText("0")))
                                                .pnl(new BigDecimal(node.path("pnl").asText("0")))
                                                .buyQty(new BigDecimal(node.path("buyqty").asText("0")))
                                                .sellQty(new BigDecimal(node.path("sellqty").asText("0")))
                                                .build());
                                    }
                                    return positions;
                                })
                        ));
    }

    // Credentials Validation for UI
    @Override
    public Mono<Boolean> validateCredentials(String rawCredentialsJson) {
        return Mono.just(rawCredentialsJson)
                .flatMap(json -> {
                    try {
                        AngelOneCredentials creds = objectMapper.readValue(json, AngelOneCredentials.class);
                        // Simply try to login to validate
                        String totp = CryptoUtil.generateTotp(creds.getTotpKey());
                        Map<String, Object> loginBody = Map.of("clientcode", creds.getClientCode(), "password", creds.getPassword(), "totp", totp);

                        return webClient.post().uri("/rest/auth/angelbroking/user/v1/loginByPassword")
                                .header("Content-Type", "application/json")
                                .header("Accept", "application/json")
                                .header("X-UserType", "USER")
                                .header("X-SourceID", "WEB")
                                .header("X-PrivateKey", creds.getApiKey())
                                .header("X-ClientLocalIP", "127.0.0.1")
                                .header("X-ClientPublicIP", "127.0.0.1")
                                .header("X-MACAddress", "00:00:00:00:00:00")
                                .bodyValue(loginBody)
                                .retrieve()
                                .bodyToMono(JsonNode.class)
                                .map(node -> node.path("status").asBoolean(false));
                    } catch (Exception e) {
                        return Mono.just(false);
                    }
                });
    }
    @Override
    public Mono<List<OHLCV>> getHistoricalData(String accountId, String symbol, String interval, Instant from, Instant to) {
        return authenticateAccount(accountId)
                .flatMap(auth -> Mono.fromCallable(() -> brokerAccountService.readDecryptedCredentials(Long.valueOf(accountId)))
                        .flatMap(opt -> opt.map(Mono::just).orElse(Mono.error(new IllegalArgumentException("No credentials"))))
                        .map(json -> {
                            try {
                                return objectMapper.readValue(json, AngelOneCredentials.class).getApiKey();
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        })
                        .flatMap(apiKey -> {
                            // Convert interval to Angel's format
                            String angelInterval = mapInterval(interval);

                            // Format dates as per Angel's requirement (yyyy-MM-dd HH:mm)
                            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
                                    .withZone(ZoneId.of("Asia/Kolkata"));

                            Map<String, Object> requestBody = Map.of(
                                    "exchange", "NSE",
                                    "symboltoken", symbol,
                                    "interval", angelInterval,
                                    "fromdate", formatter.format(from),
                                    "todate", formatter.format(to)
                            );

                            return webClient.post()
                                    .uri("/rest/secure/angelbroking/historical/v1/getCandleData")
                                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + auth.getAccessToken())
                                    .header("X-PrivateKey", apiKey)
                                    .header("X-UserType", "USER")
                                    .header("X-SourceID", "WEB")
                                    .header("X-ClientLocalIP", "127.0.0.1")
                                    .header("X-ClientPublicIP", "127.0.0.1")
                                    .header("X-MACAddress", "00:00:00:00:00:00")
                                    .bodyValue(requestBody)
                                    .retrieve()
                                    .bodyToMono(JsonNode.class)
                                    .map(this::parseHistoricalData);
                        })
                );
    }

    private String mapInterval(String interval) {
        // Map our standard intervals to Angel's format
        return switch (interval.toUpperCase()) {
            case "1M", "ONE_MINUTE" -> "ONE_MINUTE";
            case "5M", "FIVE_MINUTE" -> "FIVE_MINUTE";
            case "15M", "FIFTEEN_MINUTE" -> "FIFTEEN_MINUTE";
            case "1H", "ONE_HOUR" -> "ONE_HOUR";
            case "1D", "ONE_DAY" -> "ONE_DAY";
            default -> "FIVE_MINUTE";
        };
    }

    private List<OHLCV> parseHistoricalData(JsonNode root) {
        List<OHLCV> candles = new ArrayList<>();

        boolean status = root.path("status").asBoolean();
        if (!status) {
            log.warn("Historical data fetch failed: {}", root.path("message").asText());
            return candles;
        }

        JsonNode dataNode = root.path("data");
        if (!dataNode.isArray() || dataNode.isEmpty()) {
            return candles;
        }

        for (JsonNode candleArray : dataNode) {
            // Angel returns: [timestamp, open, high, low, close, volume]
            if (candleArray.isArray() && candleArray.size() >= 6) {
                try {
                    Instant timestamp = Instant.parse(candleArray.get(0).asText());

                    candles.add(OHLCV.builder()
                            .timestamp(timestamp)
                            .open(new BigDecimal(candleArray.get(1).asText()))
                            .high(new BigDecimal(candleArray.get(2).asText()))
                            .low(new BigDecimal(candleArray.get(3).asText()))
                            .close(new BigDecimal(candleArray.get(4).asText()))
                            .volume(candleArray.get(5).asLong())
                            .build());
                } catch (Exception e) {
                    log.error("Failed to parse candle: {}", candleArray, e);
                }
            }
        }

        return candles;
    }
}
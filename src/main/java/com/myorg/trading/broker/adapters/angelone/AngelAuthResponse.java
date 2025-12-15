package com.myorg.trading.broker.adapters.angelone;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.Instant;

/**
 * Angel One SmartAPI auth response DTO.
 * Updated to match actual API response structure.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AngelAuthResponse {

    /**
     * The JWT access token (called "jwtToken" in Angel's response)
     */
    @JsonProperty("jwtToken")
    private String accessToken;

    /**
     * Refresh token for extending session
     */
    @JsonProperty("refreshToken")
    private String refreshToken;

    /**
     * Feed token for WebSocket connections
     */
    @JsonProperty("feedToken")
    private String sessionId;

    /**
     * Token type (typically "Bearer")
     */
    @JsonProperty("token_type")
    private String tokenType;

    /**
     * API response message
     */
    @JsonProperty("message")
    private String message;

    /**
     * seconds until expiry (Angel sessions last till midnight IST)
     * Default: 8 hours (28800 seconds)
     */
    private Long expiresIn;

    /**
     * When this token was obtained (set by adapter when saving the token).
     * Stored as epoch seconds.
     */
    private Long obtainedAtEpochSec;

    /**
     * Convenience: mark the time-of-receipt.
     */
    public void markObtainedNow() {
        this.obtainedAtEpochSec = Instant.now().getEpochSecond();
    }

    /**
     * Return the approximate expiration instant (null if unknown).
     */
    public Instant getExpiryInstant() {
        if (expiresIn == null || obtainedAtEpochSec == null) return null;
        return Instant.ofEpochSecond(obtainedAtEpochSec + expiresIn);
    }

    /**
     * True if the token is (or will be) expired.
     * Uses a safety margin of 30 seconds to avoid using near-expiry tokens.
     */
    public boolean isExpired() {
        Instant expiry = getExpiryInstant();
        if (expiry == null) return true;
        return Instant.now().isAfter(expiry.minusSeconds(30));
    }
}
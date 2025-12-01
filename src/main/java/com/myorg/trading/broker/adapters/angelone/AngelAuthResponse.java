package com.myorg.trading.broker.adapters.angelone;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.Instant;

/**
 * Angel One SmartAPI auth response DTO.
 * Added helper fields/methods so adapters can check expiry.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AngelAuthResponse {

    @JsonProperty("access_token")
    private String accessToken;

    @JsonProperty("refresh_token")
    private String refreshToken;

    /**
     * seconds until expiry (from broker response)
     */
    @JsonProperty("expires_in")
    private Long expiresIn;

    @JsonProperty("token_type")
    private String tokenType;

    @JsonProperty("session_id")
    private String sessionId;

    @JsonProperty("message")
    private String message;

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

package com.expensetracker.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cors cors, Google google) {

    public record Jwt(String secret, long ttlHours) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    /** Optional: without a client id, Google sign-in stays switched off. */
    public record Google(String clientId) {
    }
}

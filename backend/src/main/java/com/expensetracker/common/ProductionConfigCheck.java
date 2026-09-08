package com.expensetracker.common;

import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Refuses to serve traffic with the development defaults still in place. A deployment that quietly
 * runs on the sample JWT secret is worse than one that fails to start.
 */
@Component
public class ProductionConfigCheck {

    static final String DEV_SECRET = "dev-only-secret-change-me-at-least-32-bytes-long!!";
    private static final int MIN_SECRET_BYTES = 32;
    private static final Logger log = LoggerFactory.getLogger(ProductionConfigCheck.class);

    private final AppProperties properties;
    private final Environment environment;

    public ProductionConfigCheck(AppProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    // runs while the context is building, so a misconfigured deploy never accepts a request
    @PostConstruct
    void verify() {
        String secret = properties.jwt().secret();
        boolean development = environment.matchesProfiles("dev", "test", "default");

        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET must be at least " + MIN_SECRET_BYTES + " bytes long");
        }
        if (DEV_SECRET.equals(secret)) {
            if (!development) {
                throw new IllegalStateException(
                        "JWT_SECRET is still the development default. Set a real one before deploying.");
            }
            log.warn("Running with the development JWT secret. Set JWT_SECRET before deploying.");
        }
        if (!development && properties.cors().allowedOrigins().stream().anyMatch(o -> o.contains("localhost"))) {
            log.warn("CORS still allows localhost origins: {}", properties.cors().allowedOrigins());
        }
    }
}

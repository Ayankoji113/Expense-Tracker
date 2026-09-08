package com.expensetracker.common;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * Fixed-window limiter for the unauthenticated endpoints, so a stolen password list cannot be tried
 * at speed.
 *
 * <p>ponytail: in-memory and therefore per instance - fine for one container, swap for Redis or a
 * gateway rule before running several.
 */
@Component
public class RateLimiter {

    private record Window(Instant startedAt, AtomicInteger count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    /**
     * @param key    what is being limited, e.g. "login:1.2.3.4"
     * @param limit  how many attempts the window allows
     * @param window how long the window lasts
     * @throws TooManyRequestsException once the limit is passed
     */
    public void check(String key, int limit, Duration window) {
        Instant now = Instant.now();
        Window current = windows.compute(key, (ignored, existing) -> {
            if (existing == null || existing.startedAt().plus(window).isBefore(now)) {
                return new Window(now, new AtomicInteger());
            }
            return existing;
        });

        if (current.count().incrementAndGet() > limit) {
            long retryInSeconds = Duration.between(now, current.startedAt().plus(window)).toSeconds();
            throw new TooManyRequestsException("Too many attempts. Try again in %d seconds."
                    .formatted(Math.max(1, retryInSeconds)));
        }
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(entry -> entry.getValue().startedAt().plus(window).isBefore(now));
        }
    }

    /** Called after a success, so a legitimate sign-in does not carry its failures forward. */
    public void reset(String key) {
        windows.remove(key);
    }
}

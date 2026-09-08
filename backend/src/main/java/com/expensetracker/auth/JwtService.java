package com.expensetracker.auth;

import com.expensetracker.common.AppProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(props.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofHours(props.jwt().ttlHours());
    }

    public Token issue(Long userId, String email) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);
        String jwt = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(expiresAt))
                .signWith(key)
                .compact();
        return new Token(jwt, expiresAt);
    }

    /** @return the user id carried by the token, or null if it is invalid or expired. */
    public Long userIdOf(String jwt) {
        try {
            String subject = Jwts.parser().verifyWith(key).build().parseSignedClaims(jwt).getPayload().getSubject();
            return Long.valueOf(subject);
        } catch (Exception e) {
            return null;
        }
    }

    public record Token(String token, Instant expiresAt) {
    }
}

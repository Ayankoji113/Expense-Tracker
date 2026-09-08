package com.expensetracker.auth;

import com.expensetracker.auth.AuthController.AuthResponse;
import com.expensetracker.common.AppProperties;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
import com.expensetracker.user.Usernames;
import java.util.List;
import java.util.Set;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the ID token that Google Identity Services hands the browser, then issues our own JWT.
 * No client secret is involved: the token is signed by Google and checked against their public keys.
 */
@Service
public class GoogleAuthService {

    private static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    private final UserRepository users;
    private final AuthService auth;
    private final String clientId;
    private final JwtDecoder decoder;

    public GoogleAuthService(UserRepository users, AuthService auth, AppProperties properties) {
        this.users = users;
        this.auth = auth;
        this.clientId = properties.google() == null ? null : trimToNull(properties.google().clientId());
        // without a client id there is nothing to validate the audience against, so the feature stays off
        this.decoder = clientId == null ? null : NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).build();
    }

    public boolean isEnabled() {
        return decoder != null;
    }

    @Transactional
    public AuthResponse signIn(String credential) {
        if (!isEnabled()) {
            throw new BadRequestException(
                    "Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID to enable it.");
        }
        Jwt token = verify(credential);
        String googleSub = token.getSubject();
        String email = token.getClaimAsString("email");
        if (email == null || !Boolean.TRUE.equals(token.getClaim("email_verified"))) {
            throw new BadCredentialsException("Google account has no verified email address");
        }
        String avatarUrl = token.getClaimAsString("picture");

        User user = users.findByGoogleSub(googleSub)
                .or(() -> users.findByEmailIgnoreCase(email).map(existing -> {
                    // same person signing in with Google for the first time
                    existing.linkGoogle(googleSub, avatarUrl);
                    return users.save(existing);
                }))
                .orElseGet(() -> users.save(User.google(email,
                        Usernames.fromEmail(email, users::existsByUsernameIgnoreCase), googleSub, avatarUrl)));

        return auth.token(user);
    }

    private Jwt verify(String credential) {
        Jwt token;
        try {
            token = decoder.decode(credential);
        } catch (JwtException e) {
            throw new BadCredentialsException("Google sign-in failed: the token could not be verified");
        }
        List<String> audience = token.getAudience();
        if (audience == null || !audience.contains(clientId)) {
            throw new BadCredentialsException("Google token was issued for a different application");
        }
        if (!ISSUERS.contains(String.valueOf(token.getClaimAsString("iss")))) {
            throw new BadCredentialsException("Google token has an unexpected issuer");
        }
        return token;
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

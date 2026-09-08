package com.expensetracker.auth;

import com.expensetracker.common.RateLimiter;
import com.expensetracker.user.ProfileController.ProfileDto;
import com.expensetracker.user.Usernames;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int LOGIN_ATTEMPTS = 10;
    private static final int RESET_ATTEMPTS = 5;

    private final AuthService auth;
    private final GoogleAuthService google;
    private final PasswordResetService passwordReset;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService auth, GoogleAuthService google, PasswordResetService passwordReset,
            RateLimiter rateLimiter) {
        this.auth = auth;
        this.google = google;
        this.passwordReset = passwordReset;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/register")
    AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request);
    }

    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        String key = "login:" + clientIp(http);
        rateLimiter.check(key, LOGIN_ATTEMPTS, WINDOW);
        AuthResponse response = auth.login(request.identifierOrEmail(), request.password());
        rateLimiter.reset(key);
        return response;
    }

    /** Takes the ID token the Google button hands the browser, and trades it for our own JWT. */
    @PostMapping("/google")
    AuthResponse google(@Valid @RequestBody GoogleRequest request) {
        return google.signIn(request.credential());
    }

    /**
     * Starts a password reset. The answer is deliberately the same whether or not the address is
     * registered, so this cannot be used to find out who has an account.
     */
    @PostMapping("/password/forgot")
    ForgotPasswordResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest http) {
        rateLimiter.check("forgot:" + clientIp(http), RESET_ATTEMPTS, WINDOW);
        passwordReset.requestCode(request.email());
        return new ForgotPasswordResponse(
                "If that email is registered, a 6-digit code is on its way. It expires in 15 minutes.",
                passwordReset.isEmailConfigured());
    }

    @PostMapping("/password/reset")
    ResetPasswordResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request,
            HttpServletRequest http) {
        rateLimiter.check("reset:" + clientIp(http), LOGIN_ATTEMPTS, WINDOW);
        passwordReset.reset(request.email(), request.code(), request.password());
        return new ResetPasswordResponse("Your password has been changed. You can sign in with it now.");
    }

    /** Lets the sign-in page know which options to render. */
    @GetMapping("/config")
    AuthConfig config() {
        return new AuthConfig(google.isEnabled(), passwordReset.isEmailConfigured());
    }

    /** Behind nginx or a platform load balancer the real address arrives in X-Forwarded-For. */
    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    public record RegisterRequest(
            @Email @NotBlank String email,
            @NotBlank @Pattern(regexp = Usernames.PATTERN,
                    message = "must be 3-30 characters: letters, digits, dot or underscore") String username,
            @NotBlank @Size(min = 8, max = 72, message = "must be 8-72 characters") String password,
            @Min(value = 13, message = "must be 13 or older") @Max(value = 120,
                    message = "must be 120 or younger") Integer age) {
    }

    /** {@code identifier} is an email address or a username; {@code email} is the older field name. */
    public record LoginRequest(String identifier, String email, @NotBlank String password) {

        public String identifierOrEmail() {
            String value = identifier == null || identifier.isBlank() ? email : identifier;
            if (value == null || value.isBlank()) {
                throw new com.expensetracker.common.BadRequestException("Enter your username or email");
            }
            return value.trim();
        }
    }

    public record GoogleRequest(@NotBlank String credential) {
    }

    public record ForgotPasswordRequest(@Email @NotBlank String email) {
    }

    /** @param emailConfigured false when the server has no SMTP set up and logged the code instead. */
    public record ForgotPasswordResponse(String message, boolean emailConfigured) {
    }

    public record ResetPasswordRequest(
            @Email @NotBlank String email,
            @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "must be the 6-digit code") String code,
            @NotBlank @Size(min = 8, max = 72, message = "must be 8-72 characters") String password) {
    }

    public record ResetPasswordResponse(String message) {
    }

    public record AuthResponse(String token, Instant expiresAt, ProfileDto user) {
    }

    public record AuthConfig(boolean googleEnabled, boolean passwordResetEmailConfigured) {
    }
}

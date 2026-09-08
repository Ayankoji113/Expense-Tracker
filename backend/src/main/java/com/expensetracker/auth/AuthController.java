package com.expensetracker.auth;

import com.expensetracker.user.ProfileController.ProfileDto;
import com.expensetracker.user.Usernames;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final GoogleAuthService google;

    public AuthController(AuthService auth, GoogleAuthService google) {
        this.auth = auth;
        this.google = google;
    }

    @PostMapping("/register")
    AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request);
    }

    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request.email().trim(), request.password());
    }

    /** Takes the ID token the Google button hands the browser, and trades it for our own JWT. */
    @PostMapping("/google")
    AuthResponse google(@Valid @RequestBody GoogleRequest request) {
        return google.signIn(request.credential());
    }

    /** Lets the sign-in page know whether to render the Google button at all. */
    @GetMapping("/config")
    AuthConfig config() {
        return new AuthConfig(google.isEnabled());
    }

    public record RegisterRequest(
            @Email @NotBlank String email,
            @NotBlank @Pattern(regexp = Usernames.PATTERN,
                    message = "must be 3-30 characters: letters, digits, dot or underscore") String username,
            @NotBlank @Size(min = 8, max = 72, message = "must be 8-72 characters") String password,
            @Min(value = 13, message = "must be 13 or older") @Max(value = 120,
                    message = "must be 120 or younger") Integer age) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    public record GoogleRequest(@NotBlank String credential) {
    }

    public record AuthResponse(String token, Instant expiresAt, ProfileDto user) {
    }

    public record AuthConfig(boolean googleEnabled) {
    }
}

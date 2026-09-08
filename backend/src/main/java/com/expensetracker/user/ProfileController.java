package com.expensetracker.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    ProfileDto get(@AuthenticationPrincipal Long userId) {
        return service.get(userId);
    }

    @PutMapping
    ProfileDto update(@AuthenticationPrincipal Long userId, @Valid @RequestBody ProfileRequest request) {
        return service.update(userId, request);
    }

    public record ProfileDto(Long id, String email, String username, Integer age, String provider, String avatarUrl,
            Instant createdAt) {
    }

    public record ProfileRequest(
            @NotBlank @Pattern(regexp = Usernames.PATTERN,
                    message = "must be 3-30 characters: letters, digits, dot or underscore") String username,
            @Min(value = 13, message = "must be 13 or older") @Max(value = 120,
                    message = "must be 120 or younger") Integer age) {
    }
}

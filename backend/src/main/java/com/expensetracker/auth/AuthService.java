package com.expensetracker.auth;

import com.expensetracker.auth.AuthController.AuthResponse;
import com.expensetracker.auth.AuthController.RegisterRequest;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.user.ProfileService;
import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
import com.expensetracker.user.Usernames;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim();
        String username = Usernames.normalise(request.username());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email already registered");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new BadRequestException("That username is taken");
        }
        User user = users.save(User.local(email, username, encoder.encode(request.password()), request.age()));
        return token(user);
    }

    /** Sign in with either the email address or the username - people remember whichever they set. */
    @Transactional(readOnly = true)
    public AuthResponse login(String identifier, String rawPassword) {
        String trimmed = identifier.trim();
        User user = (trimmed.contains("@") ? users.findByEmailIgnoreCase(trimmed)
                : users.findByUsernameIgnoreCase(trimmed))
                .filter(candidate -> candidate.getPasswordHash() != null)
                .filter(candidate -> encoder.matches(rawPassword, candidate.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException("bad credentials"));
        return token(user);
    }

    AuthResponse token(User user) {
        var issued = jwt.issue(user.getId(), user.getEmail());
        return new AuthResponse(issued.token(), issued.expiresAt(), ProfileService.toDto(user));
    }
}

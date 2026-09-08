package com.expensetracker.auth;

import com.expensetracker.auth.AuthController.AuthResponse;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
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
    public AuthResponse register(String email, String rawPassword) {
        if (users.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email already registered");
        }
        User user = users.save(new User(email, encoder.encode(rawPassword)));
        return token(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(String email, String rawPassword) {
        User user = users.findByEmailIgnoreCase(email)
                .filter(u -> encoder.matches(rawPassword, u.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException("bad credentials"));
        return token(user);
    }

    private AuthResponse token(User user) {
        var t = jwt.issue(user.getId(), user.getEmail());
        return new AuthResponse(t.token(), t.expiresAt(), user.getEmail());
    }
}

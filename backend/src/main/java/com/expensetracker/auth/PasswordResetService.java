package com.expensetracker.auth;

import com.expensetracker.common.BadRequestException;
import com.expensetracker.user.User;
import com.expensetracker.user.UserRepository;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Forgotten-password flow: a 6-digit code is emailed, then exchanged for a new password.
 *
 * <p>The responses never say whether an email address exists - an unknown address gets the same
 * answer as a known one, so this cannot be used to enumerate accounts.
 */
@Service
public class PasswordResetService {

    static final Duration CODE_TTL = Duration.ofMinutes(15);
    static final int MAX_ATTEMPTS = 5;
    private static final int MAX_REQUESTS_PER_WINDOW = 3;
    private static final Duration REQUEST_WINDOW = Duration.ofMinutes(15);

    private final UserRepository users;
    private final PasswordResetCodeRepository codes;
    private final PasswordEncoder encoder;
    private final ResetCodeMailer mailer;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(UserRepository users, PasswordResetCodeRepository codes, PasswordEncoder encoder,
            ResetCodeMailer mailer) {
        this.users = users;
        this.codes = codes;
        this.encoder = encoder;
        this.mailer = mailer;
    }

    @Transactional
    public void requestCode(String email) {
        Instant now = Instant.now();
        Optional<User> found = users.findByEmailIgnoreCase(email.trim());
        if (found.isEmpty()) {
            return; // same silent success as a real address
        }
        User user = found.get();
        if (codes.countByUserIdAndCreatedAtAfter(user.getId(), now.minus(REQUEST_WINDOW)) >= MAX_REQUESTS_PER_WINDOW) {
            return; // too many requests: stop sending, but say nothing different
        }

        String code = newCode();
        codes.retireAllFor(user.getId(), now);
        codes.save(new PasswordResetCode(user.getId(), encoder.encode(code), now.plus(CODE_TTL)));
        mailer.send(user.getEmail(), user.getUsername(), code, CODE_TTL);
    }

    // a rejected code still has to commit its attempt count, so the failure must not roll the tx back
    @Transactional(noRollbackFor = BadRequestException.class)
    public void reset(String email, String code, String newPassword) {
        Instant now = Instant.now();
        User user = users.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new BadRequestException("That code is not valid. Request a new one."));

        PasswordResetCode stored = codes.findFirstByUserIdOrderByCreatedAtDesc(user.getId())
                .filter(candidate -> candidate.isLive(now))
                .orElseThrow(() -> new BadRequestException("That code has expired. Request a new one."));

        if (stored.getAttempts() >= MAX_ATTEMPTS) {
            throw new BadRequestException("Too many incorrect attempts. Request a new code.");
        }
        if (!encoder.matches(code.trim(), stored.getCodeHash())) {
            stored.recordFailedAttempt();
            codes.save(stored);
            throw new BadRequestException("That code is not valid. Check the email and try again.");
        }

        user.setPassword(encoder.encode(newPassword));
        users.save(user);
        stored.markUsed(now);
        codes.save(stored);
        // ponytail: existing JWTs stay valid until they expire; add a token version if that matters
    }

    /** Always six digits, leading zeros included. */
    private String newCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    public boolean isEmailConfigured() {
        return mailer.isEmailConfigured();
    }
}

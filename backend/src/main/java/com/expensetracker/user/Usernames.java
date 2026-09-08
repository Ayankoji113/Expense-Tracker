package com.expensetracker.user;

import java.util.Locale;
import java.util.function.Predicate;

/** Usernames are public handles: lowercase letters, digits, dot and underscore. */
public final class Usernames {

    public static final String PATTERN = "^[a-zA-Z0-9._]{3,30}$";
    private static final int MAX_LENGTH = 30;

    private Usernames() {
    }

    public static String normalise(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Turns an email into a usable handle, then appends 2, 3, ... until it is free. Used for Google
     * sign-ups, where the person never picks a username.
     */
    public static String fromEmail(String email, Predicate<String> taken) {
        String base = normalise(email).split("@")[0].replaceAll("[^a-z0-9._]", "");
        if (base.length() < 3) {
            base = "user" + base;
        }
        if (base.length() > MAX_LENGTH) {
            base = base.substring(0, MAX_LENGTH);
        }
        if (!taken.test(base)) {
            return base;
        }
        for (int suffix = 2; suffix < 1000; suffix++) {
            String candidate = trimTo(base, MAX_LENGTH - String.valueOf(suffix).length()) + suffix;
            if (!taken.test(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("could not derive a free username from " + email);
    }

    private static String trimTo(String value, int length) {
        return value.length() <= length ? value : value.substring(0, length);
    }
}

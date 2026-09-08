package com.expensetracker.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class UsernamesTest {

    @Test
    void derivesAHandleFromTheEmailLocalPart() {
        assertThat(Usernames.fromEmail("Ada.Lovelace@example.com", taken())).isEqualTo("ada.lovelace");
        assertThat(Usernames.fromEmail("we-ird+tag@example.com", taken())).isEqualTo("weirdtag");
    }

    @Test
    void addsASuffixUntilTheHandleIsFree() {
        assertThat(Usernames.fromEmail("ada@example.com", taken("ada", "ada2"))).isEqualTo("ada3");
    }

    @Test
    void padsHandlesThatWouldBeTooShort() {
        assertThat(Usernames.fromEmail("jo@example.com", taken())).isEqualTo("userjo");
    }

    @Test
    void keepsDerivedHandlesWithinTheColumnLength() {
        String longLocalPart = "a".repeat(60);
        assertThat(Usernames.fromEmail(longLocalPart + "@example.com", taken())).hasSize(30);
    }

    private static java.util.function.Predicate<String> taken(String... names) {
        Set<String> used = Set.of(names);
        return used::contains;
    }
}

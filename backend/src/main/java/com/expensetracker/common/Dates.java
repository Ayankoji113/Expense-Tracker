package com.expensetracker.common;

import java.time.LocalDate;
import java.time.ZoneOffset;

/** The server does not know which timezone a user is in, so its idea of "today" has to be generous. */
public final class Dates {

    private Dates() {
    }

    /**
     * The latest date that is already "today" somewhere on Earth. Someone in India at 1am is a calendar
     * day ahead of a server running in UTC, so comparing against the server's own date would reject
     * their transaction as being in the future, and hide it from every default date range.
     */
    public static LocalDate latestToday() {
        return LocalDate.now(ZoneOffset.UTC).plusDays(1);
    }
}

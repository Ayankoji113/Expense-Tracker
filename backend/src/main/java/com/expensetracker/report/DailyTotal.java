package com.expensetracker.report;

import java.math.BigDecimal;

/** Projection for the native daily-spend query. */
public interface DailyTotal {
    String getDay();

    BigDecimal getExpense();
}

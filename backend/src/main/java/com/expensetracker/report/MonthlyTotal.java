package com.expensetracker.report;

import java.math.BigDecimal;

/** Projection for the native monthly-totals query. */
public interface MonthlyTotal {
    String getMonth();

    BigDecimal getTotal();
}

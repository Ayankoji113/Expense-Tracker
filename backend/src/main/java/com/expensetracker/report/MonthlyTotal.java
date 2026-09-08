package com.expensetracker.report;

import java.math.BigDecimal;

/** Projection for the native monthly income/expense query. */
public interface MonthlyTotal {
    String getMonth();

    BigDecimal getIncome();

    BigDecimal getExpense();
}

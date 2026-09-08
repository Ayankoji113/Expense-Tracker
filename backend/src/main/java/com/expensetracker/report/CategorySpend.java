package com.expensetracker.report;

import java.math.BigDecimal;

/** How much a user has spent in one category over a period. */
public record CategorySpend(Long categoryId, BigDecimal total) {
}

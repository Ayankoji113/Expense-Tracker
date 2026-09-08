package com.expensetracker.report;

import java.math.BigDecimal;

public record CategoryTotal(String category, String color, BigDecimal total, long count) {
}

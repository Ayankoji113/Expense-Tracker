package com.expensetracker.expense;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseDto(Long id, BigDecimal amount, LocalDate spentOn, String description, Long categoryId,
        String categoryName, String categoryColor, String source, String kind) {
}

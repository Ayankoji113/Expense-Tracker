package com.expensetracker.expense;

import com.expensetracker.expense.Expense.Kind;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        @NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal amount,
        // "not in the future" depends on the user's timezone, so the service checks it
        @NotNull LocalDate spentOn,
        @NotBlank @Size(max = 255) String description,
        Long categoryId,
        Kind kind) {

    /** Money out unless the client says otherwise. */
    public Kind kindOrDefault() {
        return kind == null ? Kind.EXPENSE : kind;
    }
}

package com.expensetracker.budget;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/budgets")
public class BudgetController {

    private final BudgetService service;

    public BudgetController(BudgetService service) {
        this.service = service;
    }

    /** @param month the month to measure spending against, defaults to the current one. */
    @GetMapping
    List<BudgetDto> list(@AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return service.list(userId, month == null ? YearMonth.now() : month);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BudgetDto create(@AuthenticationPrincipal Long userId, @Valid @RequestBody BudgetRequest request) {
        return service.create(userId, request);
    }

    @PutMapping("/{id}")
    BudgetDto update(@AuthenticationPrincipal Long userId, @PathVariable Long id,
            @Valid @RequestBody BudgetRequest request) {
        return service.update(userId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long userId, @PathVariable Long id) {
        service.delete(userId, id);
    }

    public record BudgetDto(Long id, Long categoryId, String categoryName, String categoryColor,
            BigDecimal monthlyLimit, BigDecimal spent, BigDecimal remaining, BigDecimal usedPercent) {
    }

    public record BudgetRequest(
            @NotNull Long categoryId,
            @NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal monthlyLimit) {
    }
}

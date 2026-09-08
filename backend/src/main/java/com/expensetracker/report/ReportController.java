package com.expensetracker.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    Summary summary(@AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.summary(userId, from, to);
    }

    @GetMapping("/by-category")
    List<CategorySlice> byCategory(@AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.byCategory(userId, from, to);
    }

    @GetMapping("/monthly")
    List<MonthlyPoint> monthly(@AuthenticationPrincipal Long userId, @RequestParam(defaultValue = "12") int months) {
        return service.monthly(userId, months);
    }

    @GetMapping("/daily")
    List<DailyPoint> daily(@AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.daily(userId, from, to);
    }

    /**
     * Everything the dashboard header needs. {@code changePercent} fields compare the range with the
     * one of equal length immediately before it, and are null when there is nothing to compare to.
     */
    public record Summary(BigDecimal income, BigDecimal expense, BigDecimal balance, BigDecimal savingsRate,
            long transactionCount, BigDecimal averageExpense, BigDecimal averageDailyExpense,
            BigDecimal largestExpense, String topCategory, BigDecimal incomeChangePercent,
            BigDecimal expenseChangePercent, LocalDate from, LocalDate to) {
    }

    public record CategorySlice(String category, String color, BigDecimal total, long count, BigDecimal percentage) {
    }

    public record MonthlyPoint(String month, BigDecimal income, BigDecimal expense) {
    }

    public record DailyPoint(String day, BigDecimal expense) {
    }
}

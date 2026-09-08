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

    public record Summary(BigDecimal total, long count, BigDecimal average, String topCategory, LocalDate from,
            LocalDate to) {
    }

    public record CategorySlice(String category, String color, BigDecimal total, long count, BigDecimal percentage) {
    }

    public record MonthlyPoint(String month, BigDecimal total) {
    }
}

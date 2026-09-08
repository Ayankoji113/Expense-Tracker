package com.expensetracker.report;

import com.expensetracker.expense.ExpenseRepository;
import com.expensetracker.report.ReportController.CategorySlice;
import com.expensetracker.report.ReportController.MonthlyPoint;
import com.expensetracker.report.ReportController.Summary;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final LocalDate EPOCH = LocalDate.of(1970, 1, 1);

    private final ExpenseRepository expenses;

    public ReportService(ExpenseRepository expenses) {
        this.expenses = expenses;
    }

    public Summary summary(Long userId, LocalDate from, LocalDate to) {
        LocalDate start = from == null ? EPOCH : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        BigDecimal total = expenses.totalBetween(userId, start, end);
        long count = expenses.countBetween(userId, start, end);
        BigDecimal average = count == 0 ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        String top = expenses.totalsByCategory(userId, start, end).stream().findFirst()
                .map(CategoryTotal::category).orElse(null);
        return new Summary(total, count, average, top, start, end);
    }

    public List<CategorySlice> byCategory(Long userId, LocalDate from, LocalDate to) {
        LocalDate start = from == null ? EPOCH : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        List<CategoryTotal> totals = expenses.totalsByCategory(userId, start, end);
        BigDecimal grand = totals.stream().map(CategoryTotal::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        return totals.stream()
                .map(t -> new CategorySlice(t.category(), t.color(), t.total(), t.count(),
                        percentage(t.total(), grand)))
                .toList();
    }

    public List<MonthlyPoint> monthly(Long userId, int months) {
        int window = Math.max(1, Math.min(months, 60));
        LocalDate from = LocalDate.now().withDayOfMonth(1).minusMonths(window - 1L);
        return expenses.totalsByMonth(userId, from).stream()
                .map(m -> new MonthlyPoint(m.getMonth(), m.getTotal()))
                .toList();
    }

    private static BigDecimal percentage(BigDecimal part, BigDecimal whole) {
        if (whole.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 1, RoundingMode.HALF_UP);
    }
}

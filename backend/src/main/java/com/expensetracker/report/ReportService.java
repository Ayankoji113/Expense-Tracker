package com.expensetracker.report;

import com.expensetracker.expense.Expense.Kind;
import com.expensetracker.expense.ExpenseRepository;
import com.expensetracker.report.ReportController.CategorySlice;
import com.expensetracker.report.ReportController.DailyPoint;
import com.expensetracker.report.ReportController.MonthlyPoint;
import com.expensetracker.report.ReportController.Summary;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ReportService {

    static final LocalDate EPOCH = LocalDate.of(1970, 1, 1);

    private final ExpenseRepository expenses;

    public ReportService(ExpenseRepository expenses) {
        this.expenses = expenses;
    }

    public Summary summary(Long userId, LocalDate from, LocalDate to) {
        LocalDate start = from == null ? EPOCH : from;
        LocalDate end = to == null ? LocalDate.now() : to;

        BigDecimal income = expenses.totalBetween(userId, Kind.INCOME, start, end);
        BigDecimal expense = expenses.totalBetween(userId, Kind.EXPENSE, start, end);
        long expenseCount = expenses.countBetween(userId, Kind.EXPENSE, start, end);
        long incomeCount = expenses.countBetween(userId, Kind.INCOME, start, end);

        BigDecimal averageExpense = expenseCount == 0 ? BigDecimal.ZERO
                : expense.divide(BigDecimal.valueOf(expenseCount), 2, RoundingMode.HALF_UP);
        long days = Math.max(1, ChronoUnit.DAYS.between(start, end) + 1);
        BigDecimal averageDaily = start.equals(EPOCH) ? averageExpense
                : expense.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);

        String topCategory = expenses.totalsByCategory(userId, Kind.EXPENSE, start, end).stream().findFirst()
                .map(CategoryTotal::category).orElse(null);

        BigDecimal previousIncome = null;
        BigDecimal previousExpense = null;
        if (!start.equals(EPOCH)) {
            LocalDate[] previous = previousPeriod(start, end);
            previousIncome = expenses.totalBetween(userId, Kind.INCOME, previous[0], previous[1]);
            previousExpense = expenses.totalBetween(userId, Kind.EXPENSE, previous[0], previous[1]);
        }

        return new Summary(income, expense, income.subtract(expense), savingsRate(income, expense),
                expenseCount + incomeCount, averageExpense, averageDaily,
                expenses.largestBetween(userId, Kind.EXPENSE, start, end), topCategory,
                changePercent(income, previousIncome), changePercent(expense, previousExpense), start, end);
    }

    public List<CategorySlice> byCategory(Long userId, LocalDate from, LocalDate to) {
        LocalDate start = from == null ? EPOCH : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        List<CategoryTotal> totals = expenses.totalsByCategory(userId, Kind.EXPENSE, start, end);
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
                .map(m -> new MonthlyPoint(m.getMonth(), m.getIncome(), m.getExpense()))
                .toList();
    }

    public List<DailyPoint> daily(Long userId, LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(29) : from;
        return expenses.totalsByDay(userId, start, end).stream()
                .map(d -> new DailyPoint(d.getDay(), d.getExpense()))
                .toList();
    }


    /**
     * A whole calendar month compares against the whole month before it - lengths differ, so an
     * equal-length window would silently drop a day. Any other range compares against the equally
     * long window immediately before it.
     */
    static LocalDate[] previousPeriod(LocalDate start, LocalDate end) {
        YearMonth month = YearMonth.from(start);
        if (start.equals(month.atDay(1)) && end.equals(month.atEndOfMonth())) {
            YearMonth previous = month.minusMonths(1);
            return new LocalDate[] { previous.atDay(1), previous.atEndOfMonth() };
        }
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        LocalDate previousEnd = start.minusDays(1);
        return new LocalDate[] { previousEnd.minusDays(days - 1), previousEnd };
    }

    /** Share of income that was not spent. Meaningless without income, so null then. */
    private static BigDecimal savingsRate(BigDecimal income, BigDecimal expense) {
        if (income.signum() == 0) {
            return null;
        }
        return income.subtract(expense).multiply(BigDecimal.valueOf(100)).divide(income, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal changePercent(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.signum() == 0) {
            return null;
        }
        return current.subtract(previous).multiply(BigDecimal.valueOf(100)).divide(previous, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal percentage(BigDecimal part, BigDecimal whole) {
        if (whole.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 1, RoundingMode.HALF_UP);
    }
}

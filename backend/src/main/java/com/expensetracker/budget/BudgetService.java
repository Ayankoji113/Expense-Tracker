package com.expensetracker.budget;

import com.expensetracker.budget.BudgetController.BudgetDto;
import com.expensetracker.budget.BudgetController.BudgetRequest;
import com.expensetracker.category.Category;
import com.expensetracker.category.CategoryRepository;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.expense.ExpenseRepository;
import com.expensetracker.report.CategorySpend;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetService {

    private final BudgetRepository budgets;
    private final CategoryRepository categories;
    private final ExpenseRepository expenses;

    public BudgetService(BudgetRepository budgets, CategoryRepository categories, ExpenseRepository expenses) {
        this.budgets = budgets;
        this.categories = categories;
        this.expenses = expenses;
    }

    @Transactional(readOnly = true)
    public List<BudgetDto> list(Long userId, YearMonth month) {
        Map<Long, Category> categoriesById = categoriesById(userId);
        Map<Long, BigDecimal> spentByCategory = new HashMap<>();
        for (CategorySpend spend : expenses.spendByCategoryId(userId, month.atDay(1), month.atEndOfMonth())) {
            spentByCategory.put(spend.categoryId(), spend.total());
        }
        return budgets.findByUserId(userId).stream()
                .map(budget -> toDto(budget, categoriesById,
                        spentByCategory.getOrDefault(budget.getCategoryId(), BigDecimal.ZERO)))
                .sorted((a, b) -> b.usedPercent().compareTo(a.usedPercent()))
                .toList();
    }

    @Transactional
    public BudgetDto create(Long userId, BudgetRequest request) {
        if (budgets.existsByUserIdAndCategoryId(userId, request.categoryId())) {
            throw new BadRequestException("That category already has a budget");
        }
        requireVisibleCategory(userId, request.categoryId());
        Budget saved = budgets.save(new Budget(userId, request.categoryId(), request.monthlyLimit()));
        return list(userId, YearMonth.now()).stream()
                .filter(dto -> dto.id().equals(saved.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("budget vanished after save"));
    }

    @Transactional
    public BudgetDto update(Long userId, Long id, BudgetRequest request) {
        Budget budget = budgets.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Budget not found"));
        requireVisibleCategory(userId, request.categoryId());
        budget.update(request.categoryId(), request.monthlyLimit());
        budgets.save(budget);
        return list(userId, YearMonth.now()).stream()
                .filter(dto -> dto.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("budget vanished after update"));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Budget budget = budgets.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Budget not found"));
        budgets.delete(budget);
    }

    private void requireVisibleCategory(Long userId, Long categoryId) {
        categories.findVisibleTo(categoryId, userId)
                .orElseThrow(() -> new BadRequestException("Unknown category " + categoryId));
    }

    private Map<Long, Category> categoriesById(Long userId) {
        return categories.findVisibleTo(userId).stream()
                .collect(Collectors.toMap(Category::getId, Function.identity()));
    }

    private static BudgetDto toDto(Budget budget, Map<Long, Category> categoriesById, BigDecimal spent) {
        Category category = categoriesById.get(budget.getCategoryId());
        BigDecimal used = budget.getMonthlyLimit().signum() == 0 ? BigDecimal.ZERO
                : spent.multiply(BigDecimal.valueOf(100))
                        .divide(budget.getMonthlyLimit(), 1, RoundingMode.HALF_UP);
        return new BudgetDto(budget.getId(), budget.getCategoryId(),
                category == null ? "Unknown" : category.getName(),
                category == null ? "#64748B" : category.getColor(),
                budget.getMonthlyLimit(), spent, budget.getMonthlyLimit().subtract(spent), used);
    }
}

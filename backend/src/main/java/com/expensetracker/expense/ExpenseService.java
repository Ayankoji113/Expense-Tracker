package com.expensetracker.expense;

import com.expensetracker.category.Category;
import com.expensetracker.category.CategoryRepository;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.common.NotFoundException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpenseService {

    private static final LocalDate EPOCH = LocalDate.of(1970, 1, 1);

    private final ExpenseRepository expenses;
    private final CategoryRepository categories;

    public ExpenseService(ExpenseRepository expenses, CategoryRepository categories) {
        this.expenses = expenses;
        this.categories = categories;
    }

    @Transactional(readOnly = true)
    public Page<ExpenseDto> search(Long userId, LocalDate from, LocalDate to, Expense.Kind kind, Long categoryId,
            String q, Pageable pageable) {
        var kinds = kind == null ? java.util.List.of(Expense.Kind.values()) : java.util.List.of(kind);
        Page<Expense> page = expenses.search(userId, from == null ? EPOCH : from, to == null ? LocalDate.now() : to,
                kinds, categoryId, likePattern(q), pageable);
        Map<Long, Category> byId = categoriesById(userId);
        return page.map(e -> toDto(e, byId));
    }

    @Transactional
    public ExpenseDto create(Long userId, ExpenseRequest req) {
        Long categoryId = resolveCategory(userId, req.categoryId());
        Expense saved = expenses.save(new Expense(userId, categoryId, req.amount(), req.spentOn(),
                req.description().trim(), Expense.Source.MANUAL, req.kindOrDefault()));
        return toDto(saved, categoriesById(userId));
    }

    @Transactional
    public ExpenseDto update(Long userId, Long id, ExpenseRequest req) {
        Expense expense = expenses.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Expense not found"));
        expense.update(resolveCategory(userId, req.categoryId()), req.amount(), req.spentOn(),
                req.description().trim(), req.kindOrDefault());
        return toDto(expenses.save(expense), categoriesById(userId));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Expense expense = expenses.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Expense not found"));
        expenses.delete(expense);
    }

    @Transactional(readOnly = true)
    public ExpenseDto get(Long userId, Long id) {
        return expenses.findByIdAndUserId(id, userId)
                .map(e -> toDto(e, categoriesById(userId)))
                .orElseThrow(() -> new NotFoundException("Expense not found"));
    }

    private Long resolveCategory(Long userId, Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        return categories.findVisibleTo(categoryId, userId)
                .map(Category::getId)
                .orElseThrow(() -> new BadRequestException("Unknown category " + categoryId));
    }

    private Map<Long, Category> categoriesById(Long userId) {
        return categories.findVisibleTo(userId).stream().collect(Collectors.toMap(Category::getId,
                Function.identity()));
    }

    static ExpenseDto toDto(Expense e, Map<Long, Category> categoriesById) {
        Category c = e.getCategoryId() == null ? null : categoriesById.get(e.getCategoryId());
        return new ExpenseDto(e.getId(), e.getAmount(), e.getSpentOn(), e.getDescription(), e.getCategoryId(),
                c == null ? "Uncategorized" : c.getName(), c == null ? "#64748B" : c.getColor(),
                e.getSource().name(), e.getKind().name());
    }

    static List<ExpenseDto> toDtos(List<Expense> list, Map<Long, Category> categoriesById) {
        return list.stream().map(e -> toDto(e, categoriesById)).toList();
    }

    private static String likePattern(String q) {
        return q == null || q.isBlank() ? "%" : "%" + q.trim() + "%";
    }
}

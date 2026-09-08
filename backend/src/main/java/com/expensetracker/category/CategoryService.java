package com.expensetracker.category;

import com.expensetracker.category.CategoryController.CategoryDto;
import com.expensetracker.category.CategoryController.CategoryRequest;
import com.expensetracker.category.CategoryController.RuleDto;
import com.expensetracker.category.CategoryController.RuleRequest;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.common.NotFoundException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {

    private final CategoryRepository categories;
    private final CategoryRuleRepository rules;

    public CategoryService(CategoryRepository categories, CategoryRuleRepository rules) {
        this.categories = categories;
        this.rules = rules;
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> list(Long userId) {
        return categories.findVisibleTo(userId).stream().map(CategoryService::toDto).toList();
    }

    @Transactional
    public CategoryDto create(Long userId, CategoryRequest request) {
        String name = request.name().trim();
        boolean taken = categories.findVisibleTo(userId).stream().anyMatch(c -> c.getName().equalsIgnoreCase(name));
        if (taken) {
            throw new BadRequestException("Category " + name + " already exists");
        }
        String color = request.color() == null ? "#888888" : request.color();
        return toDto(categories.save(new Category(userId, name, color)));
    }

    /** Built-in categories belong to everyone, so only the user's own are deletable. */
    @Transactional
    public void delete(Long userId, Long id) {
        Category category = categories.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Category not found"));
        categories.delete(category);
    }

    @Transactional(readOnly = true)
    public List<RuleDto> rules(Long userId) {
        Map<Long, Category> byId = categories.findVisibleTo(userId).stream()
                .collect(Collectors.toMap(Category::getId, c -> c));
        return rules.findByUserId(userId).stream()
                .map(r -> new RuleDto(r.getId(), r.getKeyword(), r.getCategoryId(),
                        byId.containsKey(r.getCategoryId()) ? byId.get(r.getCategoryId()).getName() : "?"))
                .toList();
    }

    @Transactional
    public RuleDto createRule(Long userId, RuleRequest request) {
        String keyword = request.keyword().trim();
        if (rules.existsByUserIdAndKeywordIgnoreCase(userId, keyword)) {
            throw new BadRequestException("Rule for " + keyword + " already exists");
        }
        Category category = categories.findVisibleTo(request.categoryId(), userId)
                .orElseThrow(() -> new BadRequestException("Unknown category " + request.categoryId()));
        CategoryRule saved = rules.save(new CategoryRule(userId, keyword, category.getId()));
        return new RuleDto(saved.getId(), saved.getKeyword(), category.getId(), category.getName());
    }

    @Transactional
    public void deleteRule(Long userId, Long id) {
        CategoryRule rule = rules.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Rule not found"));
        rules.delete(rule);
    }

    private static CategoryDto toDto(Category c) {
        return new CategoryDto(c.getId(), c.getName(), c.getColor(), c.getUserId() == null);
    }
}

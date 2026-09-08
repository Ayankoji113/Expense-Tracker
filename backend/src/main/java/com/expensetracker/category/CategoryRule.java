package com.expensetracker.category;

import jakarta.persistence.*;

/** "starbucks" -> Dining. Drives auto-categorization on CSV import. */
@Entity
@Table(name = "category_rules")
public class CategoryRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String keyword;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    protected CategoryRule() {
    }

    public CategoryRule(Long userId, String keyword, Long categoryId) {
        this.userId = userId;
        this.keyword = keyword;
        this.categoryId = categoryId;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getKeyword() {
        return keyword;
    }

    public Long getCategoryId() {
        return categoryId;
    }
}

package com.expensetracker.budget;

import jakarta.persistence.*;
import java.math.BigDecimal;

/** A monthly spending limit for one category. */
@Entity
@Table(name = "budgets")
public class Budget {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "monthly_limit", nullable = false)
    private BigDecimal monthlyLimit;

    protected Budget() {
    }

    public Budget(Long userId, Long categoryId, BigDecimal monthlyLimit) {
        this.userId = userId;
        this.categoryId = categoryId;
        this.monthlyLimit = monthlyLimit;
    }

    public void update(Long categoryId, BigDecimal monthlyLimit) {
        this.categoryId = categoryId;
        this.monthlyLimit = monthlyLimit;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public BigDecimal getMonthlyLimit() {
        return monthlyLimit;
    }
}

package com.expensetracker.expense;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
public class Expense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "spent_on", nullable = false)
    private LocalDate spentOn;

    @Column(nullable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Source source;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public enum Source {
        MANUAL, CSV
    }

    protected Expense() {
    }

    public Expense(Long userId, Long categoryId, BigDecimal amount, LocalDate spentOn, String description,
            Source source) {
        this.userId = userId;
        this.categoryId = categoryId;
        this.amount = amount;
        this.spentOn = spentOn;
        this.description = description;
        this.source = source;
    }

    public void update(Long categoryId, BigDecimal amount, LocalDate spentOn, String description) {
        this.categoryId = categoryId;
        this.amount = amount;
        this.spentOn = spentOn;
        this.description = description;
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

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDate getSpentOn() {
        return spentOn;
    }

    public String getDescription() {
        return description;
    }

    public Source getSource() {
        return source;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

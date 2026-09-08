package com.expensetracker.category;

import jakarta.persistence.*;

@Entity
@Table(name = "categories")
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** null = built-in category, visible to every user. */
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    protected Category() {
    }

    public Category(Long userId, String name, String color) {
        this.userId = userId;
        this.name = name;
        this.color = color;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getColor() {
        return color;
    }

    public void rename(String name, String color) {
        this.name = name;
        this.color = color;
    }
}

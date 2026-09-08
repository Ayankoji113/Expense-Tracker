package com.expensetracker.category;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, Long> {
    List<CategoryRule> findByUserId(Long userId);

    Optional<CategoryRule> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndKeywordIgnoreCase(Long userId, String keyword);
}

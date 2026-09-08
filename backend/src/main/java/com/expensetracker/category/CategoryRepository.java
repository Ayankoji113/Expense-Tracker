package com.expensetracker.category;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    /** Built-in categories plus the ones this user created. */
    @Query("select c from Category c where c.userId is null or c.userId = :userId order by c.name")
    List<Category> findVisibleTo(@Param("userId") Long userId);

    @Query("select c from Category c where c.id = :id and (c.userId is null or c.userId = :userId)")
    Optional<Category> findVisibleTo(@Param("id") Long id, @Param("userId") Long userId);

    @Query("select c from Category c where lower(c.name) = lower(:name) and c.userId is null")
    Optional<Category> findBuiltIn(@Param("name") String name);

    Optional<Category> findByIdAndUserId(Long id, Long userId);
}

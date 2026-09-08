package com.expensetracker.expense;

import com.expensetracker.report.CategorySpend;
import com.expensetracker.report.CategoryTotal;
import com.expensetracker.report.DailyTotal;
import com.expensetracker.report.MonthlyTotal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    /** Every read is scoped by userId - ids from the request are never trusted on their own. */
    Optional<Expense> findByIdAndUserId(Long id, Long userId);

    /**
     * Optional filters are resolved to real values by the service - passing nulls straight into the
     * query makes Postgres infer bytea for the untyped parameters and blow up on lower().
     */
    @Query("""
            select e from Expense e
            where e.userId = :userId
              and e.spentOn between :from and :to
              and e.kind in :kinds
              and (:categoryId is null or e.categoryId = :categoryId)
              and lower(e.description) like lower(:q)
            """)
    Page<Expense> search(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to,
            @Param("kinds") Collection<Expense.Kind> kinds, @Param("categoryId") Long categoryId,
            @Param("q") String q, Pageable pageable);

    boolean existsByUserIdAndSpentOnAndAmountAndDescriptionIgnoreCase(Long userId, LocalDate spentOn, BigDecimal amount,
            String description);

    @Query("""
            select coalesce(sum(e.amount), 0) from Expense e
            where e.userId = :userId and e.kind = :kind and e.spentOn between :from and :to
            """)
    BigDecimal totalBetween(@Param("userId") Long userId, @Param("kind") Expense.Kind kind,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select count(e) from Expense e
            where e.userId = :userId and e.kind = :kind and e.spentOn between :from and :to
            """)
    long countBetween(@Param("userId") Long userId, @Param("kind") Expense.Kind kind, @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("""
            select coalesce(max(e.amount), 0) from Expense e
            where e.userId = :userId and e.kind = :kind and e.spentOn between :from and :to
            """)
    BigDecimal largestBetween(@Param("userId") Long userId, @Param("kind") Expense.Kind kind,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select new com.expensetracker.report.CategoryTotal(
                     coalesce(c.name, 'Uncategorized'), coalesce(c.color, '#64748B'), sum(e.amount), count(e))
            from Expense e left join Category c on c.id = e.categoryId
            where e.userId = :userId and e.kind = :kind and e.spentOn between :from and :to
            group by c.name, c.color
            order by sum(e.amount) desc
            """)
    List<CategoryTotal> totalsByCategory(@Param("userId") Long userId, @Param("kind") Expense.Kind kind,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Spend per category id, for matching budgets to what has actually been spent. */
    @Query("""
            select new com.expensetracker.report.CategorySpend(e.categoryId, sum(e.amount))
            from Expense e
            where e.userId = :userId and e.kind = com.expensetracker.expense.Expense$Kind.EXPENSE
              and e.categoryId is not null and e.spentOn between :from and :to
            group by e.categoryId
            """)
    List<CategorySpend> spendByCategoryId(@Param("userId") Long userId, @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
            select to_char(date_trunc('month', spent_on), 'YYYY-MM')          as month,
                   coalesce(sum(amount) filter (where kind = 'INCOME'), 0)    as income,
                   coalesce(sum(amount) filter (where kind = 'EXPENSE'), 0)   as expense
            from expenses
            where user_id = :userId and spent_on >= :from
            group by 1
            order by 1
            """, nativeQuery = true)
    List<MonthlyTotal> totalsByMonth(@Param("userId") Long userId, @Param("from") LocalDate from);

    @Query(value = """
            select to_char(spent_on, 'YYYY-MM-DD')                            as day,
                   coalesce(sum(amount) filter (where kind = 'EXPENSE'), 0)   as expense
            from expenses
            where user_id = :userId and spent_on between :from and :to
            group by 1
            order by 1
            """, nativeQuery = true)
    List<DailyTotal> totalsByDay(@Param("userId") Long userId, @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}

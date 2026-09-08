package com.expensetracker.auth;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, Long> {

    Optional<PasswordResetCode> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);

    /** Requesting a new code, or finishing a reset, retires everything older. */
    @Modifying
    @Query("update PasswordResetCode c set c.usedAt = :now where c.userId = :userId and c.usedAt is null")
    void retireAllFor(@Param("userId") Long userId, @Param("now") Instant now);
}

package com.expensetracker.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ReportServiceTest {

    @Test
    void aWholeMonthComparesWithTheWholeMonthBefore() {
        LocalDate[] previous = ReportService.previousPeriod(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));

        // August has 31 days, so an equal-length window would have missed 1 August
        assertThat(previous).containsExactly(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));
    }

    @Test
    void anyOtherRangeComparesWithTheEquallyLongWindowBeforeIt() {
        LocalDate[] previous = ReportService.previousPeriod(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 16));

        assertThat(previous).containsExactly(LocalDate.of(2026, 9, 3), LocalDate.of(2026, 9, 9));
    }
}

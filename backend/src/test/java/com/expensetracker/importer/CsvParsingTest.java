package com.expensetracker.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class CsvParsingTest {

    @Test
    void parsesTheDateFormatsBanksActuallyExport() {
        assertThat(CsvImportService.parseDate("2026-08-01")).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(CsvImportService.parseDate("01/08/2026")).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(CsvImportService.parseDate(" 01-08-2026 ")).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(CsvImportService.parseDate("1 Aug 2026")).isEqualTo(LocalDate.of(2026, 8, 1));
    }

    @Test
    void rejectsUnparseableDates() {
        assertThatThrownBy(() -> CsvImportService.parseDate("2026-13-45"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unrecognised date");
    }

    @Test
    void normalisesAmountsToTwoPositiveDecimals() {
        assertThat(CsvImportService.parseAmount("12.5")).isEqualByComparingTo("12.50");
        assertThat(CsvImportService.parseAmount("$1,234.56")).isEqualByComparingTo("1234.56");
        assertThat(CsvImportService.parseAmount("(1,234.56)")).isEqualByComparingTo("1234.56");
        assertThat(CsvImportService.parseAmount("-42.00")).isEqualByComparingTo("42.00");
    }

    @Test
    void rejectsAmountsThatAreNotMoney() {
        assertThatThrownBy(() -> CsvImportService.parseAmount("abc")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CsvImportService.parseAmount("0.00")).hasMessageContaining("zero");
    }

    @Test
    void longestMatchingKeywordWins() {
        var rules = new CsvImportService.Rules(java.util.Map.of("uber", 1L, "uber eats", 2L));
        assertThat(rules.categoryFor("UBER EATS ORDER 55", 9L)).isEqualTo(2L);
        assertThat(rules.categoryFor("UBER TRIP 4821", 9L)).isEqualTo(1L);
        assertThat(rules.categoryFor("SOMETHING ELSE", 9L)).isEqualTo(9L);
    }

    @Test
    void headerMappingIsOrderIndependentAndReportsWhatItIgnored() {
        var ignored = new java.util.ArrayList<String>();
        var columns = CsvImportService.Columns.from(new String[] { "Amount", "Balance", "Date", "Memo" }, ignored);

        assertThat(columns).isEqualTo(new CsvImportService.Columns(2, 3, 0));
        assertThat(ignored).containsExactly("Balance");
    }

    @Test
    void missingColumnsAreNamedInTheError() {
        assertThatThrownBy(() -> CsvImportService.Columns.from(new String[] { "Foo", "Bar" }, new java.util.ArrayList<>()))
                .hasMessageContaining("date")
                .hasMessageContaining("description")
                .hasMessageContaining("amount");
    }

    @Test
    void aBigDecimalAmountKeepsItsScale() {
        assertThat(CsvImportService.parseAmount("1.005")).isEqualTo(new BigDecimal("1.01"));
    }
}

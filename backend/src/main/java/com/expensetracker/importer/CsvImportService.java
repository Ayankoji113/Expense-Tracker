package com.expensetracker.importer;

import com.expensetracker.category.CategoryRepository;
import com.expensetracker.category.CategoryRuleRepository;
import com.expensetracker.common.BadRequestException;
import com.expensetracker.expense.Expense;
import com.expensetracker.expense.ExpenseRepository;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Imports a bank CSV. Every valid row is imported and every bad row is reported - one malformed row
 * does not sink the file.
 */
@Service
public class CsvImportService {

    private static final Set<String> DATE_HEADERS = Set.of("date", "transaction date", "spent_on", "posted date");
    private static final Set<String> DESC_HEADERS = Set.of("description", "details", "memo", "narrative", "payee");
    private static final Set<String> AMOUNT_HEADERS = Set.of("amount", "value", "debit", "spend");

    // Formats seen in real exports; first one that parses wins.
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH));

    private static final int MAX_ROWS = 10_000;

    private final ExpenseRepository expenses;
    private final CategoryRepository categories;
    private final CategoryRuleRepository rules;

    public CsvImportService(ExpenseRepository expenses, CategoryRepository categories, CategoryRuleRepository rules) {
        this.expenses = expenses;
        this.categories = categories;
        this.rules = rules;
    }

    @Transactional
    public ImportSummary importCsv(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file uploaded");
        }
        List<ImportSummary.RowError> errors = new ArrayList<>();
        List<String> ignoredColumns = new ArrayList<>();
        int imported = 0;
        int duplicates = 0;

        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] header = reader.readNext();
            if (header == null) {
                throw new BadRequestException("File is empty");
            }
            Columns columns = Columns.from(header, ignoredColumns);
            Rules keywordRules = rulesFor(userId);
            Long fallback = categories.findBuiltIn("Uncategorized").map(c -> c.getId()).orElse(null);

            String[] row;
            int lineNumber = 1;
            while ((row = reader.readNext()) != null) {
                lineNumber++;
                if (lineNumber - 1 > MAX_ROWS) {
                    throw new BadRequestException("File has more than " + MAX_ROWS + " rows");
                }
                if (isBlank(row)) {
                    continue;
                }
                try {
                    LocalDate date = parseDate(columns.value(row, columns.date()));
                    BigDecimal amount = parseAmount(columns.value(row, columns.amount()));
                    String description = columns.value(row, columns.description()).trim();
                    if (description.isEmpty()) {
                        throw new IllegalArgumentException("description is empty");
                    }
                    if (expenses.existsByUserIdAndSpentOnAndAmountAndDescriptionIgnoreCase(userId, date, amount,
                            description)) {
                        duplicates++;
                        continue;
                    }
                    Long categoryId = keywordRules.categoryFor(description, fallback);
                    expenses.save(new Expense(userId, categoryId, amount, date, description, Expense.Source.CSV,
                            Expense.Kind.EXPENSE));
                    imported++;
                } catch (IllegalArgumentException e) {
                    errors.add(new ImportSummary.RowError(lineNumber, e.getMessage()));
                }
            }
        } catch (IOException | CsvValidationException e) {
            throw new BadRequestException("Could not read CSV: " + e.getMessage());
        }
        return new ImportSummary(imported, duplicates, errors.size(), errors, ignoredColumns);
    }

    private Rules rulesFor(Long userId) {
        Map<String, Long> byKeyword = new LinkedHashMap<>();
        rules.findByUserId(userId).forEach(r -> byKeyword.put(r.getKeyword().toLowerCase(Locale.ROOT),
                r.getCategoryId()));
        return new Rules(byKeyword);
    }

    static LocalDate parseDate(String raw) {
        String value = raw.trim();
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(value, format);
            } catch (RuntimeException ignored) {
                // try the next format
            }
        }
        throw new IllegalArgumentException("unrecognised date '" + value + "'");
    }

    /** Accepts 12.34, "1,234.56", currency-prefixed and (12.34)/-12.34 debit forms. */
    static BigDecimal parseAmount(String raw) {
        String value = raw.trim().replaceAll("[\\s,$\\u00A3\\u20AC]", "");
        if (value.startsWith("(") && value.endsWith(")")) {
            value = value.substring(1, value.length() - 1);
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("unrecognised amount '" + raw.trim() + "'");
        }
        amount = amount.abs().setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() == 0) {
            throw new IllegalArgumentException("amount is zero");
        }
        return amount;
    }

    private static boolean isBlank(String[] row) {
        for (String cell : row) {
            if (cell != null && !cell.isBlank()) {
                return false;
            }
        }
        return true;
    }

    /** Header-name to column-index mapping; unknown columns are reported back, never guessed at. */
    record Columns(int date, int description, int amount) {

        static Columns from(String[] header, List<String> ignoredColumns) {
            int date = -1;
            int description = -1;
            int amount = -1;
            for (int i = 0; i < header.length; i++) {
                String name = header[i].replace("\uFEFF", "").trim().toLowerCase(Locale.ROOT);
                if (date < 0 && DATE_HEADERS.contains(name)) {
                    date = i;
                } else if (description < 0 && DESC_HEADERS.contains(name)) {
                    description = i;
                } else if (amount < 0 && AMOUNT_HEADERS.contains(name)) {
                    amount = i;
                } else if (!name.isEmpty()) {
                    ignoredColumns.add(header[i].trim());
                }
            }
            List<String> missing = new ArrayList<>();
            if (date < 0) {
                missing.add("date");
            }
            if (description < 0) {
                missing.add("description");
            }
            if (amount < 0) {
                missing.add("amount");
            }
            if (!missing.isEmpty()) {
                throw new BadRequestException("CSV is missing required column(s): " + String.join(", ", missing));
            }
            return new Columns(date, description, amount);
        }

        String value(String[] row, int index) {
            if (index >= row.length || row[index] == null) {
                throw new IllegalArgumentException("row has fewer columns than the header");
            }
            return row[index];
        }
    }

    /** Longest matching keyword wins, so "whole foods" beats "food". */
    record Rules(Map<String, Long> byKeyword) {
        // ponytail: keyword contains-match; swap for a scoring/ML classifier only if rules stop being enough
        Long categoryFor(String description, Long fallback) {
            String haystack = description.toLowerCase(Locale.ROOT);
            String best = null;
            for (String keyword : byKeyword.keySet()) {
                if (haystack.contains(keyword) && (best == null || keyword.length() > best.length())) {
                    best = keyword;
                }
            }
            return best == null ? fallback : byKeyword.get(best);
        }
    }
}

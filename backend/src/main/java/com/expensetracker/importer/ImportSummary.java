package com.expensetracker.importer;

import java.util.List;

public record ImportSummary(int imported, int duplicates, int failed, List<RowError> rowErrors,
        List<String> ignoredColumns) {

    public record RowError(int row, String message) {
    }
}

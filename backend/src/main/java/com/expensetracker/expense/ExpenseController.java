package com.expensetracker.expense;

import com.expensetracker.importer.CsvImportService;
import com.expensetracker.importer.ImportSummary;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService service;
    private final CsvImportService importer;

    public ExpenseController(ExpenseService service, CsvImportService importer) {
        this.service = service;
        this.importer = importer;
    }

    @GetMapping
    Page<ExpenseDto> list(@AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 25, sort = "spentOn", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.search(userId, from, to, categoryId, q, pageable);
    }

    @GetMapping("/{id}")
    ExpenseDto get(@AuthenticationPrincipal Long userId, @PathVariable Long id) {
        return service.get(userId, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ExpenseDto create(@AuthenticationPrincipal Long userId, @Valid @RequestBody ExpenseRequest request) {
        return service.create(userId, request);
    }

    @PutMapping("/{id}")
    ExpenseDto update(@AuthenticationPrincipal Long userId, @PathVariable Long id,
            @Valid @RequestBody ExpenseRequest request) {
        return service.update(userId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long userId, @PathVariable Long id) {
        service.delete(userId, id);
    }

    @PostMapping("/import")
    ImportSummary importCsv(@AuthenticationPrincipal Long userId, @RequestParam("file") MultipartFile file) {
        return importer.importCsv(userId, file);
    }
}

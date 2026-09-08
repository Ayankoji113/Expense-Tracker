package com.expensetracker.category;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    @GetMapping
    List<CategoryDto> list(@AuthenticationPrincipal Long userId) {
        return service.list(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    CategoryDto create(@AuthenticationPrincipal Long userId, @Valid @RequestBody CategoryRequest request) {
        return service.create(userId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long userId, @PathVariable Long id) {
        service.delete(userId, id);
    }

    @GetMapping("/rules")
    List<RuleDto> rules(@AuthenticationPrincipal Long userId) {
        return service.rules(userId);
    }

    @PostMapping("/rules")
    @ResponseStatus(HttpStatus.CREATED)
    RuleDto createRule(@AuthenticationPrincipal Long userId, @Valid @RequestBody RuleRequest request) {
        return service.createRule(userId, request);
    }

    @DeleteMapping("/rules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRule(@AuthenticationPrincipal Long userId, @PathVariable Long id) {
        service.deleteRule(userId, id);
    }

    public record CategoryDto(Long id, String name, String color, boolean builtIn) {
    }

    public record CategoryRequest(
            @NotBlank @Size(max = 60) String name,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "must be a hex colour like #1565c0") String color) {
    }

    public record RuleDto(Long id, String keyword, Long categoryId, String categoryName) {
    }

    public record RuleRequest(@NotBlank @Size(max = 60) String keyword, @NotNull Long categoryId) {
    }
}

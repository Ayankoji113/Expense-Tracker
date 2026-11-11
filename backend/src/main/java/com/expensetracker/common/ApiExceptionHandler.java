package com.expensetracker.common;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.core.PropertyReferenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<Map<String, Object>> notFound(NotFoundException ex, HttpServletRequest req) {
        return body(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(BadRequestException.class)
    ResponseEntity<Map<String, Object>> badRequest(BadRequestException ex, HttpServletRequest req) {
        return body(HttpStatus.BAD_REQUEST, ex.getMessage(), req);
    }

    @ExceptionHandler(TooManyRequestsException.class)
    ResponseEntity<Map<String, Object>> tooManyRequests(TooManyRequestsException ex, HttpServletRequest req) {
        return body(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage(), req);
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<Map<String, Object>> badCredentials(BadCredentialsException ex, HttpServletRequest req) {
        return body(HttpStatus.UNAUTHORIZED, ex.getMessage(), req);
    }

    /**
     * A unique index caught something the service's own check missed, usually two requests racing.
     * The constraint name stays in the log, not in the response.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> conflict(DataIntegrityViolationException ex, HttpServletRequest req) {
        log.warn("Constraint violation on {}: {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return body(HttpStatus.CONFLICT, "That conflicts with something that already exists", req);
    }

    /** ?sort=notAField */
    @ExceptionHandler(PropertyReferenceException.class)
    ResponseEntity<Map<String, Object>> badSort(PropertyReferenceException ex, HttpServletRequest req) {
        return body(HttpStatus.BAD_REQUEST, "Cannot sort by " + ex.getPropertyName(), req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return body(HttpStatus.BAD_REQUEST, message, req);
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, String message, HttpServletRequest req) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("timestamp", Instant.now().toString());
        out.put("status", status.value());
        out.put("error", status.getReasonPhrase());
        out.put("message", message);
        out.put("path", req.getRequestURI());
        return ResponseEntity.status(status).body(out);
    }
}

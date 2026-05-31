package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PaymentLogRequest;
import dev.tjj.easi.dto.PaymentLogResponse;
import dev.tjj.easi.service.PaymentLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for recording and managing payments against service reports.
 * ADMIN and ACCOUNTING can add, update, and delete payment logs.
 * ADMIN, ACCOUNTING, and STAFF can view payment logs.
 */
@Tag(name = "Payment Logs", description = "Track payments received per service report")
@RestController
@RequestMapping("/api/payment-logs")
public class PaymentLogController {

    private final PaymentLogService paymentLogService;

    public PaymentLogController(PaymentLogService paymentLogService) {
        this.paymentLogService = paymentLogService;
    }

    /** Records a new payment against a service report. */
    @Operation(summary = "Create a payment log",
               description = "Records a payment entry for a service report. Each entry represents one receipt.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Payment log created"),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Service report not found")
    })
    @PostMapping
    public ResponseEntity<PaymentLogResponse> add(@Valid @RequestBody PaymentLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(paymentLogService.add(request));
    }

    /** Updates an existing payment log entry by ID. */
    @Operation(summary = "Update a payment log",
               description = "Updates all fields of an existing payment log entry.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Payment log updated"),
        @ApiResponse(responseCode = "400", description = "Validation failed"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Payment log not found")
    })
    @PutMapping("/{logId}")
    public ResponseEntity<PaymentLogResponse> update(
            @Parameter(description = "Payment log ID", example = "1") @PathVariable Integer logId,
            @Valid @RequestBody PaymentLogRequest request) {
        return ResponseEntity.ok(paymentLogService.update(logId, request));
    }

    /** Deletes a payment log entry by ID. */
    @Operation(summary = "Delete a payment log",
               description = "Removes a payment log entry. The service report status is recomputed on next retrieval.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Payment log deleted"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Payment log not found")
    })
    @DeleteMapping("/{logId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Payment log ID", example = "1") @PathVariable Integer logId) {
        paymentLogService.delete(logId);
        return ResponseEntity.noContent().build();
    }

    /** Returns all payment logs for a service report, ordered by receipt date. */
    @Operation(summary = "List payment logs by service report",
               description = "Returns all payment log entries for a given SR number, sorted by receipt date ascending.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Payment logs returned"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    @GetMapping
    public ResponseEntity<List<PaymentLogResponse>> getBySrNumber(
            @Parameter(description = "Service report number", example = "1")
            @RequestParam Integer srNumber) {
        return ResponseEntity.ok(paymentLogService.getBySrNumber(srNumber));
    }

    /** Returns a single payment log by ID. */
    @Operation(summary = "Get payment log by ID",
               description = "Returns a single payment log entry by its ID.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Payment log found"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Payment log not found")
    })
    @GetMapping("/{logId}")
    public ResponseEntity<PaymentLogResponse> getById(
            @Parameter(description = "Payment log ID", example = "1") @PathVariable Integer logId) {
        return ResponseEntity.ok(paymentLogService.getById(logId));
    }
}

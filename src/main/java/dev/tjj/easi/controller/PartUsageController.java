package dev.tjj.easi.controller;

import dev.tjj.easi.dto.PartUsageRequest;
import dev.tjj.easi.dto.PartUsageResponse;
import dev.tjj.easi.dto.PartUsageUpdateRequest;
import dev.tjj.easi.service.PartUsageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoints for recording and managing part usage events.
 * ADMIN, ACCOUNTING, and STAFF can log and view usage; only ADMIN can delete records.
 */
@Tag(name = "Part Usages", description = "Record and manage part consumption events")
@RestController
@RequestMapping("/api/part-usages")
public class PartUsageController {

    private final PartUsageService partUsageService;

    public PartUsageController(PartUsageService partUsageService) {
        this.partUsageService = partUsageService;
    }

    @Operation(
            summary = "Log a part usage event",
            description = "Records that a quantity of a part was consumed. Optionally links the usage to a service report. Fails if the requested quantity exceeds the available stock."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Usage recorded successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed or quantity exceeds available stock"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Part or service report not found")
    })
    @PostMapping
    public ResponseEntity<PartUsageResponse> add(@Valid @RequestBody PartUsageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(partUsageService.add(request));
    }

    @Operation(
            summary = "Update a usage record",
            description = "Updates the SR link, quantity, and notes of an existing usage record. Validates that the new quantity does not exceed available stock (current record's qty is added back before checking)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Updated successfully"),
            @ApiResponse(responseCode = "400", description = "Validation failed or quantity exceeds available stock"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Usage record or service report not found")
    })
    @PutMapping("/{usageId}")
    public ResponseEntity<PartUsageResponse> update(
            @Parameter(description = "Usage record ID to update", example = "1")
            @PathVariable Integer usageId,
            @Valid @RequestBody PartUsageUpdateRequest request) {
        return ResponseEntity.ok(partUsageService.update(usageId, request));
    }

    @Operation(
            summary = "List usage records for a part",
            description = "Returns a paginated list of all usage events recorded for the given part, ordered by the repository default."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List returned successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Part not found")
    })
    @GetMapping
    public ResponseEntity<Page<PartUsageResponse>> getByPart(
            @Parameter(description = "ID of the part to list usage for", example = "3")
            @RequestParam Integer partId,
            Pageable pageable) {
        return ResponseEntity.ok(partUsageService.getByPart(partId, pageable));
    }

    @Operation(
            summary = "Delete a usage record",
            description = "Removes a part usage record by ID. This increases the available quantity of the associated part. Restricted to ADMIN."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Deleted successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated"),
            @ApiResponse(responseCode = "403", description = "Insufficient role"),
            @ApiResponse(responseCode = "404", description = "Usage record not found")
    })
    @DeleteMapping("/{usageId}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "Usage record ID to delete", example = "1")
            @PathVariable Integer usageId) {
        partUsageService.delete(usageId);
        return ResponseEntity.noContent().build();
    }
}

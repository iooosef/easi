package dev.tjj.easi.controller;

import dev.tjj.easi.dto.LogDto;
import dev.tjj.easi.entity.Log;
import dev.tjj.easi.service.LogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST endpoint for paginated log retrieval.
 * Restricted to ADMIN role.
 */
@Tag(name = "Logs", description = "Paginated audit log retrieval — ADMIN only")
@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogService logService;

    public LogController(LogService logService) {
        this.logService = logService;
    }

    /** Returns a paginated list of all log entries, defaulting to createdAt desc. */
    @Operation(
            summary = "Get paginated logs",
            description = "Returns all system log entries as a Spring Page. Defaults to 20 per page sorted by createdAt descending. Supports page, size, and sort query parameters."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Logs returned successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden — ADMIN role required")
    })
    @GetMapping
    public ResponseEntity<Page<LogDto>> getLogs(
            @Parameter(description = "Zero-based page index", example = "0")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "Page size", example = "20")
            @RequestParam(defaultValue = "20") int size,

            @Parameter(description = "Sort field", example = "createdAt")
            @RequestParam(defaultValue = "createdAt") String sort,

            @Parameter(description = "Sort direction (asc or desc)", example = "desc")
            @RequestParam(defaultValue = "desc") String direction
    ) {
        Sort.Direction dir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        PageRequest pageable = PageRequest.of(page, size, Sort.by(dir, sort));
        Page<Log> logs = logService.getAll(pageable);
        return ResponseEntity.ok(logs.map(this::toDto));
    }

    /** Maps a Log entity to a LogDto, resolving the user's email. */
    private LogDto toDto(Log log) {
        String userEmail = log.getUser() != null ? log.getUser().getEmail() : null;
        return new LogDto(
                log.getLogId(),
                userEmail,
                log.getActorIdentifier(),
                log.getLogType() != null ? log.getLogType().name() : null,
                log.getSeverity() != null ? log.getSeverity().name() : null,
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getDescription(),
                log.getIpAddress(),
                log.getCreatedAt()
        );
    }
}

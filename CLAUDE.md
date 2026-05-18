- add comment documentation on each class and method definition inside classes
  - brief and short, straightforward easy to understand comments
  - no comment documentation on the following:
    - entities
    - repositories
    - repository methods

Refer to [Role.java](src/main/java/dev/tjj/easi/entity/Role.java) when doing anything about roles or authorization. 

Add appropriate jakarta.validation for all DTO and ensure input are validated in controllers with @Valid

### endpoint documentation
document all REST endpoints using springdoc-openapi annotations from io.swagger.v3.oas.annotations

@Tag(name, description) on every @RestController class
@Operation(summary, description) on every controller method

summary: short action phrase under 60 chars, starts with a verb (e.g. "Get user by ID")
description: 1-3 sentences explaining behavior, side effects, or edge cases


@ApiResponses listing every status code the method can return, including success and known errors (400, 401, 403, 404, 409, etc.)
@Parameter(description, example) on every @PathVariable and @RequestParam
@Schema(description, example) on every DTO field (request and response)
use allowableValues on @Schema for string fields with a fixed set of values
do not duplicate jakarta.validation constraints inside @Schema, they are picked up automatically
use @Operation(hidden = true) for internal or debug endpoints

### audit logging                                                                                                                     
Every service method that adds, updates, or deletes data must call `logService.logByEmail(...)` after the operation succeeds.                                                                                                                                                 
- Inject `LogService` as a constructor dependency in every service that mutates data.                                                   - Retrieve the actor via `SecurityContextHolder.getContext().getAuthentication().getName()` (store in a private `getEmail()` helper).
- Use `LogType.AUDIT` and `LogSeverity.INFO` for all normal mutations.
- `action` values: `"CREATE"`, `"UPDATE"`, `"DELETE"`
- `entityType`: the entity class name (e.g. `"Project"`)
- `entityId`: the entity's primary key as a String
- `description`: plain-English summary (e.g. `"Registered project #5"`, `"Deleted employee #12"`)
- `ipAddress`: pass `null` from service layer (resolved at controller/filter level)
- Log after `repository.save()` / `repository.delete()` so the entry is only written on success.

### FRONTEND
Frontend in /frontend dir
Frontend framework is React using FluentUI React v9
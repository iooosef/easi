package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

public record VehicleMaintenanceLogResponse(

    @Schema(description = "Maintenance log ID", example = "1")
    Integer mntLogId,

    @Schema(description = "Vehicle log ID this maintenance entry belongs to", example = "1")
    Integer vehicleLogId,

    @Schema(description = "Cost of the maintenance", example = "1500.00")
    BigDecimal amount,

    @Schema(description = "Invoice reference number", example = "INV-2024-0001")
    String invoiceId,

    @Schema(description = "Type of maintenance performed", example = "Oil Change")
    String mntType

) {}
package dev.tjj.easi.dto.report;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Schema(description = "A single row in the Service Report Summary report")
public record ServiceReportSummaryRow(

        @Schema(description = "Service report number", example = "42")
        Integer srNumber,

        @Schema(description = "Project number", example = "5")
        Integer projNum,

        @Schema(description = "Project name", example = "SM Southmall")
        String projectName,

        @Schema(description = "Client complaint or request", example = "Unit not cooling")
        String complaint,

        @Schema(description = "Work performed", example = "Cleaned evaporator coil")
        String workDone,

        @Schema(description = "Assigned engineer full name; null if no engineer assigned", example = "Juan Dela Cruz")
        String engineerName,

        @Schema(description = "Service location inside the project site", example = "3F, Unit 12")
        String location,

        @Schema(description = "Scheduled service date", example = "2025-03-15")
        LocalDate scheduleDate,

        @Schema(description = "Computed payment status", example = "paid",
                allowableValues = {"unpaid", "partial", "paid"})
        String status,

        @Schema(description = "Datetime this service report was recorded", example = "2025-03-10T08:30:00")
        LocalDateTime addedOn,

        @Schema(description = "Sum of all billing item amounts for this service report", example = "3500.00")
        BigDecimal totalBilled,

        @Schema(description = "Sum of all payment log amounts for this service report", example = "3500.00")
        BigDecimal totalPaid

) {}

package dev.tjj.easi.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ServiceReportResponse(

        @Schema(description = "Service report number", example = "1")
        Integer srNumber,

        @Schema(description = "Project number", example = "3")
        Integer projNum,

        @Schema(description = "Project name", example = "ABC Corporation HVAC")
        String projectName,

        @Schema(description = "Client complaint", example = "Unit not cooling")
        String complaint,

        @Schema(description = "Work performed", example = "Replaced capacitor")
        String workDone,

        @Schema(description = "Assigned engineer employee ID; null if none", example = "5")
        Integer engineerEmployeeId,

        @Schema(description = "Service location", example = "3rd Floor East Wing, ABC Corp")
        String location,

        @Schema(description = "Linked schedule ID", example = "7")
        Integer schedId,

        @Schema(description = "Scheduled service date", example = "2026-01-08")
        LocalDate scheduleDate,

        @Schema(description = "Linked document ID; null if none", example = "2")
        Integer docuId,

        @Schema(description = "Computed payment status based on billing items and payment logs",
                example = "paid", allowableValues = {"unpaid", "partial", "paid"})
        String status,

        @Schema(description = "Sum of all billing items for this report", example = "1900.00")
        BigDecimal totalBilled,

        @Schema(description = "Sum of all payment log amounts for this report", example = "1900.00")
        BigDecimal totalPaid,

        @Schema(description = "Datetime this report was recorded", example = "2026-01-08T14:00:00")
        LocalDateTime addedOn
) {}

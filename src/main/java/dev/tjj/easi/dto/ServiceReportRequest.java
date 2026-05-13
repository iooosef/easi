package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ServiceReportRequest(

        @NotNull(message = "Project number is required")
        Integer projNum,

        @NotBlank(message = "Complaint is required")
        @Size(max = 900, message = "Complaint must not exceed 900 characters")
        String complaint,

        @NotBlank(message = "Work done is required")
        @Size(max = 900, message = "Work done must not exceed 900 characters")
        String workDone,

        Integer engineerEmployeeId,

        @NotNull(message = "Location is required")
        Integer location,

        @NotNull(message = "Schedule ID is required")
        Integer schedId,

        @Size(max = 16, message = "Payment method must not exceed 16 characters")
        String paymentMethod,

        LocalDate receiptReceiveDate,

        Integer docuId,

        @Size(max = 16, message = "Status must not exceed 16 characters")
        String status
) {}

package dev.tjj.easi.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ServiceReportResponse(
        Integer srNumber,
        Integer projNum,
        String projectName,
        String complaint,
        String workDone,
        Integer engineerEmployeeId,
        String location,
        Integer schedId,
        LocalDate scheduleDate,
        String paymentMethod,
        LocalDate receiptReceiveDate,
        Integer docuId,
        String status,
        LocalDateTime addedOn
) {}

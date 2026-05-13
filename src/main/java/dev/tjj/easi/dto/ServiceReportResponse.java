package dev.tjj.easi.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ServiceReportResponse(
        Integer srNumber,
        Integer projNum,
        String complaint,
        String workDone,
        Integer engineerEmployeeId,
        Integer location,
        Integer schedId,
        String paymentMethod,
        LocalDate receiptReceiveDate,
        Integer docuId,
        String status,
        LocalDateTime addedOn
) {}

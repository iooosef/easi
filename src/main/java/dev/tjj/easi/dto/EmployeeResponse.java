package dev.tjj.easi.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EmployeeResponse(
        Integer employeeId,
        String lastName,
        String firstName,
        String middleName,
        String suffixName,
        String gender,
        LocalDate birthdate,
        String contactNumber,
        String position,
        String status,
        LocalDateTime addedOn
) {}

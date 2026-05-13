package dev.tjj.easi.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PartRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must not exceed 255 characters")
        String name,

        @NotNull(message = "Quantity is required")
        @Min(value = 0, message = "Quantity must be zero or greater")
        Integer quantity,

        @NotBlank(message = "Quantity type is required")
        @Size(max = 30, message = "Quantity type must not exceed 30 characters")
        String quantityType,

        @NotNull(message = "Unit price is required")
        @DecimalMin(value = "0.00", inclusive = true, message = "Unit price must be zero or greater")
        BigDecimal unitPrice,

        @NotNull(message = "Supplier ID is required")
        Integer supplierId,

        @NotNull(message = "Order date is required")
        LocalDate orderDate,

        @NotNull(message = "PO number is required")
        String poNum,

        @Size(max = 16, message = "Status must not exceed 16 characters")
        String status
) {}

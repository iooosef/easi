package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PurchaseOrderRequest(

        @NotBlank(message = "PO number is required")
        @Size(max = 30, message = "PO number must not exceed 30 characters")
        String poNum,

        @NotNull(message = "Project number is required")
        Integer projNum,

        @NotBlank(message = "Purpose is required")
        @Size(max = 30, message = "Purpose must not exceed 30 characters")
        String purpose,

        @NotBlank(message = "Terms is required")
        @Size(max = 16, message = "Terms must not exceed 16 characters")
        String terms,

        Integer srNum,

        @Size(max = 600, message = "Delivery address must not exceed 600 characters")
        String deliveryAddress,

        @Size(max = 255, message = "Remarks must not exceed 255 characters")
        String remarks,

        @Size(max = 16, message = "Payment method must not exceed 16 characters")
        String paymentMethod,

        @Size(max = 60, message = "Payment details must not exceed 60 characters")
        String paymentDetails
) {}

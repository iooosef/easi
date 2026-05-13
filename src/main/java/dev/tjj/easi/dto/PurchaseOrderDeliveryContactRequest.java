package dev.tjj.easi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PurchaseOrderDeliveryContactRequest(

        @NotNull(message = "PO number is required")
        String poNum,

        @NotBlank(message = "Contact name is required")
        @Size(max = 300, message = "Contact name must not exceed 300 characters")
        String contactName,

        @NotBlank(message = "Contact number is required")
        @Size(max = 16, message = "Contact number must not exceed 16 characters")
        String contactNumber
) {}

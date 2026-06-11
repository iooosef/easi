package dev.tjj.easi.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Exposes non-sensitive server-side configuration values to the frontend. */
@RestController
@RequestMapping("/api/config")
@Tag(name = "Config", description = "Public endpoint for frontend configuration values.")
public class ConfigController {

    @Value("${app.office-address:}")
    private String officeAddress;

    /** Returns public configuration values such as the office address. */
    @GetMapping
    @Operation(summary = "Get public app config", description = "Returns non-sensitive configuration values read from server environment variables.")
    public Map<String, String> getConfig() {
        return Map.of("officeAddress", officeAddress);
    }
}

package com.officewallahgames.connectdrop.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DropDiscRequest {
    @NotBlank(message = "Player ID is required")
    private String playerId;

    @Min(value = 0, message = "Column must be between 0 and 6")
    @Max(value = 6, message = "Column must be between 0 and 6")
    private int column;
}

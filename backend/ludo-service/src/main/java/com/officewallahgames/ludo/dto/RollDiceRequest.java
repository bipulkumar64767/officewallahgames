package com.officewallahgames.ludo.dto;

import com.officewallahgames.ludo.model.PlayerColor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RollDiceRequest {

    @NotBlank(message = "Player ID is required")
    private String playerId;

    @NotNull(message = "Player color is required")
    private PlayerColor color;
}

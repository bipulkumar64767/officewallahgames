package com.officewallahgames.wordgrid.dto;

import com.officewallahgames.wordgrid.model.PlayerColor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PassTurnRequest {
    private String playerId;
    private PlayerColor color;
}

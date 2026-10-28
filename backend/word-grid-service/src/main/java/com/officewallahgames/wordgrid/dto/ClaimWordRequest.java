package com.officewallahgames.wordgrid.dto;

import com.officewallahgames.wordgrid.model.CellCoord;
import com.officewallahgames.wordgrid.model.PlayerColor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClaimWordRequest {
    private String playerId;
    private PlayerColor color;
    private List<CellCoord> path;
    private String word;
}

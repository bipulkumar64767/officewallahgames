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
public class PlaceLetterRequest {
    private String playerId;
    private PlayerColor color;
    private int row;
    private int col;
    private String letter;
}

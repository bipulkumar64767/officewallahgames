package com.officewallahgames.wordgrid.dto;

import com.officewallahgames.wordgrid.model.CellCoord;
import com.officewallahgames.wordgrid.model.PlayerColor;
import com.officewallahgames.wordgrid.model.WordGridSession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WordGridEventDto {
    private String type;
    private WordGridSession session;
    private String message;
    private long timestamp;

    private PlayerColor color;
    private Integer row;
    private Integer col;
    private Character letter;
    private String word;
    private Integer scoreDelta;
    private List<CellCoord> path;
    private PlayerColor winner;
}

package com.officewallahgames.connectdrop.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DropResult {
    private int row;
    private int col;
    private DiscColor color;
    private List<int[]> winningCells;
    private boolean isWin;
    private boolean isDraw;
}

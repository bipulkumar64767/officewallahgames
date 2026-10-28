package com.officewallahgames.tictactoe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MoveMessage {
    private String playerId;
    private int position;
    private String symbol;
}

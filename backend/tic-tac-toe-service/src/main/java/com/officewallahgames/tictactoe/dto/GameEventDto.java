package com.officewallahgames.tictactoe.dto;

import com.officewallahgames.tictactoe.model.GameSession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameEventDto {
    private String eventType;
    private GameSession session;
    private String message;
}

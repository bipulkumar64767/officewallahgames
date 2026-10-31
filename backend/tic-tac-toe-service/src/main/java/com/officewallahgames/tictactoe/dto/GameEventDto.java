package com.officewallahgames.tictactoe.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.officewallahgames.tictactoe.model.GameSession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GameEventDto {
    private String eventType;
    private String type;
    private String playerId;
    private String symbol;
    private String sessionId;
    private GameSession session;
    private String message;
}

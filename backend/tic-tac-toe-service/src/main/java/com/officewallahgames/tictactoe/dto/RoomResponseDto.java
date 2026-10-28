package com.officewallahgames.tictactoe.dto;

import com.officewallahgames.tictactoe.model.GameSession;
import com.officewallahgames.tictactoe.model.GameStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponseDto {
    private String sessionId;
    private String roomCode;
    private String shareableUrl;
    private String assignedSymbol;
    private GameStatus status;
    private GameSession session;
}

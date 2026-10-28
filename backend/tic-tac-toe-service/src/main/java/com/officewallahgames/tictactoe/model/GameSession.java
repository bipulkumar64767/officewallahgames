package com.officewallahgames.tictactoe.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameSession {
    private String sessionId;
    private String roomCode;
    private String playerX;
    private String playerXName;
    private String playerO;
    private String playerOName;
    @Builder.Default
    private String[] board = new String[9];
    @Builder.Default
    private String currentTurn = "X";
    @Builder.Default
    private GameStatus status = GameStatus.WAITING_FOR_OPPONENT;
    private String winner;
    private List<Integer> winningPattern;
    @Builder.Default
    private Instant createdAt = Instant.now();
    @Builder.Default
    private Instant updatedAt = Instant.now();
}

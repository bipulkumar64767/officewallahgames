package com.officewallahgames.connectdrop.model;

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
public class ConnectDropSession {
    private String sessionId;
    private String roomCode;
    private String playerRed;
    private String playerRedName;
    private String playerYellow;
    private String playerYellowName;

    @Builder.Default
    private int[][] board = new int[6][7];

    @Builder.Default
    private DiscColor currentTurn = DiscColor.RED;

    @Builder.Default
    private GameStatus status = GameStatus.WAITING_FOR_OPPONENT;

    private DiscColor winner;
    private List<int[]> winningCells;
    private long turnStartedAt;

    @Builder.Default
    private Instant createdAt = Instant.now();

    @Builder.Default
    private Instant updatedAt = Instant.now();
}

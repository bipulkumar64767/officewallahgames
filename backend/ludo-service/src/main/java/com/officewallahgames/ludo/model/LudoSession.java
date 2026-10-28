package com.officewallahgames.ludo.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LudoSession {

    private String sessionId;
    private String roomCode;
    private int playerCount; // 2, 3, or 4

    @Builder.Default
    private Map<PlayerColor, String> players = new ConcurrentHashMap<>();

    @Builder.Default
    private Map<PlayerColor, String> playerNames = new ConcurrentHashMap<>();

    @Builder.Default
    private Map<PlayerColor, SlotState> slotStates = new ConcurrentHashMap<>();

    @Builder.Default
    private List<LudoToken> tokens = new ArrayList<>();

    private PlayerColor currentTurn;

    @Builder.Default
    private List<PlayerColor> turnOrder = new ArrayList<>();

    private int diceValue;
    private boolean hasRolled;
    private int consecutiveSixes;

    @Builder.Default
    private List<PlayerColor> rankings = new ArrayList<>();

    private GameStatus status;
    private long turnStartedAt;

    @Builder.Default
    private List<String> movableTokenIds = new ArrayList<>();

    private long createdAt;
    private long updatedAt;
}

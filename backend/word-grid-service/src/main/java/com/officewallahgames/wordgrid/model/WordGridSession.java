package com.officewallahgames.wordgrid.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WordGridSession {

    private String sessionId;
    private String roomCode;
    private int playerCount;

    @Builder.Default
    private Map<PlayerColor, String> players = new ConcurrentHashMap<>();

    @Builder.Default
    private Map<PlayerColor, String> playerNames = new ConcurrentHashMap<>();

    @Builder.Default
    private Map<PlayerColor, SlotState> slotStates = new ConcurrentHashMap<>();

    @Builder.Default
    private Map<PlayerColor, Integer> scores = new ConcurrentHashMap<>();

    @Builder.Default
    private Character[][] grid = new Character[10][10];

    @Builder.Default
    private PlayerColor[][] cellOwners = new PlayerColor[10][10];

    private PlayerColor currentTurn;

    @Builder.Default
    private List<PlayerColor> turnOrder = new ArrayList<>();

    private boolean hasPlacedLetter;
    private long turnStartedAt;

    @Builder.Default
    private Set<String> claimedWords = ConcurrentHashMap.newKeySet();

    private GameStatus status;
    private PlayerColor winner;

    private long createdAt;
    private long updatedAt;
}

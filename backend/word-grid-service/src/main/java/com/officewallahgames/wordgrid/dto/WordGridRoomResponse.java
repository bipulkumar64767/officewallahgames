package com.officewallahgames.wordgrid.dto;

import com.officewallahgames.wordgrid.model.GameStatus;
import com.officewallahgames.wordgrid.model.PlayerColor;
import com.officewallahgames.wordgrid.model.SlotState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WordGridRoomResponse {
    private String sessionId;
    private String roomCode;
    private PlayerColor assignedColor;
    private int playerCount;
    private GameStatus status;
    private Map<PlayerColor, SlotState> slotStates;
    private Map<PlayerColor, Integer> scores;
}

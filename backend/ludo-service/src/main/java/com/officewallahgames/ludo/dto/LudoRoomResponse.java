package com.officewallahgames.ludo.dto;

import com.officewallahgames.ludo.model.GameStatus;
import com.officewallahgames.ludo.model.LudoSession;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.model.SlotState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LudoRoomResponse {

    private String sessionId;
    private String roomCode;
    private String shareableUrl;
    private PlayerColor assignedColor;
    private int playerCount;
    private Map<PlayerColor, SlotState> slotStates;
    private GameStatus status;
    private LudoSession session;
}

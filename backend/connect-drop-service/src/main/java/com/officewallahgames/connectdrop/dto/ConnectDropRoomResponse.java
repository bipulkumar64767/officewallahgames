package com.officewallahgames.connectdrop.dto;

import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.model.DiscColor;
import com.officewallahgames.connectdrop.model.GameStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectDropRoomResponse {
    private String sessionId;
    private String roomCode;
    private String shareableUrl;
    private DiscColor assignedColor;
    private GameStatus status;
    private ConnectDropSession session;
}

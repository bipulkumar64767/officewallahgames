package com.officewallahgames.connectdrop.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JoinRoomRequest {
    @NotBlank(message = "Room code is required")
    private String roomCode;

    private String playerId;
    private String playerName;
}

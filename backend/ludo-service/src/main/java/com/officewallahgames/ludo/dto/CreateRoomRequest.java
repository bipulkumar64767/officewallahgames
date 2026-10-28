package com.officewallahgames.ludo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoomRequest {

    private String playerId;
    private String playerName;
    private Integer playerCount; // 2, 3, or 4 (default 4 if null)
}

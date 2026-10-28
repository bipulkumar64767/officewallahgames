package com.officewallahgames.master.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameMetadata {
    private String gameId;
    private String name;
    private String tagline;
    private GameMode gameMode;
    private String category;
    private String thumbnailUrl;
    private String route;
    private int minPlayers;
    private int maxPlayers;
    private boolean isActive;
    private boolean isMaintenance;
    private int displayOrder;
}

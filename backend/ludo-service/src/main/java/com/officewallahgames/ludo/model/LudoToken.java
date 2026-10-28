package com.officewallahgames.ludo.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LudoToken {

    private String tokenId;
    private PlayerColor color;
    private int position; // -1 = yard, 1-52 = standard board path, 53-57 = home stretch, 58 = home finish
    private TokenState state;
    private int stepCount; // -1 = yard, 0 = start square, 1-51 = track, 52-56 = home column, 57 = finished

    public static LudoToken createInitial(String tokenId, PlayerColor color) {
        return LudoToken.builder()
                .tokenId(tokenId)
                .color(color)
                .position(-1)
                .state(TokenState.HOME_YARD)
                .stepCount(-1)
                .build();
    }
}

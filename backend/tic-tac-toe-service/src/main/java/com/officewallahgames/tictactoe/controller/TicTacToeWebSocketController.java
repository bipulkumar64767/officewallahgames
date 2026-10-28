package com.officewallahgames.tictactoe.controller;

import com.officewallahgames.tictactoe.dto.MoveMessage;
import com.officewallahgames.tictactoe.service.TicTacToeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Slf4j
@Controller
@RequiredArgsConstructor
public class TicTacToeWebSocketController {

    private final TicTacToeService ticTacToeService;

    @MessageMapping("/game/{sessionId}/move")
    public void handleMove(
            @DestinationVariable String sessionId,
            @Payload MoveMessage move) {
        log.info("Received move for session {}: pos={}, symbol={}, player={}",
                sessionId, move.getPosition(), move.getSymbol(), move.getPlayerId());
        ticTacToeService.processMove(sessionId, move);
    }

    @MessageMapping("/game/{sessionId}/rematch")
    public void handleRematch(
            @DestinationVariable String sessionId,
            @Payload(required = false) Map<String, String> payload) {
        String playerId = (payload != null) ? payload.get("playerId") : null;
        log.info("Received rematch request for session {} by player {}", sessionId, playerId);
        ticTacToeService.requestRematch(sessionId, playerId);
    }
}

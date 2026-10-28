package com.officewallahgames.ludo.controller;

import com.officewallahgames.ludo.dto.MoveTokenRequest;
import com.officewallahgames.ludo.dto.RollDiceRequest;
import com.officewallahgames.ludo.service.LudoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class LudoWebSocketController {

    private final LudoService ludoService;

    @MessageMapping("/ludo/{sessionId}/roll")
    public void handleRoll(
            @DestinationVariable String sessionId,
            @Payload RollDiceRequest request) {
        log.info("Received roll request for session {}: color={}, player={}",
                sessionId, request.getColor(), request.getPlayerId());
        ludoService.rollDice(sessionId, request);
    }

    @MessageMapping("/ludo/{sessionId}/move")
    public void handleMove(
            @DestinationVariable String sessionId,
            @Payload MoveTokenRequest request) {
        log.info("Received move request for session {}: color={}, token={}, player={}",
                sessionId, request.getColor(), request.getTokenId(), request.getPlayerId());
        ludoService.moveToken(sessionId, request);
    }
}

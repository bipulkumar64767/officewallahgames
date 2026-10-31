package com.officewallahgames.ludo.controller;

import com.officewallahgames.ludo.dto.MoveTokenRequest;
import com.officewallahgames.ludo.dto.RollDiceRequest;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.service.LudoService;
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

    @MessageMapping("/ludo/{sessionId}/leave")
    public void leaveRoom(@DestinationVariable String sessionId, Map<String, Object> payload) {
        String playerId = payload != null && payload.get("playerId") != null
                ? payload.get("playerId").toString()
                : null;
        ludoService.leaveRoom(sessionId, playerId);
    }

    @MessageMapping("/ludo/{sessionId}/disband")
    public void handleDisband(
            @DestinationVariable String sessionId,
            @Payload(required = false) Map<String, Object> payload) {
        String playerId = (payload != null && payload.get("playerId") != null) ? payload.get("playerId").toString() : null;
        log.info("Received disband request for session {} by player {}", sessionId, playerId);
        ludoService.disbandRoom(sessionId, playerId);
    }

    @MessageMapping("/ludo/{sessionId}/pass-turn")
    public void handlePassTurn(
            @DestinationVariable String sessionId,
            @Payload(required = false) Map<String, Object> payload) {
        String playerId = (payload != null && payload.get("playerId") != null) ? payload.get("playerId").toString() : null;
        PlayerColor color = null;
        if (payload != null && payload.get("color") != null) {
            try {
                color = PlayerColor.valueOf(payload.get("color").toString().toUpperCase());
            } catch (Exception e) {
                log.warn("Invalid color in pass-turn payload: {}", payload.get("color"));
            }
        }
        log.info("Received pass-turn request for session {}: color={}, player={}", sessionId, color, playerId);
        ludoService.passTurn(sessionId, playerId, color);
    }
}

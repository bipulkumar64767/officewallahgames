package com.officewallahgames.connectdrop.controller;

import com.officewallahgames.connectdrop.dto.DropDiscRequest;
import com.officewallahgames.connectdrop.dto.RematchRequest;
import com.officewallahgames.connectdrop.service.ConnectDropService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ConnectDropWebSocketController {

    private final ConnectDropService connectDropService;

    @MessageMapping("/connectdrop/{sessionId}/drop")
    public void handleDrop(
            @DestinationVariable String sessionId,
            @Valid @Payload DropDiscRequest request) {
        log.info("Received disc drop for session {}: col={}, player={}",
                sessionId, request.getColumn(), request.getPlayerId());
        connectDropService.dropDisc(sessionId, request);
    }

    @MessageMapping("/connectdrop/{sessionId}/rematch")
    public void handleRematch(
            @DestinationVariable String sessionId,
            @Payload(required = false) RematchRequest request) {
        String playerId = (request != null) ? request.getPlayerId() : null;
        log.info("Received rematch request for session {} by player {}", sessionId, playerId);
        connectDropService.requestRematch(sessionId, request != null ? request : new RematchRequest(playerId));
    }
}

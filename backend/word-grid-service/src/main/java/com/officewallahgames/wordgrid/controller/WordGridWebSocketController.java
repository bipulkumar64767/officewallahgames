package com.officewallahgames.wordgrid.controller;

import com.officewallahgames.wordgrid.dto.ClaimWordRequest;
import com.officewallahgames.wordgrid.dto.PassTurnRequest;
import com.officewallahgames.wordgrid.dto.PlaceLetterRequest;
import com.officewallahgames.wordgrid.service.WordGridService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WordGridWebSocketController {

    private final WordGridService wordGridService;

    @MessageMapping("/wordgrid/{sessionId}/place-letter")
    public void handlePlaceLetter(
            @DestinationVariable String sessionId,
            @Payload PlaceLetterRequest request) {
        log.info("Received place letter for session {}: color={}, row={}, col={}, letter={}",
                sessionId, request.getColor(), request.getRow(), request.getCol(), request.getLetter());
        wordGridService.placeLetter(sessionId, request);
    }

    @MessageMapping("/wordgrid/{sessionId}/claim-word")
    public void handleClaimWord(
            @DestinationVariable String sessionId,
            @Payload ClaimWordRequest request) {
        log.info("Received claim word for session {}: color={}, pathSize={}, word={}",
                sessionId, request.getColor(), request.getPath() != null ? request.getPath().size() : 0, request.getWord());
        wordGridService.claimWord(sessionId, request);
    }

    @MessageMapping("/wordgrid/{sessionId}/pass-turn")
    public void handlePassTurn(
            @DestinationVariable String sessionId,
            @Payload PassTurnRequest request) {
        log.info("Received pass turn for session {}: color={}", sessionId, request.getColor());
        wordGridService.passTurn(sessionId, request);
    }
}

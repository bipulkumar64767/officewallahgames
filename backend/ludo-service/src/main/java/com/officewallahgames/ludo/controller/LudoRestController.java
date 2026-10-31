package com.officewallahgames.ludo.controller;

import com.officewallahgames.common.dto.ApiResponse;
import com.officewallahgames.ludo.dto.CreateRoomRequest;
import com.officewallahgames.ludo.dto.JoinRoomRequest;
import com.officewallahgames.ludo.dto.LudoRoomResponse;
import com.officewallahgames.ludo.model.LudoSession;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.service.LudoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ludo")
@RequiredArgsConstructor
public class LudoRestController {

    private final LudoService ludoService;

    @PostMapping("/rooms/create")
    public ResponseEntity<ApiResponse<LudoRoomResponse>> createRoom(
            @RequestBody(required = false) CreateRoomRequest request) {
        LudoRoomResponse response = ludoService.createRoom(request != null ? request : new CreateRoomRequest());
        return ResponseEntity.ok(ApiResponse.success(response, "Ludo room created successfully"));
    }

    @PostMapping("/rooms/join")
    public ResponseEntity<ApiResponse<LudoRoomResponse>> joinRoom(
            @Valid @RequestBody JoinRoomRequest request) {
        LudoRoomResponse response = ludoService.joinRoom(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Joined Ludo room successfully"));
    }

    @GetMapping("/rooms/{roomCode}/status")
    public ResponseEntity<ApiResponse<LudoSession>> getRoomStatus(
            @PathVariable String roomCode) {
        LudoSession session = ludoService.getRoomStatus(roomCode);
        return ResponseEntity.ok(ApiResponse.success(session));
    }

    @PostMapping("/rooms/{sessionId}/leave")
    public ResponseEntity<ApiResponse<Void>> leaveRoom(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> payload) {
        String playerId = (payload != null && payload.get("playerId") != null) ? payload.get("playerId").toString() : null;
        ludoService.leaveRoom(sessionId, playerId);
        return ResponseEntity.ok(ApiResponse.success(null, "Left Ludo room successfully"));
    }

    @PostMapping("/rooms/{sessionId}/disband")
    public ResponseEntity<ApiResponse<Void>> disbandRoom(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> payload) {
        String playerId = (payload != null && payload.get("playerId") != null) ? payload.get("playerId").toString() : null;
        ludoService.disbandRoom(sessionId, playerId);
        return ResponseEntity.ok(ApiResponse.success(null, "Ludo room disbanded successfully"));
    }

    @PostMapping("/rooms/{sessionId}/pass-turn")
    public ResponseEntity<ApiResponse<LudoSession>> passTurn(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> payload) {
        String playerId = (payload != null && payload.get("playerId") != null) ? payload.get("playerId").toString() : null;
        PlayerColor color = null;
        if (payload != null && payload.get("color") != null) {
            try {
                color = PlayerColor.valueOf(payload.get("color").toString().toUpperCase());
            } catch (Exception ignored) {}
        }
        LudoSession session = ludoService.passTurn(sessionId, playerId, color);
        return ResponseEntity.ok(ApiResponse.success(session, "Ludo turn passed successfully"));
    }

    @PostMapping("/queue/quick-match")
    public ResponseEntity<ApiResponse<LudoRoomResponse>> quickMatch(
            @RequestBody(required = false) CreateRoomRequest request) {
        String playerId = request != null ? request.getPlayerId() : null;
        String playerName = request != null ? request.getPlayerName() : null;
        int playerCount = (request != null && request.getPlayerCount() != null) ? request.getPlayerCount() : 4;
        LudoRoomResponse response = ludoService.quickMatch(playerId, playerName, playerCount);
        return ResponseEntity.ok(ApiResponse.success(response, "Matchmaking successful"));
    }
}

package com.officewallahgames.wordgrid.controller;

import com.officewallahgames.common.dto.ApiResponse;
import com.officewallahgames.wordgrid.dto.CreateRoomRequest;
import com.officewallahgames.wordgrid.dto.JoinRoomRequest;
import com.officewallahgames.wordgrid.dto.WordGridRoomResponse;
import com.officewallahgames.wordgrid.model.WordGridSession;
import com.officewallahgames.wordgrid.service.WordGridService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/wordgrid")
@RequiredArgsConstructor
public class WordGridRestController {

    private final WordGridService wordGridService;

    @PostMapping("/rooms/create")
    public ResponseEntity<ApiResponse<WordGridRoomResponse>> createRoom(
            @RequestBody(required = false) CreateRoomRequest request) {
        WordGridRoomResponse response = wordGridService.createRoom(request != null ? request : new CreateRoomRequest());
        return ResponseEntity.ok(ApiResponse.success(response, "Word Grid room created successfully"));
    }

    @PostMapping("/rooms/join")
    public ResponseEntity<ApiResponse<WordGridRoomResponse>> joinRoom(
            @Valid @RequestBody JoinRoomRequest request) {
        WordGridRoomResponse response = wordGridService.joinRoom(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Joined Word Grid room successfully"));
    }

    @GetMapping("/rooms/{roomCode}/status")
    public ResponseEntity<ApiResponse<WordGridSession>> getRoomStatus(
            @PathVariable String roomCode) {
        WordGridSession session = wordGridService.getRoomStatus(roomCode);
        return ResponseEntity.ok(ApiResponse.success(session));
    }

    @PostMapping("/queue/quick-match")
    public ResponseEntity<ApiResponse<WordGridRoomResponse>> quickMatch(
            @RequestBody(required = false) CreateRoomRequest request) {
        String playerId = request != null ? request.getPlayerId() : null;
        String playerName = request != null ? request.getPlayerName() : null;
        int playerCount = (request != null && request.getPlayerCount() != null) ? request.getPlayerCount() : 4;
        WordGridRoomResponse response = wordGridService.quickMatch(playerId, playerName, playerCount);
        return ResponseEntity.ok(ApiResponse.success(response, "Matchmaking successful"));
    }
}

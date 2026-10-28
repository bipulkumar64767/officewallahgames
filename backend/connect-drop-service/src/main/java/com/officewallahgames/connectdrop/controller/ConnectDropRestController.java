package com.officewallahgames.connectdrop.controller;

import com.officewallahgames.common.dto.ApiResponse;
import com.officewallahgames.connectdrop.dto.ConnectDropRoomResponse;
import com.officewallahgames.connectdrop.dto.CreateRoomRequest;
import com.officewallahgames.connectdrop.dto.JoinRoomRequest;
import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.service.ConnectDropService;
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
@RequestMapping("/api/v1/connectdrop")
@RequiredArgsConstructor
public class ConnectDropRestController {

    private final ConnectDropService connectDropService;

    @PostMapping("/rooms/create")
    public ResponseEntity<ApiResponse<ConnectDropRoomResponse>> createRoom(
            @RequestBody(required = false) CreateRoomRequest request) {
        ConnectDropRoomResponse response = connectDropService.createRoom(request != null ? request : new CreateRoomRequest());
        return ResponseEntity.ok(ApiResponse.success(response, "Room created successfully"));
    }

    @PostMapping("/rooms/join")
    public ResponseEntity<ApiResponse<ConnectDropRoomResponse>> joinRoom(
            @Valid @RequestBody JoinRoomRequest request) {
        ConnectDropRoomResponse response = connectDropService.joinRoom(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Joined room successfully"));
    }

    @GetMapping("/rooms/{roomCode}/status")
    public ResponseEntity<ApiResponse<ConnectDropSession>> getRoomStatus(
            @PathVariable String roomCode) {
        ConnectDropSession session = connectDropService.getRoomStatus(roomCode);
        return ResponseEntity.ok(ApiResponse.success(session));
    }

    @PostMapping("/queue/quick-match")
    public ResponseEntity<ApiResponse<ConnectDropRoomResponse>> quickMatch(
            @RequestBody(required = false) CreateRoomRequest request) {
        String playerId = request != null ? request.getPlayerId() : null;
        String playerName = request != null ? request.getPlayerName() : null;
        ConnectDropRoomResponse response = connectDropService.quickMatch(playerId, playerName);
        return ResponseEntity.ok(ApiResponse.success(response, "Matchmaking successful"));
    }
}

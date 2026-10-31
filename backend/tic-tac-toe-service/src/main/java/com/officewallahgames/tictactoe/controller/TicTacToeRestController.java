package com.officewallahgames.tictactoe.controller;

import com.officewallahgames.common.dto.ApiResponse;
import com.officewallahgames.tictactoe.dto.CreateRoomRequest;
import com.officewallahgames.tictactoe.dto.GameEventDto;
import com.officewallahgames.tictactoe.dto.JoinRoomRequest;
import com.officewallahgames.tictactoe.dto.RoomResponseDto;
import com.officewallahgames.tictactoe.model.GameSession;
import com.officewallahgames.tictactoe.service.TicTacToeService;
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
@RequestMapping("/api/v1/tictactoe")
@RequiredArgsConstructor
public class TicTacToeRestController {

    private final TicTacToeService ticTacToeService;

    @PostMapping("/rooms/create")
    public ResponseEntity<ApiResponse<RoomResponseDto>> createRoom(
            @RequestBody(required = false) CreateRoomRequest request) {
        RoomResponseDto response = ticTacToeService.createRoom(request != null ? request : new CreateRoomRequest());
        return ResponseEntity.ok(ApiResponse.success(response, "Room created successfully"));
    }

    @PostMapping("/rooms/join")
    public ResponseEntity<ApiResponse<RoomResponseDto>> joinRoom(
            @Valid @RequestBody JoinRoomRequest request) {
        RoomResponseDto response = ticTacToeService.joinRoom(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Joined room successfully"));
    }

    @GetMapping("/rooms/{roomCode}/status")
    public ResponseEntity<ApiResponse<GameSession>> getRoomStatus(
            @PathVariable String roomCode) {
        GameSession session = ticTacToeService.getRoomStatus(roomCode);
        return ResponseEntity.ok(ApiResponse.success(session));
    }

    @PostMapping("/rooms/{sessionId}/disband")
    public ResponseEntity<ApiResponse<Void>> disbandRoom(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, String> payload) {
        String playerId = (payload != null) ? payload.get("playerId") : null;
        ticTacToeService.disbandRoom(sessionId, playerId);
        return ResponseEntity.ok(ApiResponse.success(null, "Room disbanded successfully"));
    }

    @PostMapping("/rooms/{sessionId}/pass-turn")
    public ResponseEntity<ApiResponse<GameEventDto>> passTurn(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, String> payload) {
        String playerId = (payload != null) ? payload.get("playerId") : null;
        GameEventDto event = ticTacToeService.passTurn(sessionId, playerId);
        return ResponseEntity.ok(ApiResponse.success(event, "Turn passed successfully"));
    }

    @PostMapping("/queue/quick-match")
    public ResponseEntity<ApiResponse<RoomResponseDto>> quickMatch(
            @RequestBody(required = false) CreateRoomRequest request) {
        String playerId = request != null ? request.getPlayerId() : null;
        String playerName = request != null ? request.getPlayerName() : null;
        RoomResponseDto response = ticTacToeService.quickMatch(playerId, playerName);
        return ResponseEntity.ok(ApiResponse.success(response, "Matchmaking successful"));
    }
}

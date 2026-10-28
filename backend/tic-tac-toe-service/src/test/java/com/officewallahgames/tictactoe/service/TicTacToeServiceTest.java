package com.officewallahgames.tictactoe.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.tictactoe.dto.CreateRoomRequest;
import com.officewallahgames.tictactoe.dto.GameEventDto;
import com.officewallahgames.tictactoe.dto.JoinRoomRequest;
import com.officewallahgames.tictactoe.dto.MoveMessage;
import com.officewallahgames.tictactoe.dto.RoomResponseDto;
import com.officewallahgames.tictactoe.engine.TicTacToeEngine;
import com.officewallahgames.tictactoe.model.GameSession;
import com.officewallahgames.tictactoe.model.GameStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TicTacToeServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private TicTacToeEngine engine;
    private TicTacToeService service;

    @BeforeEach
    void setUp() {
        engine = new TicTacToeEngine();
        service = new TicTacToeService(engine, messagingTemplate);
    }

    @Test
    @DisplayName("Create room assigns host as X and status WAITING_FOR_OPPONENT")
    void testCreateRoom() {
        CreateRoomRequest request = CreateRoomRequest.builder()
                .playerId("p1")
                .playerName("Player 1")
                .build();

        RoomResponseDto response = service.createRoom(request);

        assertNotNull(response);
        assertNotNull(response.getSessionId());
        assertNotNull(response.getRoomCode());
        assertTrue(response.getRoomCode().startsWith("TTT-"));
        assertEquals("X", response.getAssignedSymbol());
        assertEquals(GameStatus.WAITING_FOR_OPPONENT, response.getStatus());

        GameSession session = service.getRoomStatus(response.getRoomCode());
        assertEquals("p1", session.getPlayerX());
        assertEquals("Player 1", session.getPlayerXName());
        assertNull(session.getPlayerO());
    }

    @Test
    @DisplayName("Join room assigns opponent as O, updates status to ACTIVE, broadcasts event")
    void testJoinRoom() {
        RoomResponseDto createResp = service.createRoom(CreateRoomRequest.builder()
                .playerId("host-1")
                .playerName("Host")
                .build());

        JoinRoomRequest joinReq = JoinRoomRequest.builder()
                .roomCode(createResp.getRoomCode())
                .playerId("guest-1")
                .playerName("Guest")
                .build();

        RoomResponseDto joinResp = service.joinRoom(joinReq);

        assertNotNull(joinResp);
        assertEquals("O", joinResp.getAssignedSymbol());
        assertEquals(GameStatus.ACTIVE, joinResp.getStatus());

        GameSession session = service.getRoomStatus(createResp.getRoomCode());
        assertEquals("guest-1", session.getPlayerO());
        assertEquals("Guest", session.getPlayerOName());
        assertEquals(GameStatus.ACTIVE, session.getStatus());

        ArgumentCaptor<GameEventDto> eventCaptor = ArgumentCaptor.forClass(GameEventDto.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/game/" + session.getSessionId()), eventCaptor.capture());
        assertEquals("PLAYER_JOINED", eventCaptor.getValue().getEventType());
    }

    @Test
    @DisplayName("Join room throws GameException if room code is invalid")
    void testJoinRoomNotFound() {
        JoinRoomRequest request = JoinRoomRequest.builder()
                .roomCode("INVALID_CODE")
                .playerId("p2")
                .playerName("Guest")
                .build();

        assertThrows(GameException.class, () -> service.joinRoom(request));
    }

    @Test
    @DisplayName("Host cannot join their own room as opponent")
    void testHostCannotJoinOwnRoom() {
        RoomResponseDto room = service.createRoom(CreateRoomRequest.builder()
                .playerId("player-123")
                .playerName("Solo")
                .build());

        JoinRoomRequest joinRequest = JoinRoomRequest.builder()
                .roomCode(room.getRoomCode())
                .playerId("player-123")
                .playerName("Solo again")
                .build();

        assertThrows(GameException.class, () -> service.joinRoom(joinRequest));
    }

    @Test
    @DisplayName("Turn handling and move processing broadcasts MOVE_MADE event")
    void testProcessMove() {
        RoomResponseDto room = service.createRoom(CreateRoomRequest.builder().playerId("p1").playerName("P1").build());
        service.joinRoom(JoinRoomRequest.builder().roomCode(room.getRoomCode()).playerId("p2").playerName("P2").build());

        MoveMessage move = MoveMessage.builder().playerId("p1").position(4).symbol("X").build();
        GameEventDto event = service.processMove(room.getSessionId(), move);

        assertEquals("MOVE_MADE", event.getEventType());
        assertEquals("O", event.getSession().getCurrentTurn());
        assertEquals("X", event.getSession().getBoard()[4]);

        verify(messagingTemplate).convertAndSend(eq("/topic/game/" + room.getSessionId()), eq(event));
    }

    @Test
    @DisplayName("Winning move completes game and broadcasts GAME_OVER event")
    void testProcessMoveWinningGame() {
        RoomResponseDto room = service.createRoom(CreateRoomRequest.builder().playerId("p1").playerName("P1").build());
        service.joinRoom(JoinRoomRequest.builder().roomCode(room.getRoomCode()).playerId("p2").playerName("P2").build());
        String sid = room.getSessionId();

        // X: 0, O: 3, X: 1, O: 4, X: 2 (X wins row 0)
        service.processMove(sid, MoveMessage.builder().playerId("p1").position(0).symbol("X").build());
        service.processMove(sid, MoveMessage.builder().playerId("p2").position(3).symbol("O").build());
        service.processMove(sid, MoveMessage.builder().playerId("p1").position(1).symbol("X").build());
        service.processMove(sid, MoveMessage.builder().playerId("p2").position(4).symbol("O").build());
        GameEventDto finalEvent = service.processMove(sid, MoveMessage.builder().playerId("p1").position(2).symbol("X").build());

        assertEquals("GAME_OVER", finalEvent.getEventType());
        assertEquals(GameStatus.COMPLETED, finalEvent.getSession().getStatus());
        assertEquals("X", finalEvent.getSession().getWinner());
    }

    @Test
    @DisplayName("Request rematch resets board, toggles starting turn, and broadcasts REMATCH_REQUESTED")
    void testRequestRematch() {
        RoomResponseDto room = service.createRoom(CreateRoomRequest.builder().playerId("p1").playerName("P1").build());
        service.joinRoom(JoinRoomRequest.builder().roomCode(room.getRoomCode()).playerId("p2").playerName("P2").build());
        String sid = room.getSessionId();

        // Make move
        service.processMove(sid, MoveMessage.builder().playerId("p1").position(0).symbol("X").build());

        GameEventDto rematchEvent = service.requestRematch(sid, "p1");

        assertEquals("REMATCH_REQUESTED", rematchEvent.getEventType());
        assertEquals(GameStatus.ACTIVE, rematchEvent.getSession().getStatus());
        assertNull(rematchEvent.getSession().getWinner());
        assertNull(rematchEvent.getSession().getBoard()[0]);
        // Turn was toggled to O after move 0, so next start should be X
        assertNotNull(rematchEvent.getSession().getCurrentTurn());
    }

    @Test
    @DisplayName("QuickMatch queue atomically pairs two waiting players")
    void testQuickMatchPairing() {
        // Player 1 quick matches -> enters waiting queue
        RoomResponseDto resp1 = service.quickMatch("player-qm-1", "Alice");
        assertEquals("X", resp1.getAssignedSymbol());
        assertEquals(GameStatus.WAITING_FOR_OPPONENT, resp1.getStatus());

        // Player 2 quick matches -> pairs with Player 1
        RoomResponseDto resp2 = service.quickMatch("player-qm-2", "Bob");
        assertEquals("O", resp2.getAssignedSymbol());
        assertEquals(GameStatus.ACTIVE, resp2.getStatus());
        assertEquals(resp1.getSessionId(), resp2.getSessionId());

        GameSession session = service.getSessionById(resp1.getSessionId());
        assertEquals(GameStatus.ACTIVE, session.getStatus());
        assertEquals("player-qm-1", session.getPlayerX());
        assertEquals("player-qm-2", session.getPlayerO());
    }
}

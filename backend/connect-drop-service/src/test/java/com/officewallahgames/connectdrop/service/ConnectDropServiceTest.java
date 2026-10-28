package com.officewallahgames.connectdrop.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.connectdrop.dto.ConnectDropEventDto;
import com.officewallahgames.connectdrop.dto.ConnectDropRoomResponse;
import com.officewallahgames.connectdrop.dto.CreateRoomRequest;
import com.officewallahgames.connectdrop.dto.DropDiscRequest;
import com.officewallahgames.connectdrop.dto.JoinRoomRequest;
import com.officewallahgames.connectdrop.dto.RematchRequest;
import com.officewallahgames.connectdrop.engine.ConnectDropEngine;
import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.model.DiscColor;
import com.officewallahgames.connectdrop.model.GameStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ConnectDropServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private ConnectDropEngine engine;
    private ConnectDropService service;

    @BeforeEach
    void setUp() {
        engine = new ConnectDropEngine();
        service = new ConnectDropService(engine, messagingTemplate);
    }

    @Test
    @DisplayName("Room creation creates room with CND-XXXX format, host as RED, and WAITING_FOR_OPPONENT status")
    void createRoom_success() {
        CreateRoomRequest request = CreateRoomRequest.builder()
                .playerId("player-1")
                .playerName("Alice")
                .build();

        ConnectDropRoomResponse response = service.createRoom(request);

        assertThat(response).isNotNull();
        assertThat(response.getSessionId()).isNotBlank();
        assertThat(response.getRoomCode()).matches("^CND-[A-Z0-9]{4}$");
        assertThat(response.getAssignedColor()).isEqualTo(DiscColor.RED);
        assertThat(response.getStatus()).isEqualTo(GameStatus.WAITING_FOR_OPPONENT);
        assertThat(response.getShareableUrl()).isEqualTo("/connectdrop?room=" + response.getRoomCode());

        ConnectDropSession session = response.getSession();
        assertThat(session.getPlayerRed()).isEqualTo("player-1");
        assertThat(session.getPlayerRedName()).isEqualTo("Alice");
        assertThat(session.getPlayerYellow()).isNull();
        assertThat(session.getCurrentTurn()).isEqualTo(DiscColor.RED);
    }

    @Test
    @DisplayName("Opponent joining sets YELLOW, ACTIVE status, and broadcasts ROOM_READY")
    void joinRoom_success() {
        ConnectDropRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("host-id")
                .playerName("Host")
                .build());

        JoinRoomRequest joinRequest = JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("joiner-id")
                .playerName("Joiner")
                .build();

        ConnectDropRoomResponse joined = service.joinRoom(joinRequest);

        assertThat(joined.getAssignedColor()).isEqualTo(DiscColor.YELLOW);
        assertThat(joined.getStatus()).isEqualTo(GameStatus.ACTIVE);

        ConnectDropSession session = joined.getSession();
        assertThat(session.getPlayerRed()).isEqualTo("host-id");
        assertThat(session.getPlayerYellow()).isEqualTo("joiner-id");
        assertThat(session.getPlayerYellowName()).isEqualTo("Joiner");
        assertThat(session.getStatus()).isEqualTo(GameStatus.ACTIVE);

        // Verify WebSocket broadcast
        ArgumentCaptor<ConnectDropEventDto> eventCaptor = ArgumentCaptor.forClass(ConnectDropEventDto.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/connectdrop/" + session.getSessionId()), eventCaptor.capture());

        ConnectDropEventDto event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("ROOM_READY");
        assertThat(event.getMessage()).contains("Joiner joined the game");
    }

    @Test
    @DisplayName("Host cannot join own room as opponent")
    void joinRoom_hostJoiningOwnRoom_throwsException() {
        ConnectDropRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("same-id")
                .playerName("Host")
                .build());

        JoinRoomRequest joinRequest = JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("same-id")
                .playerName("Host Again")
                .build();

        assertThatThrownBy(() -> service.joinRoom(joinRequest))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Host cannot join as opponent");
    }

    @Test
    @DisplayName("Status query returns correct session by roomCode")
    void getRoomStatus_success() {
        ConnectDropRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("p1")
                .playerName("Player 1")
                .build());

        ConnectDropSession session = service.getRoomStatus(created.getRoomCode());

        assertThat(session).isNotNull();
        assertThat(session.getSessionId()).isEqualTo(created.getSessionId());
        assertThat(session.getRoomCode()).isEqualTo(created.getRoomCode());

        // Invalid room code throws GameException
        assertThatThrownBy(() -> service.getRoomStatus("INVALID-CODE"))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Room not found");
    }

    @Test
    @DisplayName("Quick-match pairs two players sequentially")
    void quickMatch_pairsTwoPlayers() {
        // First player queues
        ConnectDropRoomResponse first = service.quickMatch("player-a", "Alice");
        assertThat(first.getStatus()).isEqualTo(GameStatus.WAITING_FOR_OPPONENT);
        assertThat(first.getAssignedColor()).isEqualTo(DiscColor.RED);

        // Second player queues -> automatically pairs into same session
        ConnectDropRoomResponse second = service.quickMatch("player-b", "Bob");
        assertThat(second.getSessionId()).isEqualTo(first.getSessionId());
        assertThat(second.getStatus()).isEqualTo(GameStatus.ACTIVE);
        assertThat(second.getAssignedColor()).isEqualTo(DiscColor.YELLOW);

        ConnectDropSession session = service.getRoomStatus(first.getRoomCode());
        assertThat(session.getPlayerRed()).isEqualTo("player-a");
        assertThat(session.getPlayerYellow()).isEqualTo("player-b");
    }

    @Test
    @DisplayName("Drop disc updates board and broadcasts GAME_OVER upon winning move")
    void dropDisc_andWinBroadcast() {
        ConnectDropRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("red-id")
                .playerName("Red Player")
                .build());
        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("yellow-id")
                .playerName("Yellow Player")
                .build());

        String sessionId = created.getSessionId();

        // 3 Red horizontal drops at row 5 (cols 0, 1, 2)
        // 3 Yellow drops at row 5 (cols 4, 5, 6)
        service.dropDisc(sessionId, new DropDiscRequest("red-id", 0));
        service.dropDisc(sessionId, new DropDiscRequest("yellow-id", 4));
        service.dropDisc(sessionId, new DropDiscRequest("red-id", 1));
        service.dropDisc(sessionId, new DropDiscRequest("yellow-id", 5));
        service.dropDisc(sessionId, new DropDiscRequest("red-id", 2));
        service.dropDisc(sessionId, new DropDiscRequest("yellow-id", 6));

        // 4th Red drop at col 3 wins!
        ConnectDropEventDto winEvent = service.dropDisc(sessionId, new DropDiscRequest("red-id", 3));

        assertThat(winEvent.getEventType()).isEqualTo("GAME_OVER");
        assertThat(winEvent.getSession().getStatus()).isEqualTo(GameStatus.GAME_OVER);
        assertThat(winEvent.getSession().getWinner()).isEqualTo(DiscColor.RED);
        assertThat(winEvent.getSession().getWinningCells()).hasSize(4);
        assertThat(winEvent.getLastDrop().isWin()).isTrue();

        ArgumentCaptor<ConnectDropEventDto> eventCaptor = ArgumentCaptor.forClass(ConnectDropEventDto.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/connectdrop/" + sessionId), eventCaptor.capture());
    }

    @Test
    @DisplayName("Rematch resets board, swaps colors, and broadcasts REMATCH_STARTED")
    void rematch_swapsColors() {
        ConnectDropRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("original-red")
                .playerName("Alice")
                .build());
        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("original-yellow")
                .playerName("Bob")
                .build());

        String sessionId = created.getSessionId();

        // Drop a disc
        service.dropDisc(sessionId, new DropDiscRequest("original-red", 0));

        // Request rematch
        ConnectDropEventDto rematchEvent = service.requestRematch(sessionId, new RematchRequest("original-yellow"));

        assertThat(rematchEvent.getEventType()).isEqualTo("REMATCH_STARTED");

        ConnectDropSession session = rematchEvent.getSession();
        assertThat(session.getStatus()).isEqualTo(GameStatus.ACTIVE);
        // Previous Yellow (Bob) is now Red!
        assertThat(session.getPlayerRed()).isEqualTo("original-yellow");
        assertThat(session.getPlayerRedName()).isEqualTo("Bob");
        // Previous Red (Alice) is now Yellow!
        assertThat(session.getPlayerYellow()).isEqualTo("original-red");
        assertThat(session.getPlayerYellowName()).isEqualTo("Alice");

        // Red always plays first
        assertThat(session.getCurrentTurn()).isEqualTo(DiscColor.RED);

        // Board must be completely empty
        for (int r = 0; r < ConnectDropEngine.ROWS; r++) {
            for (int c = 0; c < ConnectDropEngine.COLS; c++) {
                assertThat(session.getBoard()[r][c]).isEqualTo(0);
            }
        }
    }
}

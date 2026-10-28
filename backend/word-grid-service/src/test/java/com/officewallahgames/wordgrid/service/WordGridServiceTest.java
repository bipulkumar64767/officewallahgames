package com.officewallahgames.wordgrid.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.wordgrid.dto.ClaimWordRequest;
import com.officewallahgames.wordgrid.dto.CreateRoomRequest;
import com.officewallahgames.wordgrid.dto.JoinRoomRequest;
import com.officewallahgames.wordgrid.dto.PassTurnRequest;
import com.officewallahgames.wordgrid.dto.PlaceLetterRequest;
import com.officewallahgames.wordgrid.dto.WordGridRoomResponse;
import com.officewallahgames.wordgrid.engine.WordGridEngine;
import com.officewallahgames.wordgrid.model.CellCoord;
import com.officewallahgames.wordgrid.model.GameStatus;
import com.officewallahgames.wordgrid.model.PlayerColor;
import com.officewallahgames.wordgrid.model.SlotState;
import com.officewallahgames.wordgrid.model.WordGridSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class WordGridServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private WordGridEngine engine;
    private WordGridService service;

    @BeforeEach
    void setUp() {
        engine = new WordGridEngine();
        engine.initDictionary();
        service = new WordGridService(engine, messagingTemplate);
    }

    @Test
    @DisplayName("Create room sets host as RED and generates WGB- code")
    void testCreateRoom() {
        CreateRoomRequest request = CreateRoomRequest.builder()
                .playerId("user-alice")
                .playerName("Alice")
                .playerCount(2)
                .build();

        WordGridRoomResponse response = service.createRoom(request);

        assertThat(response).isNotNull();
        assertThat(response.getAssignedColor()).isEqualTo(PlayerColor.RED);
        assertThat(response.getPlayerCount()).isEqualTo(2);
        assertThat(response.getRoomCode()).startsWith("WGB-");
        assertThat(response.getStatus()).isEqualTo(GameStatus.WAITING_FOR_PLAYERS);

        WordGridSession session = service.getRoomStatus(response.getRoomCode());
        assertThat(session.getPlayers().get(PlayerColor.RED)).isEqualTo("user-alice");
        assertThat(session.getSlotStates().get(PlayerColor.RED)).isEqualTo(SlotState.ACTIVE);
        assertThat(session.getSlotStates().get(PlayerColor.GREEN)).isEqualTo(SlotState.WAITING);
    }

    @Test
    @DisplayName("Join room assigns next available color slot and activates game when full")
    void testJoinRoom() {
        WordGridRoomResponse hostRoom = service.createRoom(CreateRoomRequest.builder()
                .playerId("user-1")
                .playerName("Alice")
                .playerCount(2)
                .build());

        JoinRoomRequest joinRequest = JoinRoomRequest.builder()
                .roomCode(hostRoom.getRoomCode())
                .playerId("user-2")
                .playerName("Bob")
                .build();

        WordGridRoomResponse joinResponse = service.joinRoom(joinRequest);

        assertThat(joinResponse.getAssignedColor()).isEqualTo(PlayerColor.GREEN);
        assertThat(joinResponse.getStatus()).isEqualTo(GameStatus.ACTIVE);

        // Third player attempt to join 2P room fails
        JoinRoomRequest thirdPlayer = JoinRoomRequest.builder()
                .roomCode(hostRoom.getRoomCode())
                .playerId("user-3")
                .playerName("Charlie")
                .build();

        assertThatThrownBy(() -> service.joinRoom(thirdPlayer))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("already started");
    }

    @Test
    @DisplayName("Get room status returns session and throws exception for invalid room")
    void testGetRoomStatus() {
        WordGridRoomResponse room = service.createRoom(CreateRoomRequest.builder()
                .playerId("user-1")
                .playerName("Alice")
                .playerCount(4)
                .build());

        WordGridSession session = service.getRoomStatus(room.getRoomCode());
        assertThat(session).isNotNull();
        assertThat(session.getSessionId()).isEqualTo(room.getSessionId());

        assertThatThrownBy(() -> service.getRoomStatus("INVALID-CODE"))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Room not found");
    }

    @Test
    @DisplayName("Quick match pairs players together into the same room")
    void testQuickMatchPairing() {
        // Player 1 quick matches
        WordGridRoomResponse r1 = service.quickMatch("user-p1", "Player1", 2);
        assertThat(r1.getAssignedColor()).isEqualTo(PlayerColor.RED);
        assertThat(r1.getStatus()).isEqualTo(GameStatus.WAITING_FOR_PLAYERS);

        // Player 2 quick matches with same player count -> should pair into Player 1's room
        WordGridRoomResponse r2 = service.quickMatch("user-p2", "Player2", 2);
        assertThat(r2.getRoomCode()).isEqualTo(r1.getRoomCode());
        assertThat(r2.getAssignedColor()).isEqualTo(PlayerColor.GREEN);
        assertThat(r2.getStatus()).isEqualTo(GameStatus.ACTIVE);
    }

    @Test
    @DisplayName("Letter placement validates turn, bounds, and enforces one letter per turn")
    void testLetterPlacement() {
        WordGridRoomResponse host = service.createRoom(CreateRoomRequest.builder()
                .playerId("user-1")
                .playerName("Alice")
                .playerCount(2)
                .build());

        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(host.getRoomCode())
                .playerId("user-2")
                .playerName("Bob")
                .build());

        String sessionId = host.getSessionId();

        // Valid letter placement by RED
        PlaceLetterRequest req = PlaceLetterRequest.builder()
                .playerId("user-1")
                .color(PlayerColor.RED)
                .row(0)
                .col(0)
                .letter("C")
                .build();

        service.placeLetter(sessionId, req);

        WordGridSession session = service.getSessionById(sessionId);
        assertThat(session.getGrid()[0][0]).isEqualTo('C');
        assertThat(session.getCellOwners()[0][0]).isEqualTo(PlayerColor.RED);
        assertThat(session.isHasPlacedLetter()).isTrue();

        // Second placement in same turn should fail
        PlaceLetterRequest req2 = PlaceLetterRequest.builder()
                .playerId("user-1")
                .color(PlayerColor.RED)
                .row(0)
                .col(1)
                .letter("A")
                .build();

        assertThatThrownBy(() -> service.placeLetter(sessionId, req2))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("already been placed this turn");

        // Action by GREEN when it's RED's turn should fail
        PlaceLetterRequest greenReq = PlaceLetterRequest.builder()
                .playerId("user-2")
                .color(PlayerColor.GREEN)
                .row(0)
                .col(1)
                .letter("A")
                .build();

        assertThatThrownBy(() -> service.placeLetter(sessionId, greenReq))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("It is not GREEN's turn");
    }

    @Test
    @DisplayName("Claim word validates word, updates scores & cell owners, penalizes invalid claims, and advances turn")
    void testClaimWord() {
        WordGridRoomResponse host = service.createRoom(CreateRoomRequest.builder()
                .playerId("user-1")
                .playerName("Alice")
                .playerCount(2)
                .build());

        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(host.getRoomCode())
                .playerId("user-2")
                .playerName("Bob")
                .build());

        String sessionId = host.getSessionId();
        WordGridSession session = service.getSessionById(sessionId);

        // Pre-place letters for "CAT"
        session.getGrid()[0][0] = 'C';
        session.getGrid()[0][1] = 'A';
        session.getGrid()[0][2] = 'T';

        List<CellCoord> catPath = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 1),
                new CellCoord(0, 2)
        );

        // RED claims "CAT"
        ClaimWordRequest claimCat = ClaimWordRequest.builder()
                .playerId("user-1")
                .color(PlayerColor.RED)
                .path(catPath)
                .word("CAT")
                .build();

        service.claimWord(sessionId, claimCat);

        assertThat(session.getScores().get(PlayerColor.RED)).isEqualTo(2); // +2 pts
        assertThat(session.getClaimedWords()).contains("CAT");
        assertThat(session.getCellOwners()[0][0]).isEqualTo(PlayerColor.RED);
        assertThat(session.getCellOwners()[0][1]).isEqualTo(PlayerColor.RED);
        assertThat(session.getCellOwners()[0][2]).isEqualTo(PlayerColor.RED);
        assertThat(session.getCurrentTurn()).isEqualTo(PlayerColor.GREEN); // Turn rotated to GREEN

        // Now GREEN attempts an invalid word claim
        List<CellCoord> invalidPath = List.of(
                new CellCoord(1, 0),
                new CellCoord(1, 1),
                new CellCoord(1, 2)
        );
        session.getGrid()[1][0] = 'X';
        session.getGrid()[1][1] = 'Y';
        session.getGrid()[1][2] = 'Z';

        ClaimWordRequest claimInvalid = ClaimWordRequest.builder()
                .playerId("user-2")
                .color(PlayerColor.GREEN)
                .path(invalidPath)
                .word("XYZ")
                .build();

        service.claimWord(sessionId, claimInvalid);

        assertThat(session.getScores().get(PlayerColor.GREEN)).isEqualTo(-1); // -1 pt penalty
        assertThat(session.getCurrentTurn()).isEqualTo(PlayerColor.RED); // Rotated back to RED
    }

    @Test
    @DisplayName("Pass turn advances turn to next active player and resets turn state")
    void testPassTurn() {
        WordGridRoomResponse host = service.createRoom(CreateRoomRequest.builder()
                .playerId("user-1")
                .playerName("Alice")
                .playerCount(2)
                .build());

        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(host.getRoomCode())
                .playerId("user-2")
                .playerName("Bob")
                .build());

        String sessionId = host.getSessionId();
        WordGridSession session = service.getSessionById(sessionId);

        assertThat(session.getCurrentTurn()).isEqualTo(PlayerColor.RED);

        // Place a letter first
        service.placeLetter(sessionId, PlaceLetterRequest.builder()
                .playerId("user-1")
                .color(PlayerColor.RED)
                .row(5)
                .col(5)
                .letter("W")
                .build());

        assertThat(session.isHasPlacedLetter()).isTrue();

        // Pass turn
        service.passTurn(sessionId, PassTurnRequest.builder()
                .playerId("user-1")
                .color(PlayerColor.RED)
                .build());

        assertThat(session.getCurrentTurn()).isEqualTo(PlayerColor.GREEN);
        assertThat(session.isHasPlacedLetter()).isFalse();
    }
}

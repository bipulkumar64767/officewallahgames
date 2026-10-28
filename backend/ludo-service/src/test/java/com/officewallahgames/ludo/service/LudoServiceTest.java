package com.officewallahgames.ludo.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.ludo.dto.CreateRoomRequest;
import com.officewallahgames.ludo.dto.JoinRoomRequest;
import com.officewallahgames.ludo.dto.LudoRoomResponse;
import com.officewallahgames.ludo.dto.MoveTokenRequest;
import com.officewallahgames.ludo.dto.RollDiceRequest;
import com.officewallahgames.ludo.engine.LudoEngine;
import com.officewallahgames.ludo.model.GameStatus;
import com.officewallahgames.ludo.model.LudoSession;
import com.officewallahgames.ludo.model.LudoToken;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.model.SlotState;
import com.officewallahgames.ludo.model.TokenState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class LudoServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private LudoEngine engine;
    private LudoService service;

    @BeforeEach
    void setUp() {
        engine = new LudoEngine();
        service = new LudoService(engine, messagingTemplate);
    }

    @Test
    @DisplayName("Create room sets host as RED and configures slots based on playerCount")
    void testCreateRoom() {
        CreateRoomRequest request = CreateRoomRequest.builder()
                .playerId("user-1")
                .playerName("Alice")
                .playerCount(2)
                .build();

        LudoRoomResponse response = service.createRoom(request);

        assertThat(response).isNotNull();
        assertThat(response.getAssignedColor()).isEqualTo(PlayerColor.RED);
        assertThat(response.getPlayerCount()).isEqualTo(2);
        assertThat(response.getSlotStates().get(PlayerColor.RED)).isEqualTo(SlotState.ACTIVE);
        assertThat(response.getSlotStates().get(PlayerColor.YELLOW)).isEqualTo(SlotState.WAITING);
        assertThat(response.getSlotStates().get(PlayerColor.GREEN)).isEqualTo(SlotState.INACTIVE_SETUP);
        assertThat(response.getSlotStates().get(PlayerColor.BLUE)).isEqualTo(SlotState.INACTIVE_SETUP);
        assertThat(response.getStatus()).isEqualTo(GameStatus.WAITING_FOR_PLAYERS);
        assertThat(response.getRoomCode()).startsWith("LDO-");
    }

    @Test
    @DisplayName("Join room assigns waiting color and starts game when room is full")
    void testJoinRoomAndGameActivation() {
        LudoRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("host-1")
                .playerName("Host")
                .playerCount(2)
                .build());

        JoinRoomRequest joinReq = JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("joiner-2")
                .playerName("Bob")
                .build();

        LudoRoomResponse joined = service.joinRoom(joinReq);

        assertThat(joined.getAssignedColor()).isEqualTo(PlayerColor.YELLOW);
        assertThat(joined.getStatus()).isEqualTo(GameStatus.ACTIVE);
        assertThat(joined.getSession().getPlayers().get(PlayerColor.YELLOW)).isEqualTo("joiner-2");
        assertThat(joined.getSession().getCurrentTurn()).isEqualTo(PlayerColor.RED);
    }

    @Test
    @DisplayName("Get room status returns correct active session")
    void testGetRoomStatus() {
        LudoRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("p1")
                .playerName("Player 1")
                .playerCount(4)
                .build());

        LudoSession session = service.getRoomStatus(created.getRoomCode());
        assertThat(session).isNotNull();
        assertThat(session.getSessionId()).isEqualTo(created.getSessionId());
        assertThat(session.getPlayerCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("Quick-match pairs players into a session seamlessly")
    void testQuickMatchPairing() {
        LudoRoomResponse p1 = service.quickMatch("p1", "Player 1", 2);
        assertThat(p1.getAssignedColor()).isEqualTo(PlayerColor.RED);
        assertThat(p1.getStatus()).isEqualTo(GameStatus.WAITING_FOR_PLAYERS);

        LudoRoomResponse p2 = service.quickMatch("p2", "Player 2", 2);
        assertThat(p2.getAssignedColor()).isEqualTo(PlayerColor.YELLOW);
        assertThat(p2.getStatus()).isEqualTo(GameStatus.ACTIVE);
        assertThat(p2.getSessionId()).isEqualTo(p1.getSessionId());
    }

    @Test
    @DisplayName("Roll dice validates player turn and ownership")
    void testRollDiceTurnValidation() {
        LudoRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("host-1")
                .playerCount(2)
                .build());

        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("joiner-2")
                .build());

        // Attempting to roll with wrong player
        RollDiceRequest wrongPlayerReq = RollDiceRequest.builder()
                .playerId("joiner-2")
                .color(PlayerColor.YELLOW)
                .build();

        assertThatThrownBy(() -> service.rollDice(created.getSessionId(), wrongPlayerReq))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("It is not YELLOW's turn");
    }

    @Test
    @DisplayName("Three consecutive sixes penalty forfeits turn and cycles to next player")
    void testThreeConsecutiveSixesPenalty() {
        LudoRoomResponse created = service.createRoom(CreateRoomRequest.builder()
                .playerId("host-1")
                .playerCount(2)
                .build());

        service.joinRoom(JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("joiner-2")
                .build());

        LudoSession session = service.getSessionById(created.getSessionId());
        session.setConsecutiveSixes(2); // Simulate 2 prior 6s

        // Create a custom engine subclass that forces rolling a 6
        LudoEngine forcedSixEngine = new LudoEngine() {
            @Override
            public int rollDice() {
                return 6;
            }
        };

        LudoService customService = new LudoService(forcedSixEngine, messagingTemplate);
        // Inject session
        LudoRoomResponse customCreated = customService.createRoom(CreateRoomRequest.builder()
                .playerId("host-1")
                .playerCount(2)
                .build());
        customService.joinRoom(JoinRoomRequest.builder()
                .roomCode(customCreated.getRoomCode())
                .playerId("joiner-2")
                .build());

        LudoSession customSession = customService.getSessionById(customCreated.getSessionId());
        customSession.setConsecutiveSixes(2);

        LudoSession afterRoll = customService.rollDice(customCreated.getSessionId(), RollDiceRequest.builder()
                .playerId("host-1")
                .color(PlayerColor.RED)
                .build());

        // 3 consecutive 6s -> turn skipped and cycled to YELLOW
        assertThat(afterRoll.getCurrentTurn()).isEqualTo(PlayerColor.YELLOW);
        assertThat(afterRoll.getConsecutiveSixes()).isEqualTo(0);
        assertThat(afterRoll.isHasRolled()).isFalse();
    }

    @Test
    @DisplayName("Move token validates roll state and moves token")
    void testMoveTokenExecution() {
        LudoEngine forcedSixEngine = new LudoEngine() {
            @Override
            public int rollDice() {
                return 6;
            }
        };

        LudoService customService = new LudoService(forcedSixEngine, messagingTemplate);
        LudoRoomResponse created = customService.createRoom(CreateRoomRequest.builder()
                .playerId("host-1")
                .playerCount(2)
                .build());
        customService.joinRoom(JoinRoomRequest.builder()
                .roomCode(created.getRoomCode())
                .playerId("joiner-2")
                .build());

        String sessionId = created.getSessionId();

        // Roll a 6
        customService.rollDice(sessionId, RollDiceRequest.builder()
                .playerId("host-1")
                .color(PlayerColor.RED)
                .build());

        // Move R1 out of yard
        LudoSession afterMove = customService.moveToken(sessionId, MoveTokenRequest.builder()
                .playerId("host-1")
                .color(PlayerColor.RED)
                .tokenId("R1")
                .build());

        LudoToken r1 = afterMove.getTokens().stream()
                .filter(t -> t.getTokenId().equals("R1"))
                .findFirst()
                .orElseThrow();

        assertThat(r1.getState()).isEqualTo(TokenState.ON_BOARD);
        assertThat(r1.getPosition()).isEqualTo(1);
        // Bonus turn because roll was 6!
        assertThat(afterMove.getCurrentTurn()).isEqualTo(PlayerColor.RED);
    }
}

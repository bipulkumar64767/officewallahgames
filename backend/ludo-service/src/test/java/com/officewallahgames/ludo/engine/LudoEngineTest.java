package com.officewallahgames.ludo.engine;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.ludo.model.GameStatus;
import com.officewallahgames.ludo.model.LudoSession;
import com.officewallahgames.ludo.model.LudoToken;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.model.SlotState;
import com.officewallahgames.ludo.model.TokenState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LudoEngineTest {

    private LudoEngine engine;

    @BeforeEach
    void setUp() {
        engine = new LudoEngine();
    }

    @Test
    @DisplayName("Slot initialization for 2P, 3P, and 4P configurations")
    void testSlotInitialization() {
        // 2P setup
        Map<PlayerColor, SlotState> slots2P = engine.setupSlots(2);
        assertThat(slots2P.get(PlayerColor.RED)).isEqualTo(SlotState.WAITING);
        assertThat(slots2P.get(PlayerColor.YELLOW)).isEqualTo(SlotState.WAITING);
        assertThat(slots2P.get(PlayerColor.GREEN)).isEqualTo(SlotState.INACTIVE_SETUP);
        assertThat(slots2P.get(PlayerColor.BLUE)).isEqualTo(SlotState.INACTIVE_SETUP);

        List<PlayerColor> order2P = engine.getTurnOrder(2);
        assertThat(order2P).containsExactly(PlayerColor.RED, PlayerColor.YELLOW);

        // 3P setup
        Map<PlayerColor, SlotState> slots3P = engine.setupSlots(3);
        assertThat(slots3P.get(PlayerColor.RED)).isEqualTo(SlotState.WAITING);
        assertThat(slots3P.get(PlayerColor.GREEN)).isEqualTo(SlotState.WAITING);
        assertThat(slots3P.get(PlayerColor.YELLOW)).isEqualTo(SlotState.WAITING);
        assertThat(slots3P.get(PlayerColor.BLUE)).isEqualTo(SlotState.INACTIVE_SETUP);

        List<PlayerColor> order3P = engine.getTurnOrder(3);
        assertThat(order3P).containsExactly(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW);

        // 4P setup
        Map<PlayerColor, SlotState> slots4P = engine.setupSlots(4);
        assertThat(slots4P.get(PlayerColor.RED)).isEqualTo(SlotState.WAITING);
        assertThat(slots4P.get(PlayerColor.GREEN)).isEqualTo(SlotState.WAITING);
        assertThat(slots4P.get(PlayerColor.YELLOW)).isEqualTo(SlotState.WAITING);
        assertThat(slots4P.get(PlayerColor.BLUE)).isEqualTo(SlotState.WAITING);

        List<PlayerColor> order4P = engine.getTurnOrder(4);
        assertThat(order4P).containsExactly(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE);
    }

    @Test
    @DisplayName("Exit from yard allowed only on 6; moves to start cell")
    void testExitFromYardOnSix() {
        LudoToken redToken = LudoToken.createInitial("R1", PlayerColor.RED);

        assertThat(engine.canMoveToken(redToken, 1)).isFalse();
        assertThat(engine.canMoveToken(redToken, 5)).isFalse();
        assertThat(engine.canMoveToken(redToken, 6)).isTrue();

        LudoSession session = LudoSession.builder()
                .turnOrder(List.of(PlayerColor.RED, PlayerColor.YELLOW))
                .slotStates(new ConcurrentHashMap<>(Map.of(
                        PlayerColor.RED, SlotState.ACTIVE,
                        PlayerColor.YELLOW, SlotState.ACTIVE
                )))
                .tokens(new ArrayList<>(List.of(redToken)))
                .currentTurn(PlayerColor.RED)
                .status(GameStatus.ACTIVE)
                .build();

        MoveResult result = engine.moveToken(session, PlayerColor.RED, "R1", 6);

        assertThat(result.getMovedToken().getPosition()).isEqualTo(LudoEngine.START_RED); // cell 1
        assertThat(result.getMovedToken().getState()).isEqualTo(TokenState.ON_BOARD);
        assertThat(result.getMovedToken().getStepCount()).isEqualTo(0);
        assertThat(result.isBonusTurn()).isTrue();
    }

    @Test
    @DisplayName("Track movement advances tokens correctly and rejects overshoot")
    void testTrackMovementAndOvershoot() {
        LudoToken redToken = LudoToken.builder()
                .tokenId("R1")
                .color(PlayerColor.RED)
                .position(1)
                .state(TokenState.ON_BOARD)
                .stepCount(0)
                .build();

        LudoSession session = LudoSession.builder()
                .turnOrder(List.of(PlayerColor.RED, PlayerColor.YELLOW))
                .slotStates(new ConcurrentHashMap<>(Map.of(
                        PlayerColor.RED, SlotState.ACTIVE,
                        PlayerColor.YELLOW, SlotState.ACTIVE
                )))
                .tokens(new ArrayList<>(List.of(redToken)))
                .currentTurn(PlayerColor.RED)
                .status(GameStatus.ACTIVE)
                .build();

        // Move 4 steps
        engine.moveToken(session, PlayerColor.RED, "R1", 4);
        assertThat(redToken.getPosition()).isEqualTo(5);
        assertThat(redToken.getStepCount()).isEqualTo(4);

        // Move into home stretch (step 54 -> pos 55)
        redToken.setStepCount(50);
        redToken.setPosition(51);
        session.setCurrentTurn(PlayerColor.RED);
        engine.moveToken(session, PlayerColor.RED, "R1", 4);
        assertThat(redToken.getStepCount()).isEqualTo(54);
        assertThat(redToken.getPosition()).isEqualTo(55);
        assertThat(redToken.getState()).isEqualTo(TokenState.HOME_COLUMN);

        // Token at step 54: roll 3 should finish (step 57, pos 58), roll 4 overshoots
        assertThat(engine.canMoveToken(redToken, 3)).isTrue();
        assertThat(engine.canMoveToken(redToken, 4)).isFalse(); // 54 + 4 = 58 > 57 overshoots!

        // When token is at step 55 (2 steps from finish): roll 2 finishes, roll 3 overshoots
        redToken.setStepCount(55);
        redToken.setPosition(56);
        assertThat(engine.canMoveToken(redToken, 2)).isTrue();
        assertThat(engine.canMoveToken(redToken, 3)).isFalse();
    }

    @Test
    @DisplayName("Landing on non-safe square occupied by opponent captures opponent token")
    void testCaptureOnNonSafeCell() {
        // Cell 10 is not a safe cell
        LudoToken redToken = LudoToken.builder()
                .tokenId("R1")
                .color(PlayerColor.RED)
                .position(7)
                .state(TokenState.ON_BOARD)
                .stepCount(6)
                .build();

        LudoToken greenToken = LudoToken.builder()
                .tokenId("G1")
                .color(PlayerColor.GREEN)
                .position(10)
                .state(TokenState.ON_BOARD)
                .stepCount(48)
                .build();

        LudoSession session = LudoSession.builder()
                .turnOrder(List.of(PlayerColor.RED, PlayerColor.GREEN))
                .slotStates(new ConcurrentHashMap<>(Map.of(
                        PlayerColor.RED, SlotState.ACTIVE,
                        PlayerColor.GREEN, SlotState.ACTIVE
                )))
                .tokens(new ArrayList<>(List.of(redToken, greenToken)))
                .currentTurn(PlayerColor.RED)
                .status(GameStatus.ACTIVE)
                .build();

        MoveResult result = engine.moveToken(session, PlayerColor.RED, "R1", 3);

        assertThat(redToken.getPosition()).isEqualTo(10);
        assertThat(result.getCapturedTokens()).hasSize(1);
        assertThat(result.getCapturedTokens().get(0).getTokenId()).isEqualTo("G1");
        assertThat(greenToken.getState()).isEqualTo(TokenState.HOME_YARD);
        assertThat(greenToken.getPosition()).isEqualTo(-1);
        assertThat(greenToken.getStepCount()).isEqualTo(-1);
    }

    @Test
    @DisplayName("Safe cells provide immunity from capture")
    void testSafeCellImmunity() {
        // Cell 9 is STAR_RED (safe cell)
        LudoToken greenToken = LudoToken.builder()
                .tokenId("G1")
                .color(PlayerColor.GREEN)
                .position(9)
                .state(TokenState.ON_BOARD)
                .stepCount(47)
                .build();

        LudoToken redToken = LudoToken.builder()
                .tokenId("R1")
                .color(PlayerColor.RED)
                .position(6)
                .state(TokenState.ON_BOARD)
                .stepCount(5)
                .build();

        LudoSession session = LudoSession.builder()
                .turnOrder(List.of(PlayerColor.RED, PlayerColor.GREEN))
                .slotStates(new ConcurrentHashMap<>(Map.of(
                        PlayerColor.RED, SlotState.ACTIVE,
                        PlayerColor.GREEN, SlotState.ACTIVE
                )))
                .tokens(new ArrayList<>(List.of(redToken, greenToken)))
                .currentTurn(PlayerColor.RED)
                .status(GameStatus.ACTIVE)
                .build();

        MoveResult result = engine.moveToken(session, PlayerColor.RED, "R1", 3);

        assertThat(redToken.getPosition()).isEqualTo(9);
        assertThat(greenToken.getPosition()).isEqualTo(9);
        assertThat(greenToken.getState()).isEqualTo(TokenState.ON_BOARD);
        assertThat(result.getCapturedTokens()).isEmpty();
    }

    @Test
    @DisplayName("Turn rotation automatically skips INACTIVE_SETUP and OFFLINE slots")
    void testTurnRotationSkipsInactiveSlots() {
        LudoSession session = LudoSession.builder()
                .turnOrder(List.of(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE))
                .slotStates(new ConcurrentHashMap<>(Map.of(
                        PlayerColor.RED, SlotState.ACTIVE,
                        PlayerColor.GREEN, SlotState.OFFLINE,
                        PlayerColor.YELLOW, SlotState.ACTIVE,
                        PlayerColor.BLUE, SlotState.INACTIVE_SETUP
                )))
                .currentTurn(PlayerColor.RED)
                .status(GameStatus.ACTIVE)
                .build();

        engine.cycleTurn(session);

        // Skips GREEN (OFFLINE), next active is YELLOW
        assertThat(session.getCurrentTurn()).isEqualTo(PlayerColor.YELLOW);

        engine.cycleTurn(session);

        // Skips BLUE (INACTIVE_SETUP), cycles back to RED
        assertThat(session.getCurrentTurn()).isEqualTo(PlayerColor.RED);
    }

    @Test
    @DisplayName("Winning with all 4 tokens finished records rank and ends game")
    void testWinningAllFourTokens() {
        LudoToken r1 = LudoToken.builder().tokenId("R1").color(PlayerColor.RED).state(TokenState.FINISHED).stepCount(57).position(58).build();
        LudoToken r2 = LudoToken.builder().tokenId("R2").color(PlayerColor.RED).state(TokenState.FINISHED).stepCount(57).position(58).build();
        LudoToken r3 = LudoToken.builder().tokenId("R3").color(PlayerColor.RED).state(TokenState.FINISHED).stepCount(57).position(58).build();
        LudoToken r4 = LudoToken.builder().tokenId("R4").color(PlayerColor.RED).state(TokenState.HOME_COLUMN).stepCount(56).position(57).build();

        LudoToken y1 = LudoToken.builder().tokenId("Y1").color(PlayerColor.YELLOW).state(TokenState.ON_BOARD).stepCount(20).position(47).build();

        LudoSession session = LudoSession.builder()
                .turnOrder(List.of(PlayerColor.RED, PlayerColor.YELLOW))
                .slotStates(new ConcurrentHashMap<>(Map.of(
                        PlayerColor.RED, SlotState.ACTIVE,
                        PlayerColor.YELLOW, SlotState.ACTIVE
                )))
                .tokens(new ArrayList<>(List.of(r1, r2, r3, r4, y1)))
                .currentTurn(PlayerColor.RED)
                .status(GameStatus.ACTIVE)
                .rankings(new ArrayList<>())
                .build();

        MoveResult result = engine.moveToken(session, PlayerColor.RED, "R4", 1);

        assertThat(r4.getState()).isEqualTo(TokenState.FINISHED);
        assertThat(r4.getPosition()).isEqualTo(58);
        assertThat(result.isPlayerRanked()).isTrue();
        assertThat(result.isGameOver()).isTrue();
        assertThat(session.getRankings()).containsExactly(PlayerColor.RED, PlayerColor.YELLOW);
        assertThat(session.getStatus()).isEqualTo(GameStatus.COMPLETED);
    }
}

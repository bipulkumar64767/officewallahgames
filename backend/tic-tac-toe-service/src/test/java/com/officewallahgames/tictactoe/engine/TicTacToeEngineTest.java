package com.officewallahgames.tictactoe.engine;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.tictactoe.dto.MoveMessage;
import com.officewallahgames.tictactoe.model.GameSession;
import com.officewallahgames.tictactoe.model.GameStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TicTacToeEngineTest {

    private TicTacToeEngine engine;
    private GameSession session;

    @BeforeEach
    void setUp() {
        engine = new TicTacToeEngine();
        session = GameSession.builder()
                .sessionId("test-session")
                .roomCode("TTT-TEST")
                .playerX("player-1")
                .playerXName("Alice")
                .playerO("player-2")
                .playerOName("Bob")
                .board(new String[9])
                .currentTurn("X")
                .status(GameStatus.ACTIVE)
                .build();
    }

    @Test
    @DisplayName("Verify Row win condition (Row 1: positions 0, 1, 2)")
    void testRowWin() {
        // X plays 0
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(0).symbol("X").build());
        assertEquals("O", session.getCurrentTurn());

        // O plays 3
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(3).symbol("O").build());
        assertEquals("X", session.getCurrentTurn());

        // X plays 1
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(1).symbol("X").build());

        // O plays 4
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(4).symbol("O").build());

        // X plays 2 (wins row 1)
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(2).symbol("X").build());

        assertEquals(GameStatus.COMPLETED, session.getStatus());
        assertEquals("X", session.getWinner());
        assertEquals(List.of(0, 1, 2), session.getWinningPattern());
    }

    @Test
    @DisplayName("Verify Column win condition (Column 2: positions 1, 4, 7)")
    void testColumnWin() {
        // X plays 0
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(0).symbol("X").build());
        // O plays 1
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(1).symbol("O").build());
        // X plays 2
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(2).symbol("X").build());
        // O plays 4
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(4).symbol("O").build());
        // X plays 3
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(3).symbol("X").build());
        // O plays 7 (wins column 2)
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(7).symbol("O").build());

        assertEquals(GameStatus.COMPLETED, session.getStatus());
        assertEquals("O", session.getWinner());
        assertEquals(List.of(1, 4, 7), session.getWinningPattern());
    }

    @Test
    @DisplayName("Verify Diagonal win condition (Diagonal: positions 0, 4, 8 and 2, 4, 6)")
    void testDiagonalWin() {
        // X plays 0
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(0).symbol("X").build());
        // O plays 1
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(1).symbol("O").build());
        // X plays 4
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(4).symbol("X").build());
        // O plays 2
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(2).symbol("O").build());
        // X plays 8 (wins diagonal 0-4-8)
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(8).symbol("X").build());

        assertEquals(GameStatus.COMPLETED, session.getStatus());
        assertEquals("X", session.getWinner());
        assertEquals(List.of(0, 4, 8), session.getWinningPattern());
    }

    @Test
    @DisplayName("Verify Draw condition when 9 cells are filled with no 3-in-a-row")
    void testDrawGame() {
        /*
          Grid layout for draw:
          X O X
          X X O
          O X O

          0: X, 1: O, 2: X
          3: X, 4: X, 5: O
          6: O, 7: X, 8: O
        */
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(0).symbol("X").build()); // X
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(1).symbol("O").build()); // O
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(2).symbol("X").build()); // X
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(5).symbol("O").build()); // O
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(3).symbol("X").build()); // X
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(6).symbol("O").build()); // O
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(4).symbol("X").build()); // X
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(8).symbol("O").build()); // O
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(7).symbol("X").build()); // X

        assertEquals(GameStatus.COMPLETED, session.getStatus());
        assertEquals("DRAW", session.getWinner());
        assertNull(session.getWinningPattern());
    }

    @Test
    @DisplayName("Verify invalid move throws GameException when cell is occupied")
    void testInvalidMoveOccupiedCell() {
        engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(0).symbol("X").build());

        assertThrows(GameException.class, () ->
                engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(0).symbol("O").build()));
    }

    @Test
    @DisplayName("Verify invalid move throws GameException when out of bounds")
    void testInvalidMoveOutOfBounds() {
        assertThrows(GameException.class, () ->
                engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(-1).symbol("X").build()));

        assertThrows(GameException.class, () ->
                engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(9).symbol("X").build()));
    }

    @Test
    @DisplayName("Verify invalid move throws GameException when playing out of turn")
    void testInvalidMoveWrongTurn() {
        // Player O tries to play first when it's X's turn
        assertThrows(GameException.class, () ->
                engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-2").position(0).symbol("O").build()));
    }

    @Test
    @DisplayName("Verify invalid move throws GameException when game is not active")
    void testInvalidMoveWhenGameNotActive() {
        session.setStatus(GameStatus.WAITING_FOR_OPPONENT);
        assertThrows(GameException.class, () ->
                engine.validateAndApplyMove(session, MoveMessage.builder().playerId("player-1").position(0).symbol("X").build()));
    }
}

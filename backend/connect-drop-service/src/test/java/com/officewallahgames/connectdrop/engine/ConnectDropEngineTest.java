package com.officewallahgames.connectdrop.engine;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.model.DiscColor;
import com.officewallahgames.connectdrop.model.DropResult;
import com.officewallahgames.connectdrop.model.GameStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConnectDropEngineTest {

    private ConnectDropEngine engine;

    @BeforeEach
    void setUp() {
        engine = new ConnectDropEngine();
    }

    @Test
    @DisplayName("Horizontal win is detected with exact 4 winning coordinate pairs")
    void horizontalWin_detected() {
        int[][] board = new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS];

        // Drop 3 RED discs in row 5 at cols 0, 1, 2
        engine.dropDisc(board, DiscColor.RED, 0);
        engine.dropDisc(board, DiscColor.RED, 1);
        engine.dropDisc(board, DiscColor.RED, 2);

        // 4th drop completes the horizontal line at col 3
        DropResult result = engine.dropDisc(board, DiscColor.RED, 3);

        assertThat(result.isWin()).isTrue();
        assertThat(result.isDraw()).isFalse();
        assertThat(result.getRow()).isEqualTo(5);
        assertThat(result.getCol()).isEqualTo(3);
        assertThat(result.getColor()).isEqualTo(DiscColor.RED);

        List<int[]> winningCells = result.getWinningCells();
        assertThat(winningCells).hasSize(4);
        assertThat(winningCells.get(0)).containsExactly(5, 0);
        assertThat(winningCells.get(1)).containsExactly(5, 1);
        assertThat(winningCells.get(2)).containsExactly(5, 2);
        assertThat(winningCells.get(3)).containsExactly(5, 3);
    }

    @Test
    @DisplayName("Vertical win is detected with exact 4 winning coordinate pairs")
    void verticalWin_detected() {
        int[][] board = new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS];

        // Drop 3 YELLOW discs in col 4 (landing at rows 5, 4, 3)
        engine.dropDisc(board, DiscColor.YELLOW, 4);
        engine.dropDisc(board, DiscColor.YELLOW, 4);
        engine.dropDisc(board, DiscColor.YELLOW, 4);

        // 4th drop lands at row 2
        DropResult result = engine.dropDisc(board, DiscColor.YELLOW, 4);

        assertThat(result.isWin()).isTrue();
        assertThat(result.isDraw()).isFalse();
        assertThat(result.getRow()).isEqualTo(2);
        assertThat(result.getCol()).isEqualTo(4);

        List<int[]> winningCells = result.getWinningCells();
        assertThat(winningCells).hasSize(4);
        assertThat(winningCells.get(0)).containsExactly(2, 4);
        assertThat(winningCells.get(1)).containsExactly(3, 4);
        assertThat(winningCells.get(2)).containsExactly(4, 4);
        assertThat(winningCells.get(3)).containsExactly(5, 4);
    }

    @Test
    @DisplayName("Diagonal ascending win (bottom-left to top-right) is detected")
    void diagonalAscendingWin_detected() {
        int[][] board = new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS];

        // We want RED at (5,0), (4,1), (3,2), (2,3)
        // Col 0: 1 RED (row 5)
        engine.dropDisc(board, DiscColor.RED, 0);

        // Col 1: 1 YELLOW, then 1 RED (row 4)
        engine.dropDisc(board, DiscColor.YELLOW, 1);
        engine.dropDisc(board, DiscColor.RED, 1);

        // Col 2: 2 YELLOWs, then 1 RED (row 3)
        engine.dropDisc(board, DiscColor.YELLOW, 2);
        engine.dropDisc(board, DiscColor.YELLOW, 2);
        engine.dropDisc(board, DiscColor.RED, 2);

        // Col 3: 3 YELLOWs, then 1 RED (row 2)
        engine.dropDisc(board, DiscColor.YELLOW, 3);
        engine.dropDisc(board, DiscColor.YELLOW, 3);
        engine.dropDisc(board, DiscColor.YELLOW, 3);
        DropResult result = engine.dropDisc(board, DiscColor.RED, 3);

        assertThat(result.isWin()).isTrue();
        assertThat(result.isDraw()).isFalse();
        assertThat(result.getRow()).isEqualTo(2);
        assertThat(result.getCol()).isEqualTo(3);

        List<int[]> winningCells = result.getWinningCells();
        assertThat(winningCells).hasSize(4);
        assertThat(winningCells.get(0)).containsExactly(5, 0);
        assertThat(winningCells.get(1)).containsExactly(4, 1);
        assertThat(winningCells.get(2)).containsExactly(3, 2);
        assertThat(winningCells.get(3)).containsExactly(2, 3);
    }

    @Test
    @DisplayName("Diagonal descending win (top-left to bottom-right) is detected")
    void diagonalDescendingWin_detected() {
        int[][] board = new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS];

        // We want RED at (2,0), (3,1), (4,2), (5,3)
        // Col 0: 3 YELLOWs, then 1 RED (row 2)
        engine.dropDisc(board, DiscColor.YELLOW, 0);
        engine.dropDisc(board, DiscColor.YELLOW, 0);
        engine.dropDisc(board, DiscColor.YELLOW, 0);
        engine.dropDisc(board, DiscColor.RED, 0);

        // Col 1: 2 YELLOWs, then 1 RED (row 3)
        engine.dropDisc(board, DiscColor.YELLOW, 1);
        engine.dropDisc(board, DiscColor.YELLOW, 1);
        engine.dropDisc(board, DiscColor.RED, 1);

        // Col 2: 1 YELLOW, then 1 RED (row 4)
        engine.dropDisc(board, DiscColor.YELLOW, 2);
        engine.dropDisc(board, DiscColor.RED, 2);

        // Col 3: 1 RED (row 5)
        DropResult result = engine.dropDisc(board, DiscColor.RED, 3);

        assertThat(result.isWin()).isTrue();
        assertThat(result.isDraw()).isFalse();
        assertThat(result.getRow()).isEqualTo(5);
        assertThat(result.getCol()).isEqualTo(3);

        List<int[]> winningCells = result.getWinningCells();
        assertThat(winningCells).hasSize(4);
        assertThat(winningCells.get(0)).containsExactly(2, 0);
        assertThat(winningCells.get(1)).containsExactly(3, 1);
        assertThat(winningCells.get(2)).containsExactly(4, 2);
        assertThat(winningCells.get(3)).containsExactly(5, 3);
    }

    @Test
    @DisplayName("Column full rejection throws GameException when row 0 is occupied")
    void columnFull_throwsException() {
        int[][] board = new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS];

        // Fill column 2 to the top (6 discs)
        for (int i = 0; i < ConnectDropEngine.ROWS; i++) {
            engine.dropDisc(board, DiscColor.RED, 2);
        }

        assertThat(board[0][2]).isEqualTo(DiscColor.RED.getValue());

        // 7th attempt must throw GameException
        assertThatThrownBy(() -> engine.dropDisc(board, DiscColor.YELLOW, 2))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Column 2 is full");

        // Invalid columns
        assertThatThrownBy(() -> engine.dropDisc(board, DiscColor.RED, -1))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Invalid column");

        assertThatThrownBy(() -> engine.dropDisc(board, DiscColor.RED, 7))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Invalid column");
    }

    @Test
    @DisplayName("Draw condition is detected when all 42 cells are filled without a win")
    void drawCondition_detected() {
        // Pattern with max run of 2 in any direction (horizontal, vertical, diagonal):
        // Rows 0,1: 1 2 1 2 1 2 1
        // Rows 2,3: 2 1 2 1 2 1 2
        // Rows 4,5: 1 2 1 2 1 2 1
        int[][] board = new int[][]{
                {0, 2, 1, 2, 1, 2, 1}, // (0,0) left empty for final drop
                {1, 2, 1, 2, 1, 2, 1},
                {2, 1, 2, 1, 2, 1, 2},
                {2, 1, 2, 1, 2, 1, 2},
                {1, 2, 1, 2, 1, 2, 1},
                {1, 2, 1, 2, 1, 2, 1}
        };

        // Check no win prior to final drop
        assertThat(engine.checkWin(board, DiscColor.RED)).isNull();
        assertThat(engine.checkWin(board, DiscColor.YELLOW)).isNull();

        // Final drop in col 0 lands at row 0 by RED
        DropResult result = engine.dropDisc(board, DiscColor.RED, 0);

        assertThat(result.isWin()).isFalse();
        assertThat(result.isDraw()).isTrue();
        assertThat(result.getRow()).isEqualTo(0);
        assertThat(result.getCol()).isEqualTo(0);
        assertThat(engine.isBoardFull(board)).isTrue();
    }

    @Test
    @DisplayName("Turn alternation is strictly enforced and toggles turn")
    void turnAlternation_enforced() {
        ConnectDropSession session = ConnectDropSession.builder()
                .sessionId("test-session")
                .roomCode("CND-TEST")
                .playerRed("red-player-id")
                .playerRedName("Red")
                .playerYellow("yellow-player-id")
                .playerYellowName("Yellow")
                .board(new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS])
                .currentTurn(DiscColor.RED)
                .status(GameStatus.ACTIVE)
                .build();

        // Yellow attempts to play when it's Red's turn -> throws GameException
        assertThatThrownBy(() -> engine.validateAndApplyDrop(session, "yellow-player-id", 3))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Not your turn");

        // Red plays col 3
        DropResult redResult = engine.validateAndApplyDrop(session, "red-player-id", 3);
        assertThat(redResult.isWin()).isFalse();
        assertThat(redResult.getColor()).isEqualTo(DiscColor.RED);
        assertThat(session.getCurrentTurn()).isEqualTo(DiscColor.YELLOW);

        // Red attempts to play again -> throws GameException
        assertThatThrownBy(() -> engine.validateAndApplyDrop(session, "red-player-id", 3))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Not your turn");

        // Yellow plays col 3
        DropResult yellowResult = engine.validateAndApplyDrop(session, "yellow-player-id", 3);
        assertThat(yellowResult.isWin()).isFalse();
        assertThat(yellowResult.getColor()).isEqualTo(DiscColor.YELLOW);
        assertThat(session.getCurrentTurn()).isEqualTo(DiscColor.RED);
    }
}

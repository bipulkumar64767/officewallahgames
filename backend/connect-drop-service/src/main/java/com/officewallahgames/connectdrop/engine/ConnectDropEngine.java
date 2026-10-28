package com.officewallahgames.connectdrop.engine;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.model.DiscColor;
import com.officewallahgames.connectdrop.model.DropResult;
import com.officewallahgames.connectdrop.model.GameStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class ConnectDropEngine {

    public static final int ROWS = 6;
    public static final int COLS = 7;

    /**
     * Validates player turn and column, calculates gravity row, updates board,
     * checks for win or draw, and toggles turn if game is still active.
     */
    public DropResult validateAndApplyDrop(ConnectDropSession session, String playerId, int col) {
        if (session == null) {
            throw new GameException("Game session cannot be null");
        }
        if (session.getStatus() != GameStatus.ACTIVE) {
            throw new GameException("Game is not active. Current status: " + session.getStatus());
        }

        DiscColor currentTurn = session.getCurrentTurn();
        if (currentTurn == DiscColor.RED) {
            if (playerId == null || !playerId.equals(session.getPlayerRed())) {
                throw new GameException("Not your turn. Current turn: RED (" + session.getPlayerRedName() + ")");
            }
        } else if (currentTurn == DiscColor.YELLOW) {
            if (playerId == null || !playerId.equals(session.getPlayerYellow())) {
                throw new GameException("Not your turn. Current turn: YELLOW (" + session.getPlayerYellowName() + ")");
            }
        }

        if (col < 0 || col >= COLS) {
            throw new GameException("Invalid column: " + col + ". Column must be between 0 and " + (COLS - 1));
        }

        int[][] board = session.getBoard();
        if (board[0][col] != 0) {
            throw new GameException("Column " + col + " is full");
        }

        int targetRow = findLowestAvailableRow(board, col);
        board[targetRow][col] = currentTurn.getValue();

        List<int[]> winningCells = checkWin(board, currentTurn);
        boolean isWin = (winningCells != null && !winningCells.isEmpty());
        boolean isDraw = !isWin && isBoardFull(board);

        if (isWin) {
            session.setWinner(currentTurn);
            session.setWinningCells(winningCells);
            session.setStatus(GameStatus.GAME_OVER);
        } else if (isDraw) {
            session.setWinner(null);
            session.setWinningCells(null);
            session.setStatus(GameStatus.GAME_OVER);
        } else {
            session.setCurrentTurn(currentTurn.other());
            session.setTurnStartedAt(System.currentTimeMillis());
        }

        session.setUpdatedAt(Instant.now());

        return DropResult.builder()
                .row(targetRow)
                .col(col)
                .color(currentTurn)
                .winningCells(winningCells)
                .isWin(isWin)
                .isDraw(isDraw)
                .build();
    }

    /**
     * Pure engine drop disc on a given board without session state.
     */
    public DropResult dropDisc(int[][] board, DiscColor color, int col) {
        if (col < 0 || col >= COLS) {
            throw new GameException("Invalid column: " + col + ". Column must be between 0 and " + (COLS - 1));
        }

        if (board[0][col] != 0) {
            throw new GameException("Column " + col + " is full");
        }

        int targetRow = findLowestAvailableRow(board, col);
        board[targetRow][col] = color.getValue();

        List<int[]> winningCells = checkWin(board, color);
        boolean isWin = (winningCells != null && !winningCells.isEmpty());
        boolean isDraw = !isWin && isBoardFull(board);

        return DropResult.builder()
                .row(targetRow)
                .col(col)
                .color(color)
                .winningCells(winningCells)
                .isWin(isWin)
                .isDraw(isDraw)
                .build();
    }

    /**
     * Finds the lowest available row index in the specified column (from row 5 up to row 0).
     */
    public int findLowestAvailableRow(int[][] board, int col) {
        for (int r = ROWS - 1; r >= 0; r--) {
            if (board[r][col] == 0) {
                return r;
            }
        }
        throw new GameException("Column " + col + " is full");
    }

    /**
     * Scans the board to find exact 4 winning coordinate pairs [[r,c],[r,c],[r,c],[r,c]]
     * for the given color horizontally, vertically, diagonally ascending, and diagonally descending.
     */
    public List<int[]> checkWin(int[][] board, DiscColor color) {
        int target = color.getValue();

        // 1. Horizontal win (delta: 0, +1)
        for (int r = 0; r < ROWS; r++) {
            for (int c = 0; c <= COLS - 4; c++) {
                if (board[r][c] == target &&
                        board[r][c + 1] == target &&
                        board[r][c + 2] == target &&
                        board[r][c + 3] == target) {
                    List<int[]> cells = new ArrayList<>(4);
                    cells.add(new int[]{r, c});
                    cells.add(new int[]{r, c + 1});
                    cells.add(new int[]{r, c + 2});
                    cells.add(new int[]{r, c + 3});
                    return cells;
                }
            }
        }

        // 2. Vertical win (delta: +1, 0)
        for (int r = 0; r <= ROWS - 4; r++) {
            for (int c = 0; c < COLS; c++) {
                if (board[r][c] == target &&
                        board[r + 1][c] == target &&
                        board[r + 2][c] == target &&
                        board[r + 3][c] == target) {
                    List<int[]> cells = new ArrayList<>(4);
                    cells.add(new int[]{r, c});
                    cells.add(new int[]{r + 1, c});
                    cells.add(new int[]{r + 2, c});
                    cells.add(new int[]{r + 3, c});
                    return cells;
                }
            }
        }

        // 3. Diagonal Ascending win (bottom-left to top-right: delta -1, +1)
        for (int r = 3; r < ROWS; r++) {
            for (int c = 0; c <= COLS - 4; c++) {
                if (board[r][c] == target &&
                        board[r - 1][c + 1] == target &&
                        board[r - 2][c + 2] == target &&
                        board[r - 3][c + 3] == target) {
                    List<int[]> cells = new ArrayList<>(4);
                    cells.add(new int[]{r, c});
                    cells.add(new int[]{r - 1, c + 1});
                    cells.add(new int[]{r - 2, c + 2});
                    cells.add(new int[]{r - 3, c + 3});
                    return cells;
                }
            }
        }

        // 4. Diagonal Descending win (top-left to bottom-right: delta +1, +1)
        for (int r = 0; r <= ROWS - 4; r++) {
            for (int c = 0; c <= COLS - 4; c++) {
                if (board[r][c] == target &&
                        board[r + 1][c + 1] == target &&
                        board[r + 2][c + 2] == target &&
                        board[r + 3][c + 3] == target) {
                    List<int[]> cells = new ArrayList<>(4);
                    cells.add(new int[]{r, c});
                    cells.add(new int[]{r + 1, c + 1});
                    cells.add(new int[]{r + 2, c + 2});
                    cells.add(new int[]{r + 3, c + 3});
                    return cells;
                }
            }
        }

        return null;
    }

    /**
     * Checks if all 42 cells of the board are filled.
     */
    public boolean isBoardFull(int[][] board) {
        for (int c = 0; c < COLS; c++) {
            if (board[0][c] == 0) {
                return false;
            }
        }
        return true;
    }
}

package com.officewallahgames.tictactoe.engine;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.tictactoe.dto.MoveMessage;
import com.officewallahgames.tictactoe.model.GameSession;
import com.officewallahgames.tictactoe.model.GameStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class TicTacToeEngine {

    public static final int[][] WINNING_VECTORS = {
            {0, 1, 2}, // Row 1
            {3, 4, 5}, // Row 2
            {6, 7, 8}, // Row 3
            {0, 3, 6}, // Column 1
            {1, 4, 7}, // Column 2
            {2, 5, 8}, // Column 3
            {0, 4, 8}, // Diagonal top-left to bottom-right
            {2, 4, 6}  // Diagonal top-right to bottom-left
    };

    /**
     * Validates and applies a move to the game session, checking for win or draw.
     *
     * @param session the current game session
     * @param move    the move message containing playerId, position, and symbol
     */
    public void validateAndApplyMove(GameSession session, MoveMessage move) {
        validateMove(session, move);
        applyMove(session, move);
    }

    /**
     * Validates if the move is legal according to Tic-Tac-Toe rules.
     */
    public void validateMove(GameSession session, MoveMessage move) {
        if (session == null) {
            throw new GameException("Game session cannot be null");
        }

        if (session.getStatus() != GameStatus.ACTIVE) {
            throw new GameException("Game is not active. Current status: " + session.getStatus());
        }

        int pos = move.getPosition();
        if (pos < 0 || pos > 8) {
            throw new GameException("Invalid position: " + pos + ". Must be between 0 and 8.");
        }

        String[] board = session.getBoard();
        if (board[pos] != null && !board[pos].trim().isEmpty()) {
            throw new GameException("Cell " + pos + " is already occupied");
        }

        String expectedTurn = session.getCurrentTurn();
        if (move.getSymbol() != null && !move.getSymbol().equalsIgnoreCase(expectedTurn)) {
            throw new GameException("Invalid turn symbol: " + move.getSymbol() + ". Expected: " + expectedTurn);
        }

        if (move.getPlayerId() != null) {
            String expectedPlayerId = "X".equalsIgnoreCase(expectedTurn) ? session.getPlayerX() : session.getPlayerO();
            if (expectedPlayerId != null && !expectedPlayerId.equals(move.getPlayerId())) {
                throw new GameException("It is not your turn");
            }
        }
    }

    /**
     * Applies the move and evaluates win/draw conditions.
     */
    public void applyMove(GameSession session, MoveMessage move) {
        String symbol = session.getCurrentTurn();
        session.getBoard()[move.getPosition()] = symbol;
        session.setUpdatedAt(Instant.now());

        // Check win condition
        List<Integer> winningPattern = findWinningPattern(session.getBoard());
        if (winningPattern != null) {
            session.setStatus(GameStatus.COMPLETED);
            session.setWinner(symbol);
            session.setWinningPattern(winningPattern);
            return;
        }

        // Check draw condition
        if (isBoardFull(session.getBoard())) {
            session.setStatus(GameStatus.COMPLETED);
            session.setWinner("DRAW");
            session.setWinningPattern(null);
            return;
        }

        // Toggle turn
        session.setCurrentTurn("X".equalsIgnoreCase(symbol) ? "O" : "X");
    }

    /**
     * Checks if there is a winning 3-in-a-row vector on the board.
     *
     * @param board 9-cell board array
     * @return the winning indices list if found, otherwise null
     */
    public List<Integer> findWinningPattern(String[] board) {
        for (int[] vector : WINNING_VECTORS) {
            String first = board[vector[0]];
            if (first != null && !first.trim().isEmpty()
                    && first.equals(board[vector[1]])
                    && first.equals(board[vector[2]])) {
                return List.of(vector[0], vector[1], vector[2]);
            }
        }
        return null;
    }

    /**
     * Checks if all 9 cells are occupied.
     */
    public boolean isBoardFull(String[] board) {
        for (String cell : board) {
            if (cell == null || cell.trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }
}

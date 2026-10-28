package com.officewallahgames.ludo.engine;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.ludo.model.GameStatus;
import com.officewallahgames.ludo.model.LudoSession;
import com.officewallahgames.ludo.model.LudoToken;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.model.SlotState;
import com.officewallahgames.ludo.model.TokenState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class LudoEngine {

    public static final int TOTAL_TRACK_CELLS = 52;
    public static final int START_RED = 1;
    public static final int START_GREEN = 14;
    public static final int START_YELLOW = 27;
    public static final int START_BLUE = 40;

    public static final int STAR_RED = 9;
    public static final int STAR_GREEN = 22;
    public static final int STAR_YELLOW = 35;
    public static final int STAR_BLUE = 48;

    public static final Set<Integer> SAFE_CELLS = Set.of(
            START_RED, STAR_RED,
            START_GREEN, STAR_GREEN,
            START_YELLOW, STAR_YELLOW,
            START_BLUE, STAR_BLUE
    );

    public static final int HOME_COLUMN_START = 53;
    public static final int HOME_COLUMN_END = 57;
    public static final int HOME_FINISH_POSITION = 58;
    public static final int MAX_STEP_COUNT = 57;

    private final SecureRandom random = new SecureRandom();

    /**
     * Rolls a standard 6-sided die (1-6).
     */
    public int rollDice() {
        return random.nextInt(6) + 1;
    }

    /**
     * Initializes slot states depending on player count:
     * 2P: RED, YELLOW active; GREEN, BLUE INACTIVE_SETUP
     * 3P: RED, GREEN, YELLOW active; BLUE INACTIVE_SETUP
     * 4P: RED, GREEN, YELLOW, BLUE all active
     */
    public Map<PlayerColor, SlotState> setupSlots(int playerCount) {
        Map<PlayerColor, SlotState> slots = new HashMap<>();
        if (playerCount == 2) {
            slots.put(PlayerColor.RED, SlotState.WAITING);
            slots.put(PlayerColor.YELLOW, SlotState.WAITING);
            slots.put(PlayerColor.GREEN, SlotState.INACTIVE_SETUP);
            slots.put(PlayerColor.BLUE, SlotState.INACTIVE_SETUP);
        } else if (playerCount == 3) {
            slots.put(PlayerColor.RED, SlotState.WAITING);
            slots.put(PlayerColor.GREEN, SlotState.WAITING);
            slots.put(PlayerColor.YELLOW, SlotState.WAITING);
            slots.put(PlayerColor.BLUE, SlotState.INACTIVE_SETUP);
        } else {
            slots.put(PlayerColor.RED, SlotState.WAITING);
            slots.put(PlayerColor.GREEN, SlotState.WAITING);
            slots.put(PlayerColor.YELLOW, SlotState.WAITING);
            slots.put(PlayerColor.BLUE, SlotState.WAITING);
        }
        return slots;
    }

    /**
     * Turn order sequence for the given player count.
     */
    public List<PlayerColor> getTurnOrder(int playerCount) {
        if (playerCount == 2) {
            return List.of(PlayerColor.RED, PlayerColor.YELLOW);
        } else if (playerCount == 3) {
            return List.of(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW);
        } else {
            return List.of(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE);
        }
    }

    /**
     * Initializes 4 tokens for each active color with position -1 in HOME_YARD.
     */
    public List<LudoToken> initializeTokens(List<PlayerColor> activeColors) {
        List<LudoToken> tokens = new ArrayList<>();
        for (PlayerColor color : activeColors) {
            String prefix = color.name().substring(0, 1);
            for (int i = 1; i <= 4; i++) {
                tokens.add(LudoToken.createInitial(prefix + i, color));
            }
        }
        return tokens;
    }

    /**
     * Starting cell on the main 52-cell track for each color.
     */
    public int getStartCell(PlayerColor color) {
        return switch (color) {
            case RED -> START_RED;
            case GREEN -> START_GREEN;
            case YELLOW -> START_YELLOW;
            case BLUE -> START_BLUE;
        };
    }

    /**
     * Checks if a board cell is safe.
     */
    public boolean isSafeCell(int position) {
        return SAFE_CELLS.contains(position);
    }

    /**
     * Computes the display position for a given token step count.
     */
    public int calculatePosition(PlayerColor color, int stepCount) {
        if (stepCount < 0) {
            return -1;
        }
        if (stepCount <= 51) {
            int start = getStartCell(color);
            return ((start - 1 + stepCount) % TOTAL_TRACK_CELLS) + 1;
        }
        if (stepCount <= 56) {
            return HOME_COLUMN_START + (stepCount - 52); // 53..57
        }
        if (stepCount == MAX_STEP_COUNT) {
            return HOME_FINISH_POSITION; // 58
        }
        throw new IllegalArgumentException("Step count exceeds finish: " + stepCount);
    }

    /**
     * Computes the token state for a given step count.
     */
    public TokenState calculateState(int stepCount) {
        if (stepCount < 0) {
            return TokenState.HOME_YARD;
        }
        if (stepCount <= 51) {
            return TokenState.ON_BOARD;
        }
        if (stepCount <= 56) {
            return TokenState.HOME_COLUMN;
        }
        return TokenState.FINISHED;
    }

    /**
     * Checks if a token can make a legal move with the given dice value.
     */
    public boolean canMoveToken(LudoToken token, int diceValue) {
        if (token.getState() == TokenState.FINISHED) {
            return false;
        }
        if (token.getState() == TokenState.HOME_YARD) {
            return diceValue == 6;
        }
        return token.getStepCount() + diceValue <= MAX_STEP_COUNT;
    }

    /**
     * Returns list of token IDs for a player that can legally move with the given dice roll.
     */
    public List<String> getMovableTokens(LudoSession session, PlayerColor color, int diceValue) {
        if (diceValue < 1 || diceValue > 6) {
            return Collections.emptyList();
        }
        List<String> movable = new ArrayList<>();
        for (LudoToken token : session.getTokens()) {
            if (token.getColor() == color && canMoveToken(token, diceValue)) {
                movable.add(token.getTokenId());
            }
        }
        return movable;
    }

    /**
     * Moves a token, executes captures on non-safe cells, checks rankings / win,
     * and manages turn rotation or bonus turns.
     */
    public MoveResult moveToken(LudoSession session, PlayerColor color, String tokenId, int diceValue) {
        LudoToken targetToken = session.getTokens().stream()
                .filter(t -> t.getTokenId().equalsIgnoreCase(tokenId) && t.getColor() == color)
                .findFirst()
                .orElseThrow(() -> new GameException("Token not found: " + tokenId));

        if (!canMoveToken(targetToken, diceValue)) {
            throw new GameException("Token " + tokenId + " cannot move with roll " + diceValue);
        }

        if (targetToken.getState() == TokenState.HOME_YARD) {
            targetToken.setStepCount(0);
            targetToken.setPosition(getStartCell(color));
            targetToken.setState(TokenState.ON_BOARD);
        } else {
            int newStepCount = targetToken.getStepCount() + diceValue;
            targetToken.setStepCount(newStepCount);
            targetToken.setPosition(calculatePosition(color, newStepCount));
            targetToken.setState(calculateState(newStepCount));
        }

        // Capture logic on non-safe cells
        List<LudoToken> capturedTokens = new ArrayList<>();
        if (targetToken.getState() == TokenState.ON_BOARD && !isSafeCell(targetToken.getPosition())) {
            for (LudoToken other : session.getTokens()) {
                if (other.getColor() != color && other.getState() == TokenState.ON_BOARD
                        && other.getPosition() == targetToken.getPosition()) {
                    other.setPosition(-1);
                    other.setState(TokenState.HOME_YARD);
                    other.setStepCount(-1);
                    capturedTokens.add(other);
                    log.info("Token {} of {} captured token {} of {}",
                            targetToken.getTokenId(), color, other.getTokenId(), other.getColor());
                }
            }
        }

        // Win / rank tracking
        boolean playerRanked = false;
        if (targetToken.getState() == TokenState.FINISHED) {
            long finishedCount = session.getTokens().stream()
                    .filter(t -> t.getColor() == color && t.getState() == TokenState.FINISHED)
                    .count();
            if (finishedCount == 4 && !session.getRankings().contains(color)) {
                session.getRankings().add(color);
                playerRanked = true;
                log.info("Player {} has ranked #{}!", color, session.getRankings().size());
            }
        }

        // Check if game is over
        int activePlayerCount = session.getTurnOrder().size();
        boolean gameOver = false;
        if (session.getRankings().size() >= activePlayerCount - 1) {
            // Auto-rank last remaining player if needed
            if (session.getRankings().size() == activePlayerCount - 1) {
                for (PlayerColor p : session.getTurnOrder()) {
                    if (!session.getRankings().contains(p)) {
                        session.getRankings().add(p);
                        break;
                    }
                }
            }
            session.setStatus(GameStatus.COMPLETED);
            gameOver = true;
            log.info("Game over! Final rankings: {}", session.getRankings());
        }

        // Determine bonus turn:
        // Rolling a 6 grants a bonus turn if player has not ranked out and game is not over
        boolean bonusTurn = (diceValue == 6) && !session.getRankings().contains(color) && !gameOver;

        if (bonusTurn) {
            session.setCurrentTurn(color);
            session.setHasRolled(false);
            session.setDiceValue(0);
            session.setTurnStartedAt(System.currentTimeMillis());
            session.setMovableTokenIds(Collections.emptyList());
        } else if (!gameOver) {
            session.setConsecutiveSixes(0);
            cycleTurn(session);
        }

        return MoveResult.builder()
                .movedToken(targetToken)
                .capturedTokens(capturedTokens)
                .playerRanked(playerRanked)
                .gameOver(gameOver)
                .bonusTurn(bonusTurn)
                .build();
    }

    /**
     * Cycles turn to next eligible active player in turn order.
     * Skips INACTIVE_SETUP, OFFLINE, NOT_AVAILABLE slots and finished players.
     */
    public void cycleTurn(LudoSession session) {
        if (session.getStatus() == GameStatus.COMPLETED) {
            return;
        }
        List<PlayerColor> order = session.getTurnOrder();
        int currentIndex = order.indexOf(session.getCurrentTurn());
        int nextIndex = currentIndex;
        boolean found = false;

        for (int i = 0; i < order.size(); i++) {
            nextIndex = (nextIndex + 1) % order.size();
            PlayerColor candidate = order.get(nextIndex);
            SlotState slot = session.getSlotStates().get(candidate);
            if (slot != SlotState.ACTIVE) {
                continue;
            }
            if (session.getRankings() != null && session.getRankings().contains(candidate)) {
                continue;
            }
            found = true;
            session.setCurrentTurn(candidate);
            break;
        }

        if (!found) {
            session.setStatus(GameStatus.COMPLETED);
        } else {
            session.setHasRolled(false);
            session.setDiceValue(0);
            session.setConsecutiveSixes(0);
            session.setTurnStartedAt(System.currentTimeMillis());
            session.setMovableTokenIds(Collections.emptyList());
        }
    }
}

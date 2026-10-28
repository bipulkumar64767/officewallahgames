package com.officewallahgames.wordgrid.engine;

import com.officewallahgames.wordgrid.model.CellCoord;
import com.officewallahgames.wordgrid.model.PlayerColor;
import com.officewallahgames.wordgrid.model.SlotState;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class WordGridEngine {

    public static final int GRID_SIZE = 10;
    public static final int WINNING_SCORE = 30;
    public static final int MIN_WORD_LENGTH = 3;

    private final Set<String> dictionary = ConcurrentHashMap.newKeySet();

    @PostConstruct
    public void initDictionary() {
        loadDictionaryFromClasspath();
    }

    public void loadDictionaryFromClasspath() {
        int count = 0;
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("dictionary.txt")) {
            if (is != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String word = line.trim().toUpperCase();
                        if (word.length() >= MIN_WORD_LENGTH && word.chars().allMatch(Character::isLetter)) {
                            dictionary.add(word);
                            count++;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load dictionary.txt from classpath: {}", e.getMessage());
        }

        // Built-in core words fallback
        List<String> coreWords = Arrays.asList(
                "CAT", "DOG", "BAT", "RAT", "HAT", "MAT", "SAT", "BEE", "PIE", "TEA",
                "SEA", "RED", "BED", "BLUE", "GAME", "GRID", "WORD", "BLITZ", "PLAY",
                "TEST", "TURN", "TIME", "FAST", "COOL", "WINS", "TEAM", "CODE", "STAR",
                "FIRE", "WIND", "WATER", "EARTH", "LIGHT", "NIGHT", "BRAIN", "ARENA",
                "SCORE", "POINTS", "VICTORY", "CHALLENGE", "WINNER", "LETTERS"
        );
        for (String w : coreWords) {
            dictionary.add(w.toUpperCase());
        }

        log.info("Loaded {} words into Word Grid Blitz dictionary", dictionary.size());
    }

    /**
     * Checks if a word is in the dictionary.
     */
    public boolean isValidWord(String word) {
        if (word == null) {
            return false;
        }
        String cleanWord = word.trim().toUpperCase();
        return cleanWord.length() >= MIN_WORD_LENGTH && dictionary.contains(cleanWord);
    }

    /**
     * Allows adding words dynamically (e.g. for testing).
     */
    public void addWord(String word) {
        if (word != null && word.trim().length() >= MIN_WORD_LENGTH) {
            dictionary.add(word.trim().toUpperCase());
        }
    }

    /**
     * Sets up slot mapping based on player count.
     * 2P: RED & GREEN active, YELLOW & BLUE INACTIVE_SETUP.
     * 3P: RED, GREEN, YELLOW active, BLUE INACTIVE_SETUP.
     * 4P: all 4 active.
     */
    public Map<PlayerColor, SlotState> setupSlots(int playerCount) {
        Map<PlayerColor, SlotState> slots = new EnumMap<>(PlayerColor.class);
        slots.put(PlayerColor.RED, SlotState.ACTIVE);
        slots.put(PlayerColor.GREEN, SlotState.ACTIVE);

        if (playerCount == 2) {
            slots.put(PlayerColor.YELLOW, SlotState.INACTIVE_SETUP);
            slots.put(PlayerColor.BLUE, SlotState.INACTIVE_SETUP);
        } else if (playerCount == 3) {
            slots.put(PlayerColor.YELLOW, SlotState.ACTIVE);
            slots.put(PlayerColor.BLUE, SlotState.INACTIVE_SETUP);
        } else {
            slots.put(PlayerColor.YELLOW, SlotState.ACTIVE);
            slots.put(PlayerColor.BLUE, SlotState.ACTIVE);
        }
        return slots;
    }

    /**
     * Slot mapping for room lobby before all players join.
     * Host takes RED as ACTIVE, available slots are WAITING, unused are INACTIVE_SETUP.
     */
    public Map<PlayerColor, SlotState> setupLobbySlots(int playerCount) {
        Map<PlayerColor, SlotState> slots = new EnumMap<>(PlayerColor.class);
        slots.put(PlayerColor.RED, SlotState.ACTIVE);
        slots.put(PlayerColor.GREEN, SlotState.WAITING);

        if (playerCount == 2) {
            slots.put(PlayerColor.YELLOW, SlotState.INACTIVE_SETUP);
            slots.put(PlayerColor.BLUE, SlotState.INACTIVE_SETUP);
        } else if (playerCount == 3) {
            slots.put(PlayerColor.YELLOW, SlotState.WAITING);
            slots.put(PlayerColor.BLUE, SlotState.INACTIVE_SETUP);
        } else {
            slots.put(PlayerColor.YELLOW, SlotState.WAITING);
            slots.put(PlayerColor.BLUE, SlotState.WAITING);
        }
        return slots;
    }

    /**
     * Gets turn order based on player count.
     */
    public List<PlayerColor> getTurnOrder(int playerCount) {
        if (playerCount == 2) {
            return List.of(PlayerColor.RED, PlayerColor.GREEN);
        } else if (playerCount == 3) {
            return List.of(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW);
        } else {
            return List.of(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE);
        }
    }

    /**
     * Validates letter placement.
     * Must be an empty cell on 10x10 grid, letter A-Z.
     */
    public boolean isValidPlacement(Character[][] grid, int row, int col, char letter) {
        if (grid == null) {
            return false;
        }
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
            return false;
        }
        if (!Character.isLetter(letter)) {
            return false;
        }
        return grid[row][col] == null;
    }

    /**
     * Validates 8-way adjacent connected steps and no duplicates.
     */
    public boolean isValidPathConnectivity(List<CellCoord> path) {
        if (path == null || path.size() < MIN_WORD_LENGTH) {
            return false;
        }

        Set<String> visited = new HashSet<>();
        for (int i = 0; i < path.size(); i++) {
            CellCoord current = path.get(i);
            if (current == null) {
                return false;
            }
            if (current.getRow() < 0 || current.getRow() >= GRID_SIZE ||
                current.getCol() < 0 || current.getCol() >= GRID_SIZE) {
                return false;
            }

            String key = current.getRow() + "," + current.getCol();
            if (!visited.add(key)) {
                return false; // Duplicate cell in path
            }

            if (i > 0) {
                CellCoord prev = path.get(i - 1);
                int rowDiff = Math.abs(current.getRow() - prev.getRow());
                int colDiff = Math.abs(current.getCol() - prev.getCol());
                if (rowDiff > 1 || colDiff > 1 || (rowDiff == 0 && colDiff == 0)) {
                    return false; // Not 8-way adjacent
                }
            }
        }
        return true;
    }

    /**
     * Validates a word line trace against the grid, dictionary, and previous claims.
     */
    public WordValidationResult validateWordPath(Character[][] grid, List<CellCoord> path, Set<String> claimedWords) {
        if (grid == null || path == null) {
            return WordValidationResult.builder()
                    .valid(false)
                    .errorMessage("Grid or path cannot be null")
                    .scoreDelta(-1)
                    .build();
        }

        if (path.size() < MIN_WORD_LENGTH) {
            return WordValidationResult.builder()
                    .valid(false)
                    .errorMessage("Word must be at least " + MIN_WORD_LENGTH + " letters")
                    .scoreDelta(-1)
                    .build();
        }

        if (!isValidPathConnectivity(path)) {
            return WordValidationResult.builder()
                    .valid(false)
                    .errorMessage("Invalid path: cells must be 8-way adjacent with no duplicates")
                    .scoreDelta(-1)
                    .build();
        }

        // Trace letters on grid
        StringBuilder sb = new StringBuilder();
        for (CellCoord coord : path) {
            Character ch = grid[coord.getRow()][coord.getCol()];
            if (ch == null) {
                return WordValidationResult.builder()
                        .valid(false)
                        .errorMessage("Path contains an empty cell at (" + coord.getRow() + ", " + coord.getCol() + ")")
                        .scoreDelta(-1)
                        .build();
            }
            sb.append(Character.toUpperCase(ch));
        }

        String word = sb.toString();

        if (claimedWords != null && claimedWords.contains(word)) {
            return WordValidationResult.builder()
                    .valid(false)
                    .word(word)
                    .errorMessage("Word '" + word + "' has already been claimed")
                    .scoreDelta(-1)
                    .build();
        }

        if (!isValidWord(word)) {
            return WordValidationResult.builder()
                    .valid(false)
                    .word(word)
                    .errorMessage("Word '" + word + "' is not in the dictionary")
                    .scoreDelta(-1)
                    .build();
        }

        int scoreDelta = calculateScore(word);
        return WordValidationResult.builder()
                .valid(true)
                .word(word)
                .errorMessage(null)
                .scoreDelta(scoreDelta)
                .build();
    }

    /**
     * Calculates score for a valid word.
     * +2 pts (3-6 letters)
     * +3 pts (7+ letters)
     */
    public int calculateScore(String word) {
        if (word == null || word.length() < MIN_WORD_LENGTH) {
            return 0;
        }
        return word.length() >= 7 ? 3 : 2;
    }

    /**
     * Turn rotation: passes to next active color, skipping INACTIVE_SETUP and OFFLINE slots immediately.
     */
    public PlayerColor getNextTurn(PlayerColor currentTurn, List<PlayerColor> turnOrder, Map<PlayerColor, SlotState> slotStates) {
        if (turnOrder == null || turnOrder.isEmpty()) {
            return currentTurn;
        }

        int currentIndex = turnOrder.indexOf(currentTurn);
        if (currentIndex < 0) {
            currentIndex = 0;
        }

        int orderSize = turnOrder.size();
        for (int i = 1; i <= orderSize; i++) {
            PlayerColor next = turnOrder.get((currentIndex + i) % orderSize);
            SlotState state = (slotStates != null) ? slotStates.get(next) : null;
            if (state == SlotState.ACTIVE) {
                return next;
            }
        }

        return currentTurn;
    }

    /**
     * Checks if the 10x10 grid is full (100 cells).
     */
    public boolean isGridFull(Character[][] grid) {
        if (grid == null) {
            return false;
        }
        for (int r = 0; r < GRID_SIZE; r++) {
            for (int c = 0; c < GRID_SIZE; c++) {
                if (grid[r][c] == null) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Win detection:
     * Player reaches 30 points or grid is full (100 cells).
     */
    public PlayerColor checkWinner(Map<PlayerColor, Integer> scores, Map<PlayerColor, SlotState> slotStates, Character[][] grid) {
        if (scores != null) {
            for (Map.Entry<PlayerColor, Integer> entry : scores.entrySet()) {
                if (entry.getValue() != null && entry.getValue() >= WINNING_SCORE) {
                    SlotState state = (slotStates != null) ? slotStates.get(entry.getKey()) : null;
                    if (state == SlotState.ACTIVE || state == null) {
                        return entry.getKey();
                    }
                }
            }
        }

        if (isGridFull(grid) && scores != null) {
            // Find active player with highest score
            return scores.entrySet().stream()
                    .filter(e -> slotStates == null || slotStates.get(e.getKey()) == SlotState.ACTIVE)
                    .max(Comparator.comparingInt(Map.Entry::getValue))
                    .map(Map.Entry::getKey)
                    .orElse(null);
        }

        return null;
    }
}

package com.officewallahgames.wordgrid.engine;

import com.officewallahgames.wordgrid.model.CellCoord;
import com.officewallahgames.wordgrid.model.PlayerColor;
import com.officewallahgames.wordgrid.model.SlotState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class WordGridEngineTest {

    private WordGridEngine engine;

    @BeforeEach
    void setUp() {
        engine = new WordGridEngine();
        engine.initDictionary();
    }

    @Test
    @DisplayName("Slot mapping for 2P, 3P, and 4P configurations")
    void testSlotSetup() {
        // 2P setup: RED & GREEN active, YELLOW & BLUE INACTIVE_SETUP
        Map<PlayerColor, SlotState> slots2P = engine.setupSlots(2);
        assertThat(slots2P.get(PlayerColor.RED)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots2P.get(PlayerColor.GREEN)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots2P.get(PlayerColor.YELLOW)).isEqualTo(SlotState.INACTIVE_SETUP);
        assertThat(slots2P.get(PlayerColor.BLUE)).isEqualTo(SlotState.INACTIVE_SETUP);

        List<PlayerColor> order2P = engine.getTurnOrder(2);
        assertThat(order2P).containsExactly(PlayerColor.RED, PlayerColor.GREEN);

        // 3P setup: RED, GREEN, YELLOW active, BLUE INACTIVE_SETUP
        Map<PlayerColor, SlotState> slots3P = engine.setupSlots(3);
        assertThat(slots3P.get(PlayerColor.RED)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots3P.get(PlayerColor.GREEN)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots3P.get(PlayerColor.YELLOW)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots3P.get(PlayerColor.BLUE)).isEqualTo(SlotState.INACTIVE_SETUP);

        List<PlayerColor> order3P = engine.getTurnOrder(3);
        assertThat(order3P).containsExactly(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW);

        // 4P setup: all 4 active
        Map<PlayerColor, SlotState> slots4P = engine.setupSlots(4);
        assertThat(slots4P.get(PlayerColor.RED)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots4P.get(PlayerColor.GREEN)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots4P.get(PlayerColor.YELLOW)).isEqualTo(SlotState.ACTIVE);
        assertThat(slots4P.get(PlayerColor.BLUE)).isEqualTo(SlotState.ACTIVE);

        List<PlayerColor> order4P = engine.getTurnOrder(4);
        assertThat(order4P).containsExactly(PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE);
    }

    @Test
    @DisplayName("Valid letter placement: cell empty and within 10x10 bounds, letter A-Z")
    void testLetterPlacement() {
        Character[][] grid = new Character[10][10];

        // Valid placements
        assertThat(engine.isValidPlacement(grid, 0, 0, 'A')).isTrue();
        assertThat(engine.isValidPlacement(grid, 9, 9, 'z')).isTrue();
        assertThat(engine.isValidPlacement(grid, 4, 5, 'M')).isTrue();

        // Place a letter
        grid[4][5] = 'M';

        // Cannot place on already occupied cell
        assertThat(engine.isValidPlacement(grid, 4, 5, 'X')).isFalse();

        // Out of bounds
        assertThat(engine.isValidPlacement(grid, -1, 0, 'A')).isFalse();
        assertThat(engine.isValidPlacement(grid, 0, 10, 'A')).isFalse();
        assertThat(engine.isValidPlacement(grid, 10, 0, 'A')).isFalse();

        // Non-letter characters
        assertThat(engine.isValidPlacement(grid, 0, 1, '1')).isFalse();
        assertThat(engine.isValidPlacement(grid, 0, 1, '$')).isFalse();
    }

    @Test
    @DisplayName("8-way path connectivity and duplicate cell checks")
    void test8WayPathAdjacency() {
        // Horizontal: (0,0) -> (0,1) -> (0,2)
        List<CellCoord> horizontal = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 1),
                new CellCoord(0, 2)
        );
        assertThat(engine.isValidPathConnectivity(horizontal)).isTrue();

        // Vertical: (0,0) -> (1,0) -> (2,0)
        List<CellCoord> vertical = List.of(
                new CellCoord(0, 0),
                new CellCoord(1, 0),
                new CellCoord(2, 0)
        );
        assertThat(engine.isValidPathConnectivity(vertical)).isTrue();

        // Diagonal: (0,0) -> (1,1) -> (2,2)
        List<CellCoord> diagonal = List.of(
                new CellCoord(0, 0),
                new CellCoord(1, 1),
                new CellCoord(2, 2)
        );
        assertThat(engine.isValidPathConnectivity(diagonal)).isTrue();

        // Mixed 8-way: (0,0) -> (1,1) -> (1,2) -> (2,1)
        List<CellCoord> mixed = List.of(
                new CellCoord(0, 0),
                new CellCoord(1, 1),
                new CellCoord(1, 2),
                new CellCoord(2, 1)
        );
        assertThat(engine.isValidPathConnectivity(mixed)).isTrue();

        // Invalid: non-adjacent step (jump from 0,0 to 0,2)
        List<CellCoord> jump = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 2),
                new CellCoord(0, 3)
        );
        assertThat(engine.isValidPathConnectivity(jump)).isFalse();

        // Invalid: duplicate cells
        List<CellCoord> duplicate = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 1),
                new CellCoord(0, 0)
        );
        assertThat(engine.isValidPathConnectivity(duplicate)).isFalse();

        // Invalid: less than 3 cells
        List<CellCoord> tooShort = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 1)
        );
        assertThat(engine.isValidPathConnectivity(tooShort)).isFalse();
    }

    @Test
    @DisplayName("Valid word validation and scoring (+2 pts for 3-6 letters, +3 pts for 7+ letters)")
    void testValidWordValidationAndScoring() {
        Character[][] grid = new Character[10][10];

        // Place "CAT" on grid: (0,0)='C', (0,1)='A', (0,2)='T'
        grid[0][0] = 'C';
        grid[0][1] = 'A';
        grid[0][2] = 'T';

        List<CellCoord> catPath = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 1),
                new CellCoord(0, 2)
        );

        Set<String> claimedWords = new HashSet<>();
        WordValidationResult resultCat = engine.validateWordPath(grid, catPath, claimedWords);

        assertThat(resultCat.isValid()).isTrue();
        assertThat(resultCat.getWord()).isEqualTo("CAT");
        assertThat(resultCat.getScoreDelta()).isEqualTo(2); // 3 letters: +2 pts

        // Place "VICTORY" (7 letters) on diagonal: (1,1) to (7,7)
        String victory = "VICTORY";
        List<CellCoord> victoryPath = new ArrayList<>();
        for (int i = 0; i < victory.length(); i++) {
            grid[1 + i][1 + i] = victory.charAt(i);
            victoryPath.add(new CellCoord(1 + i, 1 + i));
        }

        WordValidationResult resultVictory = engine.validateWordPath(grid, victoryPath, claimedWords);
        assertThat(resultVictory.isValid()).isTrue();
        assertThat(resultVictory.getWord()).isEqualTo("VICTORY");
        assertThat(resultVictory.getScoreDelta()).isEqualTo(3); // 7+ letters: +3 pts
    }

    @Test
    @DisplayName("Invalid word validation returns -1 penalty for gibberish or already claimed words")
    void testInvalidWordPenalty() {
        Character[][] grid = new Character[10][10];

        // Place gibberish "XYZ"
        grid[0][0] = 'X';
        grid[0][1] = 'Y';
        grid[0][2] = 'Z';

        List<CellCoord> path = List.of(
                new CellCoord(0, 0),
                new CellCoord(0, 1),
                new CellCoord(0, 2)
        );

        Set<String> claimed = new HashSet<>();
        WordValidationResult resultGibberish = engine.validateWordPath(grid, path, claimed);
        assertThat(resultGibberish.isValid()).isFalse();
        assertThat(resultGibberish.getScoreDelta()).isEqualTo(-1);

        // Now test word already claimed
        grid[1][0] = 'D';
        grid[1][1] = 'O';
        grid[1][2] = 'G';
        List<CellCoord> dogPath = List.of(
                new CellCoord(1, 0),
                new CellCoord(1, 1),
                new CellCoord(1, 2)
        );

        claimed.add("DOG");
        WordValidationResult resultClaimed = engine.validateWordPath(grid, dogPath, claimed);
        assertThat(resultClaimed.isValid()).isFalse();
        assertThat(resultClaimed.getScoreDelta()).isEqualTo(-1);
    }

    @Test
    @DisplayName("Turn rotation skips INACTIVE_SETUP and OFFLINE slots immediately")
    void testTurnRotationSkippingInactiveSlots() {
        List<PlayerColor> turnOrder = List.of(
                PlayerColor.RED,
                PlayerColor.GREEN,
                PlayerColor.YELLOW,
                PlayerColor.BLUE
        );

        Map<PlayerColor, SlotState> slotStates = new EnumMap<>(PlayerColor.class);
        slotStates.put(PlayerColor.RED, SlotState.ACTIVE);
        slotStates.put(PlayerColor.GREEN, SlotState.OFFLINE);          // offline
        slotStates.put(PlayerColor.YELLOW, SlotState.INACTIVE_SETUP);  // inactive setup
        slotStates.put(PlayerColor.BLUE, SlotState.ACTIVE);

        // RED's turn -> should skip GREEN and YELLOW, directly rotating to BLUE
        PlayerColor next = engine.getNextTurn(PlayerColor.RED, turnOrder, slotStates);
        assertThat(next).isEqualTo(PlayerColor.BLUE);

        // BLUE's turn -> rotates back to RED (skipping GREEN and YELLOW)
        PlayerColor afterBlue = engine.getNextTurn(PlayerColor.BLUE, turnOrder, slotStates);
        assertThat(afterBlue).isEqualTo(PlayerColor.RED);
    }

    @Test
    @DisplayName("Win detection: player reaches 30 points or grid is full (100 cells)")
    void testWinDetection() {
        Map<PlayerColor, Integer> scores = new EnumMap<>(PlayerColor.class);
        scores.put(PlayerColor.RED, 15);
        scores.put(PlayerColor.GREEN, 30); // 30 points

        Map<PlayerColor, SlotState> slots = new EnumMap<>(PlayerColor.class);
        slots.put(PlayerColor.RED, SlotState.ACTIVE);
        slots.put(PlayerColor.GREEN, SlotState.ACTIVE);

        Character[][] emptyGrid = new Character[10][10];

        // Green reached 30 points
        PlayerColor winner = engine.checkWinner(scores, slots, emptyGrid);
        assertThat(winner).isEqualTo(PlayerColor.GREEN);

        // Now test grid full win condition when score < 30
        scores.put(PlayerColor.GREEN, 20);
        scores.put(PlayerColor.RED, 25); // RED has highest score

        Character[][] fullGrid = new Character[10][10];
        for (int r = 0; r < 10; r++) {
            for (int c = 0; c < 10; c++) {
                fullGrid[r][c] = 'A';
            }
        }

        assertThat(engine.isGridFull(fullGrid)).isTrue();
        PlayerColor fullGridWinner = engine.checkWinner(scores, slots, fullGrid);
        assertThat(fullGridWinner).isEqualTo(PlayerColor.RED);
    }
}

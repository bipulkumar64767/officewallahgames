package com.officewallahgames.wordgrid.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.wordgrid.dto.ClaimWordRequest;
import com.officewallahgames.wordgrid.dto.CreateRoomRequest;
import com.officewallahgames.wordgrid.dto.JoinRoomRequest;
import com.officewallahgames.wordgrid.dto.PassTurnRequest;
import com.officewallahgames.wordgrid.dto.PlaceLetterRequest;
import com.officewallahgames.wordgrid.dto.WordGridEventDto;
import com.officewallahgames.wordgrid.dto.WordGridRoomResponse;
import com.officewallahgames.wordgrid.engine.WordGridEngine;
import com.officewallahgames.wordgrid.engine.WordValidationResult;
import com.officewallahgames.wordgrid.model.CellCoord;
import com.officewallahgames.wordgrid.model.GameStatus;
import com.officewallahgames.wordgrid.model.PlayerColor;
import com.officewallahgames.wordgrid.model.SlotState;
import com.officewallahgames.wordgrid.model.WordGridSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
@RequiredArgsConstructor
public class WordGridService {

    private final WordGridEngine engine;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String ROOM_CODE_CHARACTERS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int ROOM_CODE_RANDOM_LENGTH = 4;
    private static final String ROOM_CODE_PREFIX = "WGB-";
    private final SecureRandom random = new SecureRandom();

    // In-memory thread-safe storage for sessions, room codes and matchmaking queues
    private final Map<String, WordGridSession> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, String> roomCodeToSessionId = new ConcurrentHashMap<>();
    private final Map<Integer, Queue<String>> matchmakingQueues = new ConcurrentHashMap<>();

    /**
     * Creates a new Word Grid Blitz room. Host is assigned PlayerColor.RED.
     */
    public WordGridRoomResponse createRoom(CreateRoomRequest request) {
        String sessionId = UUID.randomUUID().toString();
        String roomCode = generateUniqueRoomCode();

        int playerCount = (request != null && request.getPlayerCount() != null)
                ? request.getPlayerCount()
                : 4;
        if (playerCount != 2 && playerCount != 3 && playerCount != 4) {
            playerCount = 4;
        }

        String playerId = (request != null && request.getPlayerId() != null && !request.getPlayerId().isBlank())
                ? request.getPlayerId()
                : UUID.randomUUID().toString();
        String playerName = (request != null && request.getPlayerName() != null && !request.getPlayerName().isBlank())
                ? request.getPlayerName()
                : "Host";

        Map<PlayerColor, SlotState> slotStates = engine.setupLobbySlots(playerCount);
        List<PlayerColor> turnOrder = engine.getTurnOrder(playerCount);

        Map<PlayerColor, Integer> initialScores = new ConcurrentHashMap<>();
        for (PlayerColor color : turnOrder) {
            initialScores.put(color, 0);
        }

        WordGridSession session = WordGridSession.builder()
                .sessionId(sessionId)
                .roomCode(roomCode)
                .playerCount(playerCount)
                .slotStates(new ConcurrentHashMap<>(slotStates))
                .scores(initialScores)
                .grid(new Character[WordGridEngine.GRID_SIZE][WordGridEngine.GRID_SIZE])
                .cellOwners(new PlayerColor[WordGridEngine.GRID_SIZE][WordGridEngine.GRID_SIZE])
                .currentTurn(PlayerColor.RED)
                .turnOrder(turnOrder)
                .hasPlacedLetter(false)
                .turnStartedAt(System.currentTimeMillis())
                .status(GameStatus.WAITING_FOR_PLAYERS)
                .createdAt(System.currentTimeMillis())
                .updatedAt(System.currentTimeMillis())
                .build();

        session.getPlayers().put(PlayerColor.RED, playerId);
        session.getPlayerNames().put(PlayerColor.RED, playerName);

        sessionsById.put(sessionId, session);
        roomCodeToSessionId.put(roomCode, sessionId);

        log.info("Created Word Grid room {} (sessionId: {}, playerCount: {}) by host {}",
                roomCode, sessionId, playerCount, playerId);

        return WordGridRoomResponse.builder()
                .sessionId(sessionId)
                .roomCode(roomCode)
                .assignedColor(PlayerColor.RED)
                .playerCount(playerCount)
                .status(session.getStatus())
                .slotStates(session.getSlotStates())
                .scores(session.getScores())
                .build();
    }

    /**
     * Joins an existing room. Assigns the next available color slot.
     */
    public synchronized WordGridRoomResponse joinRoom(JoinRoomRequest request) {
        if (request == null || request.getRoomCode() == null || request.getRoomCode().isBlank()) {
            throw new GameException("Room code cannot be empty");
        }

        String cleanCode = request.getRoomCode().trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(cleanCode);
        if (sessionId == null) {
            throw new GameException("Room not found: " + cleanCode);
        }

        WordGridSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Session not found for room: " + cleanCode);
        }

        if (session.getStatus() != GameStatus.WAITING_FOR_PLAYERS) {
            throw new GameException("Room " + cleanCode + " is already full! Maximum players already joined.");
        }

        String playerId = (request.getPlayerId() != null && !request.getPlayerId().isBlank())
                ? request.getPlayerId()
                : UUID.randomUUID().toString();
        String playerName = (request.getPlayerName() != null && !request.getPlayerName().isBlank())
                ? request.getPlayerName()
                : "Player " + (session.getPlayers().size() + 1);

        // Find next waiting slot in turn order
        PlayerColor assignedColor = null;
        for (PlayerColor color : session.getTurnOrder()) {
            if (session.getSlotStates().get(color) == SlotState.WAITING) {
                assignedColor = color;
                break;
            }
        }

        if (assignedColor == null) {
            throw new GameException("Room " + cleanCode + " is already full! Maximum players already joined.");
        }

        session.getPlayers().put(assignedColor, playerId);
        session.getPlayerNames().put(assignedColor, playerName);
        session.getSlotStates().put(assignedColor, SlotState.ACTIVE);
        session.setUpdatedAt(System.currentTimeMillis());

        // Always broadcast PLAYER_JOINED first so host registers player
        broadcastEvent(session, WordGridEventDto.builder()
                .type("PLAYER_JOINED")
                .session(session)
                .color(assignedColor)
                .message(playerName + " joined as " + assignedColor)
                .timestamp(System.currentTimeMillis())
                .build());

        // Check if all slots are filled
        boolean allFilled = true;
        for (PlayerColor color : session.getTurnOrder()) {
            if (session.getSlotStates().get(color) != SlotState.ACTIVE) {
                allFilled = false;
                break;
            }
        }

        if (allFilled) {
            session.setStatus(GameStatus.ACTIVE);
            session.setTurnStartedAt(System.currentTimeMillis());
            broadcastEvent(session, WordGridEventDto.builder()
                    .type("GAME_STARTED")
                    .session(session)
                    .color(assignedColor)
                    .message("All players joined. Game has started! Turn: " + session.getCurrentTurn())
                    .timestamp(System.currentTimeMillis())
                    .build());
        }

        return WordGridRoomResponse.builder()
                .sessionId(sessionId)
                .roomCode(session.getRoomCode())
                .assignedColor(assignedColor)
                .playerCount(session.getPlayerCount())
                .status(session.getStatus())
                .slotStates(session.getSlotStates())
                .scores(session.getScores())
                .build();
    }

    /**
     * Gets current room status by room code.
     */
    public WordGridSession getRoomStatus(String roomCode) {
        if (roomCode == null || roomCode.isBlank()) {
            throw new GameException("Room code cannot be empty");
        }
        String sessionId = roomCodeToSessionId.get(roomCode.trim().toUpperCase());
        if (sessionId == null) {
            throw new GameException("Room not found: " + roomCode);
        }
        WordGridSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Session not found: " + sessionId);
        }
        return session;
    }

    /**
     * Gets session by session id.
     */
    public WordGridSession getSessionById(String sessionId) {
        WordGridSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Session not found: " + sessionId);
        }
        return session;
    }

    /**
     * Quick match matchmaking queue.
     */
    public synchronized WordGridRoomResponse quickMatch(String playerId, String playerName, int playerCount) {
        if (playerCount != 2 && playerCount != 3 && playerCount != 4) {
            playerCount = 4;
        }

        Queue<String> queue = matchmakingQueues.computeIfAbsent(playerCount, k -> new ConcurrentLinkedQueue<>());

        while (!queue.isEmpty()) {
            String roomCode = queue.peek();
            String sessionId = roomCodeToSessionId.get(roomCode);
            if (sessionId == null) {
                queue.poll();
                continue;
            }

            WordGridSession session = sessionsById.get(sessionId);
            if (session == null || session.getStatus() != GameStatus.WAITING_FOR_PLAYERS) {
                queue.poll();
                continue;
            }

            try {
                WordGridRoomResponse response = joinRoom(JoinRoomRequest.builder()
                        .roomCode(roomCode)
                        .playerId(playerId)
                        .playerName(playerName)
                        .build());

                // If room is now active, dequeue it
                if (session.getStatus() == GameStatus.ACTIVE) {
                    queue.poll();
                }
                return response;
            } catch (Exception e) {
                queue.poll();
            }
        }

        // No open room found, create a new one
        WordGridRoomResponse response = createRoom(CreateRoomRequest.builder()
                .playerId(playerId)
                .playerName(playerName)
                .playerCount(playerCount)
                .build());

        queue.add(response.getRoomCode());
        return response;
    }

    /**
     * Places a letter on the 10x10 grid.
     */
    public synchronized void placeLetter(String sessionId, PlaceLetterRequest request) {
        WordGridSession session = getSessionById(sessionId);

        validateTurn(session, request.getColor(), request.getPlayerId());

        if (session.isHasPlacedLetter()) {
            throw new GameException("A letter has already been placed this turn. Claim a word or pass turn.");
        }

        if (request.getLetter() == null || request.getLetter().isBlank()) {
            throw new GameException("Letter cannot be empty");
        }

        char letter = Character.toUpperCase(request.getLetter().trim().charAt(0));
        if (!engine.isValidPlacement(session.getGrid(), request.getRow(), request.getCol(), letter)) {
            throw new GameException("Invalid placement at (" + request.getRow() + ", " + request.getCol() + ")");
        }

        session.getGrid()[request.getRow()][request.getCol()] = letter;
        session.getCellOwners()[request.getRow()][request.getCol()] = request.getColor();
        session.setHasPlacedLetter(true);
        session.setUpdatedAt(System.currentTimeMillis());

        // Check if grid is full and causes a win
        PlayerColor winner = engine.checkWinner(session.getScores(), session.getSlotStates(), session.getGrid());
        if (winner != null) {
            session.setStatus(GameStatus.GAME_OVER);
            session.setWinner(winner);
            broadcastEvent(session, WordGridEventDto.builder()
                    .type("GAME_OVER")
                    .session(session)
                    .winner(winner)
                    .color(request.getColor())
                    .row(request.getRow())
                    .col(request.getCol())
                    .letter(letter)
                    .message("Game Over! Grid is full. Winner: " + winner)
                    .timestamp(System.currentTimeMillis())
                    .build());
            return;
        }

        broadcastEvent(session, WordGridEventDto.builder()
                .type("LETTER_PLACED")
                .session(session)
                .color(request.getColor())
                .row(request.getRow())
                .col(request.getCol())
                .letter(letter)
                .message(request.getColor() + " placed letter '" + letter + "' at (" + request.getRow() + ", " + request.getCol() + ")")
                .timestamp(System.currentTimeMillis())
                .build());
    }

    /**
     * Claims a word formed by an 8-way adjacent path of letters on the grid.
     */
    public synchronized void claimWord(String sessionId, ClaimWordRequest request) {
        WordGridSession session = getSessionById(sessionId);

        validateTurn(session, request.getColor(), request.getPlayerId());

        WordValidationResult result = engine.validateWordPath(session.getGrid(), request.getPath(), session.getClaimedWords());

        if (result.isValid()) {
            String word = result.getWord();
            session.getClaimedWords().add(word);

            // Add score
            int currentScore = session.getScores().getOrDefault(request.getColor(), 0);
            int newScore = currentScore + result.getScoreDelta();
            session.getScores().put(request.getColor(), newScore);

            // Update ownership of all cells in path
            for (CellCoord coord : request.getPath()) {
                session.getCellOwners()[coord.getRow()][coord.getCol()] = request.getColor();
            }

            session.setUpdatedAt(System.currentTimeMillis());

            // Check if player won
            PlayerColor winner = engine.checkWinner(session.getScores(), session.getSlotStates(), session.getGrid());
            if (winner != null) {
                session.setStatus(GameStatus.GAME_OVER);
                session.setWinner(winner);
                broadcastEvent(session, WordGridEventDto.builder()
                        .type("GAME_OVER")
                        .session(session)
                        .winner(winner)
                        .color(request.getColor())
                        .word(word)
                        .scoreDelta(result.getScoreDelta())
                        .path(request.getPath())
                        .message("Game Over! " + winner + " wins with " + session.getScores().get(winner) + " points!")
                        .timestamp(System.currentTimeMillis())
                        .build());
                return;
            }

            // Advance turn
            session.setHasPlacedLetter(false);
            PlayerColor nextTurn = engine.getNextTurn(session.getCurrentTurn(), session.getTurnOrder(), session.getSlotStates());
            session.setCurrentTurn(nextTurn);
            session.setTurnStartedAt(System.currentTimeMillis());

            broadcastEvent(session, WordGridEventDto.builder()
                    .type("WORD_CLAIMED")
                    .session(session)
                    .color(request.getColor())
                    .word(word)
                    .scoreDelta(result.getScoreDelta())
                    .path(request.getPath())
                    .message(request.getColor() + " claimed '" + word + "' (+" + result.getScoreDelta() + " pts). Next turn: " + nextTurn)
                    .timestamp(System.currentTimeMillis())
                    .build());
        } else {
            // Invalid claim: -1 penalty
            int currentScore = session.getScores().getOrDefault(request.getColor(), 0);
            int newScore = currentScore - 1;
            session.getScores().put(request.getColor(), newScore);

            // Advance turn on failed claim
            session.setHasPlacedLetter(false);
            PlayerColor nextTurn = engine.getNextTurn(session.getCurrentTurn(), session.getTurnOrder(), session.getSlotStates());
            session.setCurrentTurn(nextTurn);
            session.setTurnStartedAt(System.currentTimeMillis());
            session.setUpdatedAt(System.currentTimeMillis());

            broadcastEvent(session, WordGridEventDto.builder()
                    .type("WORD_REJECTED")
                    .session(session)
                    .color(request.getColor())
                    .word(result.getWord())
                    .scoreDelta(-1)
                    .path(request.getPath())
                    .message("Invalid word claim: " + result.getErrorMessage() + " (-1 pt penalty). Next turn: " + nextTurn)
                    .timestamp(System.currentTimeMillis())
                    .build());
        }
    }

    /**
     * Passes turn to the next player ("Fast Proceed").
     */
    public synchronized void passTurn(String sessionId, PassTurnRequest request) {
        WordGridSession session = getSessionById(sessionId);

        validateTurn(session, request.getColor(), request.getPlayerId());

        session.setHasPlacedLetter(false);
        PlayerColor nextTurn = engine.getNextTurn(session.getCurrentTurn(), session.getTurnOrder(), session.getSlotStates());
        session.setCurrentTurn(nextTurn);
        session.setTurnStartedAt(System.currentTimeMillis());
        session.setUpdatedAt(System.currentTimeMillis());

        broadcastEvent(session, WordGridEventDto.builder()
                .type("TURN_ADVANCED")
                .session(session)
                .color(request.getColor())
                .message(request.getColor() + " passed turn. Next turn: " + nextTurn)
                .timestamp(System.currentTimeMillis())
                .build());
    }

    private void validateTurn(WordGridSession session, PlayerColor color, String playerId) {
        if (session.getStatus() != GameStatus.ACTIVE) {
            throw new GameException("Game is not active (current status: " + session.getStatus() + ")");
        }
        if (session.getCurrentTurn() != color) {
            throw new GameException("It is not " + color + "'s turn (current turn: " + session.getCurrentTurn() + ")");
        }
        if (playerId != null && !playerId.isBlank()) {
            String registeredPlayerId = session.getPlayers().get(color);
            if (registeredPlayerId != null && !registeredPlayerId.equals(playerId)) {
                throw new GameException("Player ID mismatch for color " + color);
            }
        }
    }

    private void broadcastEvent(WordGridSession session, WordGridEventDto event) {
        try {
            messagingTemplate.convertAndSend("/topic/wordgrid/" + session.getSessionId(), event);
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket event to session {}: {}", session.getSessionId(), e.getMessage());
        }
    }

    private String generateUniqueRoomCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(ROOM_CODE_PREFIX);
            for (int i = 0; i < ROOM_CODE_RANDOM_LENGTH; i++) {
                sb.append(ROOM_CODE_CHARACTERS.charAt(random.nextInt(ROOM_CODE_CHARACTERS.length())));
            }
            code = sb.toString();
        } while (roomCodeToSessionId.containsKey(code));
        return code;
    }
}

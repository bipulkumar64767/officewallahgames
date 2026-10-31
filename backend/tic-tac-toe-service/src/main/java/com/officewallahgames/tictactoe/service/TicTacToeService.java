package com.officewallahgames.tictactoe.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.tictactoe.dto.CreateRoomRequest;
import com.officewallahgames.tictactoe.dto.GameEventDto;
import com.officewallahgames.tictactoe.dto.JoinRoomRequest;
import com.officewallahgames.tictactoe.dto.MoveMessage;
import com.officewallahgames.tictactoe.dto.RoomResponseDto;
import com.officewallahgames.tictactoe.engine.TicTacToeEngine;
import com.officewallahgames.tictactoe.model.GameSession;
import com.officewallahgames.tictactoe.model.GameStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicTacToeService {

    private final TicTacToeEngine engine;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String ROOM_CODE_CHARACTERS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int ROOM_CODE_RANDOM_LENGTH = 4;
    private static final String ROOM_CODE_PREFIX = "TTT-";
    private final SecureRandom random = new SecureRandom();

    // In-memory thread-safe storage for sessions and room codes
    private final Map<String, GameSession> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, String> roomCodeToSessionId = new ConcurrentHashMap<>();
    private final Queue<String> matchmakingQueue = new ConcurrentLinkedQueue<>();

    /**
     * Creates a new game room, assigning host as player 'X' with WAITING_FOR_OPPONENT status.
     */
    public RoomResponseDto createRoom(CreateRoomRequest request) {
        String sessionId = UUID.randomUUID().toString();
        String roomCode = generateUniqueRoomCode();

        String playerId = (request != null && request.getPlayerId() != null)
                ? request.getPlayerId()
                : UUID.randomUUID().toString();
        String playerName = (request != null && request.getPlayerName() != null && !request.getPlayerName().isBlank())
                ? request.getPlayerName()
                : "Player X";

        String[] initialBoard = new String[9];
        java.util.Arrays.fill(initialBoard, "");

        GameSession session = GameSession.builder()
                .sessionId(sessionId)
                .roomCode(roomCode)
                .playerX(playerId)
                .playerXName(playerName)
                .board(initialBoard)
                .currentTurn("X")
                .status(GameStatus.WAITING_FOR_OPPONENT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        sessionsById.put(sessionId, session);
        roomCodeToSessionId.put(roomCode, sessionId);

        log.info("Room created with code {} and sessionId {}", roomCode, sessionId);

        return buildRoomResponse(session, "X");
    }

    /**
     * Joins an existing game room, assigning opponent as player 'O' and setting status to ACTIVE.
     * Also supports host and opponent rejoining/reconnecting without error.
     */
    public RoomResponseDto joinRoom(JoinRoomRequest request) {
        if (request == null || request.getRoomCode() == null) {
            throw new GameException("Room code cannot be empty");
        }

        String roomCode = request.getRoomCode().trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(roomCode);
        if (sessionId == null) {
            throw new GameException("Room " + roomCode + " does not exist or has expired.");
        }

        GameSession session = sessionsById.get(sessionId);
        if (session == null || session.getStatus() == GameStatus.COMPLETED || session.getStatus() == GameStatus.ABANDONED) {
            roomCodeToSessionId.remove(roomCode);
            throw new GameException("Room " + roomCode + " does not exist or has expired.");
        }

        synchronized (session) {
            if (session.getStatus() != GameStatus.COMPLETED && session.getStatus() != GameStatus.ABANDONED) {
                // Check if host is rejoining / reconnecting
                if (request.getPlayerId() != null && request.getPlayerId().equals(session.getPlayerX())) {
                    log.info("Host {} reconnected to room {}", request.getPlayerId(), roomCode);
                    GameEventDto reconnectEvent = GameEventDto.builder()
                            .eventType("PLAYER_RECONNECTED")
                            .type("PLAYER_RECONNECTED")
                            .playerId(request.getPlayerId())
                            .symbol("X")
                            .session(session)
                            .message(session.getPlayerXName() + " reconnected as Host.")
                            .build();
                    messagingTemplate.convertAndSend("/topic/game/" + session.getSessionId(), reconnectEvent);
                    return buildRoomResponse(session, "X");
                }

                // Check if Player O is rejoining / reconnecting
                if (request.getPlayerId() != null && request.getPlayerId().equals(session.getPlayerO())) {
                    log.info("Player O {} reconnected to room {}", request.getPlayerId(), roomCode);
                    GameEventDto reconnectEvent = GameEventDto.builder()
                            .eventType("PLAYER_RECONNECTED")
                            .type("PLAYER_RECONNECTED")
                            .playerId(request.getPlayerId())
                            .symbol("O")
                            .session(session)
                            .message(session.getPlayerOName() + " reconnected as Player O.")
                            .build();
                    messagingTemplate.convertAndSend("/topic/game/" + session.getSessionId(), reconnectEvent);
                    return buildRoomResponse(session, "O");
                }
            }

            if (session.getStatus() != GameStatus.WAITING_FOR_OPPONENT || session.getPlayerO() != null) {
                throw new GameException("Room " + roomCode + " is already full! Maximum 2 players allowed.");
            }

            String playerName = (request.getPlayerName() != null && !request.getPlayerName().isBlank())
                    ? request.getPlayerName()
                    : "Player O";

            session.setPlayerO(request.getPlayerId());
            session.setPlayerOName(playerName);
            session.setStatus(GameStatus.ACTIVE);
            session.setUpdatedAt(Instant.now());
        }

        // Broadcast PLAYER_JOINED event via WebSocket
        GameEventDto event = GameEventDto.builder()
                .eventType("PLAYER_JOINED")
                .type("PLAYER_JOINED")
                .session(session)
                .message(session.getPlayerOName() + " joined the game!")
                .build();

        messagingTemplate.convertAndSend("/topic/game/" + session.getSessionId(), event);
        log.info("Player {} joined room {}", request.getPlayerId(), roomCode);

        return buildRoomResponse(session, "O");
    }

    /**
     * Handles player leaving. If host leaves or match is ACTIVE, disbands the match.
     * If guest (player O) leaves during WAITING_FOR_OPPONENT, frees up player O slot,
     * resets ready state, and broadcasts PLAYER_LEFT so a new challenger can join.
     */
    public void leaveRoom(String sessionId, String playerId) {
        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            log.warn("Cannot leave non-existent session {}", sessionId);
            return;
        }

        synchronized (session) {
            boolean isHost = playerId != null && playerId.equals(session.getPlayerX());

            if (session.getStatus() == GameStatus.ACTIVE || isHost) {
                session.setStatus(GameStatus.ABANDONED);
                session.setUpdatedAt(Instant.now());
                if (session.getRoomCode() != null) {
                    roomCodeToSessionId.remove(session.getRoomCode());
                }
                GameEventDto event = GameEventDto.builder()
                        .eventType("MATCH_DISBANDED")
                        .type("MATCH_DISBANDED")
                        .session(session)
                        .sessionId(sessionId)
                        .message((isHost ? "Host" : "Opponent") + " has left the match.")
                        .build();
                messagingTemplate.convertAndSend("/topic/game/" + session.getSessionId(), event);
                log.info("TicTacToe room {} disbanded as {} left.", session.getRoomCode(), isHost ? "host" : "guest during match");
                return;
            }

            // In waiting room: guest leaves, free up player O slot!
            if (playerId != null && playerId.equals(session.getPlayerO())) {
                String leavingName = session.getPlayerOName() != null ? session.getPlayerOName() : "Guest";
                session.setPlayerO(null);
                session.setPlayerOName(null);
                session.setStatus(GameStatus.WAITING_FOR_OPPONENT);
                session.setUpdatedAt(Instant.now());

                GameEventDto event = GameEventDto.builder()
                        .eventType("PLAYER_LEFT")
                        .type("PLAYER_LEFT")
                        .session(session)
                        .sessionId(sessionId)
                        .message(leavingName + " has left the room. Slot is now free for a new challenger!")
                        .build();
                messagingTemplate.convertAndSend("/topic/game/" + session.getSessionId(), event);
                log.info("Player O {} left room {}, slot freed for next challenger", playerId, session.getRoomCode());
            }
        }
    }

    /**
     * Disbands a room, marks session as ABANDONED, removes roomCode from mapping,
     * and broadcasts MATCH_DISBANDED to all connected clients.
     */
    public void disbandRoom(String sessionId, String playerId) {
        leaveRoom(sessionId, playerId);
    }

    /**
     * Allows cycling turn to the other player if timer expires, ensuring server currentTurn
     * is synchronized and doesn't reject subsequent moves.
     */
    public GameEventDto passTurn(String sessionId, String playerId) {
        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }

        synchronized (session) {
            if (session.getStatus() != GameStatus.ACTIVE) {
                log.warn("Cannot pass turn in non-active session {}", sessionId);
                return null;
            }

            // Switch turn between X and O
            String nextTurn = "X".equalsIgnoreCase(session.getCurrentTurn()) ? "O" : "X";
            session.setCurrentTurn(nextTurn);
            session.setUpdatedAt(Instant.now());
        }

        GameEventDto event = GameEventDto.builder()
                .eventType("TURN_PASSED")
                .type("TURN_PASSED")
                .session(session)
                .message("Turn timed out and passed to player " + session.getCurrentTurn())
                .build();

        messagingTemplate.convertAndSend("/topic/game/" + sessionId, event);
        log.info("Turn passed in session {} to player {}. New currentTurn is {}",
                sessionId, playerId, session.getCurrentTurn());
        return event;
    }

    /**
     * Retrieves session details by roomCode.
     */
    public GameSession getRoomStatus(String roomCode) {
        if (roomCode == null) {
            throw new GameException("Room code cannot be empty");
        }
        String normalizedCode = roomCode.trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(normalizedCode);
        if (sessionId == null) {
            throw new GameException("Room " + roomCode + " does not exist or has expired.");
        }
        GameSession session = sessionsById.get(sessionId);
        if (session == null || session.getStatus() == GameStatus.COMPLETED || session.getStatus() == GameStatus.ABANDONED) {
            roomCodeToSessionId.remove(normalizedCode);
            throw new GameException("Room " + roomCode + " does not exist or has expired.");
        }
        return session;
    }

    /**
     * Retrieves session details by sessionId.
     */
    public GameSession getSessionById(String sessionId) {
        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }
        return session;
    }

    /**
     * Atomic player pairing queue for quick-match.
     */
    public synchronized RoomResponseDto quickMatch(String playerId, String playerName) {
        String effectivePlayerId = (playerId != null && !playerId.isBlank())
                ? playerId
                : UUID.randomUUID().toString();
        String effectivePlayerName = (playerName != null && !playerName.isBlank())
                ? playerName
                : "Player";

        while (!matchmakingQueue.isEmpty()) {
            String queuedSessionId = matchmakingQueue.peek();
            GameSession queuedSession = sessionsById.get(queuedSessionId);

            if (queuedSession == null || queuedSession.getStatus() != GameStatus.WAITING_FOR_OPPONENT) {
                matchmakingQueue.poll();
                continue;
            }

            if (queuedSession.getPlayerX().equals(effectivePlayerId)) {
                // Same player already waiting
                return buildRoomResponse(queuedSession, "X");
            }

            // Pair with waiting player
            matchmakingQueue.poll();
            JoinRoomRequest joinRequest = JoinRoomRequest.builder()
                    .roomCode(queuedSession.getRoomCode())
                    .playerId(effectivePlayerId)
                    .playerName(effectivePlayerName)
                    .build();

            return joinRoom(joinRequest);
        }

        // No waiting player found, create new room and queue it
        CreateRoomRequest createRequest = CreateRoomRequest.builder()
                .playerId(effectivePlayerId)
                .playerName(effectivePlayerName)
                .build();

        RoomResponseDto response = createRoom(createRequest);
        matchmakingQueue.offer(response.getSessionId());
        return response;
    }

    /**
     * Applies engine move, checks win/draw, updates turn, and broadcasts event.
     */
    public GameEventDto processMove(String sessionId, MoveMessage move) {
        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }

        synchronized (session) {
            engine.validateAndApplyMove(session, move);
        }

        String eventType;
        String message;
        if (session.getStatus() == GameStatus.COMPLETED) {
            // Room is used and completed: expire room code internally so it cannot be reused
            roomCodeToSessionId.remove(session.getRoomCode());
            log.info("Room {} marked as completed and expired/deleted internally.", session.getRoomCode());
            eventType = "GAME_OVER";
            if ("DRAW".equalsIgnoreCase(session.getWinner())) {
                message = "Game ended in a draw!";
            } else {
                message = "Player " + session.getWinner() + " won the game!";
            }
        } else {
            eventType = "MOVE_MADE";
            message = "Move made at position " + move.getPosition() + " by " + move.getSymbol();
        }

        GameEventDto event = GameEventDto.builder()
                .eventType(eventType)
                .type(eventType)
                .session(session)
                .message(message)
                .build();

        messagingTemplate.convertAndSend("/topic/game/" + sessionId, event);
        log.info("Broadcasted {} for session {}", eventType, sessionId);
        return event;
    }

    /**
     * Resets board and switches starting turn for rematch.
     */
    public GameEventDto requestRematch(String sessionId, String playerId) {
        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }

        synchronized (session) {
            session.setBoard(new String[9]);
            session.setWinner(null);
            session.setWinningPattern(null);
            session.setStatus(GameStatus.ACTIVE);

            // Switch starting turn
            String nextTurn = "X".equalsIgnoreCase(session.getCurrentTurn()) ? "O" : "X";
            session.setCurrentTurn(nextTurn);
            session.setUpdatedAt(Instant.now());
        }

        GameEventDto event = GameEventDto.builder()
                .eventType("REMATCH_REQUESTED")
                .type("REMATCH_REQUESTED")
                .session(session)
                .message("Rematch started! Player " + session.getCurrentTurn() + " plays first.")
                .build();

        messagingTemplate.convertAndSend("/topic/game/" + sessionId, event);
        log.info("Rematch started for session {}", sessionId);
        return event;
    }

    private RoomResponseDto buildRoomResponse(GameSession session, String assignedSymbol) {
        return RoomResponseDto.builder()
                .sessionId(session.getSessionId())
                .roomCode(session.getRoomCode())
                .shareableUrl("/tictactoe?room=" + session.getRoomCode())
                .assignedSymbol(assignedSymbol)
                .status(session.getStatus())
                .session(session)
                .build();
    }

    private String generateUniqueRoomCode() {
        for (int attempts = 0; attempts < 1000; attempts++) {
            StringBuilder sb = new StringBuilder(ROOM_CODE_PREFIX);
            for (int i = 0; i < ROOM_CODE_RANDOM_LENGTH; i++) {
                int index = random.nextInt(ROOM_CODE_CHARACTERS.length());
                sb.append(ROOM_CODE_CHARACTERS.charAt(index));
            }
            String code = sb.toString();
            if (!roomCodeToSessionId.containsKey(code)) {
                return code;
            }
        }
        // Fallback
        return ROOM_CODE_PREFIX + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
    }
}

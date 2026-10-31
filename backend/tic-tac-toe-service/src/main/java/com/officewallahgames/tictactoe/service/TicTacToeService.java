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

        GameSession session = GameSession.builder()
                .sessionId(sessionId)
                .roomCode(roomCode)
                .playerX(playerId)
                .playerXName(playerName)
                .board(new String[9])
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
     */
    public RoomResponseDto joinRoom(JoinRoomRequest request) {
        if (request == null || request.getRoomCode() == null) {
            throw new GameException("Room code cannot be empty");
        }

        String roomCode = request.getRoomCode().trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(roomCode);
        if (sessionId == null) {
            throw new GameException("Room not found: " + request.getRoomCode());
        }

        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found for room: " + request.getRoomCode());
        }

        synchronized (session) {
            if (session.getStatus() != GameStatus.WAITING_FOR_OPPONENT || session.getPlayerO() != null) {
                throw new GameException("Room " + roomCode + " is already full! Maximum 2 players allowed.");
            }

            if (request.getPlayerId() != null && request.getPlayerId().equals(session.getPlayerX())) {
                throw new GameException("Host cannot join as opponent. Share the code with another player.");
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
                .session(session)
                .message(session.getPlayerOName() + " joined the game!")
                .build();

        messagingTemplate.convertAndSend("/topic/game/" + session.getSessionId(), event);
        log.info("Player {} joined room {}", request.getPlayerId(), roomCode);

        return buildRoomResponse(session, "O");
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
            throw new GameException("Room not found: " + roomCode);
        }
        GameSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found for room: " + roomCode);
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

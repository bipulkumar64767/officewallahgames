package com.officewallahgames.connectdrop.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.connectdrop.dto.ConnectDropEventDto;
import com.officewallahgames.connectdrop.dto.ConnectDropRoomResponse;
import com.officewallahgames.connectdrop.dto.CreateRoomRequest;
import com.officewallahgames.connectdrop.dto.DropDiscRequest;
import com.officewallahgames.connectdrop.dto.JoinRoomRequest;
import com.officewallahgames.connectdrop.dto.RematchRequest;
import com.officewallahgames.connectdrop.engine.ConnectDropEngine;
import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.model.DiscColor;
import com.officewallahgames.connectdrop.model.DropResult;
import com.officewallahgames.connectdrop.model.GameStatus;
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
public class ConnectDropService {

    private final ConnectDropEngine engine;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String ROOM_CODE_CHARACTERS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int ROOM_CODE_RANDOM_LENGTH = 4;
    private static final String ROOM_CODE_PREFIX = "CND-";
    private final SecureRandom random = new SecureRandom();

    // Thread-safe stores
    private final Map<String, ConnectDropSession> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, String> roomCodeToSessionId = new ConcurrentHashMap<>();
    private final Queue<String> matchmakingQueue = new ConcurrentLinkedQueue<>();

    /**
     * Creates a new game room with code CND-XXXX, host assigned as RED, status WAITING_FOR_OPPONENT.
     */
    public ConnectDropRoomResponse createRoom(CreateRoomRequest request) {
        String sessionId = UUID.randomUUID().toString();
        String roomCode = generateUniqueRoomCode();

        String playerId = (request != null && request.getPlayerId() != null && !request.getPlayerId().isBlank())
                ? request.getPlayerId()
                : UUID.randomUUID().toString();
        String playerName = (request != null && request.getPlayerName() != null && !request.getPlayerName().isBlank())
                ? request.getPlayerName()
                : "Player Red";

        ConnectDropSession session = ConnectDropSession.builder()
                .sessionId(sessionId)
                .roomCode(roomCode)
                .playerRed(playerId)
                .playerRedName(playerName)
                .board(new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS])
                .currentTurn(DiscColor.RED)
                .status(GameStatus.WAITING_FOR_OPPONENT)
                .turnStartedAt(System.currentTimeMillis())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        sessionsById.put(sessionId, session);
        roomCodeToSessionId.put(roomCode, sessionId);

        log.info("Connect Drop room created with code {} and sessionId {}", roomCode, sessionId);

        return buildRoomResponse(session, DiscColor.RED);
    }

    /**
     * Joins an existing room, assigns player as YELLOW, sets status to ACTIVE, broadcasts ROOM_READY.
     */
    public ConnectDropRoomResponse joinRoom(JoinRoomRequest request) {
        if (request == null || request.getRoomCode() == null) {
            throw new GameException("Room code cannot be empty");
        }

        String roomCode = request.getRoomCode().trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(roomCode);
        if (sessionId == null) {
            throw new GameException("Room not found: " + request.getRoomCode());
        }

        ConnectDropSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found for room: " + request.getRoomCode());
        }

        String playerId = (request.getPlayerId() != null && !request.getPlayerId().isBlank())
                ? request.getPlayerId()
                : UUID.randomUUID().toString();
        String playerName = (request.getPlayerName() != null && !request.getPlayerName().isBlank())
                ? request.getPlayerName()
                : "Player Yellow";

        synchronized (session) {
            if (session.getStatus() != GameStatus.WAITING_FOR_OPPONENT || session.getPlayerYellow() != null) {
                throw new GameException("Room " + roomCode + " is already full! Maximum 2 players allowed.");
            }

            if (playerId.equals(session.getPlayerRed())) {
                throw new GameException("Host cannot join as opponent. Share the code with another player.");
            }

            session.setPlayerYellow(playerId);
            session.setPlayerYellowName(playerName);
            session.setStatus(GameStatus.ACTIVE);
            session.setTurnStartedAt(System.currentTimeMillis());
            session.setUpdatedAt(Instant.now());
        }

        // Broadcast PLAYER_JOINED and ROOM_READY events
        ConnectDropEventDto joinEvent = ConnectDropEventDto.builder()
                .eventType("PLAYER_JOINED")
                .session(session)
                .message(session.getPlayerYellowName() + " joined the game!")
                .build();
        messagingTemplate.convertAndSend("/topic/connectdrop/" + session.getSessionId(), joinEvent);

        ConnectDropEventDto event = ConnectDropEventDto.builder()
                .eventType("ROOM_READY")
                .session(session)
                .message(session.getPlayerYellowName() + " joined the game! Match started.")
                .build();

        messagingTemplate.convertAndSend("/topic/connectdrop/" + session.getSessionId(), event);
        log.info("Player {} joined room {}", playerId, roomCode);

        return buildRoomResponse(session, DiscColor.YELLOW);
    }

    /**
     * Retrieves session details by roomCode.
     */
    public ConnectDropSession getRoomStatus(String roomCode) {
        if (roomCode == null) {
            throw new GameException("Room code cannot be empty");
        }
        String normalizedCode = roomCode.trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(normalizedCode);
        if (sessionId == null) {
            throw new GameException("Room not found: " + roomCode);
        }
        ConnectDropSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found for room: " + roomCode);
        }
        return session;
    }

    /**
     * Retrieves session details by sessionId.
     */
    public ConnectDropSession getSessionById(String sessionId) {
        ConnectDropSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }
        return session;
    }

    /**
     * Thread-safe atomic player pairing queue for quick-match.
     */
    public synchronized ConnectDropRoomResponse quickMatch(String playerId, String playerName) {
        String effectivePlayerId = (playerId != null && !playerId.isBlank())
                ? playerId
                : UUID.randomUUID().toString();
        String effectivePlayerName = (playerName != null && !playerName.isBlank())
                ? playerName
                : "Player";

        while (!matchmakingQueue.isEmpty()) {
            String queuedSessionId = matchmakingQueue.peek();
            ConnectDropSession queuedSession = sessionsById.get(queuedSessionId);

            if (queuedSession == null || queuedSession.getStatus() != GameStatus.WAITING_FOR_OPPONENT) {
                matchmakingQueue.poll();
                continue;
            }

            if (queuedSession.getPlayerRed().equals(effectivePlayerId)) {
                // Same player already waiting
                return buildRoomResponse(queuedSession, DiscColor.RED);
            }

            // Pair with waiting host
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

        ConnectDropRoomResponse response = createRoom(createRequest);
        matchmakingQueue.offer(response.getSessionId());
        return response;
    }

    /**
     * Drops a disc into the column, validates turn/col, updates board, and broadcasts event.
     */
    public ConnectDropEventDto dropDisc(String sessionId, DropDiscRequest request) {
        ConnectDropSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }

        DropResult result;
        synchronized (session) {
            result = engine.validateAndApplyDrop(session, request.getPlayerId(), request.getColumn());
        }

        String eventType;
        String message;
        if (result.isWin()) {
            eventType = "GAME_OVER";
            message = "Player " + result.getColor() + " (" +
                    (result.getColor() == DiscColor.RED ? session.getPlayerRedName() : session.getPlayerYellowName()) +
                    ") wins the game!";
        } else if (result.isDraw()) {
            eventType = "DRAW";
            message = "Game ended in a draw! All cells filled.";
        } else {
            eventType = "DISC_DROPPED";
            message = "Disc dropped in column " + result.getCol() + " at row " + result.getRow() + " by " + result.getColor();
        }

        ConnectDropEventDto event = ConnectDropEventDto.builder()
                .eventType(eventType)
                .session(session)
                .lastDrop(result)
                .message(message)
                .build();

        messagingTemplate.convertAndSend("/topic/connectdrop/" + sessionId, event);
        log.info("Broadcasted {} for session {}", eventType, sessionId);
        return event;
    }

    /**
     * Resets board, swaps player colors (previous Yellow becomes Red), and broadcasts REMATCH_STARTED.
     */
    public ConnectDropEventDto requestRematch(String sessionId, RematchRequest request) {
        ConnectDropSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }

        synchronized (session) {
            // Reset board and outcome
            session.setBoard(new int[ConnectDropEngine.ROWS][ConnectDropEngine.COLS]);
            session.setWinner(null);
            session.setWinningCells(null);
            session.setStatus(GameStatus.ACTIVE);

            // Swap colors: previous Yellow becomes Red
            String oldRedId = session.getPlayerRed();
            String oldRedName = session.getPlayerRedName();

            session.setPlayerRed(session.getPlayerYellow());
            session.setPlayerRedName(session.getPlayerYellowName());

            session.setPlayerYellow(oldRedId);
            session.setPlayerYellowName(oldRedName);

            // Red always plays first
            session.setCurrentTurn(DiscColor.RED);
            session.setTurnStartedAt(System.currentTimeMillis());
            session.setUpdatedAt(Instant.now());
        }

        ConnectDropEventDto event = ConnectDropEventDto.builder()
                .eventType("REMATCH_STARTED")
                .session(session)
                .message("Rematch started! Colors swapped: " + session.getPlayerRedName() + " is now RED and plays first.")
                .build();

        messagingTemplate.convertAndSend("/topic/connectdrop/" + sessionId, event);
        log.info("Rematch started for session {}", sessionId);
        return event;
    }

    private ConnectDropRoomResponse buildRoomResponse(ConnectDropSession session, DiscColor assignedColor) {
        return ConnectDropRoomResponse.builder()
                .sessionId(session.getSessionId())
                .roomCode(session.getRoomCode())
                .shareableUrl("/connectdrop?room=" + session.getRoomCode())
                .assignedColor(assignedColor)
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
        return ROOM_CODE_PREFIX + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
    }
}

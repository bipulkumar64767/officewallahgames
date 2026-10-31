package com.officewallahgames.ludo.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.ludo.dto.CreateRoomRequest;
import com.officewallahgames.ludo.dto.JoinRoomRequest;
import com.officewallahgames.ludo.dto.LudoEventDto;
import com.officewallahgames.ludo.dto.LudoRoomResponse;
import com.officewallahgames.ludo.dto.MoveTokenRequest;
import com.officewallahgames.ludo.dto.RollDiceRequest;
import com.officewallahgames.ludo.engine.LudoEngine;
import com.officewallahgames.ludo.engine.MoveResult;
import com.officewallahgames.ludo.model.GameStatus;
import com.officewallahgames.ludo.model.LudoSession;
import com.officewallahgames.ludo.model.PlayerColor;
import com.officewallahgames.ludo.model.SlotState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
@RequiredArgsConstructor
public class LudoService {

    private final LudoEngine engine;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String ROOM_CODE_CHARACTERS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int ROOM_CODE_RANDOM_LENGTH = 4;
    private static final String ROOM_CODE_PREFIX = "LDO-";
    private final SecureRandom random = new SecureRandom();

    // In-memory thread-safe storage for sessions, room codes and matchmaking queues
    private final Map<String, LudoSession> sessionsById = new ConcurrentHashMap<>();
    private final Map<String, String> roomCodeToSessionId = new ConcurrentHashMap<>();
    private final Map<Integer, Queue<String>> matchmakingQueues = new ConcurrentHashMap<>();

    /**
     * Creates a new Ludo room with the specified player count (2, 3, or 4).
     * Host is assigned PlayerColor.RED.
     */
    public LudoRoomResponse createRoom(CreateRoomRequest request) {
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

        Map<PlayerColor, SlotState> slotStates = engine.setupSlots(playerCount);
        slotStates.put(PlayerColor.RED, SlotState.ACTIVE);

        List<PlayerColor> turnOrder = engine.getTurnOrder(playerCount);

        LudoSession session = LudoSession.builder()
                .sessionId(sessionId)
                .roomCode(roomCode)
                .playerCount(playerCount)
                .slotStates(new ConcurrentHashMap<>(slotStates))
                .turnOrder(turnOrder)
                .tokens(engine.initializeTokens(turnOrder))
                .currentTurn(PlayerColor.RED)
                .diceValue(0)
                .hasRolled(false)
                .consecutiveSixes(0)
                .status(GameStatus.WAITING_FOR_PLAYERS)
                .turnStartedAt(System.currentTimeMillis())
                .createdAt(System.currentTimeMillis())
                .updatedAt(System.currentTimeMillis())
                .build();

        session.getPlayers().put(PlayerColor.RED, playerId);
        session.getPlayerNames().put(PlayerColor.RED, playerName);

        sessionsById.put(sessionId, session);
        roomCodeToSessionId.put(roomCode, sessionId);

        log.info("Created Ludo room {} (sessionId: {}, playerCount: {}) by host {}",
                roomCode, sessionId, playerCount, playerId);

        return buildRoomResponse(session, PlayerColor.RED);
    }

    /**
     * Joins an existing room by room code. Assigns next available waiting color.
     */
    public LudoRoomResponse joinRoom(JoinRoomRequest request) {
        if (request == null || request.getRoomCode() == null) {
            throw new GameException("Room code cannot be empty");
        }
        String normalizedCode = request.getRoomCode().trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(normalizedCode);
        if (sessionId == null) {
            throw new GameException("Room not found: " + request.getRoomCode());
        }

        LudoSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }

        synchronized (session) {
            // Check if player is already in this session
            for (Map.Entry<PlayerColor, String> entry : session.getPlayers().entrySet()) {
                if (entry.getValue().equals(request.getPlayerId())) {
                    return buildRoomResponse(session, entry.getKey());
                }
            }

            if (session.getStatus() != GameStatus.WAITING_FOR_PLAYERS) {
                throw new GameException("Room " + request.getRoomCode() + " is already full! Maximum players already joined.");
            }

            // Find next WAITING color in turn order
            PlayerColor assignedColor = null;
            for (PlayerColor color : session.getTurnOrder()) {
                if (session.getSlotStates().get(color) == SlotState.WAITING) {
                    assignedColor = color;
                    break;
                }
            }

            if (assignedColor == null) {
                throw new GameException("Room " + request.getRoomCode() + " is already full! Maximum players already joined.");
            }

            String playerName = (request.getPlayerName() != null && !request.getPlayerName().isBlank())
                    ? request.getPlayerName()
                    : "Player " + assignedColor;

            session.getPlayers().put(assignedColor, request.getPlayerId());
            session.getPlayerNames().put(assignedColor, playerName);
            session.getSlotStates().put(assignedColor, SlotState.ACTIVE);
            session.setUpdatedAt(System.currentTimeMillis());

            // Check if all players in turnOrder have joined
            boolean allJoined = session.getTurnOrder().stream()
                    .allMatch(c -> session.getSlotStates().get(c) == SlotState.ACTIVE);

            // Always broadcast PLAYER_JOINED first so host and all clients register the joined player immediately
            LudoEventDto joinEvent = LudoEventDto.of("PLAYER_JOINED", session, playerName + " joined as " + assignedColor);
            messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, joinEvent);

            if (allJoined) {
                session.setStatus(GameStatus.ACTIVE);
                session.setCurrentTurn(PlayerColor.RED);
                session.setTurnStartedAt(System.currentTimeMillis());

                LudoEventDto readyEvent = LudoEventDto.of("ROOM_READY", session, "All players joined! Ludo Royale showdown begins.");
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, readyEvent);
                log.info("Room {} is now full and ACTIVE!", normalizedCode);
            } else {
                log.info("Player {} joined room {} as {}", request.getPlayerId(), normalizedCode, assignedColor);
            }

            return buildRoomResponse(session, assignedColor);
        }
    }

    /**
     * Retrieves session details by roomCode.
     */
    public LudoSession getRoomStatus(String roomCode) {
        if (roomCode == null) {
            throw new GameException("Room code cannot be empty");
        }
        String normalizedCode = roomCode.trim().toUpperCase();
        String sessionId = roomCodeToSessionId.get(normalizedCode);
        if (sessionId == null) {
            throw new GameException("Room not found: " + roomCode);
        }
        LudoSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found for room: " + roomCode);
        }
        return session;
    }

    /**
     * Retrieves session details by sessionId.
     */
    public LudoSession getSessionById(String sessionId) {
        LudoSession session = sessionsById.get(sessionId);
        if (session == null) {
            throw new GameException("Game session not found: " + sessionId);
        }
        return session;
    }

    /**
     * Quick-match pairing for 2, 3, or 4 players.
     */
    public synchronized LudoRoomResponse quickMatch(String playerId, String playerName, int playerCount) {
        int effectivePlayerCount = (playerCount == 2 || playerCount == 3 || playerCount == 4) ? playerCount : 4;
        String effectivePlayerId = (playerId != null && !playerId.isBlank()) ? playerId : UUID.randomUUID().toString();
        String effectivePlayerName = (playerName != null && !playerName.isBlank()) ? playerName : "Player";

        Queue<String> queue = matchmakingQueues.computeIfAbsent(effectivePlayerCount, k -> new ConcurrentLinkedQueue<>());

        while (!queue.isEmpty()) {
            String queuedSessionId = queue.peek();
            LudoSession queuedSession = sessionsById.get(queuedSessionId);

            if (queuedSession == null
                    || queuedSession.getStatus() != GameStatus.WAITING_FOR_PLAYERS
                    || queuedSession.getPlayerCount() != effectivePlayerCount) {
                queue.poll();
                continue;
            }

            if (queuedSession.getPlayers().containsValue(effectivePlayerId)) {
                PlayerColor assigned = queuedSession.getPlayers().entrySet().stream()
                        .filter(e -> e.getValue().equals(effectivePlayerId))
                        .map(Map.Entry::getKey)
                        .findFirst()
                        .orElse(PlayerColor.RED);
                return buildRoomResponse(queuedSession, assigned);
            }

            JoinRoomRequest joinRequest = JoinRoomRequest.builder()
                    .roomCode(queuedSession.getRoomCode())
                    .playerId(effectivePlayerId)
                    .playerName(effectivePlayerName)
                    .build();

            LudoRoomResponse response = joinRoom(joinRequest);

            if (queuedSession.getStatus() == GameStatus.ACTIVE) {
                queue.poll();
            }

            return response;
        }

        // No open room found: create new room and enqueue
        CreateRoomRequest createRequest = CreateRoomRequest.builder()
                .playerId(effectivePlayerId)
                .playerName(effectivePlayerName)
                .playerCount(effectivePlayerCount)
                .build();

        LudoRoomResponse response = createRoom(createRequest);
        queue.add(response.getSessionId());
        return response;
    }

    /**
     * Rolls the dice for the active player's turn.
     * Evaluates consecutive sixes, movable tokens, and auto-skipping.
     */
    public LudoSession rollDice(String sessionId, RollDiceRequest request) {
        LudoSession session = getSessionById(sessionId);

        synchronized (session) {
            validateTurn(session, request.getPlayerId(), request.getColor());

            if (session.isHasRolled()) {
                throw new GameException("Dice has already been rolled for this turn");
            }

            int roll = engine.rollDice();
            session.setDiceValue(roll);
            session.setUpdatedAt(System.currentTimeMillis());

            if (roll == 6) {
                session.setConsecutiveSixes(session.getConsecutiveSixes() + 1);
            } else {
                session.setConsecutiveSixes(0);
            }

            // 3 Consecutive 6s penalty check
            if (session.getConsecutiveSixes() == 3) {
                log.info("Player {} rolled 3 consecutive sixes in session {}. Turn skipped.",
                        request.getColor(), sessionId);
                session.setConsecutiveSixes(0);
                session.setHasRolled(false);
                session.setMovableTokenIds(Collections.emptyList());
                engine.cycleTurn(session);

                LudoEventDto event = LudoEventDto.of("TURN_SKIPPED", session,
                        request.getColor() + " rolled 3 consecutive sixes! Turn forfeited.");
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, event);
                return session;
            }

            List<String> movableTokens = engine.getMovableTokens(session, request.getColor(), roll);

            // Auto-skip if 0 movable tokens
            if (movableTokens.isEmpty()) {
                log.info("Player {} rolled {} with no movable tokens in session {}. Turn skipped.",
                        request.getColor(), roll, sessionId);
                session.setHasRolled(false);
                session.setMovableTokenIds(Collections.emptyList());
                session.setConsecutiveSixes(0);
                engine.cycleTurn(session);

                LudoEventDto event = LudoEventDto.of("TURN_SKIPPED", session,
                        request.getColor() + " rolled " + roll + " but has no valid moves. Turn skipped.");
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, event);
                return session;
            }

            session.setHasRolled(true);
            session.setMovableTokenIds(movableTokens);

            LudoEventDto event = LudoEventDto.of("DICE_ROLLED", session,
                    request.getColor() + " rolled a " + roll + ".");
            messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, event);
            return session;
        }
    }

    /**
     * Executes moving a chosen token. Checks captures, rank, win, and updates turns.
     */
    public LudoSession moveToken(String sessionId, MoveTokenRequest request) {
        LudoSession session = getSessionById(sessionId);

        synchronized (session) {
            validateTurn(session, request.getPlayerId(), request.getColor());

            if (!session.isHasRolled()) {
                throw new GameException("Must roll dice before moving a token");
            }

            if (!session.getMovableTokenIds().contains(request.getTokenId())) {
                throw new GameException("Token " + request.getTokenId() + " cannot be moved with current roll");
            }

            int roll = session.getDiceValue();
            MoveResult result = engine.moveToken(session, request.getColor(), request.getTokenId(), roll);
            session.setUpdatedAt(System.currentTimeMillis());

            // Broadcast capture event if any tokens were captured
            if (!result.getCapturedTokens().isEmpty()) {
                LudoEventDto captureEvent = LudoEventDto.of("TOKEN_CAPTURED", session,
                        request.getColor() + " captured " + result.getCapturedTokens().size() + " opponent token(s)!");
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, captureEvent);
            }

            // Broadcast rank event if player finished all 4 tokens
            if (result.isPlayerRanked()) {
                LudoEventDto rankEvent = LudoEventDto.of("PLAYER_RANKED", session,
                        request.getColor() + " completed all tokens! Rank #" + session.getRankings().size());
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, rankEvent);
            }

            // Broadcast game over or normal move event
            if (result.isGameOver()) {
                LudoEventDto overEvent = LudoEventDto.of("GAME_OVER", session,
                        "Game over! Winner is " + session.getRankings().get(0));
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, overEvent);
            } else {
                LudoEventDto moveEvent = LudoEventDto.of("TOKEN_MOVED", session,
                        request.getColor() + " moved " + request.getTokenId()
                                + (result.isBonusTurn() ? " and earned a bonus turn!" : "."));
                messagingTemplate.convertAndSend("/topic/ludo/" + sessionId, moveEvent);
            }

            return session;
        }
    }

    private void validateTurn(LudoSession session, String playerId, PlayerColor color) {
        if (session.getStatus() != GameStatus.ACTIVE) {
            throw new GameException("Game is not active (current status: " + session.getStatus() + ")");
        }
        if (session.getCurrentTurn() != color) {
            throw new GameException("It is not " + color + "'s turn");
        }
        String expectedPlayerId = session.getPlayers().get(color);
        if (expectedPlayerId == null || !expectedPlayerId.equals(playerId)) {
            throw new GameException("Player " + playerId + " does not own color " + color);
        }
    }

    private LudoRoomResponse buildRoomResponse(LudoSession session, PlayerColor assignedColor) {
        String shareableUrl = "http://localhost:5173/games/ludo?room=" + session.getRoomCode();
        return LudoRoomResponse.builder()
                .sessionId(session.getSessionId())
                .roomCode(session.getRoomCode())
                .shareableUrl(shareableUrl)
                .assignedColor(assignedColor)
                .playerCount(session.getPlayerCount())
                .slotStates(session.getSlotStates())
                .status(session.getStatus())
                .session(session)
                .build();
    }

    private String generateUniqueRoomCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(ROOM_CODE_PREFIX);
            for (int i = 0; i < ROOM_CODE_RANDOM_LENGTH; i++) {
                int index = random.nextInt(ROOM_CODE_CHARACTERS.length());
                sb.append(ROOM_CODE_CHARACTERS.charAt(index));
            }
            code = sb.toString();
        } while (roomCodeToSessionId.containsKey(code));
        return code;
    }
}

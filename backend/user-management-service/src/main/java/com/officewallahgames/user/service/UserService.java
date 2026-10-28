package com.officewallahgames.user.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.user.dto.AuthResponseDto;
import com.officewallahgames.user.dto.LoginRequest;
import com.officewallahgames.user.model.UserSession;
import com.officewallahgames.user.util.SnowflakeIdGenerator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserService {

    private final SnowflakeIdGenerator snowflakeIdGenerator;
    private final String fixedToken;

    // Thread-safe in-memory store for user sessions (token -> UserSession)
    private final Map<String, UserSession> sessionStore = new ConcurrentHashMap<>();

    public UserService(
            SnowflakeIdGenerator snowflakeIdGenerator,
            @Value("${app.auth.fixed-token:owg-fixed-auth-token-2026}") String fixedToken) {
        this.snowflakeIdGenerator = snowflakeIdGenerator;
        this.fixedToken = fixedToken;
    }

    /**
     * Initializes a temporary guest session using a Snowflake ID.
     */
    public AuthResponseDto createGuestSession() {
        String guestId = snowflakeIdGenerator.nextGuestId();
        String token = "guest-token-" + UUID.randomUUID();

        UserSession session = UserSession.builder()
                .userId(guestId)
                .displayName(guestId)
                .token(token)
                .isGuest(true)
                .createdAt(Instant.now())
                .build();

        sessionStore.put(token, session);

        return new AuthResponseDto(
                session.getUserId(),
                session.getDisplayName(),
                session.getToken(),
                session.isGuest()
        );
    }

    /**
     * Authenticates a registered user.
     * Accepts any non-empty username/password for demo/sandbox purposes and issues the fixed token.
     */
    public AuthResponseDto login(LoginRequest request) {
        if (request == null || request.username() == null || request.username().isBlank()) {
            throw new GameException("Username must not be blank");
        }
        if (request.password() == null || request.password().isBlank()) {
            throw new GameException("Password must not be blank");
        }

        String username = request.username().trim();
        String userId = "USER_" + username.toLowerCase();

        UserSession session = UserSession.builder()
                .userId(userId)
                .displayName(username)
                .token(fixedToken)
                .isGuest(false)
                .createdAt(Instant.now())
                .build();

        sessionStore.put(fixedToken, session);

        return new AuthResponseDto(
                session.getUserId(),
                session.getDisplayName(),
                session.getToken(),
                session.isGuest()
        );
    }

    /**
     * Resolves profile information from a session token.
     */
    public AuthResponseDto getProfileByToken(String token) {
        String cleanToken = cleanToken(token);
        if (cleanToken == null || cleanToken.isBlank()) {
            throw new GameException("Invalid or expired session token");
        }

        UserSession session = sessionStore.get(cleanToken);
        if (session == null) {
            throw new GameException("Invalid or expired session token");
        }

        return new AuthResponseDto(
                session.getUserId(),
                session.getDisplayName(),
                session.getToken(),
                session.isGuest()
        );
    }

    private String cleanToken(String token) {
        if (token == null) {
            return null;
        }
        String trimmed = token.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }
}

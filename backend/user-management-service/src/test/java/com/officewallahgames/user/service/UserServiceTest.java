package com.officewallahgames.user.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.user.dto.AuthResponseDto;
import com.officewallahgames.user.dto.LoginRequest;
import com.officewallahgames.user.util.SnowflakeIdGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UserServiceTest {

    private SnowflakeIdGenerator snowflakeIdGenerator;
    private UserService userService;
    private static final String FIXED_TOKEN = "owg-fixed-auth-token-2026";

    @BeforeEach
    void setUp() {
        snowflakeIdGenerator = new SnowflakeIdGenerator(1, 1);
        userService = new UserService(snowflakeIdGenerator, FIXED_TOKEN);
    }

    @Test
    @DisplayName("Should create guest session with Snowflake ID and guest token")
    void testCreateGuestSession() {
        AuthResponseDto guestResponse = userService.createGuestSession();

        assertNotNull(guestResponse);
        assertNotNull(guestResponse.userId());
        assertTrue(guestResponse.userId().startsWith("GUEST_"));
        assertTrue(guestResponse.isGuest());
        assertNotNull(guestResponse.token());
        assertTrue(guestResponse.token().startsWith("guest-token-"));

        // Verify session can be retrieved by token
        AuthResponseDto retrieved = userService.getProfileByToken(guestResponse.token());
        assertEquals(guestResponse.userId(), retrieved.userId());
        assertEquals(guestResponse.displayName(), retrieved.displayName());
        assertEquals(guestResponse.token(), retrieved.token());
        assertTrue(retrieved.isGuest());
    }

    @Test
    @DisplayName("Should successfully authenticate user and return fixed token")
    void testLoginSuccess() {
        LoginRequest request = new LoginRequest("rahul_dev", "password123");
        AuthResponseDto response = userService.login(request);

        assertNotNull(response);
        assertEquals("USER_rahul_dev", response.userId());
        assertEquals("rahul_dev", response.displayName());
        assertEquals(FIXED_TOKEN, response.token());
        assertFalse(response.isGuest());

        // Verify resolution via clean token
        AuthResponseDto byToken = userService.getProfileByToken(FIXED_TOKEN);
        assertEquals("USER_rahul_dev", byToken.userId());
        assertEquals("rahul_dev", byToken.displayName());
        assertFalse(byToken.isGuest());

        // Verify resolution with Bearer prefix
        AuthResponseDto byBearerToken = userService.getProfileByToken("Bearer " + FIXED_TOKEN);
        assertEquals("USER_rahul_dev", byBearerToken.userId());
        assertEquals("rahul_dev", byBearerToken.displayName());
    }

    @Test
    @DisplayName("Should reject blank credentials during login")
    void testLoginInvalidCredentials() {
        assertThrows(GameException.class, () -> userService.login(new LoginRequest("", "secret")));
        assertThrows(GameException.class, () -> userService.login(new LoginRequest("user", "  ")));
        assertThrows(GameException.class, () -> userService.login(null));
    }

    @Test
    @DisplayName("Should throw GameException when token is not found or invalid")
    void testGetProfileByTokenNotFound() {
        GameException ex = assertThrows(GameException.class, () ->
                userService.getProfileByToken("non-existent-token"));
        assertEquals("Invalid or expired session token", ex.getMessage());

        assertThrows(GameException.class, () -> userService.getProfileByToken(null));
        assertThrows(GameException.class, () -> userService.getProfileByToken(""));
        assertThrows(GameException.class, () -> userService.getProfileByToken("   "));
    }

    @Test
    @DisplayName("Should generate unique guest IDs across sequential calls")
    void testGuestIdUniqueness() {
        AuthResponseDto guest1 = userService.createGuestSession();
        AuthResponseDto guest2 = userService.createGuestSession();

        assertNotEquals(guest1.userId(), guest2.userId());
        assertNotEquals(guest1.token(), guest2.token());
    }
}

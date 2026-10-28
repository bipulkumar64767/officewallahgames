package com.officewallahgames.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.officewallahgames.user.dto.AuthResponseDto;
import com.officewallahgames.user.dto.LoginRequest;
import com.officewallahgames.user.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @Test
    @DisplayName("POST /api/v1/auth/guest should return success with guest session")
    void testGuestSession() throws Exception {
        AuthResponseDto mockGuest = new AuthResponseDto("GUEST_12345", "GUEST_12345", "guest-token-abc", true);
        when(userService.createGuestSession()).thenReturn(mockGuest);

        mockMvc.perform(post("/api/v1/auth/guest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.message").value("Guest session initialized"))
                .andExpect(jsonPath("$.data.userId").value("GUEST_12345"))
                .andExpect(jsonPath("$.data.isGuest").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/auth/login should authenticate user and return token")
    void testLogin() throws Exception {
        LoginRequest request = new LoginRequest("testuser", "password");
        AuthResponseDto mockAuth = new AuthResponseDto("USER_testuser", "testuser", "owg-fixed-auth-token-2026", false);
        when(userService.login(any(LoginRequest.class))).thenReturn(mockAuth);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.message").value("Login successful"))
                .andExpect(jsonPath("$.data.userId").value("USER_testuser"))
                .andExpect(jsonPath("$.data.isGuest").value(false));
    }

    @Test
    @DisplayName("GET /api/v1/auth/me with Bearer token should return profile")
    void testGetProfileWithBearerToken() throws Exception {
        AuthResponseDto mockAuth = new AuthResponseDto("USER_testuser", "testuser", "owg-fixed-auth-token-2026", false);
        when(userService.getProfileByToken("owg-fixed-auth-token-2026")).thenReturn(mockAuth);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer owg-fixed-auth-token-2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.userId").value("USER_testuser"));
    }
}

package com.officewallahgames.user.controller;

import com.officewallahgames.common.dto.ApiResponse;
import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.user.dto.AuthResponseDto;
import com.officewallahgames.user.dto.LoginRequest;
import com.officewallahgames.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/guest")
    public ApiResponse<AuthResponseDto> guestSession() {
        AuthResponseDto response = userService.createGuestSession();
        return ApiResponse.success(response, "Guest session initialized");
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponseDto> login(@Valid @RequestBody LoginRequest request) {
        AuthResponseDto response = userService.login(request);
        return ApiResponse.success(response, "Login successful");
    }

    @GetMapping("/me")
    public ApiResponse<AuthResponseDto> getProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            throw new GameException("Missing or invalid Authorization header");
        }

        String token = authHeader.trim();
        if (token.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = token.substring(7).trim();
        }

        AuthResponseDto response = userService.getProfileByToken(token);
        return ApiResponse.success(response, "Profile retrieved successfully");
    }
}

package com.officewallahgames.user.dto;

public record AuthResponseDto(
        String userId,
        String displayName,
        String token,
        boolean isGuest
) {}

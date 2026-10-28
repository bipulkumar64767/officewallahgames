package com.officewallahgames.master.controller;

import com.officewallahgames.common.dto.ApiResponse;
import com.officewallahgames.master.dto.CatalogResponseDto;
import com.officewallahgames.master.dto.GameToggleRequest;
import com.officewallahgames.master.model.GameMetadata;
import com.officewallahgames.master.service.GameCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/games")
@RequiredArgsConstructor
public class GameCatalogController {

    private final GameCatalogService catalogService;

    @GetMapping("/catalog")
    public ApiResponse<CatalogResponseDto> getCatalog() {
        return ApiResponse.success(catalogService.getCatalog(), "Catalog retrieved successfully");
    }

    @GetMapping("/{gameId}")
    public ApiResponse<GameMetadata> getGameById(@PathVariable String gameId) {
        return ApiResponse.success(catalogService.getGameById(gameId));
    }

    @PostMapping("/{gameId}/toggle")
    public ApiResponse<GameMetadata> toggleGameStatus(
            @PathVariable String gameId,
            @RequestBody(required = false) GameToggleRequest request) {
        return ApiResponse.success(catalogService.toggleGameStatus(gameId, request));
    }
}

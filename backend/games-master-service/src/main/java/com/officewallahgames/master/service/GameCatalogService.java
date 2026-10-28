package com.officewallahgames.master.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.master.dto.CatalogResponseDto;
import com.officewallahgames.master.dto.GameToggleRequest;
import com.officewallahgames.master.dto.ModeSummaryDto;
import com.officewallahgames.master.model.GameMetadata;
import com.officewallahgames.master.model.GameMode;
import com.officewallahgames.master.repository.GameCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GameCatalogService {

    private final GameCatalogRepository repository;

    public CatalogResponseDto getCatalog() {
        List<GameMetadata> games = repository.findAll();

        long multiPlayerCount = games.stream()
                .filter(g -> g.getGameMode() == GameMode.MULTIPLAYER)
                .count();

        long singlePlayerCount = games.stream()
                .filter(g -> g.getGameMode() == GameMode.SINGLE_PLAYER)
                .count();

        List<ModeSummaryDto> modes = List.of(
                ModeSummaryDto.builder()
                        .id("MULTIPLAYER")
                        .title("Multiplayer Arena")
                        .tagline("Real-time 1v1 PvP quick rounds with colleagues")
                        .icon("Users")
                        .count(multiPlayerCount)
                        .build(),
                ModeSummaryDto.builder()
                        .id("SINGLE_PLAYER")
                        .title("Solo Play")
                        .tagline("Quick arcade and puzzle brain teasers")
                        .icon("User")
                        .count(singlePlayerCount)
                        .build()
        );

        return CatalogResponseDto.builder()
                .modes(modes)
                .games(games)
                .build();
    }

    public GameMetadata getGameById(String gameId) {
        return repository.findById(gameId)
                .orElseThrow(() -> new GameException("Game not found with id: " + gameId));
    }

    public GameMetadata toggleGameStatus(String gameId, GameToggleRequest request) {
        GameMetadata game = getGameById(gameId);

        if (request != null) {
            if (request.getIsActive() != null) {
                game.setActive(request.getIsActive());
            }
            if (request.getIsMaintenance() != null) {
                game.setMaintenance(request.getIsMaintenance());
            }
        }

        return repository.save(game);
    }
}

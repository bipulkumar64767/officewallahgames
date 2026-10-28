package com.officewallahgames.master.service;

import com.officewallahgames.common.exception.GameException;
import com.officewallahgames.master.dto.CatalogResponseDto;
import com.officewallahgames.master.dto.GameToggleRequest;
import com.officewallahgames.master.dto.ModeSummaryDto;
import com.officewallahgames.master.model.GameMetadata;
import com.officewallahgames.master.model.GameMode;
import com.officewallahgames.master.repository.GameCatalogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GameCatalogServiceTest {

    @Mock
    private GameCatalogRepository repository;

    @InjectMocks
    private GameCatalogService gameCatalogService;

    private GameMetadata tictactoe;
    private GameMetadata snake;

    @BeforeEach
    void setUp() {
        tictactoe = GameMetadata.builder()
                .gameId("tictactoe")
                .name("Tic-Tac-Toe Arena")
                .tagline("Real-time 1v1 PvP quick rounds")
                .gameMode(GameMode.MULTIPLAYER)
                .category("PVP_CASUAL")
                .thumbnailUrl("/assets/games/tictactoe-thumb.png")
                .route("/games/tictactoe")
                .minPlayers(2)
                .maxPlayers(2)
                .isActive(true)
                .isMaintenance(false)
                .displayOrder(1)
                .build();

        snake = GameMetadata.builder()
                .gameId("snake")
                .name("Snake Rush")
                .tagline("Classic retro snake with modern neon visuals")
                .gameMode(GameMode.SINGLE_PLAYER)
                .category("ARCADE")
                .thumbnailUrl("/assets/games/snake-thumb.png")
                .route("/games/snake")
                .minPlayers(1)
                .maxPlayers(1)
                .isActive(false)
                .isMaintenance(false)
                .displayOrder(2)
                .build();
    }

    @Test
    @DisplayName("getCatalog returns catalog with computed mode counts and games list")
    void getCatalog_success() {
        when(repository.findAll()).thenReturn(List.of(tictactoe, snake));

        CatalogResponseDto response = gameCatalogService.getCatalog();

        assertThat(response).isNotNull();
        assertThat(response.getGames()).hasSize(2);
        assertThat(response.getModes()).hasSize(2);

        ModeSummaryDto multi = response.getModes().stream()
                .filter(m -> "MULTIPLAYER".equals(m.getId()))
                .findFirst()
                .orElse(null);
        assertThat(multi).isNotNull();
        assertThat(multi.getCount()).isEqualTo(1);

        ModeSummaryDto single = response.getModes().stream()
                .filter(m -> "SINGLE_PLAYER".equals(m.getId()))
                .findFirst()
                .orElse(null);
        assertThat(single).isNotNull();
        assertThat(single.getCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("getGameById returns game when gameId exists")
    void getGameById_found() {
        when(repository.findById("tictactoe")).thenReturn(Optional.of(tictactoe));

        GameMetadata game = gameCatalogService.getGameById("tictactoe");

        assertThat(game).isNotNull();
        assertThat(game.getGameId()).isEqualTo("tictactoe");
        assertThat(game.getName()).isEqualTo("Tic-Tac-Toe Arena");
    }

    @Test
    @DisplayName("getGameById throws GameException when gameId does not exist")
    void getGameById_notFound_throwsException() {
        when(repository.findById("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gameCatalogService.getGameById("unknown"))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("Game not found with id: unknown");
    }

    @Test
    @DisplayName("toggleGameStatus updates isActive and isMaintenance")
    void toggleGameStatus_success() {
        when(repository.findById("snake")).thenReturn(Optional.of(snake));
        when(repository.save(any(GameMetadata.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameToggleRequest request = GameToggleRequest.builder()
                .isActive(true)
                .isMaintenance(true)
                .reason("Scheduled maintenance")
                .build();

        GameMetadata updated = gameCatalogService.toggleGameStatus("snake", request);

        assertThat(updated.isActive()).isTrue();
        assertThat(updated.isMaintenance()).isTrue();
        verify(repository).save(snake);
    }
}

package com.officewallahgames.master.repository;

import com.officewallahgames.master.model.GameMetadata;
import com.officewallahgames.master.model.GameMode;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class GameCatalogRepository {

    private final Map<String, GameMetadata> gamesMap = new ConcurrentHashMap<>();

    public GameCatalogRepository() {
        seedInitialGames();
    }

    private void seedInitialGames() {
        save(GameMetadata.builder()
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
                .build());

        save(GameMetadata.builder()
                .gameId("ludo")
                .name("Ludo Royale")
                .tagline("Real-time 2-4 player board showdown")
                .gameMode(GameMode.MULTIPLAYER)
                .category("BOARD_PVP")
                .thumbnailUrl("/assets/games/ludo-thumb.png")
                .route("/games/ludo")
                .minPlayers(2)
                .maxPlayers(4)
                .isActive(true)
                .isMaintenance(false)
                .displayOrder(2)
                .build());

        save(GameMetadata.builder()
                .gameId("wordgrid")
                .name("Word Grid Blitz")
                .tagline("Strategic real-time 10x10 word battle")
                .gameMode(GameMode.MULTIPLAYER)
                .category("WORD_PVP")
                .thumbnailUrl("/assets/games/wordgrid-thumb.png")
                .route("/games/wordgrid")
                .minPlayers(2)
                .maxPlayers(4)
                .isActive(true)
                .isMaintenance(false)
                .displayOrder(3)
                .build());

        save(GameMetadata.builder()
                .gameId("connectdrop")
                .name("Connect Drop")
                .tagline("Real-time 2-player 4-in-a-row drop duel")
                .gameMode(GameMode.MULTIPLAYER)
                .category("STRATEGY_PVP")
                .thumbnailUrl("/assets/games/connectdrop-thumb.png")
                .route("/games/connectdrop")
                .minPlayers(2)
                .maxPlayers(2)
                .isActive(true)
                .isMaintenance(false)
                .displayOrder(4)
                .build());

        save(GameMetadata.builder()
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
                .displayOrder(5)
                .build());

        save(GameMetadata.builder()
                .gameId("grid2048")
                .name("2048 Cyber Grid")
                .tagline("Swipe and combine tiles to reach 2048")
                .gameMode(GameMode.SINGLE_PLAYER)
                .category("PUZZLE")
                .thumbnailUrl("/assets/games/2048-thumb.png")
                .route("/games/2048")
                .minPlayers(1)
                .maxPlayers(1)
                .isActive(false)
                .isMaintenance(false)
                .displayOrder(6)
                .build());

        save(GameMetadata.builder()
                .gameId("speedchess")
                .name("Speed Chess Arena")
                .tagline("Fast-paced 5-minute blitz chess matches")
                .gameMode(GameMode.MULTIPLAYER)
                .category("STRATEGY")
                .thumbnailUrl("/assets/games/chess-thumb.png")
                .route("/games/chess")
                .minPlayers(2)
                .maxPlayers(2)
                .isActive(false)
                .isMaintenance(false)
                .displayOrder(7)
                .build());
    }

    public List<GameMetadata> findAll() {
        List<GameMetadata> games = new ArrayList<>(gamesMap.values());
        games.sort(Comparator.comparingInt(GameMetadata::getDisplayOrder));
        return games;
    }

    public Optional<GameMetadata> findById(String gameId) {
        if (gameId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(gamesMap.get(gameId.toLowerCase()));
    }

    public GameMetadata save(GameMetadata game) {
        if (game != null && game.getGameId() != null) {
            gamesMap.put(game.getGameId().toLowerCase(), game);
        }
        return game;
    }
}

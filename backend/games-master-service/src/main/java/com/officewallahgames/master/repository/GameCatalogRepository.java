package com.officewallahgames.master.repository;

import com.officewallahgames.master.model.GameMetadata;
import com.officewallahgames.master.model.GameMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Slf4j
@Repository
@RequiredArgsConstructor
public class GameCatalogRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<GameMetadata> ROW_MAPPER = new RowMapper<>() {
        @Override
        public GameMetadata mapRow(ResultSet rs, int rowNum) throws SQLException {
            return GameMetadata.builder()
                    .gameId(rs.getString("game_id"))
                    .name(rs.getString("name"))
                    .tagline(rs.getString("tagline"))
                    .gameMode(GameMode.valueOf(rs.getString("game_mode")))
                    .category(rs.getString("category"))
                    .thumbnailUrl(rs.getString("thumbnail_url"))
                    .route(rs.getString("route"))
                    .minPlayers(rs.getInt("min_players"))
                    .maxPlayers(rs.getInt("max_players"))
                    .isActive(rs.getBoolean("is_active"))
                    .isMaintenance(rs.getBoolean("is_maintenance"))
                    .displayOrder(rs.getInt("display_order"))
                    .build();
        }
    };

    public List<GameMetadata> findAll() {
        String sql = "SELECT * FROM game_metadata ORDER BY display_order ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<GameMetadata> findById(String gameId) {
        if (gameId == null) {
            return Optional.empty();
        }
        String sql = "SELECT * FROM game_metadata WHERE LOWER(game_id) = LOWER(?)";
        List<GameMetadata> results = jdbcTemplate.query(sql, ROW_MAPPER, gameId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public GameMetadata save(GameMetadata game) {
        if (game == null || game.getGameId() == null) {
            return game;
        }
        String sql = """
            INSERT INTO game_metadata (game_id, name, tagline, game_mode, category, thumbnail_url, route, min_players, max_players, is_active, is_maintenance, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (game_id) DO UPDATE SET
                name = EXCLUDED.name,
                tagline = EXCLUDED.tagline,
                game_mode = EXCLUDED.game_mode,
                category = EXCLUDED.category,
                thumbnail_url = EXCLUDED.thumbnail_url,
                route = EXCLUDED.route,
                min_players = EXCLUDED.min_players,
                max_players = EXCLUDED.max_players,
                is_active = EXCLUDED.is_active,
                is_maintenance = EXCLUDED.is_maintenance,
                display_order = EXCLUDED.display_order
        """;
        jdbcTemplate.update(sql,
                game.getGameId(),
                game.getName(),
                game.getTagline(),
                game.getGameMode().name(),
                game.getCategory(),
                game.getThumbnailUrl(),
                game.getRoute(),
                game.getMinPlayers(),
                game.getMaxPlayers(),
                game.isActive(),
                game.isMaintenance(),
                game.getDisplayOrder()
        );
        return game;
    }
}

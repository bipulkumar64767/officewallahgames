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

    @jakarta.annotation.PostConstruct
    public void initSchema() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS game_metadata (
                    game_id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    tagline VARCHAR(255),
                    game_mode VARCHAR(30) NOT NULL,
                    category VARCHAR(50),
                    thumbnail_url VARCHAR(255),
                    route VARCHAR(100),
                    min_players INT DEFAULT 1,
                    max_players INT DEFAULT 4,
                    is_active BOOLEAN DEFAULT true,
                    is_maintenance BOOLEAN DEFAULT false,
                    display_order INT DEFAULT 0,
                    is_trending BOOLEAN DEFAULT false,
                    play_count BIGINT DEFAULT 0
                );
            """);
            jdbcTemplate.execute("ALTER TABLE game_metadata ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;");
            jdbcTemplate.execute("ALTER TABLE game_metadata ADD COLUMN IF NOT EXISTS play_count BIGINT DEFAULT 0;");

            // Seed initial trending game and play counts if play_count is 0
            jdbcTemplate.execute("""
                UPDATE game_metadata SET is_trending = true, play_count = 14250 WHERE game_id = 'tictactoe' AND play_count = 0;
                UPDATE game_metadata SET play_count = 11840 WHERE game_id = 'ludo' AND play_count = 0;
                UPDATE game_metadata SET play_count = 6200 WHERE game_id = 'wordgrid' AND play_count = 0;
                UPDATE game_metadata SET play_count = 5120 WHERE game_id = 'connectdrop' AND play_count = 0;
            """);
            log.info("Master service game_metadata schema verified with trending & play_count columns.");
        } catch (Exception e) {
            log.warn("Table setup or column addition note: {}", e.getMessage());
        }
    }

    private static final RowMapper<GameMetadata> ROW_MAPPER = new RowMapper<>() {
        @Override
        public GameMetadata mapRow(ResultSet rs, int rowNum) throws SQLException {
            boolean trending = false;
            long plays = 0;
            try {
                trending = rs.getBoolean("is_trending");
            } catch (SQLException ignored) {}
            try {
                plays = rs.getLong("play_count");
            } catch (SQLException ignored) {}

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
                    .isTrending(trending)
                    .playCount(plays)
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
            INSERT INTO game_metadata (game_id, name, tagline, game_mode, category, thumbnail_url, route, min_players, max_players, is_active, is_maintenance, display_order, is_trending, play_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                display_order = EXCLUDED.display_order,
                is_trending = EXCLUDED.is_trending,
                play_count = EXCLUDED.play_count
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
                game.getDisplayOrder(),
                game.isTrending(),
                game.getPlayCount()
        );
        return game;
    }
}

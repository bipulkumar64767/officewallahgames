# 📋 PRD 01: Games Master Service

---

## 1. Overview & Objective
- **Service Name**: `games-master-service`
- **Default Port**: `8081`
- **Primary Goal**: Acts as the central game catalog and operational gatekeeper for OfficeWallahGames. It feeds the frontend with all game metadata, asset links, display orders, game modes (`SINGLE_PLAYER` vs `MULTIPLAYER`), and runtime feature toggles (`enabled`/`maintenance`).

---

## 2. Core Functional Requirements & Gatekeeping Rules
1. **Dynamic Catalog API**:
   - Returns a single unified response containing games categorized with `gameMode: "SINGLE_PLAYER"` or `gameMode: "MULTIPLAYER"`.
   - Supplies title, description, category, thumbnail URL, logo URL, min/max players, and frontend launch route.
2. **Feature Gate / Kill-Switch**:
   - Games can be toggled `isActive: true/false` or `isMaintenance: true/false`.
   - The UI automatically reflects disabled states or hides them in real-time.
3. **Display Sorting & Modes**:
   - Priority weight index to rearrange display ordering on the homepage without frontend code changes.

---

## 3. UI Presentation: Dual Mode Selection Cards
On the frontend, the catalog response powers two primary mode selector cards:
- **Card 1: 🕹️ Single Player Games** (e.g., Snake Arcade, 2048, Minesweeper, Solitaire)
- **Card 2: ⚔️ Multiplayer / 2-Player Games** (e.g., Tic-Tac-Toe Arena, Speed Chess, Connect Four)

### Interactive UI Behavior:
1. The user lands on the Home/Games page and sees the two prominent cards with game counters (e.g., `Multiplayer (1 Live, 2 Soon)` and `Single Player (3 Soon)`).
2. Clicking a card instantly filters and lists the games belonging to that selected mode in the smooth scrollable strip below.
3. A "View All" pill allows viewing the full linear list without mode filtering.

---

## 4. Data Model (GameMetadata)

| Field | Type | Description |
|---|---|---|
| `gameId` | `String` (PK) | Unique key (e.g., `tictactoe`, `snake`, `chess`) |
| `name` | `String` | Display title (e.g., `Tic-Tac-Toe Arena`) |
| `tagline` | `String` | Short subtitle |
| `gameMode` | `String` | `SINGLE_PLAYER` or `MULTIPLAYER` |
| `category` | `String` | `PVP_CASUAL`, `ARCADE`, `STRATEGY`, `PUZZLE` |
| `thumbnailUrl` | `String` | Image/Icon URL |
| `route` | `String` | Frontend destination path (e.g., `/games/tictactoe`) |
| `minPlayers` | `int` | e.g. `1` or `2` |
| `maxPlayers` | `int` | e.g. `1` or `2` |
| `isActive` | `boolean` | Master visibility flag |
| `isMaintenance`| `boolean` | Maintenance mode flag |
| `displayOrder` | `int` | Order weight in the linear scroll strip |

---

## 5. API Contracts

- **`GET /api/v1/games/catalog`**
  - **Description**: Returns all public games available for the homepage dual-mode cards and scroll list.
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "modes": [
          {
            "id": "MULTIPLAYER",
            "title": "Multiplayer Arena",
            "tagline": "Real-time 1v1 PvP & dual player matches",
            "icon": "Users",
            "count": 1
          },
          {
            "id": "SINGLE_PLAYER",
            "title": "Single Player Hub",
            "tagline": "Solo high-score challenges & arcade classics",
            "icon": "User",
            "count": 3
          }
        ],
        "games": [
          {
            "gameId": "tictactoe",
            "name": "Tic-Tac-Toe Arena",
            "tagline": "Real-time 1v1 PvP quick rounds",
            "gameMode": "MULTIPLAYER",
            "category": "PVP_CASUAL",
            "thumbnailUrl": "/assets/games/tictactoe-thumb.png",
            "route": "/games/tictactoe",
            "minPlayers": 2,
            "maxPlayers": 2,
            "isActive": true,
            "isMaintenance": false,
            "displayOrder": 1
          },
          {
            "gameId": "snake",
            "name": "Snake Rush",
            "tagline": "Classic retro snake with modern neon visuals",
            "gameMode": "SINGLE_PLAYER",
            "category": "ARCADE",
            "thumbnailUrl": "/assets/games/snake-thumb.png",
            "route": "/games/snake",
            "minPlayers": 1,
            "maxPlayers": 1,
            "isActive": false,
            "isMaintenance": false,
            "displayOrder": 2
          }
        ]
      },
      "message": "Catalog retrieved successfully"
    }
    ```

- **`POST /api/v1/games/{gameId}/toggle`** (Admin/Internal Gate Control)
  - **Description**: Enables/disables a game dynamically.
  - **Body**: `{ "isActive": false, "reason": "Server update" }`

---

## 6. Architecture & Storage
- **Module Path**: `backend/games/master-service/`
- **Database**: PostgreSQL (with in-memory fallback seed data for zero-config local start).
- **Cache**: Local Caffeine or Redis cache for sub-millisecond response time to frontend.

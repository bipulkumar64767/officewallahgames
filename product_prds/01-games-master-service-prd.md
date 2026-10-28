# 📋 PRD 01: Games Master Service

---

## 1. Overview & Objective
- **Service Name**: `games-master-service`
- **Default Port**: `8081`
- **Primary Goal**: Acts as the central game catalog and operational gatekeeper for OfficeWallahGames. It feeds the frontend with all game metadata, asset links, display orders, and runtime feature toggles (`enabled`/`maintenance`).

---

## 2. Core Functional Requirements & Gatekeeping Rules
1. **Dynamic Catalog API**:
   - Provide active game lists with title, description, category, thumbnail URL, logo URL, min/max players, and frontend launch route.
2. **Feature Gate / Kill-Switch**:
   - Games can be toggled `active: true/false` or `maintenance: true/false`.
   - The UI automatically reflects disabled states or hides them in real-time.
3. **Display Sorting**:
   - Priority weight index to rearrange linear scroll ordering on the homepage without frontend code changes.

---

## 3. Data Model (GameMetadata)

| Field | Type | Description |
|---|---|---|
| `gameId` | `String` (PK) | Unique key (e.g., `tictactoe`, `snake`, `chess`) |
| `name` | `String` | Display title (e.g., `Tic-Tac-Toe Arena`) |
| `tagline` | `String` | Short subtitle |
| `category` | `String` | `PVP_CASUAL`, `ARCADE`, `STRATEGY` |
| `thumbnailUrl` | `String` | Image/Icon URL |
| `route` | `String` | Frontend destination path (e.g., `/games/tictactoe`) |
| `minPlayers` | `int` | e.g. `2` |
| `maxPlayers` | `int` | e.g. `2` |
| `isActive` | `boolean` | Master visibility flag |
| `isMaintenance`| `boolean` | Maintenance mode flag |
| `displayOrder` | `int` | Order weight in the linear scroll strip |

---

## 4. API Contracts

- **`GET /api/v1/games/catalog`**
  - **Description**: Returns all public games available for the homepage scroll list.
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": [
        {
          "gameId": "tictactoe",
          "name": "Tic-Tac-Toe Arena",
          "tagline": "Real-time 1v1 PvP quick rounds",
          "category": "PVP_CASUAL",
          "thumbnailUrl": "/assets/games/tictactoe-thumb.png",
          "route": "/games/tictactoe",
          "minPlayers": 2,
          "maxPlayers": 2,
          "isActive": true,
          "isMaintenance": false,
          "displayOrder": 1
        }
      ],
      "message": "Catalog retrieved successfully"
    }
    ```

- **`POST /api/v1/games/{gameId}/toggle`** (Admin/Internal Gate Control)
  - **Description**: Enables/disables a game dynamically.
  - **Body**: `{ "isActive": false, "reason": "Server update" }`

---

## 5. Architecture & Storage
- **Module Path**: `backend/games/master-service/`
- **Database**: PostgreSQL (with in-memory fallback seed data for zero-config local start).
- **Cache**: Local Caffeine or Redis cache for sub-millisecond response time to frontend.

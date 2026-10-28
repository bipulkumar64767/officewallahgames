# 📋 PRD 04: Ludo Royale (Real-Time 2/3/4 Player PvP Microservice)

---

## 1. Overview & Objective
- **Service Name**: `ludo-service`
- **Default Port**: `8084`
- **Primary Goal**: A real-time, turn-based multiplayer Ludo game supporting **2, 3, or 4 players** per session. Built as an independent Spring Boot microservice with STOMP WebSocket state sync and Redis-backed session management. Supports **Private Room + Shareable Link** creation and **Random Matchmaking**. When fewer than 4 players are in a session, inactive color slots display an **"X" overlay icon** communicating that the slot is not applicable, offline, or unavailable — keeping the board layout consistent across all player counts.

---

## 2. Gameplay Mechanics & Rules

- **Players**: 2, 3, or 4 players per match.
- **Board**: Standard 15×15 Ludo board. Four color quadrants: 🔴 Red (bottom-left), 🟢 Green (top-right), 🟡 Yellow (bottom-right), 🔵 Blue (top-left).
- **Tokens per Player**: 4 tokens each. Each player has a Home Yard (starting zone) and a Home Column (final safe stretch).
- **Dice**: Single standard 6-sided die rolled per turn.
- **Turn Timer**: 30 seconds per turn. If a player fails to roll or move within 30s, their turn is auto-skipped and the next active player's turn begins.

### 2.1 Win / Lose Conditions
- **Win**: First player to move all 4 tokens into their Home (center triangle) wins.
- **Rank**: Remaining players continue until all 4 tokens reach home, settling rank positions 2nd, 3rd, 4th.
- **Game Over**: All active players have ranked out or only 1 active player remains.

### 2.2 Core Movement Rules
- A token leaves the Home Yard **only on a dice roll of 6**.
- Rolling a 6 grants a **bonus roll** (max 3 consecutive 6s; on the 3rd consecutive 6 the turn is lost and passed).
- A token landing on an opponent's token sends the opponent's token back to their Home Yard (except on Safe Cells marked with ⭐).
- **Safe Cells**: Colored start squares and designated star squares — tokens on safe cells cannot be captured.
- A token in the **Home Column** cannot be captured.

### 2.3 Player Slot States
Each of the 4 color slots must always be in one of these defined states:

| State | When | Visual |
|---|---|---|
| `ACTIVE` | Player is present and playing | Normal colored yard, tokens animate |
| `WAITING` | Room created, awaiting player to join | Pulsing border + "Waiting..." label (no X) |
| `INACTIVE_SETUP` | Slot unused due to 2P or 3P mode | Full X overlay + "No Player" label |
| `OFFLINE` | Active player disconnected mid-game | Dimmed overlay + X icon + "Offline" label |
| `NOT_AVAILABLE` | Invited player never joined before match started | Dimmed overlay + X icon + "Unavailable" label |

### 2.4 Player Count → Active Slot Assignment

| Mode | Active Color Slots | Inactive Slot(s) |
|------|-------------------|-----------------|
| **2P** | 🔴 Red + 🟡 Yellow | 🟢 Green (top-right) + 🔵 Blue (top-left) |
| **3P** | 🔴 Red + 🟢 Green + 🟡 Yellow | 🔵 Blue (top-left) |
| **4P** | All 4 slots | None |

> The host selects the player count during room creation. Assignment is locked at game start and cannot be changed mid-session.

### 2.5 Turn-Skip Logic for Inactive / Offline Slots
- When a slot is `INACTIVE_SETUP`, `OFFLINE`, or `NOT_AVAILABLE`, the turn engine **auto-skips** that color instantly (< 200ms).
- A brief toast notification: **"[Color] skipped"** appears for 1.5 seconds on all clients.
- No dice animation plays for a skipped turn.
- Inactive tokens remain frozen in the yard at `opacity: 0.25`.

### 2.6 Game States
`LOBBY` → `WAITING_FOR_PLAYERS` → `ACTIVE` → `GAME_OVER` → `COMPLETED`

---

## 3. Room Creation & Shareable Link Architecture

Players can join in two modes:

1. **Quick Match (Random Matchmaking Queue)**: Enqueues player in Redis and matches them with available opponents for the selected player count (2P, 3P, or 4P).
2. **Private Room (Invite Friends via Shareable Link)**:
   - Host clicks **"Create Private Room"** and selects player count (2P / 3P / 4P).
   - System generates a unique 6-character alphanumeric room code (e.g. `LDO-4K9Z`).
   - Generates a shareable URL: `https://officewallahgames.com/games/ludo?room=LDO-4K9Z`.
   - Host is registered as 🔴 Red and assigned `WAITING_FOR_PLAYERS` state.
   - Host can click **"Copy Link"** or **"Copy Code"** to invite friends.
   - Each friend who joins via link or code gets the next available color slot.
   - Once the required number of players have joined (matching player count), the server broadcasts `ROOM_READY` and the match starts.

### Room State Transition in Redis (`room:{roomCode}`):
```
[HOST CREATES]  ──►  WAITING_FOR_PLAYERS (TTL: 10 mins)
                              │
                   [REQUIRED PLAYERS JOIN]
                              │
                              ▼
                           ACTIVE (Turn-based gameplay)
                              │
                         [ALL RANKED OUT]
                              │
                              ▼
                  COMPLETED (TTL: 15 mins for rematch window)
```

---

## 4. High-Concurrency Architecture

1. **Stateless Service Instances**:
   - Zero game session state stored in Java heap.
   - Any pod handles WebSocket frames for any game session via Redis Pub/Sub.
2. **Distributed Redis State (`game:{sessionId}`)** — stored as Redis Hash/JSON:
   - `players`: `{ "RED": "GUEST_482910482", "GREEN": "GUEST_991820121", "YELLOW": "GUEST_111111", "BLUE": null }`
   - `slotStates`: `{ "RED": "ACTIVE", "GREEN": "ACTIVE", "YELLOW": "ACTIVE", "BLUE": "INACTIVE_SETUP" }`
   - `tokens`: 4 tokens per color, each with `{ "tokenId": "R1", "color": "RED", "position": -1, "state": "HOME" }`
   - `currentTurn`: `"RED"` | `"GREEN"` | `"YELLOW"` | `"BLUE"`
   - `diceValue`: `int` (1–6)
   - `consecutiveSixes`: `int` (0–3)
   - `status`: `WAITING_FOR_PLAYERS` | `ACTIVE` | `GAME_OVER` | `COMPLETED` | `ABANDONED`
   - `rankings`: ordered list of colors as they finish
   - `playerCount`: `2` | `3` | `4`
   - TTL: Auto-expires 20 minutes after completion or abandonment.
3. **Atomic Turn & Move Concurrency**:
   - Redis Lua script ensures dice roll, token move, and turn-flip are executed atomically to prevent race conditions.
4. **WebSocket Sync via Redis Pub/Sub**:
   - STOMP messages dispatched to `/topic/ludo/{sessionId}` across all pods.

---

## 5. API & WebSocket Specifications

### 5.1 REST Room Management & Matchmaking

- **`POST /api/v1/ludo/rooms/create`**
  - **Body**:
    ```json
    {
      "playerId": "GUEST_482910482",
      "playerName": "Guest 482910482",
      "playerCount": 3
    }
    ```
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "sessionId": "OWG_LDO_77341",
        "roomCode": "LDO-4K9Z",
        "shareableUrl": "/games/ludo?room=LDO-4K9Z",
        "assignedColor": "RED",
        "playerCount": 3,
        "slotStates": {
          "RED": "ACTIVE",
          "GREEN": "WAITING",
          "YELLOW": "WAITING",
          "BLUE": "INACTIVE_SETUP"
        },
        "status": "WAITING_FOR_PLAYERS"
      },
      "message": "Private room created successfully"
    }
    ```

- **`POST /api/v1/ludo/rooms/join`**
  - **Body**:
    ```json
    {
      "roomCode": "LDO-4K9Z",
      "playerId": "GUEST_991820121",
      "playerName": "Alex"
    }
    ```
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "sessionId": "OWG_LDO_77341",
        "roomCode": "LDO-4K9Z",
        "assignedColor": "GREEN",
        "playerCount": 3,
        "slotStates": {
          "RED": "ACTIVE",
          "GREEN": "ACTIVE",
          "YELLOW": "WAITING",
          "BLUE": "INACTIVE_SETUP"
        },
        "status": "WAITING_FOR_PLAYERS"
      },
      "message": "Joined room successfully"
    }
    ```

- **`GET /api/v1/ludo/rooms/{roomCode}/status`**
  - **Description**: Lightweight verification check when a user visits `?room=CODE` before opening WebSocket.

- **`POST /api/v1/ludo/queue/quick-match`**
  - **Body**: `{ "playerId": "GUEST_482910482", "playerCount": 4 }`
  - **Behavior**: Enqueues player in Redis ZSET for matching; grouped by `playerCount`.

---

### 5.2 STOMP WebSocket Messaging (`/ws/ludo`)

- **Connection**: `new SockJS('/ws/ludo')` + `Stomp.over(...)`
- **Subscribe Topic**: `/topic/ludo/{sessionId}`
- **Destinations**:
  - Roll Dice: `/app/ludo/{sessionId}/roll`
    - **Payload**: `{ "playerId": "GUEST_482910482", "color": "RED" }`
  - Move Token: `/app/ludo/{sessionId}/move`
    - **Payload**: `{ "playerId": "GUEST_482910482", "color": "RED", "tokenId": "R2" }`

- **Broadcast Events**:
  - `PLAYER_JOINED`: `{ "color": "GREEN", "playerName": "Alex", "slotStates": { ... } }`
  - `ROOM_READY`: `{ "status": "ACTIVE", "firstTurn": "RED", "slotStates": { ... } }`
  - `DICE_ROLLED`: `{ "color": "RED", "diceValue": 6, "consecutiveSixes": 1, "movableTokens": ["R1","R3"] }`
  - `TOKEN_MOVED`: `{ "color": "RED", "tokenId": "R1", "from": -1, "to": 1, "capturedToken": null, "nextTurn": "GREEN" }`
  - `TOKEN_CAPTURED`: `{ "capturedColor": "GREEN", "capturedTokenId": "G2", "sentBackTo": "HOME", "capturedBy": "RED" }`
  - `TURN_SKIPPED`: `{ "skippedColor": "BLUE", "reason": "INACTIVE_SETUP", "nextTurn": "RED" }`
  - `PLAYER_DISCONNECTED`: `{ "color": "GREEN", "newSlotState": "OFFLINE", "reconnectGracePeriodSeconds": 60 }`
  - `PLAYER_RECONNECTED`: `{ "color": "GREEN", "newSlotState": "ACTIVE" }`
  - `TURN_TIMEOUT`: `{ "color": "RED", "reason": "TIMER_EXPIRED", "nextTurn": "GREEN" }`
  - `PLAYER_RANKED`: `{ "color": "RED", "rank": 1, "message": "Red wins! 🎉" }`
  - `GAME_OVER`: `{ "rankings": ["RED","YELLOW","GREEN"], "status": "COMPLETED" }`

---

## 6. UI/UX Specifications
- **Theme & Aesthetic**: Dark theme consistent with OfficeWallahGames — background `#1a1a2e`, accent `#e94560`, neon highlights.

### 6.1 Lobby Screen
- Player count selector: segmented control — `2 Players | 3 Players | 4 Players`.
- Two action buttons: **"⚡ Quick Match"** and **"🔗 Play with Friends"**.
- If "Play with Friends" → modal shows room code (e.g. `LDO-4K9Z`), **"📋 Copy Link"** button, and a pulsing status: *"Waiting for players to join... (1/3)"*.
- Live slot previews in the modal: 4 mini yard cards showing player color + name or "Waiting…" or "No Player" + X icon (for `INACTIVE_SETUP`).

### 6.2 Game Board Screen
- **Board**: Classic 15×15 Ludo grid with neon-accented safe cells (⭐ glow effect).
- **Inactive Yard — X Overlay Specification**:
  - Semi-transparent black overlay: `rgba(0,0,0,0.45)` covering the full token yard.
  - Circular "✕" badge centered in the yard: 48×48dp, white `#FFFFFF` glyph on `#CC3333` background.
  - Label below icon: 10sp, Medium weight, `#FFFFFF`, centered — text varies by state:
    - `INACTIVE_SETUP` → **"No Player"**
    - `OFFLINE` → **"Offline"**
    - `NOT_AVAILABLE` → **"Unavailable"**
  - Tokens inside the inactive yard: rendered at `opacity: 0.25`, frozen/non-interactive.
  - Overlay fade-in on state change: 150ms ease transition.
- **Turn Indicator Strip**: Displays active players' color avatars in turn order. Inactive slots are greyed out and skipped visually.
- **HUD / Score Panel**: Shows each player's token progress (tokens home count: `x/4`). Inactive slot entries are shown dimmed.
- **Dice Area**: Located centrally or per-player side. Dice is hidden/greyed for inactive slots.
- **Turn Timer**: 30-second countdown ring per active player's turn. Auto-skips on expiry.
- **Toast Notifications**: Bottom-center toast for: turn skips, captures, disconnection events, ranking announcements (1.5s auto-dismiss).
- **Game Over Modal**: Ranked podium (🥇🥈🥉), animated confetti for 1st place, **"Play Again"** and **"Copy Room Link"** buttons.

### 6.3 Reconnection Flow
- Disconnected player slot immediately shows **"Offline" X overlay** to all clients.
- A 60-second reconnect grace timer runs server-side.
- On reconnection within grace window → overlay dismissed, slot returns to `ACTIVE`.
- After grace window → host is prompted: *"[Name] hasn't reconnected. Continue skipping their turns?"* (Yes / End Game).

---

## 7. Backend Architecture & Microservice Design

- **Microservice Module**: `backend/games/ludo-service/`
- **Port**: `8084`
- **State Management**: Redis (primary session state + Pub/Sub), no in-JVM game state.
- **Error Handling**: Throw `GameException` for domain errors (invalid move, wrong turn, room full); caught by `GlobalExceptionHandler` returning standardized `ApiResponse<T>`.
- **Core Packages**:
  - `controller/` → REST + WebSocket controllers
  - `service/` → `LudoGameService`, `LudoRoomService`, `LudoMatchmakingService`
  - `engine/` → `LudoEngine` (movement rules, capture logic, win detection, turn rotation)
  - `model/` → `LudoSession`, `LudoToken`, `SlotState`, `PlayerColor` (enum)
  - `redis/` → `LudoRedisRepository`, Lua atomic scripts
  - `websocket/` → STOMP config, message handlers, event publishers

---

## 8. Data Models

### LudoSession (Redis Hash)
| Field | Type | Description |
|---|---|---|
| `sessionId` | `String` | e.g. `OWG_LDO_77341` |
| `roomCode` | `String` | e.g. `LDO-4K9Z` |
| `playerCount` | `int` | `2`, `3`, or `4` |
| `players` | `Map<Color, String>` | Color → playerId |
| `slotStates` | `Map<Color, SlotState>` | Color → current slot state |
| `tokens` | `List<LudoToken>` | All 16 token positions |
| `currentTurn` | `PlayerColor` | Whose turn it is |
| `turnOrder` | `List<PlayerColor>` | Ordered list of active colors |
| `diceValue` | `int` | Last rolled value |
| `consecutiveSixes` | `int` | Count of back-to-back 6s (0–3) |
| `rankings` | `List<PlayerColor>` | Colors in finish order |
| `status` | `GameStatus` | Current game state |
| `turnStartedAt` | `long` | Epoch ms, for 30s timer enforcement |

### LudoToken
| Field | Type | Description |
|---|---|---|
| `tokenId` | `String` | e.g. `R1`, `G3`, `Y2`, `B4` |
| `color` | `PlayerColor` | `RED`, `GREEN`, `YELLOW`, `BLUE` |
| `position` | `int` | `-1` = HOME YARD; `1–56` = main track; `57–62` = home column; `63` = HOME (finished) |
| `state` | `TokenState` | `HOME_YARD`, `ON_BOARD`, `HOME_COLUMN`, `FINISHED` |

---

## 9. Edge Cases & Error Handling

| Edge Case | Behavior |
|---|---|
| Player rolls 3 consecutive 6s | Turn lost and passed to next player; toast: *"[Color] rolled three 6s — turn forfeited!"* |
| Player tries to move token not eligible for dice value | `400 BAD_REQUEST` via `GameException("INVALID_MOVE")` |
| Player acts out of turn | `403 FORBIDDEN` via `GameException("NOT_YOUR_TURN")` |
| A 4th player tries to join a full 3P room | `409 CONFLICT` — *"Room is full"* |
| Room code is expired or not found | `404 NOT_FOUND` — *"Room not found or expired"* |
| All non-host players leave | Game paused; host sees modal — *"Waiting for players. End game?"* |
| Host disconnects | Host role transferred to next active player |
| Network blip < 3s | Suppressed; no state change broadcasted to other clients |
| Two tokens of same color land on same cell | Stacked; opponent capture sends both tokens back |
| Only 1 active player left after all others finish | Game auto-resolves; remaining player awarded last rank |

---

## 10. Implementation Checklist

- [ ] Backend microservice created under `backend/games/ludo-service/`
- [ ] `LudoEngine` movement, capture, and win logic implemented and unit tested
- [ ] Redis session model and Lua atomic scripts for dice + move implemented
- [ ] STOMP WebSocket handlers implemented and integration tested
- [ ] REST room management endpoints (`create`, `join`, `status`, `quick-match`) implemented
- [ ] Slot state machine (`ACTIVE`, `WAITING`, `INACTIVE_SETUP`, `OFFLINE`, `NOT_AVAILABLE`) implemented
- [ ] Turn-skip logic for inactive slots working (< 200ms)
- [ ] Reconnect grace period (60s) implemented
- [ ] Frontend UI created under `frontend/src/games/ludo/`
- [ ] X overlay component built with correct state-based labels and styling
- [ ] Game board, token animations, dice roll, and turn indicator built
- [ ] Navigation and route `/games/ludo` registered in `frontend/src/App.jsx`
- [ ] `GameMetadata` entry for Ludo added to `games-master-service` catalog seed data
- [ ] Integrated end-to-end and verified (2P, 3P, 4P sessions all tested)

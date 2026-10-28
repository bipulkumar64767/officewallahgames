# 📋 PRD 06: Connect Drop (Real-Time 2-Player PvP Connect Four Variant)

---

## 1. Overview & Objective
- **Service Name**: `connect-drop-service`
- **Default Port**: `8086`
- **Primary Goal**: A low-latency, real-time 2-player multiplayer Connect Four variant built as an independent Spring Boot microservice. Players alternate dropping coloured discs into a 7-column × 6-row grid; the first to connect 4 discs in a row (horizontally, vertically, or diagonally) wins. Supports up to **50,000 concurrent active players** via stateless Spring Boot nodes, Redis-backed session management, and STOMP WebSockets. Features both **Quick Match (Random Matchmaking)** and **Private Room with Shareable Link** (room code pattern: `CND-XXXX`).

---

## 2. Gameplay Mechanics & Rules

- **Players**: Exactly 2 players per match — **Player 🔴 Red** vs **Player 🟡 Yellow** (classic Connect Four roles).
- **Board**: 7 columns × 6 rows (42 total cells). Columns are indexed `0–6` (left to right); rows are indexed `0–5` (top to bottom, where row `5` is the bottom).
- **Disc Drop Mechanics**: A disc is dropped into a chosen column and falls under gravity to the lowest unfilled row in that column. A column is **full** when all 6 rows are occupied; a full column cannot accept further drops.
- **Turn Timer**: **20 seconds** per turn. If a player does not drop within 20s, the server auto-drops a disc into a randomly selected valid (non-full) column on their behalf, broadcasts a `TURN_TIMEOUT` event, and advances the turn.
- **Turn Order**: Player 🔴 Red always goes first. Turns alternate strictly.

### 2.1 Winning Conditions
A player wins immediately when they form **4 consecutive discs of their colour** in any of the following directions:
- **Horizontal**: 4 discs in the same row across adjacent columns.
- **Vertical**: 4 discs stacked in the same column.
- **Diagonal (↗)**: 4 discs along an ascending diagonal.
- **Diagonal (↘)**: 4 discs along a descending diagonal.

On win detection the server identifies the exact **winning 4 cells** as `[[row,col], [row,col], [row,col], [row,col]]` and includes them in the `GAME_OVER` broadcast for the UI to animate.

### 2.2 Draw Condition
If all 42 cells are filled and no winning sequence exists, the game ends as a **Draw**. A `DRAW` WebSocket event is broadcast to both players.

### 2.3 Scoring / Ranking (for future leaderboard integration)
| Outcome | Points Awarded |
|---------|---------------|
| Win     | +3 points      |
| Draw    | +1 point each  |
| Loss    | 0 points       |

Points are recorded per-session in Redis and flushed to the User Management Service asynchronously post-game.

### 2.4 Rematch
After game-over either player may request a rematch. If both accept within **60 seconds**, a new session is created with the same room code; disc colours are **swapped** (prior Yellow becomes new Red). If either player declines or the 60s window expires, the room is marked `COMPLETED`.

### 2.5 Game States
```
WAITING_FOR_OPPONENT → ACTIVE → GAME_OVER → COMPLETED
```

---

## 3. Room Creation & Shareable Link Architecture

Players can join in two modes:

1. **Quick Match (Random Matchmaking Queue)**: Player is enqueued in a Redis ZSET. The server pairs the first two waiting players, creates a session, and notifies both clients.
2. **Private Room (Invite Friend via Shareable Link)**:
   - Host clicks **"Create Private Room"**.
   - Server generates a unique 6-character alphanumeric room code following the pattern `CND-XXXX` (e.g. `CND-8F3K`).
   - Generates a shareable URL: `https://officewallahgames.com/games/connectdrop?room=CND-8F3K`.
   - Host is registered as **Player 🔴 Red** in `WAITING_FOR_OPPONENT` state.
   - Host can click **"📋 Copy Link"** or **"📋 Copy Code"** to share.
   - Opponent opens the link or manually enters the code → auto-joins as **Player 🟡 Yellow**.
   - As soon as Yellow connects, the server broadcasts `ROOM_READY` and the match begins immediately with Red's first turn.

### Room State Transition in Redis (`room:{roomCode}`):
```
[HOST CREATES]  ──►  WAITING_FOR_OPPONENT (TTL: 10 mins)
                               │
                    [FRIEND JOINS VIA LINK/CODE]
                               │
                               ▼
                            ACTIVE (Disc-drop turns)
                               │
                        [WIN OR DRAW]
                               │
                               ▼
               GAME_OVER (TTL: 60s rematch window)
                               │
               [REMATCH ACCEPTED / DECLINED / TIMEOUT]
                               │
                               ▼
                  COMPLETED (TTL: 15 mins, then auto-expire)
```

---

## 4. High-Concurrency Architecture

1. **Stateless Service Instances**:
   - Zero game session state stored in Java heap.
   - Any pod can handle WebSocket frames for any game session — all state lives in Redis.
   - Horizontally scalable; add pods under a load balancer without session affinity.

2. **Distributed Redis State (`game:{sessionId}`)** — stored as Redis Hash / JSON:
   - `board`: 2D array `int[6][7]` — `0` = empty, `1` = Red, `2` = Yellow.
   - `playerRed`: `userId` (String)
   - `playerYellow`: `userId` (String)
   - `currentTurn`: `"RED"` | `"YELLOW"`
   - `status`: `WAITING_FOR_OPPONENT` | `ACTIVE` | `GAME_OVER` | `COMPLETED` | `ABANDONED`
   - `winner`: `"RED"` | `"YELLOW"` | `"DRAW"` | `null`
   - `winningCells`: `[[r,c],[r,c],[r,c],[r,c]]` | `null`
   - `turnStartedAt`: epoch milliseconds (for 20s timer enforcement)
   - TTL: auto-expires 15 minutes after `COMPLETED` or `ABANDONED`.

3. **Atomic Drop Concurrency (Anti-Race Condition)**:
   - A Redis Lua script validates the column vacancy, writes the disc to the correct row, detects win/draw, and flips `currentTurn` — all atomically — preventing simultaneous click race conditions between two tabs or slow networks.

4. **WebSocket Sync via Redis Pub/Sub**:
   - STOMP messages dispatched to `/topic/connectdrop/{sessionId}` via Redis Pub/Sub so all pods stay in sync for any given session.

5. **Turn Timer Enforcement**:
   - On each successful disc drop, the server writes `turnStartedAt` to Redis.
   - A lightweight scheduled task (1s poll per session or a Redis keyspace-expiry event) checks for elapsed time > 20s.
   - On expiry, the server executes auto-drop (random valid column) atomically via Lua script and broadcasts `TURN_TIMEOUT`.

---

## 5. API & WebSocket Specifications

### 5.1 REST Room Management & Matchmaking

All responses use the standardized `ApiResponse<T>` envelope. Domain errors throw `GameException`, caught by `GlobalExceptionHandler`.

---

**`POST /api/v1/connectdrop/rooms/create`**
- **Body**:
  ```json
  {
    "playerId": "GUEST_482910482",
    "playerName": "Guest 482910482"
  }
  ```
- **Response**:
  ```json
  {
    "status": "SUCCESS",
    "data": {
      "sessionId": "OWG_CND_55291",
      "roomCode": "CND-8F3K",
      "shareableUrl": "/games/connectdrop?room=CND-8F3K",
      "assignedColor": "RED",
      "status": "WAITING_FOR_OPPONENT"
    },
    "message": "Private room created successfully"
  }
  ```

---

**`POST /api/v1/connectdrop/rooms/join`**
- **Body**:
  ```json
  {
    "roomCode": "CND-8F3K",
    "playerId": "GUEST_991820121",
    "playerName": "Alex"
  }
  ```
- **Response**:
  ```json
  {
    "status": "SUCCESS",
    "data": {
      "sessionId": "OWG_CND_55291",
      "roomCode": "CND-8F3K",
      "assignedColor": "YELLOW",
      "status": "ACTIVE",
      "playerRed": "GUEST_482910482",
      "playerYellow": "GUEST_991820121",
      "currentTurn": "RED",
      "board": [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]
    },
    "message": "Joined room successfully"
  }
  ```

---

**`GET /api/v1/connectdrop/rooms/{roomCode}/status`**
- **Description**: Lightweight verification check when a user visits `?room=CND-XXXX` before opening the WebSocket. Returns current session state, assigned colours, and `currentTurn`.
- **Response**:
  ```json
  {
    "status": "SUCCESS",
    "data": {
      "sessionId": "OWG_CND_55291",
      "roomCode": "CND-8F3K",
      "status": "ACTIVE",
      "playerRed": "GUEST_482910482",
      "playerYellow": "GUEST_991820121",
      "currentTurn": "RED",
      "board": [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]
    },
    "message": "Room status retrieved"
  }
  ```

---

**`POST /api/v1/connectdrop/queue/quick-match`**
- **Body**: `{ "playerId": "GUEST_482910482", "playerName": "Guest 482910482" }`
- **Behavior**: Enqueues player in a Redis ZSET (`connectdrop:queue`) scored by enqueue timestamp. If a waiting player already exists, the server immediately pairs them, creates a session, and returns `ACTIVE` state to both.
- **Response (queued)**:
  ```json
  {
    "status": "SUCCESS",
    "data": { "queueStatus": "QUEUED", "estimatedWaitSeconds": 10 },
    "message": "Added to matchmaking queue"
  }
  ```
- **Response (matched immediately)**:
  ```json
  {
    "status": "SUCCESS",
    "data": {
      "sessionId": "OWG_CND_55292",
      "assignedColor": "YELLOW",
      "status": "ACTIVE",
      "currentTurn": "RED"
    },
    "message": "Match found! Game starting."
  }
  ```

---

**`DELETE /api/v1/connectdrop/queue/leave`**
- **Body**: `{ "playerId": "GUEST_482910482" }`
- **Behavior**: Removes the player from the matchmaking queue if still waiting. No-op if not queued.

---

### 5.2 STOMP WebSocket Messaging (`/ws/connectdrop`)

- **Connection**: `new SockJS('/ws/connectdrop')` + `Stomp.over(...)`
- **Subscribe Topic**: `/topic/connectdrop/{sessionId}`
- **Client Send Destinations**:

  | Action | Destination | Payload |
  |--------|-------------|---------|
  | Drop disc | `/app/connectdrop/{sessionId}/drop` | `{ "playerId": "GUEST_482910482", "column": 3 }` |
  | Request rematch | `/app/connectdrop/{sessionId}/rematch-request` | `{ "playerId": "GUEST_482910482" }` |
  | Accept rematch | `/app/connectdrop/{sessionId}/rematch-accept` | `{ "playerId": "GUEST_991820121" }` |
  | Decline rematch | `/app/connectdrop/{sessionId}/rematch-decline` | `{ "playerId": "GUEST_991820121" }` |

- **Broadcast Events** (all published to `/topic/connectdrop/{sessionId}`):

  | Event Type | Payload |
  |------------|---------|
  | `ROOM_READY` | `{ "status": "ACTIVE", "playerRed": "GUEST_482910482", "playerYellow": "GUEST_991820121", "currentTurn": "RED" }` |
  | `DISC_DROPPED` | `{ "playerId": "GUEST_482910482", "color": "RED", "column": 3, "row": 5, "nextTurn": "YELLOW", "board": [[...]] }` |
  | `TURN_TIMEOUT` | `{ "timedOutColor": "RED", "autoDropColumn": 5, "autoDropRow": 4, "nextTurn": "YELLOW", "board": [[...]] }` |
  | `GAME_OVER` | `{ "winner": "RED", "winningCells": [[5,3],[5,4],[5,5],[5,6]], "board": [[...]] }` |
  | `DRAW` | `{ "status": "DRAW", "board": [[...]] }` |
  | `REMATCH_REQUESTED` | `{ "requestedBy": "RED", "expiresInSeconds": 60 }` |
  | `REMATCH_ACCEPTED` | `{ "newSessionId": "OWG_CND_55293", "playerRed": "GUEST_991820121", "playerYellow": "GUEST_482910482", "currentTurn": "RED" }` |
  | `REMATCH_DECLINED` | `{ "declinedBy": "YELLOW" }` |
  | `PLAYER_DISCONNECTED` | `{ "color": "RED", "reconnectGracePeriodSeconds": 30 }` |
  | `PLAYER_RECONNECTED` | `{ "color": "RED" }` |

---

## 6. UI/UX Specifications

- **Theme & Aesthetic**: Dark background `#1a1a2e`, accent `#e94560`, neon highlights — consistent with OfficeWallahGames.
- **Disc Colours**:
  - Player 🔴 Red (Player 1): **Neon Cyan `#00d4ff`**
  - Player 🟡 Yellow (Player 2): **Neon Magenta `#ff006e`**

### 6.1 Lobby Screen
- Two action buttons: **"⚡ Quick Match"** and **"🔗 Play with Friend"**.
- If "Quick Match" → show a pulsing *"Finding opponent…"* indicator with cancel button.
- If "Play with Friend" → modal displaying:
  - Room code in large monospace font (e.g. `CND-8F3K`) with a glowing border.
  - **"📋 Copy Link"** and **"📋 Copy Code"** buttons.
  - Real-time pulsing status: *"Waiting for opponent to join…"* with a spinning indicator.
  - Live preview: two player slot cards — host slot filled; opponent slot shows *"Waiting…"* with a subtle pulse border.

### 6.2 Game Board Screen

#### Board Layout
- 7-column × 6-row grid rendered as a CSS grid or SVG/Canvas panel.
- Each cell is a circle slot; empty cells show a dark inset `#0d0d1a`.
- Dropped discs rendered as filled circles in player colour with a soft radial glow.
- Board frame styled in `#e94560` (accent) with a subtle `box-shadow` neon outline.

#### Disc Drop Animation
- On `DISC_DROPPED`, the disc **falls from the top** of the column using a CSS keyframe (`translateY` + `ease-in`) and settles at the correct row with a subtle **bounce** (spring easing).
- Duration: ~400ms total (300ms fall + 100ms settle bounce).
- Column hover: A **ghost disc** (semi-transparent, player's colour) appears at the top of the hovered column, previewing the drop position. Hidden when it is not the player's turn.

#### Turn Indicator
- Positioned at the top-center of the board screen.
- Shows **both player avatars** side by side with names; the active player's avatar is **highlighted** with a glowing ring in their disc colour.
- A **circular countdown ring** (SVG stroke-dashoffset animation) counts down 20s around the active player's avatar. Ring colour transitions: `#00d4ff` → `#ffaa00` (at 10s) → `#ff4444` (at 5s).
- Inactive player's avatar is dimmed at `opacity: 0.4`.

#### Winning Animation
- On `GAME_OVER`, the 4 winning cells pulse with a **bright glowing animation** — repeated radial-gradient flash (`box-shadow` + `filter: brightness`) at 0.5s interval for 3 cycles, then hold steady glow.
- Winning disc colour brightens to 150% and scale-pulses (1.0 → 1.15 → 1.0) in sync.
- Non-winning discs dim to `opacity: 0.35`.

#### Game Over Modal
- Overlaid centred modal on a `rgba(0,0,0,0.75)` backdrop.
- **Winner**: Shows *"🎉 [PlayerName] Wins!"* in large bold text, coloured in the winner's disc colour, with a **confetti burst** animation (CSS or canvas-based particles).
- **Draw**: Shows *"🤝 It's a Draw!"* in `#e94560` accent colour.
- Buttons:
  - **"🔄 Request Rematch"** — initiates rematch flow; after request, button changes to *"Waiting for opponent…"* with a 60s countdown.
  - **"🏠 Back to Lobby"** — returns to main lobby.
- If opponent requests rematch: shows **"[Opponent] wants a rematch!"** banner with **"Accept"** / **"Decline"** buttons.

### 6.3 Responsive Design
- Minimum board cell size: 52×52px on mobile; 64×64px on desktop.
- Column tap/click hitbox spans the full column height for easy mobile drop.
- Board horizontally scrollable on very small screens (< 380px width) with snap-scroll.

---

## 7. Backend Architecture & Microservice Design

- **Microservice Module**: `backend/games/connect-drop-service/`
- **Port**: `8086`
- **State Management**: Redis (primary session state + Pub/Sub). Zero in-JVM game state.
- **Error Handling**: Throw `GameException` for all domain errors (invalid column, wrong turn, column full, room full, etc.); caught by `GlobalExceptionHandler` returning standardized `ApiResponse<T>`.

### Core Packages

```
connect-drop-service/
├── controller/
│   ├── ConnectDropRoomController.java       # REST: create, join, status, quick-match
│   └── ConnectDropWebSocketController.java  # STOMP: /app/connectdrop/{sessionId}/**
├── service/
│   ├── ConnectDropGameService.java          # Orchestrates drop, timeout, win/draw detection
│   ├── ConnectDropRoomService.java          # Room lifecycle: create, join, expire
│   └── ConnectDropMatchmakingService.java   # Redis ZSET queue pairing logic
├── engine/
│   └── ConnectDropEngine.java              # Pure logic: gravity resolution, win detection (4-in-a-row check), draw check
├── model/
│   ├── ConnectDropSession.java             # Redis-mapped session POJO
│   ├── BoardCell.java                      # Enum: EMPTY, RED, YELLOW
│   └── GameStatus.java                     # Enum: WAITING_FOR_OPPONENT, ACTIVE, GAME_OVER, COMPLETED, ABANDONED
├── redis/
│   ├── ConnectDropRedisRepository.java     # Redis read/write helpers
│   └── ConnectDropLuaScripts.java          # Atomic Lua: drop + win-check + turn-flip
├── websocket/
│   ├── ConnectDropWebSocketConfig.java     # STOMP + SockJS endpoint config (/ws/connectdrop)
│   └── ConnectDropEventPublisher.java      # Redis Pub/Sub → STOMP broadcast
└── scheduler/
    └── TurnTimeoutScheduler.java           # 1s-interval task; enforces 20s turn timer
```

### ConnectDropEngine — Win Detection Algorithm
```
For each possible starting cell (r, c):
  Check RIGHT:     (r, c), (r, c+1), (r, c+2), (r, c+3)
  Check DOWN:      (r, c), (r+1, c), (r+2, c), (r+3, c)
  Check DIAG ↘:   (r, c), (r+1, c+1), (r+2, c+2), (r+3, c+3)
  Check DIAG ↗:   (r, c), (r-1, c+1), (r-2, c+2), (r-3, c+3)
  If all 4 share the same non-EMPTY value → winner found; return winning cells.
Optimisation: only re-check sequences that include the last-dropped cell (r, c).
```

### Lua Atomic Drop Script (pseudo-code)
```lua
-- Args: sessionId, column (0-6), playerId, discValue (1 or 2), currentTurn
local board = redis.call('JSON.GET', sessionKey, '$.board')
-- Find lowest empty row in column
-- Validate: column not full, correct turn, game ACTIVE
-- Write disc to board[row][column]
-- Flip currentTurn
-- Update turnStartedAt
-- Return: { row, board, turnFlipped }
```

---

## 8. Data Models

### ConnectDropSession (Redis Hash / JSON)
| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `String` | e.g. `OWG_CND_55291` |
| `roomCode` | `String` | e.g. `CND-8F3K` |
| `playerRed` | `String` | userId of the Red player |
| `playerYellow` | `String` | userId of the Yellow player |
| `board` | `int[6][7]` | `0` = empty, `1` = Red, `2` = Yellow |
| `currentTurn` | `String` | `"RED"` or `"YELLOW"` |
| `status` | `GameStatus` | `WAITING_FOR_OPPONENT` \| `ACTIVE` \| `GAME_OVER` \| `COMPLETED` \| `ABANDONED` |
| `winner` | `String` | `"RED"` \| `"YELLOW"` \| `"DRAW"` \| `null` |
| `winningCells` | `int[4][2]` | Coordinates of the 4 winning discs; `null` if no winner |
| `turnStartedAt` | `long` | Epoch ms when current turn began (for 20s timer) |
| `rematchRequestedBy` | `String` | `"RED"` \| `"YELLOW"` \| `null` |
| `rematchExpiresAt` | `long` | Epoch ms when rematch window closes |
| `createdAt` | `long` | Epoch ms of session creation |

### BoardCell (Enum)
| Value | Meaning |
|-------|---------|
| `EMPTY` (0) | Cell is unoccupied |
| `RED` (1) | Occupied by Player Red's disc |
| `YELLOW` (2) | Occupied by Player Yellow's disc |

---

## 9. Edge Cases & Error Handling

| Edge Case | Behavior |
|-----------|----------|
| Player tries to drop in a **full column** | `400 BAD_REQUEST` via `GameException("COLUMN_FULL", "Column is already full")` |
| Player drops when it is **not their turn** | `403 FORBIDDEN` via `GameException("NOT_YOUR_TURN", "It is not your turn")` |
| Player drops when game is **not ACTIVE** | `409 CONFLICT` via `GameException("GAME_NOT_ACTIVE", "No active game in progress")` |
| **Invalid column index** (< 0 or > 6) | `400 BAD_REQUEST` via `GameException("INVALID_COLUMN", "Column must be between 0 and 6")` |
| **Room code not found** or expired | `404 NOT_FOUND` via `GameException("ROOM_NOT_FOUND", "Room not found or has expired")` |
| **Room is full** (Yellow already joined) | `409 CONFLICT` via `GameException("ROOM_FULL", "Room already has two players")` |
| **Duplicate join** (same playerId as host) | `409 CONFLICT` via `GameException("CANNOT_JOIN_OWN_ROOM", "You cannot join your own room")` |
| **Turn timer expires** (20s elapsed) | Server auto-drops in a random valid column; broadcasts `TURN_TIMEOUT`; game continues normally. If no valid columns exist (board full), draw resolution fires instead. |
| **Player disconnects** mid-game | Broadcasts `PLAYER_DISCONNECTED` with 30s reconnect grace window. Game pauses (no timer ticks). After 30s without reconnect, opponent is declared winner via `GAME_OVER`. |
| **Player reconnects** within grace window | Broadcasts `PLAYER_RECONNECTED`; game resumes from saved Redis state; turn timer resets to full 20s. |
| **Both players disconnect** simultaneously | Session transitions to `ABANDONED`; no winner recorded; Redis TTL cleans up after 15 minutes. |
| **Rematch window expires** (60s) | Session transitions to `COMPLETED`; no new session created; both clients receive `REMATCH_DECLINED` with `reason: "TIMEOUT"`. |
| **Simultaneous drop requests** (race) | Redis Lua script ensures only one request is processed atomically; the second receives `GameException("NOT_YOUR_TURN")`. |
| **Quick match queue — player disconnects while queued** | `DELETE /api/v1/connectdrop/queue/leave` dequeues safely; if not called, queue entry expires after 30s via Redis TTL on the queue member. |
| **All columns full + ongoing win check fails** | Server detects draw via `board.allCellsFilled()` check inside engine; broadcasts `DRAW` event. |

---

## 10. Implementation Checklist

### Backend
- [ ] Microservice scaffolded under `backend/games/connect-drop-service/` (Spring Boot 21 LTS, port `8086`)
- [ ] `ConnectDropEngine` implemented: gravity resolution, win detection (4-in-a-row in all 4 directions), draw detection — unit tested with all edge-case board states
- [ ] Redis session model (`ConnectDropSession`) designed and implemented with JSON serialisation
- [ ] Lua atomic script for disc drop (column validation + gravity + board write + turn flip) implemented and tested
- [ ] `TurnTimeoutScheduler` implemented: 1s polling, 20s expiry, auto-drop to random valid column, `TURN_TIMEOUT` broadcast
- [ ] STOMP WebSocket endpoint `/ws/connectdrop` configured; topic `/topic/connectdrop/{sessionId}` publishing verified
- [ ] REST endpoints implemented and integration-tested:
  - [ ] `POST /api/v1/connectdrop/rooms/create`
  - [ ] `POST /api/v1/connectdrop/rooms/join`
  - [ ] `GET /api/v1/connectdrop/rooms/{roomCode}/status`
  - [ ] `POST /api/v1/connectdrop/queue/quick-match`
  - [ ] `DELETE /api/v1/connectdrop/queue/leave`
- [ ] All REST responses use `ApiResponse<T>` envelope
- [ ] All domain errors throw `GameException`, caught by `GlobalExceptionHandler`
- [ ] Reconnect grace period (30s) implemented and tested (disconnect → grace → auto-win)
- [ ] Rematch flow implemented: request, accept, decline, 60s timeout, colour swap, new session creation
- [ ] Scoring flush (async) to User Management Service post-game (+3/+1/0 logic)
- [ ] Redis key TTLs set correctly: room TTL 10 min (waiting), session TTL 15 min (completed/abandoned)
- [ ] Load tested at simulated 50,000 concurrent player ceiling

### Frontend
- [ ] React + Vite component created under `frontend/src/games/connect-drop/`
- [ ] Lobby screen with Quick Match and Play with Friend flows
- [ ] Room code modal with Copy Link / Copy Code functionality
- [ ] 7×6 board grid rendered correctly with empty cell insets
- [ ] Disc drop gravity animation (fall + bounce, ~400ms) implemented
- [ ] Column hover ghost-disc preview (hidden on opponent's turn)
- [ ] Turn indicator with player avatars + 20s countdown ring (colour-transitioning)
- [ ] `DISC_DROPPED` WebSocket event handler updates board state and triggers animation
- [ ] `TURN_TIMEOUT` WebSocket event handler shows toast + animates auto-drop
- [ ] `GAME_OVER` WebSocket event handler triggers winning-cell glow animation
- [ ] `DRAW` WebSocket event handler shows draw modal
- [ ] Winning 4-cell pulse/glow animation (3 cycles then steady)
- [ ] Game Over modal with confetti (winner) or draw message, Rematch + Back to Lobby buttons
- [ ] Rematch flow UI: request button, waiting state, accept/decline prompt, colour-swap transition
- [ ] Disconnection overlay and reconnect grace countdown shown to remaining player
- [ ] Responsive design: 52px cells (mobile) / 64px cells (desktop); tap hitbox spans full column
- [ ] Route `/games/connectdrop` registered in `frontend/src/App.jsx`

### Integration & Catalog
- [ ] `GameMetadata` entry for Connect Drop added to `games-master-service` catalog seed data
- [ ] End-to-end tested: full game flow (win, draw, timeout, rematch, disconnect/reconnect)
- [ ] Cross-browser tested (Chrome, Firefox, Safari, Edge)
- [ ] Mobile tested (iOS Safari, Android Chrome)

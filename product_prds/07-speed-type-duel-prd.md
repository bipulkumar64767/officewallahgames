# 📋 PRD 07: Speed Type Duel (Real-Time 2/3/4 Player Typing Race Microservice)

---

## 1. Overview & Objective
- **Service Name**: `speed-type-service`
- **Default Port**: `8087`
- **Primary Goal**: A real-time multiplayer typing race game supporting **2, 3, or 4 players** per session. All players race to type the same randomly selected passage as fast and accurately as possible. Built as an independent Spring Boot microservice with STOMP WebSocket state sync and Redis-backed session management. Supports **Private Room + Shareable Link** creation and **Quick Match** matchmaking. When fewer than 4 players are in a session, inactive player slots display an **"X" overlay icon** — consistent with the OfficeWallahGames slot-state visual system.

---

## 2. Gameplay Mechanics & Rules

- **Players**: 2, 3, or 4 players per match.
- **Passage**: All players type the **exact same** randomly selected passage (50–80 words long), sourced from a curated pool of office-humor sentences, famous quotes, and tech-jargon phrases.
- **Simultaneous Play**: All players type **at the same time** in real-time — there is no turn-based structure.
- **Game Timer**: A **90-second global countdown** starts from the moment the game begins (`GO!`). If a player has not finished before time runs out, their score is computed from what they completed.
- **Countdown Overlay**: A `3... 2... 1... GO!` animated full-screen overlay precedes the start of typing. Input is locked during this countdown.

### 2.1 Scoring System
- **WPM (Words Per Minute)**: `(total correct words typed) / (elapsed time in minutes)`
- **Accuracy**: `(correct keystrokes / total keystrokes) × 100` — expressed as a percentage.
- **Final Score**: `WPM × (Accuracy / 100)` — displayed as a decimal (e.g. `67.3`).
- **Rank**: Determined by **Final Score** (descending). **WPM** is the tiebreaker.

### 2.2 Win / Finish Conditions
- A player **finishes** when they successfully type the last character of the passage correctly.
- Upon finishing, a `PLAYER_FINISHED` event is broadcast with their final stats and rank at that moment.
- **Game Over** triggers when **all players have finished** OR the **90-second global timer expires**, whichever comes first.
- Players still mid-passage when the timer expires are ranked by their current Final Score.

### 2.3 Per-Character Feedback Rules
- **Correct character**: Highlight turns **green** (`#39d353` neon green).
- **Wrong character**: Highlight turns **red** (`#e94560`) + brief CSS shake animation on the character.
- **Current cursor position**: Blinking neon cyan (`#00f5ff`) vertical bar.
- **Backspace**: Allowed — reverts the last character back to neutral/untyped state.
- **No auto-correction**: Players must manually fix errors using Backspace.
- A character is only counted as a correct keystroke if the correct key is pressed (including after backspacing and re-typing).

### 2.4 Player Slot States
Each of the up-to-4 player slots must always be in one of these defined states:

| State | When | Visual |
|---|---|---|
| `ACTIVE` | Player is present and playing | Neon-colored avatar, live WPM bar animates |
| `WAITING` | Room created, awaiting player to join | Pulsing border + "Waiting..." label (no X) |
| `INACTIVE_SETUP` | Slot unused due to 2P or 3P mode | Full X overlay + "No Player" label |
| `OFFLINE` | Active player disconnected mid-game | Dimmed overlay + X icon + "Offline" label |
| `NOT_AVAILABLE` | Invited player never joined before match started | Dimmed overlay + X icon + "Unavailable" label |

### 2.5 Player Count → Active Slot Assignment

| Mode | Active Slots | Inactive Slot(s) |
|------|-------------|-----------------|
| **2P** | 🔴 Player 1 + 🟣 Player 2 | 🟡 Player 3 + 🟢 Player 4 |
| **3P** | 🔴 Player 1 + 🟣 Player 2 + 🟡 Player 3 | 🟢 Player 4 |
| **4P** | All 4 slots | None |

> The host selects the player count during room creation. Assignment is locked at game start and cannot be changed mid-session.

### 2.6 Passage Pool Categories
- **Office Humor**: e.g. *"The synergy of our cross-functional team deliverables has exceeded all Q3 bandwidth projections."*
- **Famous Quotes**: e.g. *"The only way to do great work is to love what you do."* — Steve Jobs
- **Tech Jargon**: e.g. *"Idempotent REST endpoints ensure that retrying a failed request does not produce unintended side effects."*

Each passage is between **50 and 80 words**. A `Passage` entity holds the text, category, and word count. Passages are pre-seeded in the database and cached in Redis.

### 2.7 Game States
`LOBBY` → `WAITING_FOR_PLAYERS` → `COUNTDOWN` → `ACTIVE` → `GAME_OVER` → `COMPLETED`

---

## 3. Room Creation & Shareable Link Architecture

Players can join in two modes:

1. **Quick Match (Matchmaking Queue)**: Enqueues player in Redis and matches them with available opponents **by selected player count** (2P, 3P, or 4P). Players in a 2P queue only match with other 2P-seeking players.
2. **Private Room (Invite Friends via Shareable Link)**:
   - Host clicks **"Create Private Room"** and selects player count (2P / 3P / 4P).
   - System generates a unique **6-character alphanumeric room code** following the pattern `STD-XXXX` (e.g. `STD-4K9Z`).
   - Generates a shareable URL: `https://officewallahgames.com/games/speedtype?room=STD-4K9Z`.
   - Host is registered as **Player 1** (🔴) and the room enters `WAITING_FOR_PLAYERS` state.
   - Host can click **"Copy Link"** or **"Copy Code"** to invite friends.
   - Each friend who joins via link or code gets the next available player slot in order.
   - Once the required number of players have joined, the server broadcasts `ROOM_READY` and the `3-2-1-GO` countdown begins.

### Room State Transition in Redis (`room:{roomCode}`):
```
[HOST CREATES]  ──►  WAITING_FOR_PLAYERS (TTL: 10 mins)
                              │
                   [REQUIRED PLAYERS JOIN]
                              │
                              ▼
                         COUNTDOWN (3...2...1...GO!, ~4 seconds)
                              │
                         [GO! fires]
                              │
                              ▼
                          ACTIVE (All players typing simultaneously)
                              │
                    [ALL FINISH or 90s TIMER EXPIRES]
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
   - `players`: `{ "P1": "GUEST_482910482", "P2": "GUEST_991820121", "P3": null, "P4": null }`
   - `slotStates`: `{ "P1": "ACTIVE", "P2": "ACTIVE", "P3": "INACTIVE_SETUP", "P4": "INACTIVE_SETUP" }`
   - `passage`: `{ "passageId": "PAS_0042", "text": "...", "wordCount": 63 }`
   - `playerStates`: map of `playerId → PlayerTypingState` (charsTyped, errors, currentWPM, accuracy, progressPercent, finished)
   - `status`: `WAITING_FOR_PLAYERS` | `COUNTDOWN` | `ACTIVE` | `GAME_OVER` | `COMPLETED` | `ABANDONED`
   - `startTimestamp`: epoch ms when `GO!` fired
   - `gameTimerDeadline`: epoch ms = `startTimestamp + 90000`
   - `playerCount`: `2` | `3` | `4`
   - `rankings`: ordered list of playerIds as they finish
   - TTL: Auto-expires 20 minutes after completion or abandonment.
3. **Atomic Progress Update Concurrency**:
   - Redis Lua script atomically checks current game state, writes per-player progress, and evaluates `GAME_OVER` conditions to prevent race conditions when multiple players finish within milliseconds of each other.
4. **WebSocket Sync via Redis Pub/Sub**:
   - STOMP messages dispatched to `/topic/speedtype/{sessionId}` across all pods.
5. **Progress Throttling**:
   - Per-player `PROGRESS_UPDATE` events are broadcast **every 500ms** OR on each **word completion**, whichever comes first, to prevent WebSocket flood while keeping the racing track smooth.
6. **Global Timer Enforcement**:
   - A server-side scheduled task (per-session `ScheduledExecutorService` backed by Redis key expiry event or a lightweight polling scheduler) triggers `GAME_OVER` at the 90-second deadline regardless of client state.

---

## 5. API & WebSocket Specifications

### 5.1 REST Room Management & Matchmaking

- **`POST /api/v1/speedtype/rooms/create`**
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
        "sessionId": "OWG_STD_77341",
        "roomCode": "STD-4K9Z",
        "shareableUrl": "/games/speedtype?room=STD-4K9Z",
        "assignedSlot": "P1",
        "playerCount": 3,
        "slotStates": {
          "P1": "ACTIVE",
          "P2": "WAITING",
          "P3": "WAITING",
          "P4": "INACTIVE_SETUP"
        },
        "status": "WAITING_FOR_PLAYERS"
      },
      "message": "Private room created successfully"
    }
    ```

- **`POST /api/v1/speedtype/rooms/join`**
  - **Body**:
    ```json
    {
      "roomCode": "STD-4K9Z",
      "playerId": "GUEST_991820121",
      "playerName": "Alex"
    }
    ```
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "sessionId": "OWG_STD_77341",
        "roomCode": "STD-4K9Z",
        "assignedSlot": "P2",
        "playerCount": 3,
        "slotStates": {
          "P1": "ACTIVE",
          "P2": "ACTIVE",
          "P3": "WAITING",
          "P4": "INACTIVE_SETUP"
        },
        "status": "WAITING_FOR_PLAYERS"
      },
      "message": "Joined room successfully"
    }
    ```

- **`GET /api/v1/speedtype/rooms/{roomCode}/status`**
  - **Description**: Lightweight verification check when a user visits `?room=CODE` before opening WebSocket. Returns current slot states, player count, and session status so the frontend can render the correct lobby state before subscribing.
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "sessionId": "OWG_STD_77341",
        "roomCode": "STD-4K9Z",
        "gameStatus": "WAITING_FOR_PLAYERS",
        "playerCount": 3,
        "slotStates": { "P1": "ACTIVE", "P2": "ACTIVE", "P3": "WAITING", "P4": "INACTIVE_SETUP" }
      },
      "message": "Room status retrieved"
    }
    ```

- **`POST /api/v1/speedtype/queue/quick-match`**
  - **Body**: `{ "playerId": "GUEST_482910482", "playerName": "Guest 482910482", "playerCount": 2 }`
  - **Behavior**: Enqueues player in a Redis ZSET partitioned by `playerCount`. When the queue for a given `playerCount` reaches the required size, the service automatically creates a session, assigns slots, and broadcasts `ROOM_READY` to all matched players.
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": { "queuePosition": 1, "playerCount": 2, "estimatedWaitSeconds": 15 },
      "message": "Enqueued for Quick Match"
    }
    ```

- **`GET /api/v1/speedtype/passages/random`**
  - **Description**: Returns a single randomly selected passage from the curated pool. Used internally at game start; also callable by the frontend for preview purposes (lobby screen passage preview).
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "passageId": "PAS_0042",
        "text": "The synergy of our cross-functional team deliverables has exceeded all Q3 bandwidth projections.",
        "category": "OFFICE_HUMOR",
        "wordCount": 16
      },
      "message": "Passage retrieved"
    }
    ```

---

### 5.2 STOMP WebSocket Messaging (`/ws/speedtype`)

- **Connection**: `new SockJS('/ws/speedtype')` + `Stomp.over(...)`
- **Subscribe Topic**: `/topic/speedtype/{sessionId}`
- **Client → Server Destinations**:
  - Submit Progress Update: `/app/speedtype/{sessionId}/progress`
    - **Payload**:
      ```json
      {
        "playerId": "GUEST_482910482",
        "charsTyped": 47,
        "correctChars": 45,
        "totalKeystrokes": 50,
        "currentWordIndex": 9
      }
      ```
  - Player Finished: `/app/speedtype/{sessionId}/finish`
    - **Payload**:
      ```json
      {
        "playerId": "GUEST_482910482",
        "totalTimeMs": 54200,
        "totalKeystrokes": 312,
        "correctKeystrokes": 305
      }
      ```

- **Server → Client Broadcast Events** (on `/topic/speedtype/{sessionId}`):

  | Event | Payload |
  |---|---|
  | `PLAYER_JOINED` | `{ "slot": "P2", "playerName": "Alex", "slotStates": { ... } }` |
  | `ROOM_READY` | `{ "sessionId": "OWG_STD_77341", "playerCount": 3, "slotStates": { ... } }` |
  | `COUNTDOWN` | `{ "countdownValue": 3 }` → repeated for 2, 1, then `"GO"` |
  | `GAME_STARTED` | `{ "passage": { "passageId": "PAS_0042", "text": "...", "wordCount": 63 }, "startTimestamp": 1730154600000, "gameTimerDeadline": 1730154690000 }` |
  | `PROGRESS_UPDATE` | `{ "playerId": "GUEST_482910482", "slot": "P1", "charsTyped": 47, "currentWPM": 58.3, "accuracy": 96.0, "progressPercent": 44.7 }` |
  | `PLAYER_FINISHED` | `{ "playerId": "GUEST_482910482", "slot": "P1", "finalWPM": 72.1, "accuracy": 97.4, "finalScore": 70.2, "rank": 1, "totalTimeMs": 54200 }` |
  | `GAME_OVER` | `{ "reason": "ALL_FINISHED" \| "TIMER_EXPIRED", "rankings": [ { "rank": 1, "playerId": "...", "slot": "P1", "playerName": "...", "wpm": 72.1, "accuracy": 97.4, "finalScore": 70.2 }, ... ] }` |
  | `PLAYER_DISCONNECTED` | `{ "slot": "P2", "playerId": "...", "newSlotState": "OFFLINE", "reconnectGracePeriodSeconds": 60 }` |
  | `PLAYER_RECONNECTED` | `{ "slot": "P2", "playerId": "...", "newSlotState": "ACTIVE" }` |

---

## 6. UI/UX Specifications

- **Theme & Aesthetic**: Dark theme — background `#1a1a2e`, primary accent `#e94560`, neon highlights (cyan `#00f5ff`, green `#39d353`). Consistent with OfficeWallahGames design language.

### 6.1 Lobby Screen
- **Player count selector**: Segmented control — `2 Players | 3 Players | 4 Players`.
- Two action buttons: **"⚡ Quick Match"** and **"🔗 Play with Friends"**.
- **"Play with Friends" flow** → Modal displays:
  - Room code (e.g. `STD-4K9Z`) in large monospace font.
  - **"📋 Copy Link"** and **"📋 Copy Code"** buttons.
  - Pulsing status: *"Waiting for players to join... (1/3)"*.
  - Live slot previews: up to 4 mini player cards showing slot color, player name, or "Waiting…" / "No Player" + X icon for `INACTIVE_SETUP` slots.
- **"Quick Match" flow** → Full-screen pulsing overlay: *"Finding opponents... (2P)"* with a cancel button.

### 6.2 Countdown Overlay
- Full-screen animated overlay with countdown: `3 → 2 → 1 → GO!`.
- Each number scales in with a bounce animation and fades out before the next.
- `GO!` text is in accent `#e94560`, bold, with a brief radial pulse effect.
- Input box is `disabled` and passage is shown (blurred) behind the overlay during countdown.

### 6.3 Game Screen
- **Layout** (two-column on desktop, stacked on mobile):
  - **Left / Center (main play area):**
    - **Passage Display**: Large monospace font (e.g. `JetBrains Mono` or `Courier New`), `#e0e0e0` text, generous line height. Characters colored:
      - Untyped: `#e0e0e0`
      - Correct: `#39d353` (neon green)
      - Incorrect: `#e94560` (red) + shake animation
    - **Blinking Cursor**: Neon cyan `#00f5ff` vertical bar at the current input position, CSS blink animation.
    - **Hidden input** (`<input type="text" opacity:0>`) captures keystrokes — the visible passage reacts to each keystroke.
    - **Self WPM Counter**: Large prominent number (e.g. `72 WPM`) in top-right of the play area, live-updating.
    - **Accuracy Badge**: Smaller `96.2%` label adjacent to WPM counter.
  - **Right Panel (Live Leaderboard)**:
    - One row per active player showing: color avatar circle, player name, live WPM progress bar (filled in the player's neon color), and current WPM value.
    - `INACTIVE_SETUP` / `OFFLINE` slots shown with X overlay and dimmed bar.
    - Updates in real-time from `PROGRESS_UPDATE` events.
- **Global Game Timer**: Centered at the top — large countdown display (e.g. `1:30 → 0:00`). Turns red in the last 10 seconds with a pulse animation.
- **Horizontal Racing Track**: Fixed at the bottom of the screen. Shows all player avatars (colored circles with initials) moving left-to-right across a track as their `progressPercent` increases. Each avatar has a color trail behind it.

### 6.4 Inactive Slot — X Overlay Specification
Consistent with Ludo PRD visual system:
- Semi-transparent black overlay: `rgba(0,0,0,0.45)` covering the full player slot card.
- Circular "✕" badge centered: 48×48dp, white `#FFFFFF` glyph on `#CC3333` background.
- Label below icon: 10sp, Medium weight, `#FFFFFF`, centered — text varies by state:
  - `INACTIVE_SETUP` → **"No Player"**
  - `OFFLINE` → **"Offline"**
  - `NOT_AVAILABLE` → **"Unavailable"**
- Overlay fade-in on state change: 150ms ease transition.

### 6.5 Game Over Modal
- Triggered by `GAME_OVER` event.
- **Animated Podium**: 🥇🥈🥉 icons animate up (slide-in with bounce) for the top 3 ranked players.
- **Stats Table**: One row per player — Rank, Name, WPM, Accuracy, Final Score. Winner's row highlighted in gold `#ffd700`.
- **Confetti** burst for 1st place winner (CSS/canvas particle animation).
- Action buttons: **"🔁 Play Again"** (creates a new room with same player count) and **"🔗 Copy Room Link"**.

### 6.6 Reconnection Flow
- Disconnected player slot immediately shows **"Offline" X overlay** to all clients.
- A 60-second reconnect grace timer runs server-side.
- On reconnection within the grace window → overlay dismissed, slot returns to `ACTIVE`, player resumes from their last saved progress position.
- After grace window expires → remaining players see toast: *"[Name] has been removed. Game continues."*

---

## 7. Backend Architecture & Microservice Design

- **Microservice Module**: `backend/games/speed-type-service/`
- **Port**: `8087`
- **Runtime**: Spring Boot 3.x, Java 21 LTS
- **State Management**: Redis (primary session state + Pub/Sub), no in-JVM game state.
- **Error Handling**: Throw `GameException` for domain errors (room full, game already started, invalid player, passage not found); caught by `GlobalExceptionHandler` returning standardized `ApiResponse<T>`.
- **Core Packages**:
  - `controller/` → `SpeedTypeRoomController` (REST), `SpeedTypeWebSocketController` (STOMP `@MessageMapping`)
  - `service/` → `SpeedTypeGameService`, `SpeedTypeRoomService`, `SpeedTypeMatchmakingService`, `PassageService`
  - `engine/` → `ScoringEngine` (WPM calculation, accuracy calculation, rank assignment), `GameTimerEngine` (90s deadline enforcement)
  - `model/` → `SpeedTypeSession`, `PlayerTypingState`, `Passage`, `SlotState` (enum), `GameStatus` (enum)
  - `redis/` → `SpeedTypeRedisRepository`, Lua atomic scripts for progress updates and game-over evaluation
  - `websocket/` → STOMP config (`WebSocketMessageBrokerConfigurer`), event publisher (`SimpMessagingTemplate`)
  - `scheduler/` → `GameTimerScheduler` (triggers `GAME_OVER` at deadline via Redis key expiry or virtual-thread scheduler)

---

## 8. Data Models

### SpeedTypeSession (Redis Hash)
| Field | Type | Description |
|---|---|---|
| `sessionId` | `String` | e.g. `OWG_STD_77341` |
| `roomCode` | `String` | e.g. `STD-4K9Z` |
| `playerCount` | `int` | `2`, `3`, or `4` |
| `players` | `Map<String, String>` | Slot key (`P1`–`P4`) → playerId |
| `playerNames` | `Map<String, String>` | Slot key → player display name |
| `slotStates` | `Map<String, SlotState>` | Slot key → current slot state |
| `passageId` | `String` | FK to selected `Passage` |
| `playerStates` | `Map<String, PlayerTypingState>` | playerId → live typing state |
| `status` | `GameStatus` | Current game lifecycle state |
| `startTimestamp` | `long` | Epoch ms when `GAME_STARTED` fired |
| `gameTimerDeadline` | `long` | Epoch ms = `startTimestamp + 90000` |
| `rankings` | `List<String>` | playerIds in finish order (updated as each player finishes) |
| `createdAt` | `long` | Epoch ms of room creation |

### PlayerTypingState (nested in SpeedTypeSession)
| Field | Type | Description |
|---|---|---|
| `playerId` | `String` | Player unique identifier |
| `slot` | `String` | `P1`, `P2`, `P3`, or `P4` |
| `charsTyped` | `int` | Number of characters correctly typed so far |
| `totalKeystrokes` | `int` | Total number of keys pressed (including mistakes and backspaces) |
| `correctKeystrokes` | `int` | Count of keystrokes that resulted in a correct character placement |
| `currentWPM` | `double` | Live WPM at last update |
| `accuracy` | `double` | Live accuracy percentage at last update |
| `progressPercent` | `double` | `(charsTyped / passage.length) × 100` |
| `finished` | `boolean` | Whether the player has completed the full passage |
| `finishedAtMs` | `long` | Epoch ms when player typed the last character (0 if not finished) |
| `finalScore` | `double` | Computed at finish: `WPM × (accuracy / 100)` |
| `rank` | `int` | Assigned rank (0 = not yet ranked) |

### Passage (PostgreSQL + Redis Cache)
| Field | Type | Description |
|---|---|---|
| `passageId` | `String` (PK) | e.g. `PAS_0042` |
| `text` | `String` | Full passage text (50–80 words) |
| `category` | `String` | `OFFICE_HUMOR`, `FAMOUS_QUOTE`, `TECH_JARGON` |
| `wordCount` | `int` | Pre-computed word count |
| `charCount` | `int` | Pre-computed character count |
| `isActive` | `boolean` | Whether passage is available for selection |

---

## 9. Edge Cases & Error Handling

| Edge Case | Behavior |
|---|---|
| Player submits progress after game timer expired | Server ignores the update; returns `410 GONE` via `GameException("GAME_ALREADY_OVER")` |
| Player submits finish event before `GAME_STARTED` | `403 FORBIDDEN` via `GameException("GAME_NOT_ACTIVE")` |
| Two players finish within the same Redis Lua script execution window | Lua script assigns ranks atomically in insertion order; no tie for the same rank is possible |
| A 4th player tries to join a full 3P room | `409 CONFLICT` — `GameException("ROOM_FULL")` → *"Room is full"* |
| Room code is expired or not found | `404 NOT_FOUND` — `GameException("ROOM_NOT_FOUND")` → *"Room not found or expired"* |
| Player tries to join a room that is already `ACTIVE` | `409 CONFLICT` — `GameException("GAME_ALREADY_STARTED")` → *"Game is in progress"* |
| All non-host players disconnect before game starts | Room stays `WAITING_FOR_PLAYERS`; host sees toast: *"Waiting for players. Room expires in X minutes."* |
| Host disconnects mid-game | Host role transferred to P2; gameplay continues uninterrupted |
| Player disconnects mid-game | Slot moves to `OFFLINE` state; 60-second grace period begins; progress is frozen at last known state |
| Network blip < 3 seconds | Suppressed; no slot state change broadcast to other clients |
| Quick-match player cancels while in queue | `DELETE /api/v1/speedtype/queue/quick-match` removes player from Redis ZSET |
| Passage database is empty / unavailable | `503 SERVICE_UNAVAILABLE` via `GameException("PASSAGE_UNAVAILABLE")` → *"Could not load passage. Please try again."* |
| Player types faster than 200 WPM (suspected cheat/bot) | Server flags the session; final score is marked `FLAGGED` in Redis; does not affect other players' experience |
| Two players in the Quick Match queue for 2P both submit simultaneously | Redis ZSET atomic `ZPOPMIN` ensures only one pair is dequeued and matched; second invocation finds queue empty |

---

## 10. Implementation Checklist

- [ ] Backend microservice scaffolded under `backend/games/speed-type-service/` with Spring Boot 3.x, Java 21 LTS, port `8087`
- [ ] `Passage` entity and seed data created (minimum 30 passages across 3 categories)
- [ ] `PassageService` with random passage selection and Redis caching implemented
- [ ] `SpeedTypeRoomService` with room creation, join, and slot state machine implemented
- [ ] `SpeedTypeMatchmakingService` with Redis ZSET quick-match queue (partitioned by player count) implemented
- [ ] `ScoringEngine` for WPM, accuracy, and final score computation implemented and unit tested
- [ ] `GameTimerEngine` with server-side 90-second deadline enforcement implemented
- [ ] Redis session model (`SpeedTypeSession`, `PlayerTypingState`) with Lua atomic scripts for progress update and game-over evaluation implemented
- [ ] STOMP WebSocket handlers (`/ws/speedtype`, `/topic/speedtype/{sessionId}`) implemented and integration tested
- [ ] REST endpoints (`create`, `join`, `status`, `quick-match`, `passages/random`) implemented and returning `ApiResponse<T>`
- [ ] `GameException` thrown for all domain errors and caught by `GlobalExceptionHandler`
- [ ] Slot state machine (`ACTIVE`, `WAITING`, `INACTIVE_SETUP`, `OFFLINE`, `NOT_AVAILABLE`) implemented
- [ ] Reconnect grace period (60 seconds) implemented server-side
- [ ] `PROGRESS_UPDATE` throttling (every 500ms or on word completion) implemented
- [ ] Frontend created under `frontend/src/games/speed-type/`
- [ ] Lobby screen with player count selector, Quick Match, and Play with Friends (room code modal) built
- [ ] Countdown overlay (3-2-1-GO!) built with locked input during countdown
- [ ] Passage display component with per-character correct/incorrect/untyped coloring and blinking cursor built
- [ ] Hidden input capture with keystroke processing and backspace support built
- [ ] Live WPM + Accuracy HUD (self stats) built
- [ ] Right panel Live Leaderboard with per-player WPM progress bars built
- [ ] Horizontal Racing Track component (player avatars moving by `progressPercent`) built
- [ ] Global 90-second Game Timer (top-center, turns red at 10s) built
- [ ] X overlay component for inactive/offline/unavailable slots built (consistent with Ludo spec)
- [ ] Game Over modal with animated podium (🥇🥈🥉), stats table, and action buttons built
- [ ] Reconnection flow UI (Offline overlay dismiss on reconnect) built
- [ ] Navigation route `/games/speedtype` registered in `frontend/src/App.jsx`
- [ ] `GameMetadata` entry for Speed Type Duel added to `games-master-service` catalog seed data (`gameId: "speedtype"`, `maxPlayers: 4`, `route: "/games/speedtype"`)
- [ ] Integrated end-to-end and verified (2P, 3P, and 4P sessions tested; timer expiry path tested; reconnect path tested)

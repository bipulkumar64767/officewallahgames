# 📋 PRD 05: Word Grid Blitz (Real-Time 2/3/4 Player Multiplayer Word Game Microservice)

---

## 1. Overview & Objective
- **Service Name**: `word-grid-service`
- **Default Port**: `8085`
- **Primary Goal**: A real-time, simultaneous multiplayer word-grid game supporting **2, 3, or 4 players** per session. Players take turns placing letters onto a shared **10×10 grid**, then optionally trace connected lines across existing letters to claim valid English words for points. Built as an independent Spring Boot microservice with STOMP WebSocket state sync and Redis-backed session management. Supports **Private Room + Shareable Link** creation and **Random Matchmaking**. Unused player slots display an **"X" overlay "No Player"** (`INACTIVE_SETUP` state) — consistent with the OfficeWallahGames slot system.

---

## 2. Gameplay Mechanics & Rules

- **Players**: 2, 3, or 4 players per match.
- **Grid**: Shared **10×10** letter grid (100 cells). Each cell can hold exactly one A–Z letter once placed.
- **Turn Timer**: **30 seconds** per turn to place a letter and optionally draw a word line. On expiry, the letter placement is auto-skipped and the turn passes.
- **Post-Turn Window**: After a turn ends (regardless of whether a word was claimed), a **5-second countdown bar** appears. During this window, the active player may press **"Fast Proceed ⏩"** to skip immediately if they know no word can be formed.

### 2.1 Turn Structure
Each player's turn consists of two phases executed within the 30-second timer:

1. **Phase 1 — Letter Placement** *(required)*: The player taps any **empty cell** on the grid to place one letter of their choice (A–Z). Placing a letter is the minimum action required for a turn.
2. **Phase 2 — Word Claim** *(optional)*: After placing a letter, the player may draw a connected line across **existing letters already on the grid** (including the just-placed letter) to claim a word. Lines must connect adjacent cells (horizontally, vertically, or diagonally). Minimum word length: **3 letters**.

### 2.2 Word Validation & Scoring

| Action | Points |
|---|---|
| Valid dictionary word (3–6 letters) | **+2 points** |
| Valid dictionary word (7+ letters) | **+3 points** (+1 length bonus) |
| Invalid dictionary word | **−1 point** (penalty) |
| Letter placed, no word drawn | **0 points** |

- Dictionary validation is **server-side** using an in-memory `HashSet<String>` loaded from the SOWPODS / TWL standard English word list at service startup.
- A word may only be claimed once. Once a word's exact path of cells has been claimed, those cells are flagged as part of a claimed word path (but letters remain visible and reusable in new word paths — overlapping letter use is permitted).
- Words are case-insensitive. Validation normalizes to uppercase before lookup.

### 2.3 Word Drawing Rules
- A word line must pass through **adjacent cells only** (8-directional adjacency: horizontal, vertical, diagonal).
- The line may **change direction** at each step (not constrained to a single axis).
- A cell may appear **at most once** per drawn word path.
- The line must be at least **3 cells long**.
- After drawing, a **Confirmation Popup** appears showing the formed word. The player must confirm or cancel within the remaining turn timer.

### 2.4 Game End Conditions
The game ends when **any one** of the following is true:
1. **Grid Full**: All 100 cells have been filled with letters.
2. **Score Threshold**: Any player reaches **30 points** (configurable).
3. **Mutual Agreement**: All active players vote to end the game (a "Propose End" button triggers a vote; if all confirm within 15 seconds, the game ends).

### 2.5 Player Slot States
Each of the 4 color slots must always be in one of these defined states:

| State | When | Visual |
|---|---|---|
| `ACTIVE` | Player is present and playing | Colored name tag, score visible, interactive |
| `WAITING` | Room created, awaiting player to join | Pulsing border + "Waiting..." label (no X) |
| `INACTIVE_SETUP` | Slot unused due to 2P or 3P mode | Full X overlay + "No Player" label |
| `OFFLINE` | Active player disconnected mid-game | Dimmed overlay + X icon + "Offline" label |
| `NOT_AVAILABLE` | Invited player never joined before match started | Dimmed overlay + X icon + "Unavailable" label |

### 2.6 Player Count → Active Slot Assignment

| Mode | Active Color Slots | Inactive Slot(s) |
|------|-------------------|-----------------:|
| **2P** | 🔴 Player 1 + 🟢 Player 2 | 🟡 Player 3 + 🔵 Player 4 |
| **3P** | 🔴 Player 1 + 🟢 Player 2 + 🟡 Player 3 | 🔵 Player 4 |
| **4P** | All 4 slots | None |

> The host selects the player count during room creation. Assignment is locked at game start.

### 2.7 Player Colors & Identifiers

| Slot | Color | Hex | Claimed-Word Highlight |
|------|-------|-----|----------------------|
| Player 1 | 🔴 Red | `#e94560` | Red glow on claimed cells |
| Player 2 | 🟢 Green | `#00c9a7` | Green glow on claimed cells |
| Player 3 | 🟡 Yellow | `#f7b731` | Yellow glow on claimed cells |
| Player 4 | 🔵 Blue | `#4fc3f7` | Blue glow on claimed cells |

Each player's claimed word paths are permanently highlighted in their color on the grid for all players to see.

### 2.8 Turn-Skip Logic for Inactive / Offline Slots
- When a slot is `INACTIVE_SETUP`, `OFFLINE`, or `NOT_AVAILABLE`, the turn engine **auto-skips** that player instantly (< 200ms).
- A brief toast notification **"[Player] skipped"** appears for 1.5 seconds on all clients.
- No turn timer is shown for a skipped slot.

### 2.9 Game States
`LOBBY` → `WAITING_FOR_PLAYERS` → `ACTIVE` → `GAME_OVER` → `COMPLETED`

---

## 3. Room Creation & Shareable Link Architecture

Players can join in two modes:

1. **Quick Match (Random Matchmaking Queue)**: Enqueues player in Redis and matches them with available opponents for the selected player count (2P, 3P, or 4P).
2. **Private Room (Invite Friends via Shareable Link)**:
   - Host clicks **"Create Private Room"** and selects player count (2P / 3P / 4P).
   - System generates a unique 6-character alphanumeric room code following pattern `WGB-XXXX` (e.g. `WGB-4K9Z`).
   - Generates a shareable URL: `https://officewallahgames.com/games/wordgrid?room=WGB-4K9Z`
   - Host is registered as 🔴 Player 1 and assigned `WAITING_FOR_PLAYERS` state.
   - Host can click **"Copy Link"** or **"Copy Code"** to invite friends.
   - Each friend who joins via link or code gets the next available player slot.
   - Once the required number of players have joined, the server broadcasts `ROOM_READY` and the match starts.

### Room State Transition in Redis (`room:{roomCode}`):
```
[HOST CREATES]  ──►  WAITING_FOR_PLAYERS (TTL: 10 mins)
                              │
                   [REQUIRED PLAYERS JOIN]
                              │
                              ▼
                           ACTIVE (Letter-placement gameplay)
                              │
                    [GRID FULL / SCORE THRESHOLD
                     / MUTUAL AGREEMENT VOTE]
                              │
                              ▼
                  COMPLETED (TTL: 15 mins for rematch window)
```

---

## 4. High-Concurrency Architecture

1. **Stateless Service Instances**:
   - Zero game session state stored in Java heap.
   - Any pod handles WebSocket frames for any game session via Redis Pub/Sub.
   - Horizontally scalable; each pod registers as a STOMP subscriber relay.

2. **Distributed Redis State (`game:{sessionId}`)** — stored as Redis Hash/JSON:
   - `players`: `{ "P1": "GUEST_482910482", "P2": "GUEST_991820121", "P3": null, "P4": null }`
   - `slotStates`: `{ "P1": "ACTIVE", "P2": "ACTIVE", "P3": "INACTIVE_SETUP", "P4": "INACTIVE_SETUP" }`
   - `grid`: flat `100-element JSON array` of `GridCell` objects (index = `row * 10 + col`)
   - `scores`: `{ "P1": 0, "P2": 4, "P3": 0, "P4": 0 }`
   - `currentTurn`: `"P1"` | `"P2"` | `"P3"` | `"P4"`
   - `turnOrder`: ordered list of active player slots
   - `status`: `WAITING_FOR_PLAYERS` | `ACTIVE` | `GAME_OVER` | `COMPLETED` | `ABANDONED`
   - `claimedWords`: `Set<String>` of claimed word-path fingerprints (to prevent re-claiming the same path)
   - `endVotes`: `Set<String>` of player IDs who have voted to end
   - `playerCount`: `2` | `3` | `4`
   - `turnStartedAt`: epoch ms for 30s timer enforcement
   - TTL: Auto-expires 20 minutes after completion or abandonment.

3. **Atomic Turn Concurrency**:
   - Redis Lua script ensures letter placement, word validation result, score update, and turn-flip are executed atomically to prevent race conditions.
   - Prevents two clients from placing letters in the same cell simultaneously.

4. **Dictionary — In-Memory HashSet**:
   - Loaded at service startup from a bundled word list file (`sowpods.txt` / `twl.txt`).
   - ~267,000 word entries loaded into a static `HashSet<String>` (estimated ~50MB heap; acceptable for a microservice).
   - Word lookup is O(1). No database call for validation.

5. **WebSocket Sync via Redis Pub/Sub**:
   - STOMP messages dispatched to `/topic/wordgrid/{sessionId}` across all pods via Redis Pub/Sub channel.

---

## 5. API & WebSocket Specifications

### 5.1 REST Endpoints

All responses use the standardized `ApiResponse<T>` envelope:
```json
{
  "status": "SUCCESS" | "ERROR",
  "data": { ... },
  "message": "Human-readable message"
}
```

---

#### `POST /api/v1/wordgrid/rooms/create`
Create a new private room.

**Request Body**:
```json
{
  "playerId": "GUEST_482910482",
  "playerName": "Rahul",
  "playerCount": 3
}
```

**Response** `200 OK`:
```json
{
  "status": "SUCCESS",
  "data": {
    "sessionId": "OWG_WGB_77341",
    "roomCode": "WGB-4K9Z",
    "shareableUrl": "/games/wordgrid?room=WGB-4K9Z",
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

---

#### `POST /api/v1/wordgrid/rooms/join`
Join an existing room via room code.

**Request Body**:
```json
{
  "roomCode": "WGB-4K9Z",
  "playerId": "GUEST_991820121",
  "playerName": "Priya"
}
```

**Response** `200 OK`:
```json
{
  "status": "SUCCESS",
  "data": {
    "sessionId": "OWG_WGB_77341",
    "roomCode": "WGB-4K9Z",
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

---

#### `GET /api/v1/wordgrid/rooms/{roomCode}/status`
Lightweight room-status check. Called when a user visits `?room=WGB-XXXX` before opening WebSocket to verify the room exists and is joinable.

**Response** `200 OK`:
```json
{
  "status": "SUCCESS",
  "data": {
    "sessionId": "OWG_WGB_77341",
    "roomCode": "WGB-4K9Z",
    "playerCount": 3,
    "currentPlayers": 2,
    "slotStates": { "P1": "ACTIVE", "P2": "ACTIVE", "P3": "WAITING", "P4": "INACTIVE_SETUP" },
    "status": "WAITING_FOR_PLAYERS"
  },
  "message": "Room found"
}
```

---

#### `POST /api/v1/wordgrid/queue/quick-match`
Enqueue for random matchmaking.

**Request Body**:
```json
{
  "playerId": "GUEST_482910482",
  "playerName": "Rahul",
  "playerCount": 2
}
```

**Response** `200 OK`:
```json
{
  "status": "SUCCESS",
  "data": {
    "queuePosition": 1,
    "estimatedWaitSeconds": 15
  },
  "message": "Added to matchmaking queue. Waiting for opponent..."
}
```

---

#### `GET /api/v1/wordgrid/validate-word?word={word}`
One-off word lookup (used by the server internally; may also be exposed for client-side pre-check). Returns whether a word exists in the dictionary — does **not** award points (point award happens only via WebSocket WORD_DRAWN flow).

**Response** `200 OK`:
```json
{
  "status": "SUCCESS",
  "data": {
    "word": "QUARTZ",
    "valid": true
  },
  "message": "Word is valid"
}
```

---

### 5.2 STOMP WebSocket Messaging (`/ws/wordgrid`)

- **Connection**: `new SockJS('/ws/wordgrid')` + `Stomp.over(...)`
- **Subscribe Topic**: `/topic/wordgrid/{sessionId}`

---

#### Client → Server Destinations:

| Destination | Description | Payload |
|---|---|---|
| `/app/wordgrid/{sessionId}/place-letter` | Player places a letter on the grid | `{ "playerId": "...", "row": 3, "col": 5, "letter": "Q" }` |
| `/app/wordgrid/{sessionId}/draw-word` | Player draws a word path | `{ "playerId": "...", "cells": [{"row":3,"col":5},{"row":3,"col":6},{"row":3,"col":7}] }` |
| `/app/wordgrid/{sessionId}/confirm-word` | Player confirms word from popup | `{ "playerId": "...", "confirmed": true }` |
| `/app/wordgrid/{sessionId}/fast-proceed` | Player clicks Fast Proceed ⏩ | `{ "playerId": "..." }` |
| `/app/wordgrid/{sessionId}/propose-end` | Player proposes to end the game | `{ "playerId": "..." }` |
| `/app/wordgrid/{sessionId}/vote-end` | Player votes on end-game proposal | `{ "playerId": "...", "vote": true }` |

---

#### Server → Client Broadcast Events (on `/topic/wordgrid/{sessionId}`):

**`PLAYER_JOINED`** — A new player joined the room:
```json
{
  "type": "PLAYER_JOINED",
  "slot": "P2",
  "playerName": "Priya",
  "slotStates": { "P1": "ACTIVE", "P2": "ACTIVE", "P3": "WAITING", "P4": "INACTIVE_SETUP" }
}
```

**`ROOM_READY`** — All required players have joined; match starts:
```json
{
  "type": "ROOM_READY",
  "status": "ACTIVE",
  "firstTurn": "P1",
  "turnOrder": ["P1", "P2", "P3"],
  "slotStates": { "P1": "ACTIVE", "P2": "ACTIVE", "P3": "ACTIVE", "P4": "INACTIVE_SETUP" },
  "grid": [ /* 100 GridCell objects, all empty */ ]
}
```

**`LETTER_PLACED`** — A player placed a letter; all clients update the grid:
```json
{
  "type": "LETTER_PLACED",
  "playerId": "GUEST_482910482",
  "slot": "P1",
  "row": 3,
  "col": 5,
  "letter": "Q",
  "nextPhase": "WORD_DRAW_OPTIONAL",
  "remainingTurnMs": 18500
}
```

**`WORD_DRAWN`** — A player submitted a word path for validation (interim event before result):
```json
{
  "type": "WORD_DRAWN",
  "slot": "P1",
  "cells": [{"row":3,"col":5},{"row":3,"col":6},{"row":3,"col":7}],
  "word": "QUA",
  "awaitingConfirmation": true
}
```

**`WORD_RESULT`** — Server broadcasts the validation result after player confirms:
```json
{
  "type": "WORD_RESULT",
  "slot": "P1",
  "word": "QUARTZ",
  "cells": [{"row":3,"col":5},{"row":3,"col":6},{"row":3,"col":7},{"row":3,"col":8},{"row":4,"col":8},{"row":5,"col":8}],
  "valid": true,
  "pointsAwarded": 3,
  "reason": "VALID_LONG_WORD",
  "scores": { "P1": 7, "P2": 4, "P3": 2, "P4": 0 }
}
```

**`SCORE_UPDATE`** — Live score broadcast (also sent after `WORD_RESULT`):
```json
{
  "type": "SCORE_UPDATE",
  "scores": { "P1": 7, "P2": 4, "P3": 2, "P4": 0 },
  "ranks": { "P1": 1, "P2": 2, "P3": 3, "P4": 4 }
}
```

**`TURN_ENDED`** — Turn has ended; next player's turn begins:
```json
{
  "type": "TURN_ENDED",
  "completedSlot": "P1",
  "nextTurn": "P2",
  "fastProceeded": false,
  "turnTimerMs": 30000
}
```

**`FAST_PROCEED`** — Player skipped the 5-second window early:
```json
{
  "type": "FAST_PROCEED",
  "slot": "P1",
  "nextTurn": "P2"
}
```

**`TURN_TIMEOUT`** — Player ran out of time:
```json
{
  "type": "TURN_TIMEOUT",
  "slot": "P1",
  "reason": "TIMER_EXPIRED",
  "nextTurn": "P2"
}
```

**`TURN_SKIPPED`** — Inactive/offline slot auto-skipped:
```json
{
  "type": "TURN_SKIPPED",
  "slot": "P3",
  "reason": "INACTIVE_SETUP",
  "nextTurn": "P1"
}
```

**`END_VOTE_PROPOSED`** — A player proposed to end the game:
```json
{
  "type": "END_VOTE_PROPOSED",
  "proposedBy": "P2",
  "voteDeadlineMs": 15000,
  "currentVotes": { "P1": null, "P2": true, "P3": null }
}
```

**`PLAYER_DISCONNECTED`** — A player went offline:
```json
{
  "type": "PLAYER_DISCONNECTED",
  "slot": "P2",
  "newSlotState": "OFFLINE",
  "reconnectGracePeriodSeconds": 60
}
```

**`PLAYER_RECONNECTED`** — A player came back online:
```json
{
  "type": "PLAYER_RECONNECTED",
  "slot": "P2",
  "newSlotState": "ACTIVE"
}
```

**`GAME_OVER`** — Game has ended:
```json
{
  "type": "GAME_OVER",
  "reason": "GRID_FULL",
  "finalScores": { "P1": 14, "P2": 9, "P3": 7, "P4": 0 },
  "rankings": [
    { "rank": 1, "slot": "P1", "playerName": "Rahul", "score": 14 },
    { "rank": 2, "slot": "P2", "playerName": "Priya", "score": 9 },
    { "rank": 3, "slot": "P3", "playerName": "Anil", "score": 7 }
  ],
  "status": "COMPLETED"
}
```

---

## 6. UI/UX Specifications

- **Theme & Aesthetic**: Dark theme — background `#1a1a2e`, primary accent `#e94560`, neon word-glow highlights. Font: monospace / grid-friendly for cell letters.

### 6.1 Lobby Screen

- **Header**: "⚡ Word Grid Blitz" in `#e94560` with a subtle pulsing glow.
- **Player count selector**: segmented pill control — `2 Players | 3 Players | 4 Players`.
- **Two action buttons**:
  - **"⚡ Quick Match"** — `#e94560` filled button.
  - **"🔗 Play with Friends"** — outlined button with `#e94560` border.
- **"Play with Friends" flow** → modal appears with:
  - Room code displayed in large monospace font: `WGB-4K9Z` (copyable with one tap).
  - **"📋 Copy Link"** button (copies full URL).
  - **"📋 Copy Code"** button (copies room code only).
  - Pulsing status line: *"Waiting for players... (1/3 joined)"*.
  - 4 mini slot-preview cards arranged in a row showing each player's color badge + name or "Waiting…" (pulsing dot) or "No Player" + ✕ icon for `INACTIVE_SETUP` slots.

### 6.2 Game Screen Layout

The game screen is a three-column layout (on desktop/tablet) or stacked layout (on mobile):

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: "Word Grid Blitz" | Room Code | Timer          │
├──────────────┬──────────────────────────┬───────────────┤
│  LEFT PANEL  │      CENTER: 10×10 GRID  │  RIGHT PANEL  │
│  (Rank HUD)  │                          │  (Word Log)   │
│              │                          │               │
│  🔴 Rahul 14 │  [A][B][.][Q][U][.][.][.]│  Recent words │
│  🟢 Priya  9 │  [.][.][.][A][R][.][.][.]│  Rahul: QUARTZ│
│  🟡 Anil   7 │  [.][.][.][R][T][Z][.][.]│  +3 pts 🔴   │
│  (inactive)  │  [.][.][.][.][.][.][.][.]│               │
│              │  ...                     │  Priya: CAT   │
│  TURN ORDER  │                          │  +2 pts 🟢   │
│  [P1►][P2][P3│                          │               │
└──────────────┴──────────────────────────┴───────────────┘
│  BOTTOM: FAST PROCEED BAR / TURN TIMER                  │
└─────────────────────────────────────────────────────────┘
```

---

### 6.3 The 10×10 Grid — Visual Design

- **Cell Size**: 52×52dp (desktop), 36×36dp (mobile), with 2dp gap between cells.
- **Cell States**:

| Cell State | Visual |
|---|---|
| Empty | Dark background `#0d0d1a`, subtle `1px` border `#2a2a4a`, dash character centered |
| Occupied (letter placed) | White letter (`#e8e8ff`), mid-dark bg `#1e1e3a`, `1px` border `#3a3a6a` |
| Claimed (word highlighted) | Letter in player color, bg tinted in player color at 20% opacity, `2px` glowing border in player color |
| Active Cursor (player hovering) | Pulsing `#e94560` border `2px`, subtle pink bg tint |
| Just-placed (this turn) | Brief `200ms` flash-in animation, letter scales from 0.7→1.0 |

- **Multi-claim overlap**: A cell that has been included in word paths claimed by different players shows a **split diagonal gradient** of both player colors as the border glow.
- **Grid coordinates**: Tiny row (1–10) and column (A–J) labels along the edges in `#555577` color.

---

### 6.4 Word Drawing UI — The Line Mechanic

Inspired by Boggle/Wordscapes style drag-to-trace:

1. **Initiation**: After placing a letter, the player enters "draw mode" automatically. Cursor changes to a crosshair `✛`.
2. **Tap/Click + Drag**: Player taps a starting cell and drags across adjacent cells to form a path. On touch devices, finger drag highlights cells in sequence.
3. **Live Path Rendering**: As the player traces, a **glowing neon line** (SVG `<polyline>`) is drawn over the grid connecting the centers of selected cells. Line color is the current player's color at 80% opacity with a `4px` blur glow effect.
4. **Cell Highlight on Hover**: Each cell the path passes through gets a bright player-color highlight ring. Non-adjacent cells cannot be added to the path.
5. **Letter Preview Strip**: At the top of the grid (or below on mobile), a horizontal strip shows the letters of the currently forming word in real time: `Q → U → A → R → T → Z`.
6. **Invalid Path Feedback**: If the player tries to include a non-adjacent cell or a cell already in the current path, the cursor shows a `🚫` symbol briefly and the attempt is rejected client-side.
7. **Lift/Release**: When the player lifts their finger / releases mouse, the path is locked and the **Confirmation Popup** appears.
8. **Cancel Draw**: Player can press `Escape` (keyboard) or a `✕ Cancel` button to clear the path and redraw.

---

### 6.5 Confirmation Popup

Appears after the player finishes drawing a word path:

```
┌─────────────────────────────────────┐
│  💬 Confirm Your Word?              │
│                                     │
│      Q – U – A – R – T – Z         │
│           "QUARTZ"                  │
│                                     │
│  ✅ CONFIRM      ✕ CANCEL           │
│                                     │
│  (turn timer: ██████░░░░ 14s left)  │
└─────────────────────────────────────┘
```

- **Word Display**: Large, spaced-out letters showing the word formed.
- **Remaining Time Indicator**: A slim progress bar inside the popup showing remaining turn timer.
- If the player confirms → WebSocket `confirm-word` message sent → server validates → `WORD_RESULT` broadcast.
- If cancelled → player can redraw a different path (within remaining time).
- If turn timer expires while popup is open → popup auto-cancels, turn ends with just the letter placement.

---

### 6.6 Post-Turn 5-Second Fast Proceed Bar

After a turn ends (letter placed + word confirmed or skipped), a **horizontal animated progress bar** appears at the **bottom of the screen**:

```
┌──────────────────────────────────────────────────────┐
│  ████████████████████░░░░░░░░░░  3.2s               │
│                          [ ⏩ Fast Proceed ]          │
└──────────────────────────────────────────────────────┘
```

- Bar fills from right-to-left (or depletes left-to-right) over 5 seconds using a smooth CSS animation.
- Color: `#e94560` accent.
- **"⏩ Fast Proceed"** button on the right side — only the **current player (just-placed)** can click it.
- All other players see the bar but the button is greyed out / hidden for them.
- On click → WebSocket `fast-proceed` message → server broadcasts `FAST_PROCEED` to all → `TURN_ENDED` immediately follows.
- On 5-second expiry → server auto-sends `TURN_ENDED`.

---

### 6.7 Live Rank Dashboard (Left Panel / HUD)

Always visible to all players. Updates in real-time on every `SCORE_UPDATE` event:

```
┌───────────────────────┐
│  📊 SCOREBOARD        │
├───────────────────────┤
│ 🥇 🔴 Rahul      14  │  ← Rank 1 (gold badge)
│ 🥈 🟢 Priya       9  │  ← Rank 2 (silver badge)
│ 🥉 🟡 Anil        7  │  ← Rank 3 (bronze badge)
│  4  ✕ No Player   —  │  ← INACTIVE_SETUP slot (dimmed)
├───────────────────────┤
│  TURN ORDER           │
│  [🔴►][🟢][🟡]       │  ← Active player highlighted
└───────────────────────┘
```

- **Score changes** animate with a brief `+2 🟢` floating number popup that rises and fades over 800ms.
- **Rank reorder animation**: If ranks change, the rows smoothly swap position using CSS transition (300ms ease).
- **Inactive slots** (`INACTIVE_SETUP`) shown at bottom, greyed out with `✕ No Player` and `—` score.
- **OFFLINE slots** shown with 🔴 dimmed indicator and "Offline" label.
- **"Current Turn" indicator**: Small `►` triangle or pulsing dot next to the active player's row.

---

### 6.8 Turn Indicator Strip (Top of Game Area)

A horizontal strip below the header showing all active player avatars in turn order:

```
  🔴 Rahul [►ACTIVE — 22s]  →  🟢 Priya  →  🟡 Anil
```

- Active player's tile has a glowing `#e94560` border and shows countdown in seconds.
- Next player's tile pulses subtly (scale 1.0→1.05, 1s loop).
- Inactive slots are not shown in this strip.

---

### 6.9 Word Log Panel (Right Panel)

A scrollable log of all words claimed during the game, newest first:

```
  QUARTZ  🔴  +3 pts   — Rahul
  CAT     🟢  +2 pts   — Priya
  PINE    🟡  +2 pts   — Anil
  XYZ     🔴  ✕ -1 pt  — Rahul (invalid)
```

- Valid words shown in player color.
- Invalid words shown in red with strikethrough and `✕ -1 pt`.
- Each entry links visually to the highlighted cells on the grid.

---

### 6.10 End-of-Game Modal

```
┌────────────────────────────────────────────┐
│  🏁 Game Over! Grid Complete               │
│                                            │
│  🥇 Rahul (🔴)  ────  14 pts              │
│  🥈 Priya (🟢)  ────   9 pts              │
│  🥉 Anil  (🟡)  ────   7 pts              │
│                                            │
│  Best Word: QUARTZ (🔴 Rahul)  +3 pts     │
│                                            │
│   [🔁 Play Again]   [🔗 Share Room]        │
└────────────────────────────────────────────┘
```

- Animated confetti rains for the 1st place winner.
- "Best Word" shows the highest-scoring word of the game.
- "Play Again" resets the same room with the same players.

---

### 6.11 Reconnection Flow

- Disconnected player slot immediately shows **"Offline" X overlay** to all clients.
- A 60-second reconnect grace timer runs server-side.
- On reconnection within grace window → overlay dismissed, slot returns to `ACTIVE`.
- After grace window → remaining players are prompted: *"[Name] hasn't reconnected. Continue skipping their turns?"* (Yes / End Game vote).

---

## 7. Backend Architecture & Microservice Design

- **Microservice Module**: `backend/games/word-grid-service/`
- **Port**: `8085`
- **Framework**: Spring Boot 3.x, Java 21 LTS
- **State Management**: Redis (primary session state + Pub/Sub), no in-JVM game state.
- **Error Handling**: Throw `GameException` for all domain errors; caught by `GlobalExceptionHandler` returning `ApiResponse<T>`.

### Core Package Structure:
```
word-grid-service/
├── src/main/java/com/officewallahgames/wordgrid/
│   ├── controller/
│   │   ├── WordGridRoomController.java       # POST create, join, GET status
│   │   ├── WordGridQueueController.java      # POST quick-match
│   │   ├── WordGridValidateController.java   # GET validate-word
│   │   └── WordGridWebSocketController.java  # STOMP @MessageMapping handlers
│   ├── service/
│   │   ├── WordGridGameService.java          # Core turn logic, scoring
│   │   ├── WordGridRoomService.java          # Room creation, joining, code gen
│   │   └── WordGridMatchmakingService.java   # Redis queue matching
│   ├── engine/
│   │   ├── WordGridEngine.java               # Letter placement, path validation, adjacency check
│   │   ├── DictionaryService.java            # In-memory HashSet word lookup
│   │   └── TurnTimerService.java             # 30s + 5s timer enforcement via ScheduledExecutorService
│   ├── model/
│   │   ├── WordGridSession.java              # Full session state POJO
│   │   ├── GridCell.java                     # Single cell: row, col, letter, claimedBy
│   │   ├── PlayerScore.java                  # slot, playerId, playerName, score, rank
│   │   ├── WordClaim.java                    # word, cells, slot, valid, pointsAwarded
│   │   ├── SlotState.java                    # Enum: ACTIVE, WAITING, INACTIVE_SETUP, OFFLINE, NOT_AVAILABLE
│   │   └── PlayerSlot.java                   # Enum: P1, P2, P3, P4
│   ├── redis/
│   │   ├── WordGridRedisRepository.java      # Read/write session state
│   │   └── WordGridLuaScripts.java           # Atomic Lua: place-letter, score-update, turn-flip
│   ├── websocket/
│   │   ├── WebSocketConfig.java              # STOMP + SockJS config, /ws/wordgrid
│   │   └── WordGridEventPublisher.java       # Pub/Sub relay via Redis → STOMP broadcast
│   └── exception/
│       ├── GameException.java                # Domain exception with error code + message
│       └── GlobalExceptionHandler.java       # @ControllerAdvice → ApiResponse<Void> error
├── src/main/resources/
│   ├── application.yml
│   └── dictionary/
│       └── sowpods.txt                       # Standard word list (~267k words)
```

### Key Design Decisions:
- **`DictionaryService`** is a `@Component` with `@PostConstruct` that loads `sowpods.txt` from the classpath into a `static final HashSet<String>` at startup. Lookups are O(1).
- **`TurnTimerService`** uses a `ScheduledExecutorService` to schedule a `TURN_TIMEOUT` event 30 seconds after each turn starts. Timer is cancelled if the player acts before expiry. The 5-second fast-proceed window is scheduled similarly.
- **`WordGridEngine.validatePath(List<GridCell> cells)`** checks: (a) all cells are adjacent, (b) no cell repeated, (c) minimum 3 cells, (d) all cells are occupied (have a letter).
- **Room Code Generation**: `WGB-` prefix + 4 random alphanumeric chars (A–Z, 0–9), collision-checked against Redis.

---

## 8. Data Models

### WordGridSession (Redis Hash / JSON)
| Field | Type | Description |
|---|---|---|
| `sessionId` | `String` | e.g. `OWG_WGB_77341` |
| `roomCode` | `String` | e.g. `WGB-4K9Z` |
| `playerCount` | `int` | `2`, `3`, or `4` |
| `players` | `Map<PlayerSlot, String>` | Slot → playerId |
| `playerNames` | `Map<PlayerSlot, String>` | Slot → display name |
| `slotStates` | `Map<PlayerSlot, SlotState>` | Slot → current state |
| `grid` | `GridCell[100]` | Flat array; index = `row * 10 + col` |
| `scores` | `Map<PlayerSlot, Integer>` | Slot → current score |
| `currentTurn` | `PlayerSlot` | Whose turn it is |
| `turnOrder` | `List<PlayerSlot>` | Ordered active slots |
| `status` | `GameStatus` | Current game lifecycle state |
| `claimedWordPaths` | `Set<String>` | Fingerprints of claimed word paths (prevents re-claiming exact same path) |
| `wordLog` | `List<WordClaim>` | All claimed words in sequence |
| `endVotes` | `Set<String>` | PlayerIds who voted to end |
| `turnStartedAt` | `long` | Epoch ms, for 30s timer |
| `fastProceedWindowAt` | `long` | Epoch ms when 5s window started |
| `filledCellCount` | `int` | Count of non-empty cells (0–100); triggers GRID_FULL check |
| `scoreThreshold` | `int` | Default `30`; game ends when any player hits this |
| `createdAt` | `long` | Epoch ms |

---

### GridCell
| Field | Type | Description |
|---|---|---|
| `row` | `int` | 0–9 |
| `col` | `int` | 0–9 |
| `letter` | `Character` | `null` if empty, else `A`–`Z` |
| `placedBy` | `PlayerSlot` | Which player placed this letter |
| `claimedByPaths` | `List<PlayerSlot>` | Which players have included this cell in a claimed word (can be multiple — multi-highlight) |

---

### PlayerScore
| Field | Type | Description |
|---|---|---|
| `slot` | `PlayerSlot` | `P1`–`P4` |
| `playerId` | `String` | Guest/user ID |
| `playerName` | `String` | Display name |
| `score` | `int` | Current score (can go negative) |
| `rank` | `int` | Current rank (1 = highest score) |
| `wordsClaimedCount` | `int` | Total valid words claimed |
| `invalidGuesses` | `int` | Total invalid word guesses |

---

### WordClaim
| Field | Type | Description |
|---|---|---|
| `claimId` | `String` | UUID |
| `slot` | `PlayerSlot` | Who claimed it |
| `word` | `String` | The word string |
| `cells` | `List<CellCoordinate>` | Ordered list of `{row, col}` pairs |
| `valid` | `boolean` | Dictionary result |
| `pointsAwarded` | `int` | `+2`, `+3`, or `-1` |
| `timestamp` | `long` | Epoch ms |

---

### CellCoordinate
| Field | Type | Description |
|---|---|---|
| `row` | `int` | 0–9 |
| `col` | `int` | 0–9 |

---

## 9. Edge Cases & Error Handling

| Edge Case | Behavior |
|---|---|
| Player places letter in an already-occupied cell | `400 BAD_REQUEST` via `GameException("CELL_OCCUPIED")` — *"Cell already has a letter"* |
| Player acts out of turn | `403 FORBIDDEN` via `GameException("NOT_YOUR_TURN")` — *"It's not your turn"* |
| Player draws a word path with non-adjacent cells | `400 BAD_REQUEST` via `GameException("INVALID_WORD_PATH")` — *"Cells are not all adjacent"* |
| Player draws a word shorter than 3 letters | `400 BAD_REQUEST` via `GameException("WORD_TOO_SHORT")` — *"Minimum word length is 3 letters"* |
| Player draws a word using an empty cell | `400 BAD_REQUEST` via `GameException("CELL_EMPTY")` — *"Cannot include empty cells in a word path"* |
| Player attempts to claim a word path already claimed by someone | `409 CONFLICT` via `GameException("WORD_PATH_ALREADY_CLAIMED")` — *"This exact word path was already claimed"* |
| 30-second turn timer expires | Server broadcasts `TURN_TIMEOUT`, advances to next active player. If no letter was placed, the turn is skipped with no board change. |
| All players disconnect simultaneously | Session moves to `ABANDONED` state; TTL set to 20 minutes; no winner declared. |
| A player submits a 30+ char word | Rejected with `400` — `GameException("WORD_TOO_LONG")` — max word path length is 20 cells (hard cap). |
| Player draws a valid word but timer expires before confirm | Confirm popup auto-cancelled; word is not claimed; only the letter placement is kept. |
| Score goes negative | Allowed (minimum is `-99`). Displayed as negative in scoreboard. |
| All players agree to end via vote | `GAME_OVER` broadcast with `reason: "MUTUAL_AGREEMENT"`. |
| Only 1 active player remains (all others offline) | Game paused; remaining player sees modal: *"Waiting for others. End game?"*. Auto-ends after 2 minutes. |
| Room code is expired or not found | `404 NOT_FOUND` — `GameException("ROOM_NOT_FOUND")` — *"Room not found or has expired"* |
| 5th player tries to join any room | `409 CONFLICT` — `GameException("ROOM_FULL")` — *"Room is full"* |
| Quick-match queue timeout (no opponent found in 60s) | Player is dequeued; response event `MATCHMAKING_TIMEOUT` sent via WebSocket; client shows retry option. |
| Two players place letters simultaneously (race) | Redis Lua script ensures only the first atomic write wins; second player receives `GameException("NOT_YOUR_TURN")`. |
| Dictionary file fails to load at startup | Service fails fast with a fatal error log; health check endpoint `/actuator/health` reports `DOWN`. |

---

## 10. Implementation Checklist

### Backend
- [ ] Spring Boot microservice scaffolded under `backend/games/word-grid-service/` on port `8085`
- [ ] `sowpods.txt` word list bundled in `src/main/resources/dictionary/` and loaded into `DictionaryService` `HashSet` at startup
- [ ] `DictionaryService.isValidWord(String)` implemented and unit tested (O(1) lookup)
- [ ] `WordGridEngine` path-validation logic implemented: adjacency check, no-repeat check, min-length 3, all-cells-occupied check
- [ ] Redis session model (`WordGridSession`) serialized as JSON and all CRUD operations in `WordGridRedisRepository` implemented
- [ ] Lua atomic scripts for: letter placement + cell ownership, score update, turn-flip implemented and tested
- [ ] STOMP WebSocket handlers implemented for: `place-letter`, `draw-word`, `confirm-word`, `fast-proceed`, `propose-end`, `vote-end`
- [ ] All broadcast events implemented: `LETTER_PLACED`, `WORD_DRAWN`, `WORD_RESULT`, `SCORE_UPDATE`, `TURN_ENDED`, `FAST_PROCEED`, `TURN_TIMEOUT`, `TURN_SKIPPED`, `PLAYER_JOINED`, `ROOM_READY`, `PLAYER_DISCONNECTED`, `PLAYER_RECONNECTED`, `END_VOTE_PROPOSED`, `GAME_OVER`
- [ ] REST endpoints implemented: `POST /rooms/create`, `POST /rooms/join`, `GET /rooms/{code}/status`, `POST /queue/quick-match`, `GET /validate-word`
- [ ] 30-second turn timer enforced server-side via `TurnTimerService`
- [ ] 5-second fast-proceed window enforced server-side
- [ ] Slot state machine (`ACTIVE`, `WAITING`, `INACTIVE_SETUP`, `OFFLINE`, `NOT_AVAILABLE`) implemented
- [ ] Auto-skip logic for inactive/offline slots (< 200ms) implemented
- [ ] Reconnect grace period (60 seconds) implemented
- [ ] Game-end detection for all 3 conditions: grid full, score threshold reached, mutual agreement vote
- [ ] `GameException` and `GlobalExceptionHandler` wired up; all `ApiResponse<T>` error envelopes verified
- [ ] Room code generation (`WGB-XXXX`) with collision-check implemented
- [ ] Integration tests for 2P, 3P, 4P game sessions (letter placement, word claim, scoring, turn rotation)

### Frontend
- [ ] React + Vite game component created under `frontend/src/games/word-grid/`
- [ ] Route `/games/wordgrid` registered in `frontend/src/App.jsx`
- [ ] Lobby screen: player-count selector, Quick Match button, Play with Friends modal with room code + copy link
- [ ] 10×10 grid rendered with correct cell states (empty, occupied, claimed with player color glow)
- [ ] Letter placement interaction: tap empty cell → letter picker → confirm placement → `place-letter` WebSocket message
- [ ] Word drawing UI: drag-to-trace SVG polyline, cell highlight, live letter preview strip
- [ ] Confirmation popup with word display, confirm/cancel, and remaining-timer sub-bar
- [ ] Post-turn 5-second Fast Proceed bar animation at the bottom of the screen
- [ ] Live Rank Dashboard (Left Panel): real-time score updates, rank badges, animated score-change popups, rank-reorder animation
- [ ] Turn Indicator Strip with active player countdown
- [ ] Word Log Panel (Right Panel) with word entries color-coded by player
- [ ] `INACTIVE_SETUP` X overlay component with "No Player" label (reused from Ludo slot system)
- [ ] `OFFLINE` / `NOT_AVAILABLE` overlay states implemented
- [ ] Game Over modal: ranked podium, best-word callout, confetti animation, Play Again + Share Room buttons
- [ ] End-vote proposal UI: vote modal with countdown for all active players
- [ ] Reconnection overlay and grace-period countdown for offline players
- [ ] STOMP WebSocket client wired up with all event handlers
- [ ] Responsive layout (desktop 3-column, mobile stacked)

### Integration & Deployment
- [ ] `GameMetadata` entry for Word Grid Blitz added to `games-master-service` catalog seed data
- [ ] Service registered in API Gateway routing (`/api/v1/wordgrid/**` → `word-grid-service:8085`)
- [ ] End-to-end tested for 2P, 3P, and 4P sessions (letter placement, word claiming, scoring, game-end conditions all verified)
- [ ] Load test: 500 concurrent sessions, < 100ms turn-event broadcast latency verified

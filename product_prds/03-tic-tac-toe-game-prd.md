# 📋 PRD 03: Tic-Tac-Toe Arena (Real-Time 2-Player PvP Microservice)

---

## 1. Overview & Objective
- **Service Name**: `tic-tac-toe-service`
- **Default Port**: `8083`
- **Primary Goal**: A low-latency, real-time 2-player multiplayer Tic-Tac-Toe microservice designed to support up to **50,000 concurrent active players** via stateless Spring Boot nodes, Redis state management, and STOMP WebSockets.

---

## 2. Gameplay Mechanics & Rules
- **Players**: Exactly 2 players per match (`Player X` and `Player O`).
- **Board**: Standard 3x3 grid (cells 0 to 8).
- **Turn Timer**: 30 seconds per turn. If a player fails to move within 30s, turn or match forfeits.
- **Winning Vectors**:
  - Rows: `[0,1,2]`, `[3,4,5]`, `[6,7,8]`
  - Columns: `[0,3,6]`, `[1,4,7]`, `[2,5,8]`
  - Diagonals: `[0,4,8]`, `[2,4,6]`
- **Draw**: All 9 cells filled with no 3-in-a-row combination.

---

## 3. High-Concurrency Architecture (50,000 Concurrent Players)

1. **Stateless Service Instances**:
   - Zero game session state stored in Java memory heap.
   - Any container/pod can handle WebSocket frames for any game session.
2. **Distributed Redis State (`game:{sessionId}`)**:
   - Stored as Redis Hash or JSON:
     - `board`: `["X", "", "", "", "O", "", "", "", ""]`
     - `playerX`: `userId`
     - `playerO`: `userId`
     - `currentTurn`: `X` or `O`
     - `status`: `MATCHMAKING` | `ACTIVE` | `COMPLETED` | `ABANDONED`
     - `winner`: `X` | `O` | `DRAW` | `null`
   - TTL: Auto-expires 15 minutes after completion or abandonment.
3. **Atomic Move Concurrency (Anti-Race Condition)**:
   - Redis Lua script executes cell check, assignment, and turn flip atomically to prevent simultaneous click race conditions.
4. **WebSocket Sync via Redis Pub/Sub**:
   - STOMP messages dispatched to `/topic/game/{sessionId}` across all pods via Redis Pub/Sub.

---

## 4. API & WebSocket Specifications

### 4.1 REST Matchmaking
- **`POST /api/v1/tictactoe/queue/join`**
  - **Body**: `{ "playerId": "GUEST_482910482", "mode": "QUICK_MATCH" }`
  - **Behavior**: Places player in Redis matchmaking queue. Once 2 players are present, creates session `OWG_TTT_XXXX` and returns session details.
- **`POST /api/v1/tictactoe/room/create`**
  - **Behavior**: Generates a shareable 6-digit room code for friend invites.
- **`POST /api/v1/tictactoe/room/join`**
  - **Body**: `{ "roomCode": "748921", "playerId": "..." }`

### 4.2 STOMP WebSocket Messaging (`/ws/tictactoe`)
- **Subscribe Topic**: `/topic/game/{sessionId}`
- **Send Move Destination**: `/app/game/{sessionId}/move`
  - **Payload**:
    ```json
    {
      "playerId": "GUEST_482910482",
      "position": 4,
      "symbol": "X"
    }
    ```
- **Broadcast Events**:
  - `MATCH_START`: `{ "playerX": "...", "playerO": "...", "startingTurn": "X" }`
  - `MOVE_MADE`: `{ "position": 4, "symbol": "X", "nextTurn": "O", "board": [...] }`
  - `GAME_OVER`: `{ "winner": "X", "winningPattern": [0, 4, 8], "board": [...] }`

---

## 5. UI/UX Specifications
- **Theme**: Dark cyberpunk / modern arcade (`#0f1016` base, neon cyan `#00f2fe` for X, neon magenta `#e94560` for O).
- **Components**:
  - Top bar with Player cards (Player X vs Player O, active turn indicator, 30s countdown timer).
  - Responsive 3x3 interactive grid with smooth neon glow animations.
  - Interactive win streak line animation.
  - Game Over modal with "Rematch" and "Return to Lobby" buttons with confetti effect for the winner.

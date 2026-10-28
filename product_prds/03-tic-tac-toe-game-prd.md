# 📋 PRD 03: Tic-Tac-Toe Arena (Real-Time 2-Player PvP Microservice)

---

## 1. Overview & Objective
- **Service Name**: `tic-tac-toe-service`
- **Default Port**: `8083`
- **Primary Goal**: A low-latency, real-time 2-player multiplayer Tic-Tac-Toe microservice designed to support up to **50,000 concurrent active players** via stateless Spring Boot nodes, Redis state management, and STOMP WebSockets. Features both **Random Matchmaking** and **Private Custom Room Creation with Shareable Link**.

---

## 2. Gameplay Mechanics & Rules
- **Players**: Exactly 2 players per match (`Player X` and `Player O`).
- **Board**: Standard 3x3 grid (cells 0 to 8).
- **Turn Timer**: 30 seconds per turn. If a player fails to move within 30s, the turn or match forfeits.
- **Winning Vectors**:
  - Rows: `[0,1,2]`, `[3,4,5]`, `[6,7,8]`
  - Columns: `[0,3,6]`, `[1,4,7]`, `[2,5,8]`
  - Diagonals: `[0,4,8]`, `[2,4,6]`
- **Draw**: All 9 cells filled with no 3-in-a-row combination.

---

## 3. Room Creation & Shareable Link Architecture

Players can play in two modes:
1. **Quick Match (Random Matchmaking Queue)**: Enqueues player in Redis and matches them with the next waiting opponent.
2. **Private Room (Invite Friend via Shareable Link)**:
   - A player clicks **"Create Private Room"**.
   - System generates a unique 6-character alphanumeric room code (e.g. `TTT-7X9B`).
   - Generates a shareable URL: `https://officewallahgames.com/games/tictactoe?room=TTT-7X9B`.
   - Host is registered as `Player X` waiting in lobby state.
   - Host can click "Copy Link" or "Copy Code".
   - Opponent opens the link or enters the code -> auto-joins as `Player O`.
   - As soon as Player O connects, WebSocket broadcasts `ROOM_READY` and the match starts immediately.

### Room State Transition in Redis (`room:{roomCode}`):
```
[HOST CREATES] ──> WAITING_FOR_OPPONENT (TTL: 10 mins)
                          │
                   [FRIEND JOINS LINK]
                          │
                          ▼
                       ACTIVE (Playing Turn X/O)
                          │
                     [GAME OVER]
                          │
                          ▼
            COMPLETED (TTL: 15 mins for rematch)
```

---

## 4. High-Concurrency Architecture (50,000 Concurrent Players)

1. **Stateless Service Instances**:
   - Zero game session state stored in Java memory heap.
   - Any container/pod can handle WebSocket frames for any game session.
2. **Distributed Redis State (`game:{sessionId}`)**:
   - Stored as Redis Hash or JSON:
     - `board`: `["X", "", "", "", "O", "", "", "", ""]`
     - `playerX`: `userId`
     - `playerO`: `userId`
     - `currentTurn`: `X` or `O`
     - `status`: `WAITING_FOR_OPPONENT` | `ACTIVE` | `COMPLETED` | `ABANDONED`
     - `winner`: `X` | `O` | `DRAW` | `null`
   - TTL: Auto-expires 15 minutes after completion or abandonment.
3. **Atomic Move Concurrency (Anti-Race Condition)**:
   - Redis Lua script executes cell check, assignment, and turn flip atomically to prevent simultaneous click race conditions.
4. **WebSocket Sync via Redis Pub/Sub**:
   - STOMP messages dispatched to `/topic/game/{sessionId}` across all pods via Redis Pub/Sub.

---

## 5. API & WebSocket Specifications

### 5.1 REST Room Management & Matchmaking

- **`POST /api/v1/tictactoe/rooms/create`**
  - **Body**: `{ "playerId": "GUEST_482910482", "playerName": "Guest 482910482" }`
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "sessionId": "OWG_TTT_99812",
        "roomCode": "TTT-7X9B",
        "shareableUrl": "/games/tictactoe?room=TTT-7X9B",
        "assignedSymbol": "X",
        "status": "WAITING_FOR_OPPONENT"
      },
      "message": "Private room created successfully"
    }
    ```

- **`POST /api/v1/tictactoe/rooms/join`**
  - **Body**: `{ "roomCode": "TTT-7X9B", "playerId": "GUEST_991820121", "playerName": "Alex" }`
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "sessionId": "OWG_TTT_99812",
        "roomCode": "TTT-7X9B",
        "assignedSymbol": "O",
        "status": "ACTIVE",
        "playerX": "GUEST_482910482",
        "playerO": "GUEST_991820121",
        "currentTurn": "X"
      },
      "message": "Joined room successfully"
    }
    ```

- **`GET /api/v1/tictactoe/rooms/{roomCode}/status`**
  - **Description**: Lightweight poll/verification check when a user visits `?room=CODE` before opening WebSocket.

- **`POST /api/v1/tictactoe/queue/quick-match`**
  - **Body**: `{ "playerId": "GUEST_482910482" }`
  - **Behavior**: Enqueues in Redis ZSET for random opponent pairing.

---

### 5.2 STOMP WebSocket Messaging (`/ws/tictactoe`)

- **Connection**: `new SockJS('/ws/tictactoe')` + `Stomp.over(...)`
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
  - `PLAYER_JOINED`: `{ "playerO": "Alex", "status": "ACTIVE" }`
  - `MOVE_MADE`: `{ "position": 4, "symbol": "X", "nextTurn": "O", "board": [...] }`
  - `GAME_OVER`: `{ "winner": "X", "winningPattern": [0, 4, 8], "board": [...] }`
  - `REMATCH_REQUESTED`: `{ "requestedBy": "X" }`

---

## 6. UI/UX Specifications
- **Lobby View**:
  - Choice between "⚡ Quick Match" and "🔗 Play with Friend".
  - If "Play with Friend" is clicked -> Opens modal displaying the 6-character code, a one-click "📋 Copy Link" button, and a real-time pulse animation: *"Waiting for friend to join..."*.
- **Game Screen**:
  - Header: Player X vs Player O, Turn Indicator, 30s Turn Clock.
  - 3x3 Neon Grid: Smooth hover states, glowing cyan for `X`, neon magenta for `O`.
  - Win Line: CSS animated strike-through over the winning 3 cells.
  - End Modal: Confetti animation for the winner, "Play Again" and "Copy Room Link" buttons.

# 🎮 PRD Template: [Game / Feature Name]

---

## 1. Overview & Objective
- **Game Name**: 
- **Tagline**: 
- **Target Audience**: Casual office workers / quick sessions.
- **Estimated Play Time**: 2-5 minutes per round.

---

## 2. Gameplay Mechanics & Business Rules
- **Game Type**: (Single player / Multi-player / Turn-based / Real-time)
- **Winning / Losing Criteria**:
- **Scoring System**:
- **Game States**: (LOBBY, PLAYING, PAUSED, GAME_OVER)

---

## 3. UI/UX Design Specifications
- **Theme & Aesthetic**: Dark theme consistent with OfficeWallahGames (#1a1a2e & #e94560).
- **Screens / Views**:
  - Start / Instructions Screen
  - Main Game Board / Canvas
  - Scoreboard / HUD
  - Game Over & Restart Modal
- **Controls**: (Keyboard / Mouse / Touch)
- **Sound & Animations**: (Optional / Low-overhead)

---

## 4. Backend Architecture & Service Rules
- **Microservice Module**: `backend/games/<game-service>/`
- **Port Assignment**: `808x`
- **Core Entities & Models**:
- **State Management**: (In-memory / Redis / Database)
- **Error Handling**: Follow `common/exception/GameException`.

---

## 5. API Contracts
- **Base Route**: `/api/v1/<game-name>`
- **Endpoints**:
  - `POST /start` -> Start a new game session
  - `POST /move` or `/action` -> Process user input
  - `GET /state` -> Get current session state
  - `POST /end` -> Conclude game and record score

---

## 6. Implementation Checklist
- [ ] Backend Service created under `backend/games/<game-service>`
- [ ] Backend tests passing
- [ ] Frontend UI created under `frontend/src/games/<game-name>`
- [ ] Navigation and route registered in `frontend/src/App.jsx`
- [ ] Integrated end-to-end and verified

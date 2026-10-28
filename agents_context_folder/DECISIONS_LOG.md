# Architecture Decision Records (ADR)

## ADR-001: Monorepo Structure
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** Keep backend and frontend in the same repository under separate top-level folders.
- **Reason:** Simplifies development workflow. Can be split into separate repos later without code changes.

## ADR-002: Microservices Per Game
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** Each game is a separate Spring Boot module within the Maven multi-module project.
- **Reason:** Allows independent deployment, scaling, and development of each game.

## ADR-003: API Gateway Deferred
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** No API Gateway for now. Will add Spring Cloud Gateway later.
- **Reason:** Keep initial setup simple. Design APIs to be gateway-compatible from day one.

## ADR-004: Ludo — 2P/3P/4P Shared Board with Inactive Slot X Overlay
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** The Ludo board layout (4 color slots: Red, Green, Yellow, Blue) is fixed and identical across all player count modes (2P, 3P, 4P). Unused color slots are not hidden — they always render on the board and communicate their state via an "X" overlay icon system (state-aware labels: "No Player", "Offline", "Unavailable").
- **Reason:** Hiding slots entirely would cause layout reflow and confuse players about how many slots the game has. The X overlay approach is more informative and visually consistent.
- **Default Inactive Slot Assignments:** 2P → Blue + Green inactive; 3P → Blue inactive; 4P → none.
- **Service:** `ludo-service` on port `8084`. PRD: `product_prds/04-ludo-game-prd.md`.

## ADR-005: Word Grid Blitz — 2-Phase Turn & Dictionary Validation
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** Each player turn is split into two phases: (1) place one letter, (2) optionally draw a word line. Dictionary validation is server-side using an in-memory HashSet (~267k words, O(1) lookup). Scoring: +2 correct, +3 for 7+ letters, -1 wrong guess. After a turn a 5-second "Fast Proceed" window lets the player skip immediately.
- **Service:** `word-grid-service` on port `8085`. PRD: `product_prds/05-word-grid-blitz-prd.md`.

## ADR-006: Connect Drop — Atomic Lua Disc Drop for Race Condition Prevention
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** Classic Connect Four (7×6 board), 2 players only. Disc drop + gravity + win-check executed as a single atomic Redis Lua script to prevent race conditions from simultaneous click events. Turn auto-drop on 20s timeout via `TurnTimeoutScheduler`.
- **Service:** `connect-drop-service` on port `8086`. PRD: `product_prds/06-connect-drop-prd.md`.

## ADR-007: Speed Type Duel — WPM×Accuracy Scoring & 500ms Progress Throttle
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** All players type the same passage simultaneously (2–4 players). Final Score = WPM × (Accuracy/100). Progress events throttled to 500ms or per-word to avoid WebSocket flooding. Anti-cheat flags scores >200 WPM as FLAGGED without disrupting other players. Game timer: 90 seconds server-enforced.
- **Service:** `speed-type-service` on port `8087`. PRD: `product_prds/07-speed-type-duel-prd.md`.

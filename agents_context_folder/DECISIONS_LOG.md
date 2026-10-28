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

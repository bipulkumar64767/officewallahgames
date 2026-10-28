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

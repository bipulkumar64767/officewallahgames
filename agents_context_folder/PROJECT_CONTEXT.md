# 🎮 OfficeWallahGames — Project Context

> **This file provides full context about the project for agent memory and faster decision-making.**

---

## Project Overview

**Name:** OfficeWallahGames  
**Type:** Online gaming platform with multiple browser-based games  
**Repository:** https://github.com/bipulkumar64767/officewallahgames  
**Owner:** Bipul Kumar (bipulkumar64767)

### What is this project?
An online website that hosts **multiple online games** — each game is a self-contained module that can be independently developed, deployed, and scaled.

---

## Tech Stack

| Layer       | Technology               | Version    |
|-------------|--------------------------|------------|
| Backend     | Spring Boot (Java)       | Java 21 LTS, Spring Boot 3.x |
| Frontend    | React (Vite)             | React 18+, Vite 5+ |
| Build Tool  | Maven (Backend), npm (Frontend) | Latest stable |
| VCS         | Git + GitHub             | — |
| Architecture| Microservices            | One service per game |

---

## Project Structure

```
officewallahgames/
├── agent_rule_folder/          # Agent rules — read before any task
│   └── RULES.md
├── agents_context_folder/      # Project context & agent memory
│   ├── PROJECT_CONTEXT.md      # (this file)
│   └── DECISIONS_LOG.md        # Architecture decisions record
├── backend/                    # All backend code (Spring Boot)
│   ├── pom.xml                 # Parent POM (multi-module Maven)
│   ├── common/                 # Shared utilities, DTOs, configs
│   └── games/                  # Individual game microservices
│       ├── game-one/
│       ├── game-two/
│       └── ...
├── frontend/                   # All frontend code (React + Vite)
│   ├── package.json
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── games/              # Per-game UI modules
│   │   ├── utils/              # Shared utilities
│   │   └── App.jsx             # Root app with routing
│   └── ...
├── .gitignore
└── README.md
```

---

## Architecture Principles

1. **Separation of Concerns** — Backend and frontend are fully decoupled. They can be deployed separately.
2. **Microservices** — Each game is its own Spring Boot module. Can be extracted to a separate repo/server later.
3. **Independently Deployable** — Any game microservice can be deployed on any server independently.
4. **API-First** — Backend exposes REST APIs. Frontend consumes them. No tight coupling.
5. **Gateway-Ready** — APIs are designed so an API Gateway (Spring Cloud Gateway) can be added later.

---

## Current Games (Planned)
> *To be finalized — this section will be updated as games are decided.*

| # | Game Name | Status | Backend Module | Frontend Module |
|---|-----------|--------|----------------|-----------------|
| 1 | TBD       | Planning | `backend/games/game-one/` | `frontend/src/games/game-one/` |
| 2 | TBD       | Planning | `backend/games/game-two/` | `frontend/src/games/game-two/` |

---

## Key Decisions Log

| Date       | Decision | Reason |
|------------|----------|--------|
| 2026-10-29 | Monorepo with backend/ and frontend/ separation | Easy to split later if needed |
| 2026-10-29 | Java 21 LTS | Latest stable LTS version |
| 2026-10-29 | Vite over CRA for React | Faster build, modern tooling |
| 2026-10-29 | Maven multi-module for backend | Each game as a sub-module |
| 2026-10-29 | Microservices per game | Independent deployment capability |

---

## API Conventions
- Base URL pattern: `/api/v1/<game-name>/...`
- All responses use standard envelope: `{ "status": "success/error", "data": {...}, "message": "..." }`
- Error responses include error code and message.

---

## Environment Setup Requirements
- **Java 21** installed and `JAVA_HOME` set
- **Maven 3.9+** installed
- **Node.js 18+** and **npm 9+** installed
- **Git** configured with bipulkumar64767 credentials

---

*Last Updated: 2026-10-29*

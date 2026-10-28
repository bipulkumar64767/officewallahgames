# 🎮 OfficeWallahGames — Project Context

> **This file provides full context about the project for agent memory and faster decision-making.**

---

## Project Overview

**Name:** OfficeWallahGames  
**Type:** Online gaming platform hosting multiple browser-based games  
**Repository:** https://github.com/bipulkumar64767/officewallahgames  
**Owner:** Bipul Kumar (bipulkumar64767)

### What is this project?
An online platform hosting **multiple online games** designed for quick and engaging gameplay. Each game is engineered as a decoupled microservice on the backend and an isolated feature module on the frontend, enabling independent development, deployment, scaling, and server allocation.

---

## Complete Project Folder Structure & Behaviors

```
officewallahgames/
├── agent_rule_folder/          # Guidelines & protocols agents must read before acting
│   └── RULES.md
├── agents_context_folder/      # System memory, ADRs, and persistent project context
│   ├── PROJECT_CONTEXT.md
│   └── DECISIONS_LOG.md
├── product_prds/               # Official PRDs for each game (UI design + Backend specs)
│   ├── README.md
│   └── PRD_TEMPLATE.md
├── rough-discussion/           # Scratchpad for active discussions, ideation & file dumpyard
│   └── README.md
├── backend/                    # All Spring Boot microservices (Java 21 LTS)
│   ├── pom.xml                 # Parent Maven POM
│   ├── README.md
│   ├── common/                 # Shared DTOs (ApiResponse), exceptions, and utils
│   └── games/                  # Independent microservices per game
└── frontend/                   # All React UI code (Vite + React Router)
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── components/         # Shared UI components (Navbar, Modal, etc.)
        ├── pages/              # Top-level pages (Home, Games directory)
        ├── games/              # Individual game UI implementations
        ├── services/           # Centralized API service client
        └── utils/              # Helper functions
```

---

## Folder-Wise Responsibilities & Boundaries

| Folder | What It Contains | How It Behaves / Rules |
|--------|------------------|------------------------|
| **`agent_rule_folder/`** | Agent workflows, rules & validation protocols | Read-first before writing code. Enforces task decomposition & parallel sub-agents. |
| **`agents_context_folder/`** | Project memory, tech stack info & ADR logs | Consulted for architectural clarity and domain context. |
| **`product_prds/`** | Approved PRDs with UI designs & backend architecture | Spec required prior to any game implementation. |
| **`rough-discussion/`** | Brainstorming notes, draft chats, test dumps | Free-form scratch workspace; non-blocking for production. |
| **`backend/`** | Spring Boot 3.4.x, Java 21 LTS, multi-module Maven | Only backend code lives here. Each game is a microservice. |
| **`frontend/`** | React 18+, Vite, React Router DOM | Only UI code lives here. Decoupled and independently deployable. |

---

## Operational Execution Principles
1. **Always Decompose Breakable Tasks**: Whenever work can be partitioned, split it immediately.
2. **Parallel Sub-Agents for Maximum Speed**: Run backend, frontend, documentation, and testing tasks concurrently using parallel sub-agents to deliver work as fast as possible.
3. **Continuous Integration & Clean Commits**: Validate builds and keep git history clean and up to date.
4. **Local Commits vs. Remote Push**: Commit locally anytime as work progresses, but **ALWAYS ask user permission before pushing to remote** (or only push when explicitly instructed).

---

## Tech Stack Summary

| Layer       | Technology               | Version / Details |
|-------------|--------------------------|-------------------|
| Backend     | Spring Boot (Java)       | Java 21 LTS, Spring Boot 3.4.1 |
| Frontend    | React + Vite             | React 18+, Vite 8+, React Router DOM |
| Build Tool  | Maven (Backend), npm (Frontend) | Standard tooling |
| Versioning  | Git & GitHub             | bipulkumar64767 |
| Design      | Microservices            | One independent service per game |

---

## Games Roadmap

| # | Game | Service Name | Port | PRD | Status |
|---|------|-------------|------|-----|--------|
| 01 | Games Master Catalog | `games-master-service` | 8081 | `01-games-master-service-prd.md` | ✅ Live |
| 02 | User Management | `user-management-service` | 8082 | `02-user-management-service-prd.md` | ✅ Live |
| 03 | Tic-Tac-Toe Arena | `tic-tac-toe-service` | 8083 | `03-tic-tac-toe-game-prd.md` | 🟡 In Progress |
| 04 | Ludo Royale | `ludo-service` | 8084 | `04-ludo-game-prd.md` | 📋 PRD Ready |
| 05 | Word Grid Blitz | `word-grid-service` | 8085 | `05-word-grid-blitz-prd.md` | 📋 PRD Ready |
| 06 | Connect Drop | `connect-drop-service` | 8086 | `06-connect-drop-prd.md` | 📋 PRD Ready |
| 07 | Speed Type Duel | `speed-type-service` | 8087 | `07-speed-type-duel-prd.md` | 📋 PRD Ready |

*Last Updated: 2026-10-29*

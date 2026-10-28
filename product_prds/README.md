# 📋 Product PRDs (Product Requirements Documents)

This folder contains the official Product Requirement Documents (PRDs) for every game and major feature built on **OfficeWallahGames**.

---

## 🎯 Purpose & Behavior
- **Single Source of Truth**: Every game to be developed MUST have an approved PRD here before writing implementation code.
- **Structured Specifications**: Each PRD covers:
  1. Game Overview & Core Objective
  2. Gameplay Mechanics & Rules
  3. UI/UX Design & Wireframe / Screen Flow
  4. Backend Architecture, State Machine & Microservice Design
  5. API Contracts (REST / WebSocket endpoints)
  6. Database Schema / Data Models (if applicable)
  7. Edge Cases & Error Handling

---

## 📁 Naming Convention
- Name files by game or feature: `<game-name>-prd.md` (e.g. `tic-tac-toe-prd.md`, `chess-prd.md`, `snake-prd.md`).
- A template is provided below in `PRD_TEMPLATE.md`.

---

## 🔄 Lifecycle of a PRD
1. **Ideation & Brainstorming** → Carried out in `rough-discussion/`.
2. **Drafting PRD** → Once aligned, formalize into `product_prds/<game-name>-prd.md`.
3. **Approval** → Confirmed by the user.
4. **Implementation** → Agents implement according to backend and frontend specifications in the PRD.

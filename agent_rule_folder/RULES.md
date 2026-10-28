# 🎮 OfficeWallahGames — Agent Rules & Regulations

> **These rules MUST be read and followed BEFORE implementing, editing, or modifying anything in this project.**

---

## 1. Directory Structure & Folder-Wise Rules

The project is structured into distinct, isolated folders. Every agent must strictly observe what each folder contains and how it behaves:

### 1.1 `agent_rule_folder/`
- **Purpose**: Defines behavioral rules, coding standards, task handling guidelines, and workflow protocols for agents.
- **Rules**:
  - Must be read before starting any execution or modification.
  - Only update when new guidelines, conventions, or architectural workflows are established.
  - Never place application source code here.

### 1.2 `agents_context_folder/`
- **Purpose**: Acts as the project's long-term memory, holding system context, tech stack info, and Architecture Decision Records (ADRs).
- **Rules**:
  - Always consult `PROJECT_CONTEXT.md` before solving complex architectural or logic problems.
  - Update `DECISIONS_LOG.md` when any major design or tech choice is made.
  - Keeps context updated so future agents have zero ambiguity.

### 1.3 `product_prds/`
- **Purpose**: Formal Product Requirements Documents (PRDs) for each game and feature.
- **Rules**:
  - Every game or major feature MUST have an approved PRD in this folder before writing backend or frontend code.
  - Contains detailed UI design specs, backend rules, microservice architecture, and API contracts.
  - Must follow `PRD_TEMPLATE.md`.
  - Serves as the ultimate specification against which deliverables are evaluated.

### 1.4 `rough-discussion/`
- **Purpose**: Scratchpad, active chat discussion notes, brainstorming drafts, and file dumpyard.
- **Rules**:
  - Use freely to dump raw ideas, prompt contexts, temporary notes, or API test payloads.
  - Once discussion is finalized, distill the outcome into a formal PRD in `product_prds/`.
  - Non-blocking: files here do not affect production builds.

### 1.5 `backend/`
- **Purpose**: The entire backend ecosystem using Spring Boot (Java 21 LTS) in a microservices multi-module architecture.
- **Rules**:
  - All Java, Spring Boot, Maven, and backend microservice code MUST remain inside this folder only.
  - Contains `common/` for shared DTOs/exceptions and `games/` for isolated game microservices.
  - Never place frontend assets or UI code here.
  - Each microservice must be standalone and independently deployable.

### 1.6 `frontend/`
- **Purpose**: The complete user interface using React + Vite.
- **Rules**:
  - All UI components, pages, styles, routing, and client assets MUST remain inside this folder only.
  - Follow feature-based separation (`src/games/<game-name>/`).
  - Centralized API requests using `src/services/api.js`.
  - Can be built and hosted independently as a static web application.

---

## 2. Task Picking & Execution Protocol

### 2.1 Before Starting Any Task
1. Read `agent_rule_folder/RULES.md` (this file).
2. Check `agents_context_folder/PROJECT_CONTEXT.md` for project status and architecture context.
3. If implementing a game or feature, verify its PRD exists in `product_prds/`. If not, discuss and draft in `rough-discussion/` first.
4. Target only the designated module (`backend/` or `frontend/`). Do not mix concerns.

### 2.2 Task Prioritization
1. **Critical** — Security vulnerabilities, production crashes, broken builds.
2. **High** — Core game engine logic, state machines, API contracts.
3. **Medium** — New games, UI screens, animations, score persistence.
4. **Low** — Minor refactoring, documentation, style polish.

### 2.3 Task Decomposition & Parallel Sub-Agent Protocol
- **Breakable Tasks**: If a task can be divided into independent parts (e.g., Backend APIs vs. Frontend UI, multiple games, service logic vs. UI integration), **ALWAYS break it down immediately**.
- **Parallel Sub-Agents**: Deploy parallel sub-agents to work on decomposed tasks simultaneously to achieve maximum execution speed and turnaround time.
- **Coordination**: The orchestrating agent coordinates, integrates outputs from all sub-agents, verifies the build, and performs the final git commit.

---

## 3. Code Standards & Architecture Guidelines

### 3.1 Backend (Spring Boot / Java 21)
- Java 21 LTS features (records, sealed interfaces, pattern matching).
- All API endpoints must return the standardized `ApiResponse<T>` envelope.
- Throw custom `GameException` for domain errors; caught by `GlobalExceptionHandler`.
- Independent service configurations (prepared for future API Gateway / Eureka integration).

### 3.2 Frontend (React + Vite)
- Functional components, hooks, clean modular styles.
- Routing through `react-router-dom`.
- Error boundaries and loading states for all asynchronous operations.

---

## 4. Git & Push Protocol (STRICT)
- **Local Commits**: You CAN commit to the local Git repository freely to keep track of work and checkpoints. Use conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Remote Push**: **NEVER push code to the remote repository (`origin/main` or any remote branch) without explicit permission.** Every single time, ask the user first before pushing, or wait until the user explicitly requests to push.
- **Verification**: Always verify build and test status locally before staging and committing.

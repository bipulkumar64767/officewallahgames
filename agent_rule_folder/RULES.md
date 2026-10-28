# 🎮 OfficeWallahGames — Agent Rules & Regulations

> **These rules MUST be read and followed BEFORE implementing, editing, or modifying anything in this project.**

---

## 1. Task Picking Rules

### 1.1 Before Starting Any Task
- [ ] Read `agents_context_folder/PROJECT_CONTEXT.md` for full project understanding.
- [ ] Read this file (`agent_rule_folder/RULES.md`) completely.
- [ ] Identify which module (backend/frontend) the task belongs to.
- [ ] If the task spans both backend and frontend, break it into sub-tasks per module.

### 1.2 Task Prioritization
1. **Critical** — Security fixes, production bugs, data integrity issues.
2. **High** — Core game logic, API contracts, authentication.
3. **Medium** — New game features, UI enhancements, testing.
4. **Low** — Documentation, refactoring, code style.

### 1.3 Scope Boundaries
- **Backend changes** → Only touch files inside `backend/` folder.
- **Frontend changes** → Only touch files inside `frontend/` folder.
- **Never mix** backend and frontend changes in a single commit unless it's an API contract update that requires both.
- **Agent rule/context files** → Update when project structure or conventions change.

---

## 2. Code Quality Rules

### 2.1 Backend (Spring Boot / Java 21)
- Java version: **21 LTS** (use modern features: records, sealed classes, pattern matching).
- Build tool: **Maven**.
- Follow **microservices architecture** — each game is its own module/service.
- Each microservice MUST be independently deployable.
- Use `@RestController` for APIs, proper DTOs, service layer separation.
- All APIs must return proper HTTP status codes and error responses.
- Write unit tests for service layer at minimum.

### 2.2 Frontend (React)
- Use **Vite** as the build tool (fast, modern).
- Use **functional components** with hooks only (no class components).
- Folder structure: feature-based (each game gets its own folder).
- Use **CSS Modules** or **Tailwind CSS** for styling.
- All API calls must go through a centralized API service layer.

### 2.3 Git Conventions
- **Branch naming**: `feature/<module>/<short-description>`, `fix/<module>/<short-description>`, `chore/<description>`.
- **Commit messages**: Use conventional commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Always commit backend and frontend changes separately when possible.
- Never push directly to `main` — use feature branches and PRs (when team grows).

---

## 3. Architecture Rules

### 3.1 Microservices (Backend)
- Each game microservice has its own:
  - Controller layer (`controller/`)
  - Service layer (`service/`)
  - Model/Entity layer (`model/`)
  - Repository layer (`repository/`)
  - DTO layer (`dto/`)
  - Configuration (`config/`)
- Shared/common code goes in a `common/` module.
- API Gateway will be added later — design APIs to be gateway-ready.

### 3.2 Frontend
- Each game has its own folder under `src/games/<game-name>/`.
- Shared components go in `src/components/`.
- Shared utilities go in `src/utils/`.
- Routing is centralized in `src/App.jsx`.

### 3.3 Communication
- Backend ↔ Frontend: **REST APIs** (JSON).
- Microservice ↔ Microservice: **REST** for now (can migrate to message queues later).

---

## 4. Deployment Readiness Rules
- Each microservice MUST be able to run standalone.
- Docker support will be added later — keep configurations externalized.
- Use **environment variables** or **application.yml profiles** for configuration.
- Frontend must be buildable as a static bundle (`npm run build`).

---

## 5. File Modification Checklist
Before modifying ANY file, the agent MUST:
1. ✅ Understand the current state of the file.
2. ✅ Identify the impact on other modules.
3. ✅ Ensure backward compatibility (don't break existing APIs).
4. ✅ Update relevant documentation if behavior changes.
5. ✅ Run/suggest running tests after changes.

---

*Last Updated: 2026-10-29*

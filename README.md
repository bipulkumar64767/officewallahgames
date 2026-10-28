# 🎮 OfficeWallahGames

An online gaming platform hosting multiple browser-based games. Built with a microservices architecture for independent development and deployment of each game.

## 🏗️ Project Structure

```
officewallahgames/
├── agent_rule_folder/          # Agent rules — read BEFORE any task
├── agents_context_folder/      # Project context & agent memory
├── backend/                    # Spring Boot microservices (Java 21)
├── frontend/                   # React UI (Vite)
├── .gitignore
└── README.md
```

## 🛠️ Tech Stack

| Layer    | Technology         | Version        |
|----------|--------------------|----------------|
| Backend  | Spring Boot        | 3.4.x, Java 21 |
| Frontend | React + Vite       | React 18+      |
| Build    | Maven / npm        | —              |
| Arch     | Microservices      | Per-game modules|

## 🚀 Getting Started

### Backend
```bash
cd backend
mvn clean install
mvn spring-boot:run  # (from a specific game module)
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📋 For AI Agents
- **Read `agent_rule_folder/RULES.md`** before making any changes.
- **Read `agents_context_folder/PROJECT_CONTEXT.md`** for full project context.

## 📄 License
Private — All rights reserved.

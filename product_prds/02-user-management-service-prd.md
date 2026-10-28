# 📋 PRD 02: User Management Service (UMS) - Lightweight Identity & Guest Engine

---

## 1. Overview & Objective
- **Service Name**: `user-management-service`
- **Default Port**: `8082`
- **Primary Goal**: Provides frictionless, instant onboarding for players. Assigns unique 64-bit Snowflake-based `GUEST_XXXXXXXXX` IDs for unauthenticated visitors, while offering a mock login gateway that issues a fixed token to unlock player sessions.

---

## 2. Core Functional Requirements

### 2.1 Guest User Auto-Provisioning
- When a user lands on the site without an active session:
  - Call `POST /api/v1/auth/guest`
  - Returns a unique identifier formatted as: `GUEST_<snowflakeId>` (e.g., `GUEST_729481923`).
  - Generates a lightweight guest session token persisted in client `localStorage`.

### 2.2 Simple/Mock User Login
- A modal/form on the UI accepting:
  - `username`: Any string
  - `password`: Any string
- Authentication check:
  - Permissive mock for now (accepts any credentials).
  - Returns a standardized payload with `token: "owg-fixed-auth-token-2026"`, `username`, and `avatarUrl`.
  - Upgradable to full Spring Security + JWT + OAuth2 later without changing client API contracts.

---

## 3. API Contracts

- **`POST /api/v1/auth/guest`**
  - **Description**: Creates or returns a guest player session.
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "userId": "GUEST_482910482",
        "displayName": "Guest 482910482",
        "token": "guest-token-482910482",
        "isGuest": true
      },
      "message": "Guest session initialized"
    }
    ```

- **`POST /api/v1/auth/login`**
  - **Description**: Mock login with any username/password.
  - **Request**:
    ```json
    {
      "username": "alex_boss",
      "password": "anyPassword123"
    }
    ```
  - **Response**:
    ```json
    {
      "status": "SUCCESS",
      "data": {
        "userId": "USR_992182",
        "displayName": "alex_boss",
        "token": "owg-fixed-auth-token-2026",
        "isGuest": false
      },
      "message": "Login successful"
    }
    ```

- **`GET /api/v1/auth/me`**
  - **Header**: `Authorization: Bearer <token>`
  - **Description**: Validates session and returns current player details.

---

## 4. Architecture & Technical Details
- **Module Path**: `backend/games/user-service/`
- **Snowflake ID Generator**: High-performance Twitter-style Snowflake worker (Timestamp + WorkerId + Sequence) ensuring collision-free guest IDs across distributed nodes.
- **Client Handling**: Stored in React context (`AuthContext.jsx`) and browser `localStorage`.

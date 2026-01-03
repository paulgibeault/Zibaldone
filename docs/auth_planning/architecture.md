# Authentication & Encryption Architecture (Family Server)

## 1. Executive Summary
This document outlines the architectural approach for a **Passwordless Family Server**. It supports multiple independent users (e.g., family members) on a single self-hosted instance. Each user manages their own set of devices via Token-Based Pairing.

## 2. Core Principles
*   **Multi-Tenancy**: The system supports multiple distinct "User Spaces".
*   **Data Isolation**: Data is explicitly owned by a `User`. Users cannot see each other's data by default.
*   **Passwordless**: All access is via high-entropy Device Tokens.
*   **Admin Stewardship**: An "Admin User" (typically the server owner) can invite new Users (Family Members).

## 3. High-Level Architecture

### Block Diagram
```mermaid
graph TD
    Client[Client Device] -->|1. Request + Token| Gateway[FastAPI Gateway]
    Gateway -->|2. Resolve Session & User| AuthModule[Auth Module]
    
    AuthModule -->|User A| LogicA[Business Logic (User A Scope)]
    AuthModule -->|User B| LogicB[Business Logic (User B Scope)]
    
    LogicA -->|Query owner_id=A| Database[(SQLite)]
    LogicB -->|Query owner_id=B| Database
```

### 3.1 Entities and Relationships
*   **User**: Represents a human (e.g., "Dad", "Mom"). Owns Data.
*   **Session (Device)**: Represents a physical device (e.g., "Dad's Phone"). Belongs to a User.
*   **Token**: The secret key held by a Session.

### 3.2 Authentication & Authorization
1.  **Authentication**: "Who is this?" -> Resolved via Bearer Token to a `Session` and then to a `User`.
2.  **Authorization**: "Can they see this?" -> Checked against `User.is_admin` or Data Ownership.

### 3.3 Invite Flows (Magic Links)
We distinguish between two types of invites:

#### A. Device Invite ("Add *my* particular device")
*   **Actor**: A logged-in User.
*   **Action**: "Add Device" from Settings.
*   **Result**: New Session created **linked to the Current User**.
*   **Use Case**: Dad setting up his new iPad.

#### B. User Invite ("Add a new person")
*   **Actor**: An Admin User.
*   **Action**: "Invite User" from Admin Console.
*   **Result**: New `User` created + New `Session` created **linked to the New User**.
*   **Use Case**: Dad inviting Mom to the server.

## 4. Data Isolation Strategy
*   **Row-Level Security (Application Layer)**:
    *   Every table with user data (`ContentItem`, `Tag`, `ProcessingTask`) adds an `owner_id` column.
    *   **All** Database queries (CRUD) are wrapped to automatically append `.where(owner_id == current_user.id)`.
*   **Shared Data** (Future Scope): Explicit sharing logic can be added later (e.g., a "Family Shared" folder).

## 5. Security & Modularity
*   **Admin Bootstrap**: The first token generated on startup is the "Admin Token" for the first Admin User.
*   **Revocation**:
    *   User revokes a `Session`: That device creates to work.
    *   Admin disables a `User`: All sessions for that user cease to work.

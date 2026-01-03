# Phased Implementation Plan: Multi-User Device Auth

This document outlines the step-by-step phased approach to implementing Multi-User Device Authentication for Zibaldone.

## Phase 1: Foundation (Database & Schema)
**Goal:** Establish the data models and ensure existing data is compatible with the new multi-user structure without breaking the application.

1.  **Dependency Updates**:
    *   Add `qrcode[pil]` and `bcrypt` (or `passlib`) to `backend/requirements.txt`.
2.  **Schema Definition**:
    *   Create `User` model (id, display_name, is_admin, created_at).
    *   Create `Session` model (id, user_id, token_hash, device_name, ...)
    *   Create `Invite` model (code, type, created_by, target_user).
3.  **Schema Migration (Content)**:
    *   Add `owner_id` (foreign key to `User`) to `ContentItem`, `Tag`, and `ProcessingTask`.
    *   *Critical*: Implement a startup check/migration. If existing items have `owner_id=NULL`, create a default "Admin" user and assign all existing records to this user.
4.  **Verification**:
    *   Run app. Ensure tables are created.
    *   Verify existing data remains accessible (even if `owner_id` is essentially ignored by current logic).

## Phase 2: Backend Authentication Mechanics
**Goal:** Implement the logic to generate tokens, identify users, and manage invites.

1.  **Auth Service**:
    *   Implement `create_user`, `create_session`, `generate_token`, `hash_token`.
    *   Implement `get_current_user` dependency. Initially, this can be "permissive" (soft-fail) or simply return the default admin for testing until fully wired.
2.  **Invite & Join API**:
    *   Implement `POST /api/auth/invite/device` (Generate code).
    *   Implement `POST /api/auth/join` (Exchange code for token).
    *   Implement `POST /api/auth/invite/user` (Admin only).
3.  **Admin Bootstrap**:
    *   On startup, if no users exist, generate the initial Admin User and print the "Setup Token" or "Setup Invite Code" to the console.
4.  **Verification**:
    *   Use `curl` or Swagger UI to create an invite and "join" to get a session token.
    *   Verify the token works against `get_current_user`.

## Phase 3: Frontend Authentication Foundation
**Goal:** specific UI for logging in and storing credentials.

1.  **Auth Context**:
    *   Create `AuthContext.tsx`.
    *   Logic to check `localStorage` for `zibaldone-token`.
    *   On 401 Unauthorized, redirect to login.
2.  **Login Page**:
    *   Create `/login` route.
    *   Simple input for "Paste Token" (Dev/Fallback).
    *   "Scan QR Code" implementation (using a library like `react-qr-reader` or simply handling the magic link flow if doing URL-based joins). *Self-note: Design called for Device Flow/Code entry.*
3.  **HTTP Interceptor**:
    *   Update API client to attach `Authorization: Bearer <token>` to every request.
4.  **Verification**:
    *   Manually set a token in local storage.
    *   Verify requests send the header.
    *   Verify "Log Out" clears the header.

## Phase 4: Data Isolation (The "Switch")
**Goal:** Enforce ownership. Users should only see their own data.

1.  **API Refactor**:
    *   Update `get_current_user` to be **strict** (raise 401 if no valid token).
    *   Refactor ALL CRUD endpoints (`items`, `tags`, `tasks`) to accept `current_user`.
2.  **Query Filtering**:
    *   Append `.where(Model.owner_id == current_user.id)` to every read query.
    *   Assign `owner_id = current_user.id` on every create operation.
3.  **Verification**:
    *   Create two users (A and B).
    *   User A uploads an item.
    *   Verify User B cannot see it in the list.

## Phase 5: Multi-User Workflow & UX
**Goal:** Make the system usable for a family (Invites, QR Codes, Settings).

1.  **Settings UI**:
    *   "My Devices": List current sessions, allow revoking.
    *   "Add Device": Show QR code (calling `/invite/device`).
2.  **Admin UI**:
    *   "Manage Users": List users.
    *   "Invite User": Create new user profile, show QR code.
3.  **Join Flow Polish**:
    *   Ensure the "Join" page looks good on mobile.
4.  **Verification**:
    *   Full E2E test: Admin invites Spouse. Spouse joins on phone. Spouse uploads photo. Admin does not see photo.

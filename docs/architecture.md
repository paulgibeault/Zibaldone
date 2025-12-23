# Zibaldone Architecture & Implementation Guide

This document provides a comprehensive overview of the Zibaldone architecture, covering both the frontend and backend systems, their interactions, and the data flow.

## System Overview

Zibaldone is a local-first content analysis system that captures files, extracts metadata using local LLMs (via LiteLLM), and provides a reactive user interface for managing content.

### High-Level Components

- **Frontend**: A React application built with Vite, utilizing Tailwind CSS (implied via class names in analysis) and custom components for a responsive UI.
- **Backend**: A FastAPI (Python) server handling file uploads, managing a SQLite database, and coordinating background tasks.
- **LLM Service**: An abstraction layer using `litellm` (running as a proxy or direct library) to interface with local or remote LLMs (e.g., LM Studio).
- **Storage**: Local filesystem storage for uploaded blobs and a SQLite database for metadata.

---

## Backend Architecture

**Location**: `/backend`

The backend is built with **FastAPI** and **SQLModel**. It is designed to be asynchronous to handle file uploads and background processing concurrently.

### Key Components

- **App Entry Point** (`app/main.py`):
  - Initializes the FastAPI app.
  - Configures CORS for local development.
  - Sets up the database and starts background workers on startup (`lifespan` event).
  - Exposes SSE (Server-Sent Events) at `/api/events` for real-time client updates.

- **API Router** (`app/api.py`):
  - `POST /upload`: Handles file uploads. Saves the file blob to disk and creates an initial `UNPROCESSED` record in the database.
  - `GET /items`: Retrieves all content items.
  - `DELETE /items/{item_id}`: Deletes file blob and database record.

- **Data Models** (`app/models.py`):
  - `ContentItem`: Represents a managed file.
  - `ContentStatus`: Enum tracking state (`UNPROCESSED`, `TAGGED`, `ERROR`).
  - Database: SQLite (via SQLModel).

- **Background Worker** (`app/workers.py`):
  - Runs an infinite loop (polling every 5s) checking for `UNPROCESSED` items.
  - **Process**:
    1. Reads file content (text files) or valid metadata.
    2. Sends context to the LLM service to generate metadata.
    3. Merges LLM metadata with existing metadata (prioritizing existing keys unless collisions occur).
    4. Updates status to `TAGGED`.
    5. Broadcasts an update event via SSE.

- **LLM Service** (`app/services/llm.py`):
  - Wraps `litellm` calls.
  - Configured via environment variables (`LLM_MODEL`).

### Data Flow for Uploads

1. **User** drops a file in Frontend.
2. Frontend sends `POST /api/upload` with file and optional initial metadata.
3. **Backend** saves file to `data/blob_storage`.
4. **Backend** creates DB entry (Status: `UNPROCESSED`).
5. **Worker** detects `UNPROCESSED` item.
6. **Worker** reads content, calls LLM.
7. **Worker** updates DB entry (Status: `TAGGED`).
8. **Broadcaster** sends SSE event `{"type": "update", "item_id": "..."}`.
9. **Frontend** receives event and refreshes local state.

---

## Frontend Architecture

**Location**: `/frontend`

The frontend is a Single Page Application (SPA) built with **React**, **TypeScript**, and **Vite**.

### Key Components

- **Entry Point** (`src/main.tsx`): Mounts the React app.
- **Main Layout** (`src/App.tsx`):
  - Manages global state (list of items, theme).
  - Connects to Backend SSE endpoint for real-time updates.
  - Renders the main view (DropZone + Grid of FileCards).

- **Components**:
  - `DropZone`: Handles drag-and-drop file inputs. extract metadata on drop if possible.
  - `FileCard`: Displays file info. Features a tabbed interface for "Quick View" vs "Full Metadata".
  - `ThemeSelector`: Allows switching between Light/Dark/System themes.

- **Styling**:
  - Uses standard CSS/CSS Modules or Tailwind (project structure suggests standardized CSS imports).
  - Theming is handled via CSS variables or specific class toggles attached to the root.

### State Management

- **Local State**: `useState` hooks in `App.tsx` manage the list of items.
- **Real-time Sync**: The app listens to `EventSource` on `/api/events`. When an update message is received, it triggers a fetch to refresh data, ensuring the UI always reflects background processing progress.

---

## Directory Structure Summary

```
zibaldone/
├── backend/
│   ├── app/
│   │   ├── main.py       # App entry & wiring
│   │   ├── api.py        # REST endpoints
│   │   ├── models.py     # DB Schemas
│   │   └── workers.py    # Background logic
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Main UI Logic
│   │   ├── components/   # React Components
│   │   └── api.ts        # API Client
│   └── vite.config.ts    # Build config
├── data/                 # Local data storage (ignored in git)
├── docs/                 # Documentation
└── ...                   # Root level scripts (setup, go)
```

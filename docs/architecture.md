# Zibaldone Architecture

## 1. System Overview

Zibaldone is a **local-first, privacy-focused content ingestion system**. It allows users to drop files (PDFs, images, text) into a "box", where they are automatically processed, tagged, and organized using local Large Language Models (LLMs).

The system is designed with a **Micro-Service Architecture** (even when running locally via Docker Compose) to ensure scalability and clear separation of concerns.

### High-Level Components

*   **Frontend (React + Vite)**: A reactive SPA that provides the drag-and-drop interface, file visualization, and real-time status updates.
*   **Backend (FastAPI)**: The central orchestrator that manages uploads, serves the API, and coordinates background workers.
*   **Storage Layer (Hybrid)**: Supports both **Local Filesystem** (for simple setups) and **S3/MinIO** (for robust, scalable object storage).
*   **Database (SQLite)**: Stores metadata (`ContentItem`), taxonomy (`Tag`), and processing history (`ProcessingTask`).
*   **LLM Service (LiteLLM)**: A unified gateway to access local (LM Studio, Ollama) or remote (OpenAI) models.

---

## 2. Core Workflows

### 2.1. File Ingestion & Storage

Zibaldone implements a **Hybrid Storage Strategy** to decouple the application from physical storage limits.

**A. The "Direct Upload" Pattern (MinIO/S3)**
1.  **Request**: Frontend asks for a pre-signed URL (`GET /api/upload/params?filename=doc.pdf`).
2.  **Generation**: Backend uses `boto3` to generate a secure `PUT` URL pointing directly to MinIO/S3.
3.  **Upload**: Frontend uploads the file binary directly to the Storage Layer (bypassing the API server).
4.  **Finalization**: Frontend calls `POST /api/upload/finalize` with the `storage_path` to create the database record.

**B. Local Fallback**
*   For simple deployments, the system falls back to a standard multipart upload (`POST /api/upload`), saving files to a local `data/blob_storage` directory.

### 2.2. Atomic Task Processing Pipeline

Unlike monolithic job queues, Zibaldone uses an **Atomic Task** pattern. Processing a file is broken down into granular, trackable steps. This allows for live progress reporting and easier debugging.

**The Pipeline:**

1.  **Monitor**: A background worker polls for items with status `UNPROCESSED`.
2.  **Task 1: Metadata Extraction**
    *   **Input**: Raw file content.
    *   **Action**: LLM reads the content and generates a summary, keywords, and *suggested tags*.
    *   **Output**: JSON result stored in `ProcessingTask` table.
3.  **Task 2: Tag Alignment**
    *   **Input**: Suggested tags from Task 1 + List of *Approved Tags* from DB.
    *   **Action**: LLM compares suggestions against the approved taxonomy to consolidate duplicates (e.g., mapping "contracts" to "Contract").
    *   **Output**: Finalized tags applied to the `ContentItem`.
4.  **Completion**: Item status updated to `TAGGED`.

### 2.3. Event-Driven UI Updates

The UI does not rely on manual refreshes. It maintains synchronization with the backend via **Server-Sent Events (SSE)**.

1.  **Connection**: Frontend subscribes to `/api/events`.
2.  **Broadcast**: When a worker completes a task (e.g., "Metadata Extraction Finished"), it broadcasts an event:
    ```json
    {
      "type": "update",
      "item_id": "uuid-1234",
    }
    ```
3.  **Reaction**: The Frontend receives the event and automatically refetches the latest item state and processing history.

---

## 3. Data Models

### `ContentItem`
The core entity representing a managed file.
*   `id`: UUID
*   `storage_path`: Path to blob (e.g., `2024/01/15/doc.pdf`)
*   `status`: `UNPROCESSED` | `PROCESSING` | `TAGGED` | `FAILED`
*   `metadata_json`: Current active metadata (summary, tags).

### `ProcessingTask`
An immutable record of a specific unit of work.
*   `item_id`: FK to ContentItem
*   `task_name`: "Metadata Extraction", "Tag Alignment", etc.
*   `status`: `PENDING` | `RUNNING` | `COMPLETED` | `FAILED`
*   `result_json`: The raw output of the task (e.g., the LLM's raw response), kept for debugging and transparency.

### `Tag`
*   `name`: The tag label.
*   `is_approved`: Boolean. If `True`, this tag is part of the official taxonomy. If `False`, it was auto-created by an LLM and may need review.

---

## 4. Directory Structure

```
zibaldone/
├── backend/
│   ├── app/
│   │   ├── services/
│   │   │   ├── s3_storage.py   # MinIO/S3 Implementation
│   │   │   ├── llm.py          # LiteLLM Wrapper
│   │   │   └── workers.py      # Background Task Loop
│   │   └── models.py           # SQLModel Definitions
├── frontend/
│   ├── src/
│   │   ├── components/         # React Components
│   │   └── api.ts              # API Client & Types
├── docker-compose.yml          # Services (Backend, Frontend, MinIO, LiteLLM)
└── scripts/                    # Helper scripts (setup, go, etc.)
```

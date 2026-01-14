<p align="center">
  <img src="frontend/public/ZLogo-gradient.svg" alt="Zibaldone Logo" width="400" />
</p>

# Zibaldone

> *"A heap of things"*

A **zibaldone** is a type of commonplace book—a notebook for collecting diverse ideas, observations, quotes, sketches, poems, and personal reflections. It functions as a personal intellectual archive or creative playground rather than a structured diary. This project invites you to **keep a heap of things** in a digital, local-first content ingestion and processing system.

## Platform Capabilities

Zibaldone is designed to be your personal digital archive:
*   **Content Ingestion**: Effortlessly upload images, videos, markdown files, and code snippets.
*   **Rich Display**: Support for syntax highlighting, Markdown rendering (including Mermaid diagrams), and media playback.
*   **Heap Management**: Organize your content with a flexible tagging system and powerful filtering/search capabilities.
*   **Local-First & Private**: Your data lives on your machine (or self-hosted server), ensuring complete privacy and ownership.

## Architecture & Tech Stack

The application is built on a modern, containerized stack designed for performance and maintainability:

### Frontend
*   **Framework**: React 19 with TypeScript
*   **Build Tool**: Vite 7
*   **State Management**: Zustand
*   **Styling**: Custom CSS / Utility classes

### Backend
*   **API Framework**: FastAPI (Python)
*   **Database ORM**: SQLModel (SQLAlchemy + Pydantic)
*   **Object Storage**: MinIO (S3-compatible)
*   **AI Integration**: LiteLLM for LLM interactions

### Infrastructure
*   **Orchestration**: Docker Compose
*   **Environment**: Supports both Docker-based deployment and local development modes.

## Installation & Execution

The project includes helper scripts to simplify lifecycle management.

### Initial Setup
Before running the application for the first time, run the setup script to configure your environment and dependencies:
```bash
./setup             # Interactive setup wizard
./setup --docker    # Quick setup for Docker mode
./setup --local     # Quick setup for Local mode
```
This script will check for required tools (Docker, Python, Node.js), set up virtual environments, and generate necessary configuration files (`backend/.env`).

### Starting the Application
Use the `./go` script to build and start the system:
```bash
./go --docker       # Run via Docker Compose (Recommended)
./go --local        # Run services locally (Requires Python/Node env)
./go --restart      # Force restart services
./go --verbose      # Stream logs to console
```

### Cleanup
To reset the environment or remove data, use the `./cleanup` script:
```bash
./cleanup           # Interactive cleanup
./cleanup --full    # Removes all data, logs, and system dependencies
./cleanup --force   # Skip confirmation prompts
```

## Administration

### Admin Access
To manage the system or recover access, you can generate an emergency admin token using the backend helper script.

**Generate Admin Token:**
Generate your first token manually:

```bash
./backend/new_admin_code
```
This command executes the admin reset logic inside the running backend container and prints a new **Access Token** to your terminal. Use this token to log in for the first time or if you are locked out.


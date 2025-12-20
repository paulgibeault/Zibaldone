# Zibaldone
A zibaldone (Italian for "heap of things") is a type of commonplace book, a notebook for collecting diverse ideas, observations, quotes, sketches, poems, and personal reflections, functioning as a personal intellectual archive or creative playground rather than a structured diary.

This project implements a **local-first content ingestion and processing system** inspired by this concept.

## Project Structure

- `backend/`: FastAPI Python application.
- `frontend/`: React + Vite application.

## Getting Started

### Backend

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Create virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`.

### Frontend

1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The UI will be available at `http://localhost:5173`.

## Features

- **Ingestion**: Drag and drop files to upload.
- **Processing**: Background worker automatically tags uploaded content.
- **Storage**: Local SQLite database and filesystem storage.

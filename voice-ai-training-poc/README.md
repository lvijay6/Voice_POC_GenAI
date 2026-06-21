# Voice AI Training POC

A lightweight proof-of-concept voice-activated AI training application. The React frontend streams microphone audio directly to the OpenAI Realtime API after obtaining a short-lived session token from the Python FastAPI backend.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- An **OpenAI API key** with access to the Realtime API

---

## Project Structure

```
voice-ai-training-poc/
├── frontend/          # React SPA (Create React App, TypeScript)
├── backend/           # Python FastAPI credential broker
└── README.md
```

---

## Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # macOS/Linux
   source .venv/bin/activate
   # Windows
   .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-...your-key-here...
   FRONTEND_ORIGIN=http://localhost:3000
   ```

5. **Start the backend server:**
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`.

---

## Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   The default value points to the local backend:
   ```
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```
   The app will open at `http://localhost:3000`.

---

## Running Both Services

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd voice-ai-training-poc/backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd voice-ai-training-poc/frontend
npm start
```

Then open `http://localhost:3000` in your browser.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key with Realtime API access |
| `FRONTEND_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:3000`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_BACKEND_URL` | No | Backend base URL (default: `http://localhost:8000`) |

---

## Usage

1. Ensure both the backend and frontend are running.
2. Open `http://localhost:3000` in a browser that supports the Web Audio API (Chrome or Edge recommended).
3. Select a training topic from the dropdown.
4. Click **Start Session** and grant microphone access when prompted.
5. Speak your question or prompt — the AI will respond with audio and a live transcript.
6. Click **End Session** to stop.

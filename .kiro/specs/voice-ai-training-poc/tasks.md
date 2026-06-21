# Implementation Plan

## Overview

A lightweight proof-of-concept voice-activated AI training application with a React frontend and Python FastAPI backend that proxies communication to the OpenAI Realtime API.

## Tasks

- [x] 1. Project Scaffold
  - Create the root `voice-ai-training-poc/` directory with `frontend/` and `backend/` subdirectories
  - Initialise the React frontend with Create React App (TypeScript template): `npx create-react-app frontend --template typescript`
  - Create `frontend/.env.example` with `REACT_APP_BACKEND_URL=http://localhost:8000`
  - Create `backend/requirements.txt` with pinned versions: `fastapi==0.111.0`, `uvicorn[standard]==0.29.0`, `httpx==0.27.0`, `python-dotenv==1.0.1`
  - Create `backend/.env.example` with `OPENAI_API_KEY=` and `FRONTEND_ORIGIN=http://localhost:3000`
  - Create a root `README.md` with local dev setup instructions for both frontend and backend
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 2. FastAPI Backend — Session Endpoint
  - Create `backend/main.py` with a FastAPI app instance
  - Add startup validation: read `OPENAI_API_KEY` from environment at startup; raise `RuntimeError` and refuse to start if it is not set
  - Add `CORSMiddleware` restricted to the `FRONTEND_ORIGIN` environment variable (default `http://localhost:3000`), allowing only `POST` and `Content-Type`
  - Implement `POST /session` endpoint that uses `httpx.AsyncClient` to POST to `https://api.openai.com/v1/realtime/sessions` with `Authorization: Bearer <OPENAI_API_KEY>`, request body `{ "model": "gpt-4o-realtime-preview-2024-10-01", "voice": "alloy" }`, returning the full JSON response on success (2xx) or HTTP 502 with `{ "detail": "Failed to create OpenAI session: <message>" }` on upstream error
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 3. Frontend Types and Constants
  - Create `frontend/src/types/index.ts` defining: `SessionStatus` (`'idle' | 'connecting' | 'active' | 'ended' | 'error'`), `VoiceState` (`'idle' | 'listening' | 'processing' | 'speaking'`), `Turn` (`{ id: string; role: 'user' | 'assistant'; text: string; isFinal: boolean }`), and `SessionToken` (matching the OpenAI session response shape)
  - Create `frontend/src/constants.ts` with the list of training topics: `["General Knowledge", "Python Basics", "SQL Joins", "Data Structures", "Machine Learning Concepts"]`
  - _Requirements: 2.1, 2.3_

- [x] 4. useRealtimeSession Custom Hook
  - Create `frontend/src/hooks/useRealtimeSession.ts`
  - Implement `startSession(topic: string)`: POST to `REACT_APP_BACKEND_URL/session` to fetch `SessionToken`; on HTTP error set `sessionStatus → 'error'`; open a WebSocket to `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01` with the ephemeral token; on WebSocket open failure set `sessionStatus → 'error'`
  - Implement `endSession()`: send WebSocket close, stop mic tracks, release `AudioContext`, reset state to `'ended'`
  - Implement mic capture: call `navigator.mediaDevices.getUserMedia({ audio: true })`; on denial set `sessionStatus → 'error'`; create `AudioContext` at 24 kHz; use `AudioWorkletNode` (or `ScriptProcessorNode` fallback) to capture PCM16 mono chunks, base64-encode, and send as `input_audio_buffer.append` events over the WebSocket
  - Implement WebSocket incoming event handling for: `session.created`, `input_audio_buffer.speech_started`, `input_audio_buffer.speech_stopped`, `response.audio.delta`, `response.audio_transcript.delta`, `response.audio.done`, `response.done`, and `error` events
  - Hook returns: `{ sessionStatus, voiceState, transcript, errorMessage, startSession, endSession }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 6.1, 6.2_

- [x] 5. UI Components
  - Create `frontend/src/components/TopicSelector.tsx`: renders the list of training topics as a `<select>` dropdown, disabled while `sessionStatus !== 'idle'`, calls `onTopicChange(topic)` prop on selection change, defaults to `"General Knowledge"`
  - Create `frontend/src/components/SessionControls.tsx`: renders "Start Session" button (visible when `idle` or `ended`), "End Session" button (visible when `active` or `connecting`), and a status label
  - Create `frontend/src/components/VoiceIndicator.tsx`: renders animated visual indicator — `idle` → grey dot "Ready", `listening` → green pulsing dot "Listening…", `processing` → yellow spinning dot "Processing…", `speaking` → blue pulsing bar "AI Speaking…"
  - Create `frontend/src/components/TranscriptPanel.tsx`: renders scrollable list of `Turn` objects with user turns right-aligned and assistant turns left-aligned, auto-scrolls to latest turn, shows placeholder when empty
  - _Requirements: 2.1, 2.2, 2.3, 4.4, 5.1, 5.2, 5.3, 6.3_

- [x] 6. App Integration
  - Update `frontend/src/App.tsx`: wire `useRealtimeSession` hook, compose `TopicSelector`, `SessionControls`, `VoiceIndicator`, and `TranscriptPanel`, pass `selectedTopic` to `startSession` on button click, pass `errorMessage` to `SessionControls` for display
  - Add minimal CSS (inline styles or a single `App.css`): centered single-column layout max-width 700 px, transcript panel fixed height with vertical scroll, distinct styling for user vs. AI turns
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 4.4, 5.1, 5.2, 5.3, 6.3_

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1. Project Scaffold"],
      "description": "Foundation — create directory structure, initialize React app, and write config files"
    },
    {
      "wave": 2,
      "tasks": ["2. FastAPI Backend — Session Endpoint", "3. Frontend Types and Constants"],
      "description": "Backend implementation and frontend type definitions can proceed in parallel after the scaffold is ready"
    },
    {
      "wave": 3,
      "tasks": ["4. useRealtimeSession Custom Hook"],
      "description": "Core hook depends on types and constants from Wave 2"
    },
    {
      "wave": 4,
      "tasks": ["5. UI Components"],
      "description": "UI components depend on types, constants, and the hook"
    },
    {
      "wave": 5,
      "tasks": ["6. App Integration"],
      "description": "Final wiring — depends on all components and the hook being complete"
    }
  ]
}
```

## Notes

- Task 7 (End-to-End Smoke Test) from the original spec requires a live OpenAI API key and browser interaction; it is excluded from automated task execution and should be performed manually after completing Task 6.
- The frontend uses Create React App (CRA) with TypeScript, so environment variables use the `REACT_APP_` prefix.
- Backend runs on port 8000; frontend runs on port 3000 by default.

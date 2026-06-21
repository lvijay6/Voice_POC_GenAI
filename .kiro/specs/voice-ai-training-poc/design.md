# Design Document: Voice AI Training POC

## Overview

This document describes the technical design for a lightweight proof-of-concept (POC) voice-activated AI training application. The system enables a user to speak into their browser microphone and receive real-time audio and text responses from an AI tutor powered by the OpenAI Realtime API.

The architecture is intentionally minimal: a React single-page application handles all UI and audio logic in the browser, a Python FastAPI backend exists solely to issue short-lived session tokens without exposing the OpenAI API key to the client, and the OpenAI Realtime API handles all language model inference and speech synthesis.

### Key Design Decisions

- **Direct browser-to-OpenAI WebSocket**: After receiving a session token from the backend, the frontend connects directly to the OpenAI Realtime API. This avoids the complexity and latency of proxying a real-time audio stream through the backend server.
- **Backend is a thin credential broker**: The backend's only job is to call the OpenAI session endpoint with the API key and return the short-lived token. This keeps the secret off the client while minimizing backend surface area.
- **Web Audio API for audio capture and playback**: Native browser APIs handle microphone capture, PCM16 encoding, and audio output — no additional audio libraries needed.
- **React state machine for session lifecycle**: Session states (idle → connecting → active → ended) are managed with a simple reducer to keep UI transitions predictable.

---

## Architecture

The system has three tiers that communicate as follows:

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                  │
│                                                          │
│  ┌─────────────┐   ┌───────────────┐   ┌─────────────┐  │
│  │  Topic      │   │  Session      │   │  Transcript │  │
│  │  Selector   │   │  Controller   │   │  Panel      │  │
│  └─────────────┘   └───────┬───────┘   └─────────────┘  │
│                            │                             │
│  ┌─────────────┐   ┌───────┴───────┐   ┌─────────────┐  │
│  │  Audio      │   │  WebSocket    │   │  Status     │  │
│  │  Capture    │◄──┤  Manager      ├──►│  Indicator  │  │
│  └─────────────┘   └───────┬───────┘   └─────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │ HTTP POST /session                  │ WebSocket (wss://)
         ▼                                     ▼
┌─────────────────┐              ┌─────────────────────────┐
│  FastAPI        │              │  OpenAI Realtime API    │
│  Backend        │─────────────►│                         │
│                 │  POST /v1/   │  - Audio delta events   │
│  POST /session  │  realtime/   │  - Text transcript      │
│                 │  sessions    │  - VAD / turn detection │
└─────────────────┘              └─────────────────────────┘
```

**Data flow summary:**
1. User selects a topic and clicks "Start Session"
2. Frontend calls `POST /session` on the backend
3. Backend calls OpenAI's session creation endpoint with the API key and returns the token
4. Frontend opens a WebSocket to OpenAI Realtime API using the token
5. Frontend streams PCM16 audio from the microphone over the WebSocket
6. OpenAI Realtime API returns audio delta and text transcript delta events
7. Frontend plays audio and updates the transcript panel in real time
8. User clicks "End Session"; frontend closes WebSocket and releases microphone

---

## Components and Interfaces

### Frontend Components

#### `App` (Root Component)
- Holds global session state using `useReducer`
- Renders `TopicSelector`, `SessionController`, `TranscriptPanel`, and `StatusIndicator`
- Dispatches session lifecycle actions

#### `TopicSelector`
- Props: `topics: string[]`, `selectedTopic: string | null`, `onSelect: (topic: string) => void`
- Renders a list of selectable topic buttons/pills
- Disabled while a session is active
- Falls back to "General knowledge" when nothing is selected

#### `SessionController`
- Props: `sessionState: SessionState`, `onStart: () => void`, `onEnd: () => void`
- Renders "Start Session" or "End Session" button based on state
- Triggers session initialization and teardown

#### `AudioCapture` (non-visual service component / custom hook: `useAudioCapture`)
- Requests `getUserMedia` on activation
- Reads raw audio from `MediaStreamAudioSourceNode`
- Encodes float32 samples to PCM16 (16-bit LE, 24 kHz)
- Sends encoded buffers to the WebSocket via a callback
- Exposes `start(stream: MediaStream)` and `stop()` methods

#### `WebSocketManager` (custom hook: `useRealtimeWebSocket`)
- Opens `wss://api.openai.com/v1/realtime` with token as a query parameter
- Sends the session configuration event (model, modalities, system prompt with topic)
- Dispatches incoming events to registered handlers:
  - `audio.delta` → audio playback
  - `transcript.delta` → transcript update
  - `session.created` / `response.done` → state transitions
- Exposes `sendAudioChunk(pcm16: ArrayBuffer)` and `close()` methods

#### `AudioPlayer` (custom hook: `useAudioPlayer`)
- Receives PCM16 audio chunks from `audio.delta` events
- Buffers chunks and schedules playback through `AudioContext`
- Exposes `enqueue(chunk: ArrayBuffer)` and signals playback state via `isPlaying: boolean`

#### `TranscriptPanel`
- Props: `turns: Turn[]`
- Renders a scrollable list of conversation turns
- Auto-scrolls to bottom on new entry using `useEffect` + `ref.scrollIntoView`
- Visually distinguishes user turns (right-aligned, accent color) from AI turns (left-aligned, neutral)

#### `StatusIndicator`
- Props: `status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error'`
- Renders a visual indicator (color-coded badge or animated icon) reflecting current state

---

### Backend Components

#### `main.py` — FastAPI Application Entry Point
- Creates the FastAPI app instance
- Registers CORS middleware with configurable allowed origins
- Registers the `/session` router
- Validates `OPENAI_API_KEY` on startup; raises `RuntimeError` and exits if missing

#### `routers/session.py` — Session Router
- Exposes `POST /session`
- Calls OpenAI's `POST /v1/realtime/sessions` with the API key from environment
- Returns `{"client_secret": {"value": "<token>", ...}}` on success
- Returns `{"detail": "<message>"}` with HTTP 502 on OpenAI API failure

#### `config.py` — Configuration
- Reads all environment variables
- Exposes a `Settings` object (using Pydantic `BaseSettings`)
- Raises a descriptive error if `OPENAI_API_KEY` is absent

---

### API Contracts

#### `POST /session`

**Request:** No body required.

**Success Response (200):**
```json
{
  "client_secret": {
    "value": "<ephemeral_token>",
    "expires_at": 1234567890
  }
}
```

**Error Response (502):**
```json
{
  "detail": "Failed to obtain session token from OpenAI: <reason>"
}
```

**Error Response (500):**
```json
{
  "detail": "<human-readable error description>"
}
```

---

#### OpenAI Realtime WebSocket Events (Frontend-Sent)

**Session update (system prompt + topic):**
```json
{
  "type": "session.update",
  "session": {
    "modalities": ["audio", "text"],
    "instructions": "You are an AI tutor focused on: <Training_Topic>. ...",
    "input_audio_format": "pcm16",
    "output_audio_format": "pcm16",
    "input_audio_transcription": { "model": "whisper-1" },
    "turn_detection": { "type": "server_vad" }
  }
}
```

**Audio input chunk:**
```json
{
  "type": "input_audio_buffer.append",
  "audio": "<base64-encoded PCM16 chunk>"
}
```

---

#### OpenAI Realtime WebSocket Events (Frontend-Received)

| Event Type | Action |
|---|---|
| `session.created` | Transition to `active` state |
| `response.audio.delta` | Enqueue chunk to `AudioPlayer` |
| `response.audio_transcript.delta` | Append text to current AI turn |
| `response.done` | Finalize current AI turn in transcript |
| `input_audio_buffer.speech_started` | Set status to `listening` |
| `input_audio_buffer.speech_stopped` | Set status to `processing` |
| `error` | Display error, transition to error state |

---

## Data Models

### Frontend State

```typescript
type SessionState = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

type RecordingStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface Turn {
  id: string;           // UUID, generated client-side
  role: 'user' | 'ai';
  text: string;         // Accumulated transcript text
  isComplete: boolean;  // True once response.done received
  timestamp: number;    // Unix ms, for ordering
}

interface AppState {
  sessionState: SessionState;
  recordingStatus: RecordingStatus;
  selectedTopic: string;
  turns: Turn[];
  errorMessage: string | null;
}
```

### Session Reducer Actions

```typescript
type SessionAction =
  | { type: 'START_REQUESTED' }
  | { type: 'SESSION_CONNECTED' }
  | { type: 'SESSION_ERROR'; payload: string }
  | { type: 'SPEECH_STARTED' }
  | { type: 'SPEECH_STOPPED' }
  | { type: 'AI_SPEAKING_STARTED' }
  | { type: 'AI_SPEAKING_STOPPED' }
  | { type: 'TRANSCRIPT_DELTA'; payload: { role: 'user' | 'ai'; text: string } }
  | { type: 'TURN_COMPLETE' }
  | { type: 'END_SESSION' }
  | { type: 'SESSION_CLOSED' }
  | { type: 'TOPIC_SELECTED'; payload: string };
```

### Backend Models (Pydantic)

```python
class SessionTokenResponse(BaseModel):
    client_secret: dict  # Passes through OpenAI's response structure

class ErrorResponse(BaseModel):
    detail: str
```

### Environment Variables

**Backend (`.env.example`):**
```
OPENAI_API_KEY=sk-...
FRONTEND_ORIGIN=http://localhost:5173
```

**Frontend (`.env.example`):**
```
VITE_BACKEND_URL=http://localhost:8000
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Topic Selection Reflected in System Prompt

*For any* valid training topic string selected by the user, when a session is initialized, the `session.update` message sent to the OpenAI Realtime API SHALL contain that exact topic string within the `instructions` field.

**Validates: Requirements 2.2**

---

### Property 2: PCM16 Encoding Correctness

*For any* float32 audio sample buffer of length N (where each sample is in the range [-1.0, 1.0]), the PCM16 encoder SHALL produce an `ArrayBuffer` of exactly `N * 2` bytes, where each 16-bit sample is the nearest integer in the range [-32768, 32767].

**Validates: Requirements 3.3**

---

### Property 3: Transcript Delta Accumulation

*For any* sequence of text delta strings received via `response.audio_transcript.delta` events, the transcript panel SHALL contain all of those strings concatenated in the order they were received within the current AI turn.

**Validates: Requirements 4.2**

---

### Property 4: Transcript Chronological Order

*For any* sequence of conversation turns (user or AI) added during a session, the transcript panel SHALL display them in the exact order they were added, with no turns omitted or reordered.

**Validates: Requirements 5.1**

---

### Property 5: Visual Role Distinction

*For any* user turn and any AI turn rendered in the transcript panel, the two SHALL have different visual attributes (CSS class or layout property) so they are distinguishable at a glance, regardless of their text content.

**Validates: Requirements 5.3**

---

### Property 6: API Key Never Exposed in Backend Responses

*For any* response returned by the FastAPI backend (success or error), the response body SHALL NOT contain the value of the `OPENAI_API_KEY` environment variable.

**Validates: Requirements 7.2**

---

### Property 7: All Backend Errors Return JSON with `detail`

*For any* error condition encountered by the backend (missing API key, upstream failure, invalid request, unhandled exception), the response body SHALL be a JSON object containing a `detail` field with a non-empty human-readable message.

**Validates: Requirements 7.5**

---

## Error Handling

### Frontend Error Handling

| Failure | Detection | User-Facing Action |
|---|---|---|
| Backend `/session` returns non-200 | `fetch` response check | Show error message, stay in `idle` |
| WebSocket connection refused/failed | `ws.onerror` / `ws.onclose` before `session.created` | Show error message, return to `idle` |
| Microphone access denied | `getUserMedia` promise rejection | Show permission error, end session |
| OpenAI Realtime API `error` event | WebSocket `message` handler | Show error message, transition to `error` state |
| Audio playback failure | `AudioContext` error callback | Degrade gracefully; continue showing transcript |

All frontend errors update `AppState.errorMessage` and render through `StatusIndicator` and an inline error banner. The session is considered unrecoverable for WebSocket and microphone errors; the user must restart.

### Backend Error Handling

| Failure | HTTP Status | Response |
|---|---|---|
| `OPENAI_API_KEY` not set | 500 (startup abort) | Logged to stderr; server refuses to start |
| OpenAI session endpoint returns non-200 | 502 | `{"detail": "Failed to obtain session token: <upstream_status>"}` |
| OpenAI endpoint unreachable / timeout | 502 | `{"detail": "OpenAI Realtime API unavailable: <error>"}` |
| Unexpected server error | 500 | `{"detail": "<exception message>"}` |

FastAPI's exception handlers are used to ensure all errors return JSON (overriding the default HTML error pages).

---

## Testing Strategy

### Overview

The project uses a dual-testing approach:
- **Unit tests** for specific behaviors, error conditions, and integration wiring
- **Property-based tests** for universal correctness properties (Properties 1–7 above)

### Frontend Testing

**Framework:** [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

**Property-based testing library:** [fast-check](https://fast-check.io/)

Property tests run with a minimum of **100 iterations** each. Each test is tagged with a comment referencing its design property:
```
// Feature: voice-ai-training-poc, Property 2: PCM16 encoding correctness
```

**Unit tests cover:**
- `TopicSelector` renders at least 3 topics (Req 2.1)
- Default topic "General knowledge" when none selected (Req 2.3)
- "Start Session" click triggers `POST /session` (Req 1.1)
- WebSocket opened with correct URL after receiving token (Req 1.3)
- Error message shown on 502 from backend (Req 1.6)
- WebSocket error returns to idle state (Req 1.5)
- `getUserMedia` called when session becomes active (Req 3.1)
- Microphone denied → error message + session end (Req 3.2)
- Audio delta event → `AudioContext.decodeAudioData` called (Req 4.1)
- `response.done` event → full text in transcript with separator (Req 4.3)
- AI speaking indicator shown while `isPlaying` is true (Req 4.4)
- New turn triggers scroll to bottom (Req 5.2)
- "End Session" click calls `ws.close()` (Req 6.1)
- WebSocket close stops microphone tracks (Req 6.2)
- Post-session UI shows full transcript and "Start New Session" (Req 6.3)

**Property tests cover:**
- Property 1: Topic → system prompt (fast-check `fc.string()` generator for topic values)
- Property 2: PCM16 encoding (fast-check `fc.float32Array()` generator)
- Property 3: Transcript delta accumulation (fast-check `fc.array(fc.string())` for delta sequences)
- Property 4: Transcript ordering (fast-check `fc.array(fc.record({role, text}))` for turn sequences)
- Property 5: Visual role distinction (fast-check `fc.record({role: fc.constantFrom('user','ai'), text: fc.string()})`)

### Backend Testing

**Framework:** [pytest](https://docs.pytest.org/) + [httpx](https://www.python-httpx.org/) (via `TestClient`)

**Property-based testing library:** [Hypothesis](https://hypothesis.readthedocs.io/)

Property tests run with the default Hypothesis profile (minimum 100 examples).

**Unit/Integration tests cover:**
- `POST /session` returns 200 with token when OpenAI mock succeeds (Req 7.1)
- `POST /session` returns 502 JSON when OpenAI mock fails (Req 1.4)
- CORS headers present on all responses (Req 7.3)
- App startup fails when `OPENAI_API_KEY` is unset (Req 7.4)

**Property tests cover:**
- Property 6: API key never in response (Hypothesis `@given(st.text())` for API key values; mock backend with that key; assert key absent in all responses)
- Property 7: All error responses are JSON with `detail` (Hypothesis generates various failure triggers; assert response matches `{"detail": <str>}`)

### Test File Structure

```
frontend/
  src/
    __tests__/
      TopicSelector.test.tsx
      SessionController.test.tsx
      TranscriptPanel.test.tsx
      useAudioCapture.test.ts
      useRealtimeWebSocket.test.ts
      pcm16Encoder.property.test.ts    # Property 2
      topicSystemPrompt.property.test.ts  # Property 1
      transcript.property.test.ts     # Properties 3, 4, 5

backend/
  tests/
    test_session.py
    test_error_responses.py
    test_api_key_security.property.py  # Properties 6, 7
```

# Requirements Document

## Introduction

A lightweight proof-of-concept (POC) for a voice-activated AI training application. The system consists of a React web frontend and a Python FastAPI backend that proxies communication to the OpenAI Realtime API. The goal is to demonstrate a functional voice interaction loop — where a user speaks a prompt, the AI responds with audio and text — with minimal infrastructure overhead.

## Glossary

- **Frontend**: The React single-page application running in the user's browser.
- **Backend**: The Python FastAPI server that manages session tokens and proxies WebSocket traffic to the OpenAI Realtime API.
- **OpenAI_Realtime_API**: OpenAI's streaming API that supports real-time audio input/output and text responses.
- **Session**: A single continuous voice interaction between the user and the AI, identified by a unique session token.
- **Session_Token**: A short-lived credential issued by the Backend to authorize the Frontend's connection to the OpenAI Realtime API.
- **AI_Response**: The audio and/or text output produced by the OpenAI Realtime API in reply to the user's voice input.
- **Training_Topic**: A subject or domain the user selects to focus the AI conversation (e.g., "Python basics", "SQL joins").
- **VAD**: Voice Activity Detection — automatic detection of when the user starts and stops speaking.

---

## Requirements

### Requirement 1: Session Initialization

**User Story:** As a user, I want to start a voice training session, so that I can begin talking to the AI tutor.

#### Acceptance Criteria

1. WHEN the user clicks the "Start Session" button, THE Frontend SHALL request a new Session_Token from the Backend.
2. WHEN the Backend receives a session creation request, THE Backend SHALL generate a Session_Token by calling the OpenAI Realtime API session endpoint and return it to the Frontend.
3. WHEN the Frontend receives a valid Session_Token, THE Frontend SHALL establish a WebSocket connection to the OpenAI Realtime API using that token.
4. IF the Backend fails to obtain a Session_Token from the OpenAI Realtime API, THEN THE Backend SHALL return an HTTP 502 error response with a descriptive error message to the Frontend.
5. IF the Frontend fails to establish the WebSocket connection, THEN THE Frontend SHALL display an error message to the user and return to the idle state.
6. WHEN the Backend returns an HTTP error response, THE Frontend SHALL display a user-facing error message describing the failure and remain in the idle state.

---

### Requirement 2: Training Topic Selection

**User Story:** As a user, I want to select a training topic before starting a session, so that the AI tutor focuses on the subject I want to learn.

#### Acceptance Criteria

1. THE Frontend SHALL display a list of at least three selectable Training_Topics before a session starts.
2. WHEN the user selects a Training_Topic, THE Frontend SHALL store the selection and include it as a system prompt instruction when initializing the Session.
3. WHERE no Training_Topic is selected by the user, THE Frontend SHALL use a default topic of "General knowledge".

---

### Requirement 3: Voice Input Capture

**User Story:** As a user, I want to speak into my microphone, so that my voice is sent to the AI for processing.

#### Acceptance Criteria

1. WHEN a Session is active, THE Frontend SHALL request microphone access from the browser using the Web Audio API.
2. IF the user denies microphone access, THEN THE Frontend SHALL display a permission error message and end the Session.
3. WHILE a Session is active, THE Frontend SHALL stream microphone audio to the OpenAI Realtime API over the established WebSocket connection using PCM16 encoding at 24 kHz.
4. WHILE a Session is active, THE Frontend SHALL use VAD to detect the start and end of user speech and visually indicate the current recording state (idle, listening, processing).

---

### Requirement 4: AI Audio and Text Response

**User Story:** As a user, I want to hear and see the AI's response, so that I can follow along with the training content.

#### Acceptance Criteria

1. WHEN the OpenAI Realtime API sends an audio delta event, THE Frontend SHALL play the audio output through the browser's audio output device in real time.
2. WHEN the OpenAI Realtime API sends a text transcript delta event, THE Frontend SHALL append the text to a visible transcript panel as it streams in.
3. WHEN an AI_Response is complete, THE Frontend SHALL display the full response text in the transcript panel with a clear visual separator between turns.
4. WHILE the AI_Response audio is playing, THE Frontend SHALL visually indicate that the AI is speaking.

---

### Requirement 5: Conversation Transcript

**User Story:** As a user, I want to see a running transcript of the conversation, so that I can review what was said during the session.

#### Acceptance Criteria

1. THE Frontend SHALL maintain a scrollable transcript panel that displays all user speech turns and AI_Response turns in chronological order.
2. WHEN a new turn is added to the transcript, THE Frontend SHALL automatically scroll the transcript panel to the most recent entry.
3. THE Frontend SHALL visually distinguish user turns from AI turns (e.g., different alignment or color).

---

### Requirement 6: Session Termination

**User Story:** As a user, I want to end the session at any time, so that I can stop the interaction gracefully.

#### Acceptance Criteria

1. WHEN the user clicks the "End Session" button, THE Frontend SHALL close the WebSocket connection to the OpenAI Realtime API.
2. WHEN the WebSocket connection is closed, THE Frontend SHALL stop microphone audio capture and release the microphone resource.
3. WHEN the Session ends, THE Frontend SHALL display the full conversation transcript and a "Start New Session" option.

---

### Requirement 7: Backend API

**User Story:** As a developer, I want a minimal FastAPI backend, so that the Frontend can securely obtain session credentials without exposing API keys.

#### Acceptance Criteria

1. THE Backend SHALL expose a `POST /session` endpoint that returns a JSON object containing the Session_Token.
2. THE Backend SHALL read the OpenAI API key from an environment variable named `OPENAI_API_KEY` and never expose it to the Frontend.
3. THE Backend SHALL include CORS headers that allow requests from the configured Frontend origin.
4. WHEN the `OPENAI_API_KEY` environment variable is not set at startup, THE Backend SHALL log an error and refuse to start.
5. THE Backend SHALL return all error responses as JSON objects with a `detail` field containing a human-readable message.

---

### Requirement 8: Development Environment Setup

**User Story:** As a developer, I want clear setup instructions, so that I can run the POC locally with minimal effort.

#### Acceptance Criteria

1. THE Frontend SHALL be runnable with a single command (`npm start` or `npm run dev`) after installing dependencies.
2. THE Backend SHALL be runnable with a single command (`uvicorn main:app --reload`) after installing Python dependencies listed in `requirements.txt`.
3. THE Frontend SHALL include a `.env.example` file documenting all required environment variables.
4. THE Backend SHALL include a `.env.example` file documenting the `OPENAI_API_KEY` variable.

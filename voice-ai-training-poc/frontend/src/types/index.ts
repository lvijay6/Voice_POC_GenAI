/**
 * Session lifecycle states.
 * idle       - No active session; initial state and state after ending.
 * connecting - Session token requested; WebSocket not yet open.
 * active     - WebSocket open and session confirmed by OpenAI.
 * ended      - Session was closed gracefully by the user.
 * error      - An unrecoverable error occurred (connection, mic, API).
 */
export type SessionStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

/**
 * Voice / audio processing states during an active session.
 * idle       - No audio activity.
 * listening  - VAD detected user speech.
 * processing - User speech ended; awaiting AI response.
 * speaking   - AI audio response is playing.
 */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

/**
 * A single conversation turn shown in the transcript panel.
 */
export interface Turn {
  /** UUID generated client-side to uniquely identify the turn. */
  id: string;
  /** Who produced this turn. */
  role: 'user' | 'assistant';
  /** Accumulated transcript text (may grow as deltas arrive). */
  text: string;
  /** True once the full response has been received (response.done event). */
  isFinal: boolean;
}

/**
 * Short-lived session credential returned by the backend POST /session endpoint.
 * Shape mirrors the OpenAI Realtime session response.
 */
export interface SessionToken {
  client_secret: {
    /** The ephemeral token value used to authenticate the WebSocket connection. */
    value: string;
    /** Unix timestamp (seconds) at which the token expires. */
    expires_at: number;
  };
}

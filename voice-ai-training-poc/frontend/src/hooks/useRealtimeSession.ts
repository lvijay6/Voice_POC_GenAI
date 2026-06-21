import { useState, useRef, useCallback } from 'react';
import { SessionStatus, VoiceState, Turn, SessionToken } from '../types';

// Feature: voice-ai-training-poc
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 6.1, 6.2

const OPENAI_REALTIME_URL =
  'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

/**
 * Encode a Float32Array of audio samples to a base64 PCM16 string.
 * Each float32 sample in [-1.0, 1.0] is clamped and scaled to Int16 range.
 */
function encodePCM16ToBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1] and scale to int16
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767;
    view.setInt16(i * 2, int16, true /* little-endian */);
  }
  // Convert ArrayBuffer → base64 in chunks to avoid stack overflow
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

/**
 * Decode a base64 PCM16 chunk and schedule playback via the provided AudioContext.
 * Accepts a playback-time cursor ref so chunks play sequentially without gaps.
 */
function schedulePCM16Playback(
  base64: string,
  audioContext: AudioContext,
  nextPlayTimeRef: React.MutableRefObject<number>
): void {
  try {
    // Decode base64 → binary → Uint8Array → Float32
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const sampleCount = bytes.length / 2;
    const float32 = new Float32Array(sampleCount);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < sampleCount; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }

    const audioBuffer = audioContext.createBuffer(1, sampleCount, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    const now = audioContext.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

interface UseRealtimeSessionReturn {
  sessionStatus: SessionStatus;
  voiceState: VoiceState;
  transcript: Turn[];
  errorMessage: string | null;
  startSession: (topic: string) => Promise<void>;
  endSession: () => void;
}

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mutable refs for WebSocket, audio, and media tracks
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Ref tracking the current assistant turn ID being assembled
  const currentAssistantTurnIdRef = useRef<string | null>(null);

  // Ref for scheduling sequential audio playback
  const nextPlayTimeRef = useRef<number>(0);

  /**
   * Generate a simple UUID-like ID for turns.
   */
  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * Clean up all resources: WebSocket, mic, AudioContext.
   */
  const cleanup = useCallback(() => {
    // Stop script processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    // Stop mic tracks (Requirement 6.2)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    // Close WebSocket (Requirement 6.1)
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    }
    nextPlayTimeRef.current = 0;
    currentAssistantTurnIdRef.current = null;
  }, []);

  /**
   * endSession: close WebSocket, stop mic, release AudioContext (Req 6.1, 6.2).
   */
  const endSession = useCallback(() => {
    cleanup();
    setSessionStatus('ended');
    setVoiceState('idle');
  }, [cleanup]);

  /**
   * startSession: fetch session token, open WebSocket, start mic capture.
   * Requirements: 1.1–1.6, 3.1–3.4
   */
  const startSession = useCallback(
    async (topic: string) => {
      // Reset state
      setErrorMessage(null);
      setTranscript([]);
      setVoiceState('idle');
      setSessionStatus('connecting');
      currentAssistantTurnIdRef.current = null;
      nextPlayTimeRef.current = 0;

      // ── Step 1: Fetch session token from backend (Req 1.1, 1.2) ──────────
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

      let ephemeralToken: string;
      try {
        const response = await fetch(`${backendUrl}/session`, {
          method: 'POST',
        });
        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const body = await response.json();
            if (body?.detail) detail = body.detail;
          } catch {}
          throw new Error(detail);
        }
        const sessionToken: SessionToken = await response.json();
        ephemeralToken = sessionToken.client_secret.value;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to fetch session token';
        setErrorMessage(msg);
        setSessionStatus('error'); // Req 1.6
        return;
      }

      // ── Step 2: Open WebSocket to OpenAI Realtime API (Req 1.3) ──────────
      // Use Sec-WebSocket-Protocol trick — pass token as subprotocol
      let ws: WebSocket;
      try {
        ws = new WebSocket(OPENAI_REALTIME_URL, [
          'realtime',
          `openai-insecure-api-key.${ephemeralToken}`,
          'openai-beta.realtime-v1',
        ]);
      } catch (err) {
        setErrorMessage('Failed to open WebSocket connection');
        setSessionStatus('error'); // Req 1.5
        return;
      }
      wsRef.current = ws;

      // ── Step 3: Request microphone access (Req 3.1, 3.2) ─────────────────
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setErrorMessage(
          'Microphone access denied. Please allow microphone access and try again.'
        );
        setSessionStatus('error'); // Req 3.2
        // Close ws since we can't proceed
        ws.close();
        wsRef.current = null;
        return;
      }
      mediaStreamRef.current = mediaStream;

      // ── Step 4: Set up AudioContext and ScriptProcessorNode for PCM capture ──
      // (Req 3.3 — PCM16 at 24 kHz)
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(mediaStream);
      // bufferSize 4096, 1 input channel, 1 output channel
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          const inputData = event.inputBuffer.getChannelData(0);
          const base64Audio = encodePCM16ToBase64(inputData);
          wsRef.current.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio,
            })
          );
        }
      };

      source.connect(scriptProcessor);
      // Connect to destination (silent) so onaudioprocess fires
      scriptProcessor.connect(audioContext.destination);

      // ── Step 5: WebSocket event handlers ─────────────────────────────────
      ws.onerror = () => {
        setErrorMessage('WebSocket connection error');
        setSessionStatus('error'); // Req 1.5
        cleanup();
      };

      ws.onclose = (event) => {
        // Only transition to error if we didn't close it intentionally
        if (wsRef.current !== null) {
          // Unexpected close
          if (sessionStatus !== 'ended') {
            setErrorMessage('WebSocket connection closed unexpectedly');
            setSessionStatus('error');
          }
          cleanup();
        }
      };

      ws.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const type = data.type as string;

        switch (type) {
          case 'session.created': {
            // Send session.update with system prompt and audio config (Req 2.2)
            ws.send(
              JSON.stringify({
                type: 'session.update',
                session: {
                  modalities: ['audio', 'text'],
                  instructions: `You are an AI tutor focused on ${topic}. Be concise and educational.`,
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  input_audio_transcription: { model: 'whisper-1' },
                  turn_detection: { type: 'server_vad' },
                },
              })
            );
            setSessionStatus('active'); // Req 1.3
            break;
          }

          case 'input_audio_buffer.speech_started': {
            // Req 3.4 — VAD detected user speech start
            setVoiceState('listening');
            break;
          }

          case 'input_audio_buffer.speech_stopped': {
            // Req 3.4 — VAD detected user speech end
            setVoiceState('processing');
            break;
          }

          case 'response.audio.delta': {
            // Req 4.1 — play incoming audio chunk
            const delta = data.delta as string | undefined;
            if (delta && audioContextRef.current) {
              schedulePCM16Playback(delta, audioContextRef.current, nextPlayTimeRef);
            }
            setVoiceState('speaking'); // Req 4.4
            break;
          }

          case 'response.audio_transcript.delta': {
            // Req 4.2 — append text delta to current assistant turn
            const textDelta = data.delta as string | undefined;
            if (!textDelta) break;

            setTranscript((prev) => {
              // If we don't have a current assistant turn, create one
              if (!currentAssistantTurnIdRef.current) {
                const newTurnId = generateId();
                currentAssistantTurnIdRef.current = newTurnId;
                return [
                  ...prev,
                  {
                    id: newTurnId,
                    role: 'assistant',
                    text: textDelta,
                    isFinal: false,
                  } as Turn,
                ];
              }
              // Append to the existing assistant turn
              return prev.map((turn) =>
                turn.id === currentAssistantTurnIdRef.current
                  ? { ...turn, text: turn.text + textDelta }
                  : turn
              );
            });
            break;
          }

          case 'response.audio.done': {
            // Req 4.4 — AI audio playback finished
            setVoiceState('idle');
            break;
          }

          case 'response.done': {
            // Req 4.3 — mark current assistant turn as final
            const turnId = currentAssistantTurnIdRef.current;
            if (turnId) {
              setTranscript((prev) =>
                prev.map((turn) =>
                  turn.id === turnId ? { ...turn, isFinal: true } : turn
                )
              );
              currentAssistantTurnIdRef.current = null;
            }
            break;
          }

          case 'error': {
            const errMsg =
              ((data.error as Record<string, unknown>)?.message as string) ||
              'OpenAI Realtime API error';
            setErrorMessage(errMsg);
            setSessionStatus('error');
            break;
          }

          default:
            // Ignore unhandled event types
            break;
        }
      };
    },
    [cleanup, sessionStatus]
  );

  return {
    sessionStatus,
    voiceState,
    transcript,
    errorMessage,
    startSession,
    endSession,
  };
}

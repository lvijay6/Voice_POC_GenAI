import React from 'react';
import { SessionStatus } from '../types';

interface SessionControlsProps {
  sessionStatus: SessionStatus;
  errorMessage: string | null;
  onStart: () => void;
  onEnd: () => void;
}

/**
 * Renders the session start/end controls and a status label.
 * - Shows "Start Session" when idle or ended (Req 1.1, 6.3)
 * - Shows "End Session" when connecting or active (Req 6.1)
 * - Displays current session state as a status label
 */
const SessionControls: React.FC<SessionControlsProps> = ({
  sessionStatus,
  errorMessage,
  onStart,
  onEnd,
}) => {
  const showStartButton =
    sessionStatus === 'idle' || sessionStatus === 'ended';
  const showEndButton =
    sessionStatus === 'active' || sessionStatus === 'connecting';

  const renderStatusLabel = () => {
    switch (sessionStatus) {
      case 'connecting':
        return (
          <span style={styles.statusConnecting} aria-live="polite">
            Connecting…
          </span>
        );
      case 'active':
        return (
          <span style={styles.statusActive} aria-live="polite">
            Session Active
          </span>
        );
      case 'ended':
        return (
          <span style={styles.statusEnded} aria-live="polite">
            Session Ended
          </span>
        );
      case 'error':
        return (
          <span style={styles.statusError} role="alert">
            {errorMessage ?? 'An error occurred'}
          </span>
        );
      case 'idle':
      default:
        return (
          <span style={styles.statusIdle} aria-live="polite">
            Ready
          </span>
        );
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.buttonRow}>
        {showStartButton && (
          <button
            onClick={onStart}
            style={{ ...styles.button, ...styles.startButton }}
            aria-label="Start voice training session"
          >
            Start Session
          </button>
        )}
        {showEndButton && (
          <button
            onClick={onEnd}
            style={{ ...styles.button, ...styles.endButton }}
            aria-label="End voice training session"
          >
            End Session
          </button>
        )}
      </div>
      <div style={styles.statusRow}>{renderStatusLabel()}</div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
  },
  startButton: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
  },
  endButton: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
  },
  statusRow: {
    minHeight: '22px',
  },
  statusIdle: {
    fontSize: '14px',
    color: '#6b7280',
  },
  statusConnecting: {
    fontSize: '14px',
    color: '#d97706',
    fontStyle: 'italic',
  },
  statusActive: {
    fontSize: '14px',
    color: '#16a34a',
    fontWeight: 600,
  },
  statusEnded: {
    fontSize: '14px',
    color: '#6b7280',
  },
  statusError: {
    fontSize: '14px',
    color: '#dc2626',
    fontWeight: 500,
  },
};

export default SessionControls;

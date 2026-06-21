import React, { useEffect, useRef } from 'react';
import { Turn } from '../types';

interface TranscriptPanelProps {
  transcript: Turn[];
}

/**
 * Renders a scrollable list of conversation turns.
 * - User turns: right-aligned with a light blue background (Req 5.3)
 * - Assistant turns: left-aligned with a light grey background (Req 5.3)
 * - Auto-scrolls to the latest turn whenever the transcript changes (Req 5.2)
 * - Shows a placeholder when the transcript is empty (Req 5.1)
 */
const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ transcript }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever a new turn is added or updated
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  return (
    <div style={styles.panel} role="log" aria-label="Conversation transcript" aria-live="polite">
      {transcript.length === 0 ? (
        <p style={styles.placeholder}>Your conversation will appear here.</p>
      ) : (
        transcript.map((turn) => {
          const isUser = turn.role === 'user';
          return (
            <div
              key={turn.id}
              style={{
                ...styles.turnWrapper,
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  ...(isUser ? styles.userBubble : styles.assistantBubble),
                }}
              >
                <span style={styles.roleLabel}>
                  {isUser ? 'You' : 'AI Tutor'}
                </span>
                <p style={styles.turnText}>{turn.text}</p>
              </div>
            </div>
          );
        })
      )}
      {/* Sentinel element to scroll into view */}
      <div ref={bottomRef} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '400px',
    overflowY: 'auto',
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#f9fafb',
    marginBottom: '16px',
  },
  placeholder: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
    margin: 'auto',
  },
  turnWrapper: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: '12px',
    wordBreak: 'break-word',
  },
  userBubble: {
    backgroundColor: '#dbeafe',  // light blue
    borderBottomRightRadius: '2px',
  },
  assistantBubble: {
    backgroundColor: '#f3f4f6',  // light grey
    borderBottomLeftRadius: '2px',
  },
  roleLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#6b7280',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  turnText: {
    margin: 0,
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#111827',
  },
};

export default TranscriptPanel;

import React from 'react';
import { VoiceState } from '../types';

interface VoiceIndicatorProps {
  voiceState: VoiceState;
}

/**
 * Renders an animated visual indicator reflecting the current voice/audio state.
 * - idle       → grey dot, "Ready"
 * - listening  → green pulsing dot, "Listening…"
 * - processing → yellow pulsing dot, "Processing…"
 * - speaking   → blue pulsing bar, "AI Speaking…"
 *
 * Animations are defined via a <style> tag injected into the component (Req 4.4).
 */
const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ voiceState }) => {
  const config = STATE_CONFIG[voiceState];

  return (
    <>
      <style>{KEYFRAMES_CSS}</style>
      <div style={styles.container} aria-live="polite" aria-label={`Voice state: ${config.label}`}>
        <div style={{ ...styles.indicator, ...config.indicatorStyle }} />
        <span style={{ ...styles.label, color: config.color }}>{config.label}</span>
      </div>
    </>
  );
};

/** CSS keyframe animations injected as a style block */
const KEYFRAMES_CSS = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.7; }
  }

  @keyframes barPulse {
    0%, 100% { transform: scaleY(1); opacity: 1; }
    50% { transform: scaleY(2); opacity: 0.7; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

interface StateConfig {
  label: string;
  color: string;
  indicatorStyle: React.CSSProperties;
}

const STATE_CONFIG: Record<VoiceState, StateConfig> = {
  idle: {
    label: 'Ready',
    color: '#6b7280',
    indicatorStyle: {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      backgroundColor: '#9ca3af',
    },
  },
  listening: {
    label: 'Listening…',
    color: '#16a34a',
    indicatorStyle: {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      backgroundColor: '#22c55e',
      animation: 'pulse 1s ease-in-out infinite',
    },
  },
  processing: {
    label: 'Processing…',
    color: '#d97706',
    indicatorStyle: {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      backgroundColor: '#f59e0b',
      animation: 'pulse 0.7s ease-in-out infinite',
    },
  },
  speaking: {
    label: 'AI Speaking…',
    color: '#2563eb',
    indicatorStyle: {
      width: '6px',
      height: '20px',
      borderRadius: '3px',
      backgroundColor: '#3b82f6',
      animation: 'barPulse 0.6s ease-in-out infinite',
    },
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 0',
    marginBottom: '16px',
  },
  indicator: {
    flexShrink: 0,
    transformOrigin: 'center',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
  },
};

export default VoiceIndicator;

import React from 'react';
import { SessionStatus } from '../types';
import { DEFAULT_TOPIC } from '../constants';

interface TopicSelectorProps {
  topics: string[];
  selectedTopic: string;
  onTopicChange: (topic: string) => void;
  sessionStatus: SessionStatus;
}

/**
 * Renders a dropdown allowing the user to pick a training topic.
 * Disabled while a session is connecting or active (Req 2.1, 2.3).
 */
const TopicSelector: React.FC<TopicSelectorProps> = ({
  topics,
  selectedTopic,
  onTopicChange,
  sessionStatus,
}) => {
  // Disabled only when a session is in progress; allow re-selection when idle or ended
  const isDisabled = sessionStatus === 'connecting' || sessionStatus === 'active';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onTopicChange(e.target.value);
  };

  // Use default topic as fallback if selectedTopic is somehow empty
  const value = selectedTopic || DEFAULT_TOPIC;

  return (
    <div style={styles.container}>
      <label htmlFor="topic-selector" style={styles.label}>
        Training Topic
      </label>
      <select
        id="topic-selector"
        value={value}
        onChange={handleChange}
        disabled={isDisabled}
        style={{
          ...styles.select,
          ...(isDisabled ? styles.selectDisabled : {}),
        }}
        aria-label="Select a training topic"
      >
        {topics.map((topic) => (
          <option key={topic} value={topic}>
            {topic}
          </option>
        ))}
      </select>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  select: {
    padding: '8px 12px',
    fontSize: '15px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#111827',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  selectDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
};

export default TopicSelector;

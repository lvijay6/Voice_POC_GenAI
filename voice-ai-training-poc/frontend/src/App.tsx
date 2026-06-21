import React, { useState } from 'react';
import './App.css';
import { useRealtimeSession } from './hooks/useRealtimeSession';
import TopicSelector from './components/TopicSelector';
import SessionControls from './components/SessionControls';
import VoiceIndicator from './components/VoiceIndicator';
import TranscriptPanel from './components/TranscriptPanel';
import { TRAINING_TOPICS, DEFAULT_TOPIC } from './constants';

/**
 * Root application component.
 * Wires together the useRealtimeSession hook with the UI components.
 * Requirements: 1.1, 2.1, 2.2, 2.3, 4.4, 5.1, 5.2, 5.3, 6.3
 */
function App() {
  const [selectedTopic, setSelectedTopic] = useState<string>(DEFAULT_TOPIC);

  const {
    sessionStatus,
    voiceState,
    transcript,
    errorMessage,
    startSession,
    endSession,
  } = useRealtimeSession();

  const handleStart = () => {
    startSession(selectedTopic);
  };

  return (
    <div className="app-root">
      <div className="app-card">
        <h1 className="app-title">Voice AI Training POC</h1>

        <TopicSelector
          topics={TRAINING_TOPICS}
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
          sessionStatus={sessionStatus}
        />

        <SessionControls
          sessionStatus={sessionStatus}
          errorMessage={errorMessage}
          onStart={handleStart}
          onEnd={endSession}
        />

        <VoiceIndicator voiceState={voiceState} />

        <TranscriptPanel transcript={transcript} />
      </div>
    </div>
  );
}

export default App;

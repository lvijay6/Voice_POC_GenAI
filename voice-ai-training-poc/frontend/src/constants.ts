/**
 * List of selectable training topics shown in the TopicSelector.
 * The first entry ("General Knowledge") is used as the default
 * when no explicit selection has been made (Requirement 2.3).
 */
export const TRAINING_TOPICS: string[] = [
  'General Knowledge',
  'Python Basics',
  'SQL Joins',
  'Data Structures',
  'Machine Learning Concepts',
];

/** Default topic applied when the user has not made an explicit selection. */
export const DEFAULT_TOPIC = TRAINING_TOPICS[0];

// Simple API configuration utility
export const getApiUrl = (endpoint: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  return `${baseUrl}${endpoint}`;
};

// Common API endpoints
export const API_URLS = {
  CHAT: () => getApiUrl('/api/chat'),
  USER_CONVERSATIONS: (userId: string) => getApiUrl(`/api/users/${userId}/conversations`),
  CONVERSATION_MESSAGES: (convId: string) => getApiUrl(`/api/conversations/${convId}/messages`),
  USER_SESSIONS: (userId: string) => getApiUrl(`/api/users/${userId}/sessions`),
  SESSION_TAGS: (sessionId: string) => getApiUrl(`/api/sessions/${sessionId}/tags`),
  SESSION_QUIZ_START: (sessionId: string) => getApiUrl(`/api/sessions/${sessionId}/quiz/start`),
  QUIZ_ANSWER: (quizId: string) => getApiUrl(`/api/quiz/${quizId}/answer`),
  QUIZ_ASK_QUESTION: (quizId: string) => getApiUrl(`/api/quiz/${quizId}/ask-question`),
  QUIZ_MESSAGES: (quizId: string) => getApiUrl(`/api/quiz/${quizId}/messages`),
  KNOWLEDGE_GRAPH: () => getApiUrl('/api/knowledge-graph'),
};

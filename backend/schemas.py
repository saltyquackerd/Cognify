from datetime import datetime
from typing import List, Dict, Optional
import uuid

class UserSchema:
    """User schema based on app.py data structure"""
    
    @staticmethod
    def create_user_document(user_id: str, username: str = None, email: str = None, google_id: str = None, name: str = None, picture: str = None) -> Dict:
        """Create a new user document with Google Auth support"""
        return {
            '_id': user_id,
            'username': username,
            'email': email,
            'name': name,
            'picture': picture,
            'google_id': google_id,
            'auth_provider': 'google' if google_id else 'local',
            'created_at': datetime.now().isoformat(),
            'last_login': datetime.now().isoformat(),
            'sessions': []
        }
    
    @staticmethod
    def validate_user_data(data: Dict) -> bool:
        """Validate user data structure"""
        required_fields = ['username']
        return all(field in data for field in required_fields)

class SessionSchema:
    """Session schema based on app.py data structure"""
    
    @staticmethod
    def create_session_document(session_id: str, user_id: str) -> Dict:
        """Create a new session document matching app.py structure"""
        return {
            '_id': session_id,
            'user_id': user_id,
            'created_at': datetime.now().isoformat(),
            'messages': [],
            'quizzes': [],
            'conversation_history': []
        }
    
    @staticmethod
    def validate_session_data(data: Dict) -> bool:
        """Validate session data structure"""
        required_fields = ['user_id']
        return all(field in data for field in required_fields)

class MessageSchema:
    """Message schema with message_id, message, timestamp, role"""
    
    @staticmethod
    def create_message_document(message: str, role: str) -> Dict:
        """Create a single message document"""
        return {
            'message_id': str(uuid.uuid4()),
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'role': role
        }
    
    @staticmethod
    def validate_message_data(data: Dict) -> bool:
        """Validate message data structure"""
        required_fields = ['message', 'role']
        valid_roles = ['user', 'assistant']
        return (
            all(field in data for field in required_fields) and
            data.get('role') in valid_roles
        )

class QuizSchema:
    """Quiz schema based on app.py data structure"""
    
    @staticmethod
    def create_quiz_document(
        quiz_id: str, 
        session_id: str, 
        user_id: str, 
        message_id: str, 
        quiz_questions: List[Dict],
        target_message: Dict
    ) -> Dict:
        """Create a new quiz document matching app.py structure"""
        return {
            '_id': quiz_id,
            'session_id': session_id,
            'user_id': user_id,
            'message_id': message_id,
            'questions': quiz_questions,
            'current_question_index': 0,
            'completed': False,
            'created_at': datetime.now().isoformat(),
            'conversation_history': [
                {"role": "user", "content": target_message['user_message']},
                {"role": "assistant", "content": target_message['chat_response']},
                {"role": "assistant", "content": f"Quiz Questions:\n" + "\n".join([f"Q{i+1}: {q['question']}" for i, q in enumerate(quiz_questions)])}
            ]
        }
    
    @staticmethod
    def validate_quiz_data(data: Dict) -> bool:
        """Validate quiz data structure"""
        required_fields = ['session_id', 'user_id', 'message_id', 'questions']
        return all(field in data for field in required_fields)

class ConversationHistorySchema:
    """Conversation history schema for LLM format"""
    
    @staticmethod
    def create_history_entry(role: str, content: str) -> Dict:
        """Create a conversation history entry"""
        return {
            "role": role,
            "content": content
        }
    
    @staticmethod
    def validate_history_entry(data: Dict) -> bool:
        """Validate conversation history entry"""
        required_fields = ['role', 'content']
        valid_roles = ['user', 'assistant']
        return (
            all(field in data for field in required_fields) and
            data.get('role') in valid_roles
        )

# Database collection names
COLLECTIONS = {
    'users': 'users',
    'sessions': 'sessions',
    'quizzes': 'quizzes'
}

# Index definitions for better query performance
INDEXES = {
    'users': [
        [('username', 1)],  # Unique index on username
        [('created_at', -1)]
    ],
    'sessions': [
        [('user_id', 1), ('created_at', -1)],  # User sessions chronologically
        [('created_at', -1)]
    ],
    'quizzes': [
        [('user_id', 1), ('created_at', -1)],        # User quizzes
        [('session_id', 1)],                         # Quizzes by session
        [('completed', 1), ('created_at', -1)]       # Completed quizzes
    ]
}

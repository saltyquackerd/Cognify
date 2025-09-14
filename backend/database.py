import os
from pymongo import MongoClient
from datetime import datetime
from typing import List, Dict, Optional
import uuid
from schemas import UserSchema, SessionSchema, MessageSchema, QuizSchema, COLLECTIONS, INDEXES

class DatabaseService:
    def __init__(self):
        self.mongo_uri = os.getenv('MONGO_URI')
        if not self.mongo_uri:
            raise ValueError("MONGO_URI environment variable is required")
        self.client = None
        self.db = None
        self.conversations_collection = None
        self.messages_collection = None
        self.quizzes_collection = None
        self.connect()
    
    def connect(self):
        """Connect to MongoDB using cloud URI from .env file"""
        try:
            # Connect to cloud MongoDB with SSL parameters
            self.client = MongoClient(
                self.mongo_uri,
                tls=True,
                tlsAllowInvalidCertificates=True,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000
            )
            
            self.db = self.client['cognify']
            self.users_collection = self.db[COLLECTIONS['users']]
            self.sessions_collection = self.db[COLLECTIONS['sessions']]
            self.quizzes_collection = self.db[COLLECTIONS['quizzes']]
            
            # Create indexes for better performance
            self._create_indexes()
            
            # Test connection
            self.client.admin.command('ping')
            print("Successfully connected to cloud MongoDB")
        except Exception as e:
            print(f"Failed to connect to cloud MongoDB: {e}")
            raise ConnectionError(f"Could not connect to MongoDB: {e}")
    
    def _create_indexes(self):
        """Create database indexes for better performance"""
        try:
            for collection_name, indexes in INDEXES.items():
                collection = self.db[COLLECTIONS[collection_name]]
                for index_spec in indexes:
                    collection.create_index(index_spec)
        except Exception as e:
            print(f"Warning: Failed to create indexes: {e}")
    
    def is_connected(self) -> bool:
        """Check if database is connected"""
        return self.client is not None
    
    # User CRUD operations
    def create_user(self, username: str = None, email: str = None, google_id: str = None, name: str = None, picture: str = None) -> str:
        """Create a new user with Google Auth support"""
        if not self.is_connected():
            return None
        
        try:
            # Check if user already exists (by email or google_id)
            existing_user = None
            if google_id:
                existing_user = self.users_collection.find_one({'google_id': google_id})
            elif email:
                existing_user = self.users_collection.find_one({'email': email})
            elif username:
                existing_user = self.users_collection.find_one({'username': username})
            
            if existing_user:
                return existing_user['_id']  # Return existing user ID
            
            user_id = str(uuid.uuid4())
            user_doc = UserSchema.create_user_document(user_id, username, email, google_id, name, picture)
            self.users_collection.insert_one(user_doc)
            return user_id
        except Exception as e:
            print(f"Error creating user: {e}")
            return None
    
    def get_user_by_google_id(self, google_id: str) -> Optional[Dict]:
        """Get a user by Google ID"""
        if not self.is_connected():
            return None
        
        try:
            user = self.users_collection.find_one({'google_id': google_id})
            return user
        except Exception as e:
            print(f"Error getting user by Google ID: {e}")
            return None
    
    def update_user_login(self, user_id: str) -> bool:
        """Update user's last login timestamp"""
        if not self.is_connected():
            return False
        
        try:
            result = self.users_collection.update_one(
                {'_id': user_id},
                {'$set': {'last_login': datetime.now().isoformat()}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating user login: {e}")
            return False
    
    def get_user(self, user_id: str) -> Optional[Dict]:
        """Get a user by ID"""
        if not self.is_connected():
            return None
        
        try:
            user = self.users_collection.find_one({'_id': user_id})
            return user
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def add_session_to_user(self, user_id: str, session_id: str) -> bool:
        """Add a session ID to user's sessions list"""
        if not self.is_connected():
            return False
        
        try:
            result = self.users_collection.update_one(
                {'_id': user_id},
                {'$push': {'sessions': session_id}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error adding session to user: {e}")
            return False
    
    # Session CRUD operations
    def create_session(self, user_id: str) -> str:
        """Create a new session"""
        if not self.is_connected():
            return None
        
        try:
            session_id = str(uuid.uuid4())
            session_doc = SessionSchema.create_session_document(session_id, user_id)
            self.sessions_collection.insert_one(session_doc)
            
            # Add session to user's sessions list
            self.add_session_to_user(user_id, session_id)
            
            return session_id
        except Exception as e:
            print(f"Error creating session: {e}")
            return None
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get a session by ID"""
        if not self.is_connected():
            return None
        
        try:
            session = self.sessions_collection.find_one({'_id': session_id})
            return session
        except Exception as e:
            print(f"Error getting session: {e}")
            return None
    
    def get_user_sessions(self, user_id: str) -> List[Dict]:
        """Get all sessions for a user"""
        if not self.is_connected():
            return []
        
        try:
            sessions = list(self.sessions_collection.find(
                {'user_id': user_id}
            ).sort('created_at', -1))
            return sessions
        except Exception as e:
            print(f"Error getting user sessions: {e}")
            return []
    
    def add_message_to_session(self, session_id: str, user_message: str, chat_response: str) -> str:
        """Add a message to a session"""
        if not self.is_connected():
            return None
        
        try:
            message_id = str(uuid.uuid4())
            message_doc = MessageSchema.create_message_document(message_id, user_message, chat_response)
            
            # Add message to session's messages array
            result = self.sessions_collection.update_one(
                {'_id': session_id},
                {'$push': {'messages': message_doc}}
            )
            
            if result.modified_count > 0:
                return message_id
            return None
        except Exception as e:
            print(f"Error adding message to session: {e}")
            return None
    
    def add_conversation_history(self, session_id: str, role: str, content: str) -> bool:
        """Add entry to session's conversation history"""
        if not self.is_connected():
            return False
        
        try:
            history_entry = {"role": role, "content": content}
            result = self.sessions_collection.update_one(
                {'_id': session_id},
                {'$push': {'conversation_history': history_entry}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error adding conversation history: {e}")
            return False
    
    def get_session_conversation_history(self, session_id: str) -> List[Dict]:
        """Get conversation history for a session"""
        if not self.is_connected():
            return []
        
        try:
            session = self.sessions_collection.find_one({'_id': session_id})
            if session:
                return session.get('conversation_history', [])
            return []
        except Exception as e:
            print(f"Error getting conversation history: {e}")
            return []
    
    def add_quiz_to_session(self, session_id: str, quiz_id: str) -> bool:
        """Add a quiz ID to session's quizzes list"""
        if not self.is_connected():
            return False
        
        try:
            result = self.sessions_collection.update_one(
                {'_id': session_id},
                {'$push': {'quizzes': quiz_id}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error adding quiz to session: {e}")
            return False
    
    
    # Quiz operations
    def create_quiz(self, session_id: str, user_id: str, message_id: str, quiz_questions: List[Dict], target_message: Dict) -> str:
        """Create a quiz"""
        if not self.is_connected():
            return None
        
        try:
            quiz_id = str(uuid.uuid4())
            quiz_doc = QuizSchema.create_quiz_document(
                quiz_id, session_id, user_id, message_id, quiz_questions, target_message
            )
            
            self.quizzes_collection.insert_one(quiz_doc)
            
            # Add quiz to session's quizzes list
            self.add_quiz_to_session(session_id, quiz_id)
            
            return quiz_id
        except Exception as e:
            print(f"Error creating quiz: {e}")
            return None
    
    def get_quiz(self, quiz_id: str) -> Optional[Dict]:
        """Get a quiz"""
        if not self.is_connected():
            return None
        
        try:
            quiz = self.quizzes_collection.find_one({'_id': quiz_id})
            return quiz
        except Exception as e:
            print(f"Error getting quiz: {e}")
            return None
    
    def update_quiz(self, quiz_id: str, updates: Dict) -> bool:
        """Update a quiz"""
        if not self.is_connected():
            return False
        
        try:
            result = self.quizzes_collection.update_one(
                {'_id': quiz_id},
                {'$set': updates}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating quiz: {e}")
            return False
    
    def add_quiz_conversation_history(self, quiz_id: str, role: str, content: str) -> bool:
        """Add entry to quiz's conversation history"""
        if not self.is_connected():
            return False
        
        try:
            history_entry = {"role": role, "content": content}
            result = self.quizzes_collection.update_one(
                {'_id': quiz_id},
                {'$push': {'conversation_history': history_entry}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error adding quiz conversation history: {e}")
            return False
    
    def close_connection(self):
        """Close database connection"""
        if self.client:
            self.client.close()

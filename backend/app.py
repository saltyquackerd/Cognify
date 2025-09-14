import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime
from dotenv import load_dotenv
from llm_service import LLM
from auth import SimpleAuth

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize services
llm_service = LLM()
auth_service = SimpleAuth()

# In-memory storage for demo purposes (use a database in production)
# Data structure: users -> sessions -> quizzes
users = {}  # user_id -> user_data
sessions = {}  # session_id -> session_data  
quizzes = {}  # quiz_id -> quizzes

# Add test data
def initialize_test_data():
    """Initialize test data for development and testing"""
    global users, sessions, quizzes
    
    # Test user
    users['1'] = {
        'id': '1',
        'username': 'alice',
        'created_at': '2024-01-15T10:30:00',
        'sessions': ['session1', 'session2']
    }
    
    # Test sessions
    sessions['session1'] = {
        'id': 'session1',
        'user_id': '1',
        'created_at': '2024-01-15T10:30:00',
        'title': 'React component',
        'messages': [
            {
                'id': 'msg1',
                'user_message': 'How to create a button component?',
                'chat_response': 'Here is how to create a button component...',
                'timestamp': '2024-01-15T10:30:00'
            }
        ],
        'quizzes': [],
        'conversation_history': [
            {"role": "user", "content": "How to create a button component?"},
            {"role": "assistant", "content": "Here is how to create a button component..."}
        ]
    }
    
    sessions['session2'] = {
        'id': 'session2',
        'user_id': '1', 
        'created_at': '2024-01-14T15:45:00',
        'title': 'JavaScript patterns',
        'messages': [
            {
                'id': 'msg2',
                'user_message': 'What are async/await best practices?',
                'chat_response': 'Async/await best practices include...',
                'timestamp': '2024-01-14T15:45:00'
            }
        ],
        'quizzes': [],
        'conversation_history': [
            {"role": "user", "content": "What are async/await best practices?"},
            {"role": "assistant", "content": "Async/await best practices include..."}
        ]
    }

# Initialize test data
initialize_test_data()

# Authentication Routes
@app.route('/api/auth/google', methods=['POST'])
def google_oauth():
    """Handle Google OAuth authentication"""
    try:
        data = request.get_json()
        id_token = data.get('id_token')
        
        if not id_token:
            return jsonify({'error': 'ID token is required'}), 400
        
        # Verify Google token
        user_info = auth_service.verify_google_token(id_token)
        if not user_info:
            return jsonify({'error': 'Invalid Google token or OAuth not configured'}), 401
        
        # Check if user exists, create if not
        user_id = user_info['id']
        if user_id not in users:
            users[user_id] = {
                'id': user_id,
                'username': user_info['name'],
                'email': user_info['email'],
                'picture': user_info.get('picture', ''),
                'is_guest': False,
                'created_at': datetime.now().isoformat(),
                'sessions': []
            }
        
        return jsonify({
            'user': {
                'id': user_id,
                'username': user_info['name'],
                'email': user_info['email'],
                'picture': user_info.get('picture', ''),
                'is_guest': False
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/guest', methods=['POST'])
def guest_login():
    """Handle guest login with just a username"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        # Create guest user
        user_info = auth_service.create_guest_user(username)
        user_id = user_info['id']
        
        # Store guest user
        users[user_id] = {
            'id': user_id,
            'username': user_info['name'],
            'email': '',
            'picture': '',
            'is_guest': True,
            'created_at': datetime.now().isoformat(),
            'sessions': []
        }
        
        return jsonify({
            'user': {
                'id': user_id,
                'username': user_info['name'],
                'email': '',
                'picture': '',
                'is_guest': True
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/config', methods=['GET'])
def auth_config():
    """Get authentication configuration"""
    return jsonify({
        'google_oauth_enabled': bool(auth_service.google_client_id),
        'guest_enabled': True
    })

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        username = data.get('username', '')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        # Check if username already exists
        for user_id, user_data in users.items():
            if user_data.get('username') == username:
                return jsonify({'error': 'Username already exists'}), 409
        
        # Create new user
        user_id = str(uuid.uuid4())
        users[user_id] = {
            'id': user_id,
            'username': username,
            'created_at': datetime.now().isoformat(),
            'sessions': []
        }
        
        return jsonify({
            'user_id': user_id,
            'username': username,
            'created_at': users[user_id]['created_at']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get user information"""
    try:
        if user_id not in users:
            return jsonify({'error': 'User not found'}), 404
        
        user = users[user_id]
        return jsonify({
            'user_id': user_id,
            'username': user['username'],
            'created_at': user['created_at'],
            'session_count': len(user['sessions'])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<user_id>/sessions', methods=['POST'])
def create_session(user_id):
    """Create a new chat session for a user"""
    try:
        if user_id not in users:
            return jsonify({'error': 'User not found'}), 404
        
        # Create new session
        session_id = str(uuid.uuid4())
        sessions[session_id] = {
            'id': session_id,
            'user_id': user_id,
            'created_at': datetime.now().isoformat(),
            'title': '',
            'messages': [],
            'quizzes': [],
            'conversation_history': []
        }
        
        # Add session to user
        users[user_id]['sessions'].append(session_id)
        
        return jsonify({
            'session_id': session_id,
            'user_id': user_id,
            'created_at': sessions[session_id]['created_at']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests with conversation context"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        session_id = data.get('session_id', '')
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400
        
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        
        # Get response from Cerebras with conversation context
        chat_response = llm_service.get_chat_response(user_message, session['conversation_history'])
        
        # Add user message and AI response to conversation history
        session['conversation_history'].append({"role": "user", "content": user_message})
        session['conversation_history'].append({"role": "assistant", "content": chat_response})
        
        # Set title after first user question if title is still empty
        if not session['title']:
            summary = f"User message: {user_message}\nChat response: {chat_response}"
            session['title'] = llm_service.get_title(summary)
        
        # Store the conversation
        message_id = str(uuid.uuid4())
        session['messages'].append({
            'id': message_id,
            'user_message': user_message,
            'chat_response': chat_response,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            'session_id': session_id,
            'message_id': message_id,
            'chat_response': chat_response,
            'user_id': session['user_id'],
            'title': session['title']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-quiz-thread', methods=['POST'])
def create_quiz_thread():
    """Create a quiz thread from a specific chat response"""
    try:
        data = request.get_json()
        message_id = data.get('message_id', '')
        session_id = data.get('session_id', '')
        
        if not message_id or not session_id:
            return jsonify({'error': 'Message ID and Session ID are required'}), 400
        
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        # Find the specific message (search from bottom for recent messages)
        target_message = None
        messages = sessions[session_id]['messages']
        for i in range(len(messages) - 1, -1, -1):
            if messages[i]['id'] == message_id:
                target_message = messages[i]
                break
        
        if not target_message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Generate quiz questions from the specific response
        quiz_questions_text = llm_service.generate_quiz_questions(target_message['chat_response'])
        
        # Create a single question structure from the generated text
        quiz_questions = [{
            'id': str(uuid.uuid4()),
            'type': 'long_answer',
            'question': quiz_questions_text,
            'source_text': target_message['chat_response']
        }]
        
        # Create quiz thread
        quiz_id = str(uuid.uuid4())
        quizzes[quiz_id] = {
            'id': quiz_id,
            'session_id': session_id,
            'user_id': sessions[session_id]['user_id'],
            'message_id': message_id,
            'questions': quiz_questions,
            'current_question_index': 0,
            'completed': False,
            'created_at': datetime.now().isoformat(),
            'conversation_history': [
                {"role": "user", "content": target_message['user_message']},
                {"role": "assistant", "content": target_message['chat_response']},
                {"role": "assistant", "content": f"Quiz Questions:\n" + "\n".join([f"Q{i+1}: {q['question']}" for i, q in enumerate(quiz_questions)])}
            ]  # Track complete quiz thread conversation in LLM-ready format
        }
        
        sessions[session_id]['quizzes'].append(quiz_id)
        
        return jsonify({
            'quiz_id': quiz_id,
            'message_id': message_id,
            'quiz_questions': quiz_questions,
            'source_response': target_message['chat_response']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz/<quiz_id>', methods=['GET'])
def get_quiz(quiz_id):
    """Get quiz questions"""
    try:
        if quiz_id not in quizzes:
            return jsonify({'error': 'Quiz not found'}), 404
        
        quiz = quizzes[quiz_id]
        return jsonify({
            'quiz_id': quiz_id,
            'questions': quiz['questions']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz/<quiz_id>/answer', methods=['POST'])
def submit_quiz_answer(quiz_id):
    """Submit a long-answer response and get AI judgment"""
    try:
        data = request.get_json()
        user_answer = data.get('answer', '')
        
        if quiz_id not in quizzes:
            return jsonify({'error': 'Quiz not found'}), 404
        
        if not user_answer:
            return jsonify({'error': 'Answer is required'}), 400
        
        quiz = quizzes[quiz_id]
        current_index = quiz['current_question_index']
        
        # Check if there are questions to answer
        if current_index >= len(quiz['questions']):
            return jsonify({'error': 'No more questions to answer'}), 400
        
        question = quiz['questions'][current_index]
        
        # Get AI judgment
        judgment = llm_service.evaluate_answer(
            str(quiz['conversation_history']),
            question['question'], 
            user_answer
        )
        
        # Store the answer and judgment in quiz conversation history
        quiz['conversation_history'].extend([
            {"role": "user", "content": user_answer},
            {"role": "assistant", "content": judgment}
        ])
        
        # Move to next question or mark as completed
        quiz['current_question_index'] += 1
        if quiz['current_question_index'] >= len(quiz['questions']):
            quiz['completed'] = True
        
        return jsonify({
            'quiz_id': quiz_id,
            'judgment': judgment,
            'conversation_history': quiz['conversation_history'],
            'completed': quiz['completed'],
            'has_more_questions': quiz['current_question_index'] < len(quiz['questions'])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz/<quiz_id>/continue', methods=['POST'])
def continue_quiz_conversation(quiz_id):
    """Continue the quiz conversation with follow-up questions"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if quiz_id not in quizzes:
            return jsonify({'error': 'Quiz not found'}), 404
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        quiz = quizzes[quiz_id]
        
        # Add current message to conversation history
        quiz['conversation_history'].append({"role": "user", "content": user_message})
        
        # Get AI response using the conversation history directly
        ai_response = llm_service.get_chat_response("", quiz['conversation_history'])
        
        # Store the AI response
        quiz['conversation_history'].append({"role": "assistant", "content": ai_response})
        
        return jsonify({
            'quiz_id': quiz_id,
            'ai_response': ai_response,
            'conversation_history': quiz['conversation_history']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_all_conversations(user_id):
    """Get all conversations for a specific user with id, lastMessage, and timestamp"""
    try:
        conversations = []
        
        # Get user's sessions directly
        if user_id not in users:
            return []
            
        user_sessions = users[user_id].get('sessions', [])
        
        for session_id in user_sessions:
            if session_id not in sessions:
                continue
                
            session_data = sessions[session_id]
            
            # Get the last message from conversation history
            last_message = ""
            timestamp = session_data.get('created_at', '')
            
            # Check if there are messages in the session
            if session_data.get('messages') and len(session_data['messages']) > 0:
                # Get the last message from the messages array
                last_message_obj = session_data['messages'][-1]
                last_message = last_message_obj.get('user_message', '')
                timestamp = last_message_obj.get('timestamp', timestamp)
            elif session_data.get('conversation_history') and len(session_data['conversation_history']) > 0:
                # Fallback to conversation history if no messages array
                # Find the last user message
                for msg in reversed(session_data['conversation_history']):
                    if msg.get('role') == 'user':
                        last_message = msg.get('content', '')
                        break
            
            conversations.append({
                'id': session_id,
                'title': session_data.get('title', ''),
                'lastMessage': last_message,
                'timestamp': timestamp,
                'isActive': False
            })
        
        # Sort by timestamp (most recent first)
        conversations.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return conversations
        
    except Exception as e:
        print(f"Error getting conversations for user {user_id}: {e}")
        return []

@app.route('/api/users/<user_id>/conversations', methods=['GET'])
def get_all_conversations_endpoint(user_id):
    """Get all conversations for a specific user"""
    try:
        if user_id not in users:
            return jsonify({'error': 'User not found'}), 404
            
        conversations = get_all_conversations(user_id)
        return jsonify(conversations)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

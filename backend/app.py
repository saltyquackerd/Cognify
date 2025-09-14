import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime
from dotenv import load_dotenv
from llm_service import LLM
from database import DatabaseService
from google.auth.transport import requests
from google.oauth2 import id_token

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize services
llm_service = LLM()
db_service = DatabaseService()

# In-memory storage for demo purposes (use a database in production)
# Data structure: users -> sessions -> quizzes
users = {}  # user_id -> user_data
sessions = {}  # session_id -> session_data  
quizzes = {}  # quiz_id -> quizzes

@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    """Handle Google OAuth authentication"""
    try:
        data = request.get_json()
        credential = data.get('credential')
        user_info = data.get('user_info')
        
        if not credential:
            return jsonify({'error': 'Google credential is required'}), 400
        
        # Verify the Google token
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                credential, 
                requests.Request(), 
                os.getenv('GOOGLE_CLIENT_ID')
            )
            
            # Extract user information from verified token
            google_id = idinfo['sub']
            email = idinfo['email']
            name = idinfo['name']
            picture = idinfo.get('picture', '')
            
        except ValueError as e:
            return jsonify({'error': 'Invalid Google token'}), 401
        
        # Use MongoDB if available, otherwise fallback to in-memory
        if db_service.is_connected():
            # Create or get existing user
            user_id = db_service.create_user(
                email=email,
                google_id=google_id,
                name=name,
                picture=picture
            )
            
            if not user_id:
                return jsonify({'error': 'Failed to create user'}), 500
            
            # Update last login
            db_service.update_user_login(user_id)
            
            # Create a new session
            session_id = db_service.create_session(user_id)
            
            # Get user data
            user = db_service.get_user(user_id)
            
            return jsonify({
                'user': {
                    'id': user_id,
                    'email': user['email'],
                    'name': user['name'],
                    'picture': user['picture']
                },
                'session_id': session_id
            })
        else:
            # Fallback to in-memory storage
            # Check if user already exists
            existing_user_id = None
            for uid, user_data in users.items():
                if user_data.get('google_id') == google_id:
                    existing_user_id = uid
                    break
            
            if existing_user_id:
                user_id = existing_user_id
            else:
                # Create new user
                user_id = str(uuid.uuid4())
                users[user_id] = {
                    'id': user_id,
                    'email': email,
                    'name': name,
                    'picture': picture,
                    'google_id': google_id,
                    'created_at': datetime.now().isoformat(),
                    'sessions': []
                }
            
            # Create session
            session_id = str(uuid.uuid4())
            sessions[session_id] = {
                'id': session_id,
                'user_id': user_id,
                'created_at': datetime.now().isoformat(),
                'messages': [],
                'quizzes': [],
                'conversation_history': []
            }
            
            users[user_id]['sessions'].append(session_id)
            
            return jsonify({
                'user': {
                    'id': user_id,
                    'email': email,
                    'name': name,
                    'picture': picture
                },
                'session_id': session_id
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user (legacy endpoint)"""
    try:
        data = request.get_json()
        username = data.get('username', '')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        # Use MongoDB if available
        if db_service.is_connected():
            user_id = db_service.create_user(username=username)
            if not user_id:
                return jsonify({'error': 'Username already exists'}), 409
            
            user = db_service.get_user(user_id)
            return jsonify({
                'user_id': user_id,
                'username': user['username'],
                'created_at': user['created_at']
            })
        else:
            # Fallback to in-memory storage
            for user_id, user_data in users.items():
                if user_data.get('username') == username:
                    return jsonify({'error': 'Username already exists'}), 409
            
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
            'user_id': session['user_id']
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

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get session history"""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        session_quizzes = []
        
        for quiz_id in session['quizzes']:
            if quiz_id in quizzes:
                quiz = quizzes[quiz_id]
                session_quizzes.append({
                    'quiz_id': quiz_id,
                    'completed': quiz['completed']
                })
        
        return jsonify({
            'session_id': session_id,
            'user_id': session['user_id'],
            'created_at': session['created_at'],
            'messages': session['messages'],
            'quizzes': session_quizzes
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<user_id>/sessions', methods=['GET'])
def get_user_sessions(user_id):
    """Get all sessions for a user"""
    try:
        if user_id not in users:
            return jsonify({'error': 'User not found'}), 404
        
        user = users[user_id]
        user_sessions = []
        
        for session_id in user['sessions']:
            if session_id in sessions:
                session = sessions[session_id]
                user_sessions.append({
                    'session_id': session_id,
                    'created_at': session['created_at'],
                    'message_count': len(session['messages']),
                    'quiz_count': len(session['quizzes'])
                })
        
        return jsonify({
            'user_id': user_id,
            'username': user['username'],
            'sessions': user_sessions
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'cerebras_configured': llm_service.is_api_configured(),
        'available_models': llm_service.get_available_models()
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

import os
import json
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import uuid
from datetime import datetime
from dotenv import load_dotenv
from llm_service import LLM
from database import DatabaseService
from schemas import MessageSchema

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize services
llm_service = LLM()
try:
    db_service = DatabaseService()
except Exception as e:
    print(f"Warning: Database service initialization failed: {e}")
    print("Falling back to in-memory storage only")
    db_service = None

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
                'message_id': 'msg1_user',
                'message': 'How to create a button component?',
                'role': 'user',
                'timestamp': '2024-01-15T10:30:00'
            },
            {
                'message_id': 'msg1_assistant',
                'message': 'Here is how to create a button component...',
                'role': 'assistant',
                'timestamp': '2024-01-15T10:30:01'
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
                'message_id': 'msg2_user',
                'message': 'What are async/await best practices?',
                'role': 'user',
                'timestamp': '2024-01-14T15:45:00'
            },
            {
                'message_id': 'msg2_assistant',
                'message': 'Async/await best practices include...',
                'role': 'assistant',
                'timestamp': '2024-01-14T15:45:01'
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

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user (legacy endpoint)"""
    try:
        data = request.get_json()
        username = data.get('username', '')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        # Use MongoDB if available
        if db_service and db_service.is_connected():
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
    """Handle streaming chat requests with conversation context"""
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

        # Add user message to conversation history
        session['conversation_history'].append({"role": "user", "content": user_message})
        # Store the user message
        user_message_doc = MessageSchema.create_message_document(user_message, 'user')
        session['messages'].append(user_message_doc)
        
        def generate():
            """Generate Server-Sent Events for streaming response."""
            try:
                # Send initial event with session info
                yield f"data: {json.dumps({'status': 'started', 'session_id': session_id, 'user_message_id': user_message_doc['message_id']})}\n\n"
                
                # Get streaming response from LLM
                chat_response_stream = llm_service.get_chat_response(message=user_message, conversation_history=session['conversation_history'])
                
                # Collect the full response for storage
                full_response = ""
                
                # Stream each chunk of the response
                for chunk in chat_response_stream:
                    if chunk:  # Only send non-empty chunks
                        full_response += chunk
                        yield f"data: {json.dumps({'status': 'chunk', 'content': chunk})}\n\n"
                
                # Handle empty response case
                if not full_response.strip():
                    full_response = "I apologize, but I couldn't generate a response. Please try again."
                    yield f"data: {json.dumps({'status': 'chunk', 'content': full_response})}\n\n"
                
                # Add chatbot response to conversation history
                session['conversation_history'].append({"role": "assistant", "content": full_response})
                # Store the chatbot response
                chatbot_message_doc = MessageSchema.create_message_document(full_response, 'assistant')
                session['messages'].append(chatbot_message_doc)
                
                # Set title after first user question if title is still empty
                if not session['title']:
                    summary = f"User message: {user_message}\nChat response: {full_response}"
                    session['title'] = llm_service.get_title(summary)
                
                # Send completion event with final data
                yield f"data: {json.dumps({'status': 'completed', 'chatbot_message_id': chatbot_message_doc['message_id'], 'user_id': session['user_id'], 'title': session['title']})}\n\n"
                
            except Exception as e:
                # Send error event
                yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Headers': 'Content-Type, Accept',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def combine_session_and_quiz_history(session_messages, start_user_message, quiz_history=None):
    """
    Combine session history up to the quiz point and add quiz history without overlap.
    
    Args:
        session_messages: List of messages from the session (with message_id)
        target_user_message: The user message that triggered the quiz
        target_assistant_message: The assistant message that the quiz is based on
        quiz_history: Optional existing quiz conversation history
    
    Returns:
        List of combined conversation history without overlap
    """
    combined_history = []
    
    # Find the index of the target user message in session messages by message_id
    start_user_index = -1
    for i, msg in enumerate(session_messages):
        if msg.get('message_id') == start_user_message['message_id'] and msg.get('role') == 'user':
            start_user_index = i
            break
    
    # Convert session messages to conversation history format before target user message
    if start_user_index > 0:
        for i in range(start_user_index):
            msg = session_messages[i]
            combined_history.append({
                "role": msg['role'],
                "content": msg['message']
            })
    
    # Add the quiz history
    if quiz_history is not None:
        combined_history.extend(quiz_history)
    
    return combined_history

@app.route('/api/sessions/<session_id>/quiz/start', methods=['POST'])
def create_quiz_thread(session_id):
    """Create a new quiz thread for a session"""
    try:
        data = request.get_json()
        start_assistant_message_id = data.get('start_assistant_message_id', '')
        
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        if not start_assistant_message_id:
            return jsonify({'error': 'start_assistant_message_id is required'}), 400
        
        # Find the start_user_message_id (the message above the assistant message)
        start_user_message_id = None
        messages = sessions[session_id]['messages']
        
        # Find the assistant message and get the user message above it
        for i in range(len(messages) - 1, -1, -1):
            if messages[i]['message_id'] == start_assistant_message_id and messages[i]['role'] == 'assistant':
                # Find the corresponding user message (search backwards from this assistant message)
                for j in range(i - 1, -1, -1):
                    if messages[j]['role'] == 'user':
                        start_user_message_id = messages[j]['message_id']
                        break
                break
        
        if not start_user_message_id:
            return jsonify({'error': 'Corresponding user message not found'}), 404
        
        # Get the actual message content
        start_user_message = None
        start_assistant_message = None
        
        for msg in messages:
            if msg['message_id'] == start_user_message_id:
                start_user_message = msg
            elif msg['message_id'] == start_assistant_message_id:
                start_assistant_message = msg
        
        if not start_user_message or not start_assistant_message:
            return jsonify({'error': 'Start messages not found'}), 404

        prev_context = combine_session_and_quiz_history(messages, start_user_message, sessions[session_id]['conversation_history'])
        
        # Create new quiz thread
        quiz_id = str(uuid.uuid4())
        quizzes[quiz_id] = {
            'id': quiz_id,
            'session_id': session_id,
            'user_id': sessions[session_id]['user_id'],
            'start_assistant_message': start_assistant_message,
            'prev_context': prev_context,
            'created_at': datetime.now().isoformat(),
            'messages': [
                {
                    'message_id': start_user_message['message_id'],
                    'message': start_user_message['message'],
                    'timestamp': start_user_message['timestamp'],
                    'role': 'user'
                },
                {
                    'message_id': start_assistant_message['message_id'],
                    'message': start_assistant_message['message'],
                    'timestamp': start_assistant_message['timestamp'],
                    'role': 'assistant'
                }
            ],
            'conversation_history': [
                {"role": "user", "content": start_user_message['message']},
                {"role": "assistant", "content": start_assistant_message['message']}
            ]
        }
        
        # Add quiz to session
        sessions[session_id]['quizzes'].append(quiz_id)
        
        return jsonify({
            'quiz_id': quiz_id,
            'session_id': session_id,
            'user_id': sessions[session_id]['user_id'],
            'created_at': quizzes[quiz_id]['created_at']
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
        
        # Add user answer to both messages array and conversation history
        answer_message_doc = MessageSchema.create_message_document(user_answer, 'user')
        quiz['messages'].append(answer_message_doc)
        quiz['conversation_history'].append({"role": "user", "content": user_answer})
        
        # Get AI judgment using the conversation history
        evaluation = llm_service.evaluate_answer(
            conversation_history=quiz['conversation_history']
        )
        
        # Add AI judgment to both messages array and conversation history
        evaluation_message_doc = MessageSchema.create_message_document(evaluation, 'assistant')
        quiz['messages'].append(evaluation_message_doc)
        quiz['conversation_history'].append({"role": "assistant", "content": evaluation})
        
        return jsonify({
            'quiz_id': quiz_id,
            'answer_message_id': answer_message_doc['message_id'],
            'evaluation_message_id': evaluation_message_doc['message_id'],
            'evaluation': evaluation,
            'timestamp': answer_message_doc['timestamp']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz/<quiz_id>/ask-question', methods=['POST'])
def ask_quiz_question(quiz_id):
    """Ask a question for a target assistant message"""
    try:
        if quiz_id not in quizzes:
            return jsonify({'error': 'Quiz not found'}), 404
        
        quiz = quizzes[quiz_id]
        
        # Find the target assistant message in quiz messages
        target_assistant_message = quiz['start_assistant_message']
        
        if not target_assistant_message:
            return jsonify({'error': 'Target assistant message not found in quiz'}), 404
        
        # Generate quiz questions from the target assistant message
        combined_history = quiz['prev_context'] + quiz['conversation_history']
        quiz_questions_text = llm_service.generate_quiz_questions(
            target_assistant_message['message'], 
            conversation_history=combined_history
        )
        
        # Add quiz questions to both messages array and conversation history
        quiz_message_doc = MessageSchema.create_message_document(quiz_questions_text, 'assistant')
        quiz['messages'].append(quiz_message_doc)
        quiz['conversation_history'].append({"role": "assistant", "content": quiz_questions_text})
        
        return jsonify({
            'quiz_id': quiz_id,
            'quiz_message_id': quiz_message_doc['message_id'],
            'quiz_questions': quiz_questions_text,
            'timestamp': quiz_message_doc['timestamp']
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
                # Find the last user message from the messages array
                for i in range(len(session_data['messages']) - 1, -1, -1):
                    msg = session_data['messages'][i]
                    if msg.get('role') == 'user':
                        last_message = msg.get('message', '')
                        timestamp = msg.get('timestamp', timestamp)
                        break
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

def get_conversation_messages(conv_id):
    """Get all messages for a specific conversation/session"""
    try:
        if conv_id not in sessions:
            return []
            
        session_data = sessions[conv_id]
        messages = []
        
        # Get messages from the session's messages array
        if session_data.get('messages') and len(session_data['messages']) > 0:
            for msg in session_data['messages']:
                # Each message is already a single message with the new structure
                messages.append({
                    'id': msg['message_id'],
                    'content': msg['message'],
                    'role': msg['role'],
                    'timestamp': msg['timestamp'],
                    'conversationId': conv_id
                })
        
        # Sort messages by timestamp
        messages.sort(key=lambda x: x['timestamp'])
        
        return messages
        
    except Exception as e:
        print(f"Error getting conversation messages for {conv_id}: {e}")
        return []

@app.route('/api/conversations/<conv_id>/messages', methods=['GET'])
def get_conversation_messages_endpoint(conv_id):
    """Get all messages for a specific conversation/session"""
    try:
        if conv_id not in sessions:
            return jsonify({'error': 'Conversation not found'}), 404
            
        messages = get_conversation_messages(conv_id)
        return jsonify(messages)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_quiz_messages(quiz_id):
    """Get all messages for a specific quiz, excluding the first two messages"""
    try:
        if quiz_id not in quizzes:
            return []
            
        quiz_data = quizzes[quiz_id]
        messages = []
        
        # Get messages from the quiz's messages array, skipping the first two
        quiz_messages = quiz_data.get('messages', [])
        for msg in quiz_messages[2:]:
            messages.append({
                'id': msg['message_id'],
                'content': msg['message'],
                'role': msg['role'],
                'timestamp': msg['timestamp'],
                'quizId': quiz_id
            })
        
        # Sort messages by timestamp
        messages.sort(key=lambda x: x['timestamp'])
        
        return messages
        
    except Exception as e:
        print(f"Error getting quiz messages for {quiz_id}: {e}")
        return []

@app.route('/api/quiz/<quiz_id>/messages', methods=['GET'])
def get_quiz_messages_endpoint(quiz_id):
    """Get all messages for a specific quiz"""
    try:
        if quiz_id not in quizzes:
            return jsonify({'error': 'Quiz not found'}), 404
            
        messages = get_quiz_messages(quiz_id)
        return jsonify(messages)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime
from dotenv import load_dotenv
from llm_service import LLM

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize LLM service
llm_service = LLM()

# In-memory storage for demo purposes (use a database in production)
# Data structure: users -> sessions -> quizzes
users = {}  # user_id -> user_data
sessions = {}  # session_id -> session_data  
quizzes = {}  # quiz_id -> quizzes

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

        # Add user message to conversation history
        session['conversation_history'].append({"role": "user", "content": user_message})
        # Store the user message
        user_message_doc = MessageSchema.create_message_document(user_message, 'user')
        session['messages'].append(user_message_doc)
        
        # Get response from Cerebras with conversation context
        chat_response = llm_service.get_chat_response(user_message, session['conversation_history'])
        
        # Add AI response to conversation history
        session['conversation_history'].append({"role": "assistant", "content": chat_response})
        # Store the chatbot response
        chatbot_message_doc = MessageSchema.create_message_document(chat_response, 'assistant')
        session['messages'].append(chatbot_message_doc)
        
        # Set title after first user question if title is still empty
        if not session['title']:
            summary = f"User message: {user_message}\nChat response: {chat_response}"
            session['title'] = llm_service.get_title(summary)
        
        # Get the message IDs for the response
        user_message_id = user_message_doc['message_id']
        chatbot_message_id = chatbot_message_doc['message_id']
        
        return jsonify({
            'session_id': session_id,
            'user_message_id': user_message_id,
            'chatbot_message_id': chatbot_message_id,
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
        
        # Find the specific assistant message (search from bottom for recent messages)
        target_assistant_message = None
        target_user_message = None
        messages = sessions[session_id]['messages']
        
        # Find the assistant message by ID
        for i in range(len(messages) - 1, -1, -1):
            if messages[i]['message_id'] == message_id and messages[i]['role'] == 'assistant':
                target_assistant_message = messages[i]
                # Find the corresponding user message (search backwards from this assistant message)
                for j in range(i - 1, -1, -1):
                    if messages[j]['role'] == 'user':
                        target_user_message = messages[j]
                        break
                break
        
        if not target_assistant_message:
            return jsonify({'error': 'Assistant message not found'}), 404
        
        if not target_user_message:
            return jsonify({'error': 'Corresponding user message not found'}), 404
        
        # Generate quiz questions from the specific response
        quiz_questions_text = llm_service.generate_quiz_questions(target_assistant_message['message'])
        
        # Create a single question structure from the generated text
        quiz_questions = [{
            'id': str(uuid.uuid4()),
            'type': 'long_answer',
            'question': quiz_questions_text,
            'source_text': target_assistant_message['message']
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
                {"role": "user", "content": target_user_message['message']},
                {"role": "assistant", "content": target_assistant_message['message']},
                {"role": "assistant", "content": f"Quiz Questions:\n" + "\n".join([f"Q{i+1}: {q['question']}" for i, q in enumerate(quiz_questions)])}
            ]  # Track complete quiz thread conversation in LLM-ready format
        }
        
        sessions[session_id]['quizzes'].append(quiz_id)
        
        return jsonify({
            'quiz_id': quiz_id,
            'message_id': message_id,
            'quiz_questions': quiz_questions,
            'source_response': target_assistant_message['message']
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

# @app.route('/api/session/<session_id>', methods=['GET'])
# def get_session(session_id):
#     """Get session history"""
#     try:
#         if session_id not in sessions:
#             return jsonify({'error': 'Session not found'}), 404
        
#         session = sessions[session_id]
#         session_quizzes = []
        
#         for quiz_id in session['quizzes']:
#             if quiz_id in quizzes:
#                 quiz = quizzes[quiz_id]
#                 session_quizzes.append({
#                     'quiz_id': quiz_id,
#                     'completed': quiz['completed']
#                 })
        
#         return jsonify({
#             'session_id': session_id,
#             'user_id': session['user_id'],
#             'created_at': session['created_at'],
#             'messages': session['messages'],
#             'quizzes': session_quizzes
#         })
        
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

def get_all_conversations():
    """Get all conversations with id, lastMessage, and timestamp"""
    try:
        conversations = []
        
        for session_id, session_data in sessions.items():
            # Get the last message from conversation history
            last_message = ""
            timestamp = session_data.get('created_at', '')
            
            # Check if there are messages in the session
            if session_data.get('messages'):
                # Get the last message from the messages array
                last_message_obj = session_data['messages'][-1]
                last_message = last_message_obj.get('user_message', '')
                timestamp = last_message_obj.get('timestamp', timestamp)
            elif session_data.get('conversation_history'):
                # Fallback to conversation history if no messages array
                # Find the last user message
                for msg in reversed(session_data['conversation_history']):
                    if msg.get('role') == 'user':
                        last_message = msg.get('content', '')
                        break
            
            conversations.append({
                'id': session_id,
                'lastMessage': last_message,
                'timestamp': timestamp
            })
        
        # Sort by timestamp (most recent first)
        conversations.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return conversations
        
    except Exception as e:
        print(f"Error getting all conversations: {e}")
        return []

@app.route('/api/conversations', methods=['GET'])
def get_all_conversations_endpoint():
    """Get all conversations endpoint"""
    try:
        conversations = get_all_conversations()
        return jsonify(conversations)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# @app.route('/api/users/<user_id>/sessions', methods=['GET'])
# def get_user_sessions(user_id):
#     """Get all sessions for a user"""
#     try:
#         if user_id not in users:
#             return jsonify({'error': 'User not found'}), 404
        
#         user = users[user_id]
#         user_sessions = []
        
#         for session_id in user['sessions']:
#             if session_id in sessions:
#                 session = sessions[session_id]
#                 user_sessions.append({
#                     'session_id': session_id,
#                     'created_at': session['created_at'],
#                     'message_count': len(session['messages']),
#                     'quiz_count': len(session['quizzes'])
#                 })
        
#         return jsonify({
#             'user_id': user_id,
#             'username': user['username'],
#             'sessions': user_sessions
#         })
        
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

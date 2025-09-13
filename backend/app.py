import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime
from dotenv import load_dotenv
from llm_service import CerebrasLLM

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize LLM service
llm_service = CerebrasLLM()

# In-memory storage for demo purposes (use a database in production)
user_sessions = {}
quiz_data = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests with conversation context"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        session_id = data.get('session_id', str(uuid.uuid4()))
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Initialize session if new
        if session_id not in user_sessions:
            user_sessions[session_id] = {
                'created_at': datetime.now().isoformat(),
                'messages': [],
                'quizzes': []
            }
        
        # Build conversation history for context
        conversation_history = []
        for msg in user_sessions[session_id]['messages']:
            conversation_history.append({"role": "user", "content": msg['user_message']})
            conversation_history.append({"role": "assistant", "content": msg['chat_response']})
        
        # Get response from Cerebras with conversation context
        chat_response = llm_service.get_chat_response(user_message, conversation_history)
        
        # Store the conversation
        message_id = str(uuid.uuid4())
        user_sessions[session_id]['messages'].append({
            'id': message_id,
            'user_message': user_message,
            'chat_response': chat_response,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            'session_id': session_id,
            'message_id': message_id,
            'chat_response': chat_response
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
        
        if session_id not in user_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        # Find the specific message
        target_message = None
        for msg in user_sessions[session_id]['messages']:
            if msg['id'] == message_id:
                target_message = msg
                break
        
        if not target_message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Generate quiz questions from the specific response
        quiz_questions = llm_service.generate_quiz_questions(target_message['chat_response'])
        
        # Create quiz thread
        quiz_id = str(uuid.uuid4())
        quiz_data[quiz_id] = {
            'session_id': session_id,
            'message_id': message_id,
            'questions': quiz_questions,
            'created_at': datetime.now().isoformat(),
            'completed': False,
            'score': None,
            'conversation_history': []  # Track quiz thread conversation
        }
        
        user_sessions[session_id]['quizzes'].append(quiz_id)
        
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
        if quiz_id not in quiz_data:
            return jsonify({'error': 'Quiz not found'}), 404
        
        quiz = quiz_data[quiz_id]
        return jsonify({
            'quiz_id': quiz_id,
            'questions': quiz['questions'],
            'created_at': quiz['created_at']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz/<quiz_id>/answer', methods=['POST'])
def submit_quiz_answer(quiz_id):
    """Submit a long-answer response and get AI judgment"""
    try:
        data = request.get_json()
        user_answer = data.get('answer', '')
        
        if quiz_id not in quiz_data:
            return jsonify({'error': 'Quiz not found'}), 404
        
        if not user_answer:
            return jsonify({'error': 'Answer is required'}), 400
        
        quiz = quiz_data[quiz_id]
        question = quiz['questions'][0]  # Single long-answer question
        
        # Get AI judgment
        judgment = llm_service.judge_long_answer(
            question['question'], 
            user_answer, 
            question['source_text']
        )
        
        # Store the answer and judgment in quiz conversation history
        answer_entry = {
            'timestamp': datetime.now().isoformat(),
            'user_answer': user_answer,
            'judgment': judgment
        }
        
        quiz['conversation_history'].append(answer_entry)
        
        # Update quiz completion status
        quiz['completed'] = True
        quiz['score'] = judgment['score']
        
        return jsonify({
            'quiz_id': quiz_id,
            'score': judgment['score'],
            'feedback': judgment['feedback'],
            'explanation': judgment['explanation'],
            'conversation_history': quiz['conversation_history']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quiz/<quiz_id>/continue', methods=['POST'])
def continue_quiz_conversation(quiz_id):
    """Continue the quiz conversation with follow-up questions"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if quiz_id not in quiz_data:
            return jsonify({'error': 'Quiz not found'}), 404
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        quiz = quiz_data[quiz_id]
        
        # Build conversation history for the quiz thread
        conversation_history = []
        for entry in quiz['conversation_history']:
            conversation_history.append({"role": "user", "content": entry['user_answer']})
            conversation_history.append({"role": "assistant", "content": f"Score: {entry['judgment']['score']}/100\nFeedback: {entry['judgment']['feedback']}"})
        
        # Add current message
        conversation_history.append({"role": "user", "content": user_message})
        
        # Get AI response
        ai_response = llm_service.get_chat_response("", conversation_history)
        
        # Store the conversation
        conversation_entry = {
            'timestamp': datetime.now().isoformat(),
            'user_message': user_message,
            'ai_response': ai_response
        }
        
        quiz['conversation_history'].append(conversation_entry)
        
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
        if session_id not in user_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = user_sessions[session_id]
        session_quizzes = []
        
        for quiz_id in session['quizzes']:
            if quiz_id in quiz_data:
                quiz = quiz_data[quiz_id]
                session_quizzes.append({
                    'quiz_id': quiz_id,
                    'score': quiz['score'],
                    'completed': quiz['completed'],
                    'created_at': quiz['created_at']
                })
        
        return jsonify({
            'session_id': session_id,
            'created_at': session['created_at'],
            'messages': session['messages'],
            'quizzes': session_quizzes
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cerebras_configured': llm_service.is_api_configured(),
        'available_models': llm_service.get_available_models()
    })

if __name__ == '__main__':
    if not llm_service.is_api_configured():
        print("Warning: CEREBRAS_API_KEY not found in environment variables")
        print("Please set your Cerebras API key in a .env file")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

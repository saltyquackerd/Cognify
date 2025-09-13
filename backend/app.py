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
                'messages': [],
                'quizzes': [],
                'conversation_history': []  # Store in LLM-ready format
            }
        
        # Add user message to conversation history
        user_sessions[session_id]['conversation_history'].append({"role": "user", "content": user_message})
        
        # Get response from Cerebras with conversation context
        chat_response = llm_service.get_chat_response("", user_sessions[session_id]['conversation_history'])
        
        # Add AI response to conversation history
        user_sessions[session_id]['conversation_history'].append({"role": "assistant", "content": chat_response})
        
        # Store the conversation
        message_id = str(uuid.uuid4())
        user_sessions[session_id]['messages'].append({
            'id': message_id,
            'user_message': user_message,
            'chat_response': chat_response
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
        
        # Find the specific message (search from bottom for recent messages)
        target_message = None
        messages = user_sessions[session_id]['messages']
        for i in range(len(messages) - 1, -1, -1):
            if messages[i]['id'] == message_id:
                target_message = messages[i]
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
            'completed': False,
            'score': None,
            'conversation_history': [
                {"role": "user", "content": target_message['user_message']},
                {"role": "assistant", "content": target_message['chat_response']},
                {"role": "assistant", "content": f"Quiz Questions:\n" + "\n".join([f"Q{i+1}: {q['question']}" for i, q in enumerate(quiz_questions)])}
            ]  # Track complete quiz thread conversation in LLM-ready format
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
        quiz['conversation_history'].extend([
            {"role": "user", "content": user_answer},
            {"role": "assistant", "content": f"Score: {judgment['score']}/100\nFeedback: {judgment['feedback']}"}
        ])
        
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
                    'completed': quiz['completed']
                })
        
        return jsonify({
            'session_id': session_id,
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
        'cerebras_configured': llm_service.is_api_configured(),
        'available_models': llm_service.get_available_models()
    })

if __name__ == '__main__':
    if not llm_service.is_api_configured():
        print("Warning: CEREBRAS_API_KEY not found in environment variables")
        print("Please set your Cerebras API key in a .env file")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

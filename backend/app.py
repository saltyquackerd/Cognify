import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_API_KEY = os.getenv('CEREBRAS_API_KEY')

# In-memory storage for demo purposes (use a database in production)
user_sessions = {}
quiz_data = {}

class QuizGenerator:
    """Generates quiz questions from ChatGPT responses"""
    
    @staticmethod
    def generate_quiz_questions(response_text, num_questions=3):
        """Generate quiz questions based on the response text"""
        questions = []
        
        # Simple question generation logic (you can enhance this)
        sentences = response_text.split('. ')
        
        for i in range(min(num_questions, len(sentences))):
            if sentences[i].strip():
                # Create a fill-in-the-blank or multiple choice question
                question = {
                    "id": str(uuid.uuid4()),
                    "type": "multiple_choice",
                    "question": f"What is the main point of: '{sentences[i].strip()}'?",
                    "options": [
                        "It explains a key concept",
                        "It provides an example",
                        "It summarizes information",
                        "It asks a question"
                    ],
                    "correct_answer": 0,
                    "explanation": sentences[i].strip()
                }
                questions.append(question)
        
        return questions

class CerebrasChat:
    """Handles communication with Cerebras API"""
    
    @staticmethod
    def get_chat_response(message, model="cerebras-llama-2-7b-chat"):
        """Get response from Cerebras API"""
        headers = {
            "Authorization": f"Bearer {CEREBRAS_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": [
                {"role": "user", "content": message}
            ],
            "max_tokens": 500,
            "temperature": 0.7
        }
        
        try:
            response = requests.post(CEREBRAS_API_URL, headers=headers, json=data)
            response.raise_for_status()
            
            result = response.json()
            return result['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            return f"Error communicating with Cerebras API: {str(e)}"

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        session_id = data.get('session_id', str(uuid.uuid4()))
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Get response from Cerebras
        chat_response = CerebrasChat.get_chat_response(user_message)
        
        # Store session data
        if session_id not in user_sessions:
            user_sessions[session_id] = {
                'created_at': datetime.now().isoformat(),
                'messages': [],
                'quizzes': []
            }
        
        # Store the conversation
        user_sessions[session_id]['messages'].append({
            'user_message': user_message,
            'chat_response': chat_response,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            'session_id': session_id,
            'chat_response': chat_response
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    """Generate quiz questions from a chat response"""
    try:
        data = request.get_json()
        chat_response = data.get('chat_response', '')
        session_id = data.get('session_id', '')
        
        if not chat_response:
            return jsonify({'error': 'Chat response is required'}), 400
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400
        
        if session_id not in user_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        # Generate quiz questions
        quiz_questions = QuizGenerator.generate_quiz_questions(chat_response)
        
        # Store quiz data
        quiz_id = str(uuid.uuid4())
        quiz_data[quiz_id] = {
            'session_id': session_id,
            'questions': quiz_questions,
            'created_at': datetime.now().isoformat(),
            'completed': False,
            'score': None
        }
        
        user_sessions[session_id]['quizzes'].append(quiz_id)
        
        return jsonify({
            'quiz_id': quiz_id,
            'quiz_questions': quiz_questions
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

@app.route('/api/quiz/<quiz_id>/submit', methods=['POST'])
def submit_quiz(quiz_id):
    """Submit quiz answers and get score"""
    try:
        data = request.get_json()
        answers = data.get('answers', [])
        
        if quiz_id not in quiz_data:
            return jsonify({'error': 'Quiz not found'}), 404
        
        quiz = quiz_data[quiz_id]
        questions = quiz['questions']
        
        if len(answers) != len(questions):
            return jsonify({'error': 'Number of answers must match number of questions'}), 400
        
        # Calculate score
        correct_answers = 0
        results = []
        
        for i, (question, answer) in enumerate(zip(questions, answers)):
            is_correct = answer == question['correct_answer']
            if is_correct:
                correct_answers += 1
            
            results.append({
                'question_id': question['id'],
                'user_answer': answer,
                'correct_answer': question['correct_answer'],
                'is_correct': is_correct,
                'explanation': question['explanation']
            })
        
        score = (correct_answers / len(questions)) * 100
        
        # Update quiz data
        quiz_data[quiz_id]['completed'] = True
        quiz_data[quiz_id]['score'] = score
        quiz_data[quiz_id]['results'] = results
        
        return jsonify({
            'quiz_id': quiz_id,
            'score': score,
            'correct_answers': correct_answers,
            'total_questions': len(questions),
            'results': results
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
        'cerebras_configured': bool(CEREBRAS_API_KEY)
    })

if __name__ == '__main__':
    if not CEREBRAS_API_KEY:
        print("Warning: CEREBRAS_API_KEY not found in environment variables")
        print("Please set your Cerebras API key in a .env file")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

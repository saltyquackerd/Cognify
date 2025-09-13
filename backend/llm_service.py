import requests
import os
from typing import List, Dict, Any

class CerebrasLLM:
    """Handles all LLM-related operations using Cerebras API"""
    
    def __init__(self):
        self.api_url = "https://api.cerebras.ai/v1/chat/completions"
        self.api_key = os.getenv('CEREBRAS_API_KEY')
        self.default_model = "cerebras-llama-2-7b-chat"
    
    def get_chat_response(self, message: str, model: str = None) -> str:
        """
        Get response from Cerebras API for a given message
        
        Args:
            message (str): User's message/query
            model (str, optional): Model to use. Defaults to default_model
            
        Returns:
            str: AI response or error message
        """
        if not self.api_key:
            return "Error: CEREBRAS_API_KEY not configured"
        
        model = model or self.default_model
        headers = {
            "Authorization": f"Bearer {self.api_key}",
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
            response = requests.post(self.api_url, headers=headers, json=data)
            response.raise_for_status()
            
            result = response.json()
            return result['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            return f"Error communicating with Cerebras API: {str(e)}"
    
    def generate_quiz_questions(self, response_text: str, num_questions: int = 3) -> List[Dict[str, Any]]:
        """
        Generate quiz questions based on response text
        
        Args:
            response_text (str): Text to generate questions from
            num_questions (int): Number of questions to generate
            
        Returns:
            List[Dict]: List of quiz questions
        """
        import uuid
        
        questions = []
        sentences = response_text.split('. ')
        
        for i in range(min(num_questions, len(sentences))):
            if sentences[i].strip():
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
    
    def generate_enhanced_quiz(self, response_text: str, num_questions: int = 3) -> List[Dict[str, Any]]:
        """
        Generate more sophisticated quiz questions using LLM
        
        Args:
            response_text (str): Text to generate questions from
            num_questions (int): Number of questions to generate
            
        Returns:
            List[Dict]: List of enhanced quiz questions
        """
        import uuid
        
        prompt = f"""
        Based on the following text, generate {num_questions} quiz questions with multiple choice answers.
        Make the questions educational and test understanding of key concepts.
        
        Text: {response_text}
        
        Return the questions in this format:
        Question: [question text]
        A) [option 1]
        B) [option 2] 
        C) [option 3]
        D) [option 4]
        Correct: [A/B/C/D]
        Explanation: [brief explanation]
        """
        
        llm_response = self.get_chat_response(prompt)
        
        # Parse the LLM response and format as quiz questions
        questions = []
        lines = llm_response.split('\n')
        
        current_question = {}
        for line in lines:
            line = line.strip()
            if line.startswith('Question:'):
                if current_question:
                    questions.append(current_question)
                current_question = {
                    "id": str(uuid.uuid4()),
                    "type": "multiple_choice",
                    "question": line.replace('Question:', '').strip(),
                    "options": [],
                    "correct_answer": 0,
                    "explanation": ""
                }
            elif line.startswith(('A)', 'B)', 'C)', 'D)')):
                current_question["options"].append(line[2:].strip())
            elif line.startswith('Correct:'):
                correct = line.replace('Correct:', '').strip()
                correct_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
                current_question["correct_answer"] = correct_map.get(correct, 0)
            elif line.startswith('Explanation:'):
                current_question["explanation"] = line.replace('Explanation:', '').strip()
        
        if current_question and len(current_question["options"]) == 4:
            questions.append(current_question)
        
        # Fallback to simple questions if LLM parsing fails
        if not questions:
            return self.generate_quiz_questions(response_text, num_questions)
        
        return questions[:num_questions]
    
    def is_api_configured(self) -> bool:
        """Check if Cerebras API is properly configured"""
        return bool(self.api_key)
    
    def get_available_models(self) -> List[str]:
        """Get list of available Cerebras models"""
        return [
            "cerebras-llama-2-7b-chat",
            "cerebras-llama-2-13b-chat", 
            "cerebras-llama-2-70b-chat"
        ]

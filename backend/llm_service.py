import requests
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class CerebrasLLM:
    """Handles all LLM-related operations using Cerebras API"""
    
    def __init__(self):
        self.api_url = "https://api.cerebras.ai/v1/chat/completions"
        self.api_key = os.getenv('CEREBRAS_API_KEY')
        print(self.api_key) 
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


def main():
    """Test all methods in the CerebrasLLM class"""
    print("=" * 60)
    print("TESTING CEREBRAS LLM SERVICE")
    print("=" * 60)
    
    # Initialize the LLM service
    llm = CerebrasLLM()
    
    # Test 1: Check API configuration
    print("\n1. Testing API Configuration:")
    print("-" * 30)
    is_configured = llm.is_api_configured()
    print(f"API Key configured: {is_configured}")
    if not is_configured:
        print("⚠️  Warning: CEREBRAS_API_KEY not set. Some tests will show error messages.")
    
    # Test 2: Get available models
    print("\n2. Testing Available Models:")
    print("-" * 30)
    models = llm.get_available_models()
    print("Available models:")
    for i, model in enumerate(models, 1):
        print(f"  {i}. {model}")
    
    # Test 3: Basic chat response (if API key is configured)
    print("\n3. Testing Basic Chat Response:")
    print("-" * 30)
    test_message = "What is artificial intelligence?"
    print(f"Test message: '{test_message}'")
    
    response = llm.get_chat_response(test_message)
    print(f"Response: {response}")
    
    # Test 4: Chat response with specific model
    print("\n4. Testing Chat Response with Specific Model:")
    print("-" * 30)
    specific_model = "cerebras-llama-2-7b-chat"
    print(f"Using model: {specific_model}")
    
    response_with_model = llm.get_chat_response(test_message, specific_model)
    print(f"Response: {response_with_model}")
    
    # Test 5: Generate simple quiz questions
    print("\n5. Testing Simple Quiz Generation:")
    print("-" * 30)
    sample_text = "Artificial Intelligence (AI) is a branch of computer science that aims to create machines capable of intelligent behavior. Machine learning is a subset of AI that focuses on algorithms that can learn from data. Deep learning uses neural networks with multiple layers to process complex patterns."
    print(f"Sample text: '{sample_text[:100]}...'")
    
    simple_quiz = llm.generate_quiz_questions(sample_text, num_questions=2)
    print(f"Generated {len(simple_quiz)} simple quiz questions:")
    for i, question in enumerate(simple_quiz, 1):
        print(f"\n  Question {i}:")
        print(f"    ID: {question['id']}")
        print(f"    Type: {question['type']}")
        print(f"    Question: {question['question']}")
        print(f"    Options: {question['options']}")
        print(f"    Correct Answer Index: {question['correct_answer']}")
        print(f"    Explanation: {question['explanation']}")
    
    # Test 6: Generate enhanced quiz questions
    print("\n6. Testing Enhanced Quiz Generation:")
    print("-" * 30)
    print("Generating enhanced quiz questions using LLM...")
    
    enhanced_quiz = llm.generate_enhanced_quiz(sample_text, num_questions=2)
    print(f"Generated {len(enhanced_quiz)} enhanced quiz questions:")
    for i, question in enumerate(enhanced_quiz, 1):
        print(f"\n  Question {i}:")
        print(f"    ID: {question['id']}")
        print(f"    Type: {question['type']}")
        print(f"    Question: {question['question']}")
        print(f"    Options: {question['options']}")
        print(f"    Correct Answer Index: {question['correct_answer']}")
        print(f"    Explanation: {question['explanation']}")
    
    # Test 7: Error handling - test with empty message
    print("\n7. Testing Error Handling:")
    print("-" * 30)
    empty_response = llm.get_chat_response("")
    print(f"Empty message response: {empty_response}")
    
    # Test 8: Edge cases for quiz generation
    print("\n8. Testing Edge Cases:")
    print("-" * 30)
    
    # Test with very short text
    short_text = "AI is smart."
    short_quiz = llm.generate_quiz_questions(short_text, num_questions=5)
    print(f"Short text quiz (requested 5, got {len(short_quiz)}): {len(short_quiz)} questions")
    
    # Test with empty text
    empty_quiz = llm.generate_quiz_questions("", num_questions=3)
    print(f"Empty text quiz: {len(empty_quiz)} questions")
    
    print("\n" + "=" * 60)
    print("TESTING COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
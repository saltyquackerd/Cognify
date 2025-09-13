import requests
import os
from typing import List, Dict, Any
from dotenv import load_dotenv
from cerebras.cloud.sdk import Cerebras

# Load environment variables from .env file
load_dotenv()

class LLM():
    """Handles all LLM-related operations using Cerebras API"""
    
    def __init__(self):
        self.default_cerebras_model = "llama-4-scout-17b-16e-instruct"
        self.cerebras_client = Cerebras(
            api_key=os.environ.get("CEREBRAS_API_KEY"),
        )
    
    def get_chat_response(self, message: str, conversation_history: List[Dict] = None, model: str = None) -> str:
        """
        Get response from Cerebras API for a given message with conversation context
        
        Args:
            message (str): User's message/query
            conversation_history (List[Dict], optional): Previous conversation messages
            model (str, optional): Model to use. Defaults to default_model
            
        Returns:
            str: AI response or error message
        """
        if not self.cerebras_client.api_key:
            return "Error: CEREBRAS_API_KEY not configured"
        
        model = model or self.default_cerebras_model

        # headers = {
        #     "Authorization": f"Bearer {self.api_key}",
        #     "Content-Type": "application/json"
        # }
        
        # Build messages array with conversation history
        messages = []
        if conversation_history:
            messages.extend(conversation_history)
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # data = {
        #     "model": model,
        #     "messages": messages,
        #     "max_tokens": 500,
        #     "temperature": 0.7
        # }
        
        try:
            stream = self.cerebras_client.chat.completions.create(
                messages=messages,
                model=model,
                stream=True
            )
        
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except requests.exceptions.RequestException as e:
            return f"Error communicating with Cerebras API: {str(e)}"
    
    def generate_quiz_questions(self, response_text: str, num_questions: int = 1) -> List[Dict[str, Any]]:
        """
        Generate a single long-answer question based on response text
        
        Args:
            response_text (str): Text to generate questions from
            num_questions (int): Always 1 for long-answer format
            
        Returns:
            List[Dict]: List containing one long-answer question
        """
        import uuid
        
        # Generate a comprehensive understanding question
        question = {
            "id": str(uuid.uuid4()),
            "type": "long_answer",
            "question": f"Based on the following response, explain the key concepts and demonstrate your understanding. What are the main points, and how do they relate to each other?\n\nResponse: {response_text[:500]}{'...' if len(response_text) > 500 else ''}",
            "source_text": response_text,
            "explanation": "This question tests your understanding of the key concepts presented in the response."
        }
        
        return [question]
    
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
    
    def judge_long_answer(self, question: str, user_answer: str, source_text: str) -> Dict[str, Any]:
        """
        Judge a long-answer response using LLM
        
        Args:
            question (str): The original question
            user_answer (str): User's answer
            source_text (str): Source text the question was based on
            
        Returns:
            Dict: Judgment with score, feedback, and explanation
        """
        prompt = f"""
        You are an educational assessment AI. Please evaluate the following student's answer to a comprehension question.

        ORIGINAL QUESTION:
        {question}

        SOURCE TEXT:
        {source_text}

        STUDENT'S ANSWER:
        {user_answer}

        Please provide:
        1. A score from 0-100 based on accuracy, completeness, and understanding
        2. Specific feedback on what they got right and what could be improved
        3. An explanation of the key concepts they should have covered

        Format your response as:
        SCORE: [0-100]
        FEEDBACK: [detailed feedback]
        EXPLANATION: [key concepts explanation]
        """
        
        judgment_response = self.get_chat_response(prompt)
        
        # Parse the response
        lines = judgment_response.split('\n')
        score = 0
        feedback = ""
        explanation = ""
        
        for line in lines:
            line = line.strip()
            if line.startswith('SCORE:'):
                try:
                    score = int(line.replace('SCORE:', '').strip())
                except:
                    score = 50  # Default score if parsing fails
            elif line.startswith('FEEDBACK:'):
                feedback = line.replace('FEEDBACK:', '').strip()
            elif line.startswith('EXPLANATION:'):
                explanation = line.replace('EXPLANATION:', '').strip()
        
        return {
            "score": score,
            "feedback": feedback,
            "explanation": explanation,
            "raw_judgment": judgment_response
        }


def main():
    """Test all methods in the  class"""
    print("=" * 60)
    print("TESTING LLM SERVICE")
    print("=" * 60)
    
    # Initialize the LLM service
    llm = LLM()
    
    # Test 3: Basic chat response (if API key is configured)
    print("\n3. Testing Basic Chat Response:")
    print("-" * 30)
    test_message = "What is artificial intelligence?"
    print(f"Test message: '{test_message}'")
    
    gen = llm.get_chat_response(test_message)
    for response in gen:
        print(response,end='',flush=True)
    
    # Test 4: Chat response with specific model
    print("\n4. Testing Chat Response with Specific Model:")
    print("-" * 30)
    specific_model = "llama3.1-8b"
    print(f"Using model: {specific_model}")
    
    response_with_model = llm.get_chat_response(test_message, model=specific_model)
    history = ""
    for response in response_with_model:
        history += response
        print(response,end='',flush=True)

    # Test 4.5: Chat response with conversation history
    print("\n4.5 Testing Chat Response with Conversation History:")
    print("-" * 30)
    
    response_with_history = llm.get_chat_response('Why are these developments important?', conversation_history = [{'role':'user','content':test_message}, {'role':'assistant','content':history}])
    for response in response_with_history:
        print(response,end='',flush=True)
    
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
        print(f"    Correct Answer Index: {question['correct_answer']}")
        print(f"    Explanation: {question['explanation']}")
    
    # # Test 6: Generate enhanced quiz questions
    # print("\n6. Testing Enhanced Quiz Generation:")
    # print("-" * 30)
    # print("Generating enhanced quiz questions using LLM...")
    
    # enhanced_quiz = llm.generate_enhanced_quiz(sample_text, num_questions=2)
    # print(f"Generated {len(enhanced_quiz)} enhanced quiz questions:")
    # for i, question in enumerate(enhanced_quiz, 1):
    #     print(f"\n  Question {i}:")
    #     print(f"    ID: {question['id']}")
    #     print(f"    Type: {question['type']}")
    #     print(f"    Question: {question['question']}")
    #     print(f"    Options: {question['options']}")
    #     print(f"    Correct Answer Index: {question['correct_answer']}")
    #     print(f"    Explanation: {question['explanation']}")
    
    # # Test 7: Error handling - test with empty message
    # print("\n7. Testing Error Handling:")
    # print("-" * 30)
    # empty_response = llm.get_chat_response("")
    # print(f"Empty message response: {empty_response}")
    
    # # Test 8: Edge cases for quiz generation
    # print("\n8. Testing Edge Cases:")
    # print("-" * 30)
    
    # # Test with very short text
    # short_text = "AI is smart."
    # short_quiz = llm.generate_quiz_questions(short_text, num_questions=5)
    # print(f"Short text quiz (requested 5, got {len(short_quiz)}): {len(short_quiz)} questions")
    
    # # Test with empty text
    # empty_quiz = llm.generate_quiz_questions("", num_questions=3)
    # print(f"Empty text quiz: {len(empty_quiz)} questions")
    
    # print("\n" + "=" * 60)
    # print("TESTING COMPLETE")
    # print("=" * 60)


if __name__ == "__main__":
    main()
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
            model (str, optional): Model to use (see Cerebras API). Defaults to default_model
            
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
    
    def generate_quiz_questions(self, response_text: str, user_highlight: str = None) -> str:
        """
        Generate a single long-answer question based on response text
        
        Args:
            response_text (str): Text to generate questions from
            user_highlight
            
        Returns:
            List[Dict]: List containing one long-answer question
        """

        system_prompt = """"You are a question writer.
                            Write EXACTLY ONE long-answer question.
                            PRIORITIZE HIGHLIGHTS that also appear in <CONTEXT>. 
                            Stay 100% within <CONTEXT>; do not use outside knowledge or add new terms.
                            Output must be ONLY the question text—no rationale, no preface, no JSON, no bullets.
                            Max 55 words. No examples. No answers."""

        user_prompt = f"""<CONTEXT>
                        {response_text}
                        </CONTEXT>

                        <HIGHLIGHTS>
                        {user_highlight or "None"}
                        </HIGHLIGHTS>

                        Requirements:
                        - Center the question on highlight terms that appear in <CONTEXT>.
                        - Ask about relationships, mechanisms, trade-offs, or synthesis already present in <CONTEXT>.
                        - Use ONLY terms that occur in <CONTEXT>.
                        """
        
        conversation = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        return self.get_chat_response(system_prompt, conversation_history = conversation)
    
    def evaluate_answer(self, conversation_history : List[Dict], question: str, user_answer: str) -> str:
        """
        Returns evaluation of a long-answer response using LLM
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

    def get_title(self, response : str):
        """
        Generates chat title from first LLM response in conversation history
        """

def main():
    """Test all methods in the  class"""
    print("=" * 60)
    print("TESTING LLM SERVICE")
    print("=" * 60)
    
    # Initialize the LLM service
    llm = LLM()
    
    # # Test 3: Basic chat response (if API key is configured)
    # print("\n3. Testing Basic Chat Response:")
    # print("-" * 30)
    # test_message = "What is artificial intelligence?"
    # print(f"Test message: '{test_message}'")
    
    # gen = llm.get_chat_response(test_message)
    # for response in gen:
    #     print(response,end='',flush=True)
    
    # # Test 4: Chat response with specific model
    # print("\n4. Testing Chat Response with Specific Model:")
    # print("-" * 30)
    # specific_model = "llama3.1-8b"
    # print(f"Using model: {specific_model}")
    
    # response_with_model = llm.get_chat_response(test_message, model=specific_model)
    # history = ""
    # for response in response_with_model:
    #     history += response
    #     print(response,end='',flush=True)

    # # Test 4.5: Chat response with conversation history
    # print("\n4.5 Testing Chat Response with Conversation History:")
    # print("-" * 30)
    
    # response_with_history = llm.get_chat_response('Why are these developments important?', conversation_history = [{'role':'user','content':test_message}, {'role':'assistant','content':history}])
    # for response in response_with_history:
    #     print(response,end='',flush=True)
    
    # Test 5: Generate simple quiz questions
    print("\n5. Testing Simple Quiz Generation:")
    print("-" * 30)
    sample_text = "Artificial Intelligence (AI) is a branch of computer science that aims to create machines capable of intelligent behavior. Machine learning is a subset of AI that focuses on algorithms that can learn from data. Deep learning uses neural networks with multiple layers to process complex patterns."
    print(f"Sample text: '{sample_text[:100]}...'")
    
    simple_quiz = llm.generate_quiz_questions(sample_text)
    print(f"Generated simple quiz questions:")
    for response in simple_quiz:
        print(response, end='',flush=True)
    
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
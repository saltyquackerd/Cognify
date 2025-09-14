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
    
    def generate_quiz_questions(self, response_text: str, user_highlight: str = None, conversation_history: List[Dict] = None,) -> str:
        """
        Generate a single long-answer question based on response text
        
        Args:
            response_text (str): Text to generate questions from
            user_highlight (str): Text highlighted by the user to get quiz question on
            coversation_history: Conversation history for context
            
        Returns:
            List[Dict]: List containing one long-answer question
        """

        system_prompt = """"You are a question writer.
                            Write EXACTLY ONE brief long-answer question.
                            If there are <HIGHLIGHTS>, prioritize <HIGHLIGHTS> appearing in <CONTEXT>
                            Output must be related to <CONTEXT>—no rationale, no preface, no JSON, no bullets.
                            No examples. No answers."""

        user_prompt = f"""<CONTEXT>
                        {response_text}
                        </CONTEXT>

                        <HIGHLIGHTS>
                        {user_highlight or "None"}
                        </HIGHLIGHTS>

                        Requirements:
                        - Focus on relationships, trade-offs, mechanisms, synthesis, or other questions that test mastering of knowledge from the conversation history
                        """
        
        conversation = conversation_history or list()

        conversation.append({"role": "system", "content": system_prompt})
        conversation.append({"role": "user", "content": user_prompt})

        return self.get_chat_response(system_prompt, conversation_history = conversation)
    
    def evaluate_answer(self, conversation_history : List[Dict], question: str, user_answer: str) -> str:
        # """
        # Returns evaluation of a long-answer response using LLM
        # """
        # prompt = f"""
        # You are an educational assessment AI. Please evaluate the following student's answer to a comprehension question.

        # ORIGINAL QUESTION:
        # {question}

        # SOURCE TEXT:
        # {source_text}

        # STUDENT'S ANSWER:
        # {user_answer}

        # Please provide:
        # 1. A score from 0-100 based on accuracy, completeness, and understanding
        # 2. Specific feedback on what they got right and what could be improved
        # 3. An explanation of the key concepts they should have covered

        # Format your response as:
        # SCORE: [0-100]
        # FEEDBACK: [detailed feedback]
        # EXPLANATION: [key concepts explanation]
        # """
        
        # judgment_response = self.get_chat_response(prompt)
        
        # # Parse the response
        # lines = judgment_response.split('\n')
        # score = 0
        # feedback = ""
        # explanation = ""
        
        # for line in lines:
        #     line = line.strip()
        #     if line.startswith('SCORE:'):
        #         try:
        #             score = int(line.replace('SCORE:', '').strip())
        #         except:
        #             score = 50  # Default score if parsing fails
        #     elif line.startswith('FEEDBACK:'):
        #         feedback = line.replace('FEEDBACK:', '').strip()
        #     elif line.startswith('EXPLANATION:'):
        #         explanation = line.replace('EXPLANATION:', '').strip()
        
        # return {
        #     "score": score,
        #     "feedback": feedback,
        #     "explanation": explanation,
        #     "raw_judgment": judgment_response
        # }

        return 'eval in progress'

    def get_title(self, response : str):
        """
        Generates chat title from first LLM response in conversation history
        """
        return response[:10]

def main():
    llm = LLM()
    history = []

    message = "What are some graph algorithms?"
    # message = "What is the probability of rolling two dice and getting a sum of 7?"
    response = ""
    gen = llm.get_chat_response(message)
    for s in gen:
        response += s
        print(s,end='',flush=True)
    
    history.append({'role':'user','content':message})
    history.append({'role':'assistant','content':response})

    message = "I understand Dijkstra's, but I do not understand Bellman Ford"
    # message = 'How about 8?'
    response = ''
    gen = llm.get_chat_response(message, conversation_history = history)
    for s in gen:
        response += s
        print(s,end='',flush=True)

    history.append({'role':'user','content':message})
    history.append({'role':'assistant','content':response})

    quiz_gen = llm.generate_quiz_questions(response, None, history)
    for response in quiz_gen:
        print(response, end='',flush=True)

    answers = ["It just makes the algorithm run faster.",
                "Relaxing edges V-1 times ensures that all paths of length up to V−1 are considered, so the algorithm can update distances enough times to reach every vertex.",
                "Relaxing edges V-1 times guarantees that the shortest paths—which can use at most V−1 edges—are fully propagated throughout the graph. This step ensures each vertex's distance reflects the true minimum cost from the source, enabling Bellman-Ford to correctly compute all shortest paths and later detect negative cycles."]


if __name__ == "__main__":
    main()
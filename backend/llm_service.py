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
    
    def get_chat_response(self, message: str, conversation_history: List[Dict] = None, model: str = None):
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
    
    def generate_quiz_questions(self, response_text: str, user_highlight: str = None, conversation_history: List[Dict] = None, past_questions : List[Dict] = None):
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
                            If there are HIGHLIGHTS, prioritize HIGHLIGHTS appearing in CONTEXT
                            Output must be related to CONTEXT—no rationale, no preface, no JSON, no bullets.
                            Do not repeat past questions.
                            No examples. No answers. No special tokens"""

        if past_questions is not None:
            past_qs = [q['content'] for q in past_questions]

        user_prompt = f"""CONTEXT:
                        {response_text}

                        HIGHTLIGHTS:
                        {user_highlight or ""}

                        Requirements:
                        - Focus on relationships, trade-offs, mechanisms, synthesis, or other questions that test mastering of knowledge from the conversation history
                        """
        
        conversation = conversation_history or list()

        conversation.append({"role": "system", "content": system_prompt})
        conversation.append({"role": "user", "content": user_prompt})

        return self.get_chat_response(system_prompt, conversation_history = conversation)
    
    def evaluate_answer(self, conversation_history : List[Dict], question: str, user_answer: str):
        """
        Returns evaluation of a long-answer response using LLM
        """
        system_prompt = f"""
                        You are an impartial grader.
                        Evaluate relative to conversation history, do not use outside knowledge.
                        Produce a concise evaluation of the USER's latest answer to the ASSISTANT's latest question.
                        Prefer evidence quotes from the history rather than long explanations.
                        Address the student directly using 'you' instead of 'user'.
                        Highlight what the user did well and praise it.  
                        Point out any missing or incorrect elements, and briefly explain them to improve understanding.  
                        Do not include numeric scores or grades.  
                        Focus on helping the student learn.  
                        """
        
        if conversation_history is None:
            return f"Error: Conversation history (assistant question and user answer) expected"
        
        return self.get_chat_response(system_prompt, conversation_history = conversation_history)

    def get_title(self, response : str):
        """
        Generates chat title from first LLM response in conversation history
        """

        prompt = f"""
                You are a helpful assistant.  
                Read the response below and create a VERY SHORT title for the chat.  

                Guidelines:  
                - BE AS CONCISE AS POSSIBLE, KEEP TO AROUND FIVE WORDS
                - Capture the main topic or activity of the conversation.  
                - Do not include generic words like "chat" or "conversation."  
                - Capitalize like a proper title.  
                - Output only the title, with no explanations.  

                <CONVERSATION_HISTORY>
                {response}
                </CONVERSATION_HISTORY>
                """

        stream = self.get_chat_response(prompt, conversation_history = [{'role' : 'assistant', 'content' : response}])
        title = ""
        for s in stream:
            title += s

        return title


def main():
    llm = LLM()
    history = []

    # TEST 1: MESSAGE WTIH NO CONTEXT
    message = "What are some graph algorithms?"
    # message = "What is the probability of rolling two dice and getting a sum of 7?"
    response = ""
    gen = llm.get_chat_response(message)
    for s in gen:
        response += s
        print(s,end='',flush=True)
    
    history.append({'role':'user','content':message})
    history.append({'role':'assistant','content':response})

    # TEST 2: MESSAGE WITH CONTEXT
    message = "I understand Dijkstra's, but I do not understand Bellman Ford. Why do they accept different edge weights?"
    # message = 'How about 8?'
    response = ''
    gen = llm.get_chat_response(message, conversation_history = history)
    for s in gen:
        response += s
        print(s,end='',flush=True)
    print()

    history.append({'role':'user','content':message})
    history.append({'role':'assistant','content':response})

    # TEST 3: ASK QUIZ QUESTIONS
    print(' == QUIZ QUESTION == ')
    user_highlight = 'priority queue'
    user_highlight = None
    quiz_gen = llm.generate_quiz_questions(response, user_highlight, history, None)
    response = ''
    for s in quiz_gen:
        response += s
        print(s, end='',flush=True)
    print()
    
    history.append({'role':'assistant','content':response})

    # TEST 3.1: ASK MULTIPLE QUESTIONS OF SAME TOPIC
    # for i in range(5):
    #     print(f' == QUIZ QUESTION {i} == ')
    #     quiz_gen = llm.generate_quiz_questions(response, user_highlight, history, [])
    #     response = ''
    #     for s in quiz_gen:
    #         response += s
    #         print(s, end='',flush=True)
    #     history.append({'role':'assistant','content':response})
    # print()

    # TEST 4: EVALUATE RANGE OF ANSWERS
    answers = ["Dijkstra is faster and Bellman-Ford is slower.",
                "Dijkstra only works with non-negative edge weights, while Bellman-Ford handles negative edges. Bellman-Ford can also detect negative cycles, unlike Dijkstra.",
                "Dijkstra assumes non-negative weights and cannot detect negative cycles, making it efficient for typical routing problems. Bellman-Ford tolerates negative weights and flags negative cycles, so it is slower but essential for graphs with potential negative costs or in applications like detecting arbitrage."]

    for answer in answers:
        history.append({'role':'user','content':answer})
        eval_gen = llm.evaluate_answer(history,response,answer)
        print('== EVALUATION FOR ANSWER:', answer, "== ")
        print()
        for s in eval_gen:
            print(s, end='',flush=True)
        history.pop()
        print()
    
    # TEST 5: TITLE GENERATION
    first_response = history[1]['content']
    print('Message for title:', first_response)
    print('Title:', llm.get_title(first_response))

if __name__ == "__main__":
    main()
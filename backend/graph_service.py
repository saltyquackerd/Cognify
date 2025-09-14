from llm_service import *
from collections import defaultdict
import ast
import json

class GraphServices():
    def __init__(self):
        self.llm = LLM()
    
    def summarize(self, conversation_history : List[Dict]):
        prompt = """
                You are a helpful assistant.  
                Read the response below and create a VERY SHORT summary for the chat.  

                Guidelines:  
                - BE AS CONCISE AS POSSIBLE, KEEP TO AROUND TEN TO TWENTY WORDS
                - Capture the main topic or activity of the conversation.  
                """
        return self.llm.get_chat_response(prompt, conversation_history = conversation_history)

    def get_tags(self, chat_history): # get tags
        prompt = """You are an information extractor.
                Read the conversation history and return a strict JSON object with a key "topics"
                that maps to an array of strings.

                Guidelines:
                - Include broad topics (e.g. "Computer Science") and narrow ones (e.g. "Dijkstra").
                - Do not include duplicates.
                - Output JSON ONLY, no commentary.
                """
        final_response = self.llm.get_chat_response(prompt, conversation_history = chat_history)

        try:
            data = json.loads(final_response)
            return data.get("topics", [])
        except json.JSONDecodeError:
            try:
                data = json.loads(final_response[3:-3])
                return data.get("topics", [])

            except json.JSONDecodeError:
                try:
                    data = json.loads(final_response[7:-3])
                    return data.get("topics", [])
                    
                except json.JSONDecodeError:
                    return f'Error: Did not generate JSON of desired format'

    def get_knowledge_graph(self, topics): # outputs all edges in adjacency matrix in json
        adj_list = defaultdict(list)
        system_prompt = f"""You are an information extractor.
                    Return ONLY valid JSON (no prose). Build an undirected adjacency LIST for topic relatedness.
                    topics = {topics}
                    Rules:
                    - Use the `topics` array EXACTLY AS GIVEN and IN THE SAME ORDER.
                    - Output keys:
                    - "topics": echo the array exactly,
                    - "adjacency": an object mapping each topic (string) to a list of connected topics (strings).
                    - Do not invent or rename topics.
                    - No self-links (topic must not list itself).
                    - Prefer sparsity: include a connection only when it's clearly warranted by context.
                    - The graph is undirected: if A lists B, B should list A.
                    - JSON only. NO MARKDOWN
                    """
        prompt = f"""
                Here is the list of topics:
                {topics}

                Build the adjacency JSON based on these topics.
                """
        final_response = self.llm.get_chat_response(prompt, conversation_history=[{'role':'system','content':system_prompt}])
        
        try:
            data = json.loads(final_response)
            return data.get("adjacency", [])
        except json.JSONDecodeError:
            try:
                data = json.loads(final_response[3:-3])
                return data.get("adjacency", [])

            except json.JSONDecodeError:
                try:
                    data = json.loads(final_response[7:-3])
                    return data.get("adjacency", [])

                except json.JSONDecodeError:
                    return f'Error: Did not generate JSON of desired format'

def main():
    llm = LLM()
    graph = GraphServices()
    history = []

    # TEST 1: MESSAGE WTIH NO CONTEXT
    # message = "What are some graph algorithms?"
    message = "What is the probability of rolling two dice and getting a sum of 7?"
    response = ""
    print(llm.get_chat_response(message))
    
    history.append({'role':'user','content':message})
    history.append({'role':'assistant','content':response})

    # TEST 2: MESSAGE WITH CONTEXT
    # message = "I understand Dijkstra's, but I do not understand Bellman Ford. Why do they accept different edge weights?"
    message = 'How about 8?'
    response = ''
    print(llm.get_chat_response(message, conversation_history = history))

    history.append({'role':'user','content':message})
    history.append({'role':'assistant','content':response})

    # # TEST 3: ASK QUIZ QUESTIONS
    # print(' == QUIZ QUESTION == ')
    # user_highlight = 'priority queue'
    # user_highlight = None
    # print(llm.generate_quiz_questions(response, user_highlight, history))
    # print()
    
    # history.append({'role':'assistant','content':response})

    # TEST 3.1: ASK MULTIPLE QUESTIONS OF SAME TOPIC
    # for i in range(5):
    #     print(f' == QUIZ QUESTION {i} == ')
    #     print(llm.generate_quiz_questions(response, user_highlight, history, []))
    #     history.append({'role':'assistant','content':response})
    # print()

    # TEST 4: EVALUATE RANGE OF ANSWERS
    # answers = ["Dijkstra is faster and Bellman-Ford is slower.",
    #             "Dijkstra only works with non-negative edge weights, while Bellman-Ford handles negative edges. Bellman-Ford can also detect negative cycles, unlike Dijkstra.",
    #             "Dijkstra assumes non-negative weights and cannot detect negative cycles, making it efficient for typical routing problems. Bellman-Ford tolerates negative weights and flags negative cycles, so it is slower but essential for graphs with potential negative costs or in applications like detecting arbitrage."]

    # for answer in answers:
    #     history.append({'role':'user','content':answer})
    #     answer = llm.evaluate_answer(history)
    #     print('== EVALUATION FOR ANSWER:', answer, "== ")
    #     history.pop()
    #     print()
    
    # TEST 5: TITLE GENERATION
    first_response = history[1]['content']
    print('Message for title:', first_response)
    print('Title:', llm.get_title(first_response))

    # TEST 6: SUMMARIZE HISTORY
    print(' == SUMMARY == ')
    print(graph.summarize(history))

    # TEST 7: TOPICS
    print(' == GET TOPIC TAGS == ')
    tags = graph.get_tags(history)
    print(tags)
    print(type(tags))

    # TEST 8: ADJACENCY GRAPH OF TOPICS
    print(' == ADJACENCY OF TOPICS == ')
    print(graph.get_knowledge_graph(tags))
    print(type(graph.get_knowledge_graph(tags)))

if __name__ == "__main__":
    main()

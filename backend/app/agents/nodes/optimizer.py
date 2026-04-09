import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.config import get_stream_writer
from app.agents.state import AgentState

# Initialize LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0.3,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

def optimizer_node(state: AgentState):
    """The Career Coach: Rewrites the resume with live thinking updates."""

    # 1. Initialize the writer to send "Thinking" chunks
    writer = get_stream_writer()

    # 2. Emit "Thinking" signals
    writer({"status": "Analyzing extracted keywords...", "node": "optimizer"})

    keywords_str = ", ".join(state.get("extracted_keywords", []))

    # Send another update to show progress
    writer({
        "status": f"Integrating {len(state.get('extracted_keywords', []))} keywords using Google XYZ Formula...", 
        "node": "optimizer"
    })

    prompt = f"""
    You are an expert Technical Resume Writer. Your goal is to rewrite the candidate's resume 
    to perfectly align with these keywords: {keywords_str}.
    
    STRICT RULES:
    1. Use the Google XYZ Formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.
    2. Incorporate as many of the provided keywords as possible naturally.
    3. DO NOT lie or invent new experiences. Only rephrase existing ones.
    4. Keep the tone professional and concise.
    
    ORIGINAL RESUME:
    {state['raw_resume']}
    
    REWRITTEN RESUME:
    """

    # 3. Call the LLM
    response = llm.invoke(prompt)
    new_content = response.content

    # 4. Final 'Thinking' signal before exiting the node
    writer({"status": "Resume optimization complete. Passing to Critic...", "node": "optimizer"})

    # Update state
    return {
        "current_resume_content": new_content,
        "iteration_count": state.get("iteration_count", 0) + 1
    }
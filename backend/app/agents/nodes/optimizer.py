from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.config import get_stream_writer
from app.agents.state import AgentState
from app.core.config import settings
from app.prompts.templates import OPTIMIZER_PROMPT

# Centralized Initialization
llm = ChatGoogleGenerativeAI(
    model=settings.LLM_MODEL,
    temperature=settings.TEMPERATURE,
    google_api_key=settings.GOOGLE_API_KEY
)

def optimizer_node(state: AgentState):
    prompt = OPTIMIZER_PROMPT.format(
        keywords_str=", ".join(state['extracted_keywords']),
        resume_text=state['raw_resume']
    )
    response = llm.invoke(prompt)
    
    writer = get_stream_writer()
    writer({"status": "Analyzing extracted keywords...", "node": "optimizer"})

    keywords = state.get("extracted_keywords", [])
    
    writer({
        "status": f"Integrating {len(keywords)} keywords using Google XYZ Formula...", 
        "node": "optimizer"
    })

    # CLEAN INJECTION: Use the template from the prompts file
    prompt = OPTIMIZER_PROMPT.format(
        keywords_str=", ".join(keywords),
        resume_text=state['raw_resume']
    )

    response = llm.invoke(prompt)
    
    writer({"status": "Resume optimization complete. Passing to Critic...", "node": "optimizer"})

    return {
        "current_resume_content": response.content,
        "iteration_count": state.get("iteration_count", 0) + 1
    }
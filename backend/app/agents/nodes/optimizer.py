import time
from langchain_groq import ChatGroq
from langgraph.config import get_stream_writer
from app.agents.state import AgentState
from app.core.config import settings
from app.prompts.templates import OPTIMIZER_PROMPT

# Centralized Initialization
llm = ChatGroq(
    model=settings.LLM_MODEL,
    temperature=settings.TEMPERATURE,
    api_key=settings.GROQ_API_KEY
)

def optimizer_node(state: AgentState):
    time.sleep(15)  # ← increase from 5 to 15 to avoid TPM limit
    raw_resume = state.get('current_resume_content') or state.get('raw_resume')
    if hasattr(raw_resume, 'content'):
        resume_text = raw_resume.content
    else:
        resume_text = str(raw_resume)
    prompt = OPTIMIZER_PROMPT.format(
        keywords_str=", ".join(state.get('extracted_keywords', [])),
        resume_text=resume_text
    )
    for attempt in range(3):
        try:
            response = llm.invoke(prompt)
            return {
                "current_resume_content": response.content,
            }
        except Exception as e:
            if "429" in str(e) or "rate_limit" in str(e).lower():
                wait = 30 * (attempt + 1)
                print(f"Rate limited. Waiting {wait}s...")
                time.sleep(wait)
            else:
                raise e
    raise Exception("Max retries exceeded")
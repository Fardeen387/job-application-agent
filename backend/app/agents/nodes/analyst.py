import os
import time
from langchain_groq import ChatGroq
from langgraph.config import get_stream_writer
from app.agents.state import AgentState
from app.core.config import settings

# Initialize the model
llm = ChatGroq(
    model=settings.LLM_MODEL,
    temperature=0,
    api_key=settings.GROQ_API_KEY
)

def analyze_requirements_node(state: AgentState):
    """The Scout: Extracts 10 critical hard skills from the Job Description."""
    
    writer = get_stream_writer()
    writer({"status": "Scanning Job Description for critical keywords...", "node": "analyst"})

    # Safety delay for Free Tier
    time.sleep(5)
    
    prompt = f"""
    You are an expert Technical Recruiter. Analyze the following Job Description and extract 
    exactly 10 essential 'Hard Skills' or 'Technical Keywords' (e.g., React, Python, AWS, CI/CD).
    
    STRICT RULES:
    - Return ONLY a comma-separated list.
    - No soft skills.
    - No numbering or bullets.
    
    JOB DESCRIPTION:
    {state['raw_jd']}
    
    KEYWORDS:
    """
    
    try:
        response = llm.invoke(prompt)
        content = response.content

        # 🛠️ THE FIX: Handle different response types safely
        if isinstance(content, list):
            # If Gemini already sent a list
            raw_keywords = content
        elif isinstance(content, str):
            # If it's a string, we split it
            raw_keywords = content.split(",")
        else:
            # Fallback for unexpected types
            raw_keywords = [str(content)]

        # Clean whitespace and limit to 10
        clean_keywords = [str(k).strip() for k in raw_keywords if k][:10]

        writer({"status": f"Extracted {len(clean_keywords)} key technical requirements.", "node": "analyst"})

        return {
            "extracted_keywords": clean_keywords
        }
    except Exception as e:
        writer({"status": f"API Error: {str(e)}", "node": "analyst"})
        raise e
import os
import re
import json
import time
from langchain_groq import ChatGroq
from langgraph.config import get_stream_writer
from app.agents.state import AgentState
from app.core.config import settings

llm = ChatGroq(
    model=settings.LLM_MODEL,
    temperature=0.0,
    api_key=settings.GROQ_API_KEY
)

def critic_node(state: AgentState):
    """The Quality Controller: Evaluates the match and provides real feedback."""
    time.sleep(2) 
    writer = get_stream_writer()
    score = state.get("latest_final_score", 0)

    prompt = f"""
    Compare the REWRITTEN RESUME against the extracted keywords: {state.get('extracted_keywords', [])}.
    Current Score: {score}%

    Act as a Senior Technical Recruiter. Identify 2 strengths and 2 specific gaps.
    Instead of just listing tools, explain WHY they are needed for the role or HOW the resume is missing them.

    Example Gap: "Missing experience with Git for collaboration workflows"
    Example Strength: "Strong foundation in Scikit-learn for building predictive ML models"

    You MUST return ONLY a JSON object:
    {{
    "strengths": ["contextual strength 1", "contextual strength 2"],
    "gaps": ["contextual gap 1", "contextual gap 2"]
    }}

    REWRITTEN RESUME:
    {state.get('current_resume_content')}

    RESPONSE:
"""
    
    response = llm.invoke(prompt)
    content = response.content
    
    # Initialize defaults
    strengths = []
    gaps = []

    try:
        # 🛠️ THE FIX: Use Regex to find the JSON block { ... } 
        # This prevents the "Content well-structured" fallback if the LLM adds text
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        
        if json_match:
            data = json.loads(json_match.group())
            strengths = data.get("strengths", [])
            gaps = data.get("gaps", [])
        
        # Fallback: If JSON parsing fails or lists are empty, try line splitting
        if not strengths or not gaps:
            lines = [re.sub(r'^[\s\d\.\-\*]+', '', l).strip() for l in content.split('\n') if len(l) > 10]
            strengths = lines[:2] if len(lines) >= 2 else ["Relevant technical skills detected"]
            gaps = lines[2:4] if len(lines) >= 4 else ["Consider more role-specific tailoring"]

    except Exception as e:
        print(f"Critic Parsing Error: {e}")
        strengths = ["Solid project foundation"]
        gaps = ["Further technical alignment possible"]

    writer({"status": "Critique complete. Sending real insights to dashboard.", "node": "critic"})

    return {
        "strengths": strengths,
        "gaps": gaps,
        "critic_notes": content,
        "iteration_count": state.get("iteration_count", 0) + 1
    }
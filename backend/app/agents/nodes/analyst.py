import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.config import get_stream_writer
from app.agents.state import AgentState

# Initialize the model
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

def analyze_requirements_node(state: AgentState):
    """The Scout: Extracts 10 critical hard skills from the Job Description."""
    
    # 1. Start the Thinking Stream
    writer = get_stream_writer()
    writer({"status": "Scanning Job Description for critical keywords...", "node": "analyst"})
    
    prompt = f"""
    You are an expert Technical Recruiter. Analyze the following Job Description and extract 
    exactly 10 essential 'Hard Skills' or 'Technical Keywords' (e.g., React, Python, AWS, CI/CD).
    
    STRICT RULES:
    - Return ONLY a comma-separated list.
    - No soft skills (like 'leadership' or 'communication').
    - Focus on the tech stack and tools.
    
    JOB DESCRIPTION:
    {state['raw_jd']}
    
    KEYWORDS:
    """
    
    # 2. Call Gemini
    response = llm.invoke(prompt)

    # 3. Clean and Parse the output
    raw_keywords = response.content.split(",")
    # Remove whitespace and ensure only take the top 10
    clean_keywords = [k.strip() for k in raw_keywords][:10]

    # 4. Final Thinking update
    writer({"status": f"Extracted {len(clean_keywords)} key technical requirements.", "node": "analyst"})

    # 5. Return the update to the State
    return {
        "extracted_keywords": clean_keywords
    }
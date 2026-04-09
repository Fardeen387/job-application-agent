import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.config import get_stream_writer
from app.agents.state import AgentState

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0.2,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

def Critic_node(state: AgentState):
    """The Quality Controller: Evaluates the match and provides feedback."""

    writer = get_stream_writer()
    score = state.get("latest_final_score", 0)

    # 2. Generate specific feedback if the score is below our threshold (85%)
    if score < 85:
        writer({"status": "Score below 85%. Generating improvement notes...", "node": "critic"})

        prompt = f"""
        A candidate's resume was rewritten to match these keywords: {state.get('extracted_keywords', [])}.
        The current weighted match score is {score}%.
        
        Identify 2 specific things missing or weak in the REWRITTEN RESUME compared to the JD.
        Be concise. This will be used as a 'hint' for the next optimization loop.
        
        REWRITTEN RESUME:
        {state.get('current_resume_content')}
        
        FEEDBACK:
        """
        response = llm.invoke(prompt)
        feedback = response.content

    else:
        writer({"status": "Target score achieved. Finalizing document.", "node": "critic"})
        feedback = "Optimization successful. Resume meets the high-quality threshold."

    # 3. Update the state
    return {
        "critic_notes": feedback
    }
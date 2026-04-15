from app.agents.state import AgentState
from app.services.embedding_service import EmbeddingService
import time

matcher_service = EmbeddingService()

def score_match_node(state: AgentState):
    """The Data Scientist: Calculates the Weighted Score."""
    from app.prompts.templates import MATCHER_PROMPT 
    import time

    time.sleep(5) 
    
    # 1. GET DATA
    raw_resume = state.get("current_resume_content") or state.get("raw_resume")
    jd = state.get("raw_jd")
    keywords = state.get("extracted_keywords", [])

    # 🛠️ THE FIX: Ensure resume is a clean string
    if isinstance(raw_resume, dict):
        resume_text = raw_resume.get("content", str(raw_resume))
    elif hasattr(raw_resume, "content"):
        resume_text = str(raw_resume.content)
    else:
        resume_text = str(raw_resume)

    # 2. RUN EMBEDDINGS
    try:
        # Use the cleaned resume_text instead of the raw object
        semantic_sim = matcher_service.get_semantic_score(resume_text, jd)
        kw_match = matcher_service.get_keyword_score(resume_text, keywords)
        
        final_score = matcher_service.get_weighted_score(semantic_sim, kw_match)

        return {
        "latest_semantic_score": round(semantic_sim * 100, 2),
        "latest_keyword_score": round(kw_match * 100, 2),
        "latest_final_score": round(final_score * 100, 2),
        "current_resume_content": resume_text,  
        "resume_history": [{
            "content": resume_text,
            "semantic_score": round(semantic_sim * 100, 2),
            "keyword_score": round(kw_match * 100, 2),
            "final_score": round(final_score * 100, 2),
            "version_number": len(state.get("resume_history", [])) + 1
        }]
    }
    except Exception as e:
        print(f"Matcher Error: {e}")
        raise e
from app.agents.state import AgentState
from app.services.embedding_service import EmbeddingService

matcher_service = EmbeddingService()

def score_match_node(state: AgentState):
    """The Data Scientist: Calculates the 0.6 / 0.4 Weighted Score."""
    
    # 1. Get the content to compare
    resume = state.get("current_resume_content") or state.get("raw_resume")
    jd = state.get("raw_jd")
    keywords = state.get("extracted_keywords", [])

    # 2. Run the Semantic Math (60%)
    semantic_sim = matcher_service.get_semantic_score(resume, jd)

    # 3. Run the Keyword Match (40%)
    kw_match = matcher_service.get_keyword_score(resume, keywords)

    # 4. Calculate Final Weighted Score
    final_score = matcher_service.get_weighted_score(semantic_sim, kw_match)

    # 5. Update the State
    return {
        "latest_semantic_score": round(semantic_sim * 100, 2),
        "latest_keyword_score": round(kw_match * 100, 2),
        "latest_final_score": round(final_score * 100, 2)
    }
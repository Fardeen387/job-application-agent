import typing import Annotated, TypedDict, Optional
import operator

class ResumeVersion(TypedDict):
    """Represents a specific iteration of the resume."""
    content: str
    semantic_score: float
    keyword_score: float
    final_score: float
    version_number: int

class AgentState(TypedDict):
    # --- INPUTS ---
    raw_resume: str
    raw_jd: str

    # --- ANALYZED DATA ---
    extracted_keywords: list[str]
    required_experience: int

    # --- VERSION CONTROL & HISTORY ---
    # append log
    resume_history: Annotated[list[ResumeVersion], operator.add]

    # The most recent version for the UI to display
    current_resume_content: str

    # --- SCORING METRICS (The 0.6 / 0.4 Split) ---
    latest_semantic_score: float
    latest_keyword_score: float
    latest_final_score: float

    # --- FEEDBACK LOOP DATA ---
    critic_notes: str
    iteration_count: int
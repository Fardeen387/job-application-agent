from langgraph.graph import StateGraph, END, START
from app.agents.state import AgentState
from app.agents.nodes.analyst import analyze_requirements_node
from app.agents.nodes.matcher import score_match_node
from app.agents.nodes.optimizer import optimizer_node
from app.agents.nodes.critic import critic_node

def should_continue(state: AgentState):
    score = state.get("latest_final_score", 0)
    iterations = state.get("iteration_count", 0)

    if score >= 85:
        print(f"✅ Target reached at {score}%. Stopping.")
        return "finish"

    if iterations >= 2:  # ← lower to 2 to save tokens
        print(f"🛑 Max iterations ({iterations}) reached. Stopping.")
        return "finish"

    print(f"🔄 Score {score}% at iteration {iterations}. Refining...")
    return "refine"

def create_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("analyst", analyze_requirements_node)
    workflow.add_node("matcher", score_match_node)
    workflow.add_node("optimizer", optimizer_node)
    workflow.add_node("critic", critic_node)

    # Linear start
    workflow.add_edge(START, "analyst")
    workflow.add_edge("analyst", "matcher")
    workflow.add_edge("matcher", "critic")      # ← matcher goes to critic directly

    # Conditional loop
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {
            "refine": "optimizer",
            "finish": END
        }
    )

    # Optimizer goes back to matcher for re-scoring
    workflow.add_edge("optimizer", "matcher")

    return workflow.compile()

app_graph = create_graph()
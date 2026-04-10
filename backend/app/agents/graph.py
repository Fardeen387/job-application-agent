from langgraph.graph import StateGraph, END, StateGraph
from app.agents.state import AgentState
from app.agents.nodes.analyst import analyze_requirements_node
from app.agents.nodes.matcher import score_match_node
from app.agents.nodes.optimizer import optimizer_node
from app.agents.nodes.critic import critic_node

def should_continue(state: AgentState):
    # Logic: If the score is below 85% and we haven't looped more than 3 times
    if state.get("latest_final_score", 0) < 85 and state.get("iteration_count", 0) < 3:
        return "refine"
    return "finish"

def create_graph():
    # 1. Initialize the Graph with State Schema
    workflow = StateGraph(AgentState)

    # 2. Add all our Worker Nodes
    workflow.add_node("analyst", analyze_requirements_node)
    workflow.add_node("matcher", score_match_node)
    workflow.add_node("optimizer", optimizer_node)
    workflow.add_node("critic", critic_node)

    # 3. Define the Fixed Paths (The linear start)
    workflow.add_edge(START, "analyst")
    workflow.add_edge("analyst", "matcher")
    workflow.add_edge("matcher", "optimizer")
    workflow.add_edge("optimizer", "matcher") # Re-score after optimization
    workflow.add_edge("matcher", "critic")

    # 4. Define the Conditional Path (The Loop)
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {
            "refine": "optimizer", # Back to the drawing board
            "finish": END          # We are done!
        }
    )

    # 5. Compile the Graph
    return workflow.Compile()

# This 'app' object is FastAPI server will invoke
app_graph = create_graph()
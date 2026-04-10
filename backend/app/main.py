import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.agents.graph import app_graph
from app.services.pdf_parser import PDFParserService

app = FastAPI(title="AI Resume Agent API")

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

pdf_parser = PDFParserService()

@app.post("/optimize")
async def optimize_resume_endpoint(
    resume_file: UploadFile = File(...),
    jd_text: str = Form(...)
):
    """
    Main entry point: Parses PDF, initializes state, and streams LangGraph updates.
    """
    try:
        # 1. Parse the PDF using our Service
        raw_resume_text = await pdf_parser.extract_text(resume_file)
        clean_resume = pdf_parser.clean_text(raw_resume_text)

        # 2. Define the Initial State for LangGraph
        initial_state = {
            "raw_resume": clean_resume,
            "raw_jd": jd_text,
            "iteration_count": 0,
            "resume_history": [],
            "current_resume_content": clean_resume # Start with the original
        }

        async def event_generator():
            """
            Generator that yields SSE-formatted strings.
            'custom' chunks contain our 'Thinking' status messages.
            'updates' chunks contain the actual node outputs (scores, text).
            """
            async for event in app_graph.astream(
                initial_state, 
                stream_mode=["updates", "custom"]
            ):
                # We package everything in a standard JSON structure for the frontend
                yield f"data: {json.dumps(event)}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
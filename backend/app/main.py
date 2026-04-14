import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.agents.graph import app_graph
from app.services.pdf_parser import PDFParserService
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Resume Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pdf_parser = PDFParserService()

@app.post("/optimize")
async def optimize_resume_endpoint(
    resume_file: UploadFile = File(...),
    jd_text: str = Form(...)
):
    try:
        raw_resume_text = await pdf_parser.extract_text(resume_file)
        clean_resume = pdf_parser.clean_text(raw_resume_text)

        initial_state = {
            "raw_resume": clean_resume,
            "raw_jd": jd_text,
            "iteration_count": 0,
            "resume_history": [],
            "current_resume_content": clean_resume,
        }

        async def event_generator():
            yield f"data: {json.dumps({'original_resume_text': clean_resume})}\n\n"
            async for event in app_graph.astream(
                initial_state,
                stream_mode=["updates", "custom"]
            ):
                yield f"data: {json.dumps(event)}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
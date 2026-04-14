import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    TEMPERATURE: float = 0.0

settings = Settings()
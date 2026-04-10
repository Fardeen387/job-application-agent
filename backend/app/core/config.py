import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY")
    LLM_MODEL: str = "gemini-1.5-flash"
    TEMPERATURE: float = 0.3

settings = Settings()
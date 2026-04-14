import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("--- AVAILABLE EMBEDDING MODELS ---")
for m in client.models.list():
    if "embedContent" in m.supported_actions:
        print(m.name)
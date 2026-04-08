import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from langchain_google_genai import GoogleGenerativeAI
import os 
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        self.embeddings_model = GoogleGenerativeAI(
            model="models/embedding-004",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )

    def get_semantic_score(self, text1: str, text2: str) -> float:
        # 1. Get vectors from Gemini
        vec1 = self.embeddings_model.embed_query(text1)
        vec2 = self.embeddings_model.embed_query(text2)

        # 2. Reshape for sklearn (it expects 2D arrays)
        v1 = np.array(vec1).reshape(1, -1)
        v2 = np.array(vec2).reshape(1, -1)

        similarity = cosine_similarity(v1, v2)

        return similarity[0][0]

    def get_keyword_score(self, resume_text: str, required_keywords: list) -> float:
        """The 40% part: Strict token matching."""
        if not required_keywords:
            return 0.0
        
        resume_text = resume_text.lowe()
        found_count = sum(1 for kw in required_keywords if kw.lower() in resume_text_lower)

        return found_count / len(required_keywords)
    
    def get_weighted_score(self, semantic_score: float, keyword_score: float) -> float:
        return (0.6 * semantic_score) + (0.4 * keyword_score)
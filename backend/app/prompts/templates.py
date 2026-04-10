# backend/app/prompts/templates.py

ANALYST_PROMPT = """
Analyze the following Job Description and extract exactly 10 
critical technical keywords. Return ONLY a comma-separated list.

JD: {jd_text}
"""

OPTIMIZER_PROMPT = """
You are an expert Technical Resume Writer. Your goal is to rewrite the candidate's resume 
to perfectly align with these keywords: {keywords_str}.

STRICT RULES:
1. Use the Google XYZ Formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.
2. Incorporate as many of the provided keywords as possible naturally.
3. DO NOT lie or invent new experiences. Only rephrase existing ones.
4. Keep the tone professional and concise.

ORIGINAL RESUME:
{resume_text}

REWRITTEN RESUME:
"""
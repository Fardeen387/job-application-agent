# 🧠 AI Resume Intelligence System (Multi-Agent)

A multi-agent AI system that evaluates and optimizes resumes against job descriptions using semantic analysis, structured reasoning, and explainable feedback.

---

## 🚀 Overview

This project implements a **stateful multi-agent workflow** to simulate how a recruiter evaluates resumes.

Instead of relying only on keyword matching, the system combines:

* Semantic understanding (embeddings)
* Keyword analysis (ATS-style matching)
* Context-aware reasoning (LLM-based explanation)

It produces:

* Match score
* Strengths & gaps
* Optimized resume
* Explainable insights

---

## 🧩 System Architecture

The system is built using a **multi-agent pipeline (LangGraph)**:

* 🧠 **Analyst** → Extracts structured information from resume & job description
* 🔗 **Matcher** → Compares resume with JD using embeddings + keywords
* 📊 **Scorer** → Computes weighted match score
* ⚙️ **Optimizer** → Improves resume content (without hallucination)
* 🧪 **Critic** → Evaluates and generates strengths & gaps

---

## 📊 Scoring Strategy

To avoid misleading results from keyword stuffing, the system uses:

```text
Final Score = 0.7 × Semantic Score + 0.3 × Keyword Score
```

This ensures:

* Meaning > keywords
* Better alignment with real-world evaluation

---

## ✨ Features

* 🔍 **Semantic Resume Matching** using vector embeddings
* ⚖️ **Weighted Scoring System** (reduces keyword bias)
* 🧠 **Explainable AI Output** (strengths & gaps with context)
* 🚫 **No Hallucination** (strict grounding in resume content)
* 🔄 **Multi-Agent Workflow** using LangGraph
* 📄 **Resume Optimization** based on job description
* 🖥️ **Interactive Dashboard (React)**
* 📜 **Real-time Agent Execution Logs**

---

## 🖥️ Frontend Highlights

* **Overview Tab**

  * Match score
  * Verdict
  * Strengths & gaps

* **Analysis Tab**

  * Original vs Optimized resume (side-by-side)

* **Agent Logs**

  * Visualizes multi-agent execution flow

---

## 🛠️ Tech Stack

**Backend:** FastAPI · LangGraph · Gemini API · HuggingFace Embeddings · Python

**Frontend:** React.js · Tailwind CSS

**AI/ML:** Multi-Agent Workflow · Semantic Search · Vector Embeddings · LLM Integration

---

## 📁 Project Structure

```text
job-application-agent/
│
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── nodes/        # Analyst, Matcher, Optimizer, Critic
│   │   │   ├── graph.py      # LangGraph workflow definition
│   │   │   └── state.py      # Shared agent state
│   │   │
│   │   ├── services/
│   │   │   ├── embedding_service.py
│   │   │   └── pdf_parser.py
│   │   │
│   │   ├── prompts/
│   │   │   └── templates.py  # LLM prompt templates
│   │   │
│   │   ├── core/
│   │   │   └── config.py     # Configuration & environment
│   │   │
│   │   └── main.py           # FastAPI entry point
│   │
│   ├── test_backend.py
│   └── create_test_pdf.py
│
├── frontend/
│   ├── src/
│   │   └── Dashboard.jsx     # Main UI dashboard
│   └── package.json
│
├── available_models.py
├── requirements.txt
└── README.md
```

---

## ⚙️ How It Works

1. Upload resume + job description
2. Analyst extracts structured data
3. Matcher computes semantic + keyword similarity
4. Scorer calculates final score
5. Optimizer rewrites resume content
6. Critic generates strengths & gaps
7. Results displayed in dashboard

---

## 📌 Example Output

* Match Score: 66%

* **Strength**

  * Strong Python and ML foundation demonstrated through projects

* **Gap**

  * Missing cloud deployment experience (AWS/GCP)

* **Optimized Resume**

  * Improved alignment with job description

---

## 🎯 Key Learnings

* Designing multi-agent systems
* Balancing semantic vs keyword scoring
* Preventing hallucination in LLM outputs
* Building explainable AI interfaces
* Integrating backend + frontend systems

---

## 🚧 Future Improvements

* Add RAG-based retrieval
* Store results in database
* User authentication
* Deploy as SaaS tool

---

## 👨‍💻 Author

Fardeen Khan
B.Tech CSE | Aspiring ML Engineer

---

## ⭐ Final Note

This project focuses on building a **realistic AI evaluation system**, not just a resume keyword checker.

It demonstrates how multi-agent AI systems can provide **transparent, grounded, and actionable insights**.

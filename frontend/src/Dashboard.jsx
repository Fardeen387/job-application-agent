import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Zap, Brain, Target, ChevronRight,
  Terminal, CheckCircle, AlertCircle, Loader2, X, Eye
} from "lucide-react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        "#080c10",
  surface:   "#0d1117",
  panel:     "#111820",
  border:    "#1e2d3d",
  borderHi:  "#2a4060",
  text:      "#c9d1d9",
  muted:     "#4a5568",
  dim:       "#2a3644",
  accent:    "#58a6ff",
  analyst:   "#3b82f6",
  matcher:   "#22c55e",
  optimizer: "#a855f7",
  scorer:    "#f59e0b",
  error:     "#ef4444",
  success:   "#22c55e",
};

const NODE_COLORS = {
  analyst:   { color: C.analyst,   label: "Analyst",   bg: "#0d1f33" },
  matcher:   { color: C.matcher,   label: "Matcher",   bg: "#0a1f0d" },
  optimizer: { color: C.optimizer, label: "Optimizer", bg: "#1a0d26" },
  scorer:    { color: C.scorer,    label: "Scorer",    bg: "#1f1600" },
  critic:    { color: "#f97316",   label: "Critic",    bg: "#1f0e00" },
  default:   { color: C.accent,    label: "Agent",     bg: "#0d1a2e" },
};

// ─── FastAPI Stream Reader ────────────────────────────────────────────────────
// Reads NDJSON from POST http://localhost:8000/api/v1/agent/run
// Status chunks:  { "status": "...", "node": "analyst|matcher|optimizer|scorer|critic" }
// Result chunks:  { "latest_final_score": 85.5, "current_resume_content": "...",
//                  "latest_semantic_score": 70, "latest_keyword_score": 90 }
//
// Returns an async generator that yields parsed JSON objects one at a time.
// Buffers incomplete lines across TCP chunks so partial JSON is never parsed.
async function* fetchAgentStream(file, jobDescription, signal) {
  const form = new FormData();
  form.append("resume_file", file);
  form.append("jd_text", jobDescription);

  const res = await fetch("https://fardeen1004-resume-ai-backend.hf.space/optimize", {
    method: "POST",
    body: form,
    signal,
  });

  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}: ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE splits on double-newline between events; split on single newlines for lines
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete last line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue; // skip empty / SSE comments

      // Strip SSE "data: " prefix — your backend always sends this
      const jsonStr = trimmed.startsWith("data:") 
        ? trimmed.slice(5).trim() 
        : trimmed;

      if (!jsonStr) continue;
      try {
        yield JSON.parse(jsonStr);
      } catch {
        console.warn("Unparseable SSE line:", jsonStr);
      }
    }
  }

  // Flush remaining buffer
  const remaining = buffer.trim();
  if (remaining) {
    const jsonStr = remaining.startsWith("data:") ? remaining.slice(5).trim() : remaining;
    if (jsonStr) {
      try { yield JSON.parse(jsonStr); } catch { /* ignore */ }
    }
  }
}

// ─── LangGraph output parsers ─────────────────────────────────────────────────
// Your backend uses astream(stream_mode=["updates","custom"]).
// "updates" events: { "node_name": { ...state fields... } }
// First event:      { "original_resume_text": "..." }
// State fields we care about: latest_final_score, current_resume_content,
//                              latest_semantic_score, latest_keyword_score,
//                              status (for log lines)

function extractStateFromChunk(raw) {
  // 1. Handle explicit status updates
  if (Array.isArray(raw) && raw.length === 2 && raw[0] === "custom") {
    return { type: "status", node: raw[1].node || "agent", status: raw[1].status };
  }
  
  if (Array.isArray(raw) && raw.length === 2 && raw[0] === "updates") {
    return extractStateFromChunk(raw[1]);
  }

  // 2. Handle the initial resume text
  if (raw.original_resume_text !== undefined) {
    return { type: "original", text: raw.original_resume_text };
  }

  // 3. TRANSLATE RAW DATA INTO TERMINAL MESSAGES
  for (const nodeKey of Object.keys(raw)) {
    const state = raw[nodeKey];
    if (state && typeof state === "object") {
      
      let cleanMessage = null;
      
      if (state.status) {
        cleanMessage = state.status;
      } else if (state.extracted_keywords) {
        cleanMessage = `Parsing complete. Extracted ${state.extracted_keywords.length} core technical requirements.`;
      } else if (state.latest_semantic_score !== undefined) {
        cleanMessage = `Gap analysis finished. Semantic match: ${Math.round(state.latest_semantic_score)}%.`;
      } else if (state.current_resume_content && state.latest_final_score === undefined) {
        cleanMessage = `Rewriting bullet points for ATS compatibility...`;
      } else if (state.strengths) {
        cleanMessage = `Critique complete. Generating final insight report...`;
      } else {
        cleanMessage = `Processing ${nodeKey} data payload...`; 
      }

      return { 
        type: "update", 
        node: nodeKey, 
        data: state, 
        status: cleanMessage 
      };
    }
  }
  return { type: "unknown", raw };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlowDot({ color, pulse }) {
  return (
    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: color, boxShadow: pulse ? `0 0 6px ${color}` : "none",
      animation: pulse ? "pulseGlow 1.5s ease-in-out infinite" : "none",
      flexShrink: 0 }} />
  );
}

function Badge({ node }) {
  const n = NODE_COLORS[node] || NODE_COLORS.default;
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700,
      padding: "2px 7px", borderRadius: 3, letterSpacing: "0.08em",
      color: n.color, background: n.bg, border: `1px solid ${n.color}30` }}>
      {n.label.toUpperCase()}
    </span>
  );
}

function CircularScore({ score, semanticScore, keywordScore }) {
  const safeScore = typeof score === "number" && !isNaN(score) ? score : 0;
  const rounded = Math.round(safeScore);
  const r = 54, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const dash = (safeScore / 100) * circ;
  const color = safeScore >= 80 ? C.success : safeScore >= 60 ? C.scorer : C.error;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.dim} strokeWidth={8} />
        <motion.circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={circ}
          transform="rotate(-90 70 70)"
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color}
          fontSize={28} fontWeight={700} fontFamily="monospace">{rounded}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fill={C.muted}
          fontSize={11} fontFamily="monospace">MATCH %</text>
      </svg>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <GlowDot color={color} pulse />
        <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700,
          letterSpacing: "0.1em" }}>
          {safeScore >= 80 ? "STRONG MATCH" : safeScore >= 60 ? "PARTIAL MATCH" : "LOW MATCH"}
        </span>
      </div>
    </div>
  );
}

function TerminalLine({ entry, index }) {
  const n = NODE_COLORS[entry.node] || NODE_COLORS.default;
  
  // Logic to handle JSON vs String logs
  let displayMessage = entry.status;
  if (typeof entry.status === 'object') {
    // If it's the analyst's keyword list, show a clean message
    if (entry.status.extracted_keywords) {
      displayMessage = `Extracted ${entry.status.extracted_keywords.length} core technical requirements.`;
    } else {
      displayMessage = JSON.stringify(entry.status); // Fallback
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.3) }}
      style={{ display: "flex", gap: 10, alignItems: "flex-start",
        padding: "5px 0", borderBottom: `1px solid ${C.border}20` }}>
      <span style={{ color: C.muted, fontFamily: "monospace", fontSize: 11, flexShrink: 0,
        paddingTop: 1 }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <Badge node={entry.node} />
      <span style={{ color: n.color, fontFamily: "monospace", fontSize: 12,
        lineHeight: 1.5, flex: 1 }}>{displayMessage}</span>
      {entry.done && <CheckCircle size={14} color={C.success} style={{ flexShrink: 0, marginTop: 2 }} />}
    </motion.div>
  );
}

function SideBySide({ original, optimized }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2,
      borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {[
        { label: "Original Resume", content: original, color: "#8b949e", icon: <FileText size={15}/> },
        { label: "AI Optimized",    content: optimized, color: C.optimizer, icon: <Zap size={15}/> },
      ].map(({ label, content, color, icon }) => (
        <div key={label} style={{ background: C.panel, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "14px 20px", background: "#0c1319",
            borderBottom: `2px solid ${color}50`, flexShrink: 0 }}>
            <span style={{ color, display: "flex", alignItems: "center" }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
              color, fontFamily: "monospace" }}>{label.toUpperCase()}</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "20px 22px",
            scrollBehavior: "smooth", maxHeight: 460 }}>
            <pre style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 14, color: "#d0d8e4", lineHeight: 1.9, margin: 0,
              whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

function VerdictSection({ score }) {
  const verdict =
    score >= 80 ? "Strong match — well-aligned with the role requirements."
    : score >= 60 ? "Partial match — good foundation but some gaps present."
    : score >= 40 ? "Weak match — significant gaps; targeted optimization recommended."
    : "Poor match — resume needs substantial rework for this role.";
  const color  = score >= 80 ? C.success : score >= 60 ? C.scorer : C.error;
  const bgTint = score >= 80 ? "#071a0f"  : score >= 60 ? "#1a1200" : "#1a0808";
  const label  = score >= 80 ? "STRONG MATCH" : score >= 60 ? "PARTIAL MATCH" : score >= 40 ? "WEAK MATCH" : "POOR MATCH";
  return (
    <div style={{ background: bgTint, border: `1.5px solid ${color}60`,
      borderLeft: `4px solid ${color}`, borderRadius: 8, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
          color, background: `${color}20`, padding: "3px 10px", borderRadius: 4 }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: `${color}80`, letterSpacing: "0.1em" }}>VERDICT</span>
      </div>
      <p style={{ margin: 0, fontSize: 15, color: "#e2e8f0", lineHeight: 1.7, fontWeight: 500 }}>{verdict}</p>
    </div>
  );
}

function ExplanationSection({ result }) {
  // 1. EXTRACT REAL DATA
  // Use the lists from the Critic node if they exist, otherwise fallback to your logic
  let strengths = result?.strengths || [];
  let gaps = result?.gaps || [];

  // 2. FALLBACK LOGIC (Only if Critic hasn't sent real lists yet)
  if (strengths.length === 0 && gaps.length === 0) {
    const { score, semanticScore, keywordScore } = result || {};
    
    if (semanticScore != null && semanticScore >= 65) strengths.push("Strong semantic alignment with the job description");
    if (keywordScore  != null && keywordScore  >= 70) strengths.push("Good keyword coverage for ATS matching");
    if (score         != null && score         >= 75) strengths.push("Overall content is well-suited for this role");
    
    if (semanticScore != null && semanticScore < 65) gaps.push("Low semantic similarity — content may not match role context");
    if (keywordScore  != null && keywordScore  < 70) gaps.push("Missing key terms from job description");
    if (score         != null && score < 75 && score >= 50) gaps.push("Resume could benefit from role-specific tailoring");
  }

  // Ensure there is at least something to show
  if (strengths.length === 0) strengths.push("Some relevant experience detected");
  if (gaps.length === 0) gaps.push("No major gaps identified at this score level");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Strengths card */}
      <div style={{ background: "#071a0f", border: `1.5px solid ${C.success}40`,
        borderTop: `3px solid ${C.success}`, borderRadius: 8, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>✓</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: C.success }}>STRENGTHS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {strengths.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: C.success, fontSize: 18, lineHeight: 1.1, flexShrink: 0, marginTop: 1 }}>•</span>
              <span style={{ fontSize: 13, color: "#c9e8d4", lineHeight: 1.6 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gaps card */}
      <div style={{ background: "#1a0808", border: `1.5px solid ${C.error}40`,
        borderTop: `3px solid ${C.error}`, borderRadius: 8, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>✗</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: C.error }}>GAPS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {gaps.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: C.error, fontSize: 18, lineHeight: 1.1, flexShrink: 0, marginTop: 1 }}>•</span>
              <span style={{ fontSize: 13, color: "#f0c0c0", lineHeight: 1.6 }}>{g}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const AGENT_DESCRIPTIONS = {
  analyst:   "Extracts core skills and experience from your resume.",
  matcher:   "Compares your profile against the JD requirements.",
  optimizer: "Rewrites and aligns your content for better impact.",
  scorer:    "Calculates the final match, semantic, and keyword scores.",
  critic:    "Reviews the final output for quality and accuracy."
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("terminal");
  const [resultsTab, setResultsTab] = useState("overview");
  const fileRef = useRef();
  const logsContainerRef = useRef();
  const abortRef = useRef(null);       // holds AbortController
  const originalTextRef = useRef(""); // preserves original resume text for comparison

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFile = (f) => {
    if (f && f.type === "application/pdf") setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const run = useCallback(async () => {
    if (!file || !jd.trim()) return;

    // Snapshot the original resume filename as placeholder text.
    // If your backend echoes back the parsed text, it will be overwritten below.
    originalTextRef.current = `[Original resume: ${file.name}]\n\nThe parsed text will appear here once the backend returns it alongside the optimized content.`;

    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setActiveTab("terminal");

    try {
      for await (const raw of fetchAgentStream(file, jd, controller.signal)) {
        console.log("SSE CHUNK:", raw);
        const parsed = extractStateFromChunk(raw);

        if (parsed.type === "original") {
          originalTextRef.current = parsed.text;
          continue;
        }

        if (parsed.type === "status") {
          setLogs(prev => [...prev, { node: parsed.node, status: parsed.status, done: true }]);
          continue;
        }

        if (parsed.type === "update") {
          // 1. ADD CLEAN SENTENCE TO TERMINAL
          setLogs(prev => [...prev, { node: parsed.node, status: parsed.status, done: true }]);

          // 2. UPDATE THE DASHBOARD CHARTS/DATA
          const s = parsed.data;
          const hasScore = s.latest_final_score !== undefined;
          setResult(prev => ({
            ...prev,
            original:      originalTextRef.current        || prev?.original      || "",
            optimized:     s.current_resume_content       || prev?.optimized     || "",
            score:         s.latest_final_score           ?? prev?.score         ?? 0,
            semanticScore: s.latest_semantic_score        ?? prev?.semanticScore ?? null,
            keywordScore:  s.latest_keyword_score         ?? prev?.keywordScore  ?? null,
            strengths:     s.strengths                    ?? prev?.strengths     ?? [],
            gaps:          s.gaps                         ?? prev?.gaps          ?? []
          }));

          // 3. Switch to results tab when score data arrives
          if (hasScore) setActiveTab("results");
          continue;
        }

        if (parsed.type === "unknown") {
          // Ignore unparseable chunks so they don't ruin the clean terminal look
          console.warn("UNKNOWN CHUNK:", parsed.raw);
        }
      }

      setLogs(prev => prev.map(l => ({ ...l, done: true })));

    } catch (err) {
      if (err.name === "AbortError") {
        // User clicked Abort — expected, no error shown
      } else {
        setError(err.message || "Connection failed. Is the backend running?");
      }
    } finally {
      setRunning(false);
    }
  }, [file, jd]);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false); setFile(null); setJd(""); setLogs([]); setResult(null); setError(null); setActiveTab("terminal"); setResultsTab("overview");
    originalTextRef.current = "";
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "0 0 60px" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 2px; }
        @keyframes pulseGlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        .upload-zone { transition: border-color 0.2s, background 0.2s; }
        .upload-zone:hover { border-color: ${C.accent} !important; background: #0d1e30 !important; }
        .tab-btn { transition: color 0.15s, border-color 0.15s; cursor: pointer; }
        .tab-btn:hover { color: ${C.text} !important; }
        .run-btn { transition: background 0.2s, box-shadow 0.2s; cursor: pointer; }
        .run-btn:hover:not(:disabled) { background: #1e4a8a !important; box-shadow: 0 0 20px ${C.accent}40 !important; }
        .run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        textarea::placeholder { color: ${C.muted}; }
        textarea { resize: none; outline: none; }
        textarea:focus { border-color: ${C.accent} !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface,
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={15} color="#000" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em",
            color: C.text }}>RESUME.AI</span>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
            LANGGRAPH OPTIMIZER
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>

          {/* ── Left Panel: Inputs ─────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* PDF Upload */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
                color: C.muted, marginBottom: 12 }}>01 / RESUME PDF</div>
              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div key="file" initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                    style={{ display: "flex", alignItems: "center", gap: 10,
                      background: "#0d1e30", border: `1px solid ${C.accent}40`,
                      borderRadius: 6, padding: "10px 12px" }}>
                    <FileText size={18} color={C.accent} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 500,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button onClick={() => setFile(null)}
                      style={{ background: "none", border: "none", color: C.muted,
                        cursor: "pointer", padding: 2 }}>
                      <X size={14} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="upload-zone"
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current.click()}
                    style={{ border: `1px dashed ${dragging ? C.accent : C.borderHi}`,
                      borderRadius: 6, padding: "24px 16px", textAlign: "center",
                      cursor: "pointer", background: dragging ? "#0d1e30" : "transparent" }}>
                    <Upload size={22} color={dragging ? C.accent : C.muted}
                      style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 12, color: C.muted }}>
                      Drop PDF here or{" "}
                      <span style={{ color: C.accent }}>browse</span>
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf"
                      style={{ display: "none" }}
                      onChange={e => handleFile(e.target.files[0])} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Job Description */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "14px 16px", flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
                color: C.muted, marginBottom: 12 }}>02 / JOB DESCRIPTION</div>
                
              <textarea 
                value={jd} 
                onChange={e => setJd(e.target.value)}
                placeholder="Paste the target job description here..."
                rows={10}
                style={{ 
                  width: "100%", 
                  background: "transparent",
                  border: `1px solid ${C.border}`, 
                  borderRadius: 6,
                  padding: "12px 14px", // Slightly more padding for a premium feel
                  color: C.text, 
                  fontSize: 13, // Increased font slightly for better readability
                  lineHeight: 1.6, 
                  fontFamily: "inherit",
                  height: "400px",      // This should stretch it down to the button
                  overflowY: "auto", 
                  transition: "border-color 0.2s",
                  outline: "none"
                }}
              />
            </div>

            {/* Error banner */}
            {error && (
              <div style={{ background: "#1a0808", border: `1px solid ${C.error}40`,
                borderRadius: 6, padding: "9px 12px", display: "flex",
                alignItems: "flex-start", gap: 8 }}>
                <AlertCircle size={13} color={C.error} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: C.error, lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Run Button */}
            <motion.button className="run-btn"
              onClick={running ? reset : run}
              disabled={!file || !jd.trim() || (result && !running && result.score < 50)}
              whileTap={{ scale: 0.98 }}
              style={{ width: "100%", padding: "13px", borderRadius: 8, border: "none",
                background: running ? "#1a0d26" : C.accent, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700, fontSize: 12,
                letterSpacing: "0.15em",
                color: running ? C.optimizer : "#000",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: running ? `0 0 16px ${C.optimizer}30` : `0 0 12px ${C.accent}20` }}>
              {running ? (
                <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  PROCESSING — ABORT</>
              ) : (
                <><Zap size={15} />OPTIMIZE RESUME</>
              )}
            </motion.button>

            {/* Low-score warning */}
            {result && !running && result.score < 50 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                padding: "7px 10px", background: "#1a0808",
                border: `1px solid ${C.error}30`, borderRadius: 6 }}>
                <AlertCircle size={12} color={C.error} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.error, lineHeight: 1.4 }}>
                  Score below 50 — optimization disabled. Improve the job description match first.
                </span>
              </div>
            )}

            {/* Node legend */}
            {/* Node legend */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(NODE_COLORS).filter(([k]) => k !== "default").map(([key, val]) => (
                  <div 
                    key={key} 
                    title={AGENT_DESCRIPTIONS[key] || "AI Agent Node"} // The Tooltip
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 6,
                      background: val.bg, 
                      border: `1px solid ${val.color}25`,
                      borderRadius: 5, 
                      padding: "6px 10px",
                      cursor: "help" // Changes cursor to a question mark on hover
                    }}
                  >
                    <GlowDot color={val.color} pulse={running} />
                    <span style={{ 
                      fontSize: 10, 
                      color: val.color, 
                      fontWeight: 700,
                      letterSpacing: "0.1em" 
                    }}>
                      {val.label.toUpperCase()}
                    </span>
                  </div>
                ))}
          </div>
          </div>

          {/* ── Right Panel: Terminal + Results ─────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, background: C.surface,
              borderTopLeftRadius: 8, borderTopRightRadius: 8,
              border: `1px solid ${C.border}`, borderBottom: "none" }}>
              {[
                { id: "terminal", label: "AGENT BRAIN", icon: <Terminal size={12}/> },
                { id: "results",  label: "RESULTS",     icon: <Eye size={12}/>,
                  disabled: !result },
              ].map(tab => (
                <button key={tab.id} className="tab-btn"
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  style={{ padding: "10px 18px", background: "none", border: "none",
                    borderBottom: activeTab === tab.id
                      ? `2px solid ${C.accent}` : "2px solid transparent",
                    color: activeTab === tab.id ? C.accent
                      : tab.disabled ? C.dim : C.muted,
                    fontFamily: "inherit", fontWeight: 700, fontSize: 10,
                    letterSpacing: "0.12em", display: "flex",
                    alignItems: "center", gap: 6 }}>
                  {tab.icon}{tab.label}
                  {tab.id === "results" && result && (
                    <span style={{ background: C.success, color: "#000", fontSize: 9,
                      padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>NEW</span>
                  )}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {running && (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "0 14px", color: C.optimizer, fontSize: 10 }}>
                  <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                  RUNNING
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`,
              borderTop: "none", borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
              overflow: "hidden", flex: 1 }}>
              <AnimatePresence mode="wait">

                {activeTab === "terminal" && (
                  <motion.div key="terminal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ height: 640, overflow: "hidden", display: "flex",
                      flexDirection: "column" }}>
                    <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", gap: 6,
                      background: "#0a0f14" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%",
                        background: C.success, animation: running ? "pulseGlow 1.5s infinite" : "none" }} />
                      <span style={{ fontSize: 10, color: C.muted,
                        letterSpacing: "0.1em" }}>LANGGRAPH EXECUTION LOG</span>
                    </div>
                    <div ref={logsContainerRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                      {logs.length === 0 && (
                        <div style={{ color: C.dim, fontSize: 12, padding: "20px 0",
                          textAlign: "center" }}>
                          {running ? "Initializing agent..." : "Awaiting input..."}
                        </div>
                      )}
                      {logs.map((entry, i) => (
                        <TerminalLine key={i} entry={entry} index={i} />
                      ))}
                      {running && logs.length > 0 && (
                        <div style={{ display: "flex", gap: 4, paddingTop: 8 }}>
                          {[0,1,2].map(i => (
                            <motion.div key={i}
                              animate={{ opacity: [0.2, 1, 0.2] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                              style={{ width: 5, height: 5, borderRadius: "50%",
                                background: C.accent }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "results" && result && (
                  <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: "flex", flexDirection: "column", height: 640 }}>

                    {/* Sub-tab bar — large, prominent */}
                    <div style={{ display: "flex", gap: 0, background: "#090e14",
                      borderBottom: `2px solid ${C.border}`, flexShrink: 0 }}>
                      {[
                        { id: "overview", label: "Overview",  icon: <Eye size={14}/> },
                        { id: "analysis", label: "Analysis",  icon: <FileText size={14}/> },
                      ].map(t => {
                        const active = resultsTab === t.id;
                        return (
                          <button key={t.id} className="tab-btn"
                            onClick={() => setResultsTab(t.id)}
                            style={{
                              padding: "14px 28px",
                              background: active ? C.panel : "transparent",
                              border: "none",
                              borderBottom: active ? `3px solid ${C.accent}` : "3px solid transparent",
                              borderTop: active ? `1px solid ${C.border}` : "1px solid transparent",
                              color: active ? C.accent : "#6a7a8d",
                              fontFamily: "inherit", fontWeight: 700, fontSize: 12,
                              letterSpacing: "0.1em", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 8,
                              transition: "all 0.15s",
                              boxShadow: active ? `inset 0 -1px 0 ${C.accent}` : "none",
                            }}>
                            <span style={{ color: active ? C.accent : "#4a5a6a" }}>{t.icon}</span>
                            {t.label.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>

                    {/* Sub-tab content */}
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {resultsTab === "overview" && (
                        <div style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                          {/* Score row */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 24,
                            flexWrap: "wrap", background: C.surface,
                            border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px" }}>
                            <CircularScore score={result.score} semanticScore={result.semanticScore} keywordScore={result.keywordScore} />
                            <div style={{ flex: 1, minWidth: 200, alignSelf: "center" }}>
                              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.18em",
                                marginBottom: 14, fontWeight: 700 }}>SCORE BREAKDOWN</div>
                              {[
                                { label: "Final Match Score",  val: `${Math.round(result.score ?? 0)}%`,                                                   color: C.accent   },
                                { label: "Semantic Score",     val: result.semanticScore != null ? `${Math.round(result.semanticScore)}%` : "—", color: C.matcher  },
                                { label: "Keyword Score",      val: result.keywordScore  != null ? `${Math.round(result.keywordScore)}%`  : "—", color: C.optimizer},
                              ].map(({ label, val, color }) => (
                                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                                  alignItems: "center", padding: "10px 0",
                                  borderBottom: `1px solid ${C.border}` }}>
                                  <span style={{ fontSize: 12, color: "#6a7a8d" }}>{label}</span>
                                  <span style={{ fontSize: 15, fontWeight: 700, color,
                                    fontFamily: "monospace" }}>{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <VerdictSection score={result.score} />
                          <ExplanationSection result={result} />
                        </div>
                      )}

                      {resultsTab === "analysis" && (
                        <div style={{ padding: "20px 20px" }}>
                          {result.score < 50 ? (
                            <div style={{ padding: "40px", textAlign: "center", background: "#1a0808", 
                              border: `1px solid ${C.error}40`, borderRadius: 8 }}>
                              <AlertCircle size={32} color={C.error} style={{ margin: "0 auto 12px" }} />
                              <h3 style={{ color: C.error, marginTop: 0, fontSize: 16 }}>Optimization Aborted</h3>
                              <p style={{ color: "#f0c0c0", fontSize: 13, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
                                The match score ({Math.round(result.score)}%) is below the required 50% threshold. 
                                To prevent AI hallucination, the Optimizer is disabled for documents that are fundamentally misaligned with the job description.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.18em",
                                marginBottom: 14, fontWeight: 700 }}>DOCUMENT COMPARISON</div>
                              <SideBySide original={result.original} optimized={result.optimized} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
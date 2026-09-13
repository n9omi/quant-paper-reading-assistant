import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPTS
   ═══════════════════════════════════════════════════════════════════════════ */

const ANALYSIS_PROMPT = `You are an expert research analyst helping a student understand academic papers in quantitative finance, applied math, AI/ML, and data science. The student is a Python beginner but mathematically capable.

Analyze the uploaded paper and return ONLY a valid JSON object (no markdown fences, no preamble, no trailing text). Follow this schema exactly:

{
  "title": "string",
  "authors": "string",
  "year": "string",
  "journal": "string",
  "tags": ["string"],
  "theory": {
    "summary": "2-3 paragraphs, plain language, what this paper does and why it matters",
    "key_concepts": [
      {"name": "string", "explanation": "2-3 sentences", "intuition": "analogy or mental model", "math_level": "none|basic_stats|calculus|stochastic_calc"}
    ],
    "equations": [
      {"name": "string", "latex": "string", "plain_english": "string", "each_term": [{"symbol": "string", "meaning": "string"}], "why_it_matters": "string"}
    ]
  },
  "deep_dive": {
    "math_foundations": [
      {"name": "string", "domain": "probability|stochastic_calculus|statistics|linear_algebra|optimization|numerical_methods", "eli5": "3-4 sentences for a 12-year-old", "undergraduate": "4-6 sentences, textbook level", "rigorous": "5-8 sentences, full technical", "visual_analogy": "one vivid metaphor", "prerequisites": ["string"], "why_this_paper": "2-3 sentences", "common_pitfalls": "1-2 sentences", "python_connection": "2-3 sentences, specific library/function"}
    ],
    "econ_foundations": [
      {"name": "string", "domain": "market_microstructure|derivatives|risk_management|behavioral_finance|macro|commodities|econometrics", "eli5": "3-4 sentences", "undergraduate": "4-6 sentences", "rigorous": "5-8 sentences", "visual_analogy": "one vivid metaphor", "market_example": "real market event, 2-3 sentences", "why_this_paper": "2-3 sentences", "data_signature": "what pattern in data, 2-3 sentences"}
    ],
    "concept_connections": [{"from": "string", "to": "string", "relationship": "1-2 sentences", "type": "math_to_math|econ_to_econ|math_to_econ"}],
    "reading_order": ["concept names in study sequence"],
    "paper_narrative": "3-4 paragraph explainer tying math to markets"
  },
  "methodology": {
    "data_sources": ["string"],
    "data_period": "string",
    "pipeline_steps": [{"step": 1, "name": "string", "description": "string", "python_tools": ["string"]}],
    "models_used": [{"name": "string", "type": "statistical|ml|deep_learning|stochastic", "purpose": "string", "difficulty": "beginner|intermediate|advanced"}]
  },
  "interpretations": {
    "main_findings": ["string"],
    "market_implications": ["string"],
    "limitations": ["string"]
  },
  "replication_plan": {
    "estimated_weeks": 4,
    "prerequisites": ["string"],
    "phases": [{"phase": 1, "name": "string", "duration": "string", "tasks": [{"task": "string", "python_skills_needed": ["string"], "difficulty": "beginner|intermediate|advanced"}]}]
  },
  "improvements": [{"idea": "string", "rationale": "string", "implementation": "string", "impact": "low|medium|high", "difficulty": "beginner|intermediate|advanced", "portfolio_value": "string"}],
  "github_repo_suggestion": {"repo_name": "string", "description": "string", "folder_structure": ["string"]}
}

Requirements:
- 4-8 math_foundations, 3-6 econ_foundations
- reading_order includes ALL concept names
- concept_connections has 5+ entries
- Be thorough, accurate, encouraging
- Return ONLY valid JSON`;

const QA_PROMPT = `You are a patient, expert tutor. The student is a Python beginner but mathematically capable. You have analysis of this paper as context.

Rules:
- 2-5 paragraphs max
- Intuition FIRST, then formalism
- Ground economics in real market scenarios
- For Python questions, give actual code snippets
- Use **bold** for key terms
- Never return JSON`;

/* ═══════════════════════════════════════════════════════════════════════════
   THEME — clean, minimal dark UI
   ═══════════════════════════════════════════════════════════════════════════ */

const T = {
  bg: "#0B0E14",
  surface: "#12161F",
  raised: "#1A1F2C",
  border: "#1E2536",
  borderHi: "#2E3A52",
  text: "#E2E8F2",
  mid: "#8A96B2",
  dim: "#505C74",
  blue: "#4C8EF7",
  blueS: "rgba(76,142,247,0.1)",
  blueM: "rgba(76,142,247,0.18)",
  green: "#38D98A",
  greenS: "rgba(56,217,138,0.1)",
  amber: "#F0B429",
  amberS: "rgba(240,180,41,0.1)",
  rose: "#F56B81",
  roseS: "rgba(245,107,129,0.1)",
  purple: "#A87CF5",
  purpleS: "rgba(168,124,245,0.1)",
  teal: "#28D0B8",
  tealS: "rgba(40,208,184,0.1)",
  cyan: "#30CFC9",
  cyanS: "rgba(48,207,201,0.1)",
};

const DOMAIN_COLORS = {
  probability: "purple", stochastic_calculus: "rose", statistics: "blue",
  linear_algebra: "cyan", optimization: "amber", numerical_methods: "green",
  market_microstructure: "teal", derivatives: "purple", risk_management: "rose",
  behavioral_finance: "amber", macro: "blue", commodities: "green", econometrics: "cyan",
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */

function safe(obj, path, fallback = null) {
  return path.split(".").reduce((o, k) => o?.[k], obj) ?? fallback;
}

function safeArray(obj, path) {
  const val = safe(obj, path);
  return Array.isArray(val) ? val : [];
}

async function callClaude(system, messages, maxTokens = 4000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API returned ${res.status}`);
  }
  const data = await res.json();
  return (data.content || []).map((c) => c.text || "").join("");
}

function parseAnalysis(raw) {
  let text = raw.trim();
  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  // Find JSON bounds
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  text = text.slice(start, end + 1);
  const parsed = JSON.parse(text);
  // Validate required fields
  if (!parsed.title) throw new Error("Missing 'title' in analysis");
  return parsed;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const BADGE_COLORS = {
  blue: [T.blueS, T.blue], green: [T.greenS, T.green], amber: [T.amberS, T.amber],
  rose: [T.roseS, T.rose], purple: [T.purpleS, T.purple], teal: [T.tealS, T.teal],
  cyan: [T.cyanS, T.cyan],
};

function Badge({ children, color = "blue" }) {
  const [bg, fg] = BADGE_COLORS[color] || BADGE_COLORS.blue;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "99px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", background: bg, color: fg }}>
      {children}
    </span>
  );
}

function DiffBadge({ level }) {
  if (!level) return null;
  const c = level === "beginner" ? "green" : level === "intermediate" ? "amber" : "rose";
  return <Badge color={c}>{level}</Badge>;
}

function Card({ children, style }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "16px", ...style }}>{children}</div>;
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: children ? 0 : "14px" }}>
      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: T.text }}>{title}</h3>
      {sub && <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.mid }}>{sub}</p>}
      {children && <div style={{ marginTop: "12px" }}>{children}</div>}
    </div>
  );
}

function EmptyState({ message }) {
  return <Card><p style={{ color: T.dim, fontSize: "13px", textAlign: "center", margin: "12px 0" }}>{message}</p></Card>;
}

function RichText({ text }) {
  if (!text) return null;
  return text.split("\n\n").map((para, i) => {
    const html = para
      .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${T.text}">$1</strong>`)
      .replace(/\n/g, "<br/>");
    return <p key={i} style={{ margin: i > 0 ? "10px 0 0" : 0, fontSize: "13px", color: T.mid, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

function ErrorBox({ message, onRetry }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: "8px", background: T.roseS, border: `1px solid ${T.rose}33`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
      <p style={{ margin: 0, fontSize: "13px", color: T.rose }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: T.rose, color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE BASE
   ═══════════════════════════════════════════════════════════════════════════ */

function useKnowledgeBase() {
  const [papers, setPapers] = useState([]);

  const add = useCallback((a) => {
    setPapers((prev) => prev.some((p) => p.title === a.title) ? prev : [...prev, a]);
  }, []);

  const remove = useCallback((title) => {
    setPapers((prev) => prev.filter((p) => p.title !== title));
  }, []);

  const getContext = useCallback((query) => {
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    return papers
      .map((p) => {
        const blob = JSON.stringify(p).toLowerCase();
        let score = words.reduce((s, w) => s + (blob.includes(w) ? 1 : 0), 0);
        safeArray(p, "tags").forEach((t) => { if (q.includes(t.replace(/_/g, " "))) score += 3; });
        return { p, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ p }) => ({
        title: p.title, authors: p.authors, year: p.year, tags: p.tags,
        summary: safe(p, "theory.summary"),
        findings: safeArray(p, "interpretations.main_findings").join("; "),
        models: safeArray(p, "methodology.models_used").map((m) => m.name).join(", "),
        narrative: safe(p, "deep_dive.paper_narrative"),
        math: safeArray(p, "deep_dive.math_foundations").map((m) => m.name).join(", "),
        econ: safeArray(p, "deep_dive.econ_foundations").map((e) => e.name).join(", "),
      }));
  }, [papers]);

  return { papers, add, remove, getContext };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════════════════ */

function Sidebar({ papers, active, onSelect, onRemove, onUpload, uploading, collapsed, toggleCollapse }) {
  const ref = useRef(null);
  const w = collapsed ? "48px" : "250px";

  return (
    <div style={{ width: w, minWidth: w, borderRight: `1px solid ${T.border}`, background: T.bg, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, transition: "width 0.2s", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: collapsed ? "14px 12px" : "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: T.text }}>Library</div>
            <div style={{ fontSize: "10px", color: T.dim }}>{papers.length} paper{papers.length !== 1 ? "s" : ""}</div>
          </div>
        )}
        <button onClick={toggleCollapse} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: "14px", padding: "4px" }}>
          {collapsed ? "\u25B6" : "\u25C0"}
        </button>
      </div>

      {/* Paper list */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: "auto", padding: "6px" }}>
          {papers.map((p, i) => (
            <div key={i} onClick={() => onSelect(p)} style={{
              padding: "8px 10px", borderRadius: "6px", cursor: "pointer", marginBottom: "3px",
              background: active?.title === p.title ? T.blueS : "transparent",
              border: `1px solid ${active?.title === p.title ? T.borderHi : "transparent"}`,
            }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: T.text, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.title}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
                <span style={{ fontSize: "10px", color: T.dim }}>{p.year}</span>
                <button onClick={(e) => { e.stopPropagation(); onRemove(p.title); }} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: "11px", padding: "2px" }}>
                  \u2715
                </button>
              </div>
            </div>
          ))}
          {papers.length === 0 && (
            <p style={{ fontSize: "11px", color: T.dim, textAlign: "center", padding: "20px 8px", lineHeight: 1.5 }}>
              Upload PDFs to build your knowledge base
            </p>
          )}
        </div>
      )}

      {/* Upload button */}
      {!collapsed && (
        <div style={{ padding: "10px", borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => ref.current?.click()} disabled={uploading} style={{
            width: "100%", padding: "8px", borderRadius: "6px", border: `1px dashed ${uploading ? T.dim : T.blue}`,
            background: uploading ? T.raised : T.blueS, color: uploading ? T.dim : T.blue,
            fontSize: "12px", fontWeight: 700, cursor: uploading ? "default" : "pointer", fontFamily: "inherit",
          }}>
            {uploading ? "Analyzing\u2026" : "+ Add Paper"}
          </button>
          <input ref={ref} type="file" accept=".pdf" onChange={onUpload} style={{ display: "none" }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT — cross-paper synthesis + single-paper Q&A
   ═══════════════════════════════════════════════════════════════════════════ */

function Chat({ kb, activePaper }) {
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const ask = useCallback(async () => {
    if (!q.trim() || loading) return;
    const question = q.trim();
    setQ("");
    setLoading(true);
    setMsgs((prev) => [...prev, { role: "user", text: question }]);

    try {
      const ctx = kb.getContext(question);
      const sys = (activePaper
        ? QA_PROMPT + "\n\nPaper: " + activePaper.title + "\nContext: " + JSON.stringify({
            summary: safe(activePaper, "theory.summary"),
            narrative: safe(activePaper, "deep_dive.paper_narrative"),
            math: safeArray(activePaper, "deep_dive.math_foundations").map((m) => ({ name: m.name, eli5: m.eli5 })),
            econ: safeArray(activePaper, "deep_dive.econ_foundations").map((e) => ({ name: e.name, eli5: e.eli5 })),
            findings: safe(activePaper, "interpretations.main_findings"),
          })
        : `You are a research synthesizer. Answer using ALL relevant papers. Cite papers by title. Use ** for bold.\n\nKNOWLEDGE BASE (${ctx.length} papers):\n${JSON.stringify(ctx)}`
      );
      const history = msgs.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      const text = await callClaude(sys, [...history, { role: "user", content: question }], 2500);
      setMsgs((prev) => [...prev, { role: "assistant", text }]);
    } catch (err) {
      setMsgs((prev) => [...prev, { role: "assistant", text: "Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  }, [q, loading, kb, msgs, activePaper]);

  const label = activePaper ? `Asking about: ${activePaper.title.slice(0, 50)}` : `${kb.papers.length} paper${kb.papers.length !== 1 ? "s" : ""} in library`;
  const starters = activePaper
    ? ["Break down the core model step by step", "How would I implement this in Python?", "What market scenario motivates this?", "What's the strongest improvement I could make?"]
    : kb.papers.length > 1
    ? ["What math techniques are shared across papers?", "Which paper should I replicate first?", "How do these papers model commodity prices differently?"]
    : ["Upload papers to start asking questions"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, fontSize: "12px", color: T.mid }}>
        {label}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
        {msgs.length === 0 && (
          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: T.mid, marginBottom: "16px" }}>{activePaper ? "Ask anything about this paper" : "Ask questions across your library"}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", maxWidth: "480px", margin: "0 auto" }}>
              {starters.map((s, i) => (
                <button key={i} onClick={() => (kb.papers.length > 0 || activePaper) && setQ(s)} style={{
                  padding: "7px 12px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.raised,
                  color: T.mid, fontSize: "12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  opacity: kb.papers.length > 0 || activePaper ? 1 : 0.4,
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: "14px", display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "10px", background: m.role === "user" ? T.blueM : T.raised, border: m.role === "user" ? "none" : `1px solid ${T.border}` }}>
              {m.role === "user" ? <p style={{ margin: 0, fontSize: "13px", color: T.text }}>{m.text}</p> : <RichText text={m.text} />}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "4px", padding: "8px" }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.blue, animation: `dot 1s ${i * 0.15}s infinite` }} />)}
            <style>{`@keyframes dot{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 18px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask a question\u2026" disabled={kb.papers.length === 0 && !activePaper}
          style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: "13px", outline: "none", fontFamily: "inherit" }}
        />
        <button onClick={ask} disabled={loading || !q.trim()} style={{
          padding: "9px 16px", borderRadius: "8px", border: "none", background: T.blue, color: "#fff",
          fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: loading || !q.trim() ? 0.4 : 1,
        }}>\u2192</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONCEPT CARD (Deep Dive)
   ═══════════════════════════════════════════════════════════════════════════ */

function ConceptCard({ concept, type, depth, open, toggle }) {
  const isMath = type === "math";
  const color = DOMAIN_COLORS[concept.domain] || "blue";

  return (
    <div style={{ background: T.surface, border: `1px solid ${open ? T.borderHi : T.border}`, borderRadius: "8px", overflow: "hidden" }}>
      <div onClick={toggle} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <div style={{ width: "26px", height: "26px", borderRadius: "6px", background: isMath ? T.purpleS : T.tealS, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>
            {isMath ? "\u2211" : "$"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{concept.name}</div>
            <Badge color={color}>{(concept.domain || "").replace(/_/g, " ")}</Badge>
          </div>
        </div>
        <span style={{ color: T.dim, fontSize: "12px", transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>\u25BE</span>
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: "8px", marginTop: "0" }}>
          {/* Mental model */}
          {concept.visual_analogy && (
            <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "6px", borderLeft: `3px solid ${isMath ? T.purple : T.teal}`, background: isMath ? T.purpleS : T.tealS }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: isMath ? T.purple : T.teal, marginBottom: "3px" }}>Mental model</div>
              <p style={{ margin: 0, fontSize: "13px", color: T.text, lineHeight: 1.5, fontStyle: "italic" }}>{concept.visual_analogy}</p>
            </div>
          )}

          {/* Depth explanation */}
          <div style={{ padding: "10px 12px", background: T.bg, borderRadius: "6px" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: T.blue, marginBottom: "4px" }}>
              {depth === "eli5" ? "Simple explanation" : depth === "undergraduate" ? "Undergraduate level" : "Rigorous treatment"}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: T.mid, lineHeight: 1.7 }}>{concept[depth] || "Not available at this depth."}</p>
          </div>

          {/* Why this paper */}
          {concept.why_this_paper && (
            <div style={{ padding: "10px 12px", background: T.blueS, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: T.blue, marginBottom: "3px" }}>Why it matters here</div>
              <p style={{ margin: 0, fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{concept.why_this_paper}</p>
            </div>
          )}

          {/* Math-specific */}
          {isMath && concept.common_pitfalls && (
            <div style={{ padding: "10px 12px", background: T.amberS, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: T.amber, marginBottom: "3px" }}>Common pitfalls</div>
              <p style={{ margin: 0, fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{concept.common_pitfalls}</p>
            </div>
          )}
          {isMath && concept.python_connection && (
            <div style={{ padding: "10px 12px", background: T.greenS, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: T.green, marginBottom: "3px" }}>Python connection</div>
              <p style={{ margin: 0, fontSize: "11px", color: T.text, lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>{concept.python_connection}</p>
            </div>
          )}

          {/* Econ-specific */}
          {!isMath && concept.market_example && (
            <div style={{ padding: "10px 12px", background: T.amberS, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: T.amber, marginBottom: "3px" }}>Real market example</div>
              <p style={{ margin: 0, fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{concept.market_example}</p>
            </div>
          )}
          {!isMath && concept.data_signature && (
            <div style={{ padding: "10px 12px", background: T.cyanS, borderRadius: "6px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: T.cyan, marginBottom: "3px" }}>Data signature</div>
              <p style={{ margin: 0, fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{concept.data_signature}</p>
            </div>
          )}

          {/* Prerequisites */}
          {isMath && concept.prerequisites?.length > 0 && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: T.dim }}>Prereqs:</span>
              {concept.prerequisites.map((p, i) => (
                <span key={i} style={{ padding: "2px 6px", borderRadius: "3px", background: T.raised, fontSize: "10px", color: T.mid, border: `1px solid ${T.border}` }}>{p}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAPER DETAIL — 6 TABS
   ═══════════════════════════════════════════════════════════════════════════ */

function PaperView({ paper, onBack, onAsk }) {
  const [tab, setTab] = useState("deep_dive");
  const [depth, setDepth] = useState("eli5");
  const [expanded, setExpanded] = useState({});
  const toggle = (k) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const math = safeArray(paper, "deep_dive.math_foundations");
  const econ = safeArray(paper, "deep_dive.econ_foundations");

  const TABS = [
    { id: "deep_dive", label: "Deep Dive" },
    { id: "theory", label: "Theory" },
    { id: "methods", label: "Methods" },
    { id: "findings", label: "Findings" },
    { id: "replicate", label: "Replicate" },
    { id: "improve", label: "Improve" },
  ];

  return (
    <div style={{ padding: "20px", maxWidth: "860px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <button onClick={onBack} style={{ background: "none", border: "none", color: T.dim, fontSize: "12px", cursor: "pointer", fontFamily: "inherit", marginBottom: "6px" }}>\u2190 Back</button>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{paper.title}</h2>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.mid }}>{paper.authors} \u00B7 {paper.journal} ({paper.year})</p>
        </div>
        <button onClick={onAsk} style={{ padding: "6px 12px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.raised, color: T.blue, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", marginTop: "18px" }}>
          Ask AI about this paper
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", marginBottom: "16px", background: T.surface, borderRadius: "8px", padding: "2px", border: `1px solid ${T.border}`, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "7px 6px", borderRadius: "6px", border: "none",
            background: tab === t.id ? T.blueM : "transparent",
            color: tab === t.id ? "#fff" : T.dim,
            fontSize: "11px", fontWeight: tab === t.id ? 700 : 500,
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB: Deep Dive ── */}
      {tab === "deep_dive" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Depth toggle */}
          <div style={{ display: "flex", gap: "2px", background: T.bg, borderRadius: "8px", padding: "2px", border: `1px solid ${T.border}` }}>
            {[["eli5", "Simple"], ["undergraduate", "Undergrad"], ["rigorous", "Rigorous"]].map(([id, l]) => (
              <button key={id} onClick={() => setDepth(id)} style={{
                flex: 1, padding: "6px", borderRadius: "6px", border: "none", cursor: "pointer",
                background: depth === id ? T.blueM : "transparent",
                color: depth === id ? T.blue : T.dim,
                fontSize: "11px", fontWeight: depth === id ? 700 : 400, fontFamily: "inherit",
              }}>{l}</button>
            ))}
          </div>

          {/* Narrative */}
          {safe(paper, "deep_dive.paper_narrative") && (
            <Card style={{ borderLeft: `3px solid ${T.blue}` }}>
              <Section title="Paper narrative" sub="The big picture">
                <p style={{ margin: 0, fontSize: "13px", color: T.mid, lineHeight: 1.8, whiteSpace: "pre-line" }}>{paper.deep_dive.paper_narrative}</p>
              </Section>
            </Card>
          )}

          {/* Reading order */}
          {safeArray(paper, "deep_dive.reading_order").length > 0 && (
            <Card>
              <Section title="Reading order" sub="Study these concepts in sequence">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                  {paper.deep_dive.reading_order.map((name, i) => {
                    const isM = math.some((m) => m.name === name);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: isM ? T.purpleS : T.tealS, color: isM ? T.purple : T.teal }}>
                          <span style={{ opacity: 0.4, marginRight: "3px", fontSize: "9px" }}>{i + 1}</span>{name}
                        </span>
                        {i < paper.deep_dive.reading_order.length - 1 && <span style={{ color: T.dim, fontSize: "9px" }}>\u2192</span>}
                      </div>
                    );
                  })}
                </div>
              </Section>
            </Card>
          )}

          {/* Math foundations */}
          {math.length > 0 && (
            <>
              <div style={{ fontSize: "11px", fontWeight: 700, color: T.purple, textTransform: "uppercase", letterSpacing: "0.4px" }}>\u2211 Mathematical foundations ({math.length})</div>
              {math.map((c, i) => <ConceptCard key={`m${i}`} concept={c} type="math" depth={depth} open={!!expanded[`m${i}`]} toggle={() => toggle(`m${i}`)} />)}
            </>
          )}

          {/* Econ foundations */}
          {econ.length > 0 && (
            <>
              <div style={{ fontSize: "11px", fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: "0.4px" }}>$ Economic foundations ({econ.length})</div>
              {econ.map((c, i) => <ConceptCard key={`e${i}`} concept={c} type="econ" depth={depth} open={!!expanded[`e${i}`]} toggle={() => toggle(`e${i}`)} />)}
            </>
          )}

          {/* Connections */}
          {safeArray(paper, "deep_dive.concept_connections").length > 0 && (
            <Card>
              <Section title="Concept connections" sub="How ideas link in this paper">
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {paper.deep_dive.concept_connections.map((c, i) => {
                    const col = c.type === "math_to_math" ? T.purple : c.type === "econ_to_econ" ? T.teal : T.blue;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", background: T.bg, borderRadius: "5px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: col }}>{c.from}</span>
                        <span style={{ fontSize: "9px", color: col }}>\u2192</span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: col }}>{c.to}</span>
                        <span style={{ fontSize: "11px", color: T.mid, flex: 1 }}>{c.relationship}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </Card>
          )}

          {math.length === 0 && econ.length === 0 && <EmptyState message="Deep dive data not available for this paper" />}
        </div>
      )}

      {/* ── TAB: Theory ── */}
      {tab === "theory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Card>
            <Section title="Overview" sub="What this paper does and why it matters">
              <p style={{ margin: 0, fontSize: "13px", color: T.mid, lineHeight: 1.8, whiteSpace: "pre-line" }}>{safe(paper, "theory.summary", "No summary available.")}</p>
            </Section>
          </Card>

          {safeArray(paper, "theory.key_concepts").length > 0 && (
            <Card>
              <Section title="Key concepts">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {paper.theory.key_concepts.map((c, i) => (
                    <div key={i} style={{ padding: "10px", background: T.bg, borderRadius: "6px", border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: T.text }}>{c.name}</span>
                        <Badge color={c.math_level === "none" ? "green" : c.math_level === "basic_stats" ? "blue" : c.math_level === "calculus" ? "amber" : "rose"}>
                          {(c.math_level || "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p style={{ margin: "0 0 5px", fontSize: "12px", color: T.mid, lineHeight: 1.6 }}>{c.explanation}</p>
                      <div style={{ padding: "7px 9px", background: T.blueS, borderRadius: "4px", borderLeft: `2px solid ${T.blue}` }}>
                        <span style={{ fontSize: "9px", fontWeight: 700, color: T.blue, textTransform: "uppercase" }}>Intuition</span>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{c.intuition}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </Card>
          )}

          {safeArray(paper, "theory.equations").length > 0 && (
            <Card>
              <Section title="Key equations" sub="The math, decoded">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {paper.theory.equations.map((eq, i) => (
                    <div key={i} style={{ padding: "10px", background: T.bg, borderRadius: "6px", border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: T.green, marginBottom: "6px" }}>{eq.name}</div>
                      <div style={{ padding: "8px 10px", background: "#080B10", borderRadius: "4px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: T.amber, overflowX: "auto", marginBottom: "6px" }}>
                        {eq.latex}
                      </div>
                      <p style={{ margin: "0 0 6px", fontSize: "12px", color: T.mid, lineHeight: 1.5 }}>
                        <strong style={{ color: T.text }}>In plain English: </strong>{eq.plain_english}
                      </p>
                      {safeArray(eq, "each_term").length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {eq.each_term.map((t, j) => (
                            <span key={j} style={{ padding: "2px 7px", borderRadius: "3px", background: T.purpleS, fontSize: "11px", color: T.purple }}>
                              <strong>{t.symbol}</strong> = {t.meaning}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Methods ── */}
      {tab === "methods" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Card>
              <Section title="Data sources">
                {safeArray(paper, "methodology.data_sources").map((d, i) => (
                  <div key={i} style={{ padding: "5px 8px", background: T.bg, borderRadius: "4px", fontSize: "12px", color: T.mid, marginBottom: "3px" }}>
                    <span style={{ color: T.green, marginRight: "6px" }}>\u25CF</span>{d}
                  </div>
                ))}
                {safeArray(paper, "methodology.data_sources").length === 0 && <p style={{ fontSize: "12px", color: T.dim }}>Not specified</p>}
              </Section>
            </Card>
            <Card>
              <Section title="Models used">
                {safeArray(paper, "methodology.models_used").map((m, i) => (
                  <div key={i} style={{ padding: "5px 8px", background: T.bg, borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{m.name}</span>
                    <DiffBadge level={m.difficulty} />
                  </div>
                ))}
              </Section>
            </Card>
          </div>

          {safeArray(paper, "methodology.pipeline_steps").length > 0 && (
            <Card>
              <Section title="Pipeline" sub="From raw data to results">
                <div style={{ paddingLeft: "18px", position: "relative" }}>
                  <div style={{ position: "absolute", left: "5px", top: 0, bottom: 0, width: "2px", background: `linear-gradient(${T.blue}, ${T.green})` }} />
                  {paper.methodology.pipeline_steps.map((s, i) => (
                    <div key={i} style={{ position: "relative", paddingBottom: "14px" }}>
                      <div style={{ position: "absolute", left: "-18px", top: "1px", width: "12px", height: "12px", borderRadius: "50%", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: 800, color: "#fff" }}>{s.step}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: T.text, marginBottom: "2px" }}>{s.name}</div>
                      <p style={{ margin: "0 0 4px", fontSize: "12px", color: T.mid, lineHeight: 1.5 }}>{s.description}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                        {safeArray(s, "python_tools").map((t, j) => (
                          <span key={j} style={{ padding: "2px 5px", borderRadius: "3px", background: T.blueS, fontSize: "10px", color: T.blue, fontFamily: "'JetBrains Mono', monospace" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Findings ── */}
      {tab === "findings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            { key: "main_findings", title: "Main findings", color: T.green },
            { key: "market_implications", title: "Market implications", color: T.blue },
            { key: "limitations", title: "Limitations", color: T.amber },
          ].map((sec) => {
            const items = safeArray(paper, `interpretations.${sec.key}`);
            return items.length > 0 ? (
              <Card key={sec.key}>
                <Section title={sec.title}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ padding: "8px 10px", background: T.bg, borderRadius: "5px", borderLeft: `3px solid ${sec.color}`, fontSize: "12px", color: T.mid, lineHeight: 1.6 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </Section>
              </Card>
            ) : null;
          })}
        </div>
      )}

      {/* ── TAB: Replicate ── */}
      {tab === "replicate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Prerequisites */}
          {safeArray(paper, "replication_plan.prerequisites").length > 0 && (
            <Card>
              <Section title="Prerequisites">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {paper.replication_plan.prerequisites.map((p, i) => (
                    <span key={i} style={{ padding: "3px 8px", borderRadius: "4px", background: T.purpleS, fontSize: "11px", color: T.purple, fontWeight: 600 }}>{p}</span>
                  ))}
                </div>
              </Section>
            </Card>
          )}

          {/* Timeline */}
          {safe(paper, "replication_plan.estimated_weeks") && (
            <div style={{ padding: "10px 14px", background: T.blueS, borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>Estimated: {paper.replication_plan.estimated_weeks} weeks</span>
            </div>
          )}

          {/* Phases */}
          {safeArray(paper, "replication_plan.phases").map((phase, i) => (
            <Card key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "5px", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: "#fff" }}>{phase.phase}</div>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{phase.name}</span>
                  <span style={{ fontSize: "11px", color: T.dim, marginLeft: "6px" }}>{phase.duration}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {safeArray(phase, "tasks").map((t, j) => (
                  <div key={j} style={{ padding: "8px 10px", background: T.bg, borderRadius: "5px", border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: T.text, flex: 1 }}>{t.task}</span>
                      <DiffBadge level={t.difficulty} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                      {safeArray(t, "python_skills_needed").map((s, k) => (
                        <span key={k} style={{ padding: "2px 5px", borderRadius: "3px", background: T.greenS, fontSize: "10px", color: T.green, fontFamily: "'JetBrains Mono', monospace" }}>{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* Repo blueprint */}
          {safe(paper, "github_repo_suggestion.repo_name") && (
            <Card style={{ borderColor: T.blue, borderStyle: "dashed" }}>
              <Section title="GitHub repo blueprint">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 700, color: T.green }}>{paper.github_repo_suggestion.repo_name}</div>
                <p style={{ margin: "2px 0 6px", fontSize: "12px", color: T.mid }}>{paper.github_repo_suggestion.description}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {safeArray(paper, "github_repo_suggestion.folder_structure").map((f, i) => (
                    <span key={i} style={{ padding: "2px 6px", borderRadius: "3px", background: T.bg, border: `1px solid ${T.border}`, fontSize: "11px", color: T.amber, fontFamily: "'JetBrains Mono', monospace" }}>{f}</span>
                  ))}
                </div>
              </Section>
            </Card>
          )}

          {!safe(paper, "replication_plan") && <EmptyState message="Replication plan not available for this paper" />}
        </div>
      )}

      {/* ── TAB: Improve ── */}
      {tab === "improve" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {safeArray(paper, "improvements").map((imp, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, flex: 1 }}>{imp.idea}</span>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <Badge color={imp.impact === "high" ? "green" : imp.impact === "medium" ? "amber" : "blue"}>
                    {imp.impact} impact
                  </Badge>
                  <DiffBadge level={imp.difficulty} />
                </div>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: "12px", color: T.mid, lineHeight: 1.6 }}>{imp.rationale}</p>
              <div style={{ padding: "7px 9px", background: T.bg, borderRadius: "4px", marginBottom: "6px" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, color: T.blue, textTransform: "uppercase" }}>Implementation</span>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.mid, lineHeight: 1.5 }}>{imp.implementation}</p>
              </div>
              <div style={{ padding: "7px 9px", background: T.greenS, borderRadius: "4px" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, color: T.green, textTransform: "uppercase" }}>Portfolio value</span>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.text, lineHeight: 1.5 }}>{imp.portfolio_value}</p>
              </div>
            </Card>
          ))}
          {safeArray(paper, "improvements").length === 0 && <EmptyState message="No improvement suggestions available" />}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════ */

export default function App() {
  const kb = useKnowledgeBase();
  const [view, setView] = useState("chat"); // chat | paper
  const [active, setActive] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  // Progress messages
  const MSGS = ["Reading paper\u2026", "Extracting concepts\u2026", "Building analogies\u2026", "Mapping connections\u2026", "Creating replication plan\u2026", "Finalizing\u2026"];
  useEffect(() => {
    if (!uploading) return;
    let i = 0;
    setUploadMsg(MSGS[0]);
    const iv = setInterval(() => { i = (i + 1) % MSGS.length; setUploadMsg(MSGS[i]); }, 3500);
    return () => clearInterval(iv);
  }, [uploading]);

  const upload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    e.target.value = "";
    setUploading(true);
    setError(null);

    try {
      // Read file
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });

      // Call Claude
      const raw = await callClaude(
        ANALYSIS_PROMPT,
        [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          { type: "text", text: "Analyze this paper. Return ONLY valid JSON." },
        ]}],
        8000
      );

      // Parse
      const analysis = parseAnalysis(raw);
      kb.add(analysis);
      setActive(analysis);
      setView("paper");
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [kb]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      <Sidebar
        papers={kb.papers} active={active}
        onSelect={(p) => { setActive(p); setView("paper"); }}
        onRemove={(t) => { kb.remove(t); if (active?.title === t) { setActive(null); setView("chat"); } }}
        onUpload={upload} uploading={uploading}
        collapsed={collapsed} toggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "auto" }}>
        {/* Upload progress bar */}
        {uploading && (
          <div style={{ padding: "8px 18px", background: T.blueS, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "12px", height: "12px", border: `2px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "12px", color: T.blue, fontWeight: 600 }}>{uploadMsg}</span>
          </div>
        )}

        {/* Error banner */}
        {error && !uploading && (
          <div style={{ padding: "8px 18px" }}>
            <ErrorBox message={`Analysis failed: ${error}`} onRetry={() => setError(null)} />
          </div>
        )}

        {/* Main content */}
        {view === "chat" && <Chat kb={kb} activePaper={null} />}
        {view === "paper" && active && (
          <PaperView
            paper={active}
            onBack={() => setView("chat")}
            onAsk={() => setView("ask")}
          />
        )}
        {view === "ask" && active && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "8px 18px", borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => setView("paper")} style={{ background: "none", border: "none", color: T.dim, fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>\u2190 Back to paper</button>
            </div>
            <Chat kb={kb} activePaper={active} />
          </div>
        )}
      </div>
    </div>
  );
}

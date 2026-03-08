import { useState, useEffect } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { GoogleGenAI, Type } from "@google/genai";

const spinCSS = document.createElement("style");
spinCSS.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinCSS);

const TABS =[
  { id: "intro",    label: "👋 Welcome" },
  { id: "ratings",  label: "⭐ Ratings" },
  { id: "feedback", label: "💬 Feedback" },
  { id: "preview",  label: "📋 Preview & Print" },
];

const DEFAULT_COMPETENCIES =[
  { id: "code_understanding", label: "Understanding Code", color: "#1565c0", bg: "#e3f2fd", desc: "Ability to read, trace, and reason about existing codebases. Asks the right questions and grasps logic quickly." },
  { id: "observability",      label: "Observability",        color: "#2e7d32", bg: "#e8f5e9", desc: "Logging, monitoring, and debugging skills. Ability to instrument code and surface meaningful signals." },
  { id: "presentation",       label: "Presentation",         color: "#e65100", bg: "#fff3e0", desc: "Clarity when presenting work, demos, and findings to the team. Structured communication of technical ideas." },
  { id: "feature_dev",        label: "Feature Development",  color: "#6a1b9a", bg: "#f3e5f5", desc: "End-to-end ability to plan, build, and ship features — from scoping to implementation and delivery." },
  { id: "initiative",         label: "Initiative & Learning",color: "#00695c", bg: "#e0f2f1", desc: "Ownership over tasks, curiosity, self-directed learning, and ability to handle ambiguity with confidence." },
];

const RATING_LABELS =["","Needs improvement","Below expectations","Meets expectations","Above expectations","Outstanding"];

const PROMPTS = {
  keep:["What technical habit or behaviour should they absolutely continue?","What soft skill or working style is already an asset to the team?","Which specific deliverable or contribution stood out positively?"],
  stop:["What habit or pattern is slowing them down or affecting quality?","Is there any communication or collaboration anti-pattern to address?","What is one thing they're over-investing time in at the wrong level?"],
  start:["What skill should they begin building right now for the next phase?","What practice (e.g. documentation, testing, experimentation) are they missing?","What would unlock the most growth for them in the next 30 days?"],
};

function Tab({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} style={{ padding:"9px 16px", borderRadius:20, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, background:active?"#0d47a1":"#fff", color:active?"#fff":"#333", boxShadow:active?"0 2px 8px rgba(13,71,161,.3)":"0 1px 3px rgba(0,0,0,.1)", transition:"all 0.2s" }}>
      {label}
    </button>
  );
}

function StarRating({ value, onChange, color }: any) {
  const [hov, setHov] = useState(0);
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(0)} onClick={() => onChange(i)}
          style={{ fontSize:26, cursor:"pointer", color:i<=(hov||value)?color:"#e0e0e0", transition:"color .15s" }}>★</span>
      ))}
      <span style={{ fontSize:12, color:"#888", marginLeft:6 }}>{RATING_LABELS[hov||value]||""}</span>
    </div>
  );
}

function RatingBar({ value, color }: any) {
  return (
    <div style={{ display:"flex", gap:4, marginTop:4 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ height:8, flex:1, borderRadius:4, background:i<=value?color:"#e0e0e0" }} />
      ))}
    </div>
  );
}

function EditableField({ value, onChange, multiline, placeholder, style = {} }: any) {
  const [editing, setEditing] = useState(false);
  const base = { fontFamily:"inherit", lineHeight:1.6, ...style };
  if (editing) {
    const s = { ...base, width:"100%", padding:"5px 8px", borderRadius:6, border:"1.5px solid #1976d2", outline:"none", boxSizing:"border-box", background:"#f0f7ff", resize:multiline?"vertical":"none" as any };
    return multiline
      ? <textarea autoFocus value={value} onChange={e => onChange(e.target.value)} onBlur={() => setEditing(false)} rows={2} style={s} />
      : <input autoFocus value={value} onChange={e => onChange(e.target.value)} onBlur={() => setEditing(false)} placeholder={placeholder} style={s} />;
  }
  return (
    <div onClick={() => setEditing(true)} title="Click to edit" style={{ display:"flex", alignItems:"flex-start", gap:6, cursor:"text", ...base }}>
      <span style={{ flex:1, color:value?"inherit":"#aaa" }}>{value||placeholder}</span>
      <span style={{ fontSize:12, color:"#b0bec5", flexShrink:0, marginTop:1, userSelect:"none" }}>✏️</span>
    </div>
  );
}

function buildPrintHTML({ internName, ctoName, competencies, ratings, aiResult, keep, stop, start, overallNote }: any) {
  const ratingRows = competencies.map((c: any,i: number) => `
    <tr>
      <td style="padding:8px 14px;font-weight:600;color:${c.color};border-bottom:1px solid #eee">${c.label}</td>
      <td style="padding:8px 14px;font-size:18px;color:${c.color};border-bottom:1px solid #eee">${"★".repeat(ratings[i])}${"☆".repeat(5-ratings[i])}</td>
      <td style="padding:8px 14px;color:#666;border-bottom:1px solid #eee">${RATING_LABELS[ratings[i]]||""}</td>
    </tr>`).join("");

  const section = (heading: string, items: string[], color: string) => !items ? "" : `
    <h3 style="color:${color};margin:22px 0 10px;font-size:16px">${heading}</h3>
    ${items.map(item=>`<div style="border-left:4px solid ${color};padding:10px 14px;margin-bottom:8px;background:#fafafa;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;color:#333">${item}</div>`).join("")}`;

  const rawSection = (heading: string, items: string[], color: string) => {
    const filled = items.filter(i => i.trim());
    if (!filled.length) return "";
    return `<h3 style="color:${color};margin:22px 0 10px;font-size:16px">${heading}</h3>
    ${filled.map(item => `<div style="border-left:4px solid ${color};padding:10px 14px;margin-bottom:8px;background:#fafafa;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;color:#333">${item}</div>`).join("")}`;
  };

  const feedbackSection = aiResult ? `
    <h2 style="color:#1a237e;border-bottom:2px solid #e3f2fd;padding-bottom:6px;margin-top:28px">📝 Overall Assessment</h2>
    <div style="background:#f5f7ff;border-left:4px solid #1a237e;padding:14px 18px;border-radius:0 8px 8px 0;line-height:1.8;margin:14px 0">${aiResult.summary}</div>
    <div style="background:#1a237e;color:#fff;padding:12px 18px;border-radius:8px;margin:14px 0;font-size:14px">⭐ Highlight: ${aiResult.highlight}</div>
    ${section("🟢 Keep Doing", aiResult.keep_polished, "#2e7d32")}
    ${section("🔴 Stop Doing", aiResult.stop_polished, "#c62828")}
    ${section("🔵 Start Doing", aiResult.start_polished, "#1565c0")}
    <div style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0"><strong>🗓 #1 Priority next 30 days:</strong><br><br>${aiResult.priority_action}</div>
    <div style="background:#f3e5f5;border-left:4px solid #7b1fa2;padding:12px 16px;border-radius:0 8px 8px 0;font-style:italic;margin:14px 0;color:#4a148c">"${aiResult.closing}"</div>
  ` : `
    <h2 style="color:#1a237e;border-bottom:2px solid #e3f2fd;padding-bottom:6px;margin-top:28px">💬 Feedback Notes</h2>
    ${rawSection("🟢 Keep Doing", keep, "#2e7d32")}
    ${rawSection("🔴 Stop Doing", stop, "#c62828")}
    ${rawSection("🔵 Start Doing", start, "#1565c0")}
    ${overallNote?.trim() ? `<h3 style="color:#1a237e;margin:22px 0 10px">📝 Overall Note</h3><div style="border-left:4px solid #1a237e;padding:10px 14px;background:#f5f7ff;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;color:#333">${overallNote}</div>` : ""}
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Intern Evaluation — ${internName}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;padding:40px 32px;color:#222;font-size:14px}
    h1{color:#1a237e;margin:0 0 6px;font-size:24px}
    h2{color:#1a237e;border-bottom:2px solid #e3f2fd;padding-bottom:6px;margin-top:28px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    .badge{background:#e3f2fd;color:#1a237e;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;display:inline-block;margin:2px 4px 2px 0}
    .footer{margin-top:40px;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:right}
    @media print{body{padding:20px 24px}}
  </style></head><body>
  <h1>ML Intern Evaluation</h1>
  <div style="margin:10px 0 4px">
    <span class="badge">👤 ${internName}</span>
    <span class="badge">💼 ML Engineer Intern</span>
    <span class="badge">📅 2-month review</span>
    <span class="badge">Reviewed by ${ctoName}</span>
  </div>
  <h2>⭐ Competency Ratings</h2>
  <table>
    <thead><tr style="background:#e3f2fd">
      <th style="padding:8px 14px;text-align:left;color:#1a237e">Competency</th>
      <th style="padding:8px 14px;text-align:left;color:#1a237e">Rating</th>
      <th style="padding:8px 14px;text-align:left;color:#1a237e">Level</th>
    </tr></thead>
    <tbody>${ratingRows}</tbody>
  </table>
  ${feedbackSection}
  <div class="footer">Generated ${new Date().toLocaleDateString("en-US",{day:"numeric",month:"long",year:"numeric"})}</div>
  <script>window.onload = function(){ window.print(); }</script>
  </body></html>`;
}

async function generateSummary({ internName, ctoName, competencies, ratings, keep, stop, start, overallNote }: any) {
  const system = `You are an AI assistant helping a CTO write a polished internship evaluation for an ML engineer intern after 2 months. Respond ONLY with valid JSON, no markdown, no preamble.
Return exactly:
{
  "summary": "<3-4 sentence overall assessment, professional tone, first person as CTO>",
  "keep_polished": ["<1-2 sentence polished version>","<item 2>","<item 3>"],
  "stop_polished":["<1-2 sentence polished version>","<item 2>","<item 3>"],
  "start_polished":["<1-2 sentence polished version>","<item 2>","<item 3>"],
  "highlight": "<single most impressive thing in one sentence>",
  "priority_action": "<single most important focus for next month>",
  "closing": "<warm motivating closing sentence>"
}`;
  
  const ratingLines = competencies.map((c: any,i: number) => `${c.label}: ${ratings[i]}/5`).join(", ");
  const user = `CTO: ${ctoName}\nIntern: ${internName}\nRatings: ${ratingLines}\nKeep:\n${keep.map((k: string,i: number)=>`${i+1}. ${k||"(empty)"}`).join("\n")}\nStop:\n${stop.map((s: string,i: number)=>`${i+1}. ${s||"(empty)"}`).join("\n")}\nStart:\n${start.map((s: string,i: number)=>`${i+1}. ${s||"(empty)"}`).join("\n")}\nOverall: ${overallNote||"(none)"}`;
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keep_polished: { type: Type.ARRAY, items: { type: Type.STRING } },
          stop_polished: { type: Type.ARRAY, items: { type: Type.STRING } },
          start_polished: { type: Type.ARRAY, items: { type: Type.STRING } },
          highlight: { type: Type.STRING },
          priority_action: { type: Type.STRING },
          closing: { type: Type.STRING }
        },
        required: ["summary", "keep_polished", "stop_polished", "start_polished", "highlight", "priority_action", "closing"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate evaluation.");
  }

  return JSON.parse(response.text);
}

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState("intro");
  
  const[ctoName, setCtoName] = useState("");
  const [internName, setInternName] = useState("");
  const [competencies, setCompetencies] = useState(DEFAULT_COMPETENCIES.map(c => ({...c})));
  const [ratings, setRatings] = useState(Array(5).fill(0));
  const [keep, setKeep] = useState(["","",""]);
  const [stop, setStop] = useState(["","",""]);
  const [start, setStart] = useState(["","",""]);
  const[overallNote, setOverallNote] = useState("");
  
  const [aiResult, setAiResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const[error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // 1. LOCAL STORAGE: Load on Mount
  useEffect(() => {
    const saved = localStorage.getItem("ml_intern_review");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.ctoName) setCtoName(parsed.ctoName);
        if (parsed.internName) setInternName(parsed.internName);
        if (parsed.competencies) setCompetencies(parsed.competencies);
        if (parsed.ratings) setRatings(parsed.ratings);
        if (parsed.keep) setKeep(parsed.keep);
        if (parsed.stop) setStop(parsed.stop);
        if (parsed.start) setStart(parsed.start);
        if (parsed.overallNote) setOverallNote(parsed.overallNote);
        if (parsed.aiResult) setAiResult(parsed.aiResult);
      } catch(e) { console.error("Could not load saved data."); }
    }
    setIsLoaded(true);
  },[]);

  // 1. LOCAL STORAGE: Save on Change
  useEffect(() => {
    if (!isLoaded) return;
    const dataToSave = { ctoName, internName, competencies, ratings, keep, stop, start, overallNote, aiResult };
    localStorage.setItem("ml_intern_review", JSON.stringify(dataToSave));
  },[ctoName, internName, competencies, ratings, keep, stop, start, overallNote, aiResult, isLoaded]);

  const updateComp = (i: number, field: string, val: any) => setCompetencies(cs => cs.map((c,j) => j===i?{...c,[field]:val}:c));
  const setArr = (setter: any, i: number, v: any) => setter((a: any[]) => a.map((x,j) => j===i?v:x));

  const missing =[
    (!ctoName.trim() || !internName.trim()) && "Names (Welcome tab)",
    !ratings.every(r => r>0) && "All ratings (Ratings tab)",
    !keep.some(k=>k.trim()) && "At least one Keep Doing note",
    !stop.some(s=>s.trim()) && "At least one Stop Doing note",
    !start.some(s=>s.trim()) && "At least one Start Doing note",
  ].filter(Boolean);
  const canPreview = missing.length === 0;

  const avgRating = ratings.every(r=>r>0) ? (ratings.reduce((s,v)=>s+v,0)/ratings.length).toFixed(1) : null;

  const handleGenerate = async () => {
    setError(null); setLoading(true);
    try {
      const r = await generateSummary({ internName, ctoName, competencies, ratings, keep, stop, start, overallNote });
      setAiResult(r);
    } catch(e: any) { 
      setError(e.message || "Generation failed. Please try again."); 
    }
    finally { setLoading(false); }
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    localStorage.removeItem("ml_intern_review");
    setCtoName("");
    setInternName("");
    setCompetencies(DEFAULT_COMPETENCIES.map(c => ({...c})));
    setRatings(Array(5).fill(0));
    setKeep(["","",""]);
    setStop(["","",""]);
    setStart(["","",""]);
    setOverallNote("");
    setAiResult(null);
    setTab("intro");
    setConfirmReset(false);
  };

  const handlePrint = () => {
    const html = buildPrintHTML({ internName, ctoName, competencies, ratings, aiResult, keep, stop, start, overallNote });
    const blob = new Blob([html], { type:"text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isLoaded) return null; // Prevent hydration flash

  // ── PREVIEW TAB CONTENT ─────────────────────────────────────────────────
  const PreviewTab = () => {
    const hasResult = aiResult !== null;

    // Format data for Radar Chart
    const chartData = competencies.map((c, i) => ({
      subject: c.label.length > 16 ? c.label.substring(0, 16) + "..." : c.label,
      score: ratings[i],
      fullMark: 5,
    }));

    return (
      <>
        {/* Visualizations Container (Radar + Bars) */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          
          {/* Radar Chart Visualization */}
          <div style={{ flex: "1 1 340px", background:"#fff", borderRadius:14, padding:"20px 24px", boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
            <h2 style={{ color:"#1a237e", margin:"0 0 14px" }}>📊 Skill Radar</h2>
            <div style={{ height: 260, width: "100%", marginLeft: "-10px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                  <PolarGrid stroke="#e0e0e0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#333", fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
                  <Radar name="Intern" dataKey="score" stroke="#1a237e" strokeWidth={2} fill="#3949ab" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rating Summary Bars */}
          <div style={{ flex: "1 1 340px", background:"#fff", borderRadius:14, padding:"20px 24px", boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
               <h2 style={{ color:"#1a237e", margin: 0 }}>⭐ Breakdown</h2>
               {avgRating && <span style={{ background: "#e3f2fd", color: "#1a237e", padding: "4px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Avg: {avgRating}</span>}
            </div>
            
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {competencies.map((c,i) => (
                <div key={c.id} style={{ background:c.bg, borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:11, color:c.color, fontWeight:700, marginBottom:6, lineHeight:1.3 }}>{c.label}</div>
                  <div style={{ fontSize:16 }}>{"★".repeat(ratings[i])}{"☆".repeat(5-ratings[i])}</div>
                  <RatingBar value={ratings[i]} color={c.color} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action panel — distinct before/after states */}
        <div style={{ background:"#fff", borderRadius:14, padding:"22px 26px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ display:"inline-block", width:28, height:28, border:"3px solid #1976d2", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
              <span style={{ color:"#1a237e", fontWeight:600 }}>AI is polishing your feedback…</span>
            </div>
          )}

          {!loading && !hasResult && (
            <>
              <h3 style={{ color:"#1a237e", margin:"0 0 6px" }}>✨ Generate AI Evaluation</h3>
              <p style={{ fontSize:13, color:"#666", margin:"0 0 14px" }}>Polish your notes into a professional evaluation using AI.</p>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button onClick={handleGenerate} style={{ background:"linear-gradient(135deg,#1a237e,#3949ab)", color:"#fff", border:"none", padding:"12px 26px", borderRadius:24, fontWeight:700, fontSize:14, cursor:"pointer", transition: "transform 0.1s" }} onMouseDown={e => e.currentTarget.style.transform="scale(0.97)"} onMouseUp={e => e.currentTarget.style.transform="scale(1)"}>
                  ✨ Generate AI Evaluation
                </button>
                <button onClick={handlePrint} style={{ background:"#fff", color:"#1a237e", border:"2px solid #1a237e", padding:"12px 26px", borderRadius:24, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                  🖨️ Print Form Only
                </button>
              </div>
            </>
          )}

          {!loading && hasResult && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <span style={{ fontSize:22 }}>✅</span>
                <h3 style={{ color:"#2e7d32", margin:0 }}>Evaluation ready!</h3>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button onClick={handlePrint} style={{ background:"linear-gradient(135deg,#1b5e20,#388e3c)", color:"#fff", border:"none", padding:"12px 26px", borderRadius:24, fontWeight:700, fontSize:14, cursor:"pointer", transition: "transform 0.1s" }} onMouseDown={e => e.currentTarget.style.transform="scale(0.97)"} onMouseUp={e => e.currentTarget.style.transform="scale(1)"}>
                  🖨️ Print Full Evaluation
                </button>
                <button onClick={() => setAiResult(null)} style={{ background:"none", border:"1px solid #ccc", color:"#666", borderRadius:24, padding:"12px 20px", fontSize:13, cursor:"pointer" }}>
                  ↩ Re-generate
                </button>
              </div>
            </>
          )}

          {error && <div style={{ marginTop:14, color:"#d32f2f", fontSize:14, background: "#ffebee", padding: "10px 14px", borderRadius: 8 }}><strong>Error:</strong> {error}</div>}
        </div>

        {/* Polished evaluation preview */}
        {hasResult && (
          <>
            <div style={{ background:"linear-gradient(135deg,#1a237e,#283593)", borderRadius:14, padding:"22px 26px", marginBottom:14, color:"#fff" }}>
              <div style={{ fontSize:11, letterSpacing:2, opacity:.7, marginBottom:6 }}>CTO EVALUATION SUMMARY</div>
              <p style={{ margin:"0 0 14px", fontSize:14, lineHeight:1.85, opacity:.95 }}>{aiResult.summary}</p>
              <div style={{ background:"rgba(255,255,255,.15)", borderRadius:10, padding:"10px 16px", fontSize:13 }}>
                <span style={{ opacity:.7 }}>⭐ Highlight: </span><span style={{ fontWeight:600 }}>{aiResult.highlight}</span>
              </div>
            </div>
            {[["🟢 Keep Doing", aiResult.keep_polished, "#2e7d32", "#e8f5e9"],["🔴 Stop Doing", aiResult.stop_polished, "#c62828", "#ffebee"],["🔵 Start Doing", aiResult.start_polished, "#1565c0", "#e3f2fd"]].map(([heading,items,color,bg]) => (
              <div key={heading as string} style={{ background:"#fff", borderRadius:14, padding:"18px 22px", marginBottom:12, boxShadow:"0 2px 6px rgba(0,0,0,.06)" }}>
                <h3 style={{ color: color as string, margin:"0 0 12px" }}>{heading as string}</h3>
                {((items as string[])||[]).map((item: string,i: number) => (
                  <div key={i} style={{ background: bg as string, borderRadius:8, padding:"10px 14px", marginBottom:8, borderLeft:`4px solid ${color}` }}>
                    <span style={{ fontSize:13, color:"#333", lineHeight:1.7 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ background:"#e3f2fd", borderRadius:12, padding:"14px 18px", marginBottom:12, borderLeft:"4px solid #1565c0" }}>
              <div style={{ fontWeight:700, color:"#0d47a1", fontSize:13, marginBottom:3 }}>🗓 #1 Priority for next 30 days</div>
              <div style={{ fontSize:14, color:"#333" }}>{aiResult.priority_action}</div>
            </div>
            <div style={{ background:"#f3e5f5", borderRadius:12, padding:"14px 18px", marginBottom:16, borderLeft:"4px solid #7b1fa2" }}>
              <div style={{ fontWeight:700, color:"#4a148c", fontSize:13, marginBottom:3 }}>💬 Closing</div>
              <div style={{ fontSize:14, color:"#333", fontStyle:"italic" }}>"{aiResult.closing}"</div>
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:"#f0f4f8", minHeight:"100vh", padding:"24px 16px" }}>
      <div style={{ maxWidth:840, margin:"0 auto" }}>

        <div style={{ background:"linear-gradient(135deg,#1a237e,#283593)", borderRadius:16, padding:"26px 30px", marginBottom:20, color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:3, opacity:.7, marginBottom:4 }}>CTO REVIEW · ML ENGINEER INTERN · 2 MONTHS</div>
            <h1 style={{ margin:"0 0 4px", fontSize:26, fontWeight:800 }}>Performance Review</h1>
            <p style={{ margin:0, fontSize:13, opacity:.85 }}>Rate · Give structured feedback · AI-polishes · Print</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {isLoaded && <div style={{ fontSize: 11, background:"rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: 12 }}>💾 Auto-saved</div>}
            <button onClick={handleReset} style={{ background: confirmReset ? "#d32f2f" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "6px 12px", borderRadius: 12, fontSize: 11, cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background=confirmReset ? "#b71c1c" : "rgba(255,255,255,0.2)"} onMouseLeave={e => e.currentTarget.style.background=confirmReset ? "#d32f2f" : "rgba(255,255,255,0.1)"}>
              {confirmReset ? "⚠️ Click again to confirm" : "🔄 Start New Review"}
            </button>
          </div>
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
          {TABS.map(t => <Tab key={t.id} label={t.label} active={tab===t.id} onClick={() => setTab(t.id)} />)}
        </div>

        {/* ── WELCOME ── */}
        {tab==="intro" && (
          <>
            <div style={{ background:"#fff", borderRadius:14, padding:"24px 28px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
              <h2 style={{ color:"#1a237e", margin:"0 0 12px" }}>👋 How this works</h2>
              <p style={{ fontSize:14, lineHeight:1.9, color:"#444", margin:"0 0 20px" }}>
                This form takes about <b>10 minutes</b>. Rate your intern across five competencies, write raw notes for Keep / Stop / Start, and AI will polish everything into a professional evaluation ready to print. All data is saved securely in your browser.
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {[["1️⃣","Add names","intro"],["2️⃣","Rate skills","ratings"],["3️⃣","Write notes","feedback"],["4️⃣","Preview & print","preview"]].map(([icon,lbl,t]) => (
                  <div key={t} onClick={() => setTab(t)} style={{ background:tab===t?"#e8eaf6":"#f5f5f5", borderRadius:10, padding:"14px 10px", textAlign:"center", cursor:"pointer", border:"2px solid", borderColor:tab===t?"#3949ab":"transparent", transition:"all 0.2s" }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#1a237e" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ background:"#fff", borderRadius:14, padding:"24px 28px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
              <h2 style={{ color:"#1a237e", margin:"0 0 14px" }}>👤 Names</h2>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[["Your name (CTO) *",ctoName,setCtoName,"e.g. Sarah Chen"],["Intern's full name *",internName,setInternName,"e.g. Alex Dupont"]].map(([lbl,val,set,ph]) => (
                  <div key={lbl as string}>
                    <label style={{ fontSize:13, fontWeight:600, color:"#555", display:"block", marginBottom:5 }}>{lbl as string}</label>
                    <input value={val as string} onChange={e => (set as any)(e.target.value)} placeholder={ph as string}
                      style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #ccc", fontSize:14, boxSizing:"border-box", outline:"none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor="#3949ab"} onBlur={e => e.target.style.borderColor="#ccc"} />
                  </div>
                ))}
              </div>
              <button onClick={() => setTab("ratings")} disabled={!ctoName.trim()||!internName.trim()}
                style={{ marginTop:18, background:!ctoName.trim()||!internName.trim()?"#ccc":"linear-gradient(135deg,#1a237e,#3949ab)", color:"#fff", border:"none", padding:"11px 28px", borderRadius:20, fontWeight:700, fontSize:14, cursor:!ctoName.trim()||!internName.trim()?"not-allowed":"pointer" }}>
                Continue to Ratings →
              </button>
            </div>
          </>
        )}

        {/* ── RATINGS ── */}
        {tab==="ratings" && (
          <>
            <div style={{ background:"#e8eaf6", borderRadius:10, padding:"11px 16px", marginBottom:8, fontSize:13, color:"#283593" }}>
              ⭐ Rating guide: <b>1</b> = Needs improvement &nbsp;·&nbsp; <b>3</b> = Meets expectations &nbsp;·&nbsp; <b>5</b> = Outstanding
            </div>
            <div style={{ background:"#fff9e6", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#b45309" }}>
              ✏️ Click any <b>category name</b> or <b>description</b> to customise it for this specific intern.
            </div>
            {competencies.map((c,i) => (
              <div key={c.id} style={{ background:"#fff", borderRadius:14, padding:"18px 22px", marginBottom:14, boxShadow:"0 2px 6px rgba(0,0,0,.06)", borderLeft:`4px solid ${c.color}` }}>
                <div style={{ marginBottom:8 }}>
                  <EditableField value={c.label} onChange={(v: any) => updateComp(i,"label",v)} placeholder="Category name…" style={{ fontWeight:700, fontSize:15, color:c.color }} />
                  <EditableField value={c.desc} onChange={(v: any) => updateComp(i,"desc",v)} multiline placeholder="Add a description…" style={{ color:"#888", fontSize:12, marginTop:4 }} />
                </div>
                <StarRating value={ratings[i]} onChange={(v: any) => setRatings(r => r.map((x,j) => j===i?v:x))} color={c.color} />
              </div>
            ))}
            {avgRating && (
              <div style={{ background:"linear-gradient(135deg,#1a237e,#3949ab)", borderRadius:12, padding:"14px 20px", color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <span style={{ fontWeight:600, fontSize:14 }}>Average rating</span>
                <span style={{ fontSize:28, fontWeight:800 }}>{avgRating}<span style={{ fontSize:14, opacity:.6 }}>/5</span></span>
              </div>
            )}
            <button onClick={() => setTab("feedback")} disabled={!ratings.every(r=>r>0)}
              style={{ background:!ratings.every(r=>r>0)?"#ccc":"linear-gradient(135deg,#1a237e,#3949ab)", color:"#fff", border:"none", padding:"11px 28px", borderRadius:20, fontWeight:700, fontSize:14, cursor:!ratings.every(r=>r>0)?"not-allowed":"pointer" }}>
              Continue to Feedback →
            </button>
          </>
        )}

        {/* ── FEEDBACK ── */}
        {tab==="feedback" && (
          <>
            <div style={{ background:"#fff3e0", borderRadius:10, padding:"11px 16px", marginBottom:16, fontSize:13, color:"#e65100" }}>
              💡 Write <b>raw, honest notes</b> — the AI will restructure them into polished professional language.
            </div>
            {[["🟢 Keep Doing",keep,setKeep,"#2e7d32","#e8f5e9",PROMPTS.keep],["🔴 Stop Doing",stop,setStop,"#c62828","#ffebee",PROMPTS.stop],["🔵 Start Doing",start,setStart,"#1565c0","#e3f2fd",PROMPTS.start]].map(([heading,vals,setter,color,bg,prompts]) => (
              <div key={heading as string} style={{ background:"#fff", borderRadius:14, padding:"20px 24px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
                <h3 style={{ color: color as string, margin:"0 0 14px", fontSize:16 }}>{heading as string}</h3>
                {(vals as string[]).map((v: string,i: number) => (
                  <div key={i} style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:5, fontStyle:"italic" }}>💭 {(prompts as string[])[i]}</label>
                    <textarea value={v} onChange={e => setArr(setter,i,e.target.value)} placeholder="Raw notes — write freely…"
                      style={{ width:"100%", minHeight:68, padding:"10px 12px", borderRadius:8, border:`1px solid ${v.trim()?color:"#ddd"}`, fontSize:14, lineHeight:1.7, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", outline:"none", background:v.trim()?bg as string:"#fff", transition:"all .2s" }} onFocus={e => e.target.style.borderColor=color as string} onBlur={e => e.target.style.borderColor=v.trim()?color as string:"#ddd"} />
                  </div>
                ))}
              </div>
            ))}
            <div style={{ background:"#fff", borderRadius:14, padding:"20px 24px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,.07)" }}>
              <h3 style={{ color:"#1a237e", margin:"0 0 8px" }}>📝 Overall Note <span style={{ fontWeight:400, fontSize:13, color:"#aaa" }}>(optional)</span></h3>
              <textarea value={overallNote} onChange={e => setOverallNote(e.target.value)} placeholder="Any specific context, projects, or observations for the AI to emphasize in the summary…"
                style={{ width:"100%", minHeight:90, padding:"10px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, lineHeight:1.7, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", outline:"none", transition:"border-color 0.2s" }} onFocus={e => e.target.style.borderColor="#3949ab"} onBlur={e => e.target.style.borderColor="#ddd"} />
            </div>
            <button onClick={() => setTab("preview")} disabled={!canPreview}
              style={{ background:!canPreview?"#ccc":"linear-gradient(135deg,#1a237e,#3949ab)", color:"#fff", border:"none", padding:"11px 28px", borderRadius:20, fontWeight:700, fontSize:14, cursor:!canPreview?"not-allowed":"pointer" }}>
              Preview & Print →
            </button>
            {!canPreview && (
              <div style={{ marginTop:10, background:"#fff3e0", borderRadius:8, padding:"10px 14px" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#e65100", marginBottom:4 }}>⚠️ Please complete the following before continuing:</div>
                {missing.map(m => <div key={m as string} style={{ fontSize:13, color:"#b45309" }}>• {m as string}</div>)}
              </div>
            )}
          </>
        )}

        {/* ── PREVIEW & PRINT ── */}
        {tab==="preview" && <PreviewTab />}

      </div>
    </div>
  );
}

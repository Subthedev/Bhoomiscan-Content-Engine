import { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════
// BHOOMISCAN CONTENT ENGINE v4 — MODULAR WEB APP
// All logic extracted into src/lib/ modules
// ════════════════════════════════════════════════════════════════════

// Module imports
import { loadState, saveState, saveWeek, exportState, importState } from './lib/storage.js';
import {
  HOOKS, CTAS, BIOS, USPS, USP_B, USP_SEC,
  PAIN_CYCLE, ANG, FMT, NRG, CAL, SLOTS, COMP,
  RULES, QGATE, MULTIPLIERS, CALENDAR_GRID,
  calc, wkNum, szn, painEmo, getRecycleStatus,
  countScripts, countScriptsDetailed,
} from './lib/rotation.js';
import { processResearch, processMultiSource, extractFileText } from './lib/research-processor.js';
import { mkP1, mkP2, mkP3, mkP4, mkClean, getResearchPrompts } from './lib/prompt-builder.js';

// ═══ COMPONENT ═══
const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [st, setSt] = useState({ history: [], lastGen: null });
  const [vw, setVw] = useState("home");
  const [res, setRes] = useState("");
  const [files, setFiles] = useState([]);
  const [extr, setExtr] = useState(false);
  const [finds, setFinds] = useState(null);
  const [prompts, setPr] = useState(null);
  const [rot, setRot] = useState(null);
  const [cx, setCx] = useState(null);
  const [logT, setLogT] = useState("");
  const [perfT, setPerfT] = useState("");
  const [cpd, setCpd] = useState(null);
  const [toast, setToast] = useState(null);
  const [exp, setExp] = useState(0);
  const [dateOvr, setDateOvr] = useState("");
  const [mults, setMults] = useState({}); // freshness multipliers: {angKey: multiplier_id}
  const [logLabel, setLogLabel] = useState(""); // optional label for current log entry
  const iR = useRef(null);

  // Normalize a week record's logs to an array (backward compat: old records have log: string)
  const getLogs = (weekRec) => {
    if (!weekRec) return [];
    if (Array.isArray(weekRec.logs) && weekRec.logs.length > 0) return weekRec.logs;
    if (weekRec.log) return [{ ts: weekRec.ts || '', label: 'Log 1', text: weekRec.log, perf: weekRec.perf || '', mults: weekRec.mults }];
    return [];
  };

  useEffect(() => { (async () => { const s = await loadState(); if (s?.history) setSt(s); setLoading(false); })(); }, []);
  useEffect(() => { if (!loading) saveState(st); }, [st, loading]);

  const flash = (m, t) => { setToast({ m, t: t || "ok" }); setTimeout(() => setToast(null), t === "err" ? 5000 : 3000); };

  // FIX 2: Real file extraction — async handler for PDF/DOCX/text
  const onFiles = async (e) => {
    const newFiles = Array.from(e.target.files || []);
    let extracted = 0, failed = 0;
    for (const f of newFiles) {
      try {
        const result = await extractFileText(f);
        if (result.text) {
          setFiles(p => [...p, {
            name: f.name,
            text: result.text,
            size: f.size,
            type: f.name.split('.').pop().toLowerCase(),
            method: result.method
          }]);
          extracted++;
        } else {
          // Extraction failed — store error message as text so user can see and paste manually
          setFiles(p => [...p, {
            name: f.name,
            text: `[⚠ ${f.name}] ${result.error}`,
            size: f.size,
            type: f.name.split('.').pop().toLowerCase(),
            extractionFailed: true
          }]);
          failed++;
        }
      } catch (err) {
        setFiles(p => [...p, {
          name: f.name,
          text: `[⚠ ${f.name}] Unexpected error: ${err.message}. Paste text manually.`,
          size: f.size,
          type: f.name.split('.').pop().toLowerCase(),
          extractionFailed: true
        }]);
        failed++;
      }
    }
    e.target.value = "";
    if (failed > 0 && extracted > 0) {
      flash(`${extracted} file(s) extracted, ${failed} need manual paste`, "err");
    } else if (failed > 0) {
      flash(`${failed} file(s) need manual text paste — see details below`, "err");
    } else {
      flash(`${extracted} file(s) extracted successfully`);
    }
  };

  const extract = () => {
    if (!files.length && !res.trim()) { flash("Upload files or paste text first", "err"); return; }
    setExtr(true);
    try {
      // Build individual sources for multi-document processing
      const sources = files.filter(f => f.text && !f.extractionFailed).map((f, i) => ({
        id: `file_${i}`, name: f.name, text: f.text
      }));
      // Also append file text to the textarea for display
      const allText = files.map(f => f.text).join("\n\n").trim();
      if (allText) {
        setRes(prev => prev.trim() ? (prev + "\n\n--- FROM FILES ---\n" + allText) : allText);
      }
      if (sources.length > 0) {
        const preview = processMultiSource(sources, null, null);
        if (preview.findings.length) {
          setFinds(preview.findings.slice(0, 15).map(f => ({
            stat: f.text.slice(0, 200),
            audience: f.audiences[0]?.toUpperCase() || "ALL",
            pillar: f.pillar,
            stats: f.stats,
            score: f.score,
            arc: f.arc,
            source: f.sourceName,
            isSynthesized: f.isSynthesized,
          })));
        }
        const qualMsg = preview.quality?.suggestions?.length ? ` | ⚠ ${preview.quality.suggestions.length} suggestion(s)` : '';
        flash(`${sources.length} source(s) — ${preview.counts.total} findings (${preview.counts.synthesized || 0} cross-source)${qualMsg}`);
      } else {
        flash("No file content to extract", "err");
      }
    } catch (e) {
      console.error(e);
      flash("Extract failed", "err");
    }
    setExtr(false);
  };

  const generate = () => {
    const now = dateOvr ? new Date(dateOvr + "T12:00:00") : new Date(), wk = wkNum(now), mo = now.getMonth() + 1, yr = now.getFullYear();
    const context = { wk, mo, yr, mn: MN[mo - 1], se: szn(mo), dt: now.toISOString().split("T")[0] };
    const rotation = calc(wk, mo, st.history);
    setCx(context); setRot(rotation);
    // Build multi-source array: files as individual sources + manual text
    const sources = [];
    const validFiles = files.filter(f => f.text && !f.extractionFailed);
    for (let i = 0; i < validFiles.length; i++) {
      sources.push({ id: `file_${i}`, name: validFiles[i].name, text: validFiles[i].text });
    }
    const manualText = res.trim();
    if (manualText && validFiles.length === 0) {
      // No files — treat manual text as the sole source
      sources.push({ id: 'manual', name: 'Manual Entry', text: manualText });
    } else if (manualText && validFiles.length > 0) {
      // Files exist — the textarea contains merged file text from extract().
      // Only add as a separate source if user typed EXTRA text beyond what files provided.
      const fileTexts = validFiles.map(f => f.text);
      const extraText = fileTexts.reduce((txt, ft) => txt.replace(ft, ''), manualText)
        .replace(/---\s*FROM FILES\s*---/g, '').trim();
      if (extraText.length > 50) {
        sources.push({ id: 'manual_extra', name: 'Additional Notes', text: extraText });
      }
    }
    const processed = sources.length > 0 ? processMultiSource(sources, context, rotation) : null;
    // Quality threshold: warn if research is weak (fewer than 3 findings)
    const isWeak = processed && processed.counts.total < 3;
    if (isWeak) {
      flash(`⚠ Weak research: only ${processed.counts.total} finding(s) extracted. Consider adding more source material.`, "err");
    }
    // Quality flag to inject into prompts when research is below threshold
    const weakFlag = isWeak ? "\n⚠ WEAK RESEARCH — Only " + processed.counts.total + " finding(s) extracted. Supplement heavily with Target Audience Guide stat library. At least 2 scripts MUST use library stats as primary data points.\n" : "";
    setPr([
      { t: "Prompt 1 — Buyer (5 Scripts)", tx: mkP1(context, rotation, (processed?.b1 || null) ? (weakFlag + processed.b1) : null) },
      { t: "Prompt 2 — Seller (5 Scripts)", tx: mkP2(context, rotation, (processed?.b2 || null) ? (weakFlag + processed.b2) : null) },
      { t: "Prompt 3 — Agent+NRI (3+2)", tx: mkP3(context, rotation, (processed?.b3 || null) ? (weakFlag + processed.b3) : null) },
      { t: "Prompt 4 — Trending+Mixed (5)", tx: mkP4(context, rotation, (processed?.b4 || null) ? (weakFlag + processed.b4) : null, processed?.shockStat || null) },
      { t: "Cleanup — Master Template", tx: mkClean(context, rotation) },
    ]);
    if (processed) {
      setFinds(processed.findings.slice(0, 15).map(f => ({ stat: f.text.slice(0, 200), audience: f.audiences[0]?.toUpperCase() || "ALL", pillar: f.pillar, stats: f.stats, score: f.score, arc: f.arc, source: f.sourceName, isSynthesized: f.isSynthesized })));
      // Log quality insights
      if (processed.quality) {
        console.log('[Research Quality]', processed.quality);
        if (processed.conflicts.length > 0) console.warn('[Conflicts]', processed.conflicts);
        if (processed.quality.suggestions.length > 0) console.info('[Suggestions]', processed.quality.suggestions);
      }
    }
    setExp(0); setVw("prompts");
    const resMsg = processed ? ` — ${processed.counts.total} findings (${processed.counts.withStats} stats, ${processed.counts.sources} source(s), ${processed.counts.synthesized || 0} cross-source)${isWeak ? " ⚠ WEAK" : ""}` : "";
    flash("Week " + wk + " — Pattern " + rotation.pat + resMsg + " — prompts ready");
  };

  const copy = async (t, i) => {
    try {
      await navigator.clipboard.writeText(t);
      setCpd(i);
      setTimeout(() => setCpd(null), 2000);
      flash(i === "all" ? "All 4 prompts copied!" : "Prompt copied");
    } catch (err) {
      console.error("Copy error:", err);
      flash("Copy failed - check browser permissions", "err");
    }
  };

  const logWeek = () => {
    if (!cx || !rot) { flash("Generate prompts first", "err"); return; }
    const entryTs = new Date().toISOString();
    const exists = st.history.find(w => w.wk === cx.wk && w.yr === cx.yr);
    const prevLogs = getLogs(exists);
    const entry = {
      ts: entryTs,
      label: logLabel.trim() || `Log ${prevLogs.length + 1}`,
      text: logT,
      perf: perfT,
      mults: Object.keys(mults).length > 0 ? mults : undefined,
    };

    let newRec;
    if (exists) {
      // Append new entry to existing week — never replace rotation data
      newRec = { ...exists, logs: [...prevLogs, entry], perf: perfT, ts: entryTs };
    } else {
      newRec = {
        dt: cx.dt, wk: cx.wk, mo: cx.mo, yr: cx.yr, se: cx.se, pat: rot.pat,
        hooks: [...rot.hB.b1, ...rot.hB.b2, ...rot.hB.b3, ...rot.hB.b4],
        ctas: [...rot.cB.b1, ...rot.cB.b2, ...rot.cB.b3, ...rot.cB.b4],
        ang: { buyer: rot.ba, seller: rot.sa, agent: rot.aa, nri: rot.na },
        pains: [rot.pain.p, rot.pain.s], emo: rot.ci,
        logs: [entry], perf: perfT, research: res.slice(0, 2000), ts: entryTs,
      };
    }

    const hist = exists ? st.history.filter(w => !(w.wk === cx.wk && w.yr === cx.yr)) : st.history;
    setSt({ history: [...hist, newRec], lastGen: entryTs });
    saveWeek(newRec);
    flash(`Log ${prevLogs.length + 1} saved for Week ${cx.wk}`);
    // Clear input fields only — keep cx/rot/prompts so user can add another entry
    setLogT(""); setPerfT(""); setMults({}); setLogLabel("");
  };

  const exportD = () => {
    const b = new Blob([JSON.stringify(st, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = `bhoomiscan-${new Date().toISOString().split("T")[0]}.json`; a.click(); flash("Backup downloaded");
  };
  const importD = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => { try { const d = JSON.parse(ev.target.result); if (d.history) { setSt(d); await saveState(d); flash(`Restored ${d.history.length} weeks`); } else flash("Invalid", "err"); } catch { flash("Read error", "err"); } };
    r.readAsText(f); e.target.value = "";
  };

  // ═══ THEME ═══
  const G = "#2d6a4f", GL = "#40916c", BN = "#8b6f47", BD = "#5c4a32", TX = "#3d2c1e", TL = "#6b5b4a", TXL = "#9a8b7a", BR = "#e2ddd5", BG = "#f4f1eb", W = "#ffffff";

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, border: `3px solid ${G}`, borderTop: "3px solid transparent", borderRadius: "50%", margin: "0 auto 16px", animation: "s 1s linear infinite" }} />
        <style>{`@keyframes s{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: 22, fontWeight: 800, color: G, letterSpacing: 3 }}>BHOOMISCAN</div>
        <div style={{ fontSize: 10, color: BN, letterSpacing: 2, marginTop: 3 }}>CONTENT ENGINE</div>
      </div>
    </div>
  );

  const sC = { background: W, border: `1px solid ${BR}`, borderRadius: 12, padding: "18px 20px", marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const sB = (v) => ({
    padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, border: "none", transition: "all 0.2s", letterSpacing: 0.3,
    ...(v === "p" ? { background: G, color: W, boxShadow: "0 2px 8px rgba(45,106,79,0.2)" } : v === "d" ? { background: "rgba(180,64,64,0.08)", color: "#b44040", border: "1px solid rgba(180,64,64,0.2)" } : { background: "#f0ece5", color: BN, border: `1px solid ${BR}` })
  });
  const sBg = (v) => ({
    display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, marginRight: 4, marginBottom: 3,
    ...(v === "g" ? { background: "rgba(45,106,79,0.1)", color: G } : v === "b" ? { background: "rgba(139,111,71,0.1)", color: BN } : { background: "rgba(90,127,160,0.1)", color: "#5a7fa0" })
  });
  const sI = { width: "100%", padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${BR}`, background: W, color: TX, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const sPre = { background: "#faf8f4", border: `1px solid ${BR}`, borderRadius: 8, padding: 16, fontSize: 11, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", color: TL, maxHeight: 440, overflow: "auto", fontFamily: "Consolas,Monaco,monospace" };
  const sTag = { display: "inline-block", padding: "2px 7px", borderRadius: 5, fontSize: 10, background: "#f0ece5", color: TL, marginRight: 3, marginBottom: 3, fontWeight: 600 };

  const now = new Date();
  // FIX 7: Use dateOvr for preview context so research prompts match the overridden date
  const previewDate = dateOvr ? new Date(dateOvr + "T12:00:00") : now;
  const cW = wkNum(previewDate), cM = previewDate.getMonth() + 1, cSe = CAL.find(c => c.m === cM) || CAL[0];
  const ci = ((cW - 1) % 4) + 1, wP = ["A", "B", "C", "D"][(cW - 1) % 4], tH = st.history.length;
  // FIX 6: Compute preview rotation for context-aware research prompts
  const previewRot = rot || calc(cW, cM, st.history);
  const previewCx = cx || { wk: cW, mo: cM, yr: previewDate.getFullYear(), mn: MN[cM - 1], se: szn(cM) };
  const nav = [["home", "Dashboard", "◈"], ["generate", "Generate", "⚡"], ["prompts", "Prompts", "◻"], ["log", "Log", "✎"], ["history", "History", "◷"]];
  const pColors = [G, BN, "#5a7fa0", "#a67c52", GL];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TX, fontFamily: "'Segoe UI',Helvetica,Arial,sans-serif" }}>
      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg,${G},${GL})`, padding: "14px 20px", boxShadow: "0 2px 12px rgba(45,106,79,0.15)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#fff", fontWeight: 800 }}>B</div>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: 2.5 }}>BHOOMISCAN</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5 }}>CONTENT ENGINE v4</div></div>
          </div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {nav.map(([id, l, ic]) => {
              const logBadge = id === "log" ? (() => { const wr = st.history.find(w => w.wk === cW && w.yr === now.getFullYear()); return wr ? getLogs(wr).length : 0; })() : 0;
              return <button key={id} onClick={() => setVw(id)} style={{ padding: "7px 13px", borderRadius: 8, border: "none", background: vw === id ? "rgba(255,255,255,0.2)" : "transparent", color: vw === id ? "#fff" : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 11, fontWeight: vw === id ? 700 : 500, transition: "all 0.15s", position: "relative" }}>
                {ic} {l}{logBadge > 0 && <span style={{ marginLeft: 4, padding: "1px 5px", borderRadius: 7, background: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 900, verticalAlign: "middle" }}>{logBadge}</span>}
              </button>;
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* HOME */}
        {vw === "home" && <>
          {/* Hero Stats with Enhanced Design */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 12, marginBottom: 16 }}>
            {[[tH, "Weeks", "🗓️", `linear-gradient(135deg,${G},${GL})`],
            [tH * 20, "Scripts", "📝", `linear-gradient(135deg,${BN},#a67c52)`],
            [`W${cW}`, "Current", "▶", `linear-gradient(135deg,#5a7fa0,#7698ba)`],
            [`${ci}/4`, "Cycle", "◷", `linear-gradient(135deg,${BD},${BN})`],
            [wP, "Pattern", "◈", `linear-gradient(135deg,#a67c52,#c89b6e)`]].map(([n, l, ic, grad], i) =>
              <div key={i} style={{ background: grad, borderRadius: 12, padding: "16px 10px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", transform: "translateY(0)", transition: "transform 0.2s" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{ic}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>{n}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 2 }}>{l}</div>
              </div>)}
          </div>

          {/* Current Week Seasonal Context - Enhanced with Real-Time Indicator */}
          <div style={{ ...sC, borderLeft: `4px solid ${G}`, background: `linear-gradient(135deg,rgba(45,106,79,0.04),rgba(139,111,71,0.04))`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 20 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: G, letterSpacing: 0.5 }}>This Week's Context</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(45,106,79,0.12)", borderRadius: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: G, animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: G, letterSpacing: 0.5 }}>LIVE</span>
              </div>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
              <span style={{ ...sBg("g"), padding: "4px 12px", fontSize: 11 }}>{szn(cM)}</span>
              <span style={{ ...sBg("b"), padding: "4px 12px", fontSize: 11 }}>{MN[cM - 1]}</span>
              <span style={{ ...sBg(), padding: "4px 12px", fontSize: 11 }}>Emotional Lens {ci}/4</span>
              <span style={{ fontSize: 10, color: TXL, padding: "4px 8px" }}>Updated: {now.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            </div>
            <div style={{ fontSize: 13, color: TX, marginBottom: 8, lineHeight: 1.6 }}><strong style={{ color: G }}>🎉 Festivals:</strong> {cSe.f.join(", ")}</div>
            <div style={{ fontSize: 13, color: BN, fontWeight: 600, fontStyle: "italic", padding: "10px 14px", background: "rgba(139,111,71,0.08)", borderRadius: 8, borderLeft: `3px solid ${BN}` }}>"{cSe.h}"</div>
            {cSe.mi && <div style={{ fontSize: 11, color: TL, marginTop: 6, paddingLeft: 14 }}>💡 Micro-trend: {cSe.mi}</div>}
          </div>

          {/* Weekly Calendar Grid */}
          <div style={{ ...sC, padding: "14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BD }}>📅 Weekly Calendar (20 Slots)</div>
              <div style={{ fontSize: 10, color: TL, fontStyle: "italic" }}>Auto-updates with current week context</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(110px,1fr))", gap: 4, fontSize: 10 }}>
                {CALENDAR_GRID.map(d => <div key={d.day}>
                  <div style={{ fontWeight: 800, color: G, textTransform: "uppercase", letterSpacing: 1, padding: "4px 0", textAlign: "center", borderBottom: `2px solid ${G}`, marginBottom: 4 }}>{d.day}</div>
                  {d.slots.map(s => {
                    const pC = s.pillar === "EDUCATE" ? G : s.pillar === "AGITATE" ? "#b44040" : s.pillar === "EMPOWER" ? BN : s.pillar === "CONNECT" ? "#5a7fa0" : "#a67c52";
                    return <div key={s.code} style={{ background: "#faf8f4", border: `1px solid ${BR}`, borderRadius: 6, padding: "6px 5px", marginBottom: 3, borderLeft: `3px solid ${pC}` }}>
                      <div style={{ fontWeight: 800, color: TX }}>{s.code} <span style={{ color: TXL, fontWeight: 500 }}>{s.time}</span></div>
                      <div style={{ color: pC, fontWeight: 700, fontSize: 9, textTransform: "uppercase" }}>{s.pillar}</div>
                      <div style={{ color: TL, fontSize: 9 }}>{s.aud}</div>
                      <div style={{ color: TXL, fontSize: 8, marginTop: 1 }}>{s.type}</div>
                    </div>;
                  })}
                </div>)}
              </div>
            </div>
          </div>

          {/* Enhanced Workflow Guide */}
          <div style={{ ...sC, borderLeft: `4px solid ${BN}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 20 }}>⚡</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: BD, letterSpacing: 0.3 }}>Weekly Workflow</div>
            </div>
            {[{ t: "Upload research files on Generate tab", ic: "📎", c: G },
            { t: "Click Merge to combine files into research input", ic: "🔄", c: "#5a7fa0" },
            { t: "Click Generate — auto-date, full rotation, 4 prompts", ic: "⚡", c: BN },
            { t: "Copy each prompt → paste into Claude Project → get scripts", ic: "📋", c: G },
            { t: "Log Output tab → paste variation logs → Save", ic: "✓", c: "#a67c52" }].map((item, i) =>
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "start", marginBottom: 10, padding: "8px 10px", background: i % 2 === 0 ? "rgba(45,106,79,0.02)" : "rgba(139,111,71,0.02)", borderRadius: 8, transition: "background 0.2s" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${item.c},${item.c}dd)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: TX, fontWeight: 600, lineHeight: 1.5 }}>{item.t}</div>
                </div>
                <div style={{ fontSize: 18, opacity: 0.5 }}>{item.ic}</div>
              </div>)}
          </div>

          {/* Data Management Section */}
          <div style={{ ...sC, background: "rgba(90,127,160,0.04)", borderLeft: "4px solid #5a7fa0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#5a7fa0", marginBottom: 2 }}>📦 Data Management</div>
                <div style={{ fontSize: 10, color: TL }}>{st.lastGen ? `Last saved: ${new Date(st.lastGen).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "No weeks logged yet"}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...sB(), padding: "8px 14px", fontSize: 11 }} onClick={exportD}>💾 Export Backup</button>
                <button style={{ ...sB(), padding: "8px 14px", fontSize: 11 }} onClick={() => iR.current?.click()}>📂 Import Data</button>
                <input ref={iR} type="file" accept=".json" style={{ display: "none" }} onChange={importD} />
              </div>
            </div>
          </div>

          {/* Week Activity Summary */}
          {tH > 0 && (() => {
            const currentWeekRec = st.history.find(w => w.wk === cW && w.yr === now.getFullYear());
            const l = currentWeekRec || st.history[tH - 1];
            const wLogs = getLogs(l);
            const totalSc = wLogs.reduce((s, e) => s + countScripts(e.text || ""), 0);
            const isCurrentWeek = l.wk === cW && l.yr === now.getFullYear();
            return <div style={{ ...sC, borderLeft: `4px solid ${GL}`, background: "rgba(45,106,79,0.02)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 18 }}>📊</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: G }}>{isCurrentWeek ? "This Week" : "Last Logged"} — W{l.wk} · Pattern {l.pat}</div>
                    <div style={{ fontSize: 10, color: TL }}>{MN[(l.mo || 1) - 1]} {l.yr}</div>
                  </div>
                </div>
                {wLogs.length > 0 && <div style={{ textAlign: "right", padding: "6px 12px", background: "rgba(45,106,79,0.08)", borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: G, lineHeight: 1 }}>{totalSc > 0 ? totalSc : wLogs.length * 20}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: TL, textTransform: "uppercase", letterSpacing: 0.5 }}>scripts · {wLogs.length} run{wLogs.length > 1 ? "s" : ""}</div>
                </div>}
              </div>
              {wLogs.length > 0 ? <div style={{ marginBottom: 10 }}>
                {wLogs.map((entry, i) => {
                  const sc = countScripts(entry.text || "");
                  return <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: i % 2 === 0 ? "rgba(45,106,79,0.04)" : "rgba(139,111,71,0.03)", borderRadius: 6, marginBottom: 3, borderLeft: `3px solid ${sc >= 20 ? G : BN}` }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TX }}>{entry.label || `Variation ${i + 1}`}</span>
                      {entry.ts && <span style={{ fontSize: 9, color: TXL, marginLeft: 6 }}>{new Date(entry.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: sc >= 20 ? "rgba(45,106,79,0.1)" : sc > 0 ? "rgba(230,162,60,0.1)" : "rgba(139,111,71,0.1)", color: sc >= 20 ? G : sc > 0 ? "#a06000" : BN }}>
                      {sc >= 20 ? `✓ ${sc} scripts` : sc > 0 ? `${sc} scripts` : "rotation only"}
                    </span>
                  </div>;
                })}
              </div> : <div style={{ fontSize: 11, color: TXL, fontStyle: "italic", marginBottom: 8 }}>No variation logs yet — run prompts in Claude, then log output in the Log tab</div>}
              <div style={{ fontSize: 11, color: TL, lineHeight: 2 }}>
                <div style={{ marginBottom: 2 }}><strong style={{ color: BD }}>🎣 Hooks:</strong> {[...new Set(l.hooks || [])].slice(0, 5).map(id => <span key={id} style={{ ...sTag, background: "rgba(45,106,79,0.1)", color: G }}>{HOOKS.find(h => h.id === id)?.name}</span>)}</div>
                <div><strong style={{ color: BD }}>💔 Pain:</strong> {(l.pains || []).map(p => <span key={p} style={{ ...sTag, background: "rgba(139,111,71,0.1)", color: BN }}>{p}</span>)}</div>
              </div>
              {isCurrentWeek && cx && <button style={{ ...sB("p"), marginTop: 10, padding: "8px 16px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setVw("log")}>➕ Add Variation {wLogs.length + 1} for Week {l.wk}</button>}
            </div>;
          })()}

          {/* Content Recycling Alerts */}
          {tH > 0 && (() => {
            const today = new Date();
            const recyclable = st.history.map((w, idx) => {
              const wDate = new Date(w.dt || w.ts);
              const daysAgo = Math.floor((today - wDate) / (1000 * 60 * 60 * 24));
              const rs = getRecycleStatus(daysAgo);
              return rs ? { ...w, idx, daysAgo, rs } : null;
            }).filter(Boolean);
            if (!recyclable.length) return null;
            return <div style={{ ...sC, borderLeft: "4px solid #a67c52" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BD, marginBottom: 8 }}>Content Recycling Candidates</div>
              <div style={{ fontSize: 10, color: TL, marginBottom: 8 }}>Strategy Section 6.3: Recycle high-performing content at 30/60/90 day thresholds.</div>
              {recyclable.slice(0, 5).map((w, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#faf8f4", borderRadius: 6, marginBottom: 3, borderLeft: `3px solid ${w.rs.color}` }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 11, color: TX }}>W{w.wk} {MN[(w.mo || 1) - 1]} {w.yr}</span>
                  <span style={{ fontSize: 10, color: TXL, marginLeft: 6 }}>{w.daysAgo}d ago</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: w.rs.color, maxWidth: 200, textAlign: "right" }}>{w.rs.label}</span>
              </div>)}
            </div>;
          })()}
        </>}

        {/* GENERATE */}
        {vw === "generate" && <>
          {/* Date & Week Context - Enhanced */}
          <div style={{ ...sC, borderLeft: `4px solid ${G}`, background: `linear-gradient(135deg,rgba(45,106,79,0.04),rgba(139,111,71,0.04))`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>📅</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: G, letterSpacing: 0.5 }}>{dateOvr ? "Custom Date Selected" : "Today's Date"}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TX, marginBottom: 6 }}>{(dateOvr ? new Date(dateOvr + "T12:00:00") : now).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
                {(() => { const wr = st.history.find(w => w.wk === cW && w.yr === now.getFullYear()); if (!wr) return null; const lc = getLogs(wr).length; return <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#5a7fa0", fontWeight: 600, background: "rgba(90,127,160,0.09)", padding: "4px 10px", borderRadius: 6 }}>📂 Week {cW} — {lc} log entr{lc > 1 ? "ies" : "y"} · Add more in Log tab</div>; })()}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: TL, marginBottom: 4, fontWeight: 600 }}>Override Date:</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="date" style={{ ...sI, width: "auto", padding: "7px 10px", fontSize: 12, fontWeight: 600 }} value={dateOvr} onChange={e => setDateOvr(e.target.value)} />
                  {dateOvr && <button style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: "rgba(180,64,64,0.1)", color: "#b44040", cursor: "pointer", fontSize: 11, fontWeight: 700 }} onClick={() => setDateOvr("")}>✕ Clear</button>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ ...sBg("g"), padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Week {cW}</span>
              <span style={{ ...sBg("b"), padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>{szn(cM)}</span>
              <span style={{ ...sBg("g"), padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Pattern {wP}</span>
              <span style={{ ...sBg(), padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Cycle {ci}/4</span>
            </div>
          </div>

          {/* Research Input Section - Enhanced */}
          <div style={{ ...sC, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 20 }}>📚</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: BD, letterSpacing: 0.3 }}>Research Input</div>
            </div>

            {/* Drag-drop style upload area */}
            <div
              style={{
                border: `2px dashed ${G}`,
                borderRadius: 12,
                padding: 28,
                textAlign: "center",
                cursor: "pointer",
                background: `linear-gradient(135deg,rgba(45,106,79,0.02),rgba(139,111,71,0.02))`,
                marginBottom: 14,
                transition: "all 0.2s"
              }}
              onClick={() => document.getElementById("ru")?.click()}
              onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg,rgba(45,106,79,0.04),rgba(139,111,71,0.04))`}
              onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg,rgba(45,106,79,0.02),rgba(139,111,71,0.02))`}
            >
              <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.7 }}>📎</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: G, marginBottom: 6 }}>Click to upload research files</div>
              <div style={{ fontSize: 11, color: TL, lineHeight: 1.6 }}>
                Supports: <span style={{ fontWeight: 600, color: BN }}>TXT, MD, CSV, JSON, PDF, DOCX</span> <span style={{ fontSize: 9, color: TXL }}>(PDF & DOCX auto-extracted)</span>
              </div>
              <div style={{ fontSize: 10, color: TXL, marginTop: 4, fontStyle: "italic" }}>Drag & drop or click to browse</div>
              <input id="ru" type="file" multiple accept=".txt,.md,.text,.csv,.json,.pdf,.doc,.docx" style={{ display: "none" }} onChange={onFiles} />
            </div>

            {/* File List - Enhanced */}
            {files.length > 0 && <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BD, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span>📋</span>
                <span>{files.length} File{files.length > 1 ? "s" : ""} Ready</span>
              </div>
              {files.map((f, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: `linear-gradient(135deg,rgba(45,106,79,0.04),rgba(139,111,71,0.03))`, borderRadius: 8, marginBottom: 6, border: `1px solid ${BR}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "transform 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateX(0px)"}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: f.extractionFailed ? '#b44040' : G, fontWeight: 700, marginBottom: 3 }}>{f.extractionFailed ? '⚠️' : '📄'} {f.name}</div>
                  <div style={{ fontSize: 10, color: TL, display: "flex", alignItems: "center", gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: "2px 8px", borderRadius: 5, background: f.extractionFailed ? 'rgba(180,64,64,0.15)' : 'rgba(45,106,79,0.15)', color: f.extractionFailed ? '#b44040' : G, fontWeight: 700, letterSpacing: 0.3 }}>{(f.type || 'txt').toUpperCase()}</span>
                    <span style={{ color: TXL, fontWeight: 600 }}>{(f.size / 1024).toFixed(1)} KB</span>
                    {f.method && <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(45,106,79,0.1)', color: G, fontSize: 9, fontWeight: 700 }}>✓ {f.method}</span>}
                    {f.extractionFailed && <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(180,64,64,0.1)', color: '#b44040', fontSize: 9, fontWeight: 700 }}>needs manual paste</span>}
                  </div>
                </div>
                <button onClick={() => { setFiles(p => p.filter((_, j) => j !== i)); setFinds(null); }} style={{ background: "rgba(180,64,64,0.1)", border: "none", color: "#b44040", cursor: "pointer", fontSize: 14, padding: "6px 10px", borderRadius: 6, fontWeight: 700, transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(180,64,64,0.15)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(180,64,64,0.1)"}
                >✕</button>
              </div>)}
              <button style={{ ...sB("p"), width: "100%", marginTop: 8, padding: 12, fontSize: 13, letterSpacing: 0.5, textAlign: "center", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, opacity: extr ? 0.7 : 1, borderRadius: 10 }} onClick={extract} disabled={extr}>
                {extr ? <>⏳ <span>Merging files...</span></> : <>🔄 <span>Merge All Files into Research</span></>}
              </button>
            </div>}

            {/* Smart Findings Display - Shows audience breakdown */}
            {finds?.length > 0 && <div style={{ marginBottom: 14, borderTop: `2px solid ${BR}`, paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: G }}>
                  <span>✅</span>
                  <span>{finds.length} Findings Extracted</span>
                </div>
                {/* Audience breakdown badges */}
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {[["BUYER", G], ["SELLER", BN], ["AGENT", "#5a7fa0"], ["NRI", "#a67c52"], ["TRENDING", "#b44040"]].map(([aud, clr]) => {
                    const count = finds.filter(f => f.audience === aud).length;
                    return count > 0 ? <span key={aud} style={{ padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 700, background: `${clr}18`, color: clr }}>{aud}: {count}</span> : null;
                  })}
                </div>
              </div>
              {finds.slice(0, 8).map((f, i) => <div key={i} style={{ padding: "10px 14px", background: `linear-gradient(135deg,rgba(45,106,79,0.03),rgba(139,111,71,0.02))`, borderRadius: 8, marginBottom: 6, border: `1px solid ${BR}`, borderLeft: `4px solid ${f.pillar === "AGITATE" ? "#b44040" : f.pillar === "TRENDING" ? "#a67c52" : f.pillar === "EMPOWER" ? BN : G}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "center" }}>
                  <span style={{ ...sBg("g"), padding: "3px 9px", fontSize: 10, fontWeight: 700 }}>{f.audience}</span>
                  <span style={{ ...sBg("b"), padding: "3px 9px", fontSize: 10, fontWeight: 700 }}>{f.pillar}</span>
                  {f.stats?.length > 0 && <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 700, background: "rgba(180,64,64,0.1)", color: "#b44040" }}>📊 {f.stats.length} stat{f.stats.length > 1 ? "s" : ""}</span>}
                  {f.score > 0 && <span style={{ fontSize: 9, color: TXL, marginLeft: "auto" }}>⬆ {f.score}</span>}
                </div>
                <div style={{ fontSize: 12, color: TX, fontWeight: 600, lineHeight: 1.5 }}>{f.stat}</div>
              </div>)}
              {finds.length > 8 && <div style={{ fontSize: 10, color: TXL, textAlign: "center", padding: 4 }}>+{finds.length - 8} more findings (all will be used in prompts)</div>}
            </div>}

            {/* Manual Paste - Enhanced */}
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: BN, padding: "8px 12px", background: "rgba(139,111,71,0.05)", borderRadius: 8, border: `1px solid ${BR}`, userSelect: "none" }}>✍️ Or paste research manually ▾</summary>
              <textarea style={{ ...sI, minHeight: 110, marginTop: 10, resize: "vertical", fontSize: 12, lineHeight: 1.6 }} value={res} onChange={e => setRes(e.target.value)} placeholder="Paste weekly research findings, stats, news, trends..." />
            </details>
          </div>

          {/* 3 Platform-Specific Research Prompts */}
          <div style={{ ...sC, borderLeft: `4px solid ${BN}`, background: "rgba(139,111,71,0.03)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 18 }}>🔍</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: BD, letterSpacing: 0.3 }}>Research Prompts (3 Platforms)</div>
                <div style={{ fontSize: 10, color: TL, marginTop: 2 }}>Run all 3 for best coverage. Auto-includes date, pain cycle, season & content angles.</div>
              </div>
            </div>

            {getResearchPrompts(previewRot, previewCx).map((rp, i) => {
              const colors = ["#7c3aed", "#2563eb", "#16a34a"];
              return <div key={rp.id} style={{ marginBottom: 8, borderRadius: 8, border: `1px solid ${BR}`, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: `${colors[i]}08` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{rp.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: colors[i] }}>{rp.name}</div>
                      <div style={{ fontSize: 9, color: TL }}>{rp.desc}</div>
                    </div>
                  </div>
                  <button style={{ ...sB(cpd === rp.id ? "p" : undefined), padding: "7px 14px", fontSize: 11 }} onClick={() => copy(rp.prompt, rp.id)}>
                    {cpd === rp.id ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 10, fontWeight: 600, color: TL, padding: "6px 14px", background: "#faf8f4", userSelect: "none" }}>View prompt ▾</summary>
                  <pre style={{ ...sPre, margin: "0 8px 8px", maxHeight: 120, fontSize: 9 }}>{rp.prompt}</pre>
                </details>
              </div>;
            })}

            <div style={{ fontSize: 10, color: TL, lineHeight: 1.6, padding: "8px 12px", background: "rgba(139,111,71,0.05)", borderRadius: 6, marginTop: 4 }}>
              💡 <strong>Workflow:</strong> Copy each prompt → Run in respective platform → Save output as .txt → Upload all 3 files above → Merge → Generate
            </div>
          </div>

          {/* Generate Button - Enhanced */}
          <button
            style={{
              ...sB("p"),
              width: "100%",
              padding: 18,
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 1.5,
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              borderRadius: 12,
              background: `linear-gradient(135deg,${G},${GL})`,
              boxShadow: "0 4px 16px rgba(45,106,79,0.3)",
              transition: "all 0.2s"
            }}
            onClick={generate}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(45,106,79,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(45,106,79,0.3)"; }}
          >
            <span style={{ fontSize: 20 }}>⚡</span>
            <span>GENERATE ALL 4 PROMPTS</span>
          </button>
        </>}

        {/* PROMPTS */}
        {vw === "prompts" && <>
          {!prompts ? <div style={{ ...sC, textAlign: "center", padding: 50, color: TXL }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📝</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No prompts generated yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Go to Generate tab to create prompts</div>
          </div> : <>
            {/* Rotation Context - Enhanced */}
            {rot && cx && <div style={{ ...sC, borderLeft: `4px solid ${G}`, background: `linear-gradient(135deg,rgba(45,106,79,0.04),rgba(139,111,71,0.04))`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 20 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: G, letterSpacing: 0.5 }}>Week {cx.wk} — {cx.mn} {cx.yr}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, fontSize: 11.5, color: TL }}>
                <div style={{ padding: "8px 12px", background: "rgba(45,106,79,0.05)", borderRadius: 6 }}>
                  <strong style={{ color: BD, fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Pain Cycle</strong>
                  <span style={{ fontWeight: 600 }}>{rot.ci}/4: {rot.pain.l}</span>
                </div>
                <div style={{ padding: "8px 12px", background: "rgba(139,111,71,0.05)", borderRadius: 6 }}>
                  <strong style={{ color: BD, fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Hook Pattern</strong>
                  <span style={{ fontWeight: 600 }}>Pattern {rot.pat}</span>
                </div>
                <div style={{ padding: "8px 12px", background: "rgba(90,127,160,0.05)", borderRadius: 6 }}>
                  <strong style={{ color: BD, fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Buyer Emotion</strong>
                  <span style={{ fontWeight: 600 }}>{rot.emo.buyer.f} → {rot.emo.buyer.t}</span>
                </div>
                <div style={{ padding: "8px 12px", background: "rgba(166,124,82,0.05)", borderRadius: 6 }}>
                  <strong style={{ color: BD, fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Season</strong>
                  <span style={{ fontWeight: 600 }}>{cx.se} — {rot.se.f.join(", ")}</span>
                </div>
              </div>
            </div>}

            {/* Prompt Cards - Enhanced */}
            {prompts.map((p, i) => <div key={i} style={{
              ...sC,
              borderLeft: `4px solid ${pColors[i]}`,
              padding: 0,
              overflow: "hidden",
              boxShadow: exp === i ? "0 4px 16px rgba(0,0,0,0.1)" : "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all 0.2s",
              marginBottom: exp === i ? 16 : 14
            }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  padding: "16px 18px",
                  background: exp === i ? `linear-gradient(135deg,${pColors[i]}08,${pColors[i]}04)` : "transparent",
                  transition: "background 0.2s"
                }}
                onClick={() => setExp(exp === i ? -1 : i)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: `linear-gradient(135deg,${pColors[i]},${pColors[i]}dd)`,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 900,
                    boxShadow: `0 2px 8px ${pColors[i]}40`
                  }}>{i < 4 ? i + 1 : "✦"}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: BD, letterSpacing: 0.3 }}>{p.t}</div>
                    <div style={{ fontSize: 10, color: TL, marginTop: 2 }}>{exp === i ? "Click to collapse" : "Click to expand"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    style={{
                      ...sB(cpd === i ? "p" : undefined),
                      padding: "9px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: cpd === i ? "0 2px 8px rgba(45,106,79,0.2)" : "none"
                    }}
                    onClick={(e) => { e.stopPropagation(); copy(p.tx, i); }}
                  >
                    {cpd === i ? "✓ Copied" : "📋 Copy"}
                  </button>
                  <div style={{ fontSize: 18, color: TL, transition: "transform 0.2s", transform: exp === i ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
                </div>
              </div>
              {exp === i && <div style={{ borderTop: `2px solid ${BR}`, padding: "16px 20px", background: "#fafafa" }}>
                <div style={{ ...sPre, background: "#fff", border: `1px solid ${BR}`, maxHeight: 480 }}>{p.tx}</div>
              </div>}
            </div>)}

            {/* Action Buttons - Enhanced */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
              <button
                style={{
                  ...sB(),
                  padding: "12px 24px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: `linear-gradient(135deg,rgba(90,127,160,0.08),rgba(166,124,82,0.08))`,
                  border: `1.5px solid ${BR}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  transition: "all 0.2s"
                }}
                onClick={() => { const all = prompts.filter((_, i) => i < 4).map(p => `${"═".repeat(60)}\n${p.t}\n${"═".repeat(60)}\n\n${p.tx}`).join("\n\n\n"); copy(all, "all"); }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0px)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
              >
                {cpd === "all" ? "✓ All Copied" : "📋 Copy All 4 Prompts"}
              </button>
              <button
                style={{
                  ...sB("p"),
                  padding: "12px 28px",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  background: `linear-gradient(135deg,${G},${GL})`,
                  boxShadow: "0 3px 12px rgba(45,106,79,0.25)",
                  transition: "all 0.2s"
                }}
                onClick={() => setVw("log")}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 5px 16px rgba(45,106,79,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0px)"; e.currentTarget.style.boxShadow = "0 3px 12px rgba(45,106,79,0.25)"; }}
              >
                ✎ Done? Log Output →
              </button>
            </div>
          </>}
        </>}

        {/* LOG */}
        {vw === "log" && (() => {
          // Works with or without an active generation (cx)
          const activeWk = cx ? cx.wk : cW;
          const activeYr = cx ? cx.yr : now.getFullYear();
          const activeMn = cx ? cx.mn : MN[cM - 1];
          const currentRec = st.history.find(w => w.wk === activeWk && w.yr === activeYr);
          const existingLogs = getLogs(currentRec);
          const entryNum = existingLogs.length + 1;
          const totalSc = existingLogs.reduce((s, e) => s + countScripts(e.text || ""), 0);

          return <>
            {/* ═══ WEEK ACTIVITY CARD — always visible ═══ */}
            <div style={{ ...sC, borderLeft: `4px solid ${G}`, background: `linear-gradient(135deg,rgba(45,106,79,0.04),rgba(139,111,71,0.03))`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: existingLogs.length > 0 ? 12 : 0, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: G }}>Week {activeWk} — {activeMn} {activeYr}</div>
                  <div style={{ fontSize: 11, color: TL, marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {cx && rot && <span style={{ padding: "2px 8px", borderRadius: 5, background: "rgba(45,106,79,0.12)", color: G, fontWeight: 700, fontSize: 10 }}>Pattern {rot.pat}</span>}
                    <span style={{ color: existingLogs.length > 0 ? G : TXL, fontWeight: existingLogs.length > 0 ? 600 : 400 }}>
                      {existingLogs.length > 0 ? `${existingLogs.length} variation${existingLogs.length > 1 ? "s" : ""} logged ✓` : "No variations logged yet"}
                    </span>
                  </div>
                </div>
                {existingLogs.length > 0 && <div style={{ textAlign: "right", padding: "8px 16px", background: "rgba(45,106,79,0.08)", borderRadius: 10 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: G, lineHeight: 1 }}>{totalSc > 0 ? totalSc : "—"}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: TL, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>scripts logged</div>
                </div>}
              </div>

              {existingLogs.length > 0 && <div style={{ borderTop: `1px dashed ${BR}`, paddingTop: 10 }}>
                {existingLogs.map((entry, i) => {
                  const sc = countScripts(entry.text || "");
                  return <details key={i} style={{ marginBottom: 5 }}>
                    <summary style={{ cursor: "pointer", padding: "8px 12px", background: i % 2 === 0 ? "rgba(45,106,79,0.05)" : "rgba(139,111,71,0.04)", borderRadius: 7, userSelect: "none", display: "flex", alignItems: "center", gap: 8, listStyle: "none" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: G, color: "#fff", fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TX }}>{entry.label || `Variation ${i + 1}`}</span>
                        {entry.ts && <span style={{ fontSize: 10, color: TXL, marginLeft: 8 }}>{new Date(entry.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 5, background: sc >= 20 ? "rgba(45,106,79,0.12)" : sc > 0 ? "rgba(230,162,60,0.12)" : "rgba(139,111,71,0.1)", color: sc >= 20 ? G : sc > 0 ? "#a06000" : BN, flexShrink: 0 }}>
                        {sc >= 20 ? `✓ ${sc} scripts` : sc > 0 ? `${sc}/20` : entry.text ? "logged" : "rotation"}
                      </span>
                    </summary>
                    <div style={{ padding: "8px 12px 4px 44px" }}>
                      {entry.text && <pre style={{ ...sPre, maxHeight: 160, fontSize: 10 }}>{entry.text}</pre>}
                      {entry.perf && <details style={{ marginTop: 4 }}>
                        <summary style={{ cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#5a7fa0", padding: "3px 8px", userSelect: "none" }}>📈 Performance data</summary>
                        <pre style={{ ...sPre, marginTop: 2, maxHeight: 80, fontSize: 10 }}>{entry.perf}</pre>
                      </details>}
                      {!entry.text && <div style={{ fontSize: 10, color: TXL, fontStyle: "italic" }}>Rotation data saved — no log text</div>}
                    </div>
                  </details>;
                })}
                <div style={{ fontSize: 11, color: G, fontWeight: 600, marginTop: 6, padding: "8px 12px", background: "rgba(45,106,79,0.06)", borderRadius: 6 }}>
                  {cx && rot ? `➕ Adding Variation ${entryNum} below` : "Generate prompts to add another variation for this week"}
                </div>
              </div>}
            </div>

            {/* ═══ ADD VARIATION FORM (only when cx is active) ═══ */}
            {cx && rot ? <>
              <div style={{ background: "rgba(90,127,160,0.07)", padding: "10px 14px", borderRadius: 8, marginBottom: 12, borderLeft: "3px solid #5a7fa0" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#5a7fa0", marginBottom: 4 }}>🔁 Rotation Fixed for Week {cx.wk} — Pattern {rot.pat}</div>
                <div style={{ fontSize: 11, color: TL, lineHeight: 1.7 }}>
                  <div>• Hooks · CTAs · angles are <strong>identical across every Claude run this week</strong> — only the outputs differ.</div>
                  <div>• Each variation you save is preserved and informs next week's angle selection automatically.</div>
                </div>
              </div>

              <div style={{ ...sC, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                {existingLogs.length === 0 && <div style={{ background: "rgba(45,106,79,0.05)", padding: "12px 14px", borderRadius: 8, marginBottom: 12, borderLeft: `3px solid ${G}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: G, marginBottom: 5 }}>📋 3 Steps to Log:</div>
                  <div style={{ fontSize: 11, color: TL, lineHeight: 1.8 }}>
                    <div style={{ marginBottom: 2 }}>1️⃣ Copy each of the 4 prompts → paste into Claude Project → run</div>
                    <div style={{ marginBottom: 2 }}>2️⃣ Claude outputs scripts + a <strong>VARIATION LOG</strong> table at the bottom of each batch</div>
                    <div>3️⃣ Copy ALL 4 variation tables → paste below → Save</div>
                  </div>
                </div>}

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: BD, marginBottom: 4 }}>Variation {entryNum} Label <span style={{ fontWeight: 400, color: TXL }}>(optional)</span></div>
                  <input style={{ ...sI, fontSize: 12 }} value={logLabel} onChange={e => setLogLabel(e.target.value)} placeholder={`e.g. "Run 1", "V2 Retake", "Batches 1-2", "Morning session"`} />
                </div>

                {logT.trim() && (() => {
                  const { count: scriptCount, uniqueCount, format: detectedFormat, hasDuplicates } = countScriptsDetailed(logT);
                  const effectiveCount = hasDuplicates ? uniqueCount : scriptCount;
                  const isComplete = effectiveCount >= 20;
                  const isPartial = effectiveCount >= 5 && effectiveCount < 20;
                  const isTiny = effectiveCount > 0 && effectiveCount < 5;
                  const isEmpty = effectiveCount === 0;
                  const hasUnparsedText = logT.trim().length > 50 && isEmpty;
                  const formatLabel = detectedFormat === 'pipe' ? '📋 pipe' : detectedFormat === 'tab' ? '📑 tab' : detectedFormat === 'unstructured' ? '🔄 auto-detected' : detectedFormat === 'lines' ? '📄 line' : '';
                  const bgCol = hasDuplicates ? "rgba(180,64,64,0.1)" : isComplete ? "rgba(45,106,79,0.08)" : (isPartial || isTiny) ? "rgba(180,64,64,0.08)" : hasUnparsedText ? "rgba(180,64,64,0.06)" : "rgba(139,111,71,0.05)";
                  const bdCol = hasDuplicates ? "#b44040" : isComplete ? G : (isPartial || isTiny) ? "#b44040" : hasUnparsedText ? "#b44040" : BR;
                  const ic = hasDuplicates ? "🔴" : isComplete ? "✅" : (isPartial || isTiny) ? "⚠️" : hasUnparsedText ? "🔍" : "📝";
                  const msg = hasDuplicates ? "Duplicate Batches Detected!" : isComplete ? "All 4 Batches Detected ✓" : isPartial ? `Only ${Math.floor(effectiveCount / 5)} Batch${effectiveCount >= 10 ? "es" : ""} Detected!` : isTiny ? `${effectiveCount} Script${effectiveCount > 1 ? "s" : ""} Found — Keep Pasting` : hasUnparsedText ? "Text Found But No Scripts Detected" : "Paste Your Logs Below";
                  const sub = hasDuplicates ? `${scriptCount} found, ${uniqueCount} unique — same log pasted ${Math.round(scriptCount / uniqueCount)}× ${formatLabel}` : (isTiny || isPartial || isComplete) ? `${effectiveCount}/20 scripts ${formatLabel}` : hasUnparsedText ? "Expected: | S1 | Hook | CTA | ... — paste the markdown table" : "";
                  return <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 8, background: bgCol, border: `1.5px solid ${bdCol}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 20 }}>{ic}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: hasDuplicates ? "#b44040" : isComplete ? G : (isPartial || isTiny) ? "#b44040" : hasUnparsedText ? "#b44040" : BD }}>{msg}</div>
                          {sub && <div style={{ fontSize: 10, color: TL, marginTop: 2 }}>{sub}</div>}
                        </div>
                      </div>
                      {hasDuplicates && <div style={{ fontSize: 10, fontWeight: 700, color: "#b44040", maxWidth: 280, textAlign: "right", lineHeight: 1.4 }}>🔴 Copy logs from each prompt separately.</div>}
                      {!hasDuplicates && isPartial && <div style={{ fontSize: 10, fontWeight: 700, color: "#b44040", maxWidth: 280, textAlign: "right", lineHeight: 1.4 }}>⚠️ Need {20 - effectiveCount} more scripts from {Math.ceil((20 - effectiveCount) / 5)} more prompt{Math.ceil((20 - effectiveCount) / 5) > 1 ? "s" : ""}.</div>}
                    </div>
                  </div>;
                })()}

                <div style={{ marginBottom: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: BD, marginBottom: 4 }}>Variation {entryNum} Log Output</div>
                  <textarea
                    style={{ ...sI, minHeight: 160, resize: "vertical", fontSize: 11, fontFamily: "Consolas,Monaco,monospace", lineHeight: 1.6 }}
                    value={logT}
                    onChange={e => setLogT(e.target.value)}
                    placeholder={`Paste variation logs here from ALL 4 batches...\n\nFormats auto-detected:\n✓ | S1 | Hook | CTA | ...\n✓ Tab-separated table\n✓ Direct copy from Claude\n\n20 scripts total (5 per prompt × 4 prompts).`}
                  />
                  {logT.trim() && <button style={{ ...sB(), marginTop: 6, fontSize: 10 }} onClick={() => { if (window.confirm("Clear log text?")) setLogT(""); }}>🗑️ Clear</button>}
                </div>
              </div>

              <div style={sC}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BD, marginBottom: 6 }}>Performance Tracking <span style={{ fontSize: 10, fontWeight: 400, color: TXL }}>(optional)</span></div>
                <div style={{ fontSize: 10, color: TL, marginBottom: 8 }}>Format: Script# | Views(24h) | Saves | Shares | Comments | Best/Worst</div>
                <textarea style={{ ...sI, minHeight: 90, resize: "vertical", fontSize: 11 }} value={perfT} onChange={e => setPerfT(e.target.value)} placeholder="S1 | 12000 | 450 | 120 | 35 | Best&#10;S2 | 8000 | 200 | 80 | 20 |&#10;..." />
              </div>

              <div style={sC}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BD, marginBottom: 6 }}>Freshness Multipliers <span style={{ fontSize: 10, fontWeight: 400, color: TXL }}>(optional)</span></div>
                <div style={{ fontSize: 10, color: TL, marginBottom: 8 }}>Tag angles repeated from a previous week (Strategy 5.3).</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {MULTIPLIERS.map(m => <button key={m.id} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: `1px solid ${BR}`, cursor: "pointer", background: Object.values(mults).includes(m.id) ? "rgba(45,106,79,0.12)" : "#faf8f4", color: Object.values(mults).includes(m.id) ? G : TL }} title={m.desc} onClick={() => { const next = prompt(`Tag "${m.name}" to which batch-script? (e.g. b1-s3, b2-s1)`); if (next?.trim()) setMults(p => ({ ...p, [next.trim().toLowerCase()]: m.id })); }}>{m.name}</button>)}
                </div>
                {Object.keys(mults).length > 0 && <div style={{ fontSize: 10, color: TL }}><strong>Tagged:</strong> {Object.entries(mults).map(([k, v]) => <span key={k} style={{ ...sTag, background: "rgba(45,106,79,0.08)", color: G }}>{k}: {MULTIPLIERS.find(m => m.id === v)?.name}</span>)}</div>}
              </div>

              {(() => {
                const { uniqueCount: uc, hasDuplicates: hd } = countScriptsDetailed(logT);
                const sc = hd ? uc : countScripts(logT);
                const hasAllLogs = sc >= 20;
                const hasPartialLogs = sc >= 5 && sc < 20;
                const hasUnparsedText = logT.trim().length > 0 && sc === 0;
                if (hasPartialLogs) return <div style={{ ...sC, background: "rgba(180,64,64,0.06)", borderLeft: "4px solid #b44040" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#b44040", marginBottom: 4 }}>⚠️ Incomplete — {sc} of 20 scripts</div>
                  <div style={{ fontSize: 11, color: TL }}>Paste logs from all 4 prompts, or clear the text and save rotation-only.</div>
                </div>;
                if (hasUnparsedText) return <div style={{ ...sC, background: "rgba(180,64,64,0.04)", borderLeft: "4px solid #e6a23c" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e6a23c" }}>🔍 Text found but no scripts detected</div>
                  <div style={{ fontSize: 10, color: TL, marginTop: 4 }}>Paste the VARIATION LOG table rows: | S1 | Hook | CTA | ...</div>
                </div>;
                return <div style={{ ...sC, background: "rgba(45,106,79,0.04)", borderLeft: `4px solid ${G}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 18 }}>✅</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: G }}>
                        {existingLogs.length > 0 ? `Ready — Variation ${entryNum} for Week ${cx.wk}` : `Ready to save Week ${cx.wk} — Pattern ${rot?.pat}`}
                      </div>
                      {hasAllLogs && <div style={{ fontSize: 10, color: TL, marginTop: 2 }}>✓ All 20 scripts detected</div>}
                      {!logT.trim() && <div style={{ fontSize: 10, color: TL, marginTop: 2 }}>Saving rotation data only — no log text</div>}
                    </div>
                  </div>
                </div>;
              })()}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {(() => {
                  const { uniqueCount: uc, hasDuplicates: hd } = countScriptsDetailed(logT);
                  const sc = hd ? uc : countScripts(logT);
                  const isBlocked = !cx || (sc > 0 && sc < 20) || hd;
                  return <button
                    style={{ ...sB("p"), flex: 1, textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: 14, fontSize: 14, opacity: isBlocked ? 0.5 : 1 }}
                    onClick={logWeek}
                    disabled={isBlocked}
                  >
                    <span>{hd ? "🔴 Fix duplicates first" : existingLogs.length > 0 ? `➕ Save Variation ${entryNum}` : "✓ Save & Log Week"}</span>
                  </button>;
                })()}
                <button style={{ ...sB(), padding: "14px 20px" }} onClick={() => setVw("prompts")}>← Back</button>
                {existingLogs.length > 0 && <button style={{ ...sB(), padding: "14px 20px", color: G, fontWeight: 700 }} onClick={() => { setLogT(""); setPerfT(""); setMults({}); setLogLabel(""); setRot(null); setCx(null); setPr(null); setVw("home"); }}>✓ Done</button>}
              </div>
            </> : (
              <div style={{ ...sC, textAlign: "center", padding: "32px 20px" }}>
                {existingLogs.length > 0 ? <>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G, marginBottom: 8 }}>Week {activeWk} — {existingLogs.length} variation{existingLogs.length > 1 ? "s" : ""} logged</div>
                  <div style={{ fontSize: 11, color: TL, marginBottom: 16 }}>All variations are preserved above. To add another, generate prompts and run Claude again for this week.</div>
                </> : <>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.35 }}>📊</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: BD, marginBottom: 8 }}>No active generation</div>
                  <div style={{ fontSize: 11, color: TL, marginBottom: 16 }}>Go to Generate → create prompts → run Claude → come back here to log the variation output.</div>
                </>}
                <button style={{ ...sB("p"), padding: "10px 24px", fontSize: 12 }} onClick={() => setVw("generate")}>⚡ Go to Generate</button>
              </div>
            )}
          </>;
        })()}

        {/* HISTORY */}
        {vw === "history" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: BD }}>History — {tH}w / {tH * 20} scripts</div>
            <div style={{ display: "flex", gap: 6 }}><button style={sB()} onClick={exportD}>↓ Export</button><button style={sB()} onClick={() => iR.current?.click()}>↑ Import</button><input ref={iR} type="file" accept=".json" style={{ display: "none" }} onChange={importD} /></div>
          </div>

          <div style={{ ...sC, borderLeft: "4px solid #5a7fa0", background: "rgba(90,127,160,0.03)" }}>
            <div style={{ fontSize: 11.5, color: "#5a7fa0" }}>
              <strong>Storage:</strong> Persistent via artifact storage. ~2-3KB/week. Current: <strong>{(JSON.stringify(st).length / 1024).toFixed(1)}KB</strong>
            </div>
          </div>

          {tH === 0 ? <div style={{ ...sC, textAlign: "center", padding: 40, color: TXL }}>No weeks yet</div> :
            [...st.history].reverse().map((w, ri) => {
              const idx = tH - 1 - ri;
              const wDate = new Date(w.dt || w.ts);
              const daysAgo = Math.floor((new Date() - wDate) / (1000 * 60 * 60 * 24));
              const rs = getRecycleStatus(daysAgo);
              return <div key={idx} style={sC}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    <span style={sBg("g")}>W{w.wk}</span><span style={sBg("b")}>{MN[(w.mo || 1) - 1]} {w.yr}</span><span style={sBg()}>{w.se}</span><span style={sBg("g")}>{w.pat}</span>
                    {rs && <span style={{ ...sBg(), background: `${rs.color}15`, color: rs.color }}>{rs.level} recycle</span>}
                  </div>
                  <button style={sB("d")} onClick={() => { if (!window.confirm(`Delete Week ${w.wk} (${MN[(w.mo || 1) - 1]} ${w.yr})? This cannot be undone.`)) return; setSt(p => ({ ...p, history: p.history.filter((_, j) => j !== idx) })); flash("Removed"); }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: TL, lineHeight: 2 }}>
                  <div>{[...new Set(w.hooks || [])].slice(0, 6).map(id => <span key={id} style={sTag}>{HOOKS.find(h => h.id === id)?.name}</span>)}</div>
                  <div>{(w.pains || []).map(p => <span key={p} style={sTag}>{p}</span>)}</div>
                </div>
                {w.mults && Object.keys(w.mults).length > 0 && <div style={{ marginTop: 4, fontSize: 10, color: TL }}>
                  <strong>Multipliers:</strong> {Object.entries(w.mults).map(([k, v]) => <span key={k} style={{ ...sTag, background: "rgba(45,106,79,0.08)", color: G }}>{k}: {MULTIPLIERS.find(m => m.id === v)?.name || v}</span>)}
                </div>}
                {(() => {
                  const wLogs = getLogs(w);
                  return (wLogs.length > 0 || w.research) && <div style={{ marginTop: 6 }}>
                    {wLogs.length > 0 && <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: G, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        📊 {wLogs.length} Log Entr{wLogs.length > 1 ? "ies" : "y"}
                      </div>
                      {wLogs.map((entry, ei) => {
                        const sc = countScripts(entry.text || "");
                        return <details key={ei} style={{ marginBottom: 4 }}>
                          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, color: G, padding: "5px 8px", background: "rgba(45,106,79,0.06)", borderRadius: 5, userSelect: "none" }}>
                            {entry.label || `Log ${ei + 1}`}
                            {entry.ts && <span style={{ fontWeight: 400, color: TXL, marginLeft: 6 }}>{new Date(entry.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                            {sc > 0 && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "rgba(45,106,79,0.12)", color: G, fontSize: 9 }}>{sc} scripts</span>}
                          </summary>
                          <pre style={{ ...sPre, marginTop: 3, maxHeight: 150, fontSize: 10 }}>{entry.text || "(no log text)"}</pre>
                          {entry.perf && <details style={{ marginTop: 3 }}>
                            <summary style={{ cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#5a7fa0", padding: "3px 8px", userSelect: "none" }}>📈 Performance</summary>
                            <pre style={{ ...sPre, marginTop: 2, maxHeight: 80, fontSize: 10 }}>{entry.perf}</pre>
                          </details>}
                        </details>;
                      })}
                    </div>}
                    {w.research && <details>
                      <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, color: BN, padding: "5px 8px", background: "rgba(139,111,71,0.06)", borderRadius: 5, userSelect: "none" }}>📚 Research</summary>
                      <pre style={{ ...sPre, marginTop: 4, maxHeight: 120, fontSize: 10 }}>{w.research}</pre>
                    </details>}
                  </div>;
                })()}
              </div>;
            })}
        </>}
      </div>

      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.t === "err" ? "#b44040" : G, color: "#fff", padding: "11px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", maxWidth: "90vw" }}>{toast.t === "err" ? "⚠" : "✓"} {toast.m}</div>}
    </div>
  );
}

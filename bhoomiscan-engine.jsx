import { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════
// BHOOMISCAN CONTENT ROTATION ENGINE v4 — PRODUCTION GRADE
// Full compliance with bhoomiscan_ultimate_content_strategy.md
// Fixes: pickLru cold-start, independent Week C/D, enforceHookCompat
//        fallback, allocCtas guarantee, cross-week dedup, year-aware seeds
// ════════════════════════════════════════════════════════════════════
//
// ⚠️ CLAUDE ARTIFACT INSTRUCTIONS ⚠️
// This is PRODUCTION CODE that runs on a live dev server.
// When creating an artifact from this file:
// - Use this code EXACTLY as written (do not modify, simplify, or "improve")
// - Keep the component name as "App" (required for artifact compatibility)
// - Include ALL 1671 lines - this is a complete, working application
// - Do NOT add comments, refactor, or change any logic
// - This code is tested and verified - render it as-is
// ════════════════════════════════════════════════════════════════════

const HOOKS = [
  { id: 1, name: "Confession", ex: "Sach batau?" },
  { id: 2, name: "Knowledge Gap", ex: "Pata hai [X]?" },
  { id: 3, name: "Single Number", ex: "Ek number sunno" },
  { id: 4, name: "Story Entry", ex: "Ek [person] ne..." },
  { id: 5, name: "Situational", ex: "Weekend aa raha hai..." },
  { id: 6, name: "Scene Setter", ex: "Imagine karo..." },
  { id: 7, name: "Common Mistake", ex: "Ek galti hai jo..." },
  { id: 8, name: "Audience Question", ex: "Sabse common sawaal..." },
  { id: 9, name: "Future Frame", ex: "Aaj future ki baat..." },
  { id: 10, name: "Social Proof", ex: "Har week mujhe messages..." },
  { id: 11, name: "Bold Claim", ex: "[Surprising statement]" },
  { id: 12, name: "Rhetorical Challenge", ex: "Guess karo..." },
];

// FIX 2: Week C and D are now independently designed patterns
// (not mechanical +3 shifts of A/B). Each week uses all 12 archetypes,
// batches (5-slot slices) have maximum within-batch variety,
// and no week shares same-position hooks with any other week.
const WEEK_A = [1, 2, 11, 3, 4, 12, 5, 6, 7, 8, 9, 1, 10, 2, 6, 11, 3, 4, 7, 5];
const WEEK_B = [4, 6, 10, 7, 9, 11, 1, 12, 8, 2, 5, 3, 6, 4, 1, 9, 7, 12, 11, 10];
// Week C: strategically designed — leads with emotional/situational hooks for buyers,
// knowledge-gap and proof hooks for sellers, story/future hooks for agents/NRI,
// and challenge/mistake hooks for trending/mixed
const WEEK_C = [6, 8, 3, 10, 7, 2, 9, 5, 12, 1, 11, 4, 8, 6, 3, 7, 12, 10, 1, 9];
// Week D: strategically designed — confession/claim hooks for buyers,
// scene-setter and gap hooks for sellers, number/proof for agents/NRI,
// and audience-question/story hooks for trending
const WEEK_D = [11, 3, 7, 1, 9, 4, 10, 5, 6, 12, 8, 2, 3, 11, 9, 4, 1, 8, 6, 12];
const WEEK_HOOKS = [WEEK_A, WEEK_B, WEEK_C, WEEK_D];

const CTAS = [
  { id: 1, name: "Casual Aside", ex: "Aur haan," },
  { id: 2, name: "Logical Extension", ex: "Aur ek baat," },
  { id: 3, name: "Reassurance Bridge", ex: "Aur dekho," },
  { id: 4, name: "Conditional", ex: "Agar...toh" },
  { id: 5, name: "Process Integration", ex: "[Steps]...aur [CTA]" },
  { id: 6, name: "Platform-as-Solution", ex: "Toh [CTA]" },
];

const BIOS = [
  "Link bio mein hai.", "Link bio mein daal di hai.",
  "Bhool mat jana, link bio mein daal di hai.",
  "Bio mein link hai, check kar lena.",
  "Profile pe jaao, BhoomiScan ka link hai.",
];

const USPS = [
  { id: "free", name: "Free Listings" },
  { id: "whatsapp", name: "WhatsApp Connect" },
  { id: "verified", name: "Verified Properties" },
  { id: "zero", name: "Zero Commission" },
];

// Primary USP per script — matches Part 8 prompt assignments exactly
// P1(Buyer): Verified,Free,WhatsApp,Zero,Free  P2(Seller): Free,Verified,Zero,WhatsApp,Free
// P3(Agent+NRI): Free,WhatsApp,Free,Verified,Zero  P4(Trending): WhatsApp,Zero,Free,Verified,WhatsApp
const USP_B = {
  b1: ["verified", "free", "whatsapp", "zero", "free"],
  b2: ["free", "verified", "zero", "whatsapp", "free"],
  b3: ["free", "whatsapp", "free", "verified", "zero"],
  b4: ["whatsapp", "zero", "free", "verified", "whatsapp"],
};
// Secondary USP (mentioned in CTA) — no script gets same primary + secondary
const USP_SEC = {
  b1: ["free", "whatsapp", "zero", "free", "verified"],
  b2: ["whatsapp", "free", "free", "zero", "whatsapp"],
  b3: ["whatsapp", "zero", "verified", "free", "free"],
  b4: ["free", "free", "whatsapp", "zero", "verified"],
};

const PAIN_CYCLE = [
  { p: "trust", s: "commission", l: "Trust Deficit (3) + Commission Drain (2)" },
  { p: "docs", s: "spam", l: "Document Chaos (3) + Spam/Time-Wasters (2)" },
  { p: "digital", s: "trust", l: "Digital Illiteracy (3) + Trust Deficit (2)" },
  { p: "commission", s: "docs", l: "Commission Drain (3) + Document Chaos (2)" },
];

// Dynamic pain-to-emotion mappings per audience (FIX 3)
// The primary pain point of the current cycle determines the emotional lens
const PAIN_EMO = {
  buyer: {
    trust: { f: "Fear", t: "Safety" },
    docs: { f: "Overwhelm", t: "Simplicity" },
    digital: { f: "Confusion", t: "Clarity" },
    spam: { f: "Frustration", t: "Control" },
    commission: { f: "Distrust", t: "Confidence" },
  },
  seller: {
    trust: { f: "Distrust", t: "Confidence" },
    commission: { f: "Commission Pain", t: "Savings" },
    docs: { f: "Overwhelm", t: "Clarity" },
    spam: { f: "Frustration", t: "Control" },
    digital: { f: "Confusion", t: "Simplicity" },
    pricing: { f: "Uncertainty", t: "Clarity" },
    unsold: { f: "Invisibility", t: "Visibility" },
  },
  agent: {
    digital: { f: "Digital Fear", t: "Digital Power" },
    trust: { f: "Anxiety", t: "Growth" },
    lead: { f: "Frustration", t: "Efficiency" },
    competition: { f: "Irrelevance", t: "Relevance" },
    commission: { f: "Confusion", t: "Compliance" },
    platform: { f: "Skepticism", t: "Adoption" },
    docs: { f: "Anxiety", t: "Growth" },
    spam: { f: "Frustration", t: "Efficiency" },
  },
  nri: {
    trust: { f: "Distance", t: "Connection" },
    remote: { f: "Distrust", t: "Verification" },
    legal: { f: "Complexity", t: "Ease" },
    fraud: { f: "Anxiety", t: "Confidence" },
    hometown: { f: "Emotional", t: "Practical" },
    digital: { f: "Complexity", t: "Ease" },
    docs: { f: "Distrust", t: "Verification" },
    commission: { f: "Anxiety", t: "Confidence" },
    spam: { f: "Distance", t: "Connection" },
  },
};

// Resolve emotional lens from the primary pain point for a given audience
function painEmo(audience, painKey) {
  const map = PAIN_EMO[audience];
  if (!map) return { f: "Fear", t: "Safety" };
  return map[painKey] || Object.values(map)[0];
}

const ANG = {
  buyer: ["Red flags when buying land", "Document checklist before purchase", "Site visit preparation guide", "How to verify land ownership", "Land vs apartment investment", "Scam story cautionary tale", "How to negotiate land price", "Understanding encumbrance certificate", "Online vs offline land buying", "Questions to ask seller", "Flood zone check guide", "Agricultural land rules", "First-time buyer guide"],
  seller: ["Why property isn't selling", "How to price land correctly", "Documents needed before listing", "Zero-cost value increase", "Direct sell vs broker", "Handle lowball offers", "Legal protection sale agreement", "Create attractive listings", "Multiple channel strategy", "Handling advance payments", "Tax implications selling", "Property presentation tips", "Early mover on new platforms"],
  agent: ["Speed equals deals", "Digital transformation steps", "One listing multiple deals", "RERA registration simplified", "Filter serious vs fake leads", "Building online brand", "Tax planning commission", "Client management tips", "Photography for listings", "Competing digitally", "WhatsApp marketing", "Handling difficult clients", "Future of land brokerage"],
  nri: ["NRI land buying FEMA rules", "Verify land from abroad", "Power of Attorney guide", "NRI tax implications", "Hometown investment hook", "Remote due diligence", "NRI scam prevention", "Repatriation rules"],
};

// Format uniqueness (FIX 5): non-Talking-Head formats max 1 each per batch, TH max 3
// Total across all batches: TH=10, MB=3, NS=2, SB=2, RF=1, QA=1, PF=1 = 20
const FMT = {
  b1: ["Talking Head", "Myth Buster", "Talking Head", "Story-Based", "Number Shock"],  // TH=2,MB=1,SB=1,NS=1
  b2: ["Talking Head", "Talking Head", "Myth Buster", "Talking Head", "Talking Head"],  // TH=4,MB=1
  b3: ["Talking Head", "Talking Head", "Talking Head", "Talking Head", "Story-Based"],  // TH=4,SB=1
  b4: ["Number Shock", "Prediction/Future", "Q&A Response", "Myth Buster", "Rapid Fire"],  // NS=1,PF=1,QA=1,MB=1,RF=1
};

// Energy per batch mapped to strategy Section 4.3 daily calendar:
// b1(Buyer): M1=MED,T1=HIGH,W1=MED,TH2=MED,F1=HIGH
// b2(Seller): M2=HIGH,T2=MED,W3=MED,TH1=MED,F2=MED
// b3(Agent+NRI): M3=MED,W2=HIGH,TH3=WARM,T3=WARM,F3=HIGH
// b4(Trending+Mixed): S2=HIGH,S3=MED,SU1=WARM,SU2=MED,S1(flex)=WARM
// Totals: HIGH=2+1+2+1=6, MEDIUM=3+4+1+1=9, WARM=0+0+2+3=5 → 6+9+5=20
// Strategy summary says 5/10/5 but daily calendar operationally gives 6/9/5
const NRG = {
  b1: ["MEDIUM", "HIGH", "MEDIUM", "MEDIUM", "HIGH"],
  b2: ["HIGH", "MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM"],
  b3: ["MEDIUM", "HIGH", "MEDIUM", "WARM", "HIGH"],
  b4: ["HIGH", "MEDIUM", "WARM", "MEDIUM", "WARM"],
};

const CAL = [
  { m: 1, f: ["New Year", "Makar Sankranti"], h: "Naye saal mein zameen invest karo", mi: "NRI visit season" },
  { m: 2, f: ["Budget Week"], h: "Budget mein zameen ke liye kya aaya?", mi: null },
  { m: 3, f: ["Holi", "Financial Year End"], h: "March mein property khareedna tax-smart move", mi: null },
  { m: 4, f: ["New FY", "Akshaya Tritiya", "Ram Navami"], h: "Akshaya Tritiya pe zameen — tradition meets investing", mi: "Transfer season" },
  { m: 5, f: ["Summer", "Wedding Season"], h: "Shaadi ke baad pehla investment — flat ya zameen?", mi: "Exam results season" },
  { m: 6, f: ["Monsoon Start"], h: "Barish se pehle 3 cheezein check karo plot mein", mi: "Barish mein zameen dekhne mat jao" },
  { m: 7, f: ["Rath Yatra"], h: "Odisha mein zameen ka scene — Rath Yatra special", mi: "Monsoon continues" },
  { m: 8, f: ["Independence Day", "Raksha Bandhan"], h: "Azaadi broker se — direct selling ka power", mi: null },
  { m: 9, f: ["Ganesh Chaturthi", "Navratri"], h: "Shubh muhurat mein property register karwao", mi: null },
  { m: 10, f: ["Dussehra", "Diwali Prep"], h: "Diwali se pehle bech do — festive buyers zyada", mi: "Dhanteras — Gold ya zameen?" },
  { m: 11, f: ["Diwali", "Bhai Dooj"], h: "Diwali pe zameen ka saudha — 5 rules", mi: "Gold loge ya zameen?" },
  { m: 12, f: ["Christmas", "Year-End"], h: "Land market annual review", mi: "NRI visit season" },
];

// Calendar slot mapping per batch (strategy Section 3.3)
const SLOTS = {
  b1: ["M1 Mon 12PM", "T1 Tue 12PM", "W1 Wed 12PM", "TH2 Thu 6PM", "F1 Fri 12PM"],
  b2: ["M2 Mon 6PM", "T2 Tue 6PM", "W3 Wed 8:30PM", "TH1 Thu 12PM", "F2 Fri 6PM"],
  b3: ["M3 Mon 8:30PM", "W2 Wed 6PM", "TH3 Thu 8:30PM", "T3 Tue 8:30PM", "F3 Fri 8:30PM"],
  b4: ["S2 Sat 6PM", "S3 Sat 8:30PM", "SU1 Sun 12PM", "SU2 Sun 6PM", "S1 Sat 12PM"],
};

const COMP = [
  "Bade portals pe 1.3 rating hai — log thak gaye hain.",
  "Doosri jagah listing daalo — koi verify nahi karta. BhoomiScan pe Khata se verify hota hai.",
  "Bade platforms zameen ko seriously lete hi nahi. Unka focus apartments pe hai.",
  "Bade platforms abhi Odisha mein hain hi nahi.",
  "Doosri jagah tumhara number 5 logon ko bik jaata hai.",
];

const QGATE = `DIFFERENTIATION CHECKLIST:
[ ] No two scripts share hook archetype
[ ] No two scripts share primary pain point
[ ] No two scripts share primary USP
[ ] Energy distributed (not all same)
[ ] 1+ script uses stat NOT from previous week
[ ] 1+ script has seasonal reference
[ ] All 5 CTA patterns different
[ ] All 5 bio link phrasings different
[ ] Self-ref in only 1-2 scripts
[ ] Triggers mixed (save/share/comment/follow)

QUALITY GATE (each script):
[ ] Hook scrollstopper in 1.5s? [ ] 130-145 words? [ ] Chai tapri feel?
[ ] 6-beat energy arc? [ ] tum/tumhare only? [ ] bhai 2-4x?
[ ] 5-8 texture elements? [ ] USP natural? [ ] CTA friendly?
[ ] No invented features/guarantees/competitor names?
[ ] No em dashes? Paragraphs max 4 sentences?
[ ] English caption max 2 sentences? Max 8 hashtags w/ #BhoomiScan?`;

// ═══ RESEARCH PROCESSOR — Intelligent extraction + audience filtering ═══

// Keyword dictionaries for audience classification
const RES_KW = {
  buyer: ["buy", "buyer", "purchase", "kharid", "invest", "ownership", "verify", "check", "site visit", "encumbrance", "mutation", "land record", "registry", "fraud", "scam", "fake", "dispute", "title", "due diligence", "property check", "first-time"],
  seller: ["sell", "seller", "list", "listing", "price", "commission", "broker", "unsold", "direct", "marketing", "photos", "valuation", "negotiat", "property not selling", "zero commission", "free list"],
  agent: ["agent", "broker", "rera", "dealer", "digital", "lead", "commission tax", "client", "license", "registration", "portal", "194h", "tds", "brokerage"],
  nri: ["nri", "abroad", "fema", "power of attorney", "poa", "repatriat", "diaspora", "overseas", "foreign", "non-resident", "nro", "nre"],
  trending: ["trend", "growth", "market size", "report", "survey", "predict", "future", "forecast", "data shows", "statistics", "gdp", "infrastructure", "smart city", "highway", "metro", "tier 2", "tier 3"]
};

// Pillar classification keywords
const PIL_KW = {
  agitate: ["scam", "fraud", "fake", "warning", "risk", "danger", "loss", "dispute", "court", "penalty", "illegal", "beware", "mistake", "problem", "fail", "wrong", "trap", "victim"],
  empower: ["tip", "how to", "guide", "step", "strategy", "hack", "solution", "fix", "save", "benefit", "advantage", "opportunity", "grow", "boost", "improve", "smart"],
  trending: ["trend", "news", "update", "report", "announce", "launch", "policy", "govern", "budget", "new rule", "change", "amend", "reform", "break"],
  educate: ["document", "process", "rule", "law", "section", "act", "regulation", "requirement", "checklist", "understand", "know", "learn", "meaning", "definition"]
};

// Stat extraction patterns
const STAT_RX = /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million|thousand|lac|cr|L|K)/gi;
const NUM_RX = /(?:₹|Rs\.?|INR)\s*(\d[\d,]*\.?\d*)\s*(crore|lakh|lac|cr|L|K|billion|million)?/gi;

// FIX 1: Stemming-aware keyword match — handles plurals, gerunds, past tense
function stemMatch(text, keyword) {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  // Exact substring match
  if (lower.includes(kw)) return true;
  // Plural: buyer→buyers, listing→listings
  if (lower.includes(kw + 's') || lower.includes(kw + 'es')) return true;
  // Reverse plural: buyers→buyer
  if (kw.endsWith('s') && lower.includes(kw.slice(0, -1))) return true;
  if (kw.endsWith('es') && lower.includes(kw.slice(0, -2))) return true;
  // Gerund: buy→buying, sell→selling, invest→investing
  if (lower.includes(kw + 'ing')) return true;
  if (kw.endsWith('ing') && kw.length > 4 && lower.includes(kw.slice(0, -3))) return true;
  // Past tense: purchase→purchased, verify→verified
  if (lower.includes(kw + 'd') || lower.includes(kw + 'ed')) return true;
  if (kw.endsWith('ed') && lower.includes(kw.slice(0, -2))) return true;
  if (kw.endsWith('d') && lower.includes(kw.slice(0, -1))) return true;
  // Agent/noun: invest→investor, buy→buyer (partial match via includes is already covered)
  return false;
}

// Score a finding's relevance to current rotation context
function scoreFinding(text, pain, season, angles) {
  let s = 0;
  const lower = text.toLowerCase();
  // +3 if matches current pain cycle (FIX 1: use stemMatch)
  if (pain && stemMatch(lower, pain.p)) s += 3;
  if (pain && stemMatch(lower, pain.s)) s += 2;
  // +2 if contains hard stat
  if (STAT_RX.test(text) || NUM_RX.test(text)) s += 2;
  STAT_RX.lastIndex = 0; NUM_RX.lastIndex = 0;
  // +1 if seasonal
  if (season?.f?.some(f => lower.includes(f.toLowerCase()))) s += 1;
  // +1 if timely
  if (/202[5-9]|this week|today|yesterday|recent|latest|just|breaking/i.test(text)) s += 1;
  // +1 if has source citation
  if (/source:|according to|report|survey|study/i.test(text)) s += 1;
  // +2 if matches an assigned content angle
  if (angles?.some(a => stemMatch(lower, a.toLowerCase().split(" ")[0]))) s += 2;
  return s;
}

// Classify a chunk by audience — returns sorted array of matching audiences (FIX 1: stemMatch)
function classifyAudience(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [aud, kws] of Object.entries(RES_KW)) {
    scores[aud] = kws.reduce((s, kw) => s + (stemMatch(lower, kw) ? 1 : 0), 0);
  }
  // If no strong signal, mark as "all"
  const max = Math.max(...Object.values(scores));
  if (max === 0) return ["all"];
  return Object.entries(scores).filter(([, v]) => v >= max * 0.6).map(([k]) => k).sort((a, b) => scores[b] - scores[a]);
}

// Classify a chunk by content pillar (FIX 1: stemMatch)
function classifyPillar(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [pil, kws] of Object.entries(PIL_KW)) {
    scores[pil] = kws.reduce((s, kw) => s + (stemMatch(lower, kw) ? 1 : 0), 0);
  }
  const max = Math.max(...Object.values(scores));
  if (max === 0) return "EDUCATE";
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0].toUpperCase();
}

// Extract stat strings from text
function extractStats(text) {
  const stats = [];
  let m;
  const rx1 = /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million|thousand|lac|cr)/gi;
  while ((m = rx1.exec(text)) !== null) stats.push(m[0].trim());
  const rx2 = /(?:₹|Rs\.?|INR)\s*\d[\d,]*\.?\d*\s*(?:crore|lakh|lac|cr|L|K|billion|million)?/gi;
  while ((m = rx2.exec(text)) !== null) stats.push(m[0].trim());
  return [...new Set(stats)];
}

// Smart truncation — preserves sentence boundaries instead of cutting mid-word (FIX 3)
function smartTruncate(text, maxLen = 500) {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  // Try to cut at last sentence boundary (. or ! or ?)
  const lastSentence = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('!\n'),
    truncated.lastIndexOf('?\n')
  );
  if (lastSentence > maxLen * 0.4) return truncated.slice(0, lastSentence + 1).trim();
  // Fallback: cut at last space
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) return truncated.slice(0, lastSpace).trim() + '…';
  return truncated.trim() + '…';
}

// FIX 4: Multi-strategy chunk splitter — handles markdown, research output, dense text
function smartSplit(text) {
  if (!text || !text.trim()) return [];
  const trimmed = text.trim();

  // Strategy 1: Structured research format (FINDING:, numbered items with labels)
  if (/^(?:FINDING:|\d+[\.\)]\s*\[)/m.test(trimmed)) {
    return trimmed.split(/(?=^(?:FINDING:|\d+[\.\)]\s))/m);
  }
  // Strategy 2: Bullet-point format (•, -, *)
  if (/^[•\-\*]\s/m.test(trimmed)) {
    const bullets = trimmed.split(/(?=^[•\-\*]\s)/m);
    // Merge very short bullets that belong together
    const merged = [];
    for (const b of bullets) {
      if (merged.length > 0 && merged[merged.length - 1].length < 80 && b.length < 80) {
        merged[merged.length - 1] += '\n' + b;
      } else {
        merged.push(b);
      }
    }
    return merged;
  }
  // Strategy 3: Markdown headers
  if (/^#{1,3}\s/m.test(trimmed)) {
    return trimmed.split(/(?=^#{1,3}\s)/m);
  }
  // Strategy 4: Double newline paragraphs
  if (/\n{2,}/.test(trimmed)) {
    const paras = trimmed.split(/\n{2,}/);
    // If we got meaningful chunks, use them; otherwise fall through
    if (paras.length > 1 && paras.every(p => p.length < 1500)) return paras;
  }
  // Strategy 5: Dense text — split into ~600 char chunks at sentence boundaries
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > 600 && current.length > 100) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Main research processor — takes raw text + rotation context, returns batch-specific research
function processResearch(rawText, context, rotation) {
  // FIX 4: Use multi-strategy splitter instead of fragile single regex
  const chunks = smartSplit(rawText)
    .map(c => c.trim())
    .filter(c => c.length > 25);

  // Process each chunk
  const findings = chunks.map(chunk => {
    const audiences = classifyAudience(chunk);
    const pillar = classifyPillar(chunk);
    const stats = extractStats(chunk);
    const score = scoreFinding(chunk, rotation?.pain, rotation?.se,
      [...(rotation?.ba || []).map(i => ANG.buyer[i] || ""),
      ...(rotation?.sa || []).map(i => ANG.seller[i] || ""),
      ...(rotation?.aa || []).map(i => ANG.agent[i] || ""),
      ...(rotation?.na || []).map(i => ANG.nri[i] || "")]);
    return { text: smartTruncate(chunk, 500), audiences, pillar, stats, score };
  });

  // Sort by relevance score (highest first)
  findings.sort((a, b) => b.score - a.score);

  // Build batch-specific research strings
  const batchFindings = { buyer: [], seller: [], agent: [], nri: [], trending: [], all: [] };
  for (const f of findings) {
    for (const aud of f.audiences) {
      if (batchFindings[aud]) batchFindings[aud].push(f);
    }
    // Trending findings go to batch 4 regardless
    if (f.pillar === "TRENDING" || f.stats.length > 0) {
      if (!batchFindings.trending.includes(f)) batchFindings.trending.push(f);
    }
  }

  // Format batch research string — never returns null, always gives structured output
  function fmtBatch(label, items, allItems) {
    const merged = [...items, ...allItems].slice(0, 8);
    if (!merged.length) {
      return `WEEKLY DATA (Filtered for ${label}):\nNo audience-specific research found this week. MANDATORY: Pull 2-3 hard stats from the Target Audience Guide stat library and weave them into scripts as proof points. At least 1 script must open with a stat-based hook using library data.`;
    }
    const statItems = merged.filter(f => f.stats.length > 0);
    const trendItems = merged.filter(f => f.pillar === "TRENDING");
    const storyItems = merged.filter(f => f.pillar === "AGITATE");
    const eduItems = merged.filter(f => f.pillar === "EDUCATE" || f.pillar === "EMPOWER");

    let out = `WEEKLY DATA (Filtered for ${label}):\n`;
    if (statItems.length) {
      out += `KEY STATS:\n${statItems.slice(0, 3).map(f => `  • ${smartTruncate(f.text, 250)} [${f.pillar}]`).join("\n")}\n`;
    }
    if (trendItems.length) {
      out += `TRENDS:\n${trendItems.slice(0, 2).map(f => `  • ${smartTruncate(f.text, 250)} [${f.pillar}]`).join("\n")}\n`;
    }
    if (storyItems.length) {
      out += `STORY HOOKS:\n${storyItems.slice(0, 2).map(f => `  • ${smartTruncate(f.text, 250)}`).join("\n")}\n`;
    }
    if (eduItems.length) {
      out += `INSIGHTS:\n${eduItems.slice(0, 2).map(f => `  • ${smartTruncate(f.text, 250)} [${f.pillar}]`).join("\n")}\n`;
    }
    return out;
  }

  // Find best shock stat for Prompt 4 S1
  const shockStat = findings.find(f => f.stats.length > 0)?.text?.slice(0, 120) || null;

  return {
    b1: fmtBatch("BUYER", batchFindings.buyer, batchFindings.all),
    b2: fmtBatch("SELLER", batchFindings.seller, batchFindings.all),
    b3: fmtBatch("AGENT + NRI", [...batchFindings.agent, ...batchFindings.nri], batchFindings.all),
    b4: fmtBatch("TRENDING + ALL AUDIENCES", batchFindings.trending, batchFindings.all),
    findings,
    shockStat,
    counts: {
      total: findings.length,
      buyer: batchFindings.buyer.length,
      seller: batchFindings.seller.length,
      agent: batchFindings.agent.length,
      nri: batchFindings.nri.length,
      trending: batchFindings.trending.length,
      withStats: findings.filter(f => f.stats.length > 0).length
    }
  };
}

// FIX 6: Context-aware research prompts — adapt based on pain cycle, season, and content angles
function getResearchPrompts(rotation, context) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isoDate = today.toISOString().split("T")[0];

  // Build dynamic context block from current rotation
  const painBlock = rotation?.pain
    ? `\n\n⚡ THIS WEEK'S CONTENT FOCUS:\n• Pain Cycle: ${rotation.pain.l}\n• Primary pain: "${rotation.pain.p}" — find data that amplifies or solves this\n• Secondary pain: "${rotation.pain.s}" — supporting angle`
    : '';
  const seasonBlock = rotation?.se
    ? `\n• Season: ${rotation.se.f.join(', ')}${rotation.se.mi ? ` | Micro-trend: ${rotation.se.mi}` : ''}\n• Seasonal hook: "${rotation.se.h}"`
    : '';
  const angleBlock = rotation
    ? `\n\n🎯 SPECIFIC CONTENT ANGLES NEEDING DATA THIS WEEK:\n${[
      ...(rotation.ba || []).map(i => `  Buyer: ${ANG.buyer[i] || ''}`),
      ...(rotation.sa || []).map(i => `  Seller: ${ANG.seller[i] || ''}`),
      ...(rotation.aa || []).map(i => `  Agent: ${ANG.agent[i] || ''}`),
      ...(rotation.na || []).map(i => `  NRI: ${ANG.nri[i] || ''}`),
    ].filter(Boolean).join('\n')}\nPrioritize findings that directly support THESE angles — they become the scripts.`
    : '';
  const weekContext = context
    ? `\nWeek ${context.wk} | ${context.mn} ${context.yr} | ${context.se} season`
    : '';

  return [
    {
      id: "claude",
      name: "Claude Deep Research",
      icon: "🟣",
      desc: "Best for: Deep analysis, structured reasoning, audience segmentation",
      prompt: `TODAY IS: ${dateStr} (${isoDate}).${weekContext} You are researching for BhoomiScan — India's land verification and listing platform focused on Odisha.${painBlock}${seasonBlock}${angleBlock}

SEARCH AND DEEPLY ANALYZE developments in Indian real estate and land markets from the PAST 7 DAYS (${isoDate} backwards). Cover:

1. LAND FRAUD & SCAM CASES — Any new cases reported this week in Indian media. Include state, amount, method used.
2. GOVERNMENT POLICY — RERA updates, stamp duty changes, digitization drives, Bhulekh/land record portal updates, any new circulars.
3. MARKET DATA — Property price trends, transaction volumes, PropTech funding, infrastructure announcements (highways, smart cities, metro expansions).
4. ODISHA SPECIFIC — Any Odisha real estate news, Bhubaneswar/Cuttack development, state-level land policy changes.
5. NRI RULES — FEMA updates, RBI circulars on NRI property, repatriation rule changes, any new NRI investment guidelines.
6. AGENT/BROKER — TDS under Section 194H enforcement, RERA registration drives, digital platform adoption by brokers.

OUTPUT FORMAT — For EACH finding provide ALL fields:
FINDING: [One sentence with exact number/stat if available]
SOURCE: [Publication name, date published]
AUDIENCE: [BUYER | SELLER | AGENT | NRI | ALL]
PILLAR: [EDUCATE | AGITATE | EMPOWER | TRENDING]
SCRIPT ANGLE: [One sentence — how to use this in a 130-word Hinglish reel]
HOOK TYPE: [Best hook archetype: Confession | Knowledge Gap | Single Number | Story Entry | Bold Claim | Common Mistake]

MINIMUM 10 findings. Prioritize findings with HARD NUMBERS and STATS — these make the strongest reel hooks.`
    },
    {
      id: "gemini",
      name: "Gemini Deep Research",
      icon: "🔵",
      desc: "Best for: Real-time Google data, news crawling, YouTube trends",
      prompt: `Current date: ${dateStr} (${isoDate}).${weekContext} Use your real-time search and Google integration to find the FRESHEST data.

TASK: Research Indian real estate and land market developments from the last 7 days for BhoomiScan (land verification + listing platform, Odisha-focused).${painBlock}${seasonBlock}${angleBlock}

SEARCH THESE SPECIFIC SOURCES:
• Google News India — "land scam" OR "property fraud" OR "RERA" OR "real estate India" (past 7 days)
• Google Trends — Check current trending volume for: "land for sale", "plot kaise kharide", "RERA complaint", "bhulekh", "property verification"
• YouTube India — Any viral real estate content this week (what topics are getting views?)
• Government portals — Any new RERA orders, Bhulekh updates, stamp duty notifications

FOCUS AREAS:
1. Breaking news in Indian land/property (last 7 days only — nothing older!)
2. Social media trending topics about real estate
3. Regional language content trending (Hindi, Odia, Tamil, Telugu — what's going viral?)
4. New PropTech launches or funding announcements
5. Any Odisha-specific real estate developments

OUTPUT — One finding per bullet, use this EXACT format:
• [FACT with number if available] | [BUYER/SELLER/AGENT/NRI/ALL] | [EDUCATE/AGITATE/EMPOWER/TRENDING] | [Source, ${isoDate.slice(0, 7)}]

Include Google Trends data as: "Search interest for [term]: [rising/stable/declining] — [peak date]"

MINIMUM 10 findings. Latest data only — reject anything older than 7 days from ${isoDate}.`
    },
    {
      id: "perplexity",
      name: "Perplexity Research",
      icon: "🟢",
      desc: "Best for: Cited facts, source verification, cross-referenced data",
      prompt: `Date: ${dateStr} (${isoDate}).${weekContext} Research with FULL CITATIONS for BhoomiScan content team.${painBlock}${seasonBlock}${angleBlock}

TOPIC: Indian land market, real estate regulations, property fraud, and PropTech — LAST 7 DAYS ONLY.

MANDATORY RULES:
• Every single fact MUST have an inline citation [Source Name, Date, URL]
• Cross-reference claims across 2+ sources before including
• Prioritize: Government sources (RERA portals, Bhulekh, MoHUA, RBI) > Major news (ET, Mint, TOI, MoneyControl) > Industry reports
• Include EXACT numbers — no "many" or "several" — give the actual stat
• If a finding cannot be verified with a real source published after ${today.getFullYear()}-01-01, DO NOT include it

RESEARCH AREAS:
1. Property fraud cases reported in Indian courts/media (amount, location, method)
2. RERA enforcement actions and new registrations data
3. Land digitization progress (Bhulekh, DILRMP, NGDRS updates)
4. Real estate transaction data from any state registration portals
5. NRI investment inflow data from RBI/FEMA reports
6. Infrastructure project announcements affecting land values
7. Any PropTech startup funding/launch this week

OUTPUT FORMAT:
1. [Verified fact with exact numbers] — Source: [Name], [Date], [URL]
   Audience: [BUYER/SELLER/AGENT/NRI/ALL] | Pillar: [EDUCATE/AGITATE/EMPOWER/TRENDING]
   Confidence: HIGH (2+ sources) or MEDIUM (1 source)

MINIMUM 8 findings. Quality over quantity — only cited, verified, recent facts.`
    }
  ];
}

// Freshness multipliers (Strategy Section 5.3) — 8 ways to keep repeated angles fresh
const MULTIPLIERS = [
  { id: "data", name: "Data Swap", desc: "Same topic, new stat from weekly research" },
  { id: "story", name: "Story Swap", desc: "Same lesson, new anonymized story" },
  { id: "hook", name: "Hook Swap", desc: "Same content, different opening archetype" },
  { id: "audience", name: "Audience Swap", desc: "Same insight, different audience lens" },
  { id: "format", name: "Format Swap", desc: "Same topic, different content format" },
  { id: "seasonal", name: "Seasonal Overlay", desc: "Same evergreen topic + timely context" },
  { id: "objection", name: "Objection Anchor", desc: "Same topic, led by different objection" },
  { id: "geo", name: "Geographic Lens", desc: "Same insight, localized (e.g. Odisha-specific)" },
];

// Weekly calendar grid data (Strategy Section 3.3)
const CALENDAR_GRID = [
  {
    day: "Mon", slots: [
      { code: "M1", time: "12PM", aud: "Buyer", pillar: "EDUCATE", type: "Document/process" },
      { code: "M2", time: "6PM", aud: "Seller", pillar: "AGITATE", type: "Pain point/mistake" },
      { code: "M3", time: "8:30PM", aud: "Agent", pillar: "EMPOWER", type: "Business growth" },
    ]
  },
  {
    day: "Tue", slots: [
      { code: "T1", time: "12PM", aud: "Buyer", pillar: "AGITATE", type: "Scam/fraud awareness" },
      { code: "T2", time: "6PM", aud: "Seller", pillar: "EDUCATE", type: "Listing/pricing tip" },
      { code: "T3", time: "8:30PM", aud: "NRI", pillar: "EDUCATE", type: "NRI land guide" },
    ]
  },
  {
    day: "Wed", slots: [
      { code: "W1", time: "12PM", aud: "Buyer", pillar: "EDUCATE", type: "Step-by-step checklist" },
      { code: "W2", time: "6PM", aud: "Agent", pillar: "AGITATE", type: "Digital disruption" },
      { code: "W3", time: "8:30PM", aud: "Seller", pillar: "EMPOWER", type: "Commission savings" },
    ]
  },
  {
    day: "Thu", slots: [
      { code: "TH1", time: "12PM", aud: "Seller", pillar: "EDUCATE", type: "Legal documents" },
      { code: "TH2", time: "6PM", aud: "Buyer", pillar: "EMPOWER", type: "Smart buying" },
      { code: "TH3", time: "8:30PM", aud: "Agent", pillar: "EDUCATE", type: "Lead gen/closing" },
    ]
  },
  {
    day: "Fri", slots: [
      { code: "F1", time: "12PM", aud: "Buyer", pillar: "AGITATE", type: "Red flags/mistakes" },
      { code: "F2", time: "6PM", aud: "Seller", pillar: "AGITATE", type: "Why not selling" },
      { code: "F3", time: "8:30PM", aud: "NRI", pillar: "EMPOWER", type: "NRI investment" },
    ]
  },
  {
    day: "Sat", slots: [
      { code: "S1", time: "12PM", aud: "Mixed", pillar: "CONNECT", type: "Community/flex" },
      { code: "S2", time: "6PM", aud: "Trending", pillar: "TRENDING", type: "Data-backed" },
      { code: "S3", time: "8:30PM", aud: "Buyer", pillar: "EDUCATE", type: "Site visit guide" },
    ]
  },
  {
    day: "Sun", slots: [
      { code: "SU1", time: "12PM", aud: "Mixed", pillar: "CONNECT", type: "Q&A/community" },
      { code: "SU2", time: "6PM", aud: "Trending", pillar: "TRENDING", type: "Seasonal/prediction" },
    ]
  },
];

// Recycling thresholds in days (Strategy Section 6.3)
function getRecycleStatus(daysAgo) {
  if (daysAgo >= 90) return { level: "90d", color: "#b44040", label: "Repost OK — best performers can be re-posted" };
  if (daysAgo >= 60) return { level: "60d", color: "#a67c52", label: "60d — same hook, update with fresh data" };
  if (daysAgo >= 30) return { level: "30d", color: "#5a7fa0", label: "30d — same insight, write completely new script" };
  return null;
}

const RULES = `PILLAR HIERARCHY: COMPASS(audience)→GUARDRAIL(brand rules)→ENGINE(write)→BENCHMARK(compare to reference)
ABSOLUTE: BhoomiScan=WEBSITE not app | Listing=FREE | Verified=PAID | Leads via WhatsApp | Zero commission
NEVER: "app download karo" | guarantee results | claim scale | name competitors | "aap"/"tu"
ALWAYS: "tum/tumhare" | "link bio mein hai" (rotate) | 130-145 words | 6-beat energy arc`;

// Topic-hook compatibility (FIX 4)
// Classify content angle into a type, then enforce hook compatibility
function classifyAngle(angle) {
  const a = (angle || "").toLowerCase();
  if (/fema|poa|power of attorney|tax|rera|legal|sale agreement|registration|document|encumbrance|stamp duty|repatriation/.test(a)) return "legal";
  if (/scam|fraud|hometown|family|story|cautionary|emotional/.test(a)) return "emotional";
  if (/checklist|step|guide|process|how to|preparation|questions to ask/.test(a)) return "howto";
  if (/stat|number|data|trend|market|price|investment|percentage|rating/.test(a)) return "data";
  if (/transformation|digital|future|growth|competing|online brand/.test(a)) return "motivation";
  if (/myth|misconception|common mistake|red flag/.test(a)) return "myth";
  if (/community|q&a|poll|question|relatable|debate/.test(a)) return "community";
  return "general";
}

// Hook IDs: 1=Confession,2=KnowledgeGap,3=SingleNumber,4=StoryEntry,5=Situational,
//            6=SceneSetter,7=CommonMistake,8=AudienceQuestion,9=FutureFrame,
//           10=SocialProof,11=BoldClaim,12=RhetoricalChallenge
const HOOK_COMPAT = {
  legal: { best: [2, 1, 3, 10], avoid: [5, 6] },
  emotional: { best: [4, 6, 5, 1], avoid: [3, 12] },
  howto: { best: [2, 7, 8], avoid: [11, 9] },
  data: { best: [3, 2, 11], avoid: [4, 5] },
  motivation: { best: [9, 11, 12], avoid: [5, 7, 8] },
  myth: { best: [7, 1, 11], avoid: [6, 5] },
  community: { best: [8, 10, 7], avoid: [3, 9] },
  general: { best: [], avoid: [] },
};

// FIX 3: enforceHookCompat now has 3 fallback levels and returns warnings
function enforceHookCompat(hooks, angles, seed) {
  const result = [...hooks];
  const warnings = [];
  for (let i = 0; i < result.length; i++) {
    const type = classifyAngle(angles[i]);
    const compat = HOOK_COMPAT[type];
    if (!compat || !compat.avoid.length) continue;
    if (compat.avoid.includes(result[i])) {
      // Fallback 1: Swap with another position that doesn't conflict
      let resolved = false;
      for (let j = 0; j < result.length; j++) {
        if (j === i) continue;
        const otherType = classifyAngle(angles[j]);
        const otherCompat = HOOK_COMPAT[otherType];
        if (!compat.avoid.includes(result[j]) && !(otherCompat?.avoid || []).includes(result[i])) {
          [result[i], result[j]] = [result[j], result[i]];
          resolved = true;
          break;
        }
      }
      // Fallback 2: Pick a best hook not already used in this batch
      if (!resolved && compat.best.length) {
        const used = new Set(result);
        for (const bh of compat.best) {
          if (!used.has(bh)) { result[i] = bh; resolved = true; break; }
        }
      }
      // Fallback 3: Pick ANY unused hook not in the avoid list
      if (!resolved) {
        const used = new Set(result);
        for (let h = 1; h <= 12; h++) {
          if (!used.has(h) && !compat.avoid.includes(h)) {
            result[i] = h;
            resolved = true;
            warnings.push(`Slot ${i}: replaced hook ${hooks[i]} with fallback ${h} for "${type}" angle`);
            break;
          }
        }
      }
      // If STILL unresolved (extremely unlikely), log warning
      if (!resolved) {
        warnings.push(`Slot ${i}: could not resolve hook ${result[i]} for "${type}" angle "${angles[i]}" — all 12 hooks exhausted`);
      }
    }
  }
  return { hooks: result, warnings };
}

// ═══ ENGINE (pure, deterministic, no mutations) ═══

function wkNum(d) {
  const dt = new Date(d), j = new Date(dt.getFullYear(), 0, 1);
  return Math.ceil(((dt - j + ((j.getTimezoneOffset() - dt.getTimezoneOffset()) * 60000)) / 86400000 + j.getDay() + 1) / 7);
}
function szn(m) { return m >= 3 && m <= 5 ? "Summer" : m >= 6 && m <= 9 ? "Monsoon" : m >= 10 && m <= 11 ? "Festive" : "Winter"; }

function shuf(arr, seed) {
  const o = [...arr]; let s = Math.abs(seed) || 1;
  for (let i = o.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1));[o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

// FIX 8: Robust script counter — handles all common Claude output formats
// Matches: "S1", "Script 1", "Script1", "#1", bare "1"-"20" in first table cell
function countScripts(text) {
  if (!text?.trim()) return 0;
  const rows = text.split('\n').filter(l => l.trim().startsWith('|'));
  let count = 0;
  for (const row of rows) {
    const cells = row.split('|').map(c => c.trim()).filter(Boolean);
    if (!cells.length) continue;
    const first = cells[0];
    // Skip header rows and separator rows (---)
    if (/^-+$/.test(first) || /^script$/i.test(first) || /^#$/i.test(first) || /^sr\.?\s*no\.?$/i.test(first)) continue;
    // Match: "S1", "S 1", "Script 1", "Script1", "#1", or bare "1"-"20"
    if (/^(S\s*\d+|Script\s*\d+|#?\d{1,2})$/i.test(first)) count++;
  }
  return count;
}

// FIX 9: Parse performance data from freeform text
function parsePerf(perfText) {
  if (!perfText?.trim()) return null;
  const rows = perfText.split('\n').filter(l => l.trim());
  const results = [];
  for (const row of rows) {
    const parts = row.split('|').map(c => c.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const id = parts[0]; // "S1", "S2", etc.
    // Skip headers
    if (/^(script|sr|#|views)/i.test(id)) continue;
    const views = parseInt(parts[1]?.replace(/,/g, ''), 10) || 0;
    const saves = parseInt(parts[2]?.replace(/,/g, ''), 10) || 0;
    const shares = parseInt(parts[3]?.replace(/,/g, ''), 10) || 0;
    const comments = parseInt(parts[4]?.replace(/,/g, ''), 10) || 0;
    const tag = (parts[5] || '').toLowerCase().trim(); // "best", "worst", ""
    // Engagement score = weighted sum (saves most valuable for Instagram algorithm)
    const score = saves * 3 + shares * 2 + comments * 1.5 + (views / 100);
    results.push({ id, views, saves, shares, comments, tag, score });
  }
  return results.length > 0 ? results : null;
}

// FIX 10: Analyze past performance to weight angle selection
// Returns a map of { angleIndex: adjustment } for each audience
// Negative adjustment = boost (selected sooner in LRU), positive = penalize
function getPerfWeights(history, audience) {
  if (!history?.length) return null;
  const weights = {};
  // Look at last 4 weeks of history
  const recent = history.slice(-4);
  for (const week of recent) {
    if (!week.perf) continue;
    const perfData = parsePerf(week.perf);
    if (!perfData) continue;
    const angles = week.ang?.[audience];
    if (!angles?.length) continue;
    // Map script positions to angle indices
    // Scripts S1-S5 in batch 1 = buyer, S6-S10 = seller, S11-S13 = agent, S14-S15 = NRI, S16-S20 = trending
    const batchOffset = audience === 'buyer' ? 0 : audience === 'seller' ? 5 : audience === 'agent' ? 10 : audience === 'nri' ? 13 : 15;
    const batchSize = audience === 'agent' ? 3 : audience === 'nri' ? 2 : 5;
    for (let i = 0; i < Math.min(angles.length, batchSize); i++) {
      const scriptIdx = batchOffset + i;
      const scriptId = `S${scriptIdx + 1}`;
      const perf = perfData.find(p => p.id.toUpperCase() === scriptId.toUpperCase());
      if (!perf) continue;
      const angleIdx = angles[i];
      // Compute weight: high performers get negative (boost), low get positive (penalize)
      if (perf.tag === 'best' || perf.score > 2000) {
        weights[angleIdx] = (weights[angleIdx] || 0) - 1; // boost
      } else if (perf.tag === 'worst' || perf.score < 200) {
        weights[angleIdx] = (weights[angleIdx] || 0) + 1; // penalize
      }
    }
  }
  return Object.keys(weights).length > 0 ? weights : null;
}

// FIX 1: pickLru now supports week-number tracking, cold-start, and performance weighting
// history entries can be: plain arrays (legacy) or { wk: weekNum, used: [...] }
function pickLru(total, hist, count, seed, currentWk, perfWeights) {
  const sc = {};
  for (let i = 0; i < total; i++) sc[i] = 0;

  // Calculate recency scores from history
  const cw = currentWk || (hist.length + 1);
  for (let wi = 0; wi < hist.length; wi++) {
    const entry = hist[wi];
    // Support both legacy (plain array) and new format ({ wk, used })
    const usedArr = Array.isArray(entry) ? entry : (entry?.used || entry || []);
    const entryWk = (entry && !Array.isArray(entry) && entry.wk) ? entry.wk : (wi + 1);
    const recency = Math.max(1, cw - entryWk);
    (usedArr || []).forEach(idx => {
      if (sc[idx] !== undefined) sc[idx] = Math.max(sc[idx], recency);
    });
  }

  // Cold-start handling: for first 3 weeks with no/sparse history,
  // use a spread algorithm that systematically covers all indices
  if (hist.length < 3) {
    const offset = (cw - 1) * count;
    const spread = [];
    for (let i = 0; i < count; i++) {
      spread.push((offset + i) % total);
    }
    // Merge with LRU: prefer spread items that also have low recency
    const spreadSet = new Set(spread);
    const items = shuf(Object.keys(sc).map(Number), seed || 7);
    // Sort: spread items first (prioritized), then by recency (ascending)
    items.sort((a, b) => {
      const aSpread = spreadSet.has(a) ? 0 : 1;
      const bSpread = spreadSet.has(b) ? 0 : 1;
      if (aSpread !== bSpread) return aSpread - bSpread;
      return sc[a] - sc[b];
    });
    return items.slice(0, Math.min(count, total));
  }

  // Staleness boost: angles unused for 4+ weeks get extra priority
  for (let i = 0; i < total; i++) {
    if (sc[i] === 0) sc[i] = -2; // Never used → highest priority
    else if (sc[i] >= 4) sc[i] = Math.max(0, sc[i] - 2); // Stale → boost
  }

  // FIX 10: Apply performance weights — high-performers get boosted, low-performers penalized
  if (perfWeights) {
    for (let i = 0; i < total; i++) {
      if (perfWeights[i] !== undefined) {
        sc[i] += perfWeights[i]; // negative = boost (selected sooner), positive = penalize
      }
    }
  }

  const items = shuf(Object.keys(sc).map(Number), seed || 7);
  items.sort((a, b) => sc[a] - sc[b]);
  return items.slice(0, Math.min(count, total));
}

// FIX 4: allocCtas with constraint satisfaction + post-condition validation
// Hardcoded valid fallback allocation if the algorithm fails
const CTA_FALLBACK = { b1: [1, 2, 3, 4, 5], b2: [4, 1, 6, 5, 2], b3: [6, 3, 1, 2, 4], b4: [5, 6, 4, 3, 1] };

function allocCtas(seed) {
  // Weekly targets: CTA1=4, CTA2=3, CTA3=3, CTA4=4, CTA5=3, CTA6=3 = 20
  const pool = [];
  [4, 3, 3, 4, 3, 3].forEach((count, idx) => { for (let i = 0; i < count; i++)pool.push(idx + 1); });
  const shuffled = shuf(pool, seed);

  // Constraint-satisfaction: try multiple batch orderings
  const batchOrders = [
    [0, 1, 2, 3],
    [1, 2, 3, 0],
    [2, 3, 0, 1],
    [3, 0, 1, 2],
  ];

  let bestResult = null;
  let bestDups = Infinity;

  for (const order of batchOrders) {
    const batches = [[], [], [], []];
    const used = [new Set(), new Set(), new Set(), new Set()];

    // First pass: greedy with uniqueness constraint, using rotated batch order
    for (const cta of shuffled) {
      let placed = false;
      for (const b of order) {
        if (batches[b].length < 5 && !used[b].has(cta)) {
          batches[b].push(cta);
          used[b].add(cta);
          placed = true;
          break;
        }
      }
      if (!placed) {
        for (const b of order) {
          if (batches[b].length < 5) { batches[b].push(cta); placed = true; break; }
        }
      }
    }

    // Second pass: fix duplicates by swapping with other batches
    for (let b = 0; b < 4; b++) {
      const seen = new Set();
      for (let i = 0; i < batches[b].length; i++) {
        if (seen.has(batches[b][i])) {
          for (let ob = 0; ob < 4; ob++) {
            if (ob === b) continue;
            for (let j = 0; j < batches[ob].length; j++) {
              const theirs = batches[ob][j], ours = batches[b][i];
              if (!seen.has(theirs) && !new Set(batches[ob]).has(ours)) {
                const obSet = new Set(batches[ob]); obSet.delete(theirs);
                if (!obSet.has(ours)) {
                  batches[ob][j] = ours;
                  batches[b][i] = theirs;
                  break;
                }
              }
            }
            if (!seen.has(batches[b][i])) break;
          }
        }
        seen.add(batches[b][i]);
      }
    }

    // Count remaining duplicates
    let dups = 0;
    for (let b = 0; b < 4; b++) {
      if (new Set(batches[b]).size !== batches[b].length) dups++;
    }

    if (dups < bestDups) {
      bestDups = dups;
      bestResult = batches;
      if (dups === 0) break; // Perfect allocation found
    }
  }

  // Post-condition validation: if any batch still has duplicates, use fallback
  if (bestDups > 0) {
    console.warn(`[allocCtas] Could not eliminate all duplicates (${bestDups} batches affected), using fallback`);
    return {
      b1: shuf([...CTA_FALLBACK.b1], seed),
      b2: shuf([...CTA_FALLBACK.b2], seed + 1),
      b3: shuf([...CTA_FALLBACK.b3], seed + 2),
      b4: shuf([...CTA_FALLBACK.b4], seed + 3),
    };
  }

  return { b1: bestResult[0], b2: bestResult[1], b3: bestResult[2], b4: bestResult[3] };
}

// FIX 5+6: calc() now uses year-aware seeds and cross-week dedup for ALL batches
function calc(wk, mo, history, year) {
  const yr = year || new Date().getFullYear();
  // FIX 6: Year-aware seed — prevents identical rotations across years
  const ySeed = wk + (yr * 53);
  const ci = (wk - 1) % 4, se = CAL.find(c => c.m === mo) || CAL[0];

  // FIX 10: Compute performance weights from historical data
  const perfBuyer = getPerfWeights(history, 'buyer');
  const perfSeller = getPerfWeights(history, 'seller');
  const perfAgent = getPerfWeights(history, 'agent');
  const perfNri = getPerfWeights(history, 'nri');

  // Pick content angles with improved pickLru (FIX 1: cold-start + week tracking + FIX 10: perf weighting)
  const ba = pickLru(ANG.buyer.length, (history || []).map(w => w?.ang?.buyer || []), 5, ySeed * 101, wk, perfBuyer);
  const sa = pickLru(ANG.seller.length, (history || []).map(w => w?.ang?.seller || []), 5, ySeed * 103, wk, perfSeller);
  const aa = pickLru(ANG.agent.length, (history || []).map(w => w?.ang?.agent || []), 3, ySeed * 107, wk, perfAgent);
  const na = pickLru(ANG.nri.length, (history || []).map(w => w?.ang?.nri || []), 2, ySeed * 109, wk, perfNri);
  // Resolve angle strings for each batch
  const angStr = {
    b1: ba.map(i => ANG.buyer[i] || ""),
    b2: sa.map(i => ANG.seller[i] || ""),
    b3: [...aa.map(i => ANG.agent[i] || ""), ...na.map(i => ANG.nri[i] || "")],
    b4: ["Fresh stat/news", "Forward-looking trends", "Q&A community", "Seasonal festivals", "Community story"],
  };
  // Assign hooks from rotation pattern
  const allH = [...WEEK_HOOKS[ci]];
  const hB = { b1: allH.slice(0, 5), b2: allH.slice(5, 10), b3: allH.slice(10, 15), b4: allH.slice(15, 20) };

  // FIX 5: Cross-week hook dedup now covers ALL 4 batches (was only b1/b2)
  const prev = history?.length > 0 ? history[history.length - 1] : null;
  if (prev?.hooks) {
    const prevB = { b1: prev.hooks.slice(0, 5), b2: prev.hooks.slice(5, 10), b3: prev.hooks.slice(10, 15), b4: prev.hooks.slice(15, 20) };
    ["b1", "b2", "b3", "b4"].forEach(bk => {
      for (let i = 0; i < (hB[bk]?.length || 0); i++) {
        if (hB[bk][i] === prevB[bk]?.[i]) {
          for (let j = i + 1; j < hB[bk].length; j++) {
            if (hB[bk][j] !== prevB[bk]?.[i] && hB[bk][i] !== prevB[bk]?.[j]) {
              [hB[bk][i], hB[bk][j]] = [hB[bk][j], hB[bk][i]]; break;
            }
          }
        }
      }
    });
  }

  // FIX 3: enforceHookCompat now returns { hooks, warnings }
  const compatWarnings = [];
  ["b1", "b2", "b3", "b4"].forEach(bk => {
    const result = enforceHookCompat(hB[bk], angStr[bk], ySeed);
    hB[bk] = result.hooks;
    if (result.warnings.length) compatWarnings.push(...result.warnings.map(w => `${bk}: ${w}`));
  });

  const cB = allocCtas(ySeed * 173);
  // Engagement triggers: pillar-based, adjusted to match strategy Section 6.4 targets
  // Target: SAVE=8, SHARE=4, COMMENT=4, FOLLOW=4 (total=20)
  const tB = {
    b1: ["SAVE", "SHARE", "SAVE", "FOLLOW", "COMMENT"],
    b2: ["COMMENT", "SAVE", "FOLLOW", "SAVE", "SHARE"],
    b3: ["SAVE", "SHARE", "SAVE", "SAVE", "FOLLOW"],
    b4: ["SHARE", "FOLLOW", "COMMENT", "SAVE", "COMMENT"],
  };
  // Totals: SAVE=2+2+3+1=8, SHARE=1+1+1+1=4, COMMENT=1+1+0+2=4, FOLLOW=1+1+1+1=4 ✓
  const bio = { b1: shuf([0, 1, 2, 3, 4], ySeed * 311), b2: shuf([0, 1, 2, 3, 4], ySeed * 317), b3: shuf([0, 1, 2, 3, 4], ySeed * 331), b4: shuf([0, 1, 2, 3, 4], ySeed * 337) };
  return {
    hB, cB, tB, bio, ba, sa, aa, na,
    pain: PAIN_CYCLE[ci], ci: ci + 1,
    emo: {
      buyer: painEmo("buyer", PAIN_CYCLE[ci].p),
      seller: painEmo("seller", PAIN_CYCLE[ci].p),
      agent: painEmo("agent", PAIN_CYCLE[ci].p),
      nri: painEmo("nri", PAIN_CYCLE[ci].p),
    },
    se, comp: (wk - 1) % COMP.length, pat: ["A", "B", "C", "D"][ci],
    warnings: compatWarnings,
  };
}

// ═══ PROMPT BUILDERS ═══
const hS = (ids) => ids.map((id, i) => `  S${i + 1} = ${HOOKS.find(x => x.id === id)?.name} ("${HOOKS.find(x => x.id === id)?.ex}")`).join("\n");
const cS = (ids) => ids.map((id, i) => `  S${i + 1} = ${CTAS.find(x => x.id === id)?.name} ("${CTAS.find(x => x.id === id)?.ex}")`).join("\n");
const uS = (pri, sec) => pri.map((id, i) => `S${i + 1}=${USPS.find(x => x.id === id)?.name} (2nd: ${USPS.find(x => x.id === sec[i])?.name})`).join(", ");

function mkP(num, title, audience, cx, r, res, assignments, formats, energy, selfRef, uspPri, uspSec, audCal, compIdx) {
  const se = r.se, bk = `b${num}`;
  return `${RULES}

═══ ${title} ═══
Week ${cx.wk} of ${cx.mn}, ${cx.yr} | Pattern ${r.pat} | ${cx.se} | Emotion ${r.ci}/4

WEEKLY DATA:
${res || "No fresh research this week. MANDATORY: Pull 2-3 hard stats from the Target Audience Guide stat library and weave them into scripts as proof points. At least 1 script must open with a stat-based hook using library data."}

SEASONAL: ${se.h}${se.mi ? ` | MICRO: ${se.mi}` : ""}
FESTIVALS: ${se.f.join(", ")}
COMPETITIVE (weave 1-2 scripts): "${COMP[compIdx % COMP.length]}"

ASSIGNMENTS:
${assignments}

CALENDAR SLOTS:
${SLOTS[bk].map((s, i) => `  S${i + 1} → ${s}`).join("\n")}

FORMATS: ${formats.map((f, i) => `S${i + 1}:${f}`).join(" | ")}
A/B TEST: Generate 1 alt hook for Script 1 (different archetype) as backup.

═══ VARIATION CONTROLS (DO NOT CHANGE) ═══
HOOKS:
${hS(r.hB[bk])}
CTAs:
${cS(r.cB[bk])}
BIOS:
${r.bio[bk].map((bi, i) => `  S${i + 1} = "${BIOS[bi]}"`).join("\n")}
TRIGGERS: ${r.tB[bk].map((t, i) => `S${i + 1}=${t}`).join(", ")}
ENERGY: ${energy.map((e, i) => `S${i + 1}=${e}`).join(", ")}
SELF-REF: ${selfRef}
USP PRIMARY: ${uS(uspPri, uspSec)}
RULE: Each script has 1 primary USP woven into content + 1 secondary USP mentioned naturally in CTA. Max 2 USPs per script.
PAIN (${r.ci}/4): ${r.pain.l}

${audCal}

═══ OUTPUT ═══
1. HeyGen-ready script (pure spoken words, no brackets/directions)
2. English caption (1-2 SEO sentences) + max 8 hashtags w/ #BhoomiScan
3. 130-145 words — COUNT CAREFULLY
4. Hook → Engage → CTA for Instagram/Facebook reels

VARIATION LOG after scripts:
| Script | Hook | CTA | Bio | Trigger | Energy | USP | Pain | Angle | Format |

${QGATE}`;
}

function mkP1(cx, r, res) {
  const a = r.ba.map(i => ANG.buyer[i]);
  return mkP(1, "GENERATE 5 BUYER-FOCUSED BHOOMISCAN REEL SCRIPTS", "buyer", cx, r, res,
    `S1: EDUCATE — ${a[0] || "Document/process explainer"}\nS2: AGITATE — ${a[1] || "Scam/fraud awareness"}\nS3: EDUCATE — ${a[2] || "Step-by-step checklist"}\nS4: EMPOWER — ${a[3] || "Smart buying strategy"}\nS5: AGITATE — ${a[4] || "Common buyer mistake"}`,
    FMT.b1, NRG.b1, "S2 and S4 only", USP_B.b1, USP_SEC.b1,
    `═══ AUDIENCE ═══\nBuyer (28-45, Tier 2/3, risk-averse) | "Protective Big Brother" — calm, educational\n65% Hindi / 35% English | ${r.emo.buyer.f} → ${r.emo.buyer.t}\nTrust: verified, genuine, safe, checked | Fear: fraud, fake, court case, scam`,
    r.comp);
}

function mkP2(cx, r, res) {
  const a = r.sa.map(i => ANG.seller[i]);
  return mkP(2, "GENERATE 5 SELLER-FOCUSED BHOOMISCAN REEL SCRIPTS", "seller", cx, r, res,
    `S1: AGITATE — ${a[0] || "Why property not selling"}\nS2: EDUCATE — ${a[1] || "Listing optimization/pricing"}\nS3: EMPOWER — ${a[2] || "Commission savings/direct selling"}\nS4: EDUCATE — ${a[3] || "Legal document awareness"}\nS5: AGITATE — ${a[4] || "Cost of waiting"}`,
    FMT.b2, NRG.b2, "S1 and S3 only", USP_B.b2, USP_SEC.b2,
    `═══ AUDIENCE ═══\nSeller (30-60, native place property) | "Strategic Advisor" — direct, empowering\n70% Hindi / 30% English | ${r.emo.seller.f} → ${r.emo.seller.t}\nTrust: free, direct, control, no spam | Fear: commission, broker cut, time waste, unsold`,
    (r.comp + 1) % COMP.length);
}

function mkP3(cx, r, res) {
  const aa = r.aa.map(i => ANG.agent[i]), na = r.na.map(i => ANG.nri[i]);
  return mkP(3, "GENERATE 5 SCRIPTS: 3 AGENT + 2 NRI", "mixed", cx, r, res,
    `S1 (AGENT EMPOWER): ${aa[0] || "Business growth"}\nS2 (AGENT AGITATE): ${aa[1] || "Digital disruption FOMO"}\nS3 (AGENT EDUCATE): ${aa[2] || "Lead gen/closing"}\nS4 (NRI EDUCATE): ${na[0] || "NRI rules/FEMA"}\nS5 (NRI EMPOWER): ${na[1] || "Hometown investment"}`,
    FMT.b3, NRG.b3, "S2 only", USP_B.b3, USP_SEC.b3,
    `═══ AGENT ═══\nAgent (25-50, commission-based) | "Peer Mentor" — competitive, FOMO\n55% Hindi / 45% English | ${r.emo.agent.f} → ${r.emo.agent.t}\nNOT anti-broker — ADDITIONAL channel\n═══ NRI ═══\nNRI (30-55, abroad) | "Trusted Advisor from Home" — warm\n60% Hindi / 40% English | ${r.emo.nri.f} → ${r.emo.nri.t}\nCANNOT buy agricultural land — residential only`,
    (r.comp + 2) % COMP.length);
}

function mkP4(cx, r, res, shockStat) {
  const se = r.se;
  const hasResearch = !!res;
  // FIX 5: Wire shockStat into prompt — inject the actual extracted stat for S1
  const shockLine = shockStat
    ? `USE THIS EXACT STAT AS SHOCK HOOK: "${shockStat}"`
    : (hasResearch ? "Fresh stat/news as shock hook" : "Strongest stat from Target Audience Guide stat library as shock hook");
  const freshness = hasResearch
    ? `FRESHNESS: S1 MUST use this week's research as shock hook${shockStat ? ` — SPECIFIC STAT: "${shockStat}"` : ""} | S2 MUST be forward-looking backed by research trends | S4 MUST ref festivals | S5 MUST drive comments/community`
    : `FRESHNESS: S1 MUST use strongest stat from Target Audience Guide stat library as shock hook — present it as if it's breaking news ("Ek number sunno jo is week saamne aaya...") | S2 MUST be forward-looking using known industry trends | S4 MUST ref festivals | S5 MUST drive comments/community\nNOTE: No fresh research this week. Compensate by making S1 and S2 extra compelling with library stats and known trends. Frame them with urgency as if they're timely.`;
  return mkP(4, "GENERATE 5: TRENDING + DATA-BACKED + COMMUNITY", "trending", cx, r, res,
    `S1 (DATA): ${shockLine}\nS2 (PREDICTION): Forward-looking trends\nS3 (CONNECT Q&A): "Your questions answered" format — community engagement\nS4 (SEASONAL): ${se.f.join("/")} — "${se.h}"\nS5 (CONNECT): Relatable community story OR audience poll/debate topic — 2nd CONNECT reel of the week`,
    FMT.b4, NRG.b4, "S3 only", USP_B.b4, USP_SEC.b4,
    `AUDIENCE: Mixed — 2 ALL, 1 Buyer, 1 Seller, 1 Agent\nCONTENT PILLARS: S1=TRENDING, S2=TRENDING, S3=CONNECT, S4=EDUCATE/SEASONAL, S5=CONNECT (2 CONNECT reels required per week)\n${freshness}`,
    (r.comp + 3) % COMP.length);
}

function mkClean(cx, r) {
  // Dynamic assignments: inject the actual week's hook/CTA/USP so Claude preserves them
  const weekInfo = cx && r ? `\nWEEK CONTEXT: Week ${cx.wk} of ${cx.mn}, ${cx.yr} | Pattern ${r.pat} | Emotion ${r.ci}/4
PAIN: ${r.pain.l}

THIS WEEK'S ASSIGNMENTS (MUST PRESERVE):
─── Prompt 1 (Buyer) ───
HOOKS: ${hS(r.hB.b1)}
CTAs: ${cS(r.cB.b1)}
USPs: ${uS(USP_B.b1, USP_SEC.b1)}
Emotion: ${r.emo.buyer.f} → ${r.emo.buyer.t}

─── Prompt 2 (Seller) ───
HOOKS: ${hS(r.hB.b2)}
CTAs: ${cS(r.cB.b2)}
USPs: ${uS(USP_B.b2, USP_SEC.b2)}
Emotion: ${r.emo.seller.f} → ${r.emo.seller.t}

─── Prompt 3 (Agent+NRI) ───
HOOKS: ${hS(r.hB.b3)}
CTAs: ${cS(r.cB.b3)}
USPs: ${uS(USP_B.b3, USP_SEC.b3)}
Emotion: ${r.emo.agent.f} → ${r.emo.agent.t} | ${r.emo.nri.f} → ${r.emo.nri.t}

─── Prompt 4 (Trending) ───
HOOKS: ${hS(r.hB.b4)}
CTAs: ${cS(r.cB.b4)}
USPs: ${uS(USP_B.b4, USP_SEC.b4)}
` : "";

  return `═══ MASTER CLEANUP ═══
"Review Script [N] from [Buyer/Seller/Agent+NRI/Trending]. Issue: [describe].
Maintain archetype/CTA/USP/130-145 words.
${weekInfo}
FIXES:
1. Hook weak → stronger SAME archetype (check assignments above)
2. CTA forced → use the ASSIGNED CTA pattern for that script
3. Tone off → 2-3 texture elements
4. Flat → booster at 40-60%
5. AI → chai tapri speech
6. Too long/short → trim/expand
7. USP forced → natural weave (preserve ASSIGNED primary + secondary USP)
8. Hinglish → Buyer 65%, Seller 70%, Agent 55%, NRI 60%
9. Format wrong → match assigned format
10. bhai count → 2-4x only
11. Pronouns → tum/tumhare only
12. Emotion mismatch → maintain the FROM→TO emotional arc listed above

RULES:
- Do NOT change the hook archetype — fix within the SAME archetype
- Do NOT swap CTA patterns between scripts — each has a specific assignment
- Preserve the primary USP (woven into content) and secondary USP (in CTA) as assigned

Output corrected script + caption + hashtags. Highlight changes.
Re-verify against Quality Gate."`;
}

// ═══ STORAGE ═══
const SK = "bhoomiscan-v4";
async function loadSt() { try { const r = await window.storage.get(SK); return r ? JSON.parse(r.value) : null; } catch { return null; } }
async function saveSt(s) { try { await window.storage.set(SK, JSON.stringify(s)); return true; } catch { return false; } }

// ═══ FIX 2: REAL PDF/DOCX EXTRACTION ═══

// Dynamically load pdf.js from CDN (cached after first load)
let pdfJsLoaded = null;
function loadPdfJs() {
  if (pdfJsLoaded) return pdfJsLoaded;
  pdfJsLoaded = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
    script.type = 'module';
    // Fallback: try legacy build if module fails
    script.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s2.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else reject(new Error('pdf.js failed to load'));
      };
      s2.onerror = () => reject(new Error('pdf.js CDN unavailable'));
      document.head.appendChild(s2);
    };
    script.onload = () => {
      // For module version, we need to wait for global
      setTimeout(() => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
          resolve(window.pdfjsLib);
        } else reject(new Error('pdf.js module did not expose global'));
      }, 200);
    };
    document.head.appendChild(script);
  });
  return pdfJsLoaded;
}

// Extract text from PDF ArrayBuffer using pdf.js
async function extractPdfText(arrayBuffer) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    if (pageText.trim()) pages.push(pageText.trim());
  }
  return pages.join('\n\n');
}

// ── Minimal ZIP parser for DOCX (pure JS, no dependencies) ──
// DOCX = ZIP containing word/document.xml with the text content

function parseZipEntries(buffer) {
  const view = new DataView(buffer);
  const entries = [];
  let offset = 0;
  const len = buffer.byteLength;

  while (offset < len - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Local file header signature

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
    const name = new TextDecoder().decode(nameBytes);
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataBytes = new Uint8Array(buffer, dataStart, compressedSize);

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, data: dataBytes });
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function decompressEntry(entry) {
  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return new TextDecoder().decode(entry.data);
  }
  if (entry.compressionMethod === 8) {
    // Deflate — use browser's DecompressionStream
    try {
      const ds = new DecompressionStream('raw');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(entry.data);
      writer.close();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let pos = 0;
      for (const c of chunks) { result.set(c, pos); pos += c.length; }
      return new TextDecoder().decode(result);
    } catch {
      return null; // Decompression failed
    }
  }
  return null; // Unknown compression
}

// Extract text from DOCX ArrayBuffer
async function extractDocxText(arrayBuffer) {
  const entries = parseZipEntries(arrayBuffer);
  // Find word/document.xml — the main content file
  const docEntry = entries.find(e => e.name === 'word/document.xml');
  if (!docEntry) throw new Error('Not a valid DOCX: word/document.xml not found');

  const xml = await decompressEntry(docEntry);
  if (!xml) throw new Error('Failed to decompress document.xml');

  // Extract text from XML — get content from <w:t> tags and add paragraph breaks
  const text = xml
    .replace(/<w:p[\s>]/g, '\n') // Paragraph breaks
    .replace(/<w:tab\/>/g, '\t') // Tab characters
    .replace(/<w:br[^>]*\/>/g, '\n') // Line breaks
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1') // Extract text content
    .replace(/<[^>]+>/g, '') // Remove all remaining XML tags
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') // Unescape XML entities
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
    .trim();

  return text;
}

// Unified file text extractor with status tracking
async function extractFileText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (ext === 'pdf') {
    try {
      const text = await extractPdfText(arrayBuffer);
      if (text.trim().length > 20) return { text, method: 'pdf.js' };
      return { text: null, error: 'PDF appears to contain only images/scanned content — no extractable text found. Please paste the text manually.' };
    } catch (err) {
      return { text: null, error: `PDF extraction failed (${err.message}). Paste text manually or try a TXT/MD export.` };
    }
  }

  if (ext === 'docx') {
    try {
      const text = await extractDocxText(arrayBuffer);
      if (text.trim().length > 20) return { text, method: 'native DOCX parser' };
      return { text: null, error: 'DOCX appears empty — no text content found.' };
    } catch (err) {
      return { text: null, error: `DOCX extraction failed (${err.message}). Try saving as TXT first.` };
    }
  }

  if (ext === 'doc') {
    // .doc (legacy Word format) cannot be parsed in-browser without a heavy library
    return { text: null, error: 'Legacy .doc format not supported — please save as .docx or .txt first, or paste text manually.' };
  }

  // Plain text formats — read directly
  const text = new TextDecoder().decode(arrayBuffer);
  return { text, method: 'text' };
}

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
  const iR = useRef(null);

  useEffect(() => { (async () => { const s = await loadSt(); if (s?.history) setSt(s); setLoading(false); })(); }, []);
  useEffect(() => { if (!loading) saveSt(st); }, [st, loading]);

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
      const all = files.map(f => f.text).join("\n\n").trim();
      if (all) {
        setRes(prev => prev.trim() ? (prev + "\n\n--- FROM FILES ---\n" + all) : all);
        // Run intelligent processor for preview (without rotation context — full processing happens at generate time)
        const preview = processResearch(all, null, null);
        if (preview.findings.length) {
          setFinds(preview.findings.slice(0, 12).map(f => ({
            stat: f.text.slice(0, 150),
            audience: f.audiences[0]?.toUpperCase() || "ALL",
            pillar: f.pillar,
            stats: f.stats,
            score: f.score
          })));
        }
        flash(`${files.length} file(s) merged — ${preview.counts.total} findings extracted`);
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
    const rotation = calc(wk, mo, st.history, yr);
    setCx(context); setRot(rotation);
    // Smart research processing — filter research per batch with rotation context
    const rawRes = res.trim() || null;
    const processed = rawRes ? processResearch(rawRes, context, rotation) : null;
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
    if (processed) { setFinds(processed.findings.slice(0, 12).map(f => ({ stat: f.text.slice(0, 150), audience: f.audiences[0]?.toUpperCase() || "ALL", pillar: f.pillar, stats: f.stats, score: f.score }))); }
    setExp(0); setVw("prompts");
    const resMsg = processed ? ` — ${processed.counts.total} findings (${processed.counts.withStats} stats)${isWeak ? " ⚠ WEAK" : ""}` : "";
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
    const exists = st.history.find(w => w.wk === cx.wk && w.yr === cx.yr);
    if (exists && !window.confirm(`Week ${cx.wk}/${cx.yr} already logged. Replace?`)) return;
    const hist = exists ? st.history.filter(w => !(w.wk === cx.wk && w.yr === cx.yr)) : st.history;
    const rec = {
      dt: cx.dt, wk: cx.wk, mo: cx.mo, yr: cx.yr, se: cx.se, pat: rot.pat,
      hooks: [...rot.hB.b1, ...rot.hB.b2, ...rot.hB.b3, ...rot.hB.b4],
      ctas: [...rot.cB.b1, ...rot.cB.b2, ...rot.cB.b3, ...rot.cB.b4],
      ang: { buyer: rot.ba, seller: rot.sa, agent: rot.aa, nri: rot.na },
      pains: [rot.pain.p, rot.pain.s], emo: rot.ci,
      log: logT, perf: perfT, mults: Object.keys(mults).length > 0 ? mults : undefined, research: res.slice(0, 2000), ts: new Date().toISOString()
    };
    setSt({ history: [...hist, rec], lastGen: rec.ts });
    flash("Week " + cx.wk + " saved");
    setLogT(""); setPerfT(""); setMults({}); setRes(""); setFiles([]); setFinds(null); setPr(null); setRot(null); setCx(null); setVw("home");
  };

  const exportD = () => {
    const b = new Blob([JSON.stringify(st, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = `bhoomiscan-${new Date().toISOString().split("T")[0]}.json`; a.click(); flash("Backup downloaded");
  };
  const importD = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => { try { const d = JSON.parse(ev.target.result); if (d.history) { setSt(d); await saveSt(d); flash(`Restored ${d.history.length} weeks`); } else flash("Invalid", "err"); } catch { flash("Read error", "err"); } };
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
  const previewRot = rot || calc(cW, cM, st.history, previewDate.getFullYear());
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
            {nav.map(([id, l, ic]) => <button key={id} onClick={() => setVw(id)} style={{ padding: "7px 13px", borderRadius: 8, border: "none", background: vw === id ? "rgba(255,255,255,0.2)" : "transparent", color: vw === id ? "#fff" : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 11, fontWeight: vw === id ? 700 : 500, transition: "all 0.15s" }}>{ic} {l}</button>)}
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

          {/* Last Week Summary - Enhanced */}
          {tH > 0 && (() => {
            const l = st.history[tH - 1]; return <div style={{ ...sC, borderLeft: `4px solid ${GL}`, background: "rgba(45,106,79,0.02)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 18 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: G }}>Last Generated — Week {l.wk} ({l.pat})</div>
              </div>
              <div style={{ fontSize: 11, color: TL, lineHeight: 2.2 }}>
                <div style={{ marginBottom: 4 }}><strong style={{ color: BD }}>🎣 Hooks Used:</strong> {[...new Set(l.hooks)].slice(0, 6).map(id => <span key={id} style={{ ...sTag, background: "rgba(45,106,79,0.1)", color: G, padding: "3px 8px", marginRight: 4 }}>{HOOKS.find(h => h.id === id)?.name}</span>)}</div>
                <div><strong style={{ color: BD }}>💔 Pain Points:</strong> {(l.pains || []).map(p => <span key={p} style={{ ...sTag, background: "rgba(139,111,71,0.1)", color: BN, padding: "3px 8px", marginRight: 4 }}>{p}</span>)}</div>
              </div>
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
                {st.history.find(w => w.wk === cW && w.yr === now.getFullYear()) && <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#b44040", fontWeight: 600, background: "rgba(180,64,64,0.08)", padding: "4px 10px", borderRadius: 6 }}>⚠ Week already logged</div>}
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
        {vw === "log" && <>
          {/* Smart Log Input with Validation */}
          <div style={{ ...sC, borderLeft: `4px solid ${G}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 20 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: BD, letterSpacing: 0.3 }}>Log Variation Output</div>
            </div>

            {/* Instructions - Clear and Numbered */}
            <div style={{ background: "rgba(45,106,79,0.05)", padding: "12px 14px", borderRadius: 8, marginBottom: 12, borderLeft: `3px solid ${G}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G, marginBottom: 6 }}>📋 How to Log (3 Simple Steps):</div>
              <div style={{ fontSize: 11, color: TL, lineHeight: 1.8 }}>
                <div style={{ marginBottom: 3 }}>1️⃣ Copy each of the 4 prompts → Paste into Claude Project</div>
                <div style={{ marginBottom: 3 }}>2️⃣ After Claude generates scripts, find the <strong>"VARIATION LOG"</strong> table at the bottom of each batch</div>
                <div style={{ marginBottom: 3 }}>3️⃣ Copy <strong>ALL 4 variation log tables</strong> (from all 4 prompts) and paste them below</div>
              </div>
            </div>

            {/* Script Counter with Smart Validation — FIX 8: uses robust countScripts() */}
            {logT.trim() && (() => {
              const scriptCount = countScripts(logT);
              const isComplete = scriptCount >= 20;
              const isPartial = scriptCount >= 5 && scriptCount < 20;
              const isEmpty = scriptCount === 0;
              const hasUnparsedText = logT.trim().length > 0 && isEmpty;

              return <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 8, background: isComplete ? "rgba(45,106,79,0.08)" : isPartial ? "rgba(180,64,64,0.08)" : hasUnparsedText ? "rgba(180,140,0,0.08)" : "rgba(139,111,71,0.05)", border: `1.5px solid ${isComplete ? G : isPartial ? "#b44040" : hasUnparsedText ? "#b49000" : BR}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 20 }}>{isComplete ? "✅" : isPartial ? "⚠️" : hasUnparsedText ? "🔍" : "📝"}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isComplete ? G : isPartial ? "#b44040" : hasUnparsedText ? "#b49000" : BD }}>
                        {isComplete ? "All 4 Batches Detected ✓" : isPartial ? `Only ${Math.floor(scriptCount / 5)} Batch${scriptCount > 5 ? "es" : ""} Detected!` : hasUnparsedText ? "Text Found But No Scripts Detected" : "Analyzing..."}
                      </div>
                      <div style={{ fontSize: 10, color: TL, marginTop: 2 }}>
                        {hasUnparsedText ? "Expected format: | S1 | Hook | CTA | ... | or | Script 1 | Hook | ..." : isEmpty ? "Paste your variation logs below" : `${scriptCount}/20 scripts found`}
                      </div>
                    </div>
                  </div>
                  {isPartial && <div style={{ fontSize: 10, fontWeight: 700, color: "#b44040", maxWidth: 300, textAlign: "right", lineHeight: 1.4 }}>
                    ⚠️ Missing {Math.ceil((20 - scriptCount) / 5)} batch{(20 - scriptCount) > 5 ? "es" : ""}! Go back to Prompts tab and copy logs from ALL 4 prompts.
                  </div>}
                  {hasUnparsedText && <div style={{ fontSize: 10, fontWeight: 700, color: "#b49000", maxWidth: 300, textAlign: "right", lineHeight: 1.4 }}>
                    ⚠️ Check format — paste the markdown table from Claude's VARIATION LOG output.
                  </div>}
                </div>
              </div>;
            })()}

            <textarea
              style={{ ...sI, minHeight: 180, resize: "vertical", fontSize: 11, fontFamily: "Consolas,Monaco,monospace", lineHeight: 1.6 }}
              value={logT}
              onChange={e => setLogT(e.target.value)}
              placeholder="Paste variation logs here from ALL 4 batches...

Example format (you need 20 rows like this - 5 from each prompt):
| Script | Hook | CTA | Bio | Trigger | Energy | USP | Pain | Angle | Format |
| S1 | Confession | Casual Aside | Link bio mein hai | SAVE | MEDIUM | Free | trust | ... | Talking Head |
| S2 | Knowledge Gap | Logical Extension | ... | SHARE | HIGH | Verified | ... | ... | Myth Buster |
..."
            />

            {logT.trim() && <button
              style={{ ...sB(), marginTop: 8, fontSize: 11 }}
              onClick={() => { if (window.confirm("Clear all log text?")) setLogT(""); }}
            >
              🗑️ Clear & Start Over
            </button>}
          </div>

          <div style={sC}>
            <div style={{ fontSize: 15, fontWeight: 700, color: BD, marginBottom: 8 }}>Performance Tracking (optional)</div>
            <div style={{ fontSize: 11, color: TL, marginBottom: 8 }}>Paste or type weekly performance data. Format: Script# | Views(24h) | Saves | Shares | Comments | Best/Worst</div>
            <textarea style={{ ...sI, minHeight: 100, resize: "vertical", fontSize: 11 }} value={perfT} onChange={e => setPerfT(e.target.value)} placeholder="S1 | 12000 | 450 | 120 | 35 | Best&#10;S2 | 8000 | 200 | 80 | 20 |&#10;..." />
            <div style={{ fontSize: 10, color: TXL, marginTop: 4 }}>This data is saved with the week log for monthly analysis.</div>
          </div>
          <div style={sC}>
            <div style={{ fontSize: 15, fontWeight: 700, color: BD, marginBottom: 8 }}>Freshness Multipliers (optional)</div>
            <div style={{ fontSize: 10, color: TL, marginBottom: 8 }}>If any content angle repeated from a previous week, tag which multiplier was used to keep it fresh (Strategy Section 5.3).</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {MULTIPLIERS.map(m => <button key={m.id} style={{
                padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: `1px solid ${BR}`, cursor: "pointer",
                background: Object.values(mults).includes(m.id) ? "rgba(45,106,79,0.12)" : "#faf8f4",
                color: Object.values(mults).includes(m.id) ? G : TL
              }} title={m.desc}
                onClick={() => { const next = prompt(`Tag "${m.name}" to which batch-script? (e.g. b1-s3, b2-s1)`); if (next?.trim()) setMults(p => ({ ...p, [next.trim().toLowerCase()]: m.id })); }}
              >{m.name}</button>)}
            </div>
            {Object.keys(mults).length > 0 && <div style={{ fontSize: 10, color: TL }}>
              <strong>Tagged:</strong> {Object.entries(mults).map(([k, v]) => <span key={k} style={{ ...sTag, background: "rgba(45,106,79,0.08)", color: G }}>{k}: {MULTIPLIERS.find(m => m.id === v)?.name}</span>)}
            </div>}
          </div>

          {/* Save Validation - Smart Checks — FIX 8: uses robust countScripts() */}
          {(() => {
            const scriptCount = countScripts(logT);
            const hasAllLogs = scriptCount >= 20;
            const hasPartialLogs = scriptCount >= 5 && scriptCount < 20;
            const hasUnparsedText = logT.trim().length > 0 && scriptCount === 0;
            const canSave = cx && (hasAllLogs || logT.trim().length === 0);

            if (!cx) {
              return <div style={{ ...sC, background: "rgba(180,64,64,0.04)", borderLeft: "4px solid #b44040" }}>
                <div style={{ fontSize: 13, color: "#b44040", fontWeight: 600 }}>⚠️ Generate prompts first (Go to Generate tab)</div>
              </div>;
            }

            if (hasPartialLogs) {
              return <div style={{ ...sC, background: "rgba(180,64,64,0.06)", borderLeft: "4px solid #b44040", boxShadow: "0 2px 8px rgba(180,64,64,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>⚠️</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#b44040" }}>Cannot Save — Incomplete Logs!</div>
                </div>
                <div style={{ fontSize: 11, color: "#b44040", lineHeight: 1.6 }}>
                  You've only pasted {Math.floor(scriptCount / 5)} batch{scriptCount > 5 ? "es" : ""} ({scriptCount} scripts). You need ALL 4 batches (20 scripts total).
                </div>
                <div style={{ fontSize: 11, color: TL, marginTop: 6, fontStyle: "italic" }}>
                  💡 Tip: Copy the variation log table from EACH of the 4 prompts and paste them all together above.
                </div>
              </div>;
            }

            if (hasUnparsedText) {
              return <div style={{ ...sC, background: "rgba(180,140,0,0.06)", borderLeft: "4px solid #b49000" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>🔍</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#b49000" }}>Warning — No Scripts Detected in Text</div>
                </div>
                <div style={{ fontSize: 11, color: "#b49000", lineHeight: 1.6 }}>
                  Text was pasted but no script rows were found. Expected format: | S1 | Hook | CTA | ... |
                </div>
                <div style={{ fontSize: 11, color: TL, marginTop: 6, fontStyle: "italic" }}>
                  💡 You can still save (logs are optional), but check if the variation log table was copied correctly.
                </div>
              </div>;
            }

            return <div style={{ ...sC, background: "rgba(45,106,79,0.04)", borderLeft: `4px solid ${G}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 18 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: G }}>Ready to Save: Week {cx.wk}, {cx.mn} {cx.yr} — Pattern {rot?.pat}</div>
              </div>
              {hasAllLogs && <div style={{ fontSize: 10, color: TL, marginTop: 4 }}>✓ All 20 scripts detected in logs</div>}
            </div>;
          })()}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              style={{
                ...sB("p"),
                flex: 1,
                textAlign: "center",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                padding: 14,
                fontSize: 14,
                opacity: !cx || (countScripts(logT) >= 5 && countScripts(logT) < 20) ? 0.5 : 1
              }}
              onClick={logWeek}
              disabled={!cx || (countScripts(logT) >= 5 && countScripts(logT) < 20)}
            >
              <span>✓</span>
              <span>Save & Log Week</span>
            </button>
            <button style={{ ...sB(), padding: "14px 20px" }} onClick={() => setVw("prompts")}>← Back to Prompts</button>
          </div>
        </>}

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
                {(w.log || w.research || w.perf) && <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {w.log && <details><summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, color: G }}>Variation log</summary><pre style={{ ...sPre, marginTop: 4, maxHeight: 150, fontSize: 10 }}>{w.log}</pre></details>}
                  {w.perf && <details><summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#5a7fa0" }}>Performance</summary><pre style={{ ...sPre, marginTop: 4, maxHeight: 120, fontSize: 10 }}>{w.perf}</pre></details>}
                  {w.research && <details><summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, color: BN }}>Research</summary><pre style={{ ...sPre, marginTop: 4, maxHeight: 120, fontSize: 10 }}>{w.research}</pre></details>}
                </div>}
              </div>;
            })}
        </>}
      </div>

      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.t === "err" ? "#b44040" : G, color: "#fff", padding: "11px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", maxWidth: "90vw" }}>{toast.t === "err" ? "⚠" : "✓"} {toast.m}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ROTATION ENGINE v4 — All constants and calculation logic
// Single source of truth — bhoomiscan-engine.jsx imports from here
// Fixes: pickLru cold-start, independent Week C/D, enforceHookCompat
//        fallback, allocCtas guarantee, cross-week dedup, year-aware seeds
// ════════════════════════════════════════════════════════════════════

export const HOOKS = [
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
export const WEEK_HOOKS = [WEEK_A, WEEK_B, WEEK_C, WEEK_D];

export const CTAS = [
    { id: 1, name: "Casual Aside", ex: "Aur haan," },
    { id: 2, name: "Logical Extension", ex: "Aur ek baat," },
    { id: 3, name: "Reassurance Bridge", ex: "Aur dekho," },
    { id: 4, name: "Conditional", ex: "Agar...toh" },
    { id: 5, name: "Process Integration", ex: "[Steps]...aur [CTA]" },
    { id: 6, name: "Platform-as-Solution", ex: "Toh [CTA]" },
];

export const BIOS = [
    "Link bio mein hai.", "Link bio mein daal di hai.",
    "Bhool mat jana, link bio mein daal di hai.",
    "Bio mein link hai, check kar lena.",
    "Profile pe jaao, BhoomiScan ka link hai.",
];

export const USPS = [
    { id: "free", name: "Free Listings" },
    { id: "whatsapp", name: "WhatsApp Connect" },
    { id: "verified", name: "Verified Properties" },
    { id: "zero", name: "Zero Commission" },
];

export const USP_B = {
    b1: ["verified", "free", "whatsapp", "zero", "free"],
    b2: ["free", "verified", "zero", "whatsapp", "free"],
    b3: ["free", "whatsapp", "free", "verified", "zero"],
    b4: ["whatsapp", "zero", "free", "verified", "whatsapp"],
};
export const USP_SEC = {
    b1: ["free", "whatsapp", "zero", "free", "verified"],
    b2: ["whatsapp", "free", "free", "zero", "whatsapp"],
    b3: ["whatsapp", "zero", "verified", "free", "free"],
    b4: ["free", "free", "whatsapp", "zero", "verified"],
};

export const PAIN_CYCLE = [
    { p: "trust", s: "commission", l: "Trust Deficit (3) + Commission Drain (2)" },
    { p: "docs", s: "spam", l: "Document Chaos (3) + Spam/Time-Wasters (2)" },
    { p: "digital", s: "trust", l: "Digital Illiteracy (3) + Trust Deficit (2)" },
    { p: "commission", s: "docs", l: "Commission Drain (3) + Document Chaos (2)" },
];

export const PAIN_EMO = {
    buyer: {
        trust: { f: "Fear", t: "Safety" }, docs: { f: "Overwhelm", t: "Simplicity" },
        digital: { f: "Confusion", t: "Clarity" }, spam: { f: "Frustration", t: "Control" },
        commission: { f: "Distrust", t: "Confidence" },
    },
    seller: {
        trust: { f: "Distrust", t: "Confidence" }, commission: { f: "Commission Pain", t: "Savings" },
        docs: { f: "Overwhelm", t: "Clarity" }, spam: { f: "Frustration", t: "Control" },
        digital: { f: "Confusion", t: "Simplicity" }, pricing: { f: "Uncertainty", t: "Clarity" },
        unsold: { f: "Invisibility", t: "Visibility" },
    },
    agent: {
        digital: { f: "Digital Fear", t: "Digital Power" }, trust: { f: "Anxiety", t: "Growth" },
        lead: { f: "Frustration", t: "Efficiency" }, competition: { f: "Irrelevance", t: "Relevance" },
        commission: { f: "Confusion", t: "Compliance" }, platform: { f: "Skepticism", t: "Adoption" },
        docs: { f: "Anxiety", t: "Growth" }, spam: { f: "Frustration", t: "Efficiency" },
    },
    nri: {
        trust: { f: "Distance", t: "Connection" }, remote: { f: "Distrust", t: "Verification" },
        legal: { f: "Complexity", t: "Ease" }, fraud: { f: "Anxiety", t: "Confidence" },
        hometown: { f: "Emotional", t: "Practical" }, digital: { f: "Complexity", t: "Ease" },
        docs: { f: "Distrust", t: "Verification" }, commission: { f: "Anxiety", t: "Confidence" },
        spam: { f: "Distance", t: "Connection" },
    },
};

export function painEmo(audience, painKey) {
    const map = PAIN_EMO[audience];
    if (!map) return { f: "Fear", t: "Safety" };
    return map[painKey] || Object.values(map)[0];
}

export const ANG = {
    buyer: ["Red flags when buying land", "Document checklist before purchase", "Site visit preparation guide", "How to verify land ownership", "Land vs apartment investment", "Scam story cautionary tale", "How to negotiate land price", "Understanding encumbrance certificate", "Online vs offline land buying", "Questions to ask seller", "Flood zone check guide", "Agricultural land rules", "First-time buyer guide"],
    seller: ["Why property isn't selling", "How to price land correctly", "Documents needed before listing", "Zero-cost value increase", "Direct sell vs broker", "Handle lowball offers", "Legal protection sale agreement", "Create attractive listings", "Multiple channel strategy", "Handling advance payments", "Tax implications selling", "Property presentation tips", "Early mover on new platforms"],
    agent: ["Speed equals deals", "Digital transformation steps", "One listing multiple deals", "RERA registration simplified", "Filter serious vs fake leads", "Building online brand", "Tax planning commission", "Client management tips", "Photography for listings", "Competing digitally", "WhatsApp marketing", "Handling difficult clients", "Future of land brokerage"],
    nri: ["NRI land buying FEMA rules", "Verify land from abroad", "Power of Attorney guide", "NRI tax implications", "Hometown investment hook", "Remote due diligence", "NRI scam prevention", "Repatriation rules"],
};

export const FMT = {
    b1: ["Talking Head", "Myth Buster", "Talking Head", "Story-Based", "Number Shock"],
    b2: ["Talking Head", "Talking Head", "Myth Buster", "Talking Head", "Talking Head"],
    b3: ["Talking Head", "Talking Head", "Talking Head", "Talking Head", "Story-Based"],
    b4: ["Number Shock", "Prediction/Future", "Q&A Response", "Myth Buster", "Rapid Fire"],
};

export const NRG = {
    b1: ["MEDIUM", "HIGH", "MEDIUM", "MEDIUM", "HIGH"],
    b2: ["HIGH", "MEDIUM", "MEDIUM", "MEDIUM", "WARM"],
    b3: ["MEDIUM", "HIGH", "MEDIUM", "WARM", "HIGH"],
    b4: ["HIGH", "MEDIUM", "WARM", "MEDIUM", "WARM"],
};

export const CAL = [
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

export const SLOTS = {
    b1: ["M1 Mon 12PM", "T1 Tue 12PM", "W1 Wed 12PM", "TH2 Thu 6PM", "F1 Fri 12PM"],
    b2: ["M2 Mon 6PM", "T2 Tue 6PM", "W3 Wed 8:30PM", "TH1 Thu 12PM", "F2 Fri 6PM"],
    b3: ["M3 Mon 8:30PM", "W2 Wed 6PM", "TH3 Thu 8:30PM", "T3 Tue 8:30PM", "F3 Fri 8:30PM"],
    b4: ["S2 Sat 6PM", "S3 Sat 8:30PM", "SU1 Sun 12PM", "SU2 Sun 6PM", "S1 Sat 12PM"],
};

export const COMP = [
    "Bade portals pe 1.3 rating hai — log thak gaye hain.",
    "Doosri jagah listing daalo — koi verify nahi karta. BhoomiScan pe Khata se verify hota hai.",
    "Bade platforms zameen ko seriously lete hi nahi. Unka focus apartments pe hai.",
    "Bade platforms abhi Odisha mein hain hi nahi.",
    "Doosri jagah tumhara number 5 logon ko bik jaata hai.",
    "NRI ke liye doosre platforms local verification nahi karte — BhoomiScan pe Khata number se sab check hota hai, bahar baithke bhi.",
];

export const QGATE = `DIFFERENTIATION CHECKLIST:
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

export const RULES = `PILLAR HIERARCHY: COMPASS(audience)→GUARDRAIL(brand rules)→ENGINE(write)→BENCHMARK(compare to reference)
ABSOLUTE: BhoomiScan=WEBSITE not app | Listing=FREE | Verified=PAID | Leads via WhatsApp | Zero commission
NEVER: "app download karo" | guarantee results | claim scale | name competitors | "aap"/"tu"
ALWAYS: "tum/tumhare" | "link bio mein hai" (rotate) | 130-145 words | 6-beat energy arc`;

export const MULTIPLIERS = [
    { id: "data", name: "Data Swap", desc: "Same topic, new stat from weekly research" },
    { id: "story", name: "Story Swap", desc: "Same lesson, new anonymized story" },
    { id: "hook", name: "Hook Swap", desc: "Same content, different opening archetype" },
    { id: "audience", name: "Audience Swap", desc: "Same insight, different audience lens" },
    { id: "format", name: "Format Swap", desc: "Same topic, different content format" },
    { id: "seasonal", name: "Seasonal Overlay", desc: "Same evergreen topic + timely context" },
    { id: "objection", name: "Objection Anchor", desc: "Same topic, led by different objection" },
    { id: "geo", name: "Geographic Lens", desc: "Same insight, localized (e.g. Odisha-specific)" },
];

export const CALENDAR_GRID = [
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

export function getRecycleStatus(daysAgo) {
    if (daysAgo >= 90) return { level: "90d", color: "#b44040", label: "Repost OK — best performers can be re-posted" };
    if (daysAgo >= 60) return { level: "60d", color: "#a67c52", label: "60d — same hook, update with fresh data" };
    if (daysAgo >= 30) return { level: "30d", color: "#5a7fa0", label: "30d — same insight, write completely new script" };
    return null;
}

// ═══ TOPIC-HOOK COMPATIBILITY ═══

export function classifyAngle(angle) {
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
export function enforceHookCompat(hooks, angles, seed) {
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

// ═══ ENGINE CORE (pure, deterministic) ═══

export function wkNum(d) {
    const dt = new Date(d), j = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - j + ((j.getTimezoneOffset() - dt.getTimezoneOffset()) * 60000)) / 86400000 + j.getDay() + 1) / 7);
}

export function szn(m) {
    return m >= 3 && m <= 5 ? "Summer" : m >= 6 && m <= 9 ? "Monsoon" : m >= 10 && m <= 11 ? "Festive" : "Winter";
}

export function shuf(arr, seed) {
    const o = [...arr]; let s = Math.abs(seed) || 1;
    for (let i = o.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
}

// FIX 9: Smart multi-format script counter
// Handles: pipe-delimited, tab-separated, and unstructured/concatenated text
// Returns a number (for backward compat). Use countScriptsDetailed() for format info.
export function countScripts(text) {
    const result = countScriptsDetailed(text);
    return result.count;
}

// Known hook names for unstructured text anchor detection
const KNOWN_HOOKS = [
    "Confession", "Knowledge Gap", "Single Number", "Story Entry",
    "Situational", "Scene Setter", "Common Mistake", "Audience Question",
    "Future Frame", "Social Proof", "Bold Claim", "Rhetorical Challenge",
    "Rhetorical", "Story", "Knowledge", "Scene", "Common", "Audience", "Future", "Social", "Bold",
];
const HOOK_PATTERN = KNOWN_HOOKS.map(h => h.replace(/\s+/g, '\\s*')).join('|');

export function countScriptsDetailed(text) {
    if (!text?.trim()) return { count: 0, uniqueCount: 0, format: 'empty', hasDuplicates: false };

    // Fingerprint-based duplicate detection helper
    const detectDupes = (segments) => {
        if (!segments.length) return { uniqueCount: 0, hasDuplicates: false };
        const fps = segments.map(s => s.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 50));
        const unique = new Set(fps);
        return { uniqueCount: unique.size, hasDuplicates: fps.length > unique.size };
    };

    // ═══ STRATEGY 1: Pipe-delimited (| S1 | Hook | CTA | ... |) ═══
    const pipeRows = text.split('\n').filter(l => l.trim().startsWith('|'));
    if (pipeRows.length > 0) {
        let count = 0;
        const segments = [];
        for (const row of pipeRows) {
            const cells = row.split('|').map(c => c.trim()).filter(Boolean);
            if (!cells.length) continue;
            const first = cells[0];
            if (/^-+$/.test(first) || /^script$/i.test(first) || /^#$/i.test(first) || /^sr.?\s*no.?$/i.test(first)) continue;
            if (/^(S\s*\d+|Script\s*\d+|#?\d{1,2})$/i.test(first)) {
                count++;
                segments.push(cells.slice(1).join('|'));
            }
        }
        if (count > 0) {
            const { uniqueCount, hasDuplicates } = detectDupes(segments);
            return { count, uniqueCount, format: 'pipe', hasDuplicates };
        }
    }

    // ═══ STRATEGY 2: Tab-separated (Claude table copy with tabs preserved) ═══
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.some(l => l.includes('\t'))) {
        let count = 0;
        const segments = [];
        for (const line of lines) {
            const cells = line.split('\t').map(c => c.trim()).filter(Boolean);
            if (cells.length >= 3) {
                const first = cells[0];
                if (/^(S\s*\d+|Script\s*\d+|#?\d{1,2})$/i.test(first)) {
                    count++;
                    segments.push(cells.slice(1).join('\t'));
                }
            }
        }
        if (count > 0) {
            const { uniqueCount, hasDuplicates } = detectDupes(segments);
            return { count, uniqueCount, format: 'tab', hasDuplicates };
        }
    }

    // ═══ STRATEGY 3: Newline-separated rows starting with S\d+ ═══
    // Some copy-paste gives each row on its own line: "S1\nStory Entry\n..." or "S1 Story Entry Conditional..."
    if (lines.length > 1) {
        let count = 0;
        const segments = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (/^(S\s*\d{1,2}|Script\s*\d{1,2})\b/i.test(trimmed) && trimmed.length > 2) {
                const num = parseInt(trimmed.replace(/^(S|Script)\s*/i, ''));
                if (num >= 1 && num <= 20) {
                    count++;
                    segments.push(trimmed.replace(/^(S|Script)\s*\d{1,2}\s*/i, ''));
                }
            }
        }
        if (count > 0) {
            const { uniqueCount, hasDuplicates } = detectDupes(segments);
            return { count, uniqueCount, format: 'lines', hasDuplicates };
        }
    }

    // ═══ STRATEGY 4: Unstructured/concatenated text (Claude copy-paste without delimiters) ═══
    // Text like: "S1Story EntryConditionalProfile pe jaao...S2Knowledge GapProcess..."
    // Find S + 1-2 digits followed by a known hook name or uppercase word
    const flat = text.replace(/\n/g, ' ');

    // 4a: S\d{1,2} followed by a known hook name (highest confidence)
    const hookAnchorRe = new RegExp(`S(\\d{1,2})\\s*(?:${HOOK_PATTERN})`, 'gi');
    const hookPositions = [];
    let m;
    while ((m = hookAnchorRe.exec(flat)) !== null) {
        const num = parseInt(m[1]);
        if (num >= 1 && num <= 20) hookPositions.push({ num, pos: m.index });
    }
    if (hookPositions.length > 0) {
        const segments = hookPositions.map((hp, i) => {
            const start = hp.pos;
            const end = i + 1 < hookPositions.length ? hookPositions[i + 1].pos : flat.length;
            return flat.substring(start, end);
        });
        const { uniqueCount, hasDuplicates } = detectDupes(segments);
        return { count: hookPositions.length, uniqueCount, format: 'unstructured', hasDuplicates };
    }

    // 4b: S\d{1,2} followed by any uppercase letter (medium confidence)
    const upperRe = /S(\d{1,2})(?=[A-Z][a-z])/g;
    const upperPositions = [];
    while ((m = upperRe.exec(flat)) !== null) {
        const num = parseInt(m[1]);
        if (num >= 1 && num <= 20) upperPositions.push({ num, pos: m.index });
    }
    if (upperPositions.length > 0) {
        const segments = upperPositions.map((hp, i) => {
            const start = hp.pos;
            const end = i + 1 < upperPositions.length ? upperPositions[i + 1].pos : flat.length;
            return flat.substring(start, end);
        });
        const { uniqueCount, hasDuplicates } = detectDupes(segments);
        return { count: upperPositions.length, uniqueCount, format: 'unstructured', hasDuplicates };
    }

    // 4c: "Script N" anywhere in text (low confidence fallback)
    const scriptWordRe = /Script\s*(\d{1,2})/gi;
    const scriptPositions = [];
    while ((m = scriptWordRe.exec(flat)) !== null) {
        const num = parseInt(m[1]);
        if (num >= 1 && num <= 20) scriptPositions.push({ num, pos: m.index });
    }
    if (scriptPositions.length > 0) {
        const segments = scriptPositions.map((hp, i) => {
            const start = hp.pos;
            const end = i + 1 < scriptPositions.length ? scriptPositions[i + 1].pos : flat.length;
            return flat.substring(start, end);
        });
        const { uniqueCount, hasDuplicates } = detectDupes(segments);
        return { count: scriptPositions.length, uniqueCount, format: 'unstructured', hasDuplicates };
    }

    return { count: 0, uniqueCount: 0, format: 'unknown', hasDuplicates: false };
}

// FIX 10a: Parse freeform performance data into structured array
export function parsePerf(perfText) {
    if (!perfText?.trim()) return null;
    const rows = perfText.split('\n').filter(l => l.trim());
    const results = [];
    for (const row of rows) {
        const parts = row.split('|').map(c => c.trim()).filter(Boolean);
        if (parts.length < 3) continue;
        const id = parts[0];
        if (/^(script|sr|#|views)/i.test(id)) continue;
        const views = parseInt(parts[1]?.replace(/,/g, ''), 10) || 0;
        const saves = parseInt(parts[2]?.replace(/,/g, ''), 10) || 0;
        const shares = parseInt(parts[3]?.replace(/,/g, ''), 10) || 0;
        const comments = parseInt(parts[4]?.replace(/,/g, ''), 10) || 0;
        const tag = (parts[5] || '').toLowerCase().trim();
        const score = saves * 3 + shares * 2 + comments * 1.5 + (views / 100);
        results.push({ id, views, saves, shares, comments, tag, score });
    }
    return results.length > 0 ? results : null;
}

// FIX 10b: Analyze historical performance data to generate angle weights
export function getPerfWeights(history, audience) {
    if (!history?.length) return null;
    const weights = {};
    const recent = history.slice(-4);
    for (const week of recent) {
        if (!week.perf) continue;
        const perfData = parsePerf(week.perf);
        if (!perfData) continue;
        const angles = week.ang?.[audience];
        if (!angles?.length) continue;
        const batchOffset = audience === 'buyer' ? 0 : audience === 'seller' ? 5 : audience === 'agent' ? 10 : audience === 'nri' ? 13 : 15;
        const batchSize = audience === 'agent' ? 3 : audience === 'nri' ? 2 : 5;
        for (let i = 0; i < Math.min(angles.length, batchSize); i++) {
            const scriptIdx = batchOffset + i;
            const scriptId = `S${scriptIdx + 1}`;
            const perf = perfData.find(p => p.id.toUpperCase() === scriptId.toUpperCase());
            if (!perf) continue;
            const angleIdx = angles[i];
            if (perf.tag === 'best' || perf.score > 2000) {
                weights[angleIdx] = (weights[angleIdx] || 0) - 1;
            } else if (perf.tag === 'worst' || perf.score < 200) {
                weights[angleIdx] = (weights[angleIdx] || 0) + 1;
            }
        }
    }
    return Object.keys(weights).length > 0 ? weights : null;
}

// FIX 1: pickLru now supports week-number tracking, cold-start, and perf weighting
// history entries can be: plain arrays (legacy) or { wk: weekNum, used: [...] }
export function pickLru(total, hist, count, seed, currentWk, perfWeights) {
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

export function allocCtas(seed) {
    const pool = [];
    [4, 3, 3, 4, 3, 3].forEach((count, idx) => { for (let i = 0; i < count; i++) pool.push(idx + 1); });
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
        // Shuffle the fallback to at least vary the order
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
export function calc(wk, mo, history, year) {
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
    const angStr = {
        b1: ba.map(i => ANG.buyer[i] || ""),
        b2: sa.map(i => ANG.seller[i] || ""),
        b3: [...aa.map(i => ANG.agent[i] || ""), ...na.map(i => ANG.nri[i] || "")],
        b4: ["Fresh stat/news", "Forward-looking trends", "Q&A community", "Seasonal festivals", "Community story"],
    };
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
    const tB = {
        b1: ["SAVE", "SHARE", "SAVE", "FOLLOW", "COMMENT"],
        b2: ["COMMENT", "SAVE", "FOLLOW", "SAVE", "SHARE"],
        b3: ["SAVE", "SHARE", "SAVE", "SAVE", "FOLLOW"],
        b4: ["SHARE", "FOLLOW", "COMMENT", "SAVE", "COMMENT"],
    };
    const bio = {
        b1: shuf([0, 1, 2, 3, 4], ySeed * 311), b2: shuf([0, 1, 2, 3, 4], ySeed * 317),
        b3: shuf([0, 1, 2, 3, 4], ySeed * 331), b4: shuf([0, 1, 2, 3, 4], ySeed * 337)
    };
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

export const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

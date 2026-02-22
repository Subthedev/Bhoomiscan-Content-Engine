// ════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS v2 — Claude-Optimized with XML Tags, Few-Shot, CoT
// Overhauled for maximum script quality from research data
// ════════════════════════════════════════════════════════════════════

import {
    HOOKS, CTAS, BIOS, USPS, USP_B, USP_SEC,
    FMT, NRG, SLOTS, COMP, RULES, QGATE,
    ANG, painEmo,
} from './rotation.js';

// ═══ HELPERS ═══
const hS = (ids) => ids.map((id, i) => `  S${i + 1} = ${HOOKS.find(x => x.id === id)?.name} ("${HOOKS.find(x => x.id === id)?.ex}")`).join("\n");
const cS = (ids) => ids.map((id, i) => `  S${i + 1} = ${CTAS.find(x => x.id === id)?.name} ("${CTAS.find(x => x.id === id)?.ex}")`).join("\n");
const uS = (pri, sec) => pri.map((id, i) => `S${i + 1}=${USPS.find(x => x.id === id)?.name} (2nd: ${USPS.find(x => x.id === sec[i])?.name})`).join(", ");

// ═══ GOLD STANDARD SCRIPTS — Few-Shot Reference Library ═══
const GOLD = {
    buyer: {
        label: "REEL 22 — SCAM ALERT: 18 LAKH DOOB GAYE",
        score: "9.0/10",
        hook: "Story Entry",
        energy: "HIGH",
        words: 133,
        script: `Ek bande ne 18 lakh diye. Plot kharida. Registry hui. Sab set laga.

Chaar mahine baad pata chala, wahi zameen pehle se kisi aur ke naam pe thi. Duplicate registry. Paisa gaya. Zameen gayi. Ab court mein hai bhai. Case chalega 15, shayad 20 saal.

Ab ruko, sabse scary part suno. Yeh rare case nahi hai. India mein 77 lakh log land fraud mein phanse hain. Saat saat lakh.

Toh bach kaise sakte ho? Teen kaam karo.

Pehla. Encumbrance certificate nikaalo. Zameen pe koi loan ya case toh nahi, yeh confirm hoga.

Doosra. Khata number verify karo.

Teesra. Bina documents wali listing pe bharosa mat karo. Photo acchi hai toh kya hua bhai, papers clean hone chahiye.

BhoomiScan pe verified listings hain. Khata number se check hota hai. Link bio mein daal di hai.

Yeh reel family group mein share karo. Zaroorat padegi.`,
        why: "Rapid-fire short sentences, cinematic pacing, stat in Hindi words for shock, numbered solutions, share trigger perfect for scam content."
    },

    seller: {
        label: "REEL 17 — NEGOTIATION MEIN YEH GALTI MAT KARNA",
        score: "9.2/10",
        hook: "Scene Setter",
        energy: "MEDIUM",
        words: 142,
        script: `Ek scene imagine karo. Buyer aaya, tumhari 50 lakh ki property pe 40 lakh offer kiya. Tum gussa ho gaye. Baat khatam kar di. "Itne mein nahi bikegi."

Pata hai sabse badi galti kya hai? Yahi hai.

Dekho guys, low offer ka matlab yeh nahi ki buyer serious nahi hai. Matlab yeh hai ki woh negotiate karna chahta hai. Har buyer karta hai. Tumhara kaam hai baat jaari rakhna.

Counter do. 47 lakh bolo. Reason do. "Bhaiya yahan rates yeh chal rahe hain, title clear hai, road touch hai, borewell hai." Facts ke saath bolo. Woh banda respect karega.

Jo seller apni price justify kar sake facts ke saath, woh banda deal close karta hai. Aur jo offend ho jaaye? Woh mahino wait karta rehta hai. Main bahut aise cases dekh chuka hoon.

Aur ek pro tip sunno. Agar BhoomiScan pe free mein list karoge toh multiple buyers aayenge. Multiple buyers matlab better negotiation position. Simple logic hai na.

Bio mein link daal di hai. Aur comment mein batao, tumhare saath kya negotiation ka scene hua hai. Mujhe padhna achha lagta hai!`,
        why: "CTA invisibility gold standard. Dialogue snippets create mini-scenes. 3-1-3 pacing with short punches. Experience claim adds credibility."
    },

    agent: {
        label: "REEL 13 — TOP AGENTS KA SECRET: SIRF 1 CHEEZ",
        score: "8.7/10",
        hook: "Knowledge Gap",
        energy: "MEDIUM",
        words: 139,
        script: `Pata hai top land agents aur average agents mein fark kya hai? Sirf ek cheez. Guess karo.

Nahi, contacts nahi. Experience bhi nahi.

Speed.

Arre suno, data kehta hai ki agar pehle ek ghante mein buyer ki inquiry ka reply kar do, toh deal close hone ke chances saat guna badh jaate hain. Saat guna bhai!

Aur hum kya karte hain? Do din baad reply karte hain. "Haan ji bataiye." Tab tak buyer paanch aur options dekh chuka hota hai. Game over.

Toh karna kya hai? Bahut simple. Phone ki notifications on rakho. Inquiry aaye toh seedha reply do. Chhota sa message bhi chalega. "Ji available hai, kab baat karein?" Bas. Itna kaafi hai.

Main bhi pehle late reply karta tha. Jab yeh samjha ki speed trust build karti hai aur delay deals maarta hai, tab game change hua.

Aur ek baat, BhoomiScan pe list karoge toh buyers directly WhatsApp pe aate hain. Turant reply de sakte ho. Ekdum smooth. Bio mein link daal di hai.

Follow kar lo, agent tips weekly aayengi. Paisa wasool content hai bhai.`,
        why: "One-word reveal ('Speed.') + false guesses build tension. 'Hum' inclusive language eliminates lecturing. Self-referential learning feels authentic."
    },

    warm: {
        label: "REEL 23 — PAPA KI ZAMEEN BECHNI PADE TOH?",
        score: "8.5/10",
        hook: "Confession",
        energy: "WARM",
        words: 128,
        script: `Sach batau? Yeh topic thoda emotional hai mere liye bhi.

Bahut logon ko ek waqt aata hai jab family ki zameen bechni padti hai. Papa ki ho, daada ki ho. Medical emergency ho, siblings mein batwara ho. Koi choice nahi hoti.

Aur us waqt sabse mushkil kya hota hai bhai? Sahi buyer nahi milta. Jo zameen ki value samjhe. Jo drama na kare. Jo serious ho.

Hum kya karte hain? Broker ko de dete hain. Woh 2 percent le leta hai. 50 lakh ki zameen pe 1 lakh seedha kat jaata hai. Aur buyer bhi wahi milta hai jo broker chahta hai.

Aur haan, agar aisi situation mein ho toh BhoomiScan pe listing daal do. Free hai. Buyers directly WhatsApp pe aayenge. Control tumhare haath mein rahega bhai.

Bio mein link hai, check kar lena.

Yeh reel save karo. Jab zaroorat pade, kaam aayegi. Seriously.`,
        why: "Most emotionally resonant. Vulnerability feels genuine. Conditional CTA ('agar aisi situation mein ho toh') calibrated for sensitive topics."
    },

    strategy: {
        label: "REEL 15 — 1 LISTING SE 3 DEALS NIKALO",
        score: "8.3/10",
        hook: "Story Entry",
        energy: "MEDIUM",
        words: 140,
        script: `Sunno yaar, ek agent ne mujhe apna formula bataya. Ek listing se teen deals nikalta hai. Suna tumne? Teen deals, ek listing se. Suno kaise karta hai.

Woh ek listing BhoomiScan pe daalta hai full details ke saath. Uspe 10 inquiries aati hain.

Unme se 3 buyers us plot ke liye serious hote hain. Ek deal close hoti hai.

Ruko ruko, best part abhi baaki hai.

Baaki 7 buyers ko woh apni doosri listings suggest karta hai. Kyunki un buyers ko zameen toh chahiye thi na. Chahe woh specific plot na lein, koi aur plot le lete hain. Toh unme se ek do aur deals close ho jaati hain.

Matlab kya hua? Ek achi listing poori lead generation machine ban gayi. Wah bhai, ekdum paisa wasool strategy hai yeh.

Lekin ek condition hai. Listing achi honi chahiye. Photos clear hon. Area mentioned ho. Price likha ho. Quality listing daaloge toh quality inquiry aayegi. Simple hai.

Toh BhoomiScan pe apni listings daalo aur har listing ko lead magnet banao. Link bio mein daal di hai.

Follow karo. Aur bhi agent strategies aayengi. Dum hai toh try karo yeh formula.`,
        why: "Third-person story more credible. 'Ruko ruko' energy booster at 50%. Step-by-step formula is concrete. Caveat adds credibility."
    }
};

// ═══ FEW-SHOT SELECTOR — picks the best reference for each batch ═══
function pickGoldRef(audience) {
    const map = {
        buyer: GOLD.buyer,
        seller: GOLD.seller,
        mixed: GOLD.agent,   // Agent batch → agent reference
        trending: GOLD.strategy, // Trending → strategy/data-driven reference
    };
    return map[audience] || GOLD.buyer;
}

// ═══ SEASONAL FACTS — real provisions for seasonal scripts ═══
const SEASONAL_FACTS = {
    'Budget Week': [
        'Finance Bill 2026: TAN requirement eliminated for NRI property purchases (effective Oct 2026)',
        'Section 194H: TDS on broker commission reduced from 5% to 2%, threshold raised to ₹20,000',
        'Pre-construction home-loan interest: ₹2 lakh annual deduction now available under 2026 tax rules',
    ],
};

// FIX 9: NRI evergreen stats supplement for Prompt 3 research block
const NRI_KNOWLEDGE_SUPPLEMENT = `

<!-- FIX 9: NRI knowledge supplement added -->
<nri_knowledge_supplement>
NRI EVERGREEN STATS (use when weekly research lacks NRI-specific findings):
These are verified stats from the Target Audience Guide and Brand Guide. Use them as proof points when weekly research data doesn't cover NRI angles.

1. "82% NRIs report trust deficit as their biggest problem in Indian real estate" — use for S5 (scam prevention)
2. "75% NRIs prefer investing in their hometown" — use as emotional anchor
3. "NRI share of Indian real estate has grown from 7% to 17-20%" — use for market context
4. "FEMA prohibits NRIs from purchasing agricultural/farm land — only residential plots allowed" — use for S4 (repatriation/legal rules)
5. "Supreme Court in 2011 invalidated GPA-based ownership transfers — proper registration required" — use for S5 (scam prevention)
6. Finance Bill 2026: TAN requirement eliminated for resident buyers purchasing from NRIs, effective October 2026 — use for S4

SCAM FRAMEWORK FOR S5: Since no NRI-specific scam case exists in this week's research, use this structure:
- Open with a domestic fraud case (Gurugram ₹500Cr or Pune ₹600Cr) as the shock stat
- Pivot with: "Ab socho, NRI ho toh verify kaise karoge 10,000 km door se?"
- This reframes any domestic fraud as an NRI vulnerability story — the distance makes verification harder, which is the real hook
</nri_knowledge_supplement>`;

// FIX-B: Seller S2 knowledge supplement for property presentation tips (no direct research support)
const SELLER_S2_KNOWLEDGE_SUPPLEMENT = `

<!-- FIX-B: S2 knowledge supplement added -->
<s2_knowledge_supplement>
S2 (Property presentation tips) has no direct research support this week.
Use these verified engagement stats as proof points:
1. "Video content pe 4x zyada inquiry aati hai static photos ke comparison mein" — from Target Audience Guide Section 6
2. "68% faster engagement with drone footage and virtual walkthroughs" — from Target Audience Guide Section 5
3. First impression stat: "Buyer pehle 10 second mein decide kar leta hai" — from Reference Script Reel 12
Frame presentation tips as a SELLER ADVANTAGE, not generic advice.
Connect to BhoomiScan: "BhoomiScan pe listing daalo toh photo clear ho, details likho — quality listing = quality inquiry."
</s2_knowledge_supplement>`;

// FIX-D: Buyer S5 knowledge supplement for agricultural land rules (no agricultural-specific research)
const BUYER_S5_KNOWLEDGE_SUPPLEMENT = `

<!-- FIX-D: S5 knowledge supplement added -->
<s5_knowledge_supplement>
S5 (Agricultural land rules) has no agricultural-specific research this week.
Use these verified rules as content backbone:
1. FEMA prohibits NRIs from purchasing agricultural/farm land — only residential plots allowed (from Brand Guide, Target Audience Guide)
2. Agricultural land conversion to residential (NA order) is required before construction — process varies by state
3. Many buyers don't know the difference between agricultural and residential classification — this is a common trap in Tier 2/3 areas
4. Revenue records (Khasra/Khatauni) show land classification — always verify BEFORE site visit
Hook angle: "Zameen khareedne gaye. Khareed bhi liya. Baad mein pata chala — agricultural land hai, ghar bana hi nahi sakte. Classic trap."
Use "66% civil cases = property disputes" ONLY if no other stat fits.
</s5_knowledge_supplement>`;

// FIX 3A: Buyer S3 knowledge supplement for "Questions to ask seller"
const BUYER_S3_KNOWLEDGE_SUPPLEMENT = `

<!-- FIX 3A: S3 knowledge supplement added -->
<s3_knowledge_supplement>
S3 (Questions to ask seller) has no weekly research support for this practical-advice topic.
Use these verified conversation starters as the script's backbone:
1. "Zameen tumhare naam pe hai ya family ke?" — Ownership verification (from Brand Guide: title deed check)
2. "Encumbrance certificate dikha sakte ho?" — Loan/case check (from Target Audience Guide: document chaos pain point)
3. "Boundary pe koi dispute toh nahi?" — Boundary confirmation (from Reference Script Reel 12: boundary dispute is most common deal-breaker)
4. "Commission kitna lagega?" — Commission transparency (from pain_mapping: Commission Drain as secondary pain for S3)
5. "Photos mein jo dikha woh ground pe bhi wahi hai?" — Photo vs reality check (from Target Audience Guide: buyer objection "Photos toh acchi hain, lekin ground pe kya hoga?")
Frame as: "Yeh paanch sawaal seller se zaroor poochho BEFORE giving advance."
Connect to BhoomiScan: "BhoomiScan pe verified listings mein yeh sab pehle se check hota hai."
</s3_knowledge_supplement>`;

// FIX 3B: Seller S3 knowledge supplement for "Handling advance payments"
const SELLER_S3_KNOWLEDGE_SUPPLEMENT = `

<!-- FIX 3B: S3 knowledge supplement added -->
<s3_knowledge_supplement>
S3 (Handling advance payments) is a Myth Buster format script. The "myth" to bust:
MYTH: "Advance le liya matlab deal pakki."
REALITY: "Bina sale agreement ke advance = zero legal protection."
Use these verified content points:
1. Supreme Court 2011: GPA-based ownership transfers invalid — proper registration required (from Target Audience Guide, NRI objection #18)
2. Sale agreement defines: price, payment timeline, possession date, penalty for back-out (from Reference Script Reel 18)
3. Advance without agreement = if buyer backs out, seller has NO legal claim. And vice versa (from Reference Script Reel 18: "Bilkul kuch nahi")
4. Analogy to use: "Bina sale agreement ke deal karna = bina helmet ke bike chalana" (proven analogy from Reel 18)
Hook bridge: The Common Mistake hook ("Ek galti jo 90% sellers karte hain") feeds directly into the myth-bust.
Disclaimer needed: "Yeh general information hai. Apne advocate se zaroor baat karo." (from Brand Guide Section 10)
</s3_knowledge_supplement>`;

// FIX 3C: Agent S3 knowledge supplement for "WhatsApp marketing for agents"
const AGENT_S3_KNOWLEDGE_SUPPLEMENT = `

<!-- FIX 3C: S3 knowledge supplement added -->
<s3_knowledge_supplement>
S3 (WhatsApp marketing for agents) has weak weekly research. The Ama Sathi finding is a government service, NOT agent marketing — do not reference it.
Use these verified WhatsApp marketing tactics as content backbone:
1. WhatsApp Status updates: Post property photos daily to status — 2 minute kaam, all contacts see it (general knowledge, widely practiced by Indian agents)
2. Broadcast lists: Create buyer segment lists (budget-wise), send new listings to matching segments — targeted, not spam (general knowledge)
3. "BhoomiScan pe listing daalo, WhatsApp pe link share karo" — listing link becomes the agent's professional showcase (from Brand Guide: buyers connect via WhatsApp)
4. "90% buyers online search se shuru karte hain" — validates why WhatsApp alone isn't enough, need an online listing too (from Target Audience Guide, Seller objection #8)
DO NOT reference: Ama Sathi bot, government WhatsApp services, or any chatbot functionality.
Frame as: "WhatsApp toh sab agents use karte hain. Lekin SMART agents yeh teen cheezein alag karte hain."
</s3_knowledge_supplement>`;

// ═══ MASTER PROMPT BUILDER v2 — Claude-Optimized XML Architecture ═══
// hookHintsXml (16th param): optional, injected inside <variation_controls> after </hooks> — used by mkP3 for Fix 11
export function mkP(num, title, audience, cx, r, res, assignments, formats, energy, selfRef, uspPri, uspSec, audCal, compAnglesXml, abTestXml, hookHintsXml, batchAwarenessXml) {
    const se = r.se, bk = `b${num}`;
    const gold = pickGoldRef(audience);

    // Build research block — keep flat text from research processor but wrap in XML
    const researchBlock = res
        ? `<research_data>
${res}
</research_data>`
        : `<research_data status="none">
No fresh research this week. MANDATORY: Pull 2-3 hard stats from the Target Audience Guide stat library and weave them into scripts as proof points. At least 1 script must open with a stat-based hook using library data. Frame stats with urgency as if they are breaking news.
</research_data>`;

    return `<system>
<role>
You are BhoomiScan's expert Hinglish scriptwriter — a veteran content creator who writes 130-145 word spoken scripts for Instagram/Facebook reels delivered by an AI avatar.

YOUR VOICE PERSONAS:
- Buyer scripts → "Protective Big Brother" — calm, watchful, educational
- Seller scripts → "Strategic Advisor" — direct, empowering, no-nonsense
- Agent scripts → "Peer Mentor" — competitive, insider language, FOMO
- NRI scripts → "Trusted Advisor from Home" — warm, reassuring, detail-oriented
- Trending scripts → "Street-Smart Friend" — punchy, data-driven, conversation-starter

STYLE DNA:
- Chai tapri Hinglish: natural code-switching, 2-4 "bhai" per script, ONLY "tum/tumhare"
- Short sentences that punch. Then longer ones that explain. Then short again. (3-1-3 rhythm)
- Dialogue snippets in quotes to create mini-scenes
- "Hum" inclusive language to avoid lecturing
- Energy boosters at 40-60% mark ("Ruko ruko", "Ab suno best part", "Yeh mat karo")
- Self-referential moments ("Main bhi pehle...", "Mere ek client ne...") for authenticity
- CTA as friendly tip, NEVER as advertisement pitch
</role>

<brand_rules>
${RULES}
</brand_rules>

<!-- FIX 1: Research preprocessing added -->
<research_preprocessing>
BEFORE using any research finding in a script, mentally preprocess it:
1. EXTRACT only: the core stat (number + unit), the location, the date, and a one-line plain-language summary
2. IGNORE: URLs, filenames, UUIDs, formatting artifacts, table headers, broken text fragments
3. VERIFY: If a stat appears garbled or contradictory (e.g., "500\\ncrore" or "43 l" without context), reconstruct the most logical interpretation OR skip it entirely
4. NEVER paste raw research fragments into script text. Always convert to natural spoken Hinglish first.
5. If a finding is marked usable="false", do NOT use it in any script — treat it as context-only background
6. LINE-BREAK NUMBERS: If a stat contains a line break ("\\n") or appears split across lines (e.g., "500\\ncrore" or "₹ 43.7\\nlakh"), reconstruct as a single number: "₹500 crore", "₹43.7 lakh". If reconstruction is ambiguous, skip the stat.
7. ORPHAN FRAGMENTS: If a stat appears without enough context to understand its meaning (e.g., "rs. 8" with no unit, or "13 k" with no subject), DO NOT use it. These are extraction artifacts, not real data.
8. DUPLICATE FINDINGS: The same event may appear in both <key_stats> and <story_hooks> with slightly different formatting. Use the HIGHEST-SCORED version (check the score="" attribute). If scores are equal, prefer the version with the most specific details (names, dates, amounts).
</research_preprocessing>

<!-- PRIORITY 1 FIX: Hinglish Naturalness Engine -->
<hinglish_naturalness_engine>
<purpose>
This block is the FINAL FILTER before any script is output. After writing a script using the Engineering Manual's rules, run every sentence through this engine. If any sentence triggers a BAD pattern, rewrite it using the GOOD alternative. This is not optional — it is the difference between "AI content" and "production-ready content."
</purpose>

<negative_examples label="NEVER WRITE THESE — common Opus Hinglish failures">
PATTERN 1: OVER-FORMAL HINDI VERBS
  BAD:  "Yeh platform aapko suvidha pradaan karta hai"
  BAD:  "Isse aapko sahayata milegi"
  BAD:  "Yeh jaankari aapke liye upyogi hogi"
  GOOD: "Yeh platform tumhe direct connect deta hai"
  GOOD: "Isse tumhe fayda hoga"
  GOOD: "Yeh tip kaam aayegi"
  WHY: "pradaan karta", "sahayata", "upyogi" are textbook Hindi. Real Hinglish speakers say "deta hai", "help milegi", "kaam aayegi."

PATTERN 2: ENGLISH SYNTAX WITH HINDI WORDS
  BAD:  "Tumhe chahiye ki tum pehle documents check karo"
  BAD:  "Yeh zaroori hai ki tum listing daalo"
  BAD:  "Main sochta hoon ki yeh ek accha idea hai"
  GOOD: "Pehle documents check karo"
  GOOD: "Listing daal do"
  GOOD: "Mujhe lagta hai accha idea hai"
  WHY: "Tumhe chahiye ki" / "Yeh zaroori hai ki" is English subordinate clause structure ("You need to" / "It is necessary that") force-fitted into Hindi. Real speakers use direct imperatives.

PATTERN 3: ROBOTIC TRANSITIONS
  BAD:  "Ab hum doosre point pe aate hain"
  BAD:  "Iske alawa, ek aur cheez hai"
  BAD:  "Chaliye ab dekhte hain ki..."
  GOOD: "Aur suno"
  GOOD: "Ek aur baat"
  GOOD: "Ab yeh dekho"
  WHY: "Ab hum aate hain", "Iske alawa", "Chaliye" are presentation language, not conversation language. A friend at chai doesn't say "Chaliye ab dekhte hain."

PATTERN 4: REDUNDANT POLITENESS MARKERS
  BAD:  "Toh dosto, aaj main aapko batata hoon"
  BAD:  "Aaj ki video mein hum jaanenge"
  BAD:  "Toh aaj ka topic hai..."
  GOOD: "Suno, aaj ek baat batata hoon"
  GOOD: Just start with the hook — no preamble needed
  GOOD: Hook directly: "Pata hai..." / "Ek number sunno" / "Sach batau?"
  WHY: YouTube-style intros ("Dosto aaj...") are the #1 signal of AI-generated Indian content. BhoomiScan scripts start mid-conversation, as if the viewer walked into an ongoing discussion.

PATTERN 5: UNNATURALLY LONG HINDI COMPOUNDS
  BAD:  "Zameen khareedne ki prakriya mein bahut saari kathinaiyaan aati hain"
  BAD:  "Issse sambandhit jaankari praapt karne ke liye"
  GOOD: "Zameen khareedne mein bahut gadbad hoti hai"
  GOOD: "Iske baare mein jaanne ke liye"
  WHY: Sanskrit-derived compounds ("prakriya", "kathinaiyaan", "sambandhit", "praapt") are written Hindi, not spoken. Spoken Hinglish prefers shorter, Urdu-influenced alternatives.

PATTERN 6: MISSING FILLER WORDS (makes speech feel robotic)
  BAD:  "Pehla kaam. Documents check karo. Doosra kaam. Location verify karo."
  GOOD: "Pehla kaam. Documents check karo bhai. Doosra. Location verify karo."
  GOOD: "Pehla. Arre documents check karo. Doosra. Location toh verify karo."
  WHY: Real speech has "arre", "bhai", "toh", "na" sprinkled as filler — not in every sentence, but their ABSENCE across 3+ consecutive sentences sounds mechanical. Add 1 filler per 3-4 sentences.

PATTERN 7: EMOJI-STYLE ENTHUSIASM IN TEXT
  BAD:  "Yeh bohot hi zyada amazing hai!"
  BAD:  "Bilkul FREE hai! Zero cost! Wow!"
  GOOD: "Yeh ekdum solid hai bhai"
  GOOD: "Free hai. Bilkul free. Ek rupay nahi."
  WHY: Stacked exclamation energy and superlatives ("bohot hi zyada amazing") read like ad copy. The reference scripts use calm confidence, not hype.
</negative_examples>

<code_switching_grammar label="WHEN to switch between Hindi and English mid-sentence">
RULE: Switch at PHRASE BOUNDARIES, never mid-phrase.
  GOOD: "BhoomiScan pe [listing daalo]" — English noun, then Hindi verb phrase
  BAD:  "BhoomiScan pe list karna karo" — broken verb construction

RULE: Hindi VERBS govern English NOUNS (not the reverse).
  GOOD: "Documents check karo" — Hindi verb "karo" governs English noun "documents"
  GOOD: "Deal close hone ke chances" — Hindi grammar wraps English nouns
  BAD:  "Karo check the documents" — English word order with Hindi verb prefix

RULE: EMOTIONAL PEAKS always in Hindi. DATA DELIVERY can be English.
  GOOD: "Paisa gaya. Zameen gayi." (emotion = Hindi)
  GOOD: "500 crore ka fraud" (data = English numbers + Hindi context)
  BAD:  "Money gone. Land gone." (emotion in English sounds detached)
  BAD:  "Paanch sau crore rupay ka dhokha" (fully Hindi numbers for large data = unnatural for Hinglish speakers)

RULE: Sentence-FINAL position prefers Hindi.
  GOOD: "Simple hai." / "Pakka." / "Seedhi baat hai bhai."
  BAD:  "That's simple." / "For sure." / "Straight talk."
  WHY: Hindi sentence-enders create warmth. English sentence-enders create distance.
</code_switching_grammar>

<per_audience_phrase_bank label="REAL phrases extracted from gold-standard reference scripts (Reels 12-23)">
BUYER SCRIPTS — Protective Big Brother voice:
  Warnings: "Yeh galti mat karna" | "Red flag hai yeh" | "Darr mat, samajh lo"
  Reassurance: "Simple hai, step by step batata hoon" | "Pehle documents, phir deal"
  Transitions: "Ab ruko, sabse scary part suno" | "Toh bach kaise sakte ho?"
  Closers: "Yeh reel family group mein share karo" | "Save karo, zaroorat padegi"

SELLER SCRIPTS — Strategic Advisor voice:
  Empowerment: "Tumhari zameen tumhari marzi" | "Rate tum decide karo"
  Commission pain: "Woh 50 hazaar jo broker le jaata" | "Commission mein itna cut jaata hai"
  Action: "Free mein list karo" | "2 minute mein listing" | "Waiting khatam, selling shuru"
  Inclusive: "Hum kya karte hain? Broker ko de dete hain." | "Sab kuch theek lagta hai, jab tak theek hai"

AGENT SCRIPTS — Peer Mentor voice:
  FOMO: "Tera competition already digital ho gaya" | "Game over" | "Woh zamana gaya"
  Insider: "Leads chahiye toh game change karo" | "Smart agents yeh kar rahe hain"
  Challenge: "Dum hai toh try karo" | "Risk kya hai? Zero."
  Data-flex: "Data kehta hai ki..." | "Saat guna bhai!"

NRI SCRIPTS — Trusted Advisor voice:
  Distance bridge: "Bahar baith ke bhi..." | "10,000 km door se verify kaise karoge?"
  Emotional anchor: "Apne gaon mein zameen" | "Family ki zameen"
  Legal clarity: "FEMA kehta hai" | "Proper registration zaroori hai"
  Trust: "Verified badge matlab bharosa" | "Khata number se check hota hai"

TRENDING SCRIPTS — Street-Smart Friend voice:
  News-opener: "Yeh number suno" | "Ek khabar aai hai" | "Data aa gaya hai"
  Dot-connector: "Iska matlab tumhare liye kya hai?" | "Ab socho"
  Opinion-invite: "Tumhe kya lagta hai?" | "Comment karo bhai"
  Broader "hum": "Hum sab ke liye" | "Har kisi ko affect karega"

USE: When writing a script, pull 3-5 phrases from the matching audience bank. These are SEEDS — adapt them to the script's specific topic, don't paste them verbatim. They ensure the vocabulary REGISTER matches the persona.
</per_audience_phrase_bank>

<hinglish_final_check label="Run this AFTER writing each script, BEFORE counting words">
Read the script aloud mentally. For EACH sentence, ask:
1. Would a 30-year-old Hinglish-speaking man in Bhubaneswar actually say this to his friend?
2. Are there any Sanskrit-derived words that should be Urdu/colloquial alternatives?
3. Is there a sentence with 0 Hindi filler words that has 3+ English words in sequence? (If yes, break the English run with a Hindi connector: "toh", "matlab", "na")
4. Does any sentence start with "Yeh zaroori hai ki" or "Tumhe chahiye ki"? (If yes, rewrite as direct imperative)
5. Is the sentence-final word Hindi? (Prefer Hindi endings for warmth)
6. Are there 4+ consecutive sentences without "bhai", "arre", "toh", "na", "yaar"? (If yes, sprinkle 1 filler)
If ANY sentence fails checks 1-6, rewrite it BEFORE proceeding to word count.
</hinglish_final_check>
</hinglish_naturalness_engine>

<!-- FIX-C: Cross-prompt stat deduplication directive -->
<cross_prompt_deduplication>
STAT USAGE PRIORITY: When multiple stats are available for a hook or proof point, prefer stats that are UNIQUE to this prompt's audience.
AVOID these overused stats unless they are the ONLY option for the assigned topic:
- Gurugram ₹500 crore fraud (used in Buyer S2, Trending S1)
- Pune ₹600 crore fraud (used in Buyer S2 alt)
- Section 194H TDS reduction (used in Seller S5, Agent S2)
- "66% civil cases = property disputes" (evergreen, limit to 1 use per 20-script batch)
If a stat has been assigned as PRIMARY in another prompt's script, use it only as a secondary mention (1 sentence max), not as the hook.
</cross_prompt_deduplication>
</system>

<task>${title}</task>

<context>
<week>Week ${cx.wk} of ${cx.mn}, ${cx.yr}</week>
<pattern>${r.pat}</pattern>
<season>${cx.se} | Hook: "${se.h}"${se.mi ? ` | Micro: ${se.mi}` : ""}</season>
<festivals>${se.f.join(", ")}</festivals>
<pain_cycle intensity="${r.ci}/4">${r.pain.l}</pain_cycle>
${compAnglesXml}
<seasonal_note>If no script is explicitly tagged SEASONAL, weave "${se.h}" or ${se.f.join("/")} reference naturally into the most topically fitting script as a secondary hook or engage element.</seasonal_note>
</context>

${researchBlock}

<assignments>
<script_slots>
${assignments}
</script_slots>

<formats>${formats.map((f, i) => `S${i + 1}:${f}`).join(" | ")}</formats>
${abTestXml || `<!-- FIX 3: AB test evaluation criteria added -->
<ab_test>
Generate 1 alt hook for Script 1 using a different archetype.
EVALUATION CONTEXT: The alt hook will be tested against the primary hook for scroll-stop rate (first 1.5 seconds). The winning hook is the one more likely to make a viewer STOP scrolling and watch the full reel.
ALT HOOK CRITERIA:
- Must use a DIFFERENT archetype from the primary (specified in variation_controls)
- Must still fit the script's assigned topic, energy level, and audience
- Must be swappable without rewriting the rest of the script (the engage section and CTA remain the same)
OUTPUT: Present the alt hook as a single line labeled "ALT HOOK S1:" after the main script output, with the archetype name in parentheses.
</ab_test>`}
</assignments>

<!-- FIX 2: Format definitions added (compressed v2) -->
<format_definitions>
FORMAT STRUCTURES (1 line = structure, 2nd line = key rule):

TALKING HEAD: Direct monologue → 2-4 points with conversational breaks. Most flexible, use when no special structure needed.

MYTH BUSTER: State belief → "Lekin sach yeh hai..." at 40-50% mark → correct info + action. Bust moment must LAND, not drift.

STORY-BASED: Character + situation (max 40% of script) → lesson → viewer application. Story is the vehicle, lesson is the payload.

NUMBER SHOCK: Single stat → let it breathe (short sentence + pause) → "Ruko, iska matlab samjho" → implication → action. Hindi words for emphasis under 100 ("saat guna"), numerals for data ("500 crore").

RAPID FIRE: Setup frame ("Teen cheezein yaad rakho") → 3-5 points at 1-2 sentences each → punchy summary → CTA. NO energy dips allowed.

Q&A RESPONSE: "Bahut log poochte hain..." → 2-3 questions answered briefly → invite more. Warmer tone than other formats.

PREDICTION/FUTURE: "Aage kya hone wala hai?" → 2-3 predictions with data → what to do NOW. Never guarantee — use "data kehta hai" / "trend yeh hai."
</format_definitions>

<variation_controls>
<hooks>
${hS(r.hB[bk])}
</hooks>
${hookHintsXml || ''}
<ctas>
${cS(r.cB[bk])}
</ctas>
<bios>
${r.bio[bk].map((bi, i) => `  S${i + 1} = "${BIOS[bi]}"`).join("\n")}
</bios>
<triggers>${r.tB[bk].map((t, i) => `S${i + 1}=${t}`).join(", ")}</triggers>
<energy>${energy.map((e, i) => `S${i + 1}=${e}`).join(", ")}</energy>
<self_reference>${selfRef}</self_reference>
<usps>${uS(uspPri, uspSec)}</usps>
<usp_rule>Each script: 1 primary USP woven into content + 1 secondary USP mentioned naturally in CTA. Max 2 USPs per script.</usp_rule>

<dynamic_cta_system>
<purpose>
The pre-assigned CTA patterns above are DEFAULTS. In most scripts, follow them exactly. However, if the script's emotional endpoint CONTRADICTS the assigned CTA pattern, you may override it using the rules below. This prevents forced, unnatural CTAs that break the script's emotional flow.
</purpose>

<override_rules>
CONDITION: Override is allowed ONLY when the script's FINAL emotional state before CTA mismatches the assigned pattern's energy.

EMOTIONAL ENDPOINT → BEST CTA MATCH:
  FEAR/ANXIETY endpoint → Platform-as-Solution ("Toh [CTA]") or Reassurance Bridge ("Aur dekho, darne ki zaroorat nahi...")
    WHY: Fearful viewer needs a solution or comfort, not a casual aside
  EMPOWERMENT endpoint → Conditional ("Agar [goal] toh [CTA]") or Process Integration ("[steps]...aur [CTA]")
    WHY: Empowered viewer is ready to act, give them a clear next step
  CURIOSITY endpoint → Logical Extension ("Aur ek baat,") or Casual Aside ("Aur haan,")
    WHY: Curious viewer wants more info, CTA feels like bonus knowledge
  WARMTH/COMMUNITY endpoint → Casual Aside ("Aur haan,") or Reassurance Bridge
    WHY: Warm emotional state needs gentle CTA, not action-oriented push
  URGENCY/FOMO endpoint → Conditional ("Agar...toh") or Platform-as-Solution ("Toh [CTA]")
    WHY: Urgent viewer is primed to act NOW, give them the clearest path

OVERRIDE PROTOCOL:
1. Write the script body first (hook through summary punch)
2. Identify the emotional endpoint (what is the viewer feeling RIGHT NOW?)
3. Check: Does the assigned CTA pattern match the emotional endpoint above?
4. If YES → Use assigned pattern. No override needed.
5. If NO → Select the best-matching pattern from the emotional endpoint list above
6. Log the override in the variation log as: "[assigned] → [used] (override: [reason])"

CONSTRAINT: Maximum 2 CTA overrides per 5-script batch. If 3+ scripts need overrides, revisit the script bodies — the emotional arcs may be misaligned with the assigned energy levels.

ANTI-COLLISION: If an override would create a duplicate CTA pattern in the batch (two scripts using the same pattern), keep the assigned CTA and instead adjust the script's final 1-2 sentences before the CTA to create a better bridge. This is called a "bridge fix" — soften or redirect the emotional endpoint to match the assigned pattern.
</override_rules>

<cta_bridge_phrases label="Transition sentences that connect any emotional state to any CTA pattern">
  FEAR → Casual Aside bridge: "Lekin ek acchi baat bhi hai. [Then: Aur haan, BhoomiScan pe...]"
  FEAR → Logical Extension bridge: "Toh solution kya hai? [Then: Aur ek baat, BhoomiScan pe...]"
  EMPOWERMENT → Reassurance bridge: "Aur darne ki zaroorat nahi. [Then: BhoomiScan pe...]"
  WARMTH → Conditional bridge: "Toh agar tumhe bhi yeh karna hai... [Then: BhoomiScan pe...]"
  URGENCY → Casual Aside bridge: "Aur ruko, ek last baat. [Then: Aur haan, BhoomiScan pe...]"
  USE: Pick the bridge phrase that smooths the transition. Add it as 1 sentence between body and CTA.
</cta_bridge_phrases>
</dynamic_cta_system>
</variation_controls>

<audience_profile>
${audCal}
</audience_profile>

<thinking_process>
For EACH of the 5 scripts, follow these steps IN ORDER:

1. READ the research data above. Find the finding that best matches this script's assigned angle.
2. EXTRACT the most shocking stat, story element, or specific number from that finding.
3. CRAFT the hook using ONLY the ASSIGNED hook archetype for this script — check the hooks section.
4. BUILD the engage section around the assigned pain point, weaving the stat naturally as proof.
5. DELIVER the CTA using the ASSIGNED CTA pattern — make it feel like a friend's suggestion.
6. CHECK: Does this sound like something you'd overhear at a chai stall? If it sounds like a blog post, rewrite it.
7. COUNT words using this EXACT methodology:
   COUNTING RULES:
   a. Each space-separated token = 1 word. "Seedhi baat hai bhai" = 4 words.
   b. Hyphenated terms = 1 word. "buyer-seller" = 1 word.
   c. Numbers = 1 word each. "₹500" = 1 word. "50 lakh" = 2 words. "1,00,000" = 1 word.
   d. Quoted dialogue words count: "Haan ji bataiye" inside quotes = 3 words.
   e. "BhoomiScan" = 1 word. "WhatsApp" = 1 word. "Instagram" = 1 word.
   f. Contractions count as written: "nahi" = 1 word, "kisi" = 1 word.
   g. Single-word interjections: "bhai" = 1, "haan" = 1, "arre" = 1, "nahi" = 1.

   COUNTING PROCESS:
   Step A: Count each paragraph separately. Write down the count.
   Step B: Sum all paragraph counts.
   Step C: If total is 146+: cut 1 filler phrase first ("basically", "actually", "toh dekho"), then shorten 1 example, then remove 1 conversational aside. Recount.
   Step D: If total is 125-129: add 1 dialogue snippet ("Ji available hai"), or 1 detail to a tip, or 1 "main bhi" aside. Recount.
   Step E: If total is below 125: the script is too thin. Add 1 more point or expand an example. Recount.
   Step F: FINAL COUNT must be 130-145. Output the count after each script.
8. VERIFY the 3-1-3 rhythm: 2-3 medium sentences, then 1 short punch, then 2-3 medium again.
</thinking_process>

<reference_script label="${gold.label}" score="${gold.score}" hook="${gold.hook}" energy="${gold.energy}" words="${gold.words}">
${gold.script}
</reference_script>
<reference_analysis>
Why this is gold standard: ${gold.why}
Study this script's pacing, dialogue usage, CTA invisibility, and emotional arc. Your scripts should match this quality level.
</reference_analysis>

<output_format>
For EACH of the 5 scripts, output:
1. HeyGen-ready script (pure spoken words — no brackets, no stage directions, no emojis)
2. English caption (1-2 SEO sentences) + max 8 hashtags with #BhoomiScan
3. Word count must be 130-145 — COUNT CAREFULLY
4. Structure: Hook → Engage → CTA for Instagram/Facebook reels
<!-- FIX 10: Word count hard gate added -->
WORD COUNT IS A HARD GATE: If any script is outside 130-145 words, rewrite it before outputting. Do not output a script that violates this range.

<!-- FIX-L: Caption variation guidance (upgraded v2) -->
<caption_variation>
CAPTION ENGINEERING RULES:
1. DIFFERENTIATION: No two captions in a batch start with the same word
2. FORMAT ROTATION across 5 scripts:
   - 2 captions as QUESTIONS ("Did you know 90% of brokers aren't registered?")
   - 2 captions as STATEMENTS ("This single document saves lakhs in legal fees.")
   - 1 caption as IMPERATIVE ("Stop giving advance without this agreement.")
3. TENSION RULE: Caption must create a DIFFERENT curiosity than the hook. If hook is a number shock, caption should tease the SOLUTION, not repeat the number. If hook is a story, caption should tease the LESSON, not retell the story.
   GOOD hook: "Ek number sunno..." → GOOD caption: "This one check before buying land could save you 20 years in court."
   BAD hook: "Ek number sunno..." → BAD caption: "Did you know 66% of cases are property disputes?"
4. SEO NUMBERS: At least 2 captions per batch must include a specific number from the script (₹, %, years, etc.)
5. NEVER use: "Watch till end" / "Must watch" / "You won't believe" — algorithm-penalized clickbait
6. MAX LENGTH: 2 sentences. Punchy. Every word earns its place.
</caption_variation>
</output_format>

<variation_log_format>
After all 5 scripts, output this EXACTLY as a plain-text code block (triple backticks), NOT as a markdown table:
\`\`\`
| Script | Hook | CTA | CTA Override? | Bio | Trigger | Energy | USP | Pain | Angle | Format |
| S1 | [hook] | [cta] | [override] | [bio] | [trigger] | [energy] | [usp] | [pain] | [angle] | [format] |
...all 5 scripts...
\`\`\`
IMPORTANT: Use pipe-delimited plain text, not a rendered table.
For CTA Override column: Write "none" if assigned CTA was used. If overridden, write "[assigned] → [used] ([reason])". Example: "Conditional → Platform-as-Solution (fear endpoint needed solution)"
</variation_log_format>

${batchAwarenessXml || ''}

<quality_gate>
${QGATE}
</quality_gate>`;
}

// ═══ BATCH AWARENESS — Per-prompt 20-script collision prevention ═══

const BATCH_AWARENESS_P1 = `
<batch_awareness label="20-script weekly batch context">
This prompt generates scripts S1-S5 of a 20-script weekly batch. The other 15 scripts use these hook archetypes:
  P2 (Seller): Story Entry, Social Proof, Common Mistake, Scene Setter, Rhetorical Challenge
  P3 (Agent+NRI): Knowledge Gap, Audience Question, Single Number, Bold Claim, Future Frame
  P4 (Trending): Rhetorical Challenge, Future Frame, Story Entry, Scene Setter, Audience Question

YOUR hooks: Single Number, Bold Claim, Common Mistake, Confession, Future Frame
COLLISION POINTS: Your S1 (Single Number) shares archetype with P3-S3. Your S5 (Future Frame) shares with P3-S5 and P4-S2.

MITIGATION: For collision-point scripts, make the hook's CONTENT maximally different from the other prompt's version:
  - S1: If P3-S3 uses a stat-based Single Number, make yours a NON-stat revelation ("Ek number sunno... yeh number tumhari zameen bach sakti hai")
  - S5: Use a QUESTION-based future frame ("Aaj se 5 saal baad zameen ka scene kya hoga?") since P4-S2 likely uses a PREDICTION-based future frame ("Aaj future ki baat...")
No need to rewrite the hook archetype — just ensure the OPENING WORDS and CONTENT ANGLE differ.
</batch_awareness>`;

const BATCH_AWARENESS_P2 = `
<batch_awareness label="20-script weekly batch context">
This prompt generates scripts S6-S10 of a 20-script weekly batch. The other 15 scripts use these hook archetypes:
  P1 (Buyer): Single Number, Bold Claim, Common Mistake, Confession, Future Frame
  P3 (Agent+NRI): Knowledge Gap, Audience Question, Single Number, Bold Claim, Future Frame
  P4 (Trending): Rhetorical Challenge, Future Frame, Story Entry, Scene Setter, Audience Question

YOUR hooks: Story Entry, Social Proof, Common Mistake, Scene Setter, Rhetorical Challenge
COLLISION POINTS: Your S1 (Story Entry) shares with P4-S3. Your S3 (Common Mistake) shares with P1-S3. Your S4 (Scene Setter) shares with P4-S4.

MITIGATION: For collision-point scripts, make the OPENING WORDS and CONTENT ANGLE distinct:
  - S1: Use a SELLER story ("Ek seller ne mujhe..."), P4-S3 will use a Q&A viewer story
  - S3: Use a SELLER-specific mistake (advance payments), P1-S3 uses a BUYER-specific mistake (questions to ask)
  - S4: Use a SELLER scenario (property invisible), P4-S4 uses a BUDGET scenario
Audience difference itself creates natural separation — no further action needed.
</batch_awareness>`;

const BATCH_AWARENESS_P3 = `
<batch_awareness label="20-script weekly batch context">
This prompt generates scripts S11-S15 of a 20-script weekly batch. The other 15 scripts use these hook archetypes:
  P1 (Buyer): Single Number, Bold Claim, Common Mistake, Confession, Future Frame
  P2 (Seller): Story Entry, Social Proof, Common Mistake, Scene Setter, Rhetorical Challenge
  P4 (Trending): Rhetorical Challenge, Future Frame, Story Entry, Scene Setter, Audience Question

YOUR hooks: Knowledge Gap, Audience Question, Single Number, Bold Claim, Future Frame
COLLISION POINTS: Your S3 (Single Number) shares with P1-S1. Your S4 (Bold Claim) shares with P1-S2. Your S5 (Future Frame) shares with P1-S5 and P4-S2.

MITIGATION:
  - S3: Use a PROCESS number ("Ek number sunno — itne minute mein listing ban jaati hai"), P1-S1 uses a WARNING number
  - S4: Use an EXPECTATION-BUST bold claim (repatriation gap), P1-S2 uses a DANGER bold claim (red flags)
  - S5: Use an EMOTIONAL future frame for NRI ("Aaj se 10 saal baad tumhara hometown kaise dikhega?"), P1/P4 use DATA-driven future frames
NRI vs Buyer/All audience difference creates strong natural separation.
</batch_awareness>`;

const BATCH_AWARENESS_P4 = `
<batch_awareness label="20-script weekly batch context">
This prompt generates scripts S16-S20 of a 20-script weekly batch. The other 15 scripts use these hook archetypes:
  P1 (Buyer): Single Number, Bold Claim, Common Mistake, Confession, Future Frame
  P2 (Seller): Story Entry, Social Proof, Common Mistake, Scene Setter, Rhetorical Challenge
  P3 (Agent+NRI): Knowledge Gap, Audience Question, Single Number, Bold Claim, Future Frame

YOUR hooks: Rhetorical Challenge, Future Frame, Story Entry, Scene Setter, Audience Question
COLLISION POINTS: Your S2 (Future Frame) shares with P1-S5 and P3-S5. Your S3 (Story Entry) shares with P2-S1. Your S4 (Scene Setter) shares with P2-S4.

MITIGATION:
  - S2: Use a TREND-PREDICTION future frame ("Data kehta hai 2027 tak..."), P1/P3 use personal/emotional future frames
  - S3: Use a VIEWER story ("Ek viewer ne DM mein poochha..."), P2-S1 uses a SELLER/agent story
  - S4: Use a BUDGET scenario ("Budget aaya, tumhe laga zameen ke liye kuch nahi..."), P2-S4 uses a VISIBILITY scenario
The Trending persona's broader "hum sab" voice naturally differentiates from persona-specific scripts.
</batch_awareness>`;

// ═══ BATCH PROMPT BUILDERS ═══

export function mkP1(cx, r, res) {
    const a = r.ba.map(i => ANG.buyer[i]);
    // FIX 4: Research gap handling for S1 when assigned "Flood zone check guide"
    const s1GapNote = (a[0] || '').toLowerCase().includes('flood zone')
        ? `\n<!-- FIX 4: S1 research gap handling added -->\n<research_gap_handling>\nS1 NOTE: The research data does not contain flood-zone-specific stats. For this script:\n- Use the general buyer insight that 84% of deals close offline due to trust deficit (from Audience Guide Section 6) as the proof-point bridge: flood zone risk is one MORE reason to verify before buying\n- Reference Google Maps flood zone check as a practical zero-cost step (this is general knowledge, not a research stat — frame it as a tip, not a cited finding)\n- Do NOT fabricate flood-zone statistics. If a stat is needed for the hook, use the "66% civil cases = property disputes" stat and pivot to flood zone as one of the underappreciated dispute causes\n<!-- OPTION B FALLBACK: If flood zone content feels too thin even with this guidance, swap S1 topic to "Encumbrance certificate guide" which has direct research support from fraud findings (Gurugram duplicate registry case, Pune ULC forgery case) -->\n</research_gap_handling>`
        : '';
    // FIX 3A: Append buyer S3 knowledge supplement when S3 is "Questions to ask seller"
    const resWithBuyerS3 = ((a[2] || '').toLowerCase().includes('question'))
        ? (res || '') + BUYER_S3_KNOWLEDGE_SUPPLEMENT
        : res;
    // FIX-D: Append buyer S5 knowledge supplement when S5 is "Agricultural land rules"
    const resWithBuyer = ((a[4] || '').toLowerCase().includes('agricultural'))
        ? (resWithBuyerS3 || '') + BUYER_S5_KNOWLEDGE_SUPPLEMENT
        : resWithBuyerS3;
    // FIX-I: Tag S5 seasonal script explicitly for agricultural land rules
    const s5Buyer = (a[4] || '').toLowerCase().includes('agricultural')
        ? `${a[4]} [SEASONAL: weave Budget Week reference — "Budget mein zameen ke rules change hue kya? Nahi. Lekin yeh basic rule toh jaano..." as secondary hook element]`
        : (a[4] || "Common buyer mistake");
    // FIX-N: Map pain cycle to specific scripts
    const painMap = `
<!-- FIX-N: Pain cycle mapped to specific scripts -->
<pain_mapping>
Commission Drain: Primary pain for S4 (first-time buyer — commission savings hook), secondary for S3 (questions to ask — "commission kitna lega?" as one question)
Document Chaos: Primary pain for S1 (flood zone — document verification angle), S2 (red flags — document red flags), S5 (agricultural land — classification documents)
</pain_mapping>`;
    return mkP(1, "GENERATE 5 BUYER-FOCUSED BHOOMISCAN REEL SCRIPTS", "buyer", cx, r, resWithBuyer,
        `S1: EDUCATE — ${a[0] || "Document/process explainer"}${s1GapNote}\nS2: AGITATE — ${a[1] || "Scam/fraud awareness"}\nS3: EDUCATE — ${a[2] || "Step-by-step checklist"}\nS4: EMPOWER — ${a[3] || "Smart buying strategy"}\nS5: AGITATE — ${s5Buyer}${painMap}`,
        FMT.b1, NRG.b1, "S2 and S4 only", USP_B.b1, USP_SEC.b1,
        `<buyer_profile>
Buyer (28-45, Tier 2/3, risk-averse) | Persona: "Protective Big Brother" — calm, educational
Language: 65% Hindi / 35% English | Emotional arc: ${r.emo.buyer.f} → ${r.emo.buyer.t}
Trust triggers: verified, genuine, safe, checked | Fear triggers: fraud, fake, court case, scam
</buyer_profile>`,
        `<competitive_angle script="S2">Weave naturally into S2: "${COMP[r.comp % COMP.length]}"</competitive_angle>`,
        '', '', BATCH_AWARENESS_P1);
}

export function mkP2(cx, r, res) {
    const a = r.sa.map(i => ANG.seller[i]);
    // FIX 5: S3 hook override — Situational (id=5) doesn't fit "Handling advance payments"
    // Common Mistake (id=7) is the natural fit: "Ek galti hai jo 80% sellers karte hain..."
    // Verify uniqueness: after swap, all 5 b2 hooks must remain distinct
    const r2 = (() => {
        if (r.hB.b2[2] === 5 && (a[2] || '').toLowerCase().includes('advance')) {
            const newB2 = [...r.hB.b2];
            newB2[2] = 7; // Situational → Common Mistake
            // Only apply if Common Mistake isn't already used in another b2 slot
            const otherSlots = [newB2[0], newB2[1], newB2[3], newB2[4]];
            if (!otherSlots.includes(7)) {
                return { ...r, hB: { ...r.hB, b2: newB2 } };
            }
        }
        return r;
    })();
    // <!-- FIX 5: S3 hook changed from Situational to Common Mistake when topic is advance payments -->
    // FIX 3B: Append seller S3 knowledge supplement when S3 is "Handling advance payments"
    const resWithSellerS3 = ((a[2] || '').toLowerCase().includes('advance'))
        ? (res || '') + SELLER_S3_KNOWLEDGE_SUPPLEMENT
        : res;
    // FIX-B: Append seller S2 knowledge supplement to research data when S2 is "Property presentation tips"
    const resWithSeller = ((a[1] || '').toLowerCase().includes('presentation'))
        ? (resWithSellerS3 || '') + SELLER_S2_KNOWLEDGE_SUPPLEMENT
        : resWithSellerS3;
    // FIX-E: Sharpen S4 angle when topic is "Why property isn't selling" — VISIBILITY focus
    const s4Angle = (a[3] || '').toLowerCase().includes("why property")
        ? `${a[3]} (VISIBILITY angle)\nFocus on: property sitting invisible because it's only in broker's phone contacts or a single Facebook group. NOT pricing. NOT location.\nThe core message: "Tumhari zameen invisible hai market mein" → Solution: online visibility via BhoomiScan.\nResearch bridge: "90% buyers online search se shuru karte hain" (from Target Audience Guide, Seller objection #8).\nThis angle directly supports the WhatsApp Connect USP assignment.`
        : (a[3] || "Legal document awareness");
    // FIX-I: Tag S5 seasonal script explicitly for seller tax implications
    const s5Seller = (a[4] || '').toLowerCase().includes('tax')
        ? `${a[4]} [SEASONAL: lead with Budget Week angle — Section 194H TDS changes are literally Budget-related tax provisions. This is the natural seasonal script for this batch.]`
        : (a[4] || "Cost of waiting");
    // FIX-G: Self-reference changed from "S1 and S3" to "S3 and S4" — S1 already has Story Entry hook (double narrative overlap)
    return mkP(2, "GENERATE 5 SELLER-FOCUSED BHOOMISCAN REEL SCRIPTS", "seller", cx, r2, resWithSeller,
        `S1: AGITATE — ${a[0] || "Why property not selling"}\nS2: EDUCATE — ${a[1] || "Listing optimization/pricing"}\nS3: EMPOWER — ${a[2] || "Commission savings/direct selling"}\nS4: EDUCATE — ${s4Angle}\nS5: AGITATE — ${s5Seller}`,
        FMT.b2, NRG.b2, "S3 and S4 only", USP_B.b2, USP_SEC.b2,
        `<seller_profile>
Seller (30-60, native place property) | Persona: "Strategic Advisor" — direct, empowering
Language: 70% Hindi / 30% English | Emotional arc: ${r.emo.seller.f} → ${r.emo.seller.t}
Trust triggers: free, direct, control, no spam | Fear triggers: commission, broker cut, time waste, unsold
</seller_profile>`,
        `<competitive_angle script="S1">Weave naturally into S1: "${COMP[(r.comp + 1) % COMP.length]}"</competitive_angle>`,
        '', '', BATCH_AWARENESS_P2);
}

export function mkP3(cx, r, res) {
    const aa = r.aa.map(i => ANG.agent[i]), na = r.na.map(i => ANG.nri[i]);
    // FIX 3C: Append agent S3 knowledge supplement when S3 is "WhatsApp marketing"
    const resWithAgentS3 = ((aa[2] || '').toLowerCase().includes('whatsapp'))
        ? (res || '') + AGENT_S3_KNOWLEDGE_SUPPLEMENT
        : res;
    // FIX 9: Append NRI evergreen stats supplement to research data
    const resWithNri = (resWithAgentS3 || '') + NRI_KNOWLEDGE_SUPPLEMENT;
    // FIX 11: S4 Bold Claim hook hint — repatriation needs expectation-gap framing, not excitement
    const s4HookHint = `<!-- FIX 11: S4 Bold Claim hook hint added -->
<hook_hint script="S4">
The Bold Claim for repatriation should NOT try to make FEMA rules exciting. Instead, the surprise should come from what NRIs DON'T know:
Example angle: "NRI ho aur sochte ho property bech ke paisa bahar bhej doge? Itna simple nahi hai bhai."
The "bold claim" is the gap between expectation and reality — most NRIs assume selling = money transferred. The repatriation process, TDS obligations, and CA certificate requirements are the surprise. Lead with the assumption, then bust it.
</hook_hint>`;
    return mkP(3, "GENERATE 5 SCRIPTS: 3 AGENT + 2 NRI", "mixed", cx, r, resWithNri,
        `S1 (AGENT EMPOWER): ${aa[0] || "Business growth"}\nS2 (AGENT AGITATE): ${aa[1] || "Digital disruption FOMO"}\nS3 (AGENT EDUCATE): ${aa[2] || "Lead gen/closing"}\nS4 (NRI EDUCATE): ${na[0] || "NRI rules/FEMA"}\nS5 (NRI EMPOWER): ${na[1] || "Hometown investment"}`,
        FMT.b3, NRG.b3, "S2 only", USP_B.b3, USP_SEC.b3,
        `<agent_profile>
Agent (25-50, commission-based) | Persona: "Peer Mentor" — competitive, FOMO
Language: 55% Hindi / 45% English | Emotional arc: ${r.emo.agent.f} → ${r.emo.agent.t}
NOT anti-broker — BhoomiScan is an ADDITIONAL channel for agents
<!-- FIX-M: Competitive positioning clarified per script -->
<competitive_angle>
S1 (Competing digitally): Weave "${COMP[(r.comp + 2) % (COMP.length - 1)]}" — this is anti-platform positioning (opportunity framing).
S2 (Photography): Do NOT use competitive angle — focus on practical advice. Photography tips should stand on their own merit.
REMEMBER: BhoomiScan is NOT anti-broker. It is anti-invisible. The message is "go digital AND keep your broker relationships."
</competitive_angle>
</agent_profile>
<nri_profile>
NRI (30-55, abroad) | Persona: "Trusted Advisor from Home" — warm, reassuring
Language: Gulf NRI → 65% Hindi / 35% English | US/UK NRI → 50% Hindi / 50% English (default to Gulf ratio)
Emotional arc: ${r.emo.nri.f} → ${r.emo.nri.t}
82% NRI buyers report trust deficit — address verification anxiety explicitly
75% prefer investing in hometown — leverage nostalgia + family connection
CANNOT buy agricultural land — residential/commercial only | FEMA repatriation rules apply
Use "family" and "ghar" as emotional anchors, not "investment" and "returns"
<competitive_angle>Weave into S4 or S5: "${COMP[COMP.length - 1]}"</competitive_angle>
</nri_profile>`,
        '',
        // FIX 3: Updated ab_test with evaluation criteria — dual alt hooks for S1 and S5
        `<!-- FIX 3: AB test evaluation criteria added -->
<ab_test>
Generate 1 alt hook for Script 1 using a different archetype AND 1 alt hook for Script 5 (NRI scam prevention — different emotional angle).
EVALUATION CONTEXT: The alt hook will be tested against the primary hook for scroll-stop rate (first 1.5 seconds). The winning hook is the one more likely to make a viewer STOP scrolling and watch the full reel.
ALT HOOK CRITERIA:
- Must use a DIFFERENT archetype from the primary (specified in variation_controls)
- Must still fit the script's assigned topic, energy level, and audience
- Must be swappable without rewriting the rest of the script (the engage section and CTA remain the same)
OUTPUT: Present alt hooks as single lines labeled "ALT HOOK S1:" and "ALT HOOK S5:" after their respective script outputs, with archetype names in parentheses.
</ab_test>`,
        // FIX 11: Pass hook hint for S4 into variation_controls
        s4HookHint,
        BATCH_AWARENESS_P3);
}

export function mkP4(cx, r, res, shockStat) {
    const se = r.se;
    const hasResearch = !!res;

    // FIX 6: Detect garbled shockStat (table fragments contain multiple ₹ or pillar keywords)
    const isGarbled = shockStat && (
        (shockStat.match(/₹/g) || []).length > 1 ||
        /\b(BUYER|SELLER|AGITATE|EDUCATE|EMPOWER)\b/.test(shockStat) ||
        shockStat.length > 120
    );

    let shockLine;
    if (isGarbled) {
        // FIX 6: Replace garbled stat with clean 3-option structured directive
        shockLine = `<!-- FIX 6: Garbled stat replaced with structured directive -->
FRAUD DATA SHOCK — Use ONE of these stats as the shock hook:
  STAT OPTION A: Gurugram 32nd Avenue — ₹500 crore fraud, 1 commercial floor sold to 25 different buyers, ~1000 investors cheated
  STAT OPTION B: Pune Mohammadwadi — ₹600 crore land fraud, forged Urban Land Ceiling documents for 28 acres
  STAT OPTION C: Navi Mumbai — ₹69.47 crore, 152 hectares of forest land illegally mutated
  Pick the ONE stat that creates the strongest Rhetorical Challenge hook ("Guess karo..."). Do not combine all three — pick one, let it breathe.`;
    } else {
        shockLine = shockStat
            ? `USE THIS EXACT STAT AS SHOCK HOOK: "${shockStat}"`
            : (hasResearch ? "Fresh stat/news as shock hook" : "Strongest stat from Target Audience Guide stat library as shock hook");
    }

    const freshness = hasResearch
        ? `<freshness_rules>
S1 MUST use this week's research as shock hook${shockStat && !isGarbled ? ` — SPECIFIC STAT: "${shockStat}"` : ""}
S2 MUST be forward-looking backed by research trends
S4 MUST reference festivals
S5 MUST drive comments/community engagement
</freshness_rules>`
        : `<freshness_rules>
S1 MUST use strongest stat from Target Audience Guide stat library — present as breaking news ("Ek number sunno jo is week saamne aaya...")
S2 MUST be forward-looking using known industry trends
S4 MUST reference festivals
S5 MUST drive comments/community
NOTE: No fresh research this week. Compensate by making S1 and S2 extra compelling with library stats. Frame with urgency as if timely.
</freshness_rules>`;
    const seasonalFacts = SEASONAL_FACTS[se.f[0]];
    const seasonalXml = seasonalFacts
        ? `\n<seasonal_data topic="${se.f[0]}">\n${seasonalFacts.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}\nUse 1-2 of these provisions in S4. Do NOT fabricate additional provisions.\n</seasonal_data>`
        : '';
    const p4CompXml = `<competitive_angles>\n  <angle audience="BUYER" script="S2">Weave naturally: "${COMP[(r.comp + 1) % COMP.length]}"</angle>\n  <angle audience="SELLER" script="S4">Weave naturally: "${COMP[(r.comp + 2) % COMP.length]}"</angle>\n  <angle audience="AGENT" script="S5">Weave naturally: "${COMP[(r.comp + 4) % COMP.length]}"</angle>\n</competitive_angles>`;
    // FIX-F: Override S2 hook from Confession (id=1) to Future Frame (id=9) for Prediction format
    // Confession hooks feel personal/present-tense and conflict with Prediction/Future format which is forward-looking
    const r4 = (() => {
        if (r.hB.b4[1] === 1) { // S2 has Confession
            const newB4 = [...r.hB.b4];
            newB4[1] = 9; // Confession → Future Frame
            // Only apply if Future Frame isn't already used in another b4 slot
            const otherSlots = [newB4[0], newB4[2], newB4[3], newB4[4]];
            if (!otherSlots.includes(9)) {
                return { ...r, hB: { ...r.hB, b4: newB4 } };
            }
        }
        return r;
    })();
    return mkP(4, "GENERATE 5: TRENDING + DATA-BACKED + COMMUNITY", "trending", cx, r4, res,
        // FIX 7: S5 simplified to single clear debate directive — removes "community story OR" ambiguity
        // FIX-A: Added specific RERA debate topic with both sides defined — eliminates creative ambiguity for constrained Rapid Fire format
        `S1 (DATA): ${shockLine}\nS2 (PREDICTION): Forward-looking trends\nS3 (CONNECT Q&A): "Your questions answered" format — community engagement\nS4 (SEASONAL): ${se.f.join("/")} — "${se.h}"\nS5 (CONNECT): Community debate — "RERA registration: zaroor hai ya time waste?" Present both sides in Rapid Fire format:\n  SIDE A (Pro-RERA): "Compliance hai, trust milta hai, penalty se bachoge" — cite RERA penalty stat (up to 10% of project cost)\n  SIDE B (Anti-RERA): "Chhote agents ke liye cost zyada hai, paperwork ka bojh, 90% agents bina RERA ke chal rahe hain"\n  Close with: "Tumhe kya lagta hai? Comment karo."\n  Do NOT take a side — present both fairly, let audience decide.\n  This debate works because agents have STRONG opinions on RERA and the topic is evergreen + this week's research has RERA digitization findings.`,
        // FIX-J: Self-ref moved from S3 to S2 — S3 is Q&A format with Social Proof framing conflict; S2 Prediction benefits from "Main bhi pehle yahi sochta tha" moment
        FMT.b4, NRG.b4, "S2 only", USP_B.b4, USP_SEC.b4,
        // FIX 8: Street-Smart Friend persona calibration added to trending_profile
        `<trending_profile>
Audience mapping: S1=ALL (data shock), S2=BUYER (forward prediction), S3=ALL (community Q&A), S4=SELLER (seasonal urgency), S5=AGENT (community story)
Content Pillars: S1=TRENDING, S2=TRENDING, S3=CONNECT, S4=EDUCATE/SEASONAL, S5=CONNECT (2 CONNECT reels required per week)
${freshness}
<!-- FIX 8: Street-Smart Friend persona calibration added -->
<trending_persona>
"STREET-SMART FRIEND" PERSONA CALIBRATION:
- This persona speaks to ALL audiences simultaneously — buyers, sellers, agents, NRIs
- Language ratio: 60% Hindi / 40% English (midpoint between buyer 65/35 and agent 55/45)
- Energy baseline: Higher than educational scripts, slightly lower than agent FOMO scripts
- Signature moves:
  * Opens with data or news, not advice ("Yeh number suno" not "Yeh karo")
  * Connects dots between news and viewer's life ("Iska matlab tumhare liye kya hai?")
  * Uses "hum sab" (all of us) more than persona-specific "hum" — broader inclusion
  * Ends with opinion invitation, not instruction ("Tumhe kya lagta hai?")
- Think of this voice as: A friend who reads the news AND understands real estate, sharing what he found over chai. Not a reporter. Not an analyst. A sharp friend.
- Trust triggers: data, numbers, news source references (unnamed), trend language
- Fear triggers: "peeche reh jaoge", "yeh badlav aa raha hai", "tayyar ho?"
</trending_persona>
</trending_profile>${seasonalXml}`,
        p4CompXml,
        // FIX 3 + FIX-F: Updated ab_test — S4 alt changed to S2 alt with Confession archetype (moved from primary)
        `<!-- FIX 3: AB test evaluation criteria added -->
<!-- FIX-F: S2 alt hook now uses Confession archetype (moved from S2 primary to alt) -->
<ab_test>
Generate 1 alt hook for Script 1 using a different archetype AND 1 alt hook for Script 2 using Confession archetype ("Sach batau? Main kuch predictions share karna chahta hoon jo tumhe jaanna chahiye...").
EVALUATION CONTEXT: The alt hook will be tested against the primary hook for scroll-stop rate (first 1.5 seconds). The winning hook is the one more likely to make a viewer STOP scrolling and watch the full reel.
ALT HOOK CRITERIA:
- Must use a DIFFERENT archetype from the primary (specified in variation_controls)
- Must still fit the script's assigned topic, energy level, and audience
- Must be swappable without rewriting the rest of the script (the engage section and CTA remain the same)
OUTPUT: Present alt hooks as single lines labeled "ALT HOOK S1:" and "ALT HOOK S2:" after their respective script outputs, with archetype names in parentheses.
</ab_test>`,
        '', BATCH_AWARENESS_P4);
}

export function mkClean(cx, r) {
    // Dynamic assignments: inject the actual week's hook/CTA/USP so Claude preserves them
    const weekInfo = cx && r ? `
<week_context>
Week ${cx.wk} of ${cx.mn}, ${cx.yr} | Pattern ${r.pat} | Emotion ${r.ci}/4
Pain: ${r.pain.l}
</week_context>

<assignments_to_preserve>
<batch id="1" audience="Buyer">
<hooks>
${hS(r.hB.b1)}
</hooks>
<ctas>
${cS(r.cB.b1)}
</ctas>
<usps>${uS(USP_B.b1, USP_SEC.b1)}</usps>
<emotion>${r.emo.buyer.f} → ${r.emo.buyer.t}</emotion>
</batch>

<batch id="2" audience="Seller">
<hooks>
${hS(r.hB.b2)}
</hooks>
<ctas>
${cS(r.cB.b2)}
</ctas>
<usps>${uS(USP_B.b2, USP_SEC.b2)}</usps>
<emotion>${r.emo.seller.f} → ${r.emo.seller.t}</emotion>
</batch>

<batch id="3" audience="Agent+NRI">
<hooks>
${hS(r.hB.b3)}
</hooks>
<ctas>
${cS(r.cB.b3)}
</ctas>
<usps>${uS(USP_B.b3, USP_SEC.b3)}</usps>
<emotion>${r.emo.agent.f} → ${r.emo.agent.t} | ${r.emo.nri.f} → ${r.emo.nri.t}</emotion>
</batch>

<batch id="4" audience="Trending">
<hooks>
${hS(r.hB.b4)}
</hooks>
<ctas>
${cS(r.cB.b4)}
</ctas>
<usps>${uS(USP_B.b4, USP_SEC.b4)}</usps>
</batch>
</assignments_to_preserve>` : "";

    return `<system>
<role>
You are BhoomiScan's script quality reviewer. You fix scripts while preserving their assigned variation controls (hooks, CTAs, USPs, emotional arcs).
</role>
</system>

<task>CLEANUP AND FIX SCRIPT</task>

<instructions>
Paste your request as: "Review Script [N] from [Buyer/Seller/Agent+NRI/Trending]. Issue: [describe]."

Maintain the assigned archetype/CTA/USP and keep scripts at 130-145 words.
</instructions>
${weekInfo}

<fix_checklist>
1. Hook weak → rewrite with stronger SAME archetype (check assignments above)
2. CTA forced → rewrite using the ASSIGNED CTA pattern for that script
3. Tone off → add 2-3 texture elements (dialogue snippets, "bhai" naturally, short punches)
4. Flat → add energy booster at 40-60% mark ("Ruko ruko", "Ab suno", "Best part")
5. AI-sounding → rewrite in chai tapri speech — natural code-switching, not translated
6. Too long/short → trim filler or expand with "main bhi" moment / dialogue snippet
7. USP forced → weave primary USP naturally into content, secondary into CTA
8. Hinglish off → Buyer 65%, Seller 70%, Agent 55%, NRI 60% Hindi
9. Format wrong → match assigned format for that script
10. bhai count → exactly 2-4 uses, never more
11. Pronouns → tum/tumhare ONLY
12. Emotion mismatch → maintain the FROM→TO emotional arc listed above
</fix_checklist>

<critical_rules>
- Do NOT change the hook archetype — fix WITHIN the same archetype
- Do NOT swap CTA patterns between scripts — each has a specific assignment
- Preserve primary USP (in content) and secondary USP (in CTA) as assigned
- Check the 3-1-3 rhythm: short punches between medium sentences
</critical_rules>

<reference_script label="${GOLD.seller.label}" score="${GOLD.seller.score}">
Study this gold standard for tone, pacing, and CTA invisibility:
${GOLD.seller.script}
</reference_script>

<output>
Output corrected script + caption + hashtags. Highlight what you changed and why.
Then re-verify against Quality Gate.
</output>

<quality_gate>
${QGATE}
</quality_gate>`;
}

// ═══ CONTEXT-AWARE RESEARCH PROMPTS ═══

export function getResearchPrompts(rotation, context) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const isoDate = today.toISOString().split("T")[0];

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
            prompt: `<system>
<role>You are a real estate research analyst specializing in Indian land markets. Your task is to find fresh, verified data that will power high-engagement Hinglish reel scripts for BhoomiScan — India's land verification and listing platform, focused on Odisha.</role>
</system>

<context>
<date>${dateStr} (${isoDate})</date>${weekContext ? `\n<week>${weekContext.trim()}</week>` : ""}
</context>${painBlock}${seasonBlock}${angleBlock}

<research_task>
Search and deeply analyze developments in Indian real estate and land markets from the PAST 7 DAYS (${isoDate} backwards). Cover these categories:

<category id="1" priority="high">LAND FRAUD & SCAM CASES — Any new cases reported this week. Include state, amount, method used. These make the BEST hooks.</category>
<category id="2" priority="high">GOVERNMENT POLICY — RERA updates, stamp duty changes, digitization drives, Bhulekh/land record portal updates, new circulars.</category>
<category id="3" priority="high">MARKET DATA — Property price trends, transaction volumes, PropTech funding, infrastructure announcements.</category>
<category id="4" priority="medium">ODISHA SPECIFIC — Any Odisha real estate news, Bhubaneswar/Cuttack development, state-level land policy.</category>
<category id="5" priority="medium">NRI RULES — FEMA updates, RBI circulars on NRI property, repatriation rule changes.</category>
<category id="6" priority="medium">AGENT/BROKER — TDS enforcement, RERA registration drives, digital platform adoption.</category>
</research_task>

<output_format>
For EACH finding, provide ALL fields in this exact structure:

FINDING: [One sentence with exact number/stat if available]
SOURCE: [Publication name, date published]
AUDIENCE: [BUYER | SELLER | AGENT | NRI | ALL]
PILLAR: [EDUCATE | AGITATE | EMPOWER | TRENDING]
SCRIPT ANGLE: [One sentence — how to use this in a 130-145-word Hinglish reel]
HOOK TYPE: [Best hook archetype: Confession | Knowledge Gap | Single Number | Story Entry | Bold Claim | Common Mistake]
SHOCK VALUE: [Rate 1-5 — how likely to stop someone mid-scroll]
</output_format>

<quality_rules>
- MINIMUM 10 findings
- Prioritize findings with HARD NUMBERS and STATS — these make the strongest reel hooks
- Each finding should include at least one specific number (₹ amount, percentage, count, or timeframe)
- Findings without concrete data points should be marked as "LOW" shock value
</quality_rules>`
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

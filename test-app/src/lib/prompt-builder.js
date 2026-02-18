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

// ═══ MASTER PROMPT BUILDER v2 — Claude-Optimized XML Architecture ═══
// hookHintsXml (16th param): optional, injected inside <variation_controls> after </hooks> — used by mkP3 for Fix 11
export function mkP(num, title, audience, cx, r, res, assignments, formats, energy, selfRef, uspPri, uspSec, audCal, compAnglesXml, abTestXml, hookHintsXml) {
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
</research_preprocessing>
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

<!-- FIX 2: Format definitions added -->
<format_definitions>
FORMAT STRUCTURES (how the script's body is organized — independent of hook archetype):

TALKING HEAD: Direct-to-camera monologue. Speaker shares knowledge conversationally. Most flexible format. 2-4 main points delivered in sequence with conversational breaks. Default format when no special structure is needed.

MYTH BUSTER: Open with a widely-held belief or common practice stated as fact. Then disprove it with data or logic. Structure: State myth (1-2 lines) → "Lekin sach yeh hai..." or "Galat." → Correct information with proof → What to do instead. The "bust" moment should land at the 40-50% mark of the script.

STORY-BASED: Open with a third-person mini-story (real or anonymized). Structure: Setup character + situation (2-3 lines) → What went wrong or right (2-3 lines) → Lesson extracted → How viewer can apply it. Story should be maximum 40% of script; the lesson and application are the payload.

NUMBER SHOCK: Lead with a single shocking statistic. Let it breathe (short sentence, pause). Then unpack what the number means in practical terms. Structure: Stat drop → "Ruko, iska matlab samjho" → Real-world implication → What viewer should do. The number must be spoken in Hindi words for emphasis when under 100 ("saat guna"), numerals when data-context ("500 crore").

RAPID FIRE: 3-5 quick-hit points delivered fast. Each point is 1-2 sentences maximum. No deep explanation per point. Structure: Setup frame ("Teen cheezein yaad rakho") → Point 1 → Point 2 → Point 3 → Punchy summary → CTA. Energy stays consistently high throughout — no dips.

Q&A RESPONSE: Frame as answering real audience questions. Structure: Acknowledge questions come in ("Bahut log poochte hain...") → Pick 2-3 questions → Answer each briefly (2-3 sentences max) → Invite more questions in close. Tone is warmer and more inclusive than other formats.

PREDICTION/FUTURE: Frame as forward-looking analysis. Structure: "Aage kya hone wala hai?" setup → 2-3 predictions with supporting data → What viewer should do NOW to prepare → CTA as preparation step. Avoid guaranteeing predictions — use "data yeh keh raha hai" or "trend yeh hai" framing.
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
7. COUNT words — target 130-145. Count EVERY word including Hindi words, English words, and single-word interjections (bhai, haan, nahi each = 1 word). Quoted dialogue words count too. If count exceeds 145: first cut filler phrases ('basically', 'actually', 'toh dekho'), then shorten one example, then remove one conversational aside. If count is below 130: add a dialogue snippet, a 'main bhi' moment, or one more detail to a tip. RECOUNT after every edit. The final count must be 130-145 — scripts at 146+ words will be rejected.
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
</output_format>

<variation_log_format>
After all 5 scripts, output this EXACTLY as a plain-text code block (triple backticks), NOT as a markdown table:
\`\`\`
| Script | Hook | CTA | Bio | Trigger | Energy | USP | Pain | Angle | Format |
| S1 | [hook] | [cta] | [bio] | [trigger] | [energy] | [usp] | [pain] | [angle] | [format] |
...all 5 scripts...
\`\`\`
IMPORTANT: Use pipe-delimited plain text, not a rendered table.
</variation_log_format>

<quality_gate>
${QGATE}
</quality_gate>`;
}

// ═══ BATCH PROMPT BUILDERS ═══

export function mkP1(cx, r, res) {
    const a = r.ba.map(i => ANG.buyer[i]);
    // FIX 4: Research gap handling for S1 when assigned "Flood zone check guide"
    const s1GapNote = (a[0] || '').toLowerCase().includes('flood zone')
        ? `\n<!-- FIX 4: S1 research gap handling added -->\n<research_gap_handling>\nS1 NOTE: The research data does not contain flood-zone-specific stats. For this script:\n- Use the general buyer insight that 84% of deals close offline due to trust deficit (from Audience Guide Section 6) as the proof-point bridge: flood zone risk is one MORE reason to verify before buying\n- Reference Google Maps flood zone check as a practical zero-cost step (this is general knowledge, not a research stat — frame it as a tip, not a cited finding)\n- Do NOT fabricate flood-zone statistics. If a stat is needed for the hook, use the "66% civil cases = property disputes" stat and pivot to flood zone as one of the underappreciated dispute causes\n<!-- OPTION B FALLBACK: If flood zone content feels too thin even with this guidance, swap S1 topic to "Encumbrance certificate guide" which has direct research support from fraud findings (Gurugram duplicate registry case, Pune ULC forgery case) -->\n</research_gap_handling>`
        : '';
    return mkP(1, "GENERATE 5 BUYER-FOCUSED BHOOMISCAN REEL SCRIPTS", "buyer", cx, r, res,
        `S1: EDUCATE — ${a[0] || "Document/process explainer"}${s1GapNote}\nS2: AGITATE — ${a[1] || "Scam/fraud awareness"}\nS3: EDUCATE — ${a[2] || "Step-by-step checklist"}\nS4: EMPOWER — ${a[3] || "Smart buying strategy"}\nS5: AGITATE — ${a[4] || "Common buyer mistake"}`,
        FMT.b1, NRG.b1, "S2 and S4 only", USP_B.b1, USP_SEC.b1,
        `<buyer_profile>
Buyer (28-45, Tier 2/3, risk-averse) | Persona: "Protective Big Brother" — calm, educational
Language: 65% Hindi / 35% English | Emotional arc: ${r.emo.buyer.f} → ${r.emo.buyer.t}
Trust triggers: verified, genuine, safe, checked | Fear triggers: fraud, fake, court case, scam
</buyer_profile>`,
        `<competitive_angle script="S2">Weave naturally into S2: "${COMP[r.comp % COMP.length]}"</competitive_angle>`);
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
    return mkP(2, "GENERATE 5 SELLER-FOCUSED BHOOMISCAN REEL SCRIPTS", "seller", cx, r2, res,
        `S1: AGITATE — ${a[0] || "Why property not selling"}\nS2: EDUCATE — ${a[1] || "Listing optimization/pricing"}\nS3: EMPOWER — ${a[2] || "Commission savings/direct selling"}\nS4: EDUCATE — ${a[3] || "Legal document awareness"}\nS5: AGITATE — ${a[4] || "Cost of waiting"}`,
        FMT.b2, NRG.b2, "S1 and S3 only", USP_B.b2, USP_SEC.b2,
        `<seller_profile>
Seller (30-60, native place property) | Persona: "Strategic Advisor" — direct, empowering
Language: 70% Hindi / 30% English | Emotional arc: ${r.emo.seller.f} → ${r.emo.seller.t}
Trust triggers: free, direct, control, no spam | Fear triggers: commission, broker cut, time waste, unsold
</seller_profile>`,
        `<competitive_angle script="S1">Weave naturally into S1: "${COMP[(r.comp + 1) % COMP.length]}"</competitive_angle>`);
}

export function mkP3(cx, r, res) {
    const aa = r.aa.map(i => ANG.agent[i]), na = r.na.map(i => ANG.nri[i]);
    // FIX 9: Append NRI evergreen stats supplement to research data
    const resWithNri = (res || '') + NRI_KNOWLEDGE_SUPPLEMENT;
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
<competitive_angle>Weave into S1 or S2: "${COMP[(r.comp + 2) % (COMP.length - 1)]}"</competitive_angle>
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
        s4HookHint);
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
    return mkP(4, "GENERATE 5: TRENDING + DATA-BACKED + COMMUNITY", "trending", cx, r, res,
        // FIX 7: S5 simplified to single clear debate directive — removes "community story OR" ambiguity
        `S1 (DATA): ${shockLine}\nS2 (PREDICTION): Forward-looking trends\nS3 (CONNECT Q&A): "Your questions answered" format — community engagement\nS4 (SEASONAL): ${se.f.join("/")} — "${se.h}"\nS5 (CONNECT): Community debate — pose a polarizing-but-friendly question that agents/sellers have strong opinions about. Format: RAPID FIRE (present 2 opposing viewpoints in quick-hit style, then ask audience to pick a side).`,
        FMT.b4, NRG.b4, "S3 only", USP_B.b4, USP_SEC.b4,
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
        // FIX 3: Updated ab_test with evaluation criteria — dual alt hooks for S1 and S4
        `<!-- FIX 3: AB test evaluation criteria added -->
<ab_test>
Generate 1 alt hook for Script 1 using a different archetype AND 1 alt hook for Script 4 (seasonal — different Budget/festival framing).
EVALUATION CONTEXT: The alt hook will be tested against the primary hook for scroll-stop rate (first 1.5 seconds). The winning hook is the one more likely to make a viewer STOP scrolling and watch the full reel.
ALT HOOK CRITERIA:
- Must use a DIFFERENT archetype from the primary (specified in variation_controls)
- Must still fit the script's assigned topic, energy level, and audience
- Must be swappable without rewriting the rest of the script (the engage section and CTA remain the same)
OUTPUT: Present alt hooks as single lines labeled "ALT HOOK S1:" and "ALT HOOK S4:" after their respective script outputs, with archetype names in parentheses.
</ab_test>`);
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

// ════════════════════════════════════════════════════════════════════
// RESEARCH PROCESSOR v3 — Multi-Document Intelligence
// Source tracking, balanced batching, cross-doc synthesis, conflict detection
// Hook extraction, narrative arcs, quality dashboard
// ════════════════════════════════════════════════════════════════════

import {
    nlpMatch, extractStats, smartTruncate, coOccurrenceScore,
    extractEntities, sentenceScore, jaccardSimilarity,
    buildTfIdf, textRank, extractHooks, detectArc, detectConflicts,
} from './nlp.js';
import { ANG } from './rotation.js';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// ═══ OCR ARTIFACT REPAIR ═══
// PDF extraction commonly breaks ligatures: fi → f i, fl → f l, ff → f f

const OCR_LIGATURE_FIXES = [
    // COMPOUND WORDS FIRST (match before simpler fi/fl patterns)
    [/\bspeci\s+fi\s*c/gi, 'specific'],
    [/\bcerti\s*fi\s*cat/gi, 'certificat'],
    [/\bveri\s*fi\s*cat/gi, 'verificat'],
    [/\bident\s*i\s*fi\s*cat/gi, 'identificat'],
    [/\bclass\s*i\s*fi\s*cat/gi, 'classificat'],
    [/\bsigni\s+fi\s*can/gi, 'significan'],
    [/\bbene\s+fi\s*t/gi, 'benefit'],
    [/\boffi\s*c(?:e|ial|er|ially)/gi, m => m.replace(/\s+/g, '')],
    [/\boff\s+ic(?:e|ial|er|ially)/gi, m => m.replace(/\s+/g, '')],
    [/\bof\s+fi\s*c(?:e|ial|er|ially)/gi, m => m.replace(/\s+/g, '')],
    [/\boff\s*er/gi, 'offer'],
    [/\beff\s+ect/gi, 'effect'],
    [/\baff\s+ect/gi, 'affect'],
    [/\baff\s+ord/gi, 'afford'],
    [/\bdiff\s+er/gi, 'differ'],
    [/\bsuff\s+er/gi, 'suffer'],
    [/\bsuff\s+ic/gi, 'suffic'],
    // SIMPLE fi- words (word boundary ensures no mid-word false matches)
    [/\bfi\s+ndings?\b/gi, m => m.replace(/\s+/g, '')],
    [/\bfi\s+nd\b/gi, 'find'],
    [/\bfi\s+le/gi, 'file'],
    [/\bfi\s+rst\b/gi, 'first'],
    [/\bfi\s+nal/gi, 'final'],
    [/\bfi\s+nance/gi, 'finance'],
    [/\bfi\s+nancial/gi, 'financial'],
    [/\bfi\s+eld/gi, 'field'],
    [/\bfi\s+gure/gi, 'figure'],
    [/\bfi\s+lter/gi, 'filter'],
    [/\bfi\s+scal/gi, 'fiscal'],
    [/\bfi\s+x/gi, 'fix'],
    // SIMPLE fl- words
    [/\bfl\s+oor/gi, 'floor'],
    [/\bfl\s+ag/gi, 'flag'],
    [/\bfl\s+ow/gi, 'flow'],
    [/\bfl\s+at\b/gi, 'flat'],
    [/\bfl\s+ight/gi, 'flight'],
    [/\bfl\s+ood/gi, 'flood'],
    [/\bfl\s+oat/gi, 'float'],
    [/\bfl\s+ip/gi, 'flip'],
    [/\bfl\s+y\b/gi, 'fly'],
    [/\bfl\s+u\b/gi, 'flu'],
    // Split-word OCR artifacts (common in PDF extraction)
    [/\bfi\s+ve\b/gi, 'five'],
    [/\bfi\s+rm/gi, 'firm'],
    [/\bfi\s+t\b/gi, 'fit'],
    [/\bveri\s+fi\s+ed/gi, 'verified'],
    [/\bveri\s+fi\s+cation/gi, 'verification'],
    [/\bbene\s+fi\s+t/gi, 'benefit'],
    [/\bsigni\s+fi\s+cant/gi, 'significant'],
    [/\bspeci\s+fi\s+c/gi, 'specific'],
    [/\bcerti\s+fi\s+cate/gi, 'certificate'],
    [/\bcerti\s+fi\s+ed/gi, 'certified'],
    [/\boffi\s+ci/gi, 'offici'],
    [/\boffunds\b/gi, 'of funds'],
    [/\bof\s*funds\b/gi, 'of funds'],
];

function cleanOcrArtifacts(text) {
    if (!text) return text;
    let cleaned = text;
    for (const [pattern, replacement] of OCR_LIGATURE_FIXES) {
        cleaned = cleaned.replace(pattern, replacement);
    }
    // Normalize multiple spaces to single space (but preserve newlines)
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    return cleaned;
}

// ═══ KEYWORD DICTIONARIES ═══

const RES_KW = {
    buyer: ["buy", "buyer", "purchase", "kharid", "invest", "ownership", "verify", "check", "site visit", "encumbrance", "mutation", "land record", "registry", "fraud", "scam", "fake", "dispute", "title", "due diligence", "property check", "first-time", "home loan", "emi", "possession", "agreement"],
    seller: ["sell", "seller", "list", "listing", "price", "commission", "broker", "unsold", "direct", "marketing", "photos", "valuation", "negotiat", "property not selling", "zero commission", "free list", "stamp duty", "capital gains", "appreciation"],
    agent: ["agent", "broker", "rera", "dealer", "digital", "lead", "commission tax", "client", "license", "registration", "portal", "194h", "tds", "brokerage", "proptech", "crm", "lead generation"],
    nri: ["nri", "abroad", "fema", "power of attorney", "poa", "repatriat", "diaspora", "overseas", "foreign", "non-resident", "nro", "nre", "oci", "rbi guideline", "tax treaty"],
    trending: ["trend", "growth", "market size", "report", "survey", "predict", "future", "forecast", "data shows", "statistics", "gdp", "infrastructure", "smart city", "highway", "metro", "tier 2", "tier 3", "policy", "budget", "reform", "amendment"],
};

const PIL_KW = {
    agitate: ["scam", "fraud", "fake", "warning", "risk", "danger", "loss", "dispute", "court", "penalty", "illegal", "beware", "mistake", "problem", "fail", "wrong", "trap", "victim", "horror", "nightmare"],
    empower: ["tip", "how to", "guide", "step", "strategy", "hack", "solution", "fix", "save", "benefit", "advantage", "opportunity", "grow", "boost", "improve", "smart", "checklist", "action"],
    trending: ["trend", "news", "update", "report", "announce", "launch", "policy", "govern", "budget", "new rule", "change", "amend", "reform", "break", "surge", "record"],
    educate: ["document", "process", "rule", "law", "section", "act", "regulation", "requirement", "checklist", "understand", "know", "learn", "meaning", "definition", "explainer"],
};

// ═══ CLASSIFICATION ═══

export function classifyAudience(text, tfidf = null) {
    const lower = text.toLowerCase();
    const scores = {};
    for (const [aud, kws] of Object.entries(RES_KW)) {
        let kwScore = kws.reduce((s, kw) => s + (nlpMatch(lower, kw) ? 1 : 0), 0);
        if (tfidf) kwScore += tfidf.score(text, kws) * 0.5;
        scores[aud] = kwScore;
    }
    for (const aud of Object.keys(scores)) {
        scores[aud] += coOccurrenceScore(text, RES_KW[aud]) * 0.5;
    }
    const max = Math.max(...Object.values(scores));
    if (max === 0) return ["all"];
    return Object.entries(scores)
        .filter(([, v]) => v >= max * 0.75)
        .map(([k]) => k)
        .sort((a, b) => scores[b] - scores[a])
        .slice(0, 2); // Cap at 2 audiences max — prevents findings from polluting every batch
}

export function classifyPillar(text, tfidf = null) {
    const lower = text.toLowerCase();
    const scores = {};
    for (const [pil, kws] of Object.entries(PIL_KW)) {
        let kwScore = kws.reduce((s, kw) => s + (nlpMatch(lower, kw) ? 1 : 0), 0);
        if (tfidf) kwScore += tfidf.score(text, kws) * 0.3;
        scores[pil] = kwScore;
    }
    const max = Math.max(...Object.values(scores));
    if (max === 0) return "CONTEXT"; // Neutral default — EDUCATE should only be assigned when education keywords actually match
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0].toUpperCase();
}

// ═══ INSIGHT DENSITY SCORING v3 ═══

export function insightScore(text, pain, season, angles, tfidf = null) {
    let s = 0;
    const lower = text.toLowerCase();
    const wordCount = text.split(/\s+/).length;

    if (tfidf) s += Math.min(tfidf.score(text) * 0.5, 6);

    const stats = extractStats(text);
    if (stats.length > 0) {
        const statDensity = (stats.length / Math.max(wordCount, 1)) * 100;
        s += Math.min(statDensity * 2, 4);
    }

    const entities = extractEntities(text);
    let entityScore = 0;
    if (entities.state || entities.city) entityScore += 1;
    if (entities.money) entityScore += 1;
    if (entities.rera_id) entityScore += 2;
    if (entities.percentage) entityScore += 0.5;
    if (entities.date) entityScore += 0.5;
    s += Math.min(entityScore, 3);

    const properNouns = text.match(/\b[A-Z][a-z]{2,}\b/g);
    const numbers = text.match(/\d+/g);
    const specificity = ((properNouns?.length || 0) + (numbers?.length || 0)) / Math.max(wordCount / 15, 1);
    s += Math.min(specificity, 2);

    // Recency decay: fresher data scores higher
    const yearMatch = text.match(/\b(20[1-2]\d)\b/g);
    if (yearMatch) {
        const latestYear = Math.max(...yearMatch.map(Number));
        if (latestYear >= 2025) s += 2;
        else if (latestYear >= 2023) s += 0.5;
        else s -= 1; // Pre-2023 data is stale
    }
    if (/this week|today|yesterday|recent|latest|just|breaking/i.test(text)) s += 1;
    if (/source:|according to|report|survey|study|data from|published by/i.test(text)) s += 1;

    if (pain && nlpMatch(lower, pain.p)) s += 3;
    if (pain && nlpMatch(lower, pain.s)) s += 2;

    // Multi-keyword angle matching: score against full phrase, not just first word
    if (angles?.length) {
        const angleBonuses = angles.map(a => {
            const words = a.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (!words.length) return 0;
            const matches = words.filter(w => nlpMatch(lower, w)).length;
            return matches >= 3 ? 4 : matches >= 2 ? 3 : matches === 1 ? 1 : 0;
        });
        s += Math.min(Math.max(...angleBonuses, 0), 4);
    }

    s += coOccurrenceScore(text, [pain?.p, pain?.s, ...(season?.f || [])].filter(Boolean));

    // Season co-occurrence: strong boost if finding matches 2+ season terms
    const seasonTerms = [...(season?.f || []), season?.h].filter(Boolean);
    const seasonMatches = seasonTerms.filter(f => lower.includes(f?.toLowerCase?.()));
    if (seasonMatches.length >= 2) s += 3;
    else if (seasonMatches.length === 1) s += 1;

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const sentScores = sentences.map(sent => sentenceScore(sent));
    const avgSentScore = sentScores.reduce((a, b) => a + b, 0) / sentScores.length;
    s += Math.min(avgSentScore * 0.5, 2);

    const genericPatterns = [
        /real estate is growing/i, /market is expected/i, /experts say/i,
        /it is important to/i, /one should always/i, /everyone knows/i,
        /plays? a (?:key|vital|important|crucial) role/i,
    ];
    s -= genericPatterns.filter(rx => rx.test(text)).length * 1.5;

    if (wordCount < 15) s -= 2;
    if (wordCount < 30 && stats.length === 0 && !entities.state && !entities.city) s -= 1;

    // Scriptability penalty: overly legal/technical text can't become natural Hinglish spoken scripts
    const sectionRefs = (text.match(/\b(?:Section|Sec\.?)\s*\d+[A-Z]?/gi) || []).length;
    if (sectionRefs >= 3) s -= 2; // Dense legal references
    const acronyms = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
    if (acronyms >= 4) s -= 1; // Acronym-heavy text
    const avgSentLen = wordCount / Math.max(sentences.length, 1);
    if (avgSentLen > 35) s -= 1; // Very long sentences = academic text

    return Math.max(s, 0);
}

// ═══ SEMANTIC CHUNKING v2 ═══

function detectSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = { header: null, lines: [] };
    let inTable = false;
    let tableLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Table detection: pipe-delimited or consistently tab/space-aligned columnar data
        const isTableLine = /^\|.+\|/.test(trimmed) || /^[-|:]+$/.test(trimmed);
        const isTabAligned = /\t/.test(line) && (line.match(/\t/g) || []).length >= 2;

        if (isTableLine || isTabAligned) {
            if (!inTable && currentSection.lines.length > 0) {
                // Flush current section before starting table
                sections.push({ ...currentSection, text: currentSection.lines.join('\n') });
                currentSection = { header: null, lines: [] };
            }
            inTable = true;
            tableLines.push(trimmed);
            continue;
        } else if (inTable && tableLines.length > 0) {
            // End of table — push as single preserved chunk
            sections.push({
                header: '[TABLE DATA]',
                lines: tableLines,
                text: tableLines.join('\n'),
                isTable: true
            });
            tableLines = [];
            inTable = false;
        }

        const isHeader =
            /^#{1,3}\s/.test(trimmed) ||
            /^\d+[.)]\s+[A-Z]/.test(trimmed) ||
            (/^[A-Z\s]{8,}$/.test(trimmed) && trimmed.length < 80) ||
            /^(?:FINDING|KEY INSIGHT|SECTION|CHAPTER|PART)\s*[:\-#]/i.test(trimmed);

        if (isHeader && currentSection.lines.length > 0) {
            sections.push({ ...currentSection, text: currentSection.lines.join('\n') });
            currentSection = { header: trimmed, lines: [] };
        } else if (isHeader) {
            currentSection.header = trimmed;
        } else if (trimmed.length > 0) {
            currentSection.lines.push(trimmed);
        }
    }
    // Flush remaining table
    if (inTable && tableLines.length > 0) {
        sections.push({
            header: '[TABLE DATA]',
            lines: tableLines,
            text: tableLines.join('\n'),
            isTable: true
        });
    }
    if (currentSection.lines.length > 0) {
        sections.push({ ...currentSection, text: currentSection.lines.join('\n') });
    }
    return sections;
}

export function semanticChunk(text) {
    if (!text || !text.trim()) return [];
    const trimmed = text.trim();

    let rawChunks = [];

    const sections = detectSections(trimmed);
    if (sections.length > 2) {
        rawChunks = sections.map(s => (s.header ? s.header + '\n' : '') + s.text);
    } else if (/^(?:FINDING:|•\s*\[|\d+[.)]\s*\[)/m.test(trimmed)) {
        rawChunks = trimmed.split(/(?=^(?:FINDING:|•\s*\[|\d+[.)]\s))/m);
    } else if (/^[•\-*]\s/m.test(trimmed)) {
        const bullets = trimmed.split(/(?=^[•\-*]\s)/m);
        const merged = [];
        for (const b of bullets) {
            if (merged.length > 0 && merged[merged.length - 1].length < 120 && b.length < 120) {
                // Only merge if bullets share topical keywords (prevent multi-audience Frankenstein chunks)
                const prevLower = merged[merged.length - 1].toLowerCase();
                const currLower = b.toLowerCase();
                const sharesTopic = Object.values(RES_KW).some(kws =>
                    kws.some(kw => prevLower.includes(kw)) && kws.some(kw => currLower.includes(kw))
                );
                if (sharesTopic) {
                    merged[merged.length - 1] += '\n' + b;
                } else {
                    merged.push(b);
                }
            } else {
                merged.push(b);
            }
        }
        rawChunks = merged;
    } else if (/^#{1,3}\s/m.test(trimmed)) {
        rawChunks = trimmed.split(/(?=^#{1,3}\s)/m);
    } else if (/\n{2,}/.test(trimmed)) {
        rawChunks = trimmed.split(/\n{2,}/);
    } else {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        const chunks = [];
        let current = '';
        for (const sent of sentences) {
            if (current.length + sent.length > 800 && current.length > 100) {
                chunks.push(current.trim());
                current = sent;
            } else {
                current += (current ? ' ' : '') + sent;
            }
        }
        if (current.trim()) chunks.push(current.trim());
        rawChunks = chunks;
    }

    rawChunks = rawChunks.map(c => c.trim()).filter(c => c.length > 25);

    // Merge adjacent chunks with high topic overlap
    if (rawChunks.length > 3) {
        const merged = [rawChunks[0]];
        for (let i = 1; i < rawChunks.length; i++) {
            const prev = merged[merged.length - 1];
            const curr = rawChunks[i];
            const similarity = jaccardSimilarity(prev, curr);
            if (similarity > 0.4 && (prev.length + curr.length) < 2000) {
                merged[merged.length - 1] = prev + '\n' + curr;
            } else {
                merged.push(curr);
            }
        }
        rawChunks = merged;
    }

    // Re-split oversized chunks (preserve section context)
    const finalChunks = [];
    for (const chunk of rawChunks) {
        if (chunk.length > 2000) {
            // Detect if first line is a header for context preservation
            const firstLine = chunk.split('\n')[0];
            const isHeader = /^#{1,3}\s|^\d+[.)]\s+[A-Z]|^[A-Z\s]{8,}$|^(?:FINDING|KEY INSIGHT|SECTION)/i.test(firstLine.trim());
            const contextPrefix = isHeader ? `[Context: ${firstLine.trim()}] ` : '';

            const sentences = chunk.split(/(?<=[.!?])\s+/);
            let current = '';
            let isFirst = true;
            for (const sent of sentences) {
                if (current.length + sent.length > 1200 && current.length > 200) {
                    finalChunks.push(current.trim());
                    // Prepend context to subsequent sub-chunks
                    current = isFirst ? sent : contextPrefix + sent;
                    isFirst = false;
                } else {
                    current += (current ? ' ' : '') + sent;
                }
            }
            if (current.trim()) finalChunks.push(current.trim());
        } else {
            finalChunks.push(chunk);
        }
    }

    return finalChunks;
}

// ═══ CROSS-CHUNK DEDUPLICATION ═══

function deduplicateFindings(findings) {
    if (findings.length <= 1) return findings;

    const kept = [];
    const merged = new Set();

    for (let i = 0; i < findings.length; i++) {
        if (merged.has(i)) continue;
        let best = { ...findings[i] };

        for (let j = i + 1; j < findings.length; j++) {
            if (merged.has(j)) continue;
            const similarity = jaccardSimilarity(best.text, findings[j].text);

            if (similarity > 0.6) {
                merged.add(j);
                if (findings[j].score > best.score) {
                    const oldStats = best.stats;
                    const oldEntities = best.entities;
                    best = { ...findings[j] };
                    best.stats = [...new Set([...(best.stats || []), ...(oldStats || [])])];
                    best.entities = mergeEntities(best.entities, oldEntities);
                } else {
                    best.stats = [...new Set([...(best.stats || []), ...(findings[j].stats || [])])];
                    best.entities = mergeEntities(best.entities, findings[j].entities);
                }
                best.mergedCount = (best.mergedCount || 1) + 1;
            } else if (similarity > 0.2 && best.sourceId !== findings[j].sourceId) {
                // Entity-based paraphrase detection: same facts in different words
                const sharedEntities = Object.keys(best.entities || {}).filter(type =>
                    best.entities[type]?.some(v => findings[j].entities?.[type]?.includes(v))
                ).length;
                const sharedStats = (best.stats || []).filter(s => (findings[j].stats || []).includes(s)).length;
                if (sharedEntities >= 2 && sharedStats >= 1) {
                    merged.add(j);
                    best.stats = [...new Set([...(best.stats || []), ...(findings[j].stats || [])])];
                    best.entities = mergeEntities(best.entities, findings[j].entities);
                    best.mergedCount = (best.mergedCount || 1) + 1;
                }
            }
        }
        kept.push(best);
    }

    return kept;
}

// ═══ CROSS-DOCUMENT SYNTHESIS ═══
// Finds related findings from DIFFERENT sources and creates enriched combined insights

function synthesizeAcrossSources(findings) {
    const synthesized = [];
    const usedInSynthesis = new Set();

    for (let i = 0; i < findings.length; i++) {
        for (let j = i + 1; j < findings.length; j++) {
            // Only synthesize across different sources
            if (findings[i].sourceId === findings[j].sourceId) continue;
            if (usedInSynthesis.has(i) && usedInSynthesis.has(j)) continue;

            const similarity = jaccardSimilarity(findings[i].text, findings[j].text);

            if (similarity > 0.3 && similarity <= 0.6) {
                // Related but not duplicate — synthesize!
                const primary = findings[i].score >= findings[j].score ? findings[i] : findings[j];
                const secondary = primary === findings[i] ? findings[j] : findings[i];

                // Combine unique stats and entities
                const combinedStats = [...new Set([...(primary.stats || []), ...(secondary.stats || [])])];
                const combinedEntities = mergeEntities(primary.entities, secondary.entities);

                // Extract the best sentences from the secondary to augment primary
                const secondaryUnique = secondary.text.match(/[^.!?]+[.!?]+/g) || [];
                const primarySentences = new Set(
                    (primary.text.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim().toLowerCase())
                );
                const newInsights = secondaryUnique
                    .filter(s => !primarySentences.has(s.trim().toLowerCase()))
                    .sort((a, b) => sentenceScore(b) - sentenceScore(a))
                    .slice(0, 2);

                let synthesizedText = primary.text;
                let crossValidation = null;
                if (newInsights.length > 0) {
                    crossValidation = {
                        source: secondary.sourceName,
                        insights: newInsights.map(s => s.trim()),
                    };
                }

                synthesized.push({
                    ...primary,
                    text: smartTruncate(synthesizedText, 1500),
                    crossValidation,
                    stats: combinedStats,
                    entities: combinedEntities,
                    score: primary.score + 3, // Cross-source validation bonus
                    synthesizedFrom: [
                        { id: primary.sourceId, name: primary.sourceName },
                        { id: secondary.sourceId, name: secondary.sourceName },
                    ],
                    isSynthesized: true,
                    mergedCount: (primary.mergedCount || 1) + 1,
                });

                usedInSynthesis.add(i);
                usedInSynthesis.add(j);
            }
        }
    }

    // Return: synthesized + non-synthesized originals
    const remaining = findings.filter((_, idx) => !usedInSynthesis.has(idx));
    return [...synthesized, ...remaining];
}

function mergeEntities(a = {}, b = {}) {
    const result = { ...a };
    for (const [type, values] of Object.entries(b)) {
        result[type] = [...new Set([...(result[type] || []), ...values])];
    }
    return result;
}

// ═══ SOURCE-BALANCED BATCHING ═══

function sourceBalancedBatch(findings, batchSize = 15) {
    const sourceGroups = {};
    for (const f of findings) {
        const sid = f.sourceId || '_default';
        if (!sourceGroups[sid]) sourceGroups[sid] = [];
        sourceGroups[sid].push(f);
    }

    const sourceIds = Object.keys(sourceGroups);
    const numSources = sourceIds.length;

    if (numSources <= 1) {
        // Single source — just take top N by score
        return findings.slice(0, batchSize);
    }

    // Guarantee minimum slots per source
    const minPerSource = Math.max(2, Math.floor(batchSize / (numSources + 1)));
    const flexSlots = batchSize - (minPerSource * numSources);

    const selected = [];
    const usedTexts = new Set();

    // Phase 1: Guaranteed slots — top findings from each source
    for (const sid of sourceIds) {
        const sourceFindings = sourceGroups[sid]
            .filter(f => !usedTexts.has(f.text))
            .sort((a, b) => b.score - a.score);

        for (let i = 0; i < Math.min(minPerSource, sourceFindings.length); i++) {
            selected.push(sourceFindings[i]);
            usedTexts.add(sourceFindings[i].text);
        }
    }

    // Phase 2: Flex slots — best remaining from any source
    const remaining = findings
        .filter(f => !usedTexts.has(f.text))
        .sort((a, b) => b.score - a.score);

    for (let i = 0; i < Math.min(flexSlots, remaining.length); i++) {
        selected.push(remaining[i]);
    }

    return selected.sort((a, b) => b.score - a.score);
}

// ═══ RESEARCH QUALITY DASHBOARD ═══

function assessQuality(findings, sources, conflicts) {
    const audienceCounts = { buyer: 0, seller: 0, agent: 0, nri: 0, trending: 0 };
    for (const f of findings) {
        for (const aud of (f.audiences || [])) {
            if (audienceCounts[aud] !== undefined) audienceCounts[aud]++;
        }
    }

    const totalWords = findings.reduce((s, f) => s + (f.text?.split(/\s+/).length || 0), 0);
    const totalStats = findings.reduce((s, f) => s + (f.stats?.length || 0), 0);

    // Coverage: are all audiences represented?
    const coveredAudiences = Object.entries(audienceCounts).filter(([, v]) => v > 0).length;
    const totalAudiences = Object.keys(audienceCounts).length;
    const coverage = coveredAudiences / totalAudiences;

    // Source diversity: unique topics per source
    const sourceTopics = {};
    for (const f of findings) {
        const sid = f.sourceId || '_default';
        if (!sourceTopics[sid]) sourceTopics[sid] = new Set();
        for (const aud of (f.audiences || [])) sourceTopics[sid].add(aud);
    }

    // Gaps: missing audience categories
    const gaps = Object.entries(audienceCounts)
        .filter(([, v]) => v === 0)
        .map(([aud]) => aud);

    // Suggestions
    const suggestions = [];
    if (gaps.includes('nri')) suggestions.push('Research lacks NRI-specific content. Add findings about FEMA, Power of Attorney, or NRO account rules.');
    if (gaps.includes('agent')) suggestions.push('No broker/agent content found. Add RERA compliance, commission tax (194H), or digital lead generation data.');
    if (gaps.includes('seller')) suggestions.push('Seller content is missing. Add pricing strategies, listing optimization, or capital gains tax info.');
    if (gaps.includes('buyer')) suggestions.push('No buyer-focused research found. Add due diligence tips, fraud warnings, or home loan data.');
    if (totalStats < 3) suggestions.push('Low stat density. Add more data points (%, ₹ amounts, survey numbers) for more compelling scripts.');
    if (sources.length < 2) suggestions.push('Using only 1 source. Add research from 2-3 different sources for better cross-validation.');
    if (conflicts.length > 0) suggestions.push(`${conflicts.length} conflicting data point(s) detected. Review and pick the most reliable source.`);

    // Arc balance
    const arcs = { PROBLEM: 0, DATA: 0, SOLUTION: 0, CONTEXT: 0 };
    for (const f of findings) {
        if (f.arc) arcs[f.arc]++;
    }
    if (arcs.PROBLEM === 0) suggestions.push('No PROBLEM-type findings. Add fraud cases or risk warnings for stronger AGITATE scripts.');
    if (arcs.SOLUTION === 0) suggestions.push('No SOLUTION-type findings. Add tips, guides, or platform benefits for EMPOWER scripts.');

    return {
        coverage: Math.round(coverage * 100),
        audienceCounts,
        statDensity: totalWords > 0 ? Math.round((totalStats / totalWords) * 1000) : 0,
        gaps,
        suggestions,
        arcs,
        conflicts,
        sourceDiversity: Object.fromEntries(
            Object.entries(sourceTopics).map(([k, v]) => [k, v.size])
        ),
    };
}

// ═══ MAIN RESEARCH PROCESSOR v3 — Multi-Source ═══

export function processMultiSource(sources, context, rotation) {
    // sources = [{ id, name, text }]  or just raw text string (backward compatible)
    if (typeof sources === 'string') {
        sources = [{ id: '_default', name: 'Research', text: sources }];
    }
    if (!sources || sources.length === 0) {
        return { b1: null, b2: null, b3: null, b4: null, findings: [], shockStat: null, counts: {}, quality: null, hooks: [], conflicts: [] };
    }

    // Filter out empty sources
    sources = sources.filter(s => s.text && s.text.trim().length > 25);
    if (sources.length === 0) {
        return { b1: null, b2: null, b3: null, b4: null, findings: [], shockStat: null, counts: {}, quality: null, hooks: [], conflicts: [] };
    }

    // Phase 1: Chunk each source independently, preserving source identity
    const allChunks = [];
    for (const source of sources) {
        const chunks = semanticChunk(source.text);
        for (const chunk of chunks) {
            allChunks.push({ text: chunk, sourceId: source.id, sourceName: source.name });
        }
    }

    if (allChunks.length === 0) {
        return { b1: null, b2: null, b3: null, b4: null, findings: [], shockStat: null, counts: {}, quality: null, hooks: [], conflicts: [] };
    }

    // Phase 2: Build unified TF-IDF across ALL sources
    const tfidf = buildTfIdf(allChunks.map(c => c.text));

    // Phase 3: Classify, score, tag arc, extract hooks from each chunk
    const angles = [
        ...(rotation?.ba || []).map(i => ANG.buyer[i] || ""),
        ...(rotation?.sa || []).map(i => ANG.seller[i] || ""),
        ...(rotation?.aa || []).map(i => ANG.agent[i] || ""),
        ...(rotation?.na || []).map(i => ANG.nri[i] || ""),
    ];

    const findings = allChunks.map(chunk => {
        const audiences = classifyAudience(chunk.text, tfidf);
        const pillar = classifyPillar(chunk.text, tfidf);
        const stats = extractStats(chunk.text);
        const entities = extractEntities(chunk.text);
        const score = insightScore(chunk.text, rotation?.pain, rotation?.se, angles, tfidf);
        const arc = detectArc(chunk.text);
        const processedText = smartTruncate(cleanOcrArtifacts(chunk.text), 1500);
        const topTerms = tfidf.getTopTerms(chunk.text, 3).map(t => t.term);

        return {
            text: processedText,
            audiences,
            pillar,
            stats,
            entities,
            score,
            arc,
            topTerms,
            sourceId: chunk.sourceId,
            sourceName: chunk.sourceName,
            mergedCount: 1,
        };
    });

    // Phase 4: Cross-chunk deduplication (across all findings, regardless of source)
    const dedupedFindings = deduplicateFindings(findings);

    // Phase 5: Cross-document synthesis (across different sources)
    const synthesizedFindings = synthesizeAcrossSources(dedupedFindings);

    // Phase 6: Sort by insight density
    synthesizedFindings.sort((a, b) => b.score - a.score);

    // Phase 7: Conflict detection
    const conflicts = detectConflicts(synthesizedFindings);

    // Phase 8: Extract best hooks from all text
    // Sanitize: strip table rows, pipe-heavy lines, separator lines that produce garbled hooks
    const allText = sources.map(s => s.text).join('\n\n');
    const sanitizedText = allText
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            // Skip pipe-delimited table rows (| col1 | col2 |)
            if (/^\|.+\|/.test(trimmed)) return false;
            // Skip table separator lines (|---|---|)
            if (/^[-|:]+$/.test(trimmed)) return false;
            // Skip lines with 2+ pipe chars (any table fragment)
            if ((trimmed.match(/\|/g) || []).length >= 2) return false;
            // Skip tab-heavy lines (columnar data)
            if ((trimmed.match(/\t/g) || []).length >= 2) return false;
            // Skip lines that look like data headers (# Topic Key number Audience...)
            if (/^#\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+/i.test(trimmed) && trimmed.split(/\s+/).length > 6) return false;
            // Skip numbered table row starts (1   Chennai temple land...)
            if (/^\d+\s{2,}[A-Z]/.test(trimmed)) return false;
            return true;
        })
        .join('\n');
    // Extract hooks then validate each one is a clean sentence
    const rawHooks = extractHooks(cleanOcrArtifacts(sanitizedText));
    const hooks = rawHooks.filter(h => {
        // Reject hooks that are clearly table fragments
        if (/\|/.test(h.text)) return false;
        if (/\t/.test(h.text)) return false;
        if (/^#\s+\d/.test(h.text)) return false;
        // Reject hooks that are just numbers/labels
        if (h.text.split(/\s+/).length < 6) return false;
        // Reject hooks with too many CAPS words (table headers)
        const capsWords = (h.text.match(/\b[A-Z]{2,}\b/g) || []).length;
        if (capsWords >= 3 && h.text.length < 100) return false;
        return true;
    });

    // Phase 9: Source-balanced batching per audience
    const batchFindings = { buyer: [], seller: [], agent: [], nri: [], trending: [], all: [] };
    for (const f of synthesizedFindings) {
        for (const aud of f.audiences) {
            if (batchFindings[aud]) batchFindings[aud].push(f);
        }
        if (f.pillar === "TRENDING" || f.stats.length > 0) {
            if (!batchFindings.trending.includes(f)) batchFindings.trending.push(f);
        }
        batchFindings.all.push(f);
    }

    function fmtBatch(label, items, allItems) {
        // Strict audience-filtered batching with limited backfill
        // Step 1: Use audience-matched findings first (these are genuinely relevant)
        const audiencePool = [...items].sort((a, b) => b.score - a.score);

        // Step 2: Only backfill from shared pool if audience matches are sparse
        const MIN_AUDIENCE_THRESHOLD = 8;
        const MAX_BACKFILL = 4;
        let pool;

        if (audiencePool.length >= MIN_AUDIENCE_THRESHOLD) {
            // Enough audience-specific findings — no backfill needed
            pool = audiencePool;
        } else {
            // Sparse audience data — add limited backfill from shared pool
            // Prefer items NOT already classified into other audience pools
            const backfillCandidates = allItems
                .filter(f => !items.includes(f))
                .sort((a, b) => {
                    // Prefer findings classified as fewer audiences (more unique)
                    const aUniqueness = 1 / (a.audiences?.length || 1);
                    const bUniqueness = 1 / (b.audiences?.length || 1);
                    return (b.score * bUniqueness) - (a.score * aUniqueness);
                });
            const backfill = backfillCandidates.slice(0, MAX_BACKFILL);
            pool = [...audiencePool, ...backfill];
        }

        const balanced = sourceBalancedBatch(pool, 15);
        if (!balanced.length) {
            return `<research audience="${label}" status="none">\nNo audience-specific research found this week. MANDATORY: Pull 2-3 hard stats from the Target Audience Guide stat library and weave them into scripts as proof points. At least 1 script must open with a stat-based hook using library data.\n</research>`;
        }

        const statItems = balanced.filter(f => f.stats.length > 0);
        const trendItems = balanced.filter(f => f.pillar === "TRENDING");
        const storyItems = balanced.filter(f => f.arc === "PROBLEM");
        const eduItems = balanced.filter(f => f.pillar === "EDUCATE" || f.pillar === "EMPOWER");
        const solutionItems = balanced.filter(f => f.arc === "SOLUTION");

        let out = `<research audience="${label}" findings="${balanced.length}">\n`;

        // Topic summary from TF-IDF
        const allTopTerms = balanced.flatMap(f => f.topTerms || []);
        const termCounts = {};
        for (const t of allTopTerms) termCounts[t] = (termCounts[t] || 0) + 1;
        const topTopics = Object.entries(termCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
        if (topTopics.length > 0) out += `<topics>${topTopics.join(", ")}</topics>\n`;

        // Source attribution
        const sourceNames = [...new Set(balanced.map(f => f.sourceName).filter(Boolean))];
        if (sourceNames.length > 1) out += `<sources>${sourceNames.join(" | ")}</sources>\n`;

        // Helper: format a finding with full metadata
        const fmtFinding = (f, idx) => {
            // #11: Tag findings that are mostly URLs or lack usable content
            const stripped = f.text.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
            const isUsable = stripped.length >= 40 && !/^\s*(?:#|\d+\.?\s)/.test(stripped.slice(0, 10));
            let attrs = `score="${f.score.toFixed(1)}" pillar="${f.pillar}" arc="${f.arc || 'CONTEXT'}"`;
            if (!isUsable) attrs += ' usable="false"';
            if (f.isSynthesized) attrs += ' cross_source="true"';
            if (f.mergedCount > 1) attrs += ` merged="${f.mergedCount}"`;
            if (f.sourceName) attrs += ` source="${f.sourceName}"`;
            let inner = smartTruncate(f.text, 400);
            // Append stats inline if present
            if (f.stats.length > 0) inner += `\n  <stats>${f.stats.slice(0, 3).join('; ')}</stats>`;
            // Append entities inline if present
            const eStr = Object.entries(f.entities || {})
                .filter(([, v]) => v?.length > 0)
                .map(([k, v]) => `${k}=${v.slice(0, 2).join(',')}`)
                .join(' ');
            if (eStr) inner += `\n  <entities ${eStr} />`;
            // Append cross-validation data as separate XML sub-element (not in main text)
            if (f.crossValidation) {
                inner += `\n  <cross_validation source="${f.crossValidation.source}">${f.crossValidation.insights.join(' ')}</cross_validation>`;
            }
            return `<finding id="${idx + 1}" ${attrs}>\n  ${inner}\n</finding>`;
        };

        // Track used findings across categories to prevent duplicates
        const usedTexts = new Set();
        const deduped = (items, limit) => {
            const result = [];
            for (const f of items) {
                if (usedTexts.has(f.text)) continue;
                result.push(f);
                usedTexts.add(f.text);
                if (result.length >= limit) break;
            }
            return result;
        };

        if (statItems.length) {
            const items = deduped(statItems, 5);
            if (items.length) out += `<key_stats count="${statItems.length}">\n${items.map((f, i) => fmtFinding(f, i)).join("\n")}\n</key_stats>\n`;
        }
        if (trendItems.length) {
            const items = deduped(trendItems, 3);
            if (items.length) out += `<trends count="${trendItems.length}">\n${items.map((f, i) => fmtFinding(f, i)).join("\n")}\n</trends>\n`;
        }
        if (storyItems.length) {
            const items = deduped(storyItems, 3);
            if (items.length) out += `<story_hooks count="${storyItems.length}">\n${items.map((f, i) => fmtFinding(f, i)).join("\n")}\n</story_hooks>\n`;
        }
        if (solutionItems.length) {
            const items = deduped(solutionItems, 3);
            if (items.length) out += `<solutions count="${solutionItems.length}">\n${items.map((f, i) => fmtFinding(f, i)).join("\n")}\n</solutions>\n`;
        }
        if (eduItems.length) {
            const items = deduped(eduItems, 3);
            if (items.length) out += `<insights count="${eduItems.length}">\n${items.map((f, i) => fmtFinding(f, i)).join("\n")}\n</insights>\n`;
        }

        // suggested_hooks removed — clean <key_stats> findings provide better data

        // Entity summary
        const batchEntities = {};
        for (const f of balanced) {
            for (const [type, vals] of Object.entries(f.entities || {})) {
                if (!batchEntities[type]) batchEntities[type] = new Set();
                for (const v of vals) batchEntities[type].add(v);
            }
        }
        const entityParts = Object.entries(batchEntities)
            .filter(([, vals]) => vals.size > 0)
            .map(([type, vals]) => `  <${type}>${[...vals].slice(0, 4).join(", ")}</${type}>`);
        if (entityParts.length) out += `<entity_summary>\n${entityParts.join("\n")}\n</entity_summary>\n`;

        // Conflict warnings for this batch
        const batchConflicts = conflicts.filter(c =>
            balanced.some(f => f.text.toLowerCase().includes(c.location))
        );
        if (batchConflicts.length > 0) {
            out += `<conflicts>\n${batchConflicts.map(c => `  <conflict>${c.description}</conflict>`).join("\n")}\n</conflicts>\n`;
        }

        // Narrative arc summary
        const arcCounts = { PROBLEM: 0, DATA: 0, SOLUTION: 0, CONTEXT: 0 };
        for (const f of balanced) if (f.arc) arcCounts[f.arc]++;
        const arcEntries = Object.entries(arcCounts).filter(([, v]) => v > 0);
        const arcSummary = arcEntries.map(([k, v]) => `${k}:${v}`).join(" | ");
        // #8: Add human-readable note when arc distribution is heavily skewed
        const arcTotal = arcEntries.reduce((s, [, v]) => s + v, 0);
        const dominant = arcEntries.length === 1 ? arcEntries[0] : arcEntries.find(([, v]) => v / arcTotal > 0.8);
        const skewNote = dominant
            ? ` note="${arcTotal} findings available, mostly ${dominant[0].toLowerCase()}-driven. Vary your script angles across PROBLEM/DATA/SOLUTION arcs for balance."`
            : '';
        out += `<narrative_arcs hint="PROBLEM=agitate scripts, DATA=stat-driven scripts, SOLUTION=empower scripts, CONTEXT=educate scripts"${skewNote}>${arcSummary}</narrative_arcs>\n`;

        out += `</research>`;
        return out;
    }

    // Shock stat: prefer specific, entity-rich, cross-validated stats
    // Extract first clean sentence with a stat instead of raw text truncation
    const shockStat = (() => {
        const candidates = synthesizedFindings
            .filter(f => f.stats.length > 0)
            .sort((a, b) => {
                const aBoost = (a.isSynthesized ? 3 : 0) + (a.entities?.city?.length || 0) + (a.entities?.money?.length || 0);
                const bBoost = (b.isSynthesized ? 3 : 0) + (b.entities?.city?.length || 0) + (b.entities?.money?.length || 0);
                return (b.score + bBoost) - (a.score + aBoost);
            });
        if (!candidates.length) return null;
        const best = candidates[0];
        // Find the first CLEAN sentence that contains a stat — no table fragments
        const sentences = (best.text.match(/[^.!?]+[.!?]+/g) || [best.text])
            .map(s => s.trim())
            .filter(s => {
                // Reject table rows, pipe-heavy fragments, hash-number headers
                if (/\|/.test(s)) return false;
                if (/\t/.test(s)) return false;
                if (/^#\s+\d/.test(s)) return false;
                if (/^#\s+\w/.test(s)) return false; // Any markdown header
                if (s.split(/\s+/).length < 5) return false; // Too short to be a real sentence
                // Reject table-header dumps: 3+ consecutive capitalized words (e.g. "Topic Key number Audience Pillar")
                if (/(?:[A-Z][a-z]+\s+){3,}/.test(s) && /\b(?:Audience|Pillar|Hook|Topic|Key)\b/.test(s)) return false;
                return true;
            });
        const statSentence = sentences.find(s => /\d/.test(s) && /(?:₹|Rs|%|crore|lakh|\d{2,})/i.test(s));
        const result = (statSentence || sentences[0])?.trim()?.slice(0, 200) || null;
        // Final cleanup: fix any remaining OCR artifacts and normalize spacing
        return result ? cleanOcrArtifacts(result).replace(/\s+/g, ' ').trim() : null;
    })();

    // Quality assessment
    const quality = assessQuality(synthesizedFindings, sources, conflicts);

    return {
        b1: fmtBatch("BUYER", batchFindings.buyer, batchFindings.all),
        b2: fmtBatch("SELLER", batchFindings.seller, batchFindings.all),
        b3: fmtBatch("AGENT + NRI", [...batchFindings.agent, ...batchFindings.nri], batchFindings.all),
        b4: fmtBatch("TRENDING + ALL AUDIENCES", batchFindings.trending, batchFindings.all),
        findings: synthesizedFindings,
        shockStat,
        hooks,
        conflicts,
        quality,
        counts: {
            total: synthesizedFindings.length,
            rawChunks: allChunks.length,
            synthesized: synthesizedFindings.filter(f => f.isSynthesized).length,
            deduped: allChunks.length - synthesizedFindings.length,
            buyer: batchFindings.buyer.length,
            seller: batchFindings.seller.length,
            agent: batchFindings.agent.length,
            nri: batchFindings.nri.length,
            trending: batchFindings.trending.length,
            withStats: synthesizedFindings.filter(f => f.stats.length > 0).length,
            sources: sources.length,
        }
    };
}

// Backward-compatible wrapper
export function processResearch(rawText, context, rotation) {
    return processMultiSource(rawText, context, rotation);
}

// ═══ FILE EXTRACTION (npm-powered) ═══

export async function extractPdfText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            let lastY = null;
            let line = '';
            const pageLines = [];
            for (const item of content.items) {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                    if (line.trim()) pageLines.push(line.trim());
                    line = '';
                }
                line += item.str + ' ';
                lastY = item.transform[5];
            }
            if (line.trim()) pageLines.push(line.trim());
            pages.push(pageLines.join('\n'));
        }
        const rawText = pages.join('\n\n');

        // Clean OCR ligature artifacts before any processing
        const text = cleanOcrArtifacts(rawText);

        // Strip repeating headers/footers: lines appearing on 3+ pages
        const allPageLines = pages.map(p => p.split('\n').map(l => l.trim()));
        const lineCounts = {};
        for (const pageLines of allPageLines) {
            const uniquePerPage = new Set(pageLines);
            for (const line of uniquePerPage) {
                if (line.length > 3 && line.length < 120) {
                    lineCounts[line] = (lineCounts[line] || 0) + 1;
                }
            }
        }
        const repeatingLines = new Set(
            Object.entries(lineCounts)
                .filter(([, count]) => count >= 3 && count >= Math.floor(pdf.numPages * 0.5))
                .map(([line]) => line)
        );

        // Also strip common noise patterns
        const noiseRx = /^(Page\s*\d+\s*(of\s*\d+)?|\d+\s*$|References$|Bibliography$|\u00a9.*\d{4}|www\..+\..+)/i;

        const cleanedText = text.split('\n')
            .filter(line => {
                const t = line.trim();
                if (repeatingLines.has(t)) return false;
                if (noiseRx.test(t)) return false;
                return true;
            })
            .join('\n');

        return { text: cleanedText, method: 'pdf.js', pages: pdf.numPages, chars: cleanedText.length, stripped: repeatingLines.size };
    } catch (err) {
        return { text: '', method: 'error', error: `PDF extraction failed: ${err.message}` };
    }
}

export async function extractDocxText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        return {
            text, method: 'mammoth', chars: text.length,
            warnings: result.messages.length > 0 ? result.messages.map(m => m.message) : undefined,
        };
    } catch (err) {
        return { text: '', method: 'error', error: `DOCX extraction failed: ${err.message}` };
    }
}

export async function extractFileText(file) {
    const name = file.name.toLowerCase();
    const ext = name.split('.').pop();
    if (ext === 'pdf') return extractPdfText(file);
    if (ext === 'docx') return extractDocxText(file);
    if (ext === 'doc') {
        return { text: '', method: 'unsupported', error: 'Legacy .doc format not supported. Please re-save as .docx.' };
    }
    if (['txt', 'md', 'csv', 'json'].includes(ext)) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ text: e.target.result, method: 'text', chars: e.target.result.length });
            reader.onerror = () => resolve({ text: '', method: 'error', error: 'Failed to read text file' });
            reader.readAsText(file);
        });
    }
    return { text: '', method: 'unsupported', error: `Unsupported file type: .${ext}` };
}

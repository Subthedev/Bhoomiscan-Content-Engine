// ════════════════════════════════════════════════════════════════════
// DOMAIN-TUNED NLP v2 — Intelligent Research Processing
// TF-IDF scoring, TextRank extraction, expanded synonyms, Odia/Hinglish aware
// ════════════════════════════════════════════════════════════════════

// ═══ SYNONYM MAP — 35+ domain-specific term clusters ═══
const SYNONYMS = {
    // Transaction
    buy: ["buy", "purchase", "kharid", "acquire", "invest", "booking", "possession", "allotment"],
    sell: ["sell", "list", "listing", "bech", "dispose", "offload", "unload", "resale"],
    rent: ["rent", "lease", "kiraya", "tenancy", "let out", "rental", "sublease"],

    // Property types
    land: ["land", "plot", "zameen", "jami", "basabhumi", "property", "site", "parcel", "acre", "bigha", "guntha", "hectare", "decimal"],
    flat: ["flat", "apartment", "ghar", "house", "villa", "floor", "bhk", "penthouse", "duplex", "township"],
    commercial: ["commercial", "office", "shop", "showroom", "warehouse", "godown", "mall", "retail"],

    // Legal
    fraud: ["fraud", "scam", "dhokha", "fake", "forgery", "cheat", "illegal", "encroachment", "benami", "disputed"],
    document: ["document", "dastavej", "papers", "kagaz", "deed", "registry", "registration", "mutation", "khata", "patta", "sale deed", "conveyance"],
    verify: ["verify", "verification", "check", "jaanch", "validate", "confirm", "authenticate", "due diligence", "title search"],
    rera: ["rera", "regulation", "compliance", "act", "section", "rule", "circular", "order", "niyam"],
    legal_dispute: ["dispute", "court", "case", "litigation", "judgment", "petition", "stay order", "injunction", "encumbrance"],
    registration_process: ["registration", "stamp duty", "sub-registrar", "e-registration", "igr", "kaveri", "doris"],

    // Financial
    commission: ["commission", "brokerage", "dalali", "fee", "charge", "cut", "percentage"],
    tax: ["tax", "tds", "stamp duty", "capital gains", "income tax", "gst", "194h", "section 54"],
    price: ["price", "cost", "rate", "value", "kimat", "daam", "valuation", "appraisal", "circle rate", "guideline value"],
    loan: ["loan", "mortgage", "emi", "home loan", "interest rate", "bank", "housing finance", "pmay", "nbfc"],
    investment: ["investment", "roi", "returns", "appreciation", "portfolio", "asset", "wealth", "capital gains", "yield"],

    // Actors
    buyer: ["buyer", "khariddar", "purchaser", "investor", "customer", "home buyer", "first-time buyer"],
    seller: ["seller", "bechne wala", "owner", "landlord", "maalik", "property owner"],
    agent: ["agent", "broker", "dealer", "dalal", "middleman", "mediator", "realtor", "property consultant"],
    nri: ["nri", "non-resident", "overseas", "abroad", "videsh", "foreign", "diaspora", "pravasi", "oci"],
    builder: ["builder", "developer", "promoter", "constructor", "real estate company", "realty firm"],

    // Infrastructure
    infrastructure: ["infrastructure", "road", "highway", "bridge", "flyover", "overpass", "expressway", "nh", "national highway"],
    metro: ["metro", "metro rail", "rapid transit", "mrts", "suburban rail", "commuter"],
    smart_city: ["smart city", "smart city mission", "urban development", "municipal", "bda", "bmrda"],
    airport: ["airport", "aerodrome", "aviation", "air connectivity", "terminal"],
    railway: ["railway", "rail", "station", "train", "rail corridor", "freight corridor"],
    industrial: ["industrial", "industry", "sez", "industrial park", "industrial estate", "manufacturing", "it park", "tech park"],

    // Pain points
    trust: ["trust", "bharosa", "vishwas", "reliable", "genuine", "safe", "secure", "transparent"],
    spam: ["spam", "fake leads", "time waste", "junk", "bakwas", "harassment"],
    digital: ["digital", "online", "app", "website", "internet", "tech", "platform", "proptech"],

    // Government & Policy
    government: ["government", "sarkar", "policy", "scheme", "subsidy", "ministry", "cabinet", "notification", "gazette"],
    market: ["market", "real estate market", "housing market", "property market", "realty", "sector"],
};

// Build reverse lookup: word → canonical key
const REVERSE_SYN = {};
for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    for (const syn of synonyms) {
        REVERSE_SYN[syn.toLowerCase()] = canonical;
    }
}

// ═══ PORTER STEMMER (lightweight, English-focused) ═══

const STEP2_SUFFIXES = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
];

export function porterStem(word) {
    if (word.length < 4) return word;
    let w = word.toLowerCase();

    // Step 1a: plurals
    if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('ies')) w = w.slice(0, -2);
    else if (w.endsWith('ss')) { /* keep */ }
    else if (w.endsWith('s')) w = w.slice(0, -1);

    // Step 1b: -ed, -ing
    if (w.endsWith('eed')) {
        if (w.length > 4) w = w.slice(0, -1);
    } else if (w.endsWith('ed') && /[aeiou]/.test(w.slice(0, -2))) {
        w = w.slice(0, -2);
        if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
    } else if (w.endsWith('ing') && /[aeiou]/.test(w.slice(0, -3))) {
        w = w.slice(0, -3);
        if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
    }

    // Step 1c: y → i
    if (w.endsWith('y') && w.length > 2 && !/[aeiou]/.test(w[w.length - 2])) {
        w = w.slice(0, -1) + 'i';
    }

    // Step 2: common suffixes
    for (const [suffix, replacement] of STEP2_SUFFIXES) {
        if (w.endsWith(suffix) && w.length - suffix.length > 1) {
            w = w.slice(0, -suffix.length) + replacement;
            break;
        }
    }

    return w;
}

// ═══ STOPWORDS — filter these for TF-IDF ═══
const STOPWORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
    'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they',
    'them', 'their', 'what', 'which', 'who', 'whom', 'i', 'me', 'my', 'we',
    'our', 'you', 'your', 'also', 'like', 'many', 'much', 'well', 'even',
]);

// ═══ TOKENIZER — shared utility ═══
function tokenize(text) {
    return text.toLowerCase().split(/[\s,;:.!?"\-\/()[\]{}]+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function stemTokens(tokens) {
    return tokens.map(t => porterStem(t));
}

// ═══ TF-IDF SCORING ENGINE ═══
// Builds a TF-IDF model from all chunks, then scores individual chunks against keywords

export function buildTfIdf(chunks) {
    const N = chunks.length;
    if (N === 0) return { score: () => 0, getTopTerms: () => [] };

    // Document frequency: how many chunks contain each stem
    const df = {};
    const chunkTokenSets = chunks.map(chunk => {
        const stems = new Set(stemTokens(tokenize(chunk)));
        for (const s of stems) df[s] = (df[s] || 0) + 1;
        return stems;
    });

    // IDF: log(N / df) — rarer terms get higher weight
    const idf = {};
    for (const [term, count] of Object.entries(df)) {
        idf[term] = Math.log((N + 1) / (count + 1)) + 1; // smoothed IDF
    }

    // Score a chunk against a set of keywords using TF-IDF
    function score(chunkText, keywords = []) {
        const tokens = tokenize(chunkText);
        const stems = stemTokens(tokens);
        const tf = {};
        for (const s of stems) tf[s] = (tf[s] || 0) + 1;

        // Normalize TF by chunk length
        const maxTf = Math.max(...Object.values(tf), 1);

        let total = 0;
        if (keywords.length > 0) {
            // Score against specific keywords
            for (const kw of keywords) {
                const stem = porterStem(kw.toLowerCase());
                const termTf = (tf[stem] || 0) / maxTf;
                total += termTf * (idf[stem] || 1);
            }
        } else {
            // Overall information density: sum of all significant TF-IDF values
            for (const [stem, count] of Object.entries(tf)) {
                const termTf = count / maxTf;
                const tfidf = termTf * (idf[stem] || 1);
                if (tfidf > 1.0) total += tfidf; // only count significant terms
            }
        }
        return total;
    }

    // Get top terms for a chunk (useful for topic labeling)
    function getTopTerms(chunkText, topN = 5) {
        const tokens = tokenize(chunkText);
        const stems = stemTokens(tokens);
        const tf = {};
        for (const s of stems) tf[s] = (tf[s] || 0) + 1;
        const maxTf = Math.max(...Object.values(tf), 1);

        return Object.entries(tf)
            .map(([stem, count]) => ({ term: stem, score: (count / maxTf) * (idf[stem] || 1) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);
    }

    return { score, getTopTerms, idf, df };
}

// ═══ TEXTRANK — Key Sentence Extraction ═══
// Simplified TextRank: builds sentence similarity graph, iteratively scores

export function textRank(text, topN = 5) {
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= topN) return sentences.map(s => s.trim()).filter(s => s.length > 15);

    // Build stemmed token sets for each sentence
    const sentTokens = sentences.map(s => new Set(stemTokens(tokenize(s))));

    // Compute similarity matrix (Jaccard similarity)
    const n = sentences.length;
    const similarity = Array.from({ length: n }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const intersection = [...sentTokens[i]].filter(t => sentTokens[j].has(t)).length;
            const union = new Set([...sentTokens[i], ...sentTokens[j]]).size;
            const sim = union > 0 ? intersection / union : 0;
            similarity[i][j] = sim;
            similarity[j][i] = sim;
        }
    }

    // Iterative scoring (PageRank-style)
    const d = 0.85; // damping factor
    let scores = new Float32Array(n).fill(1.0 / n);

    for (let iter = 0; iter < 20; iter++) {
        const newScores = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = 0; j < n; j++) {
                if (j === i) continue;
                const denominator = [...similarity[j]].reduce((a, b) => a + b, 0) || 1;
                sum += (similarity[j][i] / denominator) * scores[j];
            }
            newScores[i] = (1 - d) / n + d * sum;
        }
        scores = newScores;
    }

    // Return top N sentences by score, maintaining original order
    const ranked = sentences
        .map((s, i) => ({ text: s.trim(), score: scores[i], idx: i }))
        .filter(s => s.text.length > 15)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .sort((a, b) => a.idx - b.idx); // restore order

    return ranked.map(r => r.text);
}

// ═══ SENTENCE IMPORTANCE SCORER ═══
// Rates individual sentences by information density

const STAT_PATTERNS = [
    /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million|thousand|lac|cr)/i,
    /(?:₹|Rs\.?|INR)\s*\d[\d,]*\.?\d*/i,
    /\b\d{1,3}(?:,\d{3})+\b/, // large numbers like 1,50,000
];

const SOURCE_PATTERNS = [
    /according to/i, /report by/i, /survey by/i, /study by/i,
    /data from/i, /as per/i, /published by/i, /released by/i,
    /government data/i, /census/i, /rbi data/i, /niti aayog/i,
];

const RECENCY_PATTERNS = [
    /\b202[5-9]\b/, /\bthis week\b/i, /\btoday\b/i, /\byesterday\b/i,
    /\brecent\b/i, /\blatest\b/i, /\bjust\b/i, /\bbreaking\b/i,
    /\bnew rule\b/i, /\bnotification\b/i, /\bamendment\b/i,
];

const GENERIC_PATTERNS = [
    /real estate is growing/i, /market is expected/i, /experts say/i,
    /it is important to/i, /one should always/i, /everyone knows/i,
    /needless to say/i, /as we all know/i, /in today's world/i,
    /there are many/i, /various factors/i, /plays? a (?:key|vital|important|crucial) role/i,
];

export function sentenceScore(sentence) {
    let score = 0;

    // +3 for stats/numbers
    if (STAT_PATTERNS.some(rx => rx.test(sentence))) score += 3;

    // +2 for named entities (specificity)
    const entities = extractEntities(sentence);
    if (entities.state || entities.city) score += 2;
    if (entities.money) score += 1;
    if (entities.rera_id) score += 2;

    // +2 for source citation
    if (SOURCE_PATTERNS.some(rx => rx.test(sentence))) score += 2;

    // +1 for recency
    if (RECENCY_PATTERNS.some(rx => rx.test(sentence))) score += 1;

    // +1 for actionability (contains advice/instruction)
    if (/\b(must|should|always|never|tip|ensure|avoid|check|verify)\b/i.test(sentence)) score += 1;

    // +1 for proper nouns (specificity proxy)
    const properNouns = sentence.match(/\b[A-Z][a-z]{2,}\b/g);
    if (properNouns && properNouns.length >= 2) score += 1;

    // -2 for generic filler
    if (GENERIC_PATTERNS.some(rx => rx.test(sentence))) score -= 2;

    // -1 for very short sentences (likely not insightful)
    if (sentence.split(/\s+/).length < 6) score -= 1;

    return score;
}

// ═══ ENTITY EXTRACTION ═══

const ENTITY_PATTERNS = {
    money: /(?:₹|Rs\.?|INR)\s*(\d[\d,]*\.?\d*)\s*(crore|lakh|lac|cr|L|K|billion|million)?/gi,
    percentage: /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million|thousand|lac|cr|L|K)/gi,
    rera_id: /RERA\s*(?:No\.?|ID|#)?\s*[A-Z0-9\/-]+/gi,
    section: /(?:Section|Sec\.?)\s*\d+[A-Z]?(?:\s*of\s*[A-Z][a-z]+\s*Act)?/gi,
    state: /\b(Odisha|Karnataka|Maharashtra|Delhi|Gujarat|Rajasthan|Tamil Nadu|Telangana|Andhra Pradesh|West Bengal|Uttar Pradesh|Bihar|Kerala|Punjab|Haryana|Madhya Pradesh|Chhattisgarh|Jharkhand|Assam|Goa)(?:\s|,|\.|$)/gi,
    city: /\b(Bhubaneswar|Cuttack|Mumbai|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Ahmedabad|Jaipur|Lucknow|Noida|Gurugram|Gurgaon|Puri|Rourkela|Sambalpur|Berhampur|Balasore|Angul|Jharsuguda|Paradip|Vizag|Visakhapatnam|Ranchi|Patna|Bhopal|Indore|Nagpur|Surat|Kochi|Chandigarh|Rayagada|Koraput|Dhenkanal|Jeypore|Boudh|Bargarh|Baripada|Sundargarh|Navi Mumbai|Thane|Greater Noida|Faridabad|Mysuru|Coimbatore|Trivandrum)(?:\s|,|\.|$)/gi,
    date: /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}\b/gi,
};

export function extractEntities(text) {
    const entities = {};
    for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
        const matches = [];
        let m;
        const rx = new RegExp(pattern.source, pattern.flags);
        while ((m = rx.exec(text)) !== null) {
            matches.push(m[0].trim());
        }
        if (matches.length > 0) {
            entities[type] = [...new Set(matches)];
        }
    }
    return entities;
}

// ═══ NEGATION DETECTION ═══

const NEGATION_WORDS = new Set([
    'not', 'no', 'never', 'neither', 'nor', 'without', 'cannot', "can't",
    "won't", "don't", "doesn't", "isn't", "aren't", "wasn't", "weren't",
    'nahi', 'mat', 'na', 'bina', 'kabhi nahi',
]);

export function isNegated(text, keyword) {
    const lower = text.toLowerCase();
    const kwPos = lower.indexOf(keyword.toLowerCase());
    if (kwPos === -1) return false;
    const before = lower.slice(Math.max(0, kwPos - 40), kwPos).trim();
    const beforeWords = before.split(/\s+/).slice(-3);
    return beforeWords.some(w => NEGATION_WORDS.has(w));
}

// ═══ CO-OCCURRENCE SCORING ═══

export function coOccurrenceScore(text, keywords) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);
    let score = 0;

    for (let i = 0; i < words.length; i++) {
        const canonical = REVERSE_SYN[words[i]] || REVERSE_SYN[porterStem(words[i])];
        if (!canonical) continue;

        for (let j = Math.max(0, i - 5); j < Math.min(words.length, i + 6); j++) {
            if (j === i) continue;
            const nearby = REVERSE_SYN[words[j]] || REVERSE_SYN[porterStem(words[j])];
            if (nearby && nearby !== canonical) {
                score += 0.5;
            }
        }
    }

    return Math.min(score, 3);
}

// ═══ UNIFIED NLP MATCH ═══

export function nlpMatch(text, keyword) {
    const lower = text.toLowerCase();
    const kw = keyword.toLowerCase();

    // 1. Direct substring match
    if (lower.includes(kw)) {
        return !isNegated(text, kw);
    }

    // 2. Synonym match
    const canonical = REVERSE_SYN[kw];
    if (canonical) {
        const synonyms = SYNONYMS[canonical];
        for (const syn of synonyms) {
            if (syn !== kw && lower.includes(syn.toLowerCase())) {
                return !isNegated(text, syn);
            }
        }
    }

    // 3. Porter stem match
    const stemmedKw = porterStem(kw);
    const words = lower.split(/[\s,;:.!?\-\/]+/).filter(w => w.length > 2);
    for (const word of words) {
        if (porterStem(word) === stemmedKw) {
            return !isNegated(text, word);
        }
    }

    // 4. Suffix variations (legacy edge cases)
    if (lower.includes(kw + 's') || lower.includes(kw + 'es')) return true;
    if (lower.includes(kw + 'ing')) return true;
    if (lower.includes(kw + 'ed') || lower.includes(kw + 'd')) return true;

    return false;
}

// ═══ JACCARD SIMILARITY — for dedup ═══

export function jaccardSimilarity(textA, textB) {
    const setA = new Set(stemTokens(tokenize(textA)));
    const setB = new Set(stemTokens(tokenize(textB)));
    if (setA.size === 0 && setB.size === 0) return 1;
    const intersection = [...setA].filter(t => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
}

// ═══ STAT EXTRACTION ═══

export const STAT_RX = /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million|thousand|lac|cr|L|K)/gi;
export const NUM_RX = /(?:₹|Rs\.?|INR)\s*(\d[\d,]*\.?\d*)\s*(crore|lakh|lac|cr|L|K|billion|million)?/gi;

// Domain context words — stat must appear near these to be considered real
const STAT_CONTEXT_WORDS = new Set([
    'property', 'market', 'price', 'growth', 'buyer', 'seller', 'agent', 'land',
    'real', 'estate', 'invest', 'fraud', 'scam', 'loss', 'sale', 'sold', 'demand',
    'supply', 'housing', 'home', 'flat', 'plot', 'rera', 'loan', 'emi', 'tax',
    'increase', 'decrease', 'rose', 'grew', 'fell', 'dropped', 'surge', 'decline',
    'families', 'people', 'cases', 'complaints', 'transactions', 'units', 'projects',
    'registration', 'stamp', 'commission', 'brokerage', 'nri', 'odisha', 'india',
    'city', 'state', 'district', 'urban', 'rural', 'tier', 'infrastructure',
    'revenue', 'income', 'profit', 'return', 'yield', 'rent', 'rental',
]);

function hasStatContext(text, matchIndex, matchLen) {
    // Check 60 chars before and after the stat for domain context
    const before = text.slice(Math.max(0, matchIndex - 60), matchIndex).toLowerCase();
    const after = text.slice(matchIndex + matchLen, matchIndex + matchLen + 60).toLowerCase();
    const nearby = (before + ' ' + after).split(/[\s,;:.!?()\[\]]+/);
    return nearby.some(w => STAT_CONTEXT_WORDS.has(w));
}

export function extractStats(text) {
    const stats = [];
    let m;
    const rx1 = /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million|thousand|lac|cr)/gi;
    while ((m = rx1.exec(text)) !== null) {
        if (hasStatContext(text, m.index, m[0].length)) stats.push(m[0].trim());
    }
    const rx2 = /(?:₹|Rs\.?|INR)\s*\d[\d,]*\.?\d*\s*(?:crore|lakh|lac|cr|L|K|billion|million)?/gi;
    while ((m = rx2.exec(text)) !== null) {
        // Currency amounts are almost always real stats, lighter validation
        stats.push(m[0].trim());
    }
    return [...new Set(stats)];
}

// ═══ SMART TRUNCATION v2 — TextRank-based for long texts ═══

export function smartTruncate(text, maxLen = 1500) {
    if (!text || text.length <= maxLen) return text;

    // For long chunks, use TextRank to extract key sentences instead of hard cut
    if (text.length > maxLen * 1.5) {
        const keySentences = textRank(text, Math.ceil(maxLen / 200));
        const extracted = keySentences.join(' ');
        if (extracted.length > 0 && extracted.length <= maxLen) return extracted;
        // Fall through to hard truncation if TextRank result is too long
    }

    const truncated = text.slice(0, maxLen);
    const lastSentence = Math.max(
        truncated.lastIndexOf('. '), truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? '), truncated.lastIndexOf('.\n'),
        truncated.lastIndexOf('!\n'), truncated.lastIndexOf('?\n')
    );
    if (lastSentence > maxLen * 0.4) return truncated.slice(0, lastSentence + 1).trim();
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.5) return truncated.slice(0, lastSpace).trim() + '…';
    return truncated.trim() + '…';
}

// ═══ HOOK/QUOTE EXTRACTOR — finds script-ready opening lines ═══

export function extractHooks(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const hooks = [];

    for (const sent of sentences) {
        const trimmed = sent.trim();
        if (trimmed.length < 20 || trimmed.length > 250) continue;

        let hookScore = 0;
        let hookType = 'general';

        // Stat-opener: "67% of buyers...", "₹2,400 crore in losses..."
        if (/^\d[\d,]*\.?\d*\s*(%|percent|crore|lakh|billion|million)/i.test(trimmed) ||
            /^(?:₹|Rs\.?|INR)\s*\d/i.test(trimmed)) {
            hookScore += 5;
            hookType = 'stat-opener';
        }

        // Mid-sentence stat (still strong)
        if (/(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh)/i.test(trimmed)) {
            hookScore += 3;
            if (hookType === 'general') hookType = 'stat-hook';
        }

        // Rhetorical question
        if (/^(did you know|what if|what happens|have you ever|why do|how many|imagine)/i.test(trimmed) ||
            /\?$/.test(trimmed)) {
            hookScore += 4;
            hookType = 'question';
        }

        // Shock/contrast: "still", "despite", "but", "yet", "shocking"
        if (/\b(still|despite|but|yet|shocking|surprising|unbelievable|alarming)\b/i.test(trimmed)) {
            hookScore += 2;
            if (hookType === 'general') hookType = 'shock';
        }

        // Named entity specificity
        const ents = extractEntities(trimmed);
        if (ents.city || ents.state) hookScore += 1;
        if (ents.money) hookScore += 1;

        // Recency
        if (/\b202[5-9]\b/.test(trimmed)) hookScore += 1;

        if (hookScore >= 3) {
            hooks.push({ text: trimmed, score: hookScore, type: hookType });
        }
    }

    return hooks.sort((a, b) => b.score - a.score).slice(0, 10);
}

// ═══ NARRATIVE ARC DETECTOR — tags findings for story structure ═══

const ARC_PATTERNS = {
    PROBLEM: [
        /\b(scam|fraud|fake|loss|risk|danger|dispute|penalty|illegal|victim|horror|nightmare|fail|wrong|trap|mistake)\b/i,
        /\b(suffer|cheat|harass|complain|exploit|defraud|mislead|betray)\b/i,
        /\b(don't|doesn't|can't|won't|unable|lack|absence|without|no\s+(?:access|support|protection))\b/i,
    ],
    DATA: [
        /(\d[\d,]*\.?\d*)\s*(%|percent|crore|lakh|billion|million)/i,
        /(?:₹|Rs\.?|INR)\s*\d/i,
        /\b(according to|report|survey|study|data|research|statistics|census|index)\b/i,
        /\b(increased|decreased|grew|rose|fell|dropped|surged|declined)\s+(?:by\s+)?\d/i,
    ],
    SOLUTION: [
        /\b(tip|guide|how to|step|strategy|solution|fix|save|protect|ensure|verify|check|use|download|register|always)\b/i,
        /\b(BhoomiScan|platform|app|service|tool|system|portal)\b/i,
        /\b(simple|easy|quick|free|safe|secure|verified|trusted|transparent)\b/i,
    ],
};

export function detectArc(text) {
    const scores = { PROBLEM: 0, DATA: 0, SOLUTION: 0 };

    for (const [arc, patterns] of Object.entries(ARC_PATTERNS)) {
        for (const rx of patterns) {
            if (rx.test(text)) scores[arc]++;
        }
    }

    const max = Math.max(...Object.values(scores));
    if (max === 0) return 'CONTEXT';

    // DATA patterns are broader (match any numbers/stats), so when DATA ties
    // or barely leads over PROBLEM or SOLUTION, prefer the more specific arc
    if (scores.DATA > 0 && (scores.PROBLEM > 0 || scores.SOLUTION > 0)) {
        scores.DATA = Math.max(0, scores.DATA - 1);
    }

    const adjusted = Math.max(...Object.values(scores));
    if (adjusted === 0) return 'CONTEXT';

    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0][0];
}

// ═══ CONFLICT DETECTION — flags contradictory claims ═══

export function detectConflicts(findings) {
    const conflicts = [];

    // Extract numeric claims with context
    const claims = findings.map((f, idx) => {
        const claimData = [];
        const text = f.text || '';
        const entities = f.entities || {};
        const locations = [...(entities.city || []), ...(entities.state || [])].map(l => l.toLowerCase().trim());

        // Find numeric claims: "X grew/rose/increased/decreased Y%"
        const numPatterns = [
            /(\w[\w\s]*?)\s+(?:grew|rose|increased|surged|jumped)\s+(?:by\s+)?(\d[\d,]*\.?\d*)\s*(%|percent)/gi,
            /(\w[\w\s]*?)\s+(?:fell|dropped|declined|decreased|shrunk)\s+(?:by\s+)?(\d[\d,]*\.?\d*)\s*(%|percent)/gi,
            /(\d[\d,]*\.?\d*)\s*(%|percent)\s+(?:of\s+)?(\w[\w\s]*?)\s+(?:grew|increased|rose|fell|dropped|declined)/gi,
        ];

        for (const rx of numPatterns) {
            let m;
            const r = new RegExp(rx.source, rx.flags);
            while ((m = r.exec(text)) !== null) {
                const direction = /fell|dropped|declined|decreased|shrunk/i.test(m[0]) ? 'down' : 'up';
                claimData.push({
                    findingIdx: idx,
                    sourceId: f.sourceId,
                    sourceName: f.sourceName || 'unknown',
                    fullMatch: m[0].trim(),
                    direction,
                    locations,
                });
            }
        }
        return claimData;
    }).flat();

    // Compare claims from different sources
    for (let i = 0; i < claims.length; i++) {
        for (let j = i + 1; j < claims.length; j++) {
            const a = claims[i], b = claims[j];
            // Skip if same source
            if (a.sourceId === b.sourceId) continue;

            // Check if they mention any common location
            const commonLoc = a.locations.filter(l => b.locations.includes(l));

            // Check for directional conflict (one says up, other says down)
            if (commonLoc.length > 0 && a.direction !== b.direction) {
                conflicts.push({
                    type: 'directional',
                    location: commonLoc[0],
                    claimA: { source: a.sourceName, text: a.fullMatch, direction: a.direction },
                    claimB: { source: b.sourceName, text: b.fullMatch, direction: b.direction },
                    description: `⚠ CONFLICTING: "${a.sourceName}" says ${commonLoc[0]} went ${a.direction}, but "${b.sourceName}" says it went ${b.direction}`,
                });
            }
        }
    }

    return conflicts;
}

// ═══ CLAIM EXTRACTION — identifies factual claims with numbers ═══

export function extractClaims(text) {
    if (!text || !text.trim()) return [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const claims = [];

    // Patterns for claims with concrete data
    const valueRx = /(?:₹|Rs\.?|INR)\s*[\d,.]+\s*(?:crore|lakh|thousand|cr|L)?|[\d,.]+\s*%|\d[\d,.]*\s*(?:crore|lakh|million|billion|thousand)/gi;
    const directionRx = /\b(?:increase[ds]?|decrease[ds]?|rise[ns]?|rose|fell|drop(?:ped)?|grew|growth|decline[ds]?|surge[ds]?|jump(?:ed)?|slump(?:ed)?|double[ds]?|triple[ds]?)\b/gi;
    const locationRx = /\b(?:India|Odisha|Bhubaneswar|Cuttack|Puri|Bangalore|Mumbai|Delhi|Hyderabad|Pune|Chennai|Kolkata|Ahmedabad|Jaipur|Lucknow|Gurgaon|Noida|Goa|Kerala|Karnataka|Maharashtra|Tamil Nadu|Andhra Pradesh|Telangana|Gujarat|Rajasthan|Bihar|UP|Uttar Pradesh|West Bengal|Madhya Pradesh)\b/gi;

    for (const sent of sentences) {
        const trimmed = sent.trim();
        if (trimmed.length < 15) continue;

        const values = trimmed.match(valueRx) || [];
        const directions = trimmed.match(directionRx) || [];
        const locations = [...new Set((trimmed.match(locationRx) || []).map(l => l.trim()))];

        if (values.length === 0 && directions.length === 0) continue;

        // Determine direction
        let direction = 'neutral';
        const upWords = /increase|rise|rose|grew|growth|surge|jump|double|triple/i;
        const downWords = /decrease|fell|drop|decline|slump/i;
        for (const d of directions) {
            if (upWords.test(d)) direction = 'up';
            else if (downWords.test(d)) direction = 'down';
        }

        // Confidence based on specificity
        let confidence = 'low';
        if (values.length > 0 && locations.length > 0) confidence = 'high';
        else if (values.length > 0 || (directions.length > 0 && locations.length > 0)) confidence = 'medium';

        claims.push({
            claim: trimmed.slice(0, 200),
            values,
            direction,
            locations,
            confidence,
        });
    }

    return claims;
}

// ═══ HOOKABILITY SCORER — rates potential as spoken hook opener ═══

export function scoreHookability(text) {
    if (!text || !text.trim()) return 0;
    const trimmed = text.trim();
    let score = 5; // Start at 5/10

    const wordCount = trimmed.split(/\s+/).length;

    // ✅ Short, punchy sentences (< 15 words) are better hooks
    if (wordCount <= 10) score += 2;
    else if (wordCount <= 15) score += 1;
    else if (wordCount > 25) score -= 1;
    else if (wordCount > 35) score -= 2;

    // ✅ Starts with a number or stat — instant attention
    if (/^(?:₹|Rs|INR|\d)/.test(trimmed)) score += 2;
    // ✅ Contains a question — creates curiosity gap
    if (/\?/.test(trimmed)) score += 1.5;
    // ✅ Uses "you" / "tum" / "aap" — direct address
    if (/\b(?:you|tum|tumhare|aap|apka|apni)\b/i.test(trimmed)) score += 1;
    // ✅ Contains a specific number
    if (/\d/.test(trimmed)) score += 1;
    // ✅ Contains shock/urgency words
    if (/\b(?:scam|fraud|danger|warning|alert|mistake|galti|dhoka|loss|lost|doob|barbaad|khatre)\b/i.test(trimmed)) score += 1.5;
    // ✅ Short declarative punch (imperative or exclamation)
    if (/!$/.test(trimmed) && wordCount <= 12) score += 1;

    // ❌ Penalize passive voice / jargon
    if (/\b(?:it is|there are|it has been|one should|it can be|is expected to)\b/i.test(trimmed)) score -= 2;
    // ❌ Penalize long compound sentences
    if (/\b(?:however|furthermore|moreover|additionally|consequently)\b/i.test(trimmed)) score -= 1.5;
    // ❌ Penalize generic openings
    if (/^(?:In this|According to|It is important|Real estate)\b/i.test(trimmed)) score -= 2;
    // ❌ Penalize technical jargon without context
    if (/\b(?:pursuant to|vis-a-vis|notwithstanding|thereof|herein|aforesaid)\b/i.test(trimmed)) score -= 2;

    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

// ═══ ANGLE RELEVANCE SCORER — scores text fit for a content angle ═══

export function angleRelevance(text, angle) {
    if (!text || !angle) return 0;
    const lower = text.toLowerCase();
    const angleWords = angle.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    if (!angleWords.length) return 0;

    let score = 0;
    let matchCount = 0;

    for (const word of angleWords) {
        // Direct match
        if (lower.includes(word)) {
            matchCount++;
            score += 2;
            continue;
        }
        // Synonym-aware match via nlpMatch
        if (nlpMatch(lower, word)) {
            matchCount++;
            score += 1.5;
            continue;
        }
        // Stem match (partial)
        const stem = word.slice(0, Math.max(4, Math.ceil(word.length * 0.6)));
        if (lower.includes(stem)) {
            matchCount++;
            score += 1;
        }
    }

    // Coverage bonus: reward matching a high proportion of angle words
    const coverage = matchCount / angleWords.length;
    if (coverage >= 0.8) score += 3;
    else if (coverage >= 0.5) score += 2;
    else if (coverage >= 0.3) score += 1;

    // Normalize to 0-10 scale
    const maxPossible = angleWords.length * 2 + 3; // max score possible
    return Math.min(10, Math.round((score / maxPossible) * 10 * 10) / 10);
}

export { SYNONYMS, REVERSE_SYN, STOPWORDS, tokenize, stemTokens };

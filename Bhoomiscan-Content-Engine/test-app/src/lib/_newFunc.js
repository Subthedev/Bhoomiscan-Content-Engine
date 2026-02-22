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

    // ═══ STRATEGY 4: Unstructured/concatenated text ═══
    const flat = text.replace(/\n/g, ' ');

    // 4a: S\d{1,2} followed by a known hook name (highest confidence)
    const hookAnchorRe = new RegExp(`S(\\\\d{1,2})\\\\s*(?:${HOOK_PATTERN})`, 'gi');
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

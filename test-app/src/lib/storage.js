import { supabase } from './supabase.js';

const LS_KEY = 'bhoomiscan-v3';

// ═══ SUPABASE STORAGE (with localStorage fallback) ═══

/**
 * Load engine state — returns { history, lastGen } or null.
 * Tries Supabase first, falls back to localStorage.
 */
export async function loadState() {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('content_engine_weeks')
                .select('*')
                .order('year', { ascending: true })
                .order('week_number', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                const history = data.map(row => {
                    // Load logs array — fall back to single-entry from log_notes for old rows
                    const logs = Array.isArray(row.rotation?.logs) && row.rotation.logs.length > 0
                        ? row.rotation.logs
                        : (row.log_notes ? [{ ts: row.updated_at || '', label: 'Log 1', text: row.log_notes, perf: row.perf_notes || '' }] : []);
                    const latestPerf = logs.length > 0 ? (logs[logs.length - 1].perf || '') : (row.perf_notes || '');
                    return {
                        wk: row.week_number,
                        yr: row.year,
                        mo: row.month,
                        se: row.season || row.rotation?.se || null,
                        pat: row.pattern,
                        ang: row.rotation?.ang || {},
                        hooks: row.rotation?.hooks || [],
                        ctas: row.rotation?.ctas || [],
                        pains: row.rotation?.pains || [],
                        emo: row.rotation?.emo || null,
                        dt: row.rotation?.dt || null,
                        logs,
                        perf: latestPerf, // latest entry's perf for getPerfWeights backward compat
                        research: row.research_raw || '',
                        mults: row.multipliers || {},
                        ts: row.updated_at || null,
                    };
                });
                const lastRow = data[data.length - 1];
                return { history, lastGen: lastRow.updated_at || lastRow.created_at };
            }
            // No data in Supabase yet — try migrating from localStorage
            const local = loadLocal();
            if (local?.history?.length) {
                console.log('Migrating localStorage data to Supabase...');
                // Don't block on migration — just start it
                migrateToSupabase(local).catch(console.error);
            }
            return local;
        } catch (err) {
            console.warn('Supabase load failed, using localStorage:', err.message);
            return loadLocal();
        }
    }
    return loadLocal();
}

/**
 * Save current week's generation to Supabase.
 * localStorage is handled separately by saveState() via useEffect in App.jsx.
 */
export async function saveWeek(weekData) {
    if (!supabase) return false;

    try {
        const logs = Array.isArray(weekData.logs) ? weekData.logs : [];
        const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
        const { error } = await supabase
            .from('content_engine_weeks')
            .upsert({
                week_number: weekData.wk,
                year: weekData.yr,
                month: weekData.mo,
                season: weekData.se || null,
                pattern: weekData.pat || null,
                rotation: {
                    ang: weekData.ang || {},
                    hooks: weekData.hooks || [],
                    ctas: weekData.ctas || [],
                    pains: weekData.pains || [],
                    emo: weekData.emo || null,
                    dt: weekData.dt || null,
                    se: weekData.se || null,
                    logs, // full array of { ts, label, text, perf, mults } entries
                },
                research_raw: weekData.research || null,
                research_processed: weekData.findings || null,
                prompts: weekData.prompts || null,
                // log_notes / perf_notes: keep latest entry's text for any legacy column reads
                log_notes: latestLog?.text || null,
                perf_notes: latestLog?.perf || weekData.perf || null,
                multipliers: weekData.mults || null,
                shock_stat: weekData.shockStat || null,
                updated_at: weekData.ts || new Date().toISOString(),
            }, {
                onConflict: 'week_number,year',
            });

        if (error) throw error;
        return true;
    } catch (err) {
        console.warn('Supabase save failed:', err.message);
        return false;
    }
}

/**
 * Save full state (history array format) — used for bulk operations.
 */
export async function saveState(state) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
        return true;
    } catch {
        return false;
    }
}

/**
 * Get full generation history for display.
 */
export async function getHistory() {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('content_engine_weeks')
                .select('*')
                .order('year', { ascending: false })
                .order('week_number', { ascending: false })
                .limit(52);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('Supabase history fetch failed:', err.message);
        }
    }
    // Fallback to localStorage
    const state = loadLocal();
    return state?.history || [];
}

/**
 * Export full state as JSON (for backup/download).
 */
export function exportState() {
    try {
        return localStorage.getItem(LS_KEY);
    } catch {
        return null;
    }
}

/**
 * Import state from JSON backup.
 */
export async function importState(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (!data.history) throw new Error('Invalid format');
        localStorage.setItem(LS_KEY, jsonStr);
        // Also push to Supabase if available
        if (supabase && data.history.length) {
            await migrateToSupabase(data);
        }
        return data;
    } catch (err) {
        throw new Error('Import failed: ' + err.message);
    }
}

// ═══ LOCALSTORAGE HELPERS ═══

function loadLocal() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveLocal(weekData) {
    try {
        const existing = loadLocal() || { history: [], lastGen: null };

        // Find and update existing week, or append
        const idx = existing.history.findIndex(w => w.wk === weekData.wk && w.yr === weekData.yr);
        const entry = {
            wk: weekData.wk,
            yr: weekData.yr,
            mo: weekData.mo,
            pat: weekData.pat,
            ang: weekData.ang,
            hooks: weekData.hooks,
            log: weekData.log || '',
            perf: weekData.perf || '',
            mults: weekData.mults || {},
        };

        if (idx >= 0) {
            existing.history[idx] = entry;
        } else {
            existing.history.push(entry);
        }
        existing.lastGen = new Date().toISOString();
        localStorage.setItem(LS_KEY, JSON.stringify(existing));
    } catch {
        console.warn('localStorage save failed');
    }
}

async function migrateToSupabase(state) {
    if (!supabase || !state?.history) return;

    for (const week of state.history) {
        try {
            // Normalize to logs array (old records may have log: string)
            const logs = Array.isArray(week.logs) && week.logs.length > 0
                ? week.logs
                : (week.log ? [{ ts: week.ts || '', label: 'Log 1', text: week.log, perf: week.perf || '' }] : []);
            const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
            await supabase.from('content_engine_weeks').upsert({
                week_number: week.wk,
                year: week.yr,
                month: week.mo,
                season: week.se || null,
                pattern: week.pat,
                rotation: {
                    ang: week.ang || {},
                    hooks: week.hooks || [],
                    ctas: week.ctas || [],
                    pains: week.pains || [],
                    emo: week.emo || null,
                    dt: week.dt || null,
                    se: week.se || null,
                    logs,
                },
                log_notes: latestLog?.text || null,
                perf_notes: latestLog?.perf || week.perf || null,
                multipliers: week.mults || null,
                updated_at: week.ts || new Date().toISOString(),
            }, { onConflict: 'week_number,year' });
        } catch {
            // Skip individual failures during migration
        }
    }
    console.log(`Migrated ${state.history.length} weeks to Supabase`);
}

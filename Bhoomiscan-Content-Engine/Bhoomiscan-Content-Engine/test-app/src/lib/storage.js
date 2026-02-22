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
                const history = data.map(row => ({
                    wk: row.week_number,
                    yr: row.year,
                    mo: row.month,
                    pat: row.pattern,
                    ang: row.rotation?.ang || {},
                    hooks: row.rotation?.hooks || [],
                    log: row.log_notes || '',
                    perf: row.perf_notes || '',
                    research: row.research_raw || '',
                    mults: row.multipliers || {},
                }));
                const lastRow = data[data.length - 1];
                return { history, lastGen: lastRow.created_at };
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
 * Save current week's generation to Supabase (and localStorage as backup).
 */
export async function saveWeek(weekData) {
    // Always save to localStorage as backup
    saveLocal(weekData);

    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('content_engine_weeks')
            .upsert({
                week_number: weekData.wk,
                year: weekData.yr,
                month: weekData.mo,
                season: weekData.season || null,
                pattern: weekData.pat || null,
                rotation: {
                    ang: weekData.ang || {},
                    hooks: weekData.hooks || [],
                    pain: weekData.pain || null,
                    se: weekData.se || null,
                },
                research_raw: weekData.research || null,
                research_processed: weekData.findings || null,
                prompts: weekData.prompts || null,
                log_notes: weekData.log || null,
                perf_notes: weekData.perf || null,
                multipliers: weekData.mults || null,
                shock_stat: weekData.shockStat || null,
                updated_at: new Date().toISOString(),
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
            await supabase.from('content_engine_weeks').upsert({
                week_number: week.wk,
                year: week.yr,
                month: week.mo,
                pattern: week.pat,
                rotation: { ang: week.ang || {}, hooks: week.hooks || [] },
                log_notes: week.log || null,
                perf_notes: week.perf || null,
                multipliers: week.mults || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'week_number,year' });
        } catch {
            // Skip individual failures during migration
        }
    }
    console.log(`Migrated ${state.history.length} weeks to Supabase`);
}

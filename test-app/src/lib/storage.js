import { supabase } from './supabase.js';

const LS_KEY = 'bhoomiscan-v3';

// ═══ SUPABASE STORAGE (with localStorage fallback) ═══

/**
 * Load engine state — returns { history, lastGen } or null.
 * Tries Supabase first, then merges with localStorage to recover any
 * data that failed to persist to Supabase (e.g. silent RLS failures).
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
                const history = data.map(rowToWeek);

                // ── Merge with localStorage (3-pass recovery) ─────────────────────
                // Supabase upserts can silently fail (RLS UPDATE blocked returns
                // no error but also writes nothing). localStorage is always current
                // since saveState runs synchronously via useEffect. We use it as
                // the source of truth when it has more data than Supabase.
                const localData = loadLocal();
                if (localData?.history?.length) {
                    let repaired = 0;

                    // Pass 1: update Supabase weeks where localStorage has more/better data
                    for (let i = 0; i < history.length; i++) {
                        const lw = localData.history.find(
                            w => w.wk === history[i].wk && w.yr === history[i].yr
                        );
                        if (!lw) continue;
                        const localLogs = normaliseLogs(lw);
                        const sbLogs = history[i].logs || [];

                        // Use localStorage if it has more log entries OR if Supabase
                        // is missing rotation fields that localStorage has
                        const sbMissingPains = !(history[i].pains?.length > 0);
                        const sbMissingHooks = !(history[i].hooks?.length > 0);
                        const needsMerge = localLogs.length > sbLogs.length || sbMissingPains || sbMissingHooks;

                        if (needsMerge) {
                            history[i] = mergeWeek(history[i], lw, localLogs);
                            repaired++;
                            // Attempt async Supabase repair (fire-and-forget)
                            saveWeek(history[i]).catch(() => {});
                        }
                    }

                    // Pass 2: add weeks that exist in localStorage but NOT in Supabase
                    for (const lw of localData.history) {
                        const inSb = history.some(h => h.wk === lw.wk && h.yr === lw.yr);
                        if (!inSb) {
                            const localLogs = normaliseLogs(lw);
                            // Only recover if it has meaningful data
                            if (localLogs.length > 0 || lw.pat || lw.hooks?.length > 0) {
                                history.push({ ...lw, logs: localLogs });
                                repaired++;
                                saveWeek({ ...lw, logs: localLogs }).catch(() => {});
                            }
                        }
                    }

                    // Re-sort chronologically after any additions
                    if (repaired > 0) {
                        history.sort((a, b) =>
                            a.yr !== b.yr ? a.yr - b.yr : a.wk - b.wk
                        );
                        console.log(`[loadState] Recovered ${repaired} week(s) from localStorage`);
                    }
                }

                const lastRow = data[data.length - 1];
                return { history, lastGen: lastRow.updated_at || lastRow.created_at };
            }

            // No Supabase data yet — migrate from localStorage
            const local = loadLocal();
            if (local?.history?.length) {
                console.log('Migrating localStorage data to Supabase...');
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
 * Uses .select() to detect silent write failures caused by RLS policies
 * that allow the call but block the actual row write (returns no error but
 * also returns no rows). Returns false on any failure so callers can surface
 * the error to the user instead of silently losing data.
 */
export async function saveWeek(weekData) {
    if (!supabase) return false;

    try {
        const logs = Array.isArray(weekData.logs) ? weekData.logs : [];
        const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
        const { data, error } = await supabase
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
                log_notes: latestLog?.text || null,
                perf_notes: latestLog?.perf || weekData.perf || null,
                multipliers: weekData.mults || null,
                shock_stat: weekData.shockStat || null,
                updated_at: weekData.ts || new Date().toISOString(),
            }, {
                onConflict: 'week_number,year',
            })
            .select('week_number, year'); // ← detect silent RLS failures

        if (error) throw error;

        // If RLS blocks the write, Supabase returns no error but no rows either
        if (!data || data.length === 0) {
            throw new Error(
                `Supabase upsert returned no rows for W${weekData.wk}/${weekData.yr} ` +
                `— RLS may be blocking anonymous writes on this table`
            );
        }

        return true;
    } catch (err) {
        console.warn('Supabase save failed:', err.message);
        return false;
    }
}

/**
 * Save full state to localStorage — called via useEffect in App.jsx on every
 * state change. This is the primary persistence safety net.
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
        if (supabase && data.history.length) {
            await migrateToSupabase(data);
        }
        return data;
    } catch (err) {
        throw new Error('Import failed: ' + err.message);
    }
}

// ═══ INTERNAL HELPERS ═══

/** Map a Supabase row to a week record. */
function rowToWeek(row) {
    const logs = Array.isArray(row.rotation?.logs) && row.rotation.logs.length > 0
        ? row.rotation.logs
        : (row.log_notes
            ? [{ ts: row.updated_at || '', label: 'Log 1', text: row.log_notes, perf: row.perf_notes || '' }]
            : []);
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
        perf: latestPerf,
        research: row.research_raw || '',
        mults: row.multipliers || {},
        ts: row.updated_at || null,
    };
}

/** Normalise a localStorage week record's logs into an array. */
function normaliseLogs(lw) {
    if (Array.isArray(lw.logs) && lw.logs.length > 0) return lw.logs;
    if (lw.log) return [{ ts: lw.ts || '', label: 'Log 1', text: lw.log, perf: lw.perf || '' }];
    return [];
}

/**
 * Merge a Supabase week record with a localStorage week record.
 * localStorage is assumed to be more up-to-date (more log entries or
 * rotation fields that Supabase is missing).
 */
function mergeWeek(sbWeek, localWeek, localLogs) {
    return {
        ...sbWeek,
        logs: localLogs,
        // Restore rotation fields from localStorage when Supabase has them empty
        // (handles records saved before the pains/ang schema was fully wired up)
        pains: sbWeek.pains?.length > 0 ? sbWeek.pains : (localWeek.pains || []),
        ang: (sbWeek.ang && Object.keys(sbWeek.ang).length > 0)
            ? sbWeek.ang : (localWeek.ang || {}),
        hooks: sbWeek.hooks?.length > 0 ? sbWeek.hooks : (localWeek.hooks || []),
        ctas: sbWeek.ctas?.length > 0 ? sbWeek.ctas : (localWeek.ctas || []),
        emo: sbWeek.emo != null ? sbWeek.emo : localWeek.emo,
        se: sbWeek.se || localWeek.se || null,
        dt: sbWeek.dt || localWeek.dt || null,
        pat: sbWeek.pat || localWeek.pat || null,
    };
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

async function migrateToSupabase(state) {
    if (!supabase || !state?.history) return;

    for (const week of state.history) {
        try {
            const logs = normaliseLogs(week);
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

// ═══ ROTATION ENGINE v4 — VERIFICATION TEST SUITE ═══
// Tests all 7 fixes applied to the rotation engine

import { shuf, pickLru, allocCtas, enforceHookCompat, calc, WEEK_HOOKS, classifyAngle } from './rotation.js';

let passed = 0, failed = 0, total = 0;

function assert(condition, label) {
    total++;
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        console.log(`  ❌ FAIL: ${label}`);
    }
}

// ═══ FIX 1: pickLru cold-start + week tracking ═══
console.log('\n🧪 FIX 1: pickLru — cold-start & week tracking');

// Empty history: should still produce valid picks
const empty1 = pickLru(13, [], 5, 101, 1);
const empty2 = pickLru(13, [], 5, 202, 2);
assert(empty1.length === 5, 'Empty history returns 5 items');
assert(new Set(empty1).size === 5, 'Empty history: no duplicates');

// Cold-start spread: weeks 1 and 2 should use different indices
const overlap = empty1.filter(x => empty2.includes(x));
assert(overlap.length <= 2, `Cold-start weeks have ≤2 overlap (got ${overlap.length})`);

// With history: angles used recently should be deprioritized
const hist = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]];
const afterHist = pickLru(13, hist, 5, 505, 5);
assert(afterHist.includes(10) || afterHist.includes(11) || afterHist.includes(12),
    'After 2 weeks: unused angles (10/11/12) get priority');

// Staleness boost: angles not used for 4+ weeks should get boosted
const longHist = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [0, 1, 2, 3, 4]];
const stale = pickLru(13, longHist, 5, 303, 6);
assert(stale.includes(10) || stale.includes(11) || stale.includes(12),
    'Staleness boost: never-used angles appear');

// ═══ FIX 2: Independent Week C/D ═══
console.log('\n🧪 FIX 2: Independent Week C/D patterns');

// All 4 weeks should exist and have 20 hooks each
assert(WEEK_HOOKS.length === 4, '4 week patterns exist');
assert(WEEK_HOOKS.every(w => w.length === 20), 'Each week has 20 hooks');

// No positional collisions between any two weeks
let maxCollisions = 0;
for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
        let collisions = 0;
        for (let k = 0; k < 20; k++) {
            if (WEEK_HOOKS[i][k] === WEEK_HOOKS[j][k]) collisions++;
        }
        maxCollisions = Math.max(maxCollisions, collisions);
    }
}
assert(maxCollisions <= 5, `Cross-week position collisions ≤5 (got ${maxCollisions})`);

// Each per-batch slice (5 hooks) should have reasonable variety
for (let w = 0; w < 4; w++) {
    for (let b = 0; b < 4; b++) {
        const batch = WEEK_HOOKS[w].slice(b * 5, b * 5 + 5);
        const unique = new Set(batch).size;
        assert(unique >= 4, `Week ${['A', 'B', 'C', 'D'][w]} batch ${b + 1}: ≥4 unique hooks (got ${unique})`);
    }
}

// ═══ FIX 3: enforceHookCompat — 3 fallbacks + warnings ═══
console.log('\n🧪 FIX 3: enforceHookCompat — 3 fallback levels');

// Test with hooks that need swapping
const result1 = enforceHookCompat([5, 1, 3, 10, 2], ["legal doc", "FEMA rules", "checklist", "verify", "weekend tip"], 42);
assert(result1.hooks !== undefined, 'Returns { hooks, warnings } object');
assert(result1.warnings !== undefined, 'Has warnings array');
assert(result1.hooks.length === 5, 'Hooks array maintained');

// Test adversarial case: force fallback 3
// Legal angle avoids [5, 6]. If all batch hooks are 5/6 except one...
const adversarial = enforceHookCompat([5, 5, 5, 5, 5], ["legal doc", "general", "general", "general", "general"], 42);
assert(!adversarial.hooks.includes(undefined), 'No undefined hooks in adversarial case');

// ═══ FIX 4: allocCtas — guaranteed no duplicates ═══
console.log('\n🧪 FIX 4: allocCtas — guaranteed unique CTAs per batch');

let dupBatches = 0;
for (let wk = 1; wk <= 52; wk++) {
    const r = allocCtas(wk * 173);
    for (const bk of ['b1', 'b2', 'b3', 'b4']) {
        if (new Set(r[bk]).size !== r[bk].length) dupBatches++;
    }
}
assert(dupBatches === 0, `Zero duplicate-containing batches across 52 weeks (got ${dupBatches})`);

// Verify batch sizes
const sample = allocCtas(42);
assert(sample.b1.length === 5 && sample.b2.length === 5 && sample.b3.length === 5 && sample.b4.length === 5,
    'All batches have exactly 5 CTAs');

// ═══ FIX 5: Cross-week dedup for all batches ═══
console.log('\n🧪 FIX 5: Cross-week dedup covers b3/b4');

// calc() with prev hooks should dedup all batches
const r1 = calc(1, 1, []);
const history = [{ hooks: [...r1.hB.b1, ...r1.hB.b2, ...r1.hB.b3, ...r1.hB.b4] }];
const r2 = calc(2, 1, history);
// Check b3 specifically (was not deduped before)
let b3Collisions = 0;
for (let i = 0; i < 5; i++) {
    if (r1.hB.b3[i] === r2.hB.b3[i]) b3Collisions++;
}
assert(b3Collisions <= 2, `b3 cross-week collisions ≤2 (got ${b3Collisions})`);

// ═══ FIX 6: Year-aware seeds ═══
console.log('\n🧪 FIX 6: Year-aware seeds');

const y2025 = calc(1, 1, [], 2025);
const y2026 = calc(1, 1, [], 2026);
const sameAngles = y2025.ba.every((v, i) => v === y2026.ba[i]);
assert(!sameAngles, 'Week 1 produces different angles in 2025 vs 2026');

// calc returns warnings
assert(Array.isArray(y2025.warnings), 'calc() returns warnings array');

// ═══ SUMMARY ═══
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${passed}/${total} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

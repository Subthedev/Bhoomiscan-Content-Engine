# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BhoomiScan Content Engine — a real estate (land/plot) content generation platform for the Indian market. Two main sub-projects:

1. **test-app/** — React web app (Vite, JSX) that serves as the Content Engine UI. Generates social media content scripts using rotation logic, prompt templates, and research processing. Persists state to Supabase.
2. **bhoomiscan-video-engine/** — Remotion-based video generation pipeline (TypeScript). Renders property listing videos with voiceover (Sarvam AI), uploads to Cloudinary/Supabase Storage.
3. **bhoomiscan-engine.jsx** — Legacy standalone content engine component (single file).

## Commands

### Content Engine (test-app/)
```bash
cd test-app
npm run dev      # Vite dev server
npm run build    # Production build
```

### Video Engine (bhoomiscan-video-engine/)
```bash
cd bhoomiscan-video-engine
npm run studio                # Remotion Studio (visual preview)
npm run serve                 # HTTP API server on port 3456
npm run generate -- --id=<uuid>   # Generate video for one property
npm run generate -- --all         # Generate for all properties without video
npm run generate:test         # Test render (no voiceover, no upload)
npm run render:test           # Test render by property ID
npm run voiceover:test        # Test voiceover generation only
```

## Architecture

### Video Engine Pipeline (bhoomiscan-video-engine/src/pipeline.ts)
The pipeline is checkpoint-based and cost-aware:
1. Fetch property from Supabase → 2. Check for existing local render → 3. Analyze content + select photos (parallel) → 4. Generate voiceover (Sarvam API, ~₹0.5) → 5. Render with Remotion → 6. Upload (Cloudinary → Supabase fallback) → 7. Update DB

Key principle: never lose a rendered video; if upload fails, save local path for retry. Never double-pay for voiceover.

- **serve.ts** — HTTP API wrapping the pipeline (endpoints: /health, /generate, /generate-queued, /jobs, /cancel/:id)
- **src/types.ts** — Core types (ListingVideoProps, VideoVariant, PlotType)
- **src/sections/** — Remotion video section components (IntroHook, PhotoShowcase, DetailsCard, etc.)
- **src/analysis/** — Content analysis, photo selection, video analysis
- **src/voiceover/** — Script generation + Sarvam TTS integration
- **src/utils/** — Theme, animations, timing, typography, safe zones

### Content Engine (test-app/src/)
- **App.jsx** — Main component, manages state and views
- **lib/rotation.js** — Content rotation logic (hooks, CTAs, pain cycles, scheduling rules)
- **lib/prompt-builder.js** — Builds AI prompts for content generation
- **lib/storage.js** — Supabase persistence with RLS-aware upsert (DELETE+INSERT fallback)
- **lib/video-api.js** — Client for the video engine HTTP API
- **lib/research-processor.js** — Processes research inputs from files/URLs

### Geo/Map System (bhoomiscan-video-engine/src/geo/)
Cinematic satellite map animations added between IntroHook and PhotoShowcase. All external APIs are FREE.

- **amenityFetcher.ts** — Overpass API amenity discovery (hospitals, schools, highways, airports, malls, temples, parks)
- **geoExtractor.ts** — Orchestrator: DB check → geocode → write-back → landmarks → amenities → boundaries → plot → routes
- **geocoder.ts** — Nominatim geocoding with cascading fallback (full address → locality+city → city+state)
- **boundaryFetcher.ts** — Overpass API for state/district GeoJSON boundaries
- **routeFetcher.ts** — OSRM routing with polyline decoding
- **plotEstimator.ts** — Approximate rectangular plot polygon from plotSize + dimensions
- **cache.ts** — File-system cache in `public/geo/cache/` with TTL (geocode: 30d, boundaries: 90d, routes: 7d, amenity: 14d)
- **rateLimiter.ts** — Token-bucket rate limiter (Nominatim 1/sec, Overpass 2/sec, OSRM 10/sec)
- **mapAnimations.ts** — Two-phase camera interpolation: Phase 1 zoom-in (state→plot), Phase 2 zoom-out (amenity reveal with neon green routes)
- **mapStyles.ts** — Mapbox GL layer styles (gold boundaries, emerald districts, neon green amenity routes with glow)
- **routeAnimator.ts** — Partial polyline rendering for animated route trace

Pipeline flow: `extractGeoData()` runs in parallel with photo/video analysis. If geo data available, MapSequence section is inserted (6-10s), extending video to 37-44s. With amenities (>=2 discovered), two-phase animation plays: zoom-in then zoom-out with neon green route traces to nearby POIs. Without geo, existing 30s video is unchanged.

### Amenity Discovery (bhoomiscan-video-engine/src/geo/amenityFetcher.ts)
Single compound Overpass query discovers nearby POIs (hospital, school, highway, airport, mall, temple, park). Takes closest per category, sorts by priority, returns top 5. OSRM routes fetched in parallel for road distances. Results cached 14 days. Components: AmenityPin (neon green circle), AmenityLabel (neon green distance + name). Screen positions computed from bearing angle relative to plot center.

CLI flag: `--no-geo` skips geo extraction. Env: `MAPBOX_ACCESS_TOKEN` required for map rendering.

Supabase migration needed: `ALTER TABLE properties ADD COLUMN latitude double precision; ALTER TABLE properties ADD COLUMN longitude double precision;`

## Key Technical Details

- Supabase RLS is active — storage layer uses DELETE+INSERT fallback when UPDATE is blocked by row-level security
- Video output is 1080x1920 (9:16 vertical) at 30fps
- Three video variants: `spotlight`, `area-context`, `availability`
- Environment variables needed: Supabase URL/key, Sarvam API key, Cloudinary credentials, MAPBOX_ACCESS_TOKEN (for map animations)
- The video engine runs as a separate process from the web app, communicating via HTTP API on port 3456
- react-map-gl v8 uses subpath imports: `import { Map } from "react-map-gl/mapbox"` (NOT `from "react-map-gl"`)
- TypeScript check: `node node_modules/typescript/lib/tsc.js --noEmit` (npx tsc may fail due to broken symlink)

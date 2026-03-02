/**
 * Video Generation API — Supabase + Video Engine integration for the Video tab.
 * Reads from Supabase (anon key), writes via admin client (service role key).
 * Triggers actual video rendering via the Vite server's embedded video engine API.
 * The Vite dev server spawns Remotion pipeline as child processes — no separate server needed.
 */
import { supabase, supabaseAdmin } from './supabase.js';

// ── Config ──
// The video engine API is embedded in the Vite dev server (same origin)
const VIDEO_API_BASE = '/api/video';
const STUCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Use admin client for writes (bypasses RLS), fall back to anon for reads
const writeClient = () => supabaseAdmin || supabase;

// ── Check if the Video Engine is available (embedded in Vite server) ──

export async function checkEngineHealth() {
  try {
    const res = await fetch(`${VIDEO_API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return { online: true, ...(await res.json()) };
  } catch (_) { /* not available */ }
  return { online: false };
}

// ── Fetch all published properties with images and video status ──

export async function fetchProperties() {
  if (!supabase) {
    console.warn('[video-api] Supabase not configured');
    return { data: [], error: 'Supabase not configured' };
  }

  const { data, error } = await supabase
    .from('properties')
    .select(`
      id, title, description, address, city, state, price, area, area_unit, type,
      video_url, video_thumbnail_url, video_duration,
      video_generation_status, video_generation_config, video_generated_at,
      is_verified, seller_type, verification_tier,
      features, nearby_landmarks,
      created_at,
      property_images (id, image_url, is_primary, display_order),
      profiles!properties_owner_id_fkey (full_name)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[video-api] fetchProperties error:', error.message, error.details, error.hint);
    return await fetchPropertiesSimple();
  }

  return { data: mapProperties(data), error: null };
}

/** Fallback: fetch without profile join if FK hint fails */
async function fetchPropertiesSimple() {
  const { data, error } = await supabase
    .from('properties')
    .select(`
      id, title, description, address, city, state, price, area, area_unit, type,
      video_url, video_thumbnail_url, video_duration,
      video_generation_status, video_generation_config, video_generated_at,
      is_verified, seller_type, verification_tier,
      features, nearby_landmarks,
      created_at,
      property_images (id, image_url, is_primary, display_order)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[video-api] fetchPropertiesSimple error:', error.message);
    return { data: [], error: error.message };
  }

  return { data: mapProperties(data), error: null };
}

function mapProperties(data) {
  return (data || []).map(p => {
    const images = (p.property_images || [])
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return (a.display_order || 0) - (b.display_order || 0);
      });
    const features = p.features || {};
    return {
      ...p,
      imageCount: images.length,
      primaryImage: images[0]?.image_url || null,
      sellerName: p.profiles?.full_name || 'Unknown',
      featureCount: [features.roadAccess, features.waterSupply, features.electricity, features.fencing].filter(Boolean).length,
      landmarkCount: (p.nearby_landmarks || []).length,
      // Has a seller-uploaded video (not Remotion-generated)
      hasSellerVideo: !!p.video_url && !p.video_generated_at,
      // Has a Remotion walkthrough video
      hasWalkthroughVideo: !!p.video_generated_at,
      // Upload failed but video was rendered (can retry upload for free)
      isUploadFailed: p.video_generation_status === 'upload_failed',
      canRetryUpload: p.video_generation_config?.canRetryUpload === true,
      property_images: undefined,
      profiles: undefined,
    };
  });
}

// ── Trigger video generation — marks DB + calls engine API ──

export async function triggerVideoGeneration(propertyId, options = {}) {
  const client = writeClient();
  if (!client) return { error: 'Supabase not configured' };

  const config = {
    variant: options.variant || 'spotlight',
    voiceover: options.voiceover !== false,
    upload: options.upload !== false,
    topTicker: options.topTicker || null,
    bottomTicker: options.bottomTicker || null,
    queuedAt: new Date().toISOString(),
  };

  // 1. Mark as queued in DB (real-time sub will pick this up for UI)
  const { error } = await client
    .from('properties')
    .update({
      video_generation_status: 'queued',
      video_generation_config: config,
    })
    .eq('id', propertyId);

  if (error) {
    console.error('[video-api] triggerVideoGeneration DB error:', error.message);
    return { error: error.message };
  }

  // 2. Call the embedded video engine API (runs in Vite dev server)
  let engineTriggered = false;
  try {
    const res = await fetch(`${VIDEO_API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        options: {
          variant: config.variant,
          skipVoiceover: !config.voiceover,
          skipUpload: !config.upload,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      engineTriggered = true;
      console.log('[video-api] Engine accepted generation for', propertyId);
    } else {
      const txt = await res.text();
      console.warn('[video-api] Engine rejected:', txt);
    }
  } catch (e) {
    console.warn('[video-api] Engine API not reachable:', e.message);
  }

  return { error: null, engineTriggered };
}

// ── Queue multiple properties (batch) ──

export async function triggerBatchGeneration(propertyIds, options = {}) {
  const results = { queued: 0, failed: 0, errors: [], engineTriggered: false };
  for (const id of propertyIds) {
    const { error, engineTriggered } = await triggerVideoGeneration(id, options);
    if (error) {
      results.failed++;
      results.errors.push(`${id}: ${error}`);
    } else {
      results.queued++;
      if (engineTriggered) results.engineTriggered = true;
    }
  }
  return results;
}

// ── Fetch Remotion-generated walkthrough videos ONLY (not seller uploads) ──

export async function getWalkthroughVideos() {
  if (!supabase) return { data: [], error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('properties')
    .select(`
      id, title, address, city, state, price, area, area_unit, type,
      video_url, video_thumbnail_url, video_duration,
      video_generated_at, video_generation_status, video_generation_config,
      property_images (id, image_url, is_primary, display_order)
    `)
    .not('video_generated_at', 'is', null)
    .order('video_generated_at', { ascending: false });

  if (error) {
    console.error('[video-api] getWalkthroughVideos error:', error.message);
    return { data: [], error: error.message };
  }

  const videos = (data || []).map(p => {
    const images = (p.property_images || [])
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return (a.display_order || 0) - (b.display_order || 0);
      });
    return {
      ...p,
      primaryImage: images[0]?.image_url || null,
      property_images: undefined,
    };
  });

  return { data: videos, error: null };
}

// ── Fetch currently queued or rendering properties ──

export async function getActiveJobs() {
  if (!supabase) return { data: [], error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('properties')
    .select('id, title, city, price, video_generation_status, video_generation_config')
    .in('video_generation_status', ['queued', 'rendering', 'upload_failed']);

  if (error) {
    console.error('[video-api] getActiveJobs error:', error.message);
    return { data: [], error: error.message };
  }
  return { data: data || [], error: null };
}

// ── Reset stuck jobs (queued > 5min without progressing to rendering) ──

export async function resetStuckJobs() {
  const client = writeClient();
  if (!client) return { reset: 0 };

  const { data } = await client
    .from('properties')
    .select('id, video_generation_config')
    .in('video_generation_status', ['queued', 'rendering']);

  let reset = 0;
  for (const p of (data || [])) {
    const queuedAt = p.video_generation_config?.queuedAt;
    if (queuedAt && (Date.now() - new Date(queuedAt).getTime()) > STUCK_TIMEOUT_MS) {
      await client.from('properties').update({
        video_generation_status: null,
        video_generation_config: null,
      }).eq('id', p.id);
      reset++;
      console.log(`[video-api] Reset stuck job: ${p.id}`);
    }
  }
  return { reset };
}

// ── Cancel video generation ──

export async function cancelVideoGeneration(propertyId) {
  const client = writeClient();
  if (!client) return { error: 'Supabase not configured' };

  // Cancel in DB
  const { error } = await client
    .from('properties')
    .update({
      video_generation_status: null,
      video_generation_config: null,
    })
    .eq('id', propertyId);

  // Also try to cancel in the embedded engine
  try {
    await fetch(`${VIDEO_API_BASE}/cancel/${propertyId}`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
  } catch (_) { /* ignore */ }

  return { error: error?.message || null };
}

// ── Retry upload for a rendered-but-failed-to-upload video (FREE — no re-render) ──

export async function retryVideoUpload(propertyId) {
  // Call the embedded engine's retry-upload endpoint
  try {
    const res = await fetch(`${VIDEO_API_BASE}/retry-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      console.log('[video-api] Retry upload triggered for', propertyId);
      return { error: null, triggered: true };
    }
    const txt = await res.text();
    return { error: `Engine rejected: ${txt}`, triggered: false };
  } catch (e) {
    return { error: `Engine not reachable: ${e.message}`, triggered: false };
  }
}

// ── Subscribe to real-time status changes ──

export function subscribeToVideoUpdates(callback) {
  if (!supabase) return null;

  try {
    const channel = supabase
      .channel('video-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'properties',
        },
        (payload) => {
          if (payload.new?.video_generation_status !== undefined || payload.new?.video_url) {
            callback(payload.new);
          }
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('[video-api] Real-time subscription failed:', err);
    return null;
  }
}

export function unsubscribeFromVideoUpdates(channel) {
  if (channel && supabase) {
    supabase.removeChannel(channel);
  }
}

// ── Helpers ──

export function fmtPrice(price) {
  if (!price) return '—';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString('en-IN')}`;
}

export function fmtArea(area, unit) {
  if (!area) return '—';
  return `${Number(area).toLocaleString('en-IN')} ${unit || 'sq.ft'}`;
}

export function timeSince(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Estimate generation progress from queued timestamp */
export function estimateProgress(config) {
  if (!config?.queuedAt) return { percent: 0, stage: 'Queued', elapsed: 0 };
  const elapsed = (Date.now() - new Date(config.queuedAt).getTime()) / 1000;
  const stages = [
    { name: 'Analyzing', end: 5 },
    { name: 'Voiceover', end: 20 },
    { name: 'Bundling', end: 35 },
    { name: 'Rendering', end: 75 },
    { name: 'Uploading', end: 90 },
  ];
  const pct = Math.min(95, (elapsed / 90) * 100);
  const stage = stages.find(s => elapsed < s.end) || stages[stages.length - 1];
  return { percent: Math.round(pct), stage: stage.name, elapsed: Math.round(elapsed) };
}

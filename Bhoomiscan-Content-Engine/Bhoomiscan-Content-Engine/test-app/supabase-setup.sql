-- ═══════════════════════════════════════════════════════════════
-- BHOOMISCAN CONTENT ENGINE — Supabase Table Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- Create the main content engine table
CREATE TABLE IF NOT EXISTS content_engine_weeks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Week identification
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  pattern TEXT, -- A/B/C/D
  
  -- Rotation data (stored as JSONB for flexibility)
  rotation JSONB DEFAULT '{}'::jsonb,
  -- Contains: { ang: {buyer:[], seller:[], agent:[], nri:[]}, hooks:[], ctas:[], pains:[], emo: number }
  
  -- Research & output
  research_raw TEXT, -- raw research text (truncated to 2KB)
  multipliers JSONB DEFAULT '{}'::jsonb, -- freshness multiplier tags
  
  -- Logging
  log_notes TEXT, -- variation log from Claude output
  perf_notes TEXT, -- performance tracking data
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Uniqueness constraint: one entry per week per year
  UNIQUE(week_number, year)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_content_engine_weeks_year_week 
  ON content_engine_weeks(year, week_number);

-- Enable Row Level Security (open for now — tighten later if needed)
ALTER TABLE content_engine_weeks ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (since this is a single-user tool)
CREATE POLICY "Allow all access" ON content_engine_weeks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_engine_weeks_updated_at
  BEFORE UPDATE ON content_engine_weeks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

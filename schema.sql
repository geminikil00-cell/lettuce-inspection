-- ============================================================
-- Lettuce Inspection — Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database
-- ============================================================

CREATE TABLE parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE farm_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE farm_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farm_name, name)
);

CREATE TABLE inspector_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_name TEXT NOT NULL,
  plot_name TEXT DEFAULT '',
  inspector_name TEXT NOT NULL,
  receiving_date TEXT NOT NULL,
  receiving_time TEXT NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspection_counts (
  inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
  parameter_id UUID REFERENCES parameters(id) ON DELETE CASCADE,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (inspection_id, parameter_id)
);

-- Seed default parameters
INSERT INTO parameters (name, color) VALUES
  ('Good',    '#22c55e'),
  ('Damaged', '#ef4444'),
  ('Bruised', '#eab308'),
  ('Rotten',  '#7c3aed'),
  ('Other',   '#6b7280');

-- ============================================================
-- RLS Policies — public read/write (no auth, on-site tool)
-- ============================================================

ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_params" ON parameters FOR SELECT USING (true);
CREATE POLICY "anon_insert_params" ON parameters FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_params" ON parameters FOR UPDATE USING (true);
CREATE POLICY "anon_delete_params" ON parameters FOR DELETE USING (true);

ALTER TABLE farm_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_farms" ON farm_names FOR SELECT USING (true);
CREATE POLICY "anon_insert_farms" ON farm_names FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete_farms" ON farm_names FOR DELETE USING (true);

ALTER TABLE farm_plots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_plots" ON farm_plots FOR SELECT USING (true);
CREATE POLICY "anon_insert_plots" ON farm_plots FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete_plots" ON farm_plots FOR DELETE USING (true);

ALTER TABLE inspector_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_inspectors" ON inspector_names FOR SELECT USING (true);
CREATE POLICY "anon_insert_inspectors" ON inspector_names FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete_inspectors" ON inspector_names FOR DELETE USING (true);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_inspects" ON inspections FOR SELECT USING (true);
CREATE POLICY "anon_insert_inspects" ON inspections FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_inspects" ON inspections FOR UPDATE USING (true);

ALTER TABLE inspection_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_counts" ON inspection_counts FOR SELECT USING (true);
CREATE POLICY "anon_insert_counts" ON inspection_counts FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_counts" ON inspection_counts FOR UPDATE USING (true);
CREATE POLICY "anon_delete_counts" ON inspection_counts FOR DELETE USING (true);

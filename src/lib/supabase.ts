import { createClient } from '@supabase/supabase-js';

export interface DbParameter {
  id: string;
  name: string;
  color: string;
  is_defect: boolean;
  created_at: string;
}

export interface DbFarmName {
  id: string;
  name: string;
  created_at: string;
}

export interface DbFarmPlot {
  id: string;
  farm_name: string;
  name: string;
  created_at: string;
}

export interface DbInspectorName {
  id: string;
  name: string;
  created_at: string;
}

export interface DbInspection {
  id: string;
  farm_name: string;
  plot_name?: string;
  inspector_name: string;
  receiving_date: string;
  receiving_time: string;
  stock_id?: string;
  submitted_at?: string;
  created_at: string;
}

export interface DbInspectionCount {
  inspection_id: string;
  parameter_id: string;
  count: number;
}

export interface DbStock {
  id: string;
  farm_name: string;
  plot_name: string;
  receiving_date: string;
  pallets: number;
  created_at: string;
}

export interface DbShipment {
  id: string;
  dispatched_at: string;
  created_at: string;
}

export interface DbShipmentItem {
  id: string;
  shipment_id: string;
  stock_id?: string;
  farm_name: string;
  plot_name: string;
  receiving_date: string;
  pallets: number;
  created_at: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or Cloudflare Pages dashboard.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

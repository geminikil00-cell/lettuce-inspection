import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type {
  DbParameter,
  DbFarmName,
  DbInspectorName,
  DbInspection,
  DbInspectionCount,
} from '../lib/supabase';
import type { Parameter, Inspection } from '../types';

interface AppState {
  parameters: Parameter[];
  inspections: Inspection[];
  farmNames: string[];
  inspectorNames: string[];
  loading: boolean;
  error: string | null;
}

interface SupabaseContextType extends AppState {
  refresh: () => Promise<void>;
  addParameter: (name: string, color: string) => Promise<Parameter | null>;
  updateParameter: (id: string, name: string, color: string) => Promise<void>;
  deleteParameter: (id: string) => Promise<void>;
  addInspection: (inspection: Omit<Inspection, 'id' | 'createdAt'>) => Promise<Inspection | null>;
  updateCounts: (inspectionId: string, counts: Record<string, number>) => Promise<void>;
  addFarmName: (name: string) => Promise<void>;
  deleteFarmName: (name: string) => Promise<void>;
  addInspectorName: (name: string) => Promise<void>;
  deleteInspectorName: (name: string) => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | null>(null);

function mapInspection(db: DbInspection, counts: Record<string, number>): Inspection {
  return {
    id: db.id,
    farmName: db.farm_name,
    inspectorName: db.inspector_name,
    receivingDate: db.receiving_date,
    receivingTime: db.receiving_time,
    createdAt: db.created_at,
    counts,
  };
}

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    parameters: [],
    inspections: [],
    farmNames: [],
    inspectorNames: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [
        paramsRes,
        farmsRes,
        inspectorsRes,
        inspectionsRes,
        countsRes,
      ] = await Promise.all([
        supabase.from('parameters').select('*').order('created_at'),
        supabase.from('farm_names').select('*').order('name'),
        supabase.from('inspector_names').select('*').order('name'),
        supabase
          .from('inspections')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('inspection_counts').select('*'),
      ]);

      if (paramsRes.error) throw paramsRes.error;
      if (farmsRes.error) throw farmsRes.error;
      if (inspectorsRes.error) throw inspectorsRes.error;
      if (inspectionsRes.error) throw inspectionsRes.error;
      if (countsRes.error) throw countsRes.error;

      const params = (paramsRes.data as DbParameter[]).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      }));

      const farmNames = (farmsRes.data as DbFarmName[]).map((f) => f.name);
      const inspectorNames = (inspectorsRes.data as DbInspectorName[]).map(
        (i) => i.name,
      );

      const countMap: Record<string, Record<string, number>> = {};
      (countsRes.data as DbInspectionCount[]).forEach((c) => {
        if (!countMap[c.inspection_id]) countMap[c.inspection_id] = {};
        countMap[c.inspection_id][c.parameter_id] = c.count;
      });

      const inspections = (inspectionsRes.data as DbInspection[]).map((db) =>
        mapInspection(db, countMap[db.id] ?? {}),
      );

      setState({ parameters: params, inspections, farmNames, inspectorNames, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load data',
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addParameter = useCallback(
    async (name: string, color: string) => {
      const { data, error } = await supabase
        .from('parameters')
        .insert({ name, color })
        .select('*')
        .single();
      if (error) throw error;
      await refresh();
      return { id: data.id, name: data.name, color: data.color };
    },
    [refresh],
  );

  const updateParameter = useCallback(
    async (id: string, name: string, color: string) => {
      const { error } = await supabase
        .from('parameters')
        .update({ name, color })
        .eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const deleteParameter = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('parameters')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const addInspection = useCallback(
    async (inspection: Omit<Inspection, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('inspections')
        .insert({
          farm_name: inspection.farmName,
          inspector_name: inspection.inspectorName,
          receiving_date: inspection.receivingDate,
          receiving_time: inspection.receivingTime,
        })
        .select('*')
        .single();
      if (error) throw error;

      const db = data as DbInspection;

      const countRows = Object.entries(inspection.counts).map(
        ([parameter_id, count]) => ({
          inspection_id: db.id,
          parameter_id,
          count,
        }),
      );

      if (countRows.length > 0) {
        await supabase.from('inspection_counts').insert(countRows);
      }

      await refresh();
      return mapInspection(db, inspection.counts);
    },
    [refresh],
  );

  const updateCounts = useCallback(
    async (inspectionId: string, counts: Record<string, number>) => {
      const rows = Object.entries(counts).map(([parameter_id, count]) => ({
        inspection_id: inspectionId,
        parameter_id,
        count,
      }));
      await supabase.from('inspection_counts').upsert(rows, {
        onConflict: 'inspection_id,parameter_id',
      });
      await refresh();
    },
    [refresh],
  );

  const addFarmName = useCallback(
    async (name: string) => {
      const { error } = await supabase.from('farm_names').insert({ name });
      if (error) {
        if (error.code === '23505') return;
        throw error;
      }
      await refresh();
    },
    [refresh],
  );

  const deleteFarmName = useCallback(
    async (name: string) => {
      const { error } = await supabase
        .from('farm_names')
        .delete()
        .eq('name', name);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const addInspectorName = useCallback(
    async (name: string) => {
      const { error } = await supabase
        .from('inspector_names')
        .insert({ name });
      if (error) {
        if (error.code === '23505') return;
        throw error;
      }
      await refresh();
    },
    [refresh],
  );

  const deleteInspectorName = useCallback(
    async (name: string) => {
      const { error } = await supabase
        .from('inspector_names')
        .delete()
        .eq('name', name);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return (
    <SupabaseContext.Provider
      value={{
        ...state,
        refresh,
        addParameter,
        updateParameter,
        deleteParameter,
        addInspection,
        updateCounts,
        addFarmName,
        deleteFarmName,
        addInspectorName,
        deleteInspectorName,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return ctx;
}

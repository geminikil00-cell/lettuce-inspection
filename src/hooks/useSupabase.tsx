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
  DbFarmPlot,
  DbInspectorName,
  DbInspection,
  DbInspectionCount,
} from '../lib/supabase';
import type { Parameter, Inspection } from '../types';

interface AppState {
  parameters: Parameter[];
  inspections: Inspection[];
  farmNames: string[];
  farmPlots: Record<string, string[]>;
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
  updateInspection: (id: string, metadata: Omit<Inspection, 'id' | 'createdAt' | 'counts'>) => Promise<void>;
  updateCounts: (inspectionId: string, counts: Record<string, number>) => Promise<void>;
  setSubmitted: (id: string) => Promise<void>;
  addFarmName: (name: string) => Promise<void>;
  deleteFarmName: (name: string) => Promise<void>;
  addFarmPlot: (farmName: string, plotName: string) => Promise<void>;
  deleteFarmPlot: (farmName: string, plotName: string) => Promise<void>;
  addInspectorName: (name: string) => Promise<void>;
  deleteInspectorName: (name: string) => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | null>(null);

function mapInspection(db: DbInspection, counts: Record<string, number>): Inspection {
  return {
    id: db.id,
    farmName: db.farm_name,
    plotName: db.plot_name,
    inspectorName: db.inspector_name,
    receivingDate: db.receiving_date,
    receivingTime: db.receiving_time,
    submittedAt: db.submitted_at,
    createdAt: db.created_at,
    counts,
  };
}

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    parameters: [],
    inspections: [],
    farmNames: [],
    farmPlots: {},
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
        plotsRes,
        inspectorsRes,
        inspectionsRes,
        countsRes,
      ] = await Promise.all([
        supabase.from('parameters').select('*').order('created_at'),
        supabase.from('farm_names').select('*').order('name'),
        supabase.from('farm_plots').select('*').order('name'),
        supabase.from('inspector_names').select('*').order('name'),
        supabase
          .from('inspections')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('inspection_counts').select('*'),
      ]);

      if (paramsRes.error) throw paramsRes.error;
      if (farmsRes.error) throw farmsRes.error;
      if (plotsRes.error && plotsRes.error.code !== '42P01') throw plotsRes.error; // Ignore if table doesn't exist yet
      if (inspectorsRes.error) throw inspectorsRes.error;
      if (inspectionsRes.error) throw inspectionsRes.error;
      if (countsRes.error) throw countsRes.error;

      const params = (paramsRes.data as DbParameter[]).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      }));

      const farmNames = (farmsRes.data as DbFarmName[]).map((f) => f.name);
      const farmPlots: Record<string, string[]> = {};
      if (plotsRes.data) {
        (plotsRes.data as DbFarmPlot[]).forEach((p) => {
          if (!farmPlots[p.farm_name]) farmPlots[p.farm_name] = [];
          farmPlots[p.farm_name].push(p.name);
        });
      }

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

      setState({ parameters: params, inspections, farmNames, farmPlots, inspectorNames, loading: false, error: null });
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
          plot_name: inspection.plotName || '',
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

  const updateInspection = useCallback(
    async (id: string, metadata: Omit<Inspection, 'id' | 'createdAt' | 'counts'>) => {
      const { error } = await supabase
        .from('inspections')
        .update({
          farm_name: metadata.farmName,
          plot_name: metadata.plotName || '',
          inspector_name: metadata.inspectorName,
          receiving_date: metadata.receivingDate,
          receiving_time: metadata.receivingTime,
        })
        .eq('id', id);
      if (error) throw error;
      await refresh();
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

  const setSubmitted = useCallback(
    async (id: string) => {
      await supabase
        .from('inspections')
        .update({ submitted_at: new Date().toISOString() })
        .eq('id', id);
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

  const addFarmPlot = useCallback(
    async (farmName: string, plotName: string) => {
      const { error } = await supabase.from('farm_plots').insert({ farm_name: farmName, name: plotName });
      if (error) {
        if (error.code === '23505') return;
        throw error;
      }
      await refresh();
    },
    [refresh],
  );

  const deleteFarmPlot = useCallback(
    async (farmName: string, plotName: string) => {
      const { error } = await supabase
        .from('farm_plots')
        .delete()
        .match({ farm_name: farmName, name: plotName });
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
        updateInspection,
        updateCounts,
        setSubmitted,
        addFarmName,
        deleteFarmName,
        addFarmPlot,
        deleteFarmPlot,
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

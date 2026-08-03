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
import type { Parameter, Inspection, StockEntry, Shipment, ShipmentItem } from '../types';

interface AppState {
  parameters: Parameter[];
  inspections: Inspection[];
  farmNames: string[];
  farmPlots: Record<string, string[]>;
  inspectorNames: string[];
  stockEntries: StockEntry[];
  shipments: Shipment[];
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
  addStock: (entry: { farmName: string; plotName: string; receivingDate: string; pallets: number }) => Promise<void>;
  updateStock: (id: string, data: { farmName: string; plotName: string; receivingDate: string; pallets: number }) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  addShipment: (items: { stockId?: string; farmName: string; plotName: string; receivingDate: string; pallets: number }[]) => Promise<void>;
  deleteShipment: (id: string) => Promise<void>;
  updateShipmentItems: (shipmentId: string, items: { stockId?: string; farmName: string; plotName: string; receivingDate: string; pallets: number }[]) => Promise<void>;
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
    stockEntries: [],
    shipments: [],
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
        stockRes,
        shipmentsRes,
        shipItemsRes,
      ] = await Promise.all([
        supabase.from('parameters').select('*').order('created_at'),
        supabase.from('farm_names').select('*').order('name'),
        supabase.from('farm_plots').select('*').order('created_at'),
        supabase.from('inspector_names').select('*').order('name'),
        supabase
          .from('inspections')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('inspection_counts').select('*'),
        supabase.from('stock').select('*').order('created_at'),
        supabase.from('shipments').select('*').order('created_at', { ascending: false }),
        supabase.from('shipment_items').select('*'),
      ]);

      if (paramsRes.error) throw paramsRes.error;
      if (farmsRes.error) throw farmsRes.error;
      if (plotsRes.error && plotsRes.error.code !== '42P01') throw plotsRes.error; // Ignore if table doesn't exist yet
      if (inspectorsRes.error) throw inspectorsRes.error;
      if (inspectionsRes.error) throw inspectionsRes.error;
      if (countsRes.error) throw countsRes.error;
      if (stockRes.error && stockRes.error.code !== '42P01') throw stockRes.error;
      if (shipmentsRes.error && shipmentsRes.error.code !== '42P01') throw shipmentsRes.error;
      if (shipItemsRes.error && shipItemsRes.error.code !== '42P01') throw shipItemsRes.error;

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

      const stockEntries: StockEntry[] = (stockRes.data || []).map((s: any) => ({
        id: s.id,
        farmName: s.farm_name,
        plotName: s.plot_name || '',
        receivingDate: s.receiving_date,
        pallets: s.pallets,
        createdAt: s.created_at,
      }));

      const shipmentItems: ShipmentItem[] = (shipItemsRes.data || []).map((si: any) => ({
        id: si.id,
        shipmentId: si.shipment_id,
        stockId: si.stock_id,
        farmName: si.farm_name,
        plotName: si.plot_name || '',
        receivingDate: si.receiving_date,
        pallets: si.pallets,
        createdAt: si.created_at,
      }));

      const shipmentMap = new Map<string, Shipment>();
      (shipmentsRes.data || []).forEach((s: any) => {
        shipmentMap.set(s.id, {
          id: s.id,
          dispatchedAt: s.dispatched_at,
          createdAt: s.created_at,
          items: [],
        });
      });
      shipmentItems.forEach((item) => {
        const s = shipmentMap.get(item.shipmentId);
        if (s) s.items.push(item);
      });
      const shipments: Shipment[] = [...shipmentMap.values()];

      setState({ parameters: params, inspections, farmNames, farmPlots, inspectorNames, stockEntries, shipments, loading: false, error: null });
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

  const addStock = useCallback(
    async (entry: { farmName: string; plotName: string; receivingDate: string; pallets: number }) => {
      const { error } = await supabase.from('stock').insert({
        farm_name: entry.farmName,
        plot_name: entry.plotName,
        receiving_date: entry.receivingDate,
        pallets: entry.pallets,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const updateStock = useCallback(
    async (id: string, data: { farmName: string; plotName: string; receivingDate: string; pallets: number }) => {
      const { error } = await supabase
        .from('stock')
        .update({
          farm_name: data.farmName,
          plot_name: data.plotName,
          receiving_date: data.receivingDate,
          pallets: data.pallets,
        })
        .eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const deleteStock = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('stock').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const addShipment = useCallback(
    async (items: { stockId?: string; farmName: string; plotName: string; receivingDate: string; pallets: number }[]) => {
      const { data, error } = await supabase
        .from('shipments')
        .insert({ dispatched_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) throw error;
      const shipmentId = data.id;
      const itemRows = items.map((item) => ({
        shipment_id: shipmentId,
        stock_id: item.stockId || null,
        farm_name: item.farmName,
        plot_name: item.plotName,
        receiving_date: item.receivingDate,
        pallets: item.pallets,
      }));
      const { error: itemsError } = await supabase.from('shipment_items').insert(itemRows);
      if (itemsError) throw itemsError;
      await refresh();
    },
    [refresh],
  );

  const deleteShipment = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('shipments').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const updateShipmentItems = useCallback(
    async (shipmentId: string, items: { stockId?: string; farmName: string; plotName: string; receivingDate: string; pallets: number }[]) => {
      await supabase.from('shipment_items').delete().eq('shipment_id', shipmentId);
      const itemRows = items.map((item) => ({
        shipment_id: shipmentId,
        stock_id: item.stockId || null,
        farm_name: item.farmName,
        plot_name: item.plotName,
        receiving_date: item.receivingDate,
        pallets: item.pallets,
      }));
      const { error } = await supabase.from('shipment_items').insert(itemRows);
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
        addStock,
        updateStock,
        deleteStock,
        addShipment,
        deleteShipment,
        updateShipmentItems,
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

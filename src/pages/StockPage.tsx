import { useState, useRef, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { DispatchModal } from '../components/DispatchModal';
import { ShipmentDetailModal } from '../components/ShipmentDetailModal';
import { ShipmentDecisionModal } from '../components/ShipmentDecisionModal';
import { InspectionFormModal } from '../components/InspectionFormModal';
import { ReportTable } from '../components/ReportTable';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck, Plus, Edit2, Trash2, Clock, FileSpreadsheet, Image as ImageIcon, X, Search, Link2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday } from 'date-fns';
import type { StockEntry, Shipment, Inspection } from '../types';

interface EnrichedStock extends StockEntry {
  available: number;
}

export function StockPage() {
  const {
    stockEntries, shipments, inspections, parameters, farmNames, farmPlots, loading, error,
    addStock, updateStock, deleteStock,
    linkInspectionToStock, unlinkInspection,
  } = useSupabase();
  const { t } = useTranslation();

  const [tab, setTab] = useState<'stock' | 'dispatched'>('stock');

  // Stock form state
  const [showAddStock, setShowAddStock] = useState(false);
  const [newFarm, setNewFarm] = useState('');
  const [newPlot, setNewPlot] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newPallets, setNewPallets] = useState('');

  // Edit stock state
  const [editingStock, setEditingStock] = useState<StockEntry | null>(null);
  const [editFarm, setEditFarm] = useState('');
  const [editPlot, setEditPlot] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPallets, setEditPallets] = useState('');

  // Dispatch modal
  const [showDispatch, setShowDispatch] = useState(false);
  const [showDecision, setShowDecision] = useState(false);

  // Shipment detail
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // Inspection modal from stock
  const [viewingInspection, setViewingInspection] = useState<Inspection | null>(null);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectPrefill, setInspectPrefill] = useState<{ farmName: string; plotName: string; receivingDate: string; stockId: string } | null>(null);
  const [showLinkInspections, setShowLinkInspections] = useState(false);
  const [linkingStockId, setLinkingStockId] = useState<string | null>(null);

  // Date selection for dispatched tab
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  const dispatchedMap = useMemo(() => {
    const map: Record<string, number> = {};
    shipments.forEach((s) => {
      s.items.forEach((item) => {
        if (item.stockId) {
          map[item.stockId] = (map[item.stockId] || 0) + item.pallets;
        }
      });
    });
    return map;
  }, [shipments]);

  const inspectionsByStockId = useMemo(() => {
    const map: Record<string, Inspection> = {};
    inspections.forEach((i) => {
      if (i.stockId) map[i.stockId] = i;
    });
    return map;
  }, [inspections]);

  const getInspectionSummary = (inspection: Inspection) => {
    const total = Object.values(inspection.counts).reduce((a, b) => a + b, 0);
    if (total === 0) return { total: 0, defectRate: 0, goodRate: 0, breakdown: [] as { name: string; color: string; pct: number }[] };
    const paramMap = new Map(parameters.map((p) => [p.id, p]));
    const defectTotal = Object.entries(inspection.counts)
      .filter(([pid]) => paramMap.get(pid)?.isDefect)
      .reduce((sum, [, c]) => sum + c, 0);
    const goodTotal = total - defectTotal;
    const breakdown = parameters
      .filter((p) => p.isDefect)
      .map((p) => ({
        name: p.name,
        color: p.color,
        pct: ((inspection.counts[p.id] || 0) / total) * 100,
      }))
      .filter((b) => b.pct > 0);
    return {
      total,
      defectRate: (defectTotal / total) * 100,
      goodRate: (goodTotal / total) * 100,
      breakdown,
    };
  };

  const availableStock: EnrichedStock[] = useMemo(() => {
    return stockEntries.map((e) => ({
      ...e,
      available: e.pallets - (dispatchedMap[e.id] || 0),
    })).filter((e) => e.available > 0);
  }, [stockEntries, dispatchedMap]);

  const unlinkedInspections = useMemo(() => {
    if (!linkingStockId) return [];
    const stock = stockEntries.find((s) => s.id === linkingStockId);
    if (!stock) return [];
    return inspections.filter((i) =>
      !i.stockId &&
      i.farmName === stock.farmName &&
      i.plotName === (stock.plotName || '') &&
      i.receivingDate === stock.receivingDate
    );
  }, [linkingStockId, stockEntries, inspections]);

  const availablePlots = newFarm ? (farmPlots[newFarm] || []) : [];
  const editAvailablePlots = editFarm ? (farmPlots[editFarm] || []) : [];

  const handleAddStock = async () => {
    if (!newFarm || !newDate || !newPallets) return;
    await addStock({
      farmName: newFarm,
      plotName: newPlot,
      receivingDate: newDate,
      pallets: parseInt(newPallets, 10),
    });
    setNewFarm('');
    setNewPlot('');
    setNewPallets('');
    setShowAddStock(false);
  };

  const handleUpdateStock = async () => {
    if (!editingStock || !editFarm || !editDate || !editPallets) return;
    await updateStock(editingStock.id, {
      farmName: editFarm,
      plotName: editPlot,
      receivingDate: editDate,
      pallets: parseInt(editPallets, 10),
    });
    setEditingStock(null);
  };

  const handleDeleteStock = async (id: string) => {
    if (!window.confirm('Delete this stock entry?')) return;
    await deleteStock(id);
  };

  const startEdit = (entry: EnrichedStock) => {
    setEditingStock(entry);
    setEditFarm(entry.farmName);
    setEditPlot(entry.plotName);
    setEditDate(entry.receivingDate);
    setEditPallets(String(entry.available));
  };

  // Dispatched tab grouping
  const groupedShipments = useMemo(() => {
    const groups = new Map<string, Shipment[]>();
    shipments.forEach((s) => {
      const key = format(new Date(s.dispatchedAt), 'yyyy-MM-dd');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });
    return new Map([...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [shipments]);

  const dateKeys = useMemo(() => [...groupedShipments.keys()], [groupedShipments]);

  const effectiveDate = useMemo(() => {
    if (selectedDate && dateKeys.includes(selectedDate)) return selectedDate;
    const today = format(new Date(), 'yyyy-MM-dd');
    return dateKeys.includes(today) ? today : (dateKeys[0] || today);
  }, [selectedDate, dateKeys]);

  const filteredShipments = effectiveDate ? groupedShipments.get(effectiveDate) || [] : [];

  const getDateLabel = (key: string) => {
    const d = new Date(key + 'T00:00:00');
    if (isToday(d)) return t('Today');
    if (isYesterday(d)) return t('Yesterday');
    return format(d, 'MMM d');
  };

  // Export stock as JPG
  const exportStockJpg = async () => {
    if (!tableRef.current) return;
    const { toJpeg } = await import('html-to-image');
    const dataUrl = await toJpeg(tableRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `Stock_${format(new Date(), 'yyyy-MM-dd')}.jpg`, { type: 'image/jpeg' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch {}
    }
    const link = document.createElement('a');
    link.download = file.name;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportStockExcel = async () => {
    const XLSX = await import('xlsx');
    const rows: (string | number)[][] = [
      [t('Stock Report'), format(new Date(), 'MMM d, yyyy')],
      [],
      [t('Farm & Plot'), t('Date'), t('Pallets'), t('Defect Rate')],
    ];
    availableStock.forEach((e) => {
      const insp = inspectionsByStockId[e.id];
      const summary = insp ? getInspectionSummary(insp) : null;
      rows.push([
        e.farmName + (e.plotName ? ` (${e.plotName})` : ''),
        e.receivingDate,
        e.available,
        summary ? `${summary.defectRate.toFixed(1)}%` : t('Not inspected'),
      ]);
    });
    rows.push([]);
    rows.push([t('Total'), '', availableStock.reduce((sum, e) => sum + e.available, 0), '']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('Stock'));
    XLSX.writeFile(wb, `Stock_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-2xl w-full"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="bg-red-50/50 backdrop-blur-md border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-red-700 font-semibold mb-2">{t('Connection Error')}</p>
          <p className="text-red-600/80 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Stock')}</h1>
          <p className="text-sm text-gray-500 font-medium">{t('Manage and review your field data.')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-2xl">
        <button
          onClick={() => setTab('stock')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'stock' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t('Stock')}
        </button>
        <button
          onClick={() => setTab('dispatched')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'dispatched' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t('Dispatched')}
        </button>
      </div>

      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAddStock(!showAddStock)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Stock')}
            </button>
            <div className="flex gap-2">
              <button onClick={exportStockJpg} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full hover:bg-blue-100 transition-colors">
                <ImageIcon className="w-4 h-4" />JPG
              </button>
              <button onClick={exportStockExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-full hover:bg-emerald-100 transition-colors">
                <FileSpreadsheet className="w-4 h-4" />Excel
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showAddStock && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <select value={newFarm} onChange={(e) => { setNewFarm(e.target.value); setNewPlot(''); }} className="appearance-none w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500">
                        <option value="" disabled>{t('Select a farm...')}</option>
                        {farmNames.map((name) => (<option key={name} value={name}>{name}</option>))}
                      </select>
                    </div>
                    {availablePlots.length > 0 && (
                      <div className="flex-1">
                        <select value={newPlot} onChange={(e) => setNewPlot(e.target.value)} className="appearance-none w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500">
                          <option value="">{t('No plot selected')}</option>
                          {availablePlots.map((name) => (<option key={name} value={name}>{name}</option>))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500" />
                    <input type="number" value={newPallets} onChange={(e) => setNewPallets(e.target.value)} placeholder={t('Pallets')} min="1" className="w-28 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddStock(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">{t('Cancel')}</button>
                    <button onClick={handleAddStock} disabled={!newFarm || !newDate || !newPallets} className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">{t('Add')}</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {availableStock.length === 0 && !showAddStock ? (
            <div className="text-center py-16 text-gray-500 font-medium">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              {t('No stock entries yet')}
            </div>
          ) : (
            <div ref={tableRef} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="py-3 px-4 text-start text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Farm & Plot')}</th>
                    <th className="py-3 px-4 text-start text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Date')}</th>
                    <th className="py-3 px-4 text-end text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Pallets')}</th>
                    <th className="py-3 px-4 text-start text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Defect Rate')}</th>
                    <th className="py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence>
                    {availableStock.map((entry) => {
                      const linkedInspection = inspectionsByStockId[entry.id];
                      const summary = linkedInspection ? getInspectionSummary(linkedInspection) : null;

                      if (editingStock?.id === entry.id) {
                        return (
                          <motion.tr key={`edit-${entry.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-50/30">
                            <td className="py-3 px-4" colSpan={5}>
                              <div className="flex flex-wrap gap-2">
                                <select value={editFarm} onChange={(e) => { setEditFarm(e.target.value); setEditPlot(''); }} className="appearance-none border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-900 font-semibold text-sm flex-1">
                                  {farmNames.map((name) => (<option key={name} value={name}>{name}</option>))}
                                </select>
                                {editAvailablePlots.length > 0 && (
                                  <select value={editPlot} onChange={(e) => setEditPlot(e.target.value)} className="appearance-none border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-500 font-medium text-sm">
                                    <option value="">{t('No plot selected')}</option>
                                    {editAvailablePlots.map((name) => (<option key={name} value={name}>{name}</option>))}
                                  </select>
                                )}
                                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-900 font-medium text-sm" />
                                <input type="number" value={editPallets} onChange={(e) => setEditPallets(e.target.value)} className="w-20 border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-900 font-bold text-sm" />
                                <button onClick={handleUpdateStock} className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">{t('Save Changes')}</button>
                                <button onClick={() => setEditingStock(null)} className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg font-bold text-sm hover:bg-gray-200">{t('Cancel')}</button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      }

                      return (
                        <motion.tr key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            <button
                              onClick={() => linkedInspection && setViewingInspection(linkedInspection)}
                              className={linkedInspection ? 'hover:text-green-700 cursor-pointer' : 'cursor-default'}
                            >
                              {entry.farmName}{entry.plotName ? ` (${entry.plotName})` : ''}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-medium">{entry.receivingDate}</td>
                          <td className="py-3 px-4 text-end font-bold text-gray-900">{entry.available}</td>
                          <td className="py-3 px-4">
                            {summary ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${summary.goodRate}%` }} className="h-full bg-green-400" />
                                  </div>
                                  <span className="text-xs font-bold text-red-600 whitespace-nowrap">{summary.defectRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {summary.breakdown.slice(0, 3).map((b) => (
                                    <span key={b.name} className="text-[10px] font-medium text-gray-500">
                                      {b.name}: {b.pct.toFixed(1)}%
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium">{t('Not inspected')}</span>
                                <button
                                  onClick={() => setInspectPrefill({ farmName: entry.farmName, plotName: entry.plotName, receivingDate: entry.receivingDate, stockId: entry.id })}
                                  className="text-xs font-bold text-green-600 hover:text-green-700 bg-green-50 px-2 py-0.5 rounded-full"
                                >
                                  + {t('Inspect')}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 justify-end">
                              {linkedInspection && (
                                <button onClick={() => { unlinkInspection(linkedInspection.id); }} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg" title="Unlink">
                                  <Link2 className="w-4 h-4" />
                                </button>
                              )}
                              {!linkedInspection && (
                                <button
                                  onClick={() => { setLinkingStockId(entry.id); setShowLinkInspections(true); }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Link inspection"
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => startEdit(entry)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteStock(entry.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-900 bg-gray-50/50">
                    <td className="py-3 px-4 font-black text-gray-900 text-sm">{t('Total')}</td>
                    <td></td>
                    <td className="py-3 px-4 text-end font-black text-gray-900 text-lg">{availableStock.reduce((sum, e) => sum + e.available, 0)}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {availableStock.length > 0 && (
            <div className="flex gap-3">
              <button onClick={() => setShowDispatch(true)} className="flex-1 py-4 bg-green-600 text-white text-lg font-bold rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
                <Truck className="w-5 h-5" />
                {t('Dispatch Shipment')}
              </button>
              <button onClick={() => setShowDecision(true)} className="flex-1 py-4 bg-gray-900 text-white text-lg font-bold rounded-2xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20">
                <Zap className="w-5 h-5" />
                {t('Shipment Decision')}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'dispatched' && (
        <div className="space-y-4">
          {shipments.length === 0 ? (
            <div className="text-center py-16 text-gray-500 font-medium">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Truck className="w-8 h-8 text-gray-400" />
              </div>
              {t('No shipments yet')}
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2 overflow-x-auto pb-2 scrollbar-hide">
                {dateKeys.map((key) => {
                  const count = groupedShipments.get(key)!.length;
                  const isActive = key === effectiveDate;
                  return (
                    <button key={key} onClick={() => setSelectedDate(key)} className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${isActive ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {getDateLabel(key)}<span className={`ml-1.5 text-xs ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {filteredShipments.map((s, idx) => {
                  const total = s.items.reduce((sum, i) => sum + i.pallets, 0);
                  const dt = new Date(s.dispatchedAt);
                  return (
                    <motion.button key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} onClick={() => setSelectedShipment(s)} className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-gray-200 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-1">
                            <Clock className="w-3.5 h-3.5" />{format(dt, 'h:mm a')}
                          </div>
                          <div className="text-xs text-gray-400 font-medium">{s.items.length} {s.items.length === 1 ? 'entry' : 'entries'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-gray-900">{total}</div>
                          <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('Pallets')}</div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {showDispatch && <DispatchModal open={showDispatch} onClose={() => setShowDispatch(false)} stockEntries={stockEntries} />}
      </AnimatePresence>

      <AnimatePresence>
        {showDecision && <ShipmentDecisionModal open={showDecision} onClose={() => setShowDecision(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedShipment && <ShipmentDetailModal shipment={selectedShipment} stockEntries={stockEntries} open={!!selectedShipment} onClose={() => setSelectedShipment(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewingInspection && (
          <ReportTable inspection={viewingInspection} parameters={parameters} onClose={() => setViewingInspection(null)} />
        )}
      </AnimatePresence>

      <InspectionFormModal
        open={!!inspectPrefill || showInspectModal}
        onClose={() => { setInspectPrefill(null); setShowInspectModal(false); }}
        stockPrefill={inspectPrefill || undefined}
      />

      <AnimatePresence>
        {showLinkInspections && linkingStockId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 pb-safe">
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white w-full max-w-md sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Link Inspection</h2>
                <button onClick={() => { setShowLinkInspections(false); setLinkingStockId(null); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {unlinkedInspections.length === 0 ? (
                  <p className="text-center py-8 text-gray-500 font-medium">No matching inspections found</p>
                ) : (
                  <div className="space-y-2">
                    {unlinkedInspections.map((insp) => {
                      const total = Object.values(insp.counts).reduce((a, b) => a + b, 0);
                      return (
                        <button
                          key={insp.id}
                          onClick={async () => {
                            await linkInspectionToStock(insp.id, linkingStockId);
                            setShowLinkInspections(false);
                            setLinkingStockId(null);
                          }}
                          className="w-full text-left bg-gray-50 rounded-xl p-3 hover:bg-green-50 border border-gray-100 hover:border-green-200 transition-all"
                        >
                          <div className="font-bold text-gray-900">{insp.inspectorName}</div>
                          <div className="text-sm text-gray-500">{total} heads</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

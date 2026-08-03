import { useState, useRef, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { DispatchModal } from '../components/DispatchModal';
import { ShipmentDetailModal } from '../components/ShipmentDetailModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck, Plus, Edit2, Trash2, Clock, FileSpreadsheet, Image as ImageIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday } from 'date-fns';
import type { StockEntry, Shipment } from '../types';

interface EnrichedStock extends StockEntry {
  available: number;
}

export function StockPage() {
  const {
    stockEntries, shipments, farmNames, farmPlots, loading, error,
    addStock, updateStock, deleteStock,
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

  // Shipment detail
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

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

  const availableStock: EnrichedStock[] = useMemo(() => {
    return stockEntries.map((e) => ({
      ...e,
      available: e.pallets - (dispatchedMap[e.id] || 0),
    })).filter((e) => e.available > 0);
  }, [stockEntries, dispatchedMap]);

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

  // Export stock as Excel
  const exportStockExcel = async () => {
    const XLSX = await import('xlsx');
    const rows: (string | number)[][] = [
      [t('Stock Report'), format(new Date(), 'MMM d, yyyy')],
      [],
      [t('Farm & Plot'), t('Date'), t('Pallets')],
    ];
    availableStock.forEach((e) => {
      rows.push([
        e.farmName + (e.plotName ? ` (${e.plotName})` : ''),
        e.receivingDate,
        e.available,
      ]);
    });
    rows.push([]);
    rows.push([t('Total'), '', availableStock.reduce((sum, e) => sum + e.available, 0)]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }];
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

      {/* Sub-tabs */}
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

      {/* STOCK TAB */}
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
              <button
                onClick={exportStockJpg}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full hover:bg-blue-100 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                JPG
              </button>
              <button
                onClick={exportStockExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-full hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>

          {/* Add Stock Form */}
          <AnimatePresence>
            {showAddStock && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <select
                        value={newFarm}
                        onChange={(e) => { setNewFarm(e.target.value); setNewPlot(''); }}
                        className="appearance-none w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500"
                      >
                        <option value="" disabled>{t('Select a farm...')}</option>
                        {farmNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    {availablePlots.length > 0 && (
                      <div className="flex-1">
                        <select
                          value={newPlot}
                          onChange={(e) => setNewPlot(e.target.value)}
                          className="appearance-none w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500"
                        >
                          <option value="">{t('No plot selected')}</option>
                          {availablePlots.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500"
                    />
                    <input
                      type="number"
                      value={newPallets}
                      onChange={(e) => setNewPallets(e.target.value)}
                      placeholder={t('Pallets')}
                      min="1"
                      className="w-28 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddStock(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                      {t('Cancel')}
                    </button>
                    <button
                      onClick={handleAddStock}
                      disabled={!newFarm || !newDate || !newPallets}
                      className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {t('Add')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stock Table */}
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
                    <th className="py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence>
                    {availableStock.map((entry) => (
                      editingStock?.id === entry.id ? (
                        <motion.tr key={`edit-${entry.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-50/30">
                          <td className="py-3 px-4">
                            <select
                              value={editFarm}
                              onChange={(e) => { setEditFarm(e.target.value); setEditPlot(''); }}
                              className="appearance-none w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-900 font-semibold text-sm"
                            >
                              {farmNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                            {editAvailablePlots.length > 0 && (
                              <select
                                value={editPlot}
                                onChange={(e) => setEditPlot(e.target.value)}
                                className="appearance-none w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-500 font-medium text-sm mt-1"
                              >
                                <option value="">{t('No plot selected')}</option>
                                {editAvailablePlots.map((name) => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-900 font-medium text-sm"
                            />
                          </td>
                          <td className="py-3 px-4 text-end">
                            <input
                              type="number"
                              value={editPallets}
                              onChange={(e) => setEditPallets(e.target.value)}
                              className="w-20 text-end border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-gray-900 font-bold text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 justify-end">
                              <button onClick={handleUpdateStock} className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                <Plus className="w-4 h-4" style={{ transform: 'rotate(45deg)' }} />
                              </button>
                              <button onClick={() => setEditingStock(null)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ) : (
                        <motion.tr
                          key={entry.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-gray-50/50"
                        >
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {entry.farmName}{entry.plotName ? ` (${entry.plotName})` : ''}
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-medium">{entry.receivingDate}</td>
                          <td className="py-3 px-4 text-end font-bold text-gray-900">{entry.available}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => startEdit(entry)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStock(entry.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    ))}
                  </AnimatePresence>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-900 bg-gray-50/50">
                    <td className="py-3 px-4 font-black text-gray-900 text-sm">{t('Total')}</td>
                    <td></td>
                    <td className="py-3 px-4 text-end font-black text-gray-900 text-lg">
                      {availableStock.reduce((sum, e) => sum + e.available, 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {availableStock.length > 0 && (
            <button
              onClick={() => setShowDispatch(true)}
              className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
            >
              <Truck className="w-5 h-5" />
              {t('Dispatch Shipment')}
            </button>
          )}
        </div>
      )}

      {/* DISPATCHED TAB */}
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
                    <button
                      key={key}
                      onClick={() => setSelectedDate(key)}
                      className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                        isActive ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {getDateLabel(key)}
                      <span className={`ml-1.5 text-xs ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {filteredShipments.map((s, idx) => {
                  const total = s.items.reduce((sum, i) => sum + i.pallets, 0);
                  const dt = new Date(s.dispatchedAt);
                  return (
                    <motion.button
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedShipment(s)}
                      className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-gray-200 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(dt, 'h:mm a')}
                          </div>
                          <div className="text-xs text-gray-400 font-medium">
                            {s.items.length} {s.items.length === 1 ? 'entry' : 'entries'}
                          </div>
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

      {/* Dispatch Modal */}
      <AnimatePresence>
        {showDispatch && (
          <DispatchModal
            open={showDispatch}
            onClose={() => setShowDispatch(false)}
            stockEntries={stockEntries}
          />
        )}
      </AnimatePresence>

      {/* Shipment Detail Modal */}
      <AnimatePresence>
        {selectedShipment && (
          <ShipmentDetailModal
            shipment={selectedShipment}
            stockEntries={stockEntries}
            open={!!selectedShipment}
            onClose={() => setSelectedShipment(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

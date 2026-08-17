import { useState, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { countHeads } from '../lib/utils';
import { motion } from 'framer-motion';
import { X, Plus, Minus, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StockEntry } from '../types';

interface Props {
  stockEntries: StockEntry[];
  open: boolean;
  onClose: () => void;
}

export function DispatchModal({ stockEntries, open, onClose }: Props) {
  const { shipments, inspections, parameters, addShipment } = useSupabase();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const availableStock = useMemo(() => {
    const dispatchedMap: Record<string, number> = {};
    shipments.forEach((s) => {
      s.items.forEach((item) => {
        if (item.stockId) {
          dispatchedMap[item.stockId] = (dispatchedMap[item.stockId] || 0) + item.pallets;
        }
      });
    });
    return stockEntries
      .map((entry) => {
        const dispatched = dispatchedMap[entry.id] || 0;
        return { ...entry, available: entry.pallets - dispatched };
      })
      .filter((e) => e.available > 0);
  }, [stockEntries, shipments]);

  const defectsByStockId = useMemo(() => {
    const map: Record<string, { total: number; defects: { name: string; color: string; pct: number }[] } | null> = {};
    const defectParams = parameters.filter(p => p.isDefect && !p.isSpecial);
    inspections.forEach(i => {
      if (i.stockId) {
        const t = countHeads(i.counts, parameters);
        if (t === 0) { map[i.stockId] = null; return; }
        map[i.stockId] = {
          total: t,
          defects: defectParams.map(p => ({
            name: p.name,
            color: p.color,
            pct: (i.counts[p.id] || 0) / t * 100,
          })).filter(d => d.pct > 0),
        };
      }
    });
    return map;
  }, [inspections, parameters]);

  const [selections, setSelections] = useState<Record<string, number>>({});
  const [shipmentName, setShipmentName] = useState('');

  if (!open) return null;

  const selectedEntries = availableStock.filter((e) => selections[e.id] > 0);

  const totalSelected = selectedEntries.reduce((sum, e) => sum + selections[e.id], 0);

  const avgDefects = useMemo(() => {
    const defectMap: Record<string, { name: string; color: string; weightedPct: number }> = {};
    selectedEntries.forEach((entry) => {
      const qty = selections[entry.id];
      const info = defectsByStockId[entry.id];
      if (!info) return;
      info.defects.forEach((d) => {
        if (!defectMap[d.name]) {
          defectMap[d.name] = { name: d.name, color: d.color, weightedPct: 0 };
        }
        defectMap[d.name].weightedPct += d.pct * qty;
      });
    });
    return Object.values(defectMap).map((d) => ({
      name: d.name,
      color: d.color,
      pct: totalSelected > 0 ? d.weightedPct / totalSelected : 0,
    }));
  }, [selectedEntries, selections, defectsByStockId, totalSelected]);

  const handleToggle = (id: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (prev[id]) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  };

  const handleQtyChange = (id: string, qty: number) => {
    const entry = availableStock.find((e) => e.id === id);
    if (!entry) return;
    const clamped = Math.max(0, Math.min(qty, entry.available));
    setSelections((prev) => ({ ...prev, [id]: clamped }));
  };

  const handleSubmit = async () => {
    if (totalSelected === 0) return;
    setSubmitting(true);
    try {
      const items = selectedEntries.map((e) => ({
        stockId: e.id,
        farmName: e.farmName,
        plotName: e.plotName,
        receivingDate: e.receivingDate,
        pallets: selections[e.id],
      }));
      await addShipment(shipmentName.trim(), items);
      setSelections({});
      setShipmentName('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 pb-safe"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-lg sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t('Dispatch Shipment')}</h2>
            <p className="text-sm text-gray-500">
              {t('Selected')}: {selectedEntries.length} — {t('Total Pallets')}: {totalSelected}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="mb-4">
            <input
              type="text"
              value={shipmentName}
              onChange={(e) => setShipmentName(e.target.value)}
              placeholder={t('Shipment name (optional)')}
              className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all"
            />
          </div>
          {totalSelected > 0 && avgDefects.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100">
              <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                {t('Weighted Avg Defects')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {avgDefects.map((d) => (
                  <span
                    key={d.name}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: d.color }}
                  >
                    {d.name} {d.pct.toFixed(1)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          {availableStock.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-medium">
              {t('No available stock for this day')}
            </div>
          ) : (
            <div className="space-y-2">
              {availableStock.map((entry) => {
                const qty = selections[entry.id] || 0;
                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      qty > 0 ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleToggle(entry.id)}
                        className="text-left flex-1"
                      >
                        <div className="font-bold text-gray-900">
                          {entry.farmName}{entry.plotName ? ` (${entry.plotName})` : ''}
                        </div>
                        <div className="text-sm text-gray-500 font-medium">
                          {entry.receivingDate} — {t('Available')}: {entry.available} {t('Pallets')}
                        </div>
                        {defectsByStockId[entry.id] && defectsByStockId[entry.id]!.defects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {defectsByStockId[entry.id]!.defects.map(d => (
                              <span key={d.name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: d.color }}>
                                {d.name} {d.pct.toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.id in defectsByStockId && defectsByStockId[entry.id] === null && (
                          <span className="text-[10px] text-gray-400 mt-1">{t('Not inspected')}</span>
                        )}
                      </button>
                      {qty > 0 && (
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => handleQtyChange(entry.id, qty - 1)}
                            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-black text-lg text-green-700 w-8 text-center">{qty}</span>
                          <button
                            onClick={() => handleQtyChange(entry.id, qty + 1)}
                            disabled={qty >= entry.available}
                            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={totalSelected === 0 || submitting}
            className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-2xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
          >
            <Truck className="w-5 h-5" />
            {submitting ? t('Starting...') : t('Confirm Dispatch')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

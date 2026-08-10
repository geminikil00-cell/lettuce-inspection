import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toJpeg } from 'html-to-image';
import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { X, Plus, Minus, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { Shipment, StockEntry } from '../types';

interface Props {
  shipment: Shipment;
  stockEntries: StockEntry[];
  open: boolean;
  onClose: () => void;
}

export function ShipmentDetailModal({ shipment, stockEntries, open, onClose }: Props) {
  const { shipments, inspections, parameters, updateShipmentItems, deleteShipment, refresh } = useSupabase();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<{ stockId?: string; farmName: string; plotName: string; receivingDate: string; pallets: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editName, setEditName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(shipment.items.map((i) => ({
        stockId: i.stockId,
        farmName: i.farmName,
        plotName: i.plotName,
        receivingDate: i.receivingDate,
        pallets: i.pallets,
      })));
      setEditName(shipment.name || '');
      setShowNameInput(false);
      setEditing(false);
    }
  }, [open, shipment]);

  if (!open) return null;

  const defectsByStockId = useMemo(() => {
    const map: Record<string, { total: number; defects: { name: string; color: string; pct: number }[] } | null> = {};
    const defectParams = parameters.filter(p => p.isDefect && !p.isSpecial);
    inspections.forEach(i => {
      if (i.stockId) {
        const t = Object.values(i.counts).reduce((a, b) => a + b, 0);
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

  const avgDefects = useMemo(() => {
    const defectMap: Record<string, { name: string; color: string; weightedPct: number; totalPallets: number }> = {};
    items.forEach((item) => {
      const info = item.stockId ? defectsByStockId[item.stockId] : null;
      if (!info) return;
      info.defects.forEach((d) => {
        if (!defectMap[d.name]) {
          defectMap[d.name] = { name: d.name, color: d.color, weightedPct: 0, totalPallets: 0 };
        }
        defectMap[d.name].weightedPct += d.pct * item.pallets;
        defectMap[d.name].totalPallets += item.pallets;
      });
    });
    return Object.values(defectMap).map((d) => ({
      name: d.name,
      color: d.color,
      pct: d.totalPallets > 0 ? d.weightedPct / d.totalPallets : 0,
    }));
  }, [items, defectsByStockId]);

  const dispatchedMap: Record<string, number> = {};
  shipments.forEach((s) => {
    if (s.id === shipment.id) return;
    s.items.forEach((item) => {
      if (item.stockId) {
        dispatchedMap[item.stockId] = (dispatchedMap[item.stockId] || 0) + item.pallets;
      }
    });
  });

  const stockAvailableMap = useMemo(() => {
    const map: Record<string, number> = {};
    stockEntries.forEach((entry) => {
      map[entry.id] = entry.pallets - (dispatchedMap[entry.id] || 0);
    });
    return map;
  }, [stockEntries, dispatchedMap]);

  const getAvailable = useCallback((stockId: string | undefined) => {
    if (!stockId) return 0;
    return stockAvailableMap[stockId] ?? 0;
  }, [stockAvailableMap]);

  const totalPallets = items.reduce((sum, i) => sum + i.pallets, 0);

  const handleQtyChange = (idx: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = next[idx];
      const maxForStock = getAvailable(item.stockId);
      const othersUsing = prev
        .filter((it, i) => i !== idx && it.stockId === item.stockId)
        .reduce((sum, it) => sum + it.pallets, 0);
      const maxForThis = Math.max(0, maxForStock - othersUsing);
      next[idx] = { ...next[idx], pallets: Math.max(0, Math.min(item.pallets + delta, maxForThis)) };
      return next;
    });
  };

  const handleRemove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddStock = (entry: StockEntry) => {
    const existingIdx = items.findIndex((i) => i.stockId === entry.id);
    if (existingIdx >= 0) {
      const maxForStock = getAvailable(entry.id);
      setItems((prev) => {
        const next = [...prev];
        const othersUsing = prev
          .filter((it, i) => i !== existingIdx && it.stockId === entry.id)
          .reduce((sum, it) => sum + it.pallets, 0);
        const maxForThis = Math.max(0, maxForStock - othersUsing);
        if (next[existingIdx].pallets >= maxForThis) return prev;
        next[existingIdx] = { ...next[existingIdx], pallets: Math.min(next[existingIdx].pallets + 1, maxForThis) };
        return next;
      });
    } else {
      const maxForStock = getAvailable(entry.id);
      if (maxForStock <= 0) return;
      setItems((prev) => [...prev, {
        stockId: entry.id,
        farmName: entry.farmName,
        plotName: entry.plotName,
        receivingDate: entry.receivingDate,
        pallets: 1,
      }]);
    }
  };

  const addableStock = useMemo(() => {
    return stockEntries.filter((entry) => {
      const maxForStock = stockAvailableMap[entry.id] ?? 0;
      if (maxForStock <= 0) return false;
      const existing = items.find((i) => i.stockId === entry.id);
      if (existing) {
        const othersUsing = items
          .filter((it) => it.stockId === entry.id && it !== existing)
          .reduce((sum, it) => sum + it.pallets, 0);
        return existing.pallets < maxForStock - othersUsing;
      }
      return true;
    });
  }, [stockEntries, items, stockAvailableMap]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const filtered = items.filter((i) => i.pallets > 0);
      await updateShipmentItems(shipment.id, filtered);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this shipment? All pallets will be restored to stock.')) return;
    setSubmitting(true);
    try {
      await deleteShipment(shipment.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const dt = new Date(shipment.dispatchedAt);

  const exportJpg = async () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const prevOverflow = el.style.overflow;
    const prevMaxHeight = el.style.maxHeight;
    el.style.overflow = 'visible';
    el.style.maxHeight = 'none';
    try {
      const dataUrl = await toJpeg(el, {
        quality: 0.95,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Shipment_${editName.replace(/\s+/g, '_')}_${format(dt, 'yyyy-MM-dd')}.jpg`;
      link.href = dataUrl;
      link.click();
    } finally {
      el.style.overflow = prevOverflow;
      el.style.maxHeight = prevMaxHeight;
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
        className="bg-white w-full max-w-lg sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-y-auto" ref={containerRef}>
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex-1 min-w-0 pr-8">
              {showNameInput ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={async () => {
                    setShowNameInput(false);
                    if (editName !== (shipment.name || '')) {
                      await supabase.from('shipments').update({ name: editName }).eq('id', shipment.id);
                      await refresh();
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      setShowNameInput(false);
                      if (editName !== (shipment.name || '')) {
                        await supabase.from('shipments').update({ name: editName }).eq('id', shipment.id);
                        await refresh();
                      }
                    }
                  }}
                  autoFocus
                  className="w-full text-xl font-bold text-gray-900 tracking-tight bg-transparent border-b-2 border-green-500 outline-none"
                  placeholder={t('Shipment name')}
                />
              ) : (
                <h2
                  className="text-xl font-bold text-gray-900 tracking-tight cursor-pointer hover:text-green-700"
                  onClick={() => setShowNameInput(true)}
                >
                  {editName || t('Shipment Detail')}
                </h2>
              )}
              <p className="text-sm text-gray-500">
                {format(dt, 'MMM d, yyyy')} &mdash; {format(dt, 'h:mm a')}
              </p>
            </div>
          </div>
          <div className="p-4">
          {items.length > 0 && avgDefects.length > 0 && !editing && (
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
          {items.length === 0 && !editing ? (
            <div className="text-center py-12 text-gray-500 font-medium">
              {t('No available stock for this day')}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">
                        {item.farmName}{item.plotName ? ` (${item.plotName})` : ''}
                      </div>
                      <div className="text-sm text-gray-500 font-medium">{item.receivingDate}</div>
                    </div>
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQtyChange(idx, -1)}
                          className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-black text-lg text-gray-900 w-8 text-center">{item.pallets}</span>
                        <button
                          onClick={() => handleQtyChange(idx, 1)}
                          className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(idx)}
                          className="ml-2 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-black text-xl text-gray-900">
                        {item.pallets} <span className="text-sm font-medium text-gray-400">{t('Pallets')}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {editing && addableStock.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-bold text-gray-500 mb-2">{t('Add more entries')}</p>
                  <div className="space-y-1 max-h-[150px] overflow-y-auto">
                    {addableStock.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => handleAddStock(entry)}
                        className="w-full text-left p-3 bg-white border border-gray-100 rounded-xl hover:border-green-200 hover:bg-green-50/30 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">
                            {entry.farmName}{entry.plotName ? ` (${entry.plotName})` : ''}
                          </div>
                          <div className="text-xs text-gray-400">{entry.receivingDate} — {getAvailable(entry.id)} pallets avail</div>
                        </div>
                        <Plus className="w-5 h-5 text-green-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-bold text-gray-500">
            <span>{t('Total Pallets')}</span>
            <span className="text-gray-900 text-lg">{totalPallets}</span>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setItems(shipment.items.map((i) => ({
                      stockId: i.stockId,
                      farmName: i.farmName,
                      plotName: i.plotName,
                      receivingDate: i.receivingDate,
                      pallets: i.pallets,
                    })));
                    setEditing(false);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {t('Save Changes')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={exportJpg}
                  className="flex-1 py-3 bg-blue-50 text-blue-700 font-bold rounded-2xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  {t('Save JPG')}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 py-3 bg-red-50 text-red-700 font-bold rounded-2xl hover:bg-red-100 transition-colors"
                  >
                    {t('Remove')}
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-colors"
                  >
                    {t('Edit Dispatch')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

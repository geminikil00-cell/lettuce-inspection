import { useState, useRef } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { optimizeShipments, type OptimizationParams, type OptimizationResult } from '../lib/shipmentOptimizer';
import { motion } from 'framer-motion';
import { X, ArrowLeft, Image as ImageIcon, FileSpreadsheet, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShipmentDecisionModal({ open, onClose }: Props) {
  const { stockEntries, shipments, inspections, parameters } = useSupabase();
  const { t } = useTranslation();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [selectedParams, setSelectedParams] = useState<Set<string>>(new Set());
  const [storageTimeDays, setStorageTimeDays] = useState(2);
  const [palletsPerShipment, setPalletsPerShipment] = useState(20);
  const [numShipments, setNumShipments] = useState(3);
  const [maxStocksPerShipment, setMaxStocksPerShipment] = useState(4);

  const [result, setResult] = useState<OptimizationResult | null>(null);

  if (!open) return null;

  const defectParams = parameters.filter((p) => p.isDefect);

  const toggleParam = (id: string) => {
    setSelectedParams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOptimize = () => {
    const dispatchedMap: Record<string, number> = {};
    shipments.forEach((s) => {
      s.items.forEach((item) => {
        if (item.stockId) {
          dispatchedMap[item.stockId] = (dispatchedMap[item.stockId] || 0) + item.pallets;
        }
      });
    });

    const available = stockEntries.map((e) => ({
      ...e,
      pallets: e.pallets - (dispatchedMap[e.id] || 0),
    })).filter((e) => e.pallets > 0);

    const params: OptimizationParams = {
      selectedParams: [...selectedParams],
      storageTimeDays,
      palletsPerShipment,
      numShipments,
      maxStocksPerShipment,
    };

    setResult(optimizeShipments(available, inspections, parameters, params));
  };

  const handleReset = () => {
    setResult(null);
  };

  const getParamLabel = (id: string) => {
    if (id === '__quality__') return t('Quality Score');
    return parameters.find((p) => p.id === id)?.name || id;
  };

  const paramRow = (id: string, value: number) => {
    const p = id === '__quality__' ? { color: '#22c55e' } : parameters.find((p) => p.id === id);
    return (
      <div key={id} className="flex items-center gap-2 text-sm">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p?.color || '#999' }} />
        <span className="font-medium text-gray-600">{getParamLabel(id)}:</span>
        <span className="font-bold text-gray-900">{value.toFixed(1)}%</span>
      </div>
    );
  };

  const exportJpg = async () => {
    if (!resultsRef.current) return;
    const { toJpeg } = await import('html-to-image');
    const dataUrl = await toJpeg(resultsRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'Shipment_Plan.jpg', { type: 'image/jpeg' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch {}
    }
    const link = document.createElement('a');
    link.download = file.name;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportExcel = async () => {
    if (!result) return;
    const XLSX = await import('xlsx');
    const rows: (string | number)[][] = [
      ['Shipment Decision Report'],
      [],
      ['Shipment', 'Farm', 'Plot', 'Date', 'Pallets', ...result.shipments[0] ? Object.keys(result.shipments[0].paramAverages).map(getParamLabel) : []],
    ];
    result.shipments.forEach((s, i) => {
      s.items.forEach((item) => {
        rows.push([
          `#${i + 1}`,
          item.stock.farmName,
          item.stock.plotName || '-',
          item.stock.receivingDate,
          item.stock.pallets,
          ...Object.keys(s.paramAverages).map((pid) =>
            pid === '__quality__' ? item.goodPct.toFixed(1) + '%' : ((item.defectPcts[pid] || 0).toFixed(1) + '%')
          ),
        ]);
      });
      rows.push([
        `#${i + 1} Avg`,
        '', '', '',
        s.totalPallets,
        ...Object.values(s.paramAverages).map((v) => v.toFixed(1) + '%'),
      ]);
      rows.push([]);
    });
    if (result.overflow.length > 0) {
      rows.push(['Overflow', '', '', '', '']);
      result.overflow.forEach((item) => {
        rows.push([
          'Overflow',
          item.stock.farmName,
          item.stock.plotName || '-',
          item.stock.receivingDate,
          item.stock.pallets,
        ]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipment Plan');
    XLSX.writeFile(wb, 'Shipment_Plan.xlsx');
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
        className="bg-white w-full max-w-xl sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {result && (
              <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t('Shipment Decision')}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!result ? (
            <div className="space-y-5">
              <p className="text-sm text-gray-500 font-medium">{t('Select parameters to balance across shipments')}</p>

              <div>
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={selectedParams.has('__quality__')}
                    onChange={() => toggleParam('__quality__')}
                    className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="font-bold text-gray-900">{t('Quality Score')}</span>
                </label>
                {defectParams.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={selectedParams.has(p.id)}
                      onChange={() => toggleParam(p.id)}
                      className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-bold text-gray-900">{p.name}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">{t('Storage Time')} ({t('days')})</label>
                  <input
                    type="number"
                    value={storageTimeDays}
                    onChange={(e) => setStorageTimeDays(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-bold focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">{t('Max Stocks/Shipment')}</label>
                  <input
                    type="number"
                    value={maxStocksPerShipment}
                    onChange={(e) => setMaxStocksPerShipment(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-bold focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">{t('Pallets/Shipment')}</label>
                  <input
                    type="number"
                    value={palletsPerShipment}
                    onChange={(e) => setPalletsPerShipment(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-bold focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">{t('Shipments')}</label>
                  <input
                    type="number"
                    value={numShipments}
                    onChange={(e) => setNumShipments(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-gray-900 font-bold focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <button
                onClick={handleOptimize}
                disabled={selectedParams.size === 0}
                className="w-full py-4 bg-gray-900 text-white text-lg font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                {t('Optimize')}
              </button>
            </div>
          ) : (
            <div ref={resultsRef} className="space-y-4">
              <div className="text-sm font-bold text-gray-500 mb-2">
                {result.shipments.length} {t('shipments')} · {(result.shipments.length || 0) * palletsPerShipment} {t('Pallets')} max
                {result.overflow.length > 0 && (
                  <span className="text-orange-500 ml-2">· {result.overflow.length} overflow</span>
                )}
              </div>

              {result.shipments.map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-gray-900">
                      {t('Shipment')} #{i + 1}
                    </h3>
                    <span className="text-sm font-bold text-gray-500">
                      {s.totalPallets}/{palletsPerShipment} {t('Pallets')}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {s.items.map((item, j) => (
                      <div key={j} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="font-semibold text-gray-900">{item.stock.farmName}</span>
                          {item.stock.plotName && <span className="text-gray-400 ml-1">({item.stock.plotName})</span>}
                          <span className="text-gray-400 ml-2 text-xs">{item.stock.receivingDate}</span>
                          {item.daysStored >= storageTimeDays && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1 py-0.5 rounded ml-1">
                              {item.daysStored}d
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-gray-900">{item.stock.pallets}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                    {Object.entries(s.paramAverages).map(([pid, val]) => paramRow(pid, val))}
                  </div>
                </div>
              ))}

              {result.overflow.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                  <h4 className="font-bold text-orange-800 mb-2 text-sm">{t('Overflow')} ({result.overflow.length})</h4>
                  {result.overflow.map((item, j) => (
                    <div key={j} className="flex items-center justify-between text-sm py-1">
                      <span className="font-medium text-orange-700">
                        {item.stock.farmName}{item.stock.plotName ? ` (${item.stock.plotName})` : ''}
                      </span>
                      <span className="font-bold text-orange-700">{item.stock.pallets} {t('Pallets')}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={exportJpg} className="flex-1 py-3 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4" />JPG
                </button>
                <button onClick={exportExcel} className="flex-1 py-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />Excel
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

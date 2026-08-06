import { useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import type { Inspection, Parameter } from '../types';
import { useSupabase } from '../hooks/useSupabase';
import { motion } from 'framer-motion';
import { X, FileSpreadsheet, Image as ImageIcon, Edit2, Trash2, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Props {
  inspection: Inspection;
  parameters: Parameter[];
  onClose: () => void;
  onEditInfo?: (inspection: Inspection) => void;
}

export function ReportTable({ inspection, parameters, onClose, onEditInfo }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const { farmNames, farmPlots, updateInspection, deleteInspection, unlinkInspection } = useSupabase();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [editFarm, setEditFarm] = useState(inspection.farmName);
  const [editPlot, setEditPlot] = useState(inspection.plotName || '');

  const availablePlots = farmPlots[editFarm] || [];

  const handleFarmChange = async (newFarm: string) => {
    setEditFarm(newFarm);
    setEditPlot('');
    await updateInspection(inspection.id, {
      farmName: newFarm,
      plotName: '',
      inspectorName: inspection.inspectorName,
      receivingDate: inspection.receivingDate,
    });
  };

  const handlePlotChange = async (newPlot: string) => {
    setEditPlot(newPlot);
    await updateInspection(inspection.id, {
      farmName: editFarm,
      plotName: newPlot,
      inspectorName: inspection.inspectorName,
      receivingDate: inspection.receivingDate,
    });
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this inspection report? This cannot be undone.')) return;
    try {
      await deleteInspection(inspection.id);
      onClose();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message || 'Permission denied or network error'}`);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Unlink this inspection from stock?')) return;
    try {
      await unlinkInspection(inspection.id);
      onClose();
    } catch (err: any) {
      alert(`Failed to unlink: ${err.message || 'Permission denied or network error'}`);
    }
  };

  const paramMap = new Map(parameters.map((p) => [p.id, p]));
  const total = Object.values(inspection.counts).reduce((a, b) => a + b, 0);

  const specialTotal = Object.entries(inspection.counts)
    .filter(([pid]) => paramMap.get(pid)?.isSpecial)
    .reduce((sum, [, c]) => sum + c, 0);

  const defectTotal = Object.entries(inspection.counts)
    .filter(([pid]) => {
      const p = paramMap.get(pid);
      return p?.isDefect && !p?.isSpecial;
    })
    .reduce((sum, [, c]) => sum + c, 0);

  const freeTotal = total - defectTotal - specialTotal;
  const defectPct = (freeTotal + specialTotal) > 0 ? ((defectTotal / (freeTotal + specialTotal)) * 100).toFixed(1) : '0';

  const submittedIso = inspection.submittedAt || inspection.createdAt;
  const submittedDate = format(new Date(submittedIso), 'MMM d, yyyy');
  const submittedTime = format(new Date(submittedIso), 'h:mm a');

  const receivingDateFormatted = inspection.receivingDate
    ? format(new Date(inspection.receivingDate), 'MMM d, yyyy')
    : '';

  const exportJpg = async () => {
    if (!tableRef.current) return;
    const dataUrl = await toJpeg(tableRef.current, { 
      quality: 0.95,
      backgroundColor: '#ffffff'
    });

    const filename = `Inspection_${editFarm.replace(/\s+/g, '_')}_${format(new Date(submittedIso), 'yyyy-MM-dd')}.jpg`;

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/jpeg' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {}
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows: (string | number)[][] = [
      [t('Lettuce Inspection Report')],
      [],
      [t('Farm Name'), editFarm + (editPlot ? ` (${editPlot})` : '')],
      [t('Inspector'), inspection.inspectorName],
      [t('Receiving Date'), receivingDateFormatted],
      [t('Submitted Date'), submittedDate],
      [],
      [t('Parameter'), t('Count'), t('Percentage')],
    ];

    Object.entries(inspection.counts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([paramId, count]) => {
        const param = paramMap.get(paramId);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
        rows.push([param?.name ?? paramId, count, pct]);
      });

    rows.push([]);
    rows.push([t('Total'), total, '100%']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Auto-size columns
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('Report'));
      XLSX.writeFile(wb, `Inspection_${editFarm.replace(/\s+/g, '_')}_${format(new Date(submittedIso), 'yyyy-MM-dd')}.xlsx`);
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
        className="bg-gray-50 w-full max-w-2xl sm:rounded-[32px] rounded-t-[32px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
      >
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t('Inspection Report')}</h2>
            <p className="text-sm text-gray-500 font-medium">
              {editFarm || inspection.farmName} {editPlot && <span className="text-gray-400">({editPlot})</span>}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* The exportable area */}
          <div ref={tableRef} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="font-black text-2xl text-gray-900 tracking-tight">{t('Lettuce Report')}</h3>
                <p className="text-gray-500 font-medium">{t('Ref:')} {inspection.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className="text-end">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('Submitted')}</div>
                <div className="font-bold text-gray-900">{submittedDate}</div>
                <div className="text-gray-500 text-sm">{submittedTime}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded-2xl">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('Farm')}</div>
                <select
                  value={editFarm}
                  onChange={(e) => handleFarmChange(e.target.value)}
                  className="appearance-none w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-gray-900 font-semibold text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-colors"
                >
                  {farmNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {availablePlots.length > 0 && (
                  <select
                    value={editPlot}
                    onChange={(e) => handlePlotChange(e.target.value)}
                    className="appearance-none w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-gray-500 font-medium text-sm mt-1.5 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-colors"
                  >
                    <option value="">{t('No plot selected')}</option>
                    {availablePlots.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('Inspector')}</div>
                <div className="font-semibold text-gray-900">{inspection.inspectorName}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('Receiving Date')}</div>
                <div className="font-semibold text-gray-900">{receivingDateFormatted}</div>
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="pb-3 text-start font-bold text-gray-400 uppercase tracking-wider">{t('Parameter')}</th>
                  <th className="pb-3 text-end font-bold text-gray-400 uppercase tracking-wider">{t('Count')}</th>
                  <th className="pb-3 text-end font-bold text-gray-400 uppercase tracking-wider">{t('%')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(inspection.counts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([paramId, count]) => {
                  const param = paramMap.get(paramId);
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <tr key={paramId}>
                      <td className="py-4">
                        <span className="flex items-center gap-3 font-semibold text-gray-900">
                          <span
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{ backgroundColor: param?.color ?? '#999' }}
                          />
                          {param?.name ?? paramId}
                        </span>
                      </td>
                      <td className="py-4 text-end font-semibold text-gray-900">{count}</td>
                      <td className="py-4 text-end font-medium text-gray-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-900">
                  <td className="py-4 font-black text-gray-900">{t('TOTAL HEADS')}</td>
                  <td className="py-4 text-end font-black text-gray-900 text-xl">{total}</td>
                  <td className="py-4 text-end font-bold text-gray-900">100%</td>
                </tr>
                <tr>
                  <td className="py-2 font-black text-red-600 text-sm">{t('TOTAL DEFECTS')}</td>
                  <td className="py-2 text-end font-black text-red-600">{defectTotal}</td>
                  <td className="py-2 text-end font-bold text-red-600">{defectPct}%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {onEditInfo && (
                <button
                  onClick={() => onEditInfo(inspection)}
                  className="flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                  {t('Edit Info')}
                </button>
              )}
              <button
                onClick={() => {
                  onClose();
                  navigate(`/inspect/${inspection.id}`);
                }}
                className={`flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-colors ${!onEditInfo ? 'col-span-2' : ''}`}
              >
                <Edit2 className="w-5 h-5" />
                {t('Edit Counts')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={exportJpg}
                className="flex items-center justify-center gap-2 py-3.5 bg-blue-50 text-blue-700 font-bold rounded-2xl hover:bg-blue-100 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
                {t('Save JPG')}
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 text-emerald-700 font-bold rounded-2xl hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5" />
                {t('Export Excel')}
              </button>
            </div>
            {inspection.stockId && (
              <button
                onClick={handleUnlink}
                className="flex items-center justify-center gap-2 py-3.5 bg-orange-50 text-orange-600 font-bold rounded-2xl hover:bg-orange-100 transition-colors"
              >
                <Link2 className="w-5 h-5" />
                {t('Unlink from Stock')}
              </button>
            )}
            <button
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 py-3.5 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              {t('Delete')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

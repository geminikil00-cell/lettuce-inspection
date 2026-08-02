import { useRef } from 'react';
import { toJpeg } from 'html-to-image';
import * as XLSX from 'xlsx';
import type { Inspection, Parameter } from '../types';
import { motion } from 'framer-motion';
import { X, Download, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';

interface Props {
  inspection: Inspection;
  parameters: Parameter[];
  onClose: () => void;
}

export function ReportTable({ inspection, parameters, onClose }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);

  const paramMap = new Map(parameters.map((p) => [p.id, p]));
  const total = Object.values(inspection.counts).reduce((a, b) => a + b, 0);

  const exportJpg = async () => {
    if (!tableRef.current) return;
    const dataUrl = await toJpeg(tableRef.current, { 
      quality: 0.95,
      backgroundColor: '#ffffff'
    });
    const link = document.createElement('a');
    link.download = `Inspection_${inspection.farmName.replace(/\s+/g, '_')}_${inspection.receivingDate}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      ['Lettuce Inspection Report'],
      [],
      ['Farm Name', inspection.farmName],
      ['Inspector', inspection.inspectorName],
      ['Date', inspection.receivingDate],
      ['Time', inspection.receivingTime],
      [],
      ['Parameter', 'Count', 'Percentage'],
    ];

    Object.entries(inspection.counts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([paramId, count]) => {
        const param = paramMap.get(paramId);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
        rows.push([param?.name ?? paramId, count, pct]);
      });

    rows.push([]);
    rows.push(['Total', total, '100%']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Auto-size columns
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Inspection_${inspection.farmName.replace(/\s+/g, '_')}_${inspection.receivingDate}.xlsx`);
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
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Inspection Report</h2>
            <p className="text-sm text-gray-500 font-medium">{inspection.farmName}</p>
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
                <h3 className="font-black text-2xl text-gray-900 tracking-tight">Lettuce Report</h3>
                <p className="text-gray-500 font-medium">Ref: {inspection.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">{inspection.receivingDate}</div>
                <div className="text-gray-500">{inspection.receivingTime}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded-2xl">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Farm</div>
                <div className="font-semibold text-gray-900">{inspection.farmName}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Inspector</div>
                <div className="font-semibold text-gray-900">{inspection.inspectorName}</div>
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="pb-3 text-left font-bold text-gray-400 uppercase tracking-wider">Parameter</th>
                  <th className="pb-3 text-right font-bold text-gray-400 uppercase tracking-wider">Count</th>
                  <th className="pb-3 text-right font-bold text-gray-400 uppercase tracking-wider">%</th>
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
                      <td className="py-4 text-right font-semibold text-gray-900">{count}</td>
                      <td className="py-4 text-right font-medium text-gray-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-900">
                  <td className="py-4 font-black text-gray-900">TOTAL HEADS</td>
                  <td className="py-4 text-right font-black text-gray-900 text-xl">{total}</td>
                  <td className="py-4 text-right font-bold text-gray-900">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={exportJpg}
              className="flex items-center justify-center gap-2 py-3.5 bg-blue-50 text-blue-700 font-bold rounded-2xl hover:bg-blue-100 transition-colors"
            >
              <ImageIcon className="w-5 h-5" />
              Save JPG
            </button>
            <button
              onClick={exportExcel}
              className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 text-emerald-700 font-bold rounded-2xl hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Export Excel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

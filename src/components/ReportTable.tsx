import { useRef } from 'react';
import { toJpeg } from 'html-to-image';
import * as XLSX from 'xlsx';
import type { Inspection, Parameter } from '../types';

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
    const dataUrl = await toJpeg(tableRef.current, { quality: 0.95 });
    const link = document.createElement('a');
    link.download = `inspection-${inspection.id.slice(0, 8)}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      ['Farm Name', inspection.farmName],
      ['Inspector', inspection.inspectorName],
      ['Date', inspection.receivingDate],
      ['Time', inspection.receivingTime],
      [],
      ['Parameter', 'Count', 'Percentage'],
    ];

    Object.entries(inspection.counts).forEach(([paramId, count]) => {
      const param = paramMap.get(paramId);
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
      rows.push([param?.name ?? paramId, count, pct]);
    });

    rows.push([]);
    rows.push(['Total', total, '100%']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inspection');
    XLSX.writeFile(wb, `inspection-${inspection.id.slice(0, 8)}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Inspection Report
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div ref={tableRef} className="bg-white p-4 rounded-lg">
          <table className="w-full text-sm border-collapse mb-4">
            <tbody>
              <tr>
                <td className="font-medium text-gray-600 py-1 pr-4">
                  Farm Name
                </td>
                <td className="text-gray-900">{inspection.farmName}</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-600 py-1 pr-4">
                  Inspector
                </td>
                <td className="text-gray-900">{inspection.inspectorName}</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-600 py-1 pr-4">Date</td>
                <td className="text-gray-900">{inspection.receivingDate}</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-600 py-1 pr-4">Time</td>
                <td className="text-gray-900">{inspection.receivingTime}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full text-sm border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-700">
                  Parameter
                </th>
                <th className="border border-gray-200 px-4 py-2 text-right font-medium text-gray-700">
                  Count
                </th>
                <th className="border border-gray-200 px-4 py-2 text-right font-medium text-gray-700">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(inspection.counts).map(([paramId, count]) => {
                const param = paramMap.get(paramId);
                const pct =
                  total > 0
                    ? ((count / total) * 100).toFixed(1) + '%'
                    : '0%';
                return (
                  <tr key={paramId}>
                    <td className="border border-gray-200 px-4 py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: param?.color ?? '#999' }}
                        />
                        {param?.name ?? paramId}
                      </span>
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right">
                      {count}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right">
                      {pct}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-bold">
                <td className="border border-gray-200 px-4 py-2">Total</td>
                <td className="border border-gray-200 px-4 py-2 text-right">
                  {total}
                </td>
                <td className="border border-gray-200 px-4 py-2 text-right">
                  100%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={exportJpg}
            className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export as JPG
          </button>
          <button
            onClick={exportExcel}
            className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Export as Excel
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { NewInspectionModal } from '../components/NewInspectionModal';
import { ReportTable } from '../components/ReportTable';
import { useSupabase } from '../hooks/useSupabase';
import type { Inspection } from '../types';

export function HomePage() {
  const { inspections, parameters, loading, error } = useSupabase();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);

  const paramMap = new Map(parameters.map((p) => [p.id, p]));

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load data</p>
          <p className="text-red-500 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-3">
            Make sure you have run the SQL in <code>schema.sql</code> and set
            the environment variables.
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-sm transition-colors"
        >
          + New Inspection
        </button>
      </div>

      {inspections.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No inspections yet.</p>
          <p className="text-sm mt-1">
            Click "New Inspection" to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((inspection) => {
            const total = Object.values(inspection.counts).reduce(
              (a, b) => a + b,
              0,
            );

            return (
              <button
                key={inspection.id}
                onClick={() => setSelectedInspection(inspection)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {inspection.farmName}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {inspection.receivingDate} {inspection.receivingTime} —{' '}
                      {inspection.inspectorName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-700">
                      {total}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(inspection.createdAt)}
                    </div>
                  </div>
                </div>

                {total > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {Object.entries(inspection.counts)
                      .filter(([, c]) => c > 0)
                      .map(([pid, count]) => {
                        const p = paramMap.get(pid);
                        if (!p) return null;
                        const pct = ((count / total) * 100).toFixed(0);
                        return (
                          <span
                            key={pid}
                            className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name}: {count} ({pct}%)
                          </span>
                        );
                      })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <NewInspectionModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
      />

      {selectedInspection && (
        <ReportTable
          inspection={selectedInspection}
          parameters={parameters}
          onClose={() => setSelectedInspection(null)}
        />
      )}
    </div>
  );
}

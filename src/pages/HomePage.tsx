import { useState } from 'react';
import { InspectionFormModal } from '../components/InspectionFormModal';
import { ReportTable } from '../components/ReportTable';
import { useSupabase } from '../hooks/useSupabase';
import type { Inspection } from '../types';
import { Plus, ChevronRight, Sprout, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { inspections, parameters, loading, error } = useSupabase();
  const { t } = useTranslation();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);
  const [editingInspection, setEditingInspection] = 
    useState<Inspection | null>(null);

  const paramMap = new Map(parameters.map((p) => [p.id, p]));

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-2xl w-full"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="bg-red-50/50 backdrop-blur-md border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-red-700 font-semibold mb-2">{t('Connection Error')}</p>
          <p className="text-red-600/80 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto px-4 py-6 sm:py-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('Recent Inspections')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('Manage and review your field data.')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-green-600 text-white text-sm font-semibold rounded-full shadow-lg shadow-green-600/20 hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{t('New Inspection')}</span>
        </motion.button>
      </div>

      {inspections.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-900">{t('No inspections yet')}</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            {t('Ready to get started? Tap the button above to begin your first lettuce inspection.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {inspections.map((inspection, idx) => {
              const total = Object.values(inspection.counts).reduce(
                (a, b) => a + b,
                0,
              );

              return (
                <motion.button
                  key={inspection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedInspection(inspection)}
                  className="group w-full text-left bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-xl hover:shadow-gray-200/50 hover:border-green-100 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
                        <Sprout className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-lg">
                          {inspection.farmName} {inspection.plotName ? <span className="text-gray-400 text-sm font-medium">({inspection.plotName})</span> : ''}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 font-medium mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(inspection.receivingDate)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{inspection.inspectorName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="text-2xl font-black text-gray-900 tracking-tight">
                        {total}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        {t('Heads')}
                      </div>
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                      {Object.entries(inspection.counts)
                        .filter(([, c]) => c > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([pid, count]) => {
                          const p = paramMap.get(pid);
                          if (!p) return null;
                          const pct = (count / total) * 100;
                          return (
                            <div
                              key={pid}
                              style={{ width: `${pct}%`, backgroundColor: p.color }}
                              className="h-full transition-all"
                              title={`${p.name}: ${count}`}
                            />
                          );
                        })}
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-semibold text-green-600">{t('View full report')}</span>
                    <ChevronRight className="w-5 h-5 text-green-600" />
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <InspectionFormModal
        open={showNewModal || !!editingInspection}
        onClose={() => {
          setShowNewModal(false);
          setEditingInspection(null);
        }}
        initialData={editingInspection || undefined}
      />

      <AnimatePresence>
        {selectedInspection && (
          <ReportTable
            inspection={selectedInspection}
            parameters={parameters}
            onClose={() => setSelectedInspection(null)}
            onEditInfo={(inspection) => {
              setSelectedInspection(null);
              setEditingInspection(inspection);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

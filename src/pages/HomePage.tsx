import { useState, useMemo, useRef, useEffect } from 'react';
import { InspectionFormModal } from '../components/InspectionFormModal';
import { ReportTable } from '../components/ReportTable';
import { useSupabase } from '../hooks/useSupabase';
import { countHeads } from '../lib/utils';
import type { Inspection } from '../types';
import { Plus, ChevronRight, Sprout, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday } from 'date-fns';

export function HomePage() {
  const { inspections, parameters, loading, error } = useSupabase();
  const { t } = useTranslation();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);
  const [editingInspection, setEditingInspection] = 
    useState<Inspection | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const paramMap = new Map(parameters.map((p) => [p.id, p]));

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Inspection[]>();
    inspections.forEach((i) => {
      const iso = i.submittedAt || i.createdAt;
      const key = format(new Date(iso), 'yyyy-MM-dd');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    });
    return new Map([...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [inspections]);

  const dateKeys = useMemo(() => [...groupedByDate.keys()], [groupedByDate]);

  const effectiveDate = useMemo(() => {
    if (selectedDate && dateKeys.includes(selectedDate)) return selectedDate;
    const today = format(new Date(), 'yyyy-MM-dd');
    return dateKeys.includes(today) ? today : (dateKeys[0] || today);
  }, [selectedDate, dateKeys]);

  const filteredInspections = effectiveDate ? groupedByDate.get(effectiveDate) || [] : [];

  useEffect(() => {
    if (!selectedDate) return;
    const idx = dateKeys.indexOf(selectedDate);
    if (idx >= 0 && dateScrollRef.current) {
      const chip = dateScrollRef.current.children[idx] as HTMLElement;
      if (chip) {
        chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDate, dateKeys]);

  const getDateLabel = (key: string) => {
    const d = new Date(key + 'T00:00:00');
    if (isToday(d)) return t('Today');
    if (isYesterday(d)) return t('Yesterday');
    return format(d, 'MMM d');
  };

  const formatTime = (iso: string) => {
    return format(new Date(iso), 'h:mm a');
  };

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

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto px-4 py-6 sm:py-8"
    >
      <div className="flex items-center justify-between mb-6">
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
        <>
          <div
            ref={dateScrollRef}
            className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
          >
            {dateKeys.map((key) => {
              const count = groupedByDate.get(key)!.length;
              const isActive = key === effectiveDate;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {getDateLabel(key)}
                  <span className={`ml-1.5 text-xs ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredInspections.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">{t('No reports for this day')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredInspections.map((inspection, idx) => {
                  const total = countHeads(inspection.counts, parameters);
                  const iso = inspection.submittedAt || inspection.createdAt;

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
                            <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                              {inspection.farmName} {inspection.plotName ? <span className="text-gray-400 text-sm font-medium">({inspection.plotName})</span> : ''}
                              {inspection.stockId && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">STK</span>}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 font-medium mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {formatTime(iso)}
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
                            .filter(([pid, c]) => c > 0 && !paramMap.get(pid)?.isSpecial)
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
        </>
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

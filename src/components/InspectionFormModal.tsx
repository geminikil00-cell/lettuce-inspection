import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, User, Sprout, Plus, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Inspection } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Inspection;
  stockPrefill?: { farmName: string; plotName: string; receivingDate: string; stockId: string };
}

export function InspectionFormModal({ open, onClose, initialData, stockPrefill }: Props) {
  const navigate = useNavigate();
  const { parameters, farmNames, farmPlots, inspectorNames, addInspection, updateInspection, addFarmName, addFarmPlot, addInspectorName } = useSupabase();
  const { t } = useTranslation();

  const [farmName, setFarmName] = useState('');
  const [plotName, setPlotName] = useState('');
  const [receivingDate, setReceivingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [receivingTime, setReceivingTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [inspectorName, setInspectorName] = useState('');
  const [newFarm, setNewFarm] = useState('');
  const [newPlot, setNewPlot] = useState('');
  const [newInspector, setNewInspector] = useState('');
  
  const [showNewFarm, setShowNewFarm] = useState(false);
  const [showNewPlot, setShowNewPlot] = useState(false);
  const [showNewInspector, setShowNewInspector] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFarmName(initialData.farmName);
        setPlotName(initialData.plotName || '');
        setReceivingDate(initialData.receivingDate);
        setReceivingTime(initialData.receivingTime);
        setInspectorName(initialData.inspectorName);
      } else if (stockPrefill) {
        setFarmName(stockPrefill.farmName);
        setPlotName(stockPrefill.plotName);
        setReceivingDate(stockPrefill.receivingDate);
        setReceivingTime(new Date().toTimeString().slice(0, 5));
        setInspectorName('');
      } else {
        setFarmName('');
        setPlotName('');
        setReceivingDate(new Date().toISOString().slice(0, 10));
        setReceivingTime(new Date().toTimeString().slice(0, 5));
        setInspectorName('');
      }
      setShowNewFarm(false);
      setShowNewPlot(false);
      setShowNewInspector(false);
      setSubmitError('');
    }
  }, [open, initialData, stockPrefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalFarm = farmName === '__new__' ? newFarm.trim() : farmName;
    const finalPlot = plotName === '__new__' ? newPlot.trim() : plotName;
    const finalInspector = inspectorName === '__new__' ? newInspector.trim() : inspectorName;

    if (!finalFarm || !receivingDate || !finalInspector)
      return;

    setSubmitting(true);
    setSubmitError('');

    try {
      if (farmName === '__new__' && newFarm.trim()) {
        await addFarmName(newFarm.trim());
      }
      if (plotName === '__new__' && newPlot.trim()) {
        await addFarmPlot(finalFarm, newPlot.trim());
      }
      if (inspectorName === '__new__' && newInspector.trim()) {
        await addInspectorName(newInspector.trim());
      }

      if (initialData) {
        await updateInspection(initialData.id, {
          farmName: finalFarm,
          plotName: finalPlot,
          inspectorName: finalInspector,
          receivingDate,
          receivingTime,
        });
        onClose();
        // Force reload or state update in ReportTable? 
        // ReportTable receives selectedInspection from HomePage, so HomePage needs to refresh or we just navigate
      } else {
        const initialCounts: Record<string, number> = {};
        parameters.forEach((p) => {
          initialCounts[p.id] = 0;
        });

        const inspection = await addInspection({
          farmName: finalFarm,
          plotName: finalPlot,
          inspectorName: finalInspector,
          receivingDate,
          receivingTime,
          stockId: stockPrefill?.stockId,
          counts: initialCounts,
        });

        if (inspection) {
          onClose();
          navigate(`/inspect/${inspection.id}`);
        }
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save inspection',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const availablePlots = farmName && farmName !== '__new__' ? (farmPlots[farmName] || []) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 pb-safe"
        >
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-md sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                {initialData ? t('Edit Info') : stockPrefill ? t('Inspect Stock') : t('New Inspection')}
              </h2>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {submitError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl font-medium">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Farm Selection */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <Sprout className="w-4 h-4 text-green-600" />
                    {t('Farm Name')}
                  </label>
                  {!showNewFarm ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={farmName}
                          onChange={(e) => {
                            setFarmName(e.target.value);
                            setPlotName('');
                            setShowNewPlot(false);
                          }}
                          className="appearance-none w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all"
                          required
                        >
                          <option value="" disabled>{t('Select a farm...')}</option>
                          {farmNames.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                          <option value="__new__">{t('✨ Add new farm')}</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewFarm(true)}
                        className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFarm}
                        onChange={(e) => setNewFarm(e.target.value)}
                        placeholder={t('Enter farm name...')}
                        className="flex-1 border-2 border-green-500 bg-white rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newFarm.trim()) {
                            addFarmName(newFarm.trim());
                            setFarmName(newFarm.trim());
                            setPlotName('');
                          }
                          setShowNewFarm(false);
                        }}
                        className="px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors"
                      >
                        {t('Add')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewFarm(false)}
                        className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Plot Selection */}
                {(farmName || showNewFarm) && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      {t('Plot Name (Optional)')}
                    </label>
                    {!showNewPlot ? (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select
                            value={plotName}
                            onChange={(e) => setPlotName(e.target.value)}
                            className="appearance-none w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all"
                          >
                            <option value="">{t('No plot selected')}</option>
                            {availablePlots.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                            <option value="__new__">{t('✨ Add new plot')}</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowNewPlot(true)}
                          className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPlot}
                          onChange={(e) => setNewPlot(e.target.value)}
                          placeholder={t('Enter plot name...')}
                          className="flex-1 border-2 border-green-500 bg-white rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (newPlot.trim()) {
                              const fName = farmName === '__new__' ? newFarm.trim() : farmName;
                              if (fName) {
                                await addFarmPlot(fName, newPlot.trim());
                                setPlotName(newPlot.trim());
                              }
                            }
                            setShowNewPlot(false);
                          }}
                          className="px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors"
                        >
                          {t('Add')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewPlot(false)}
                          className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Date & Time */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 text-green-600" />
                      {t('Date')}
                    </label>
                    <input
                      type="date"
                      value={receivingDate}
                      onChange={(e) => setReceivingDate(e.target.value)}
                      className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                      <Clock className="w-4 h-4 text-green-600" />
                      {t('Time')}
                    </label>
                    <input
                      type="time"
                      value={receivingTime}
                      onChange={(e) => setReceivingTime(e.target.value)}
                      className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Inspector Selection */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <User className="w-4 h-4 text-green-600" />
                    {t('Inspector')}
                  </label>
                  {!showNewInspector ? (
                    <div className="flex gap-2">
                      <select
                        value={inspectorName}
                        onChange={(e) => setInspectorName(e.target.value)}
                        className="appearance-none flex-1 border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all"
                        required
                      >
                        <option value="" disabled>{t('Select inspector...')}</option>
                        {inspectorNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="__new__">{t('✨ Add new inspector')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewInspector(true)}
                        className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newInspector}
                        onChange={(e) => setNewInspector(e.target.value)}
                        placeholder={t('Enter name...')}
                        className="flex-1 border-2 border-green-500 bg-white rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newInspector.trim()) {
                            addInspectorName(newInspector.trim());
                            setInspectorName(newInspector.trim());
                          }
                          setShowNewInspector(false);
                        }}
                        className="px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors"
                      >
                        {t('Add')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewInspector(false)}
                        className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 text-white font-bold text-lg bg-green-600 rounded-2xl hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-green-600/30"
                  >
                    {submitting ? t('Starting...') : (initialData ? t('Save Changes') : t('Start Inspection'))}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

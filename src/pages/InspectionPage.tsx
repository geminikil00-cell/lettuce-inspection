import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, Undo2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Haptic feedback utility
const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    // A light tap
    navigator.vibrate(40);
  }
};

export function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inspections, parameters, updateCounts } = useSupabase();
  const { t } = useTranslation();
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

  const inspection = inspections.find((i) => i.id === id);

  // Auto-save debounce logic
  const [localCounts, setLocalCounts] = useState<Record<string, number>>(
    inspection?.counts || {}
  );
  
  useEffect(() => {
    if (inspection) {
      setLocalCounts(inspection.counts);
    }
  }, [inspection?.id]); // Only reset when ID changes

  // Save to supabase when localCounts change (debounced)
  useEffect(() => {
    if (!inspection) return;
    const timeoutId = setTimeout(() => {
      // Don't save if nothing changed
      if (JSON.stringify(localCounts) !== JSON.stringify(inspection.counts)) {
         updateCounts(inspection.id, localCounts);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [localCounts, inspection, updateCounts]);


  if (!inspection) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-900 font-bold text-xl mb-2">{t('Inspection not found')}</p>
        <p className="text-gray-500 text-sm mb-6">{t('This inspection may have been deleted or does not exist.')}</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          {t('Return Home')}
        </Link>
      </div>
    );
  }

  const total = Object.values(localCounts).reduce((a, b) => a + b, 0);

  const handleTap = (paramId: string) => {
    triggerHaptic();
    setLocalCounts(prev => ({
      ...prev,
      [paramId]: (prev[paramId] || 0) + 1
    }));
  };

  const handleUndo = (paramId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering the main button if it overlays
    if ((localCounts[paramId] || 0) <= 0) return;
    
    // Distinct haptic for undo
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 30, 20]);
    }
    
    setLocalCounts(prev => ({
      ...prev,
      [paramId]: prev[paramId] - 1
    }));
  };

  const handleFinish = async () => {
    // Force immediate save before leaving
    await updateCounts(inspection.id, localCounts);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-safe relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{inspection.farmName}</span>
            <span className="text-2xl font-black text-white">{total} <span className="text-sm font-medium text-gray-400">{t('Heads')}</span></span>
          </div>

          <button
            onClick={() => setShowConfirmFinish(true)}
            className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {parameters.map((param) => {
            const count = localCounts[param.id] || 0;
            return (
              <motion.button
                key={param.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleTap(param.id)}
                className="relative w-full aspect-[4/3] sm:aspect-square rounded-[32px] text-white flex flex-col items-center justify-center shadow-2xl overflow-hidden group select-none touch-manipulation"
                style={{ backgroundColor: param.color }}
              >
                {/* Subtle gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-black/20" />
                
                <span className="relative z-10 text-2xl sm:text-3xl font-black tracking-tight mb-2 drop-shadow-md">
                  {param.name}
                </span>
                
                <div className="relative z-10 bg-black/20 backdrop-blur-md px-6 py-2 rounded-full font-bold text-4xl">
                  {count}
                </div>

                {/* Undo Button */}
                <div 
                  onClick={(e) => handleUndo(param.id, e)}
                  className={`absolute top-6 right-6 p-3 rounded-full bg-black/20 backdrop-blur-md transition-opacity ${count > 0 ? 'opacity-100 hover:bg-black/40' : 'opacity-0 pointer-events-none'}`}
                >
                  <Undo2 className="w-5 h-5" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmFinish && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-safe"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden" />
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                {t('Finish Inspection?')}
              </h3>
              <p className="text-gray-500 mb-8 font-medium">
                {t("You've inspected")} <strong className="text-gray-900">{total} {t("heads")}</strong> {t("in total. This will save the results and return you to the home screen.")}
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleFinish}
                  className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-2xl hover:bg-green-700 transition-colors"
                >
                  {t('Confirm & Save')}
                </button>
                <button
                  onClick={() => setShowConfirmFinish(false)}
                  className="w-full py-4 bg-gray-100 text-gray-700 text-lg font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  {t('Resume Counting')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

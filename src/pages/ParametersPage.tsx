import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import type { Parameter } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Plus, Edit2, Trash2, Sprout, User, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

const PRESET_COLORS = [
  '#22c55e', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#d946ef', '#f43f5e', '#ef4444', '#f97316', '#eab308', 
  '#84cc16', '#6b7280', '#1f2937'
];

export function ParametersPage() {
  const {
    parameters, farmNames, farmPlots, inspectorNames, loading, error,
    addParameter, updateParameter, deleteParameter,
    addFarmName, deleteFarmName, addFarmPlot, deleteFarmPlot,
    addInspectorName, deleteInspectorName,
  } = useSupabase();
  const { t } = useTranslation();

  const [editingParam, setEditingParam] = useState<Parameter | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIsDefect, setEditIsDefect] = useState(true);
  const [editIsSpecial, setEditIsSpecial] = useState(false);
  const [newParamName, setNewParamName] = useState('');
  const [newParamColor, setNewParamColor] = useState(PRESET_COLORS[0]);
  const [newFarm, setNewFarm] = useState('');
  const [newInspector, setNewInspector] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-3xl w-full"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-red-500 font-medium bg-red-50 rounded-2xl p-6">
        {error}
      </div>
    );
  }

  const handleAddParam = async () => {
    const trimmed = newParamName.trim();
    if (!trimmed) return;
    try {
      await addParameter(trimmed, newParamColor);
      setNewParamName('');
      setNewParamColor(PRESET_COLORS[0]);
      setActionError('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingParam || !editName.trim()) return;
    try {
      await updateParameter(editingParam.id, editName.trim(), editColor, editIsDefect, editIsSpecial);
      setEditingParam(null);
      setActionError('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Delete this parameter?")) return;
    try {
      await deleteParameter(id);
      setActionError('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center">
          <Settings2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Settings')}</h1>
          <p className="text-sm text-gray-500 font-medium">{t('Manage app configuration')}</p>
        </div>
      </div>

      <AnimatePresence>
        {actionError && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-2xl"
          >
            {actionError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PARAMETERS SECTION */}
      <section className="bg-white p-5 sm:p-6 rounded-[32px] border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          {t('Inspection Parameters')}
        </h2>
        <p className="text-sm text-gray-500 font-medium mb-6">
          {t('Define the large buttons used during counting.')}
        </p>

        <div className="space-y-3 mb-6">
          <AnimatePresence>
            {parameters.map((param) =>
              editingParam?.id === param.id ? (
                <motion.div
                  key={`edit-${param.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gray-50 rounded-2xl p-4 border border-gray-200"
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold focus:border-green-500 focus:outline-none mb-4 transition-colors"
                  />
                  <div className="flex flex-wrap gap-2 mb-4">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all transform",
                          editColor === color ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:scale-110'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsDefect}
                      onChange={(e) => setEditIsDefect(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-sm font-bold text-gray-700">Defect</span>
                  </label>
                  <label className="flex items-center gap-3 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsSpecial}
                      onChange={(e) => setEditIsSpecial(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm font-bold text-gray-700">Special (excluded from defect %)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      {t('Save Changes')}
                    </button>
                    <button
                      onClick={() => setEditingParam(null)}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={param.id}
                  layout
                  className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 hover:shadow-sm transition-all group"
                >
                  <span
                    className="w-10 h-10 rounded-xl shadow-inner shrink-0"
                    style={{ backgroundColor: param.color }}
                  />
                  <span className="flex-1 font-bold text-gray-900 text-lg flex items-center gap-2">
                    {param.name}
                    <button
                      onClick={async () => {
                        await updateParameter(param.id, param.name, param.color, !param.isDefect, param.isSpecial);
                      }}
                      className={param.isDefect 
                        ? 'text-[10px] uppercase font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md hover:bg-red-200'
                        : param.isSpecial
                        ? 'text-[10px] uppercase font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md hover:bg-purple-200'
                        : 'text-[10px] uppercase font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-md hover:bg-green-200'
                      }
                    >
                      {param.isDefect ? 'Defect' : param.isSpecial ? 'Special' : 'Free ✓'}
                    </button>
                    {!param.isDefect && (
                      <button
                        onClick={async () => {
                          await updateParameter(param.id, param.name, param.color, param.isDefect, !param.isSpecial);
                        }}
                        className={param.isSpecial
                          ? 'text-[10px] uppercase font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md hover:bg-purple-200'
                          : 'text-[10px] uppercase font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-md hover:bg-green-200'
                        }
                      >
                        {param.isSpecial ? 'Special' : 'Free ✓'}
                      </button>
                    )}
                  </span>
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingParam(param);
                        setEditName(param.name);
                        setEditColor(param.color);
                        setEditIsDefect(param.isDefect);
                        setEditIsSpecial(param.isSpecial);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(param.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{t('Add New Parameter')}</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newParamName}
              onChange={(e) => setNewParamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParam()}
              placeholder={t('E.g. Overripe')}
              className="flex-1 bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-bold focus:border-green-500 focus:outline-none transition-colors"
            />
            <div className="flex gap-2 p-2 bg-white rounded-xl border border-gray-200 overflow-x-auto no-scrollbar">
              {PRESET_COLORS.map((color) => (
                <button
                  key={`new-${color}`}
                  type="button"
                  onClick={() => setNewParamColor(color)}
                  className={cn(
                    "w-8 h-8 shrink-0 rounded-full border-2 transition-all transform",
                    newParamColor === color ? 'border-gray-900 scale-110 shadow-sm' : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={handleAddParam}
              disabled={!newParamName.trim()}
              className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('Add')}
            </button>
          </div>
        </div>
      </section>

      {/* FARMS SECTION */}
      <section className="bg-white p-5 sm:p-6 rounded-[32px] border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Sprout className="w-5 h-5 text-green-600" />
          {t('Farms')}
        </h2>
        <div className="flex items-center gap-3 mb-6">
          <input
            type="text"
            value={newFarm}
            onChange={(e) => setNewFarm(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && newFarm.trim()) {
                await addFarmName(newFarm.trim());
                setNewFarm('');
              }
            }}
            placeholder={t('Add a farm name...')}
            className="flex-1 bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-gray-900 font-medium focus:bg-white focus:border-green-500 focus:outline-none transition-colors"
          />
          <button
            onClick={async () => {
              if (newFarm.trim()) {
                await addFarmName(newFarm.trim());
                setNewFarm('');
              }
            }}
            disabled={!newFarm.trim()}
            className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {t('Add')}
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {farmNames.length === 0 && (
            <span className="text-sm font-medium text-gray-400">{t('No farms added yet.')}</span>
          )}
          <AnimatePresence>
            {farmNames.map((name) => (
              <motion.div
                key={name}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-green-50/30 border border-green-100 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-green-900 text-lg">{name}</span>
                  <button
                    onClick={() => deleteFarmName(name)}
                    className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Plots */}
                <div className="pl-3 sm:pl-4 border-l-2 border-green-200">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(farmPlots[name] || []).map(plot => (
                      <span key={plot} className="inline-flex items-center gap-1.5 bg-white text-green-800 font-semibold rounded-lg px-3 py-1.5 text-sm border border-green-200 shadow-sm">
                        {plot}
                        <button onClick={() => deleteFarmPlot(name, plot)} className="text-green-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder={t('Add plot...')}
                    className="bg-white border border-green-200 rounded-xl px-4 py-2 text-sm font-medium focus:border-green-500 focus:outline-none w-full sm:w-64 transition-colors shadow-sm"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        await addFarmPlot(name, e.currentTarget.value.trim());
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* INSPECTORS SECTION */}
      <section className="bg-white p-5 sm:p-6 rounded-[32px] border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          {t('Inspectors')}
        </h2>
        <div className="flex items-center gap-3 mb-6">
          <input
            type="text"
            value={newInspector}
            onChange={(e) => setNewInspector(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && newInspector.trim()) {
                await addInspectorName(newInspector.trim());
                setNewInspector('');
              }
            }}
            placeholder={t('Add an inspector name...')}
            className="flex-1 bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-gray-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
          />
          <button
            onClick={async () => {
              if (newInspector.trim()) {
                await addInspectorName(newInspector.trim());
                setNewInspector('');
              }
            }}
            disabled={!newInspector.trim()}
            className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {t('Add')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {inspectorNames.length === 0 && (
            <span className="text-sm font-medium text-gray-400">{t('No inspectors added yet.')}</span>
          )}
          <AnimatePresence>
            {inspectorNames.map((name) => (
              <motion.span
                key={name}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 font-bold rounded-xl px-4 py-2 text-sm border border-blue-100"
              >
                {name}
                <button
                  onClick={() => deleteInspectorName(name)}
                  className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-200 hover:text-blue-800 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </motion.div>
  );
}

import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import type { Parameter } from '../types';

const PRESET_COLORS = [
  '#22c55e',
  '#ef4444',
  '#eab308',
  '#3b82f6',
  '#7c3aed',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#6b7280',
];

export function ParametersPage() {
  const {
    parameters,
    farmNames,
    inspectorNames,
    loading,
    error,
    addParameter,
    updateParameter,
    deleteParameter,
    addFarmName,
    deleteFarmName,
    addInspectorName,
    deleteInspectorName,
  } = useSupabase();

  const [editingParam, setEditingParam] = useState<Parameter | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newParamName, setNewParamName] = useState('');
  const [newParamColor, setNewParamColor] = useState(PRESET_COLORS[0]);
  const [newFarm, setNewFarm] = useState('');
  const [newInspector, setNewInspector] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-red-500">
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
      await updateParameter(editingParam.id, editName.trim(), editColor);
      setEditingParam(null);
      setActionError('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteParameter(id);
      setActionError('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {actionError && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
          {actionError}
        </div>
      )}

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Inspection Parameters
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          These become the large buttons during inspection. Each tap counts one
          lettuce head with that condition.
        </p>

        <div className="space-y-2 mb-4">
          {parameters.map((param) =>
            editingParam?.id === param.id ? (
              <div
                key={param.id}
                className="flex items-center gap-3 bg-gray-50 rounded-lg p-3"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        editColor === color
                          ? 'border-gray-800 scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingParam(null)}
                  className="px-3 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                key={param.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3"
              >
                <span
                  className="w-6 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: param.color }}
                />
                <span className="flex-1 font-medium text-gray-800">
                  {param.name}
                </span>
                <button
                  onClick={() => {
                    setEditingParam(param);
                    setEditName(param.name);
                    setEditColor(param.color);
                  }}
                  className="px-3 py-1 text-sm text-green-700 hover:bg-green-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(param.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            ),
          )}
        </div>

        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
          <input
            type="text"
            value={newParamName}
            onChange={(e) => setNewParamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddParam()}
            placeholder="New parameter name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewParamColor(color)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  newParamColor === color
                    ? 'border-gray-800 scale-110'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            onClick={handleAddParam}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Farm Names</h2>
        <div className="flex items-center gap-3 mb-3">
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
            placeholder="Add farm name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={async () => {
              if (newFarm.trim()) {
                await addFarmName(newFarm.trim());
                setNewFarm('');
              }
            }}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {farmNames.length === 0 && (
            <span className="text-sm text-gray-400">No farm names added.</span>
          )}
          {farmNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm"
            >
              {name}
              <button
                onClick={() => deleteFarmName(name)}
                className="text-red-400 hover:text-red-600 ml-1"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Inspector Names
        </h2>
        <div className="flex items-center gap-3 mb-3">
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
            placeholder="Add inspector name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={async () => {
              if (newInspector.trim()) {
                await addInspectorName(newInspector.trim());
                setNewInspector('');
              }
            }}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {inspectorNames.length === 0 && (
            <span className="text-sm text-gray-400">
              No inspector names added.
            </span>
          )}
          {inspectorNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm"
            >
              {name}
              <button
                onClick={() => deleteInspectorName(name)}
                className="text-red-400 hover:text-red-600 ml-1"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

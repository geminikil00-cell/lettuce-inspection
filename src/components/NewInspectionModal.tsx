import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewInspectionModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { parameters, farmNames, inspectorNames, addInspection, addFarmName, addInspectorName } = useSupabase();

  const [farmName, setFarmName] = useState('');
  const [receivingDate, setReceivingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [receivingTime, setReceivingTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [inspectorName, setInspectorName] = useState('');
  const [newFarm, setNewFarm] = useState('');
  const [newInspector, setNewInspector] = useState('');
  const [showNewFarm, setShowNewFarm] = useState(false);
  const [showNewInspector, setShowNewInspector] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalFarm = farmName === '__new__' ? newFarm.trim() : farmName;
    const finalInspector =
      inspectorName === '__new__' ? newInspector.trim() : inspectorName;

    if (!finalFarm || !receivingDate || !receivingTime || !finalInspector)
      return;

    setSubmitting(true);
    setSubmitError('');

    try {
      if (farmName === '__new__' && newFarm.trim()) {
        await addFarmName(newFarm.trim());
      }
      if (inspectorName === '__new__' && newInspector.trim()) {
        await addInspectorName(newInspector.trim());
      }

      const initialCounts: Record<string, number> = {};
      parameters.forEach((p) => {
        initialCounts[p.id] = 0;
      });

      const inspection = await addInspection({
        farmName: finalFarm,
        inspectorName: finalInspector,
        receivingDate,
        receivingTime,
        counts: initialCounts,
      });

      if (inspection) {
        onClose();
        navigate(`/inspect/${inspection.id}`);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create inspection',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          New Inspection
        </h2>

        {submitError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {submitError}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Farm Name
            </label>
            {!showNewFarm ? (
              <div className="flex gap-2">
                <select
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select farm...</option>
                  {farmNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="__new__">+ Add new farm</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewFarm(true)}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFarm}
                  onChange={(e) => setNewFarm(e.target.value)}
                  placeholder="Enter new farm name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newFarm.trim()) {
                      addFarmName(newFarm.trim());
                      setFarmName(newFarm.trim());
                    }
                    setShowNewFarm(false);
                  }}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFarm(false)}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receiving Date
              </label>
              <input
                type="date"
                value={receivingDate}
                onChange={(e) => setReceivingDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receiving Time
              </label>
              <input
                type="time"
                value={receivingTime}
                onChange={(e) => setReceivingTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inspector Name
            </label>
            {!showNewInspector ? (
              <div className="flex gap-2">
                <select
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select inspector...</option>
                  {inspectorNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="__new__">+ Add new inspector</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewInspector(true)}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInspector}
                  onChange={(e) => setNewInspector(e.target.value)}
                  placeholder="Enter new inspector name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewInspector(false)}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Start Inspection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

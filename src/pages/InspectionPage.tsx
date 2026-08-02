import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';

export function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inspections, parameters, updateCounts } = useSupabase();
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

  const inspection = inspections.find((i) => i.id === id);

  if (!inspection) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">Inspection not found.</p>
        <Link
          to="/"
          className="text-green-600 hover:underline mt-2 inline-block"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const total = Object.values(inspection.counts).reduce((a, b) => a + b, 0);

  const handleTap = (paramId: string) => {
    const updatedCounts = {
      ...inspection.counts,
      [paramId]: (inspection.counts[paramId] || 0) + 1,
    };
    updateCounts(inspection.id, updatedCounts);
  };

  const handleUndo = (paramId: string) => {
    if ((inspection.counts[paramId] || 0) <= 0) return;
    const updatedCounts = {
      ...inspection.counts,
      [paramId]: inspection.counts[paramId] - 1,
    };
    updateCounts(inspection.id, updatedCounts);
  };

  const handleFinish = () => {
    navigate('/');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-gray-500">Farm:</span>{' '}
            <span className="font-medium">{inspection.farmName}</span>
          </span>
          <span>
            <span className="text-gray-500">Date:</span>{' '}
            <span className="font-medium">{inspection.receivingDate}</span>
          </span>
          <span>
            <span className="text-gray-500">Time:</span>{' '}
            <span className="font-medium">{inspection.receivingTime}</span>
          </span>
          <span>
            <span className="text-gray-500">Inspector:</span>{' '}
            <span className="font-medium">{inspection.inspectorName}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl font-bold text-gray-900">
          Total: {total} heads
        </div>
        <button
          onClick={() => setShowConfirmFinish(true)}
          className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-sm"
        >
          Finish Inspection
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {parameters.map((param) => {
          const count = inspection.counts[param.id] || 0;
          return (
            <div key={param.id} className="flex flex-col">
              <button
                onClick={() => handleTap(param.id)}
                className="w-full py-8 rounded-2xl text-white text-xl font-bold shadow-lg active:scale-95 transition-transform select-none"
                style={{ backgroundColor: param.color }}
              >
                {param.name}
              </button>
              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  onClick={() => handleUndo(param.id)}
                  disabled={count === 0}
                  className="px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  − Undo
                </button>
                <span className="text-lg font-semibold text-gray-800 min-w-[3ch] text-center">
                  {count}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {showConfirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Finish Inspection?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Total heads inspected: <strong>{total}</strong>. This will save
              the results and return to the home page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmFinish(false)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Continue
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Finish & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

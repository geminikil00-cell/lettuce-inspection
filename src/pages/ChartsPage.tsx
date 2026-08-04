import { useState, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { subDays, subMonths, isAfter, parseISO, format } from 'date-fns';
import { TrendingUp, AlertTriangle, Sprout } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

type TimeRange = '7D' | '30D' | '3M' | 'ALL';

export function ChartsPage() {
  const { inspections, parameters, farmNames, loading } = useSupabase();
  const { t } = useTranslation();
  const [selectedFarm, setSelectedFarm] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');

  const defectParams = useMemo(() => parameters.filter((p) => p.isDefect), [parameters]);

  const chartData = useMemo(() => {
    if (!inspections.length || !defectParams.length) return [];

    const now = new Date();
    const startDate =
      timeRange === '7D'
        ? subDays(now, 7)
        : timeRange === '30D'
        ? subDays(now, 30)
        : timeRange === '3M'
        ? subMonths(now, 3)
        : new Date(0);

    const filtered = inspections
      .filter((ins) => {
        if (selectedFarm !== 'ALL' && ins.farmName !== selectedFarm) return false;
        const date = parseISO(ins.receivingDate);
        return isAfter(date, startDate);
      })
      .sort(
        (a, b) => new Date(a.receivingDate).getTime() - new Date(b.receivingDate).getTime(),
      );

    return filtered.map((ins) => {
      const total = Object.values(ins.counts).reduce((a, b) => a + b, 0);
      const point: Record<string, any> = {
        date: ins.receivingDate,
        label: format(new Date(ins.receivingDate), 'MMM d'),
        farm: ins.farmName,
        total,
      };
      if (total > 0) {
        defectParams.forEach((p) => {
          point[p.name] = ((ins.counts[p.id] || 0) / total) * 100;
        });
      } else {
        defectParams.forEach((p) => {
          point[p.name] = 0;
        });
      }
      return point;
    });
  }, [inspections, selectedFarm, timeRange, defectParams]);

  const avgDefectRate = useMemo(() => {
    if (!chartData.length) return 0;
    let totalPct = 0;
    let count = 0;
    chartData.forEach((point) => {
      defectParams.forEach((p) => {
        totalPct += point[p.name] || 0;
        count++;
      });
    });
    return count > 0 ? (totalPct / count).toFixed(1) : '0';
  }, [chartData, defectParams]);

  const highestDefect = useMemo(() => {
    if (!chartData.length || !defectParams.length) return { name: '', value: 0 };
    const totals: Record<string, number> = {};
    defectParams.forEach((p) => {
      totals[p.name] = chartData.reduce((sum, pt) => sum + (pt[p.name] || 0), 0);
    });
    const entries = Object.entries(totals);
    if (!entries.length) return { name: '', value: 0 };
    const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const avg = chartData.length > 0 ? top[1] / chartData.length : 0;
    return { name: top[0], value: avg };
  }, [chartData, defectParams]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-10 bg-gray-200 animate-pulse rounded-lg w-1/3" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-2xl w-full" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Trend Analysis')}</h1>
          <p className="text-sm text-gray-500">{t('Track defect percentages over time.')}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <select
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value)}
              className="appearance-none w-full sm:w-auto pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
            >
              <option value="ALL">{t('All Farms')}</option>
              {farmNames.map((farm) => (
                <option key={farm} value={farm}>{farm}</option>
              ))}
            </select>
            <Sprout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['7D', '30D', '3M', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                  timeRange === range
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900',
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Avg Defect %')}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
            {avgDefectRate}<span className="text-lg font-medium text-gray-500">%</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Top Defect')}</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {highestDefect.name}
          </div>
          <div className="text-sm text-gray-500">{highestDefect.value.toFixed(1)}% avg</div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-gray-800 font-semibold">
          <TrendingUp className="w-5 h-5 text-green-600" />
          {t('Defect Percentage Per Batch')}
        </div>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            {t('No data available for this period.')}
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                {defectParams.map((p) => (
                  <Line
                    key={p.id}
                    type="monotone"
                    dataKey={p.name}
                    stroke={p.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: p.color }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

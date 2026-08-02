import { useState, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { subDays, subMonths, isAfter, parseISO } from 'date-fns';
import { Calendar, Sprout, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

type TimeRange = '7D' | '30D' | '3M' | 'ALL';

export function ChartsPage() {
export function ChartsPage() {
  const { inspections, parameters, farmNames, loading } = useSupabase();
  const { t } = useTranslation();
  const [selectedFarm, setSelectedFarm] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');

  const paramMap = useMemo(() => new Map(parameters.map((p) => [p.id, p])), [parameters]);

  // Aggregate Data
  const chartData = useMemo(() => {
    if (!inspections.length) return [];

    const now = new Date();
    const startDate =
      timeRange === '7D'
        ? subDays(now, 7)
        : timeRange === '30D'
        ? subDays(now, 30)
        : timeRange === '3M'
        ? subMonths(now, 3)
        : new Date(0); // All time

    // Filter by farm and date
    const filtered = inspections.filter((ins) => {
      if (selectedFarm !== 'ALL' && ins.farmName !== selectedFarm) return false;
      const date = parseISO(ins.receivingDate);
      return isAfter(date, startDate);
    });

    // Group by Date
    const grouped = filtered.reduce((acc, ins) => {
      const dateStr = ins.receivingDate; // e.g. "2023-10-25"
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, total: 0 };
        parameters.forEach((p) => {
          acc[dateStr][p.name] = 0;
        });
      }
      
      let insTotal = 0;
      Object.entries(ins.counts).forEach(([paramId, count]) => {
        const pName = paramMap.get(paramId)?.name;
        if (pName) {
          acc[dateStr][pName] += count;
          insTotal += count;
        }
      });
      acc[dateStr].total += insTotal;

      return acc;
    }, {} as Record<string, any>);

    // Convert to sorted array
    return Object.values(grouped).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [inspections, selectedFarm, timeRange, parameters, paramMap]);

  // Quick Stats
  const stats = useMemo(() => {
    let totalInspected = 0;
    let defectCount = 0; // Assuming anything not "Good" (case insensitive) is a defect

    chartData.forEach((day) => {
      totalInspected += day.total || 0;
      parameters.forEach((p) => {
        if (p.name.toLowerCase() !== 'good') {
          defectCount += day[p.name] || 0;
        }
      });
    });

    const defectRate = totalInspected > 0 ? (defectCount / totalInspected) * 100 : 0;

    return { totalInspected, defectRate: defectRate.toFixed(1) };
  }, [chartData, parameters]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-10 bg-gray-200 animate-pulse rounded-lg w-1/3"></div>
        <div className="h-64 bg-gray-200 animate-pulse rounded-2xl w-full"></div>
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
          <p className="text-sm text-gray-500">{t('Monitor inspection quality over time.')}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <select
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value)}
              className="appearance-none w-full sm:w-auto pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
            >
              <option value="ALL">{t('All Farms')}</option>
              {farmNames.map((farm) => (
                <option key={farm} value={farm}>
                  {farm}
                </option>
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
                    : 'text-gray-500 hover:text-gray-900'
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Total Inspected')}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.totalInspected.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Defect Rate')}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
            {stats.defectRate}<span className="text-lg font-medium text-gray-500">%</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-gray-800 font-semibold">
          <TrendingUp className="w-5 h-5 text-green-600" />
          {t('Parameter Distribution Over Time')}
        </div>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            {t('No data available for this period.')}
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {parameters.map((p) => (
                    <linearGradient key={p.id} id={`color${p.name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={p.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={p.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(val) => {
                    const date = new Date(val);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                {parameters.map((p) => (
                  <Area
                    key={p.id}
                    type="monotone"
                    dataKey={p.name}
                    stackId="1"
                    stroke={p.color}
                    strokeWidth={2}
                    fill={`url(#color${p.name})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

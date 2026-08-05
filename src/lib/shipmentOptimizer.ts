import type { StockEntry, Inspection, Parameter } from '../types';

export interface StockWithScores {
  stock: StockEntry;
  inspection: Inspection;
  totalHeads: number;
  goodPct: number;
  defectPcts: Record<string, number>;
  daysStored: number;
}

export interface OptimizationParams {
  selectedParams: string[];
  storageTimeDays: number;
  palletsPerShipment: number;
  numShipments: number;
  maxStocksPerShipment: number;
}

export interface ShipmentPlan {
  items: StockWithScores[];
  totalPallets: number;
  paramAverages: Record<string, number>;
}

export interface OptimizationResult {
  shipments: ShipmentPlan[];
  overflow: StockWithScores[];
}

function computeAvg(items: StockWithScores[], paramId: string): number {
  if (items.length === 0) return 0;
  if (paramId === '__quality__') {
    return items.reduce((sum, s) => sum + s.goodPct, 0) / items.length;
  }
  return items.reduce((sum, s) => sum + (s.defectPcts[paramId] || 0), 0) / items.length;
}

function computeBalanceScore(
  shipments: { items: StockWithScores[]; totalPallets: number }[],
  candidate: StockWithScores,
  shipIdx: number,
  selectedParams: string[],
  palletsPerShipment: number,
): number {
  const sim = shipments.map((s) => ({ items: [...s.items], totalPallets: s.totalPallets }));
  sim[shipIdx].items.push(candidate);

  let totalVariance = 0;
  for (const paramId of selectedParams) {
    const averages = sim.map((s) => computeAvg(s.items, paramId));
    const weightedAvg =
      averages.reduce((sum, a, i) => sum + a * sim[i].items.length, 0) /
      Math.max(1, sim.reduce((sum, s) => sum + s.items.length, 0));
    const variance =
      averages.reduce((sum, a) => sum + (a - weightedAvg) ** 2, 0) /
      Math.max(1, averages.length);
    totalVariance += variance;
  }

  const filledRatio = sim[shipIdx].totalPallets / palletsPerShipment;
  return -totalVariance + filledRatio * 0.1;
}

export function optimizeShipments(
  stockEntries: StockEntry[],
  inspections: Inspection[],
  parameters: Parameter[],
  params: OptimizationParams,
): OptimizationResult {
  const inspectionMap = new Map<string, Inspection>();
  for (const i of inspections) {
    if (i.stockId) inspectionMap.set(i.stockId, i);
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const scored: StockWithScores[] = [];
  for (const stock of stockEntries) {
    const inspection = inspectionMap.get(stock.id);
    if (!inspection) continue;

    const totalHeads = Object.values(inspection.counts).reduce((a, b) => a + b, 0);
    const goodCount = inspection.counts[
      parameters.find((p) => p.name.toLowerCase() === 'good')?.id || ''
    ] || 0;
    const goodPct = totalHeads > 0 ? (goodCount / totalHeads) * 100 : 100;

    const defectPcts: Record<string, number> = {};
    parameters
      .filter((p) => p.isDefect && !p.isSpecial)
      .forEach((p) => {
        defectPcts[p.id] = totalHeads > 0 ? ((inspection.counts[p.id] || 0) / totalHeads) * 100 : 0;
      });

    const received = new Date(stock.receivingDate + 'T00:00:00');
    const daysStored = Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));

    scored.push({
      stock,
      inspection,
      totalHeads,
      goodPct,
      defectPcts,
      daysStored,
    });
  }

  const overdue = scored.filter((s) => s.daysStored >= params.storageTimeDays);
  const fresh = scored
    .filter((s) => s.daysStored < params.storageTimeDays)
    .sort((a, b) => a.stock.receivingDate.localeCompare(b.stock.receivingDate));

  const sorted = [...overdue, ...fresh];

  const shipments: { items: StockWithScores[]; totalPallets: number }[] = Array.from(
    { length: params.numShipments },
    () => ({ items: [], totalPallets: 0 }),
  );

  const overflow: StockWithScores[] = [];

  for (const stock of sorted) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < shipments.length; i++) {
      const s = shipments[i];
      if (s.totalPallets + stock.stock.pallets > params.palletsPerShipment) continue;
      if (s.items.length >= params.maxStocksPerShipment) continue;

      const score = computeBalanceScore(
        shipments,
        stock,
        i,
        params.selectedParams,
        params.palletsPerShipment,
      );

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      shipments[bestIdx].items.push(stock);
      shipments[bestIdx].totalPallets += stock.stock.pallets;
    } else {
      overflow.push(stock);
    }
  }

  const plans: ShipmentPlan[] = shipments.map((s) => ({
    items: s.items,
    totalPallets: s.totalPallets,
    paramAverages: computeParamAverages(s.items, params),
  }));

  return { shipments: plans, overflow };
}

function computeParamAverages(
  items: StockWithScores[],
  params: OptimizationParams,
): Record<string, number> {
  const averages: Record<string, number> = {};
  for (const paramId of params.selectedParams) {
    averages[paramId] = computeAvg(items, paramId);
  }
  return averages;
}

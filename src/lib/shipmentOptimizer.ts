import type { StockEntry, Inspection, Parameter } from '../types';

export interface StockWithScores {
  stock: StockEntry;
  inspection: Inspection | null;
  hasInspection: boolean;
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
  const totalPallets = items.reduce((sum, s) => sum + s.stock.pallets, 0);
  if (totalPallets === 0) return 0;
  if (paramId === '__quality__') {
    return items.reduce((sum, s) => sum + s.goodPct * s.stock.pallets, 0) / totalPallets;
  }
  return items.reduce((sum, s) => sum + (s.defectPcts[paramId] || 0) * s.stock.pallets, 0) / totalPallets;
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
  sim[shipIdx].totalPallets += candidate.stock.pallets;

  const nonEmpty = sim.map((s, i) => i === shipIdx || s.items.length > 0);

  let totalVariance = 0;
  for (const paramId of selectedParams) {
    const weightedAvg =
      sim.reduce((sum, s, i) => nonEmpty[i] ? sum + computeAvg(s.items, paramId) * s.items.length : sum, 0) /
      Math.max(1, sim.reduce((sum, s, i) => nonEmpty[i] ? sum + s.items.length : sum, 0));

    let varianceSum = 0;
    let varianceCount = 0;
    for (let i = 0; i < sim.length; i++) {
      if (!nonEmpty[i]) continue;
      const a = computeAvg(sim[i].items, paramId);
      varianceSum += (a - weightedAvg) ** 2;
      varianceCount++;
    }
    totalVariance += varianceCount > 1 ? varianceSum / varianceCount : 0;
  }

  const filledRatio = sim[shipIdx].totalPallets / palletsPerShipment;
  const normalizedVariance = totalVariance / Math.max(1, selectedParams.length);
  return -normalizedVariance + filledRatio * 50;
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

  const goodParam = parameters.find((p) => !p.isDefect);

  const scored: StockWithScores[] = [];
  for (const stock of stockEntries) {
    const inspection = inspectionMap.get(stock.id);

    let totalHeads = 0;
    let goodPct = 100;
    const defectPcts: Record<string, number> = {};

    parameters
      .filter((p) => p.isDefect && !p.isSpecial)
      .forEach((p) => {
        defectPcts[p.id] = 0;
      });

    if (inspection) {
      totalHeads = Object.values(inspection.counts).reduce((a, b) => a + b, 0);
      if (totalHeads > 0) {
        const goodCount = goodParam ? (inspection.counts[goodParam.id] || 0) : 0;
        goodPct = (goodCount / totalHeads) * 100;
        parameters
          .filter((p) => p.isDefect && !p.isSpecial)
          .forEach((p) => {
            defectPcts[p.id] = ((inspection.counts[p.id] || 0) / totalHeads) * 100;
          });
      }
    }

    const received = new Date(stock.receivingDate + 'T00:00:00');
    const daysStored = Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));

    scored.push({
      stock,
      inspection: inspection || null,
      hasInspection: !!inspection,
      totalHeads,
      goodPct,
      defectPcts,
      daysStored,
    });
  }

  const overdue = scored
    .filter((s) => s.daysStored >= params.storageTimeDays)
    .sort((a, b) => b.daysStored - a.daysStored);
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
    let bestPallets = Infinity;

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

      if (score > bestScore || (score === bestScore && shipments[i].totalPallets < bestPallets)) {
        bestScore = score;
        bestIdx = i;
        bestPallets = shipments[i].totalPallets;
      }
    }

    if (bestIdx >= 0) {
      shipments[bestIdx].items.push(stock);
      shipments[bestIdx].totalPallets += stock.stock.pallets;
    } else {
      overflow.push(stock);
    }
  }

  const plans: ShipmentPlan[] = shipments
    .filter((s) => s.items.length > 0)
    .map((s) => ({
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

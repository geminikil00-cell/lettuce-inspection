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

export interface PlacedItem {
  scored: StockWithScores;
  pallets: number;
}

export interface OptimizationParams {
  selectedParams: string[];
  storageTimeDays: number;
  palletsPerShipment: number;
  numShipments: number;
  maxStocksPerShipment: number;
}

export interface ShipmentPlan {
  items: PlacedItem[];
  totalPallets: number;
  paramAverages: Record<string, number>;
}

export interface OptimizationResult {
  shipments: ShipmentPlan[];
  overflow: StockWithScores[];
}

function computeAvg(items: PlacedItem[], paramId: string): number {
  if (items.length === 0) return 0;
  const totalPallets = items.reduce((sum, item) => sum + item.pallets, 0);
  if (totalPallets === 0) return 0;
  if (paramId === '__quality__') {
    return items.reduce((sum, item) => sum + item.scored.goodPct * item.pallets, 0) / totalPallets;
  }
  return items.reduce((sum, item) => sum + (item.scored.defectPcts[paramId] || 0) * item.pallets, 0) / totalPallets;
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
      .filter((p) => p.isDefect)
      .forEach((p) => {
        defectPcts[p.id] = 0;
      });

    if (inspection) {
      totalHeads = Object.values(inspection.counts).reduce((a, b) => a + b, 0);
      if (totalHeads > 0) {
        const goodCount = goodParam ? (inspection.counts[goodParam.id] || 0) : 0;
        goodPct = (goodCount / totalHeads) * 100;
        parameters
          .filter((p) => p.isDefect)
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

  const shipments: { items: PlacedItem[]; totalPallets: number; stockIds: Set<string> }[] = Array.from(
    { length: params.numShipments },
    () => ({ items: [], totalPallets: 0, stockIds: new Set() }),
  );

  const overflow: StockWithScores[] = [];

  for (const stock of sorted) {
    let remaining = stock.stock.pallets;

    while (remaining > 0) {
      let bestIdx = -1;
      let bestPallets = Infinity;
      let bestHasStock = false;

      for (let i = 0; i < shipments.length; i++) {
        const s = shipments[i];
        const spaceLeft = params.palletsPerShipment - s.totalPallets;
        if (spaceLeft <= 0) continue;

        const stockAlreadyThere = s.stockIds.has(stock.stock.id);
        if (!stockAlreadyThere && s.stockIds.size >= params.maxStocksPerShipment) continue;

        if (s.totalPallets < bestPallets) {
          bestPallets = s.totalPallets;
          bestIdx = i;
          bestHasStock = stockAlreadyThere;
        } else if (s.totalPallets === bestPallets) {
          if (stockAlreadyThere && !bestHasStock) {
            bestPallets = s.totalPallets;
            bestIdx = i;
            bestHasStock = true;
          }
        }
      }

      if (bestIdx < 0) break;

      const spaceLeft = params.palletsPerShipment - shipments[bestIdx].totalPallets;
      const toPlace = Math.min(remaining, spaceLeft);

      shipments[bestIdx].items.push({ scored: stock, pallets: toPlace });
      shipments[bestIdx].totalPallets += toPlace;
      shipments[bestIdx].stockIds.add(stock.stock.id);
      remaining -= toPlace;
    }

    if (remaining > 0) {
      overflow.push({ ...stock, stock: { ...stock.stock, pallets: remaining } });
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
  items: PlacedItem[],
  params: OptimizationParams,
): Record<string, number> {
  const averages: Record<string, number> = {};
  for (const paramId of params.selectedParams) {
    averages[paramId] = computeAvg(items, paramId);
  }
  return averages;
}

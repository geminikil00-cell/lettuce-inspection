export interface Parameter {
  id: string;
  name: string;
  color: string;
  isDefect: boolean;
  isSpecial: boolean;
}

export interface Inspection {
  id: string;
  farmName: string;
  plotName?: string;
  inspectorName: string;
  receivingDate: string;
  stockId?: string;
  submittedAt?: string;
  createdAt: string;
  counts: Record<string, number>;
}

export type ProduceType = 'lettuce' | 'tomato' | 'onion';

export const PRODUCE_TYPES: ProduceType[] = ['lettuce', 'tomato', 'onion'];

export const PRODUCE_LABELS: Record<ProduceType, string> = {
  lettuce: 'Lettuce',
  tomato: 'Tomato',
  onion: 'Onion',
};

export interface StockEntry {
  id: string;
  farmName: string;
  plotName: string;
  receivingDate: string;
  pallets: number;
  produceType: ProduceType;
  createdAt: string;
}

export interface Shipment {
  id: string;
  name: string;
  dispatchedAt: string;
  createdAt: string;
  items: ShipmentItem[];
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  stockId?: string;
  farmName: string;
  plotName: string;
  receivingDate: string;
  pallets: number;
  produceType: ProduceType;
  createdAt: string;
}

export interface Parameter {
  id: string;
  name: string;
  color: string;
  isDefect: boolean;
}

export interface Inspection {
  id: string;
  farmName: string;
  plotName?: string;
  inspectorName: string;
  receivingDate: string;
  receivingTime: string;
  stockId?: string;
  submittedAt?: string;
  createdAt: string;
  counts: Record<string, number>;
}

export interface StockEntry {
  id: string;
  farmName: string;
  plotName: string;
  receivingDate: string;
  pallets: number;
  createdAt: string;
}

export interface Shipment {
  id: string;
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
  createdAt: string;
}

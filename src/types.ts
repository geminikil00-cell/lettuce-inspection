export interface Parameter {
  id: string;
  name: string;
  color: string;
}

export interface Inspection {
  id: string;
  farmName: string;
  plotName?: string;
  inspectorName: string;
  receivingDate: string;
  receivingTime: string;
  submittedAt?: string;
  createdAt: string;
  counts: Record<string, number>;
}

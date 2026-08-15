import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Parameter } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function countHeads(counts: Record<string, number>, parameters: Parameter[]): number {
  const specialIds = new Set(parameters.filter((p) => p.isSpecial).map((p) => p.id));
  return Object.entries(counts).reduce((sum, [pid, count]) => (specialIds.has(pid) ? sum : sum + count), 0);
}

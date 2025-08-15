// types/itinerary.ts
export type Mode = "flight" | "train" | "bus" | "ferry" | "rideshare" | "car";

export interface Leg {
  mode: Mode;
  operator: string;
  from: { code: string; name?: string; city?: string };
  to: { code: string; name?: string; city?: string };
  depart: string; // ISO 8601
  arrive: string; // ISO 8601
  number?: string; // vuelo/tren/bus
}

export interface NormalizedItinerary {
  id: string;
  mode: Mode; // modo principal
  operators: string[];
  price: { amount: number; currency: string; refundable?: boolean };
  legs: Leg[];
  transfers: number;       // legs.length - 1
  durationMinutes: number; // total
  reliability?: number;    // 0..1
  co2kg?: number;
  bookUrl?: string;
  rawRef?: string;         // token para re-pricing
}

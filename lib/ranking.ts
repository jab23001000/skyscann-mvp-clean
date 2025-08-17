// lib/ranking.ts
import type { TravelPolicy } from "@/lib/policy";

export interface Offer {
  id: string;
  price_total: number;
  currency: string;
  stops: number;
  duration_total_minutes: number;
}

type Ranked = Offer & { __score: number };

export function rankItineraries(
  offers: Offer[],
  policy: TravelPolicy
): Ranked[] {
  const w = policy.objectives.weights;
  if (!offers?.length) return [];

  const prices = offers.map(o => o.price_total);
  const durs = offers.map(o => o.duration_total_minutes);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minD = Math.min(...durs),    maxD = Math.max(...durs);
  const spanP = Math.max(1, maxP - minP);
  const spanD = Math.max(1, maxD - minD);

  const norm = {
    price: (p: number) => (p - minP) / spanP,
    duration: (d: number) => (d - minD) / spanD,
    stops: (s: number) => Math.min(s, policy.defaults.max_transfers_total ?? 2) / (policy.defaults.max_transfers_total ?? 2),
    risk: (s: number) => (s <= 0 ? 0 : s === 1 ? 0.5 : 1),
  };

  const scored: Ranked[] = offers.map(o => {
    const sPrice = norm.price(o.price_total);
    const sDur   = norm.duration(o.duration_total_minutes);
    const sStops = norm.stops(o.stops);
    const sRisk  = norm.risk(o.stops);
    const score  = w.price*sPrice + w.duration*sDur + w.transfers*sStops + w.connection_risk*sRisk;
    return { ...o, __score: score };
  });

  scored.sort((a, b) => {
    if (a.__score !== b.__score) return a.__score - b.__score;
    // desempates: duración, stops, precio, id
    if (a.duration_total_minutes !== b.duration_total_minutes) return a.duration_total_minutes - b.duration_total_minutes;
    if (a.stops !== b.stops) return a.stops - b.stops;
    if (a.price_total !== b.price_total) return a.price_total - b.price_total;
    return a.id.localeCompare(b.id);
  });

  return scored;
}

export function reasonShort(policy: TravelPolicy) {
  const w = policy.objectives.weights;
  const main = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "price";
  if (main === "price") return "Ordenado por precio, ponderando duración y conexiones.";
  if (main === "duration") return "Priorizamos duración total y conexiones seguras.";
  if (main === "transfers") return "Minimizamos transbordos equilibrando precio y duración.";
  return "Equilibrio entre precio, duración y transbordos.";
}

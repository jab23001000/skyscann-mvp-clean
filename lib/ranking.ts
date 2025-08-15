// lib/ranking.ts
import type { NormalizedItinerary, Leg } from "@/types/itinerary";
import type { Policy } from "@/lib/policy";

function minutesBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

function layovers(legs: Leg[]) {
  const out: number[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    out.push(minutesBetween(legs[i].arrive, legs[i + 1].depart));
  }
  return out;
}

function minConnForPair(a: Leg, b: Leg, policy: Policy) {
  const A = a.mode, B = b.mode;
  if (A === "flight" && B === "flight") return policy.defaults.min_connection_minutes.airport_airport;
  // cross-mode → asumimos aeropuerto-estación misma ciudad (caso conservador)
  if ((A === "flight" && B !== "flight") || (A !== "flight" && B === "flight")) {
    return policy.defaults.min_connection_minutes.airport_station_same_city;
  }
  // resto (train/bus/ferry…)
  return policy.defaults.min_connection_minutes.station_station;
}

/** 0..1: 0 bajo riesgo, 1 alto */
export function computeConnectionRisk(it: NormalizedItinerary, policy: Policy) {
  let risk = 0.3; // base
  const ls = it.legs || [];
  const conns = layovers(ls);

  for (let i = 0; i < conns.length; i++) {
    const need = minConnForPair(ls[i], ls[i + 1], policy);
    const got = conns[i];

    if (got < need) risk += 0.4;         // conexión peligrosa
    else if (got < need + 15) risk += 0.2; // justa
    else risk -= 0.05;                    // holgada
  }

  // demasiados transbordos
  if (it.transfers > policy.defaults.max_transfers_total) risk += 0.4;

  // salidas muy tarde si no permitimos overnight
  const lastDepHour = new Date(ls[0]?.depart || Date.now()).getHours();
  const [hh, mm] = policy.constraints.last_departure_local_time.split(":").map(Number);
  const lastAllowed = (hh ?? 22) + (mm ?? 0) / 60;
  if (!policy.defaults.allow_overnight && lastDepHour > lastAllowed) risk += 0.15;

  return Math.min(1, Math.max(0, risk));
}

export function scoreItinerary(it: NormalizedItinerary, mins: { price: number; duration: number }, policy: Policy) {
  const w = policy.objectives.weights;
  const priceRatio = it.price.amount / Math.max(mins.price, 1);
  const durationRatio = it.durationMinutes / Math.max(mins.duration, 1);
  const transfers = it.transfers; // 0,1,2…
  const risk = computeConnectionRisk(it, policy);

  // Sesgo por preferencia de modos (más temprano en prefer_modes → mejor)
  const pref = policy.defaults.prefer_modes.map(m => m.toLowerCase());
  const idx = Math.max(0, pref.indexOf(it.mode.toLowerCase()));
  const modeBias = (idx >= 0 ? idx : pref.length) * 0.02; // 0%, 2%, 4%…

  // Menor score = mejor
  return (
    w.price * priceRatio +
    w.duration * durationRatio +
    w.transfers * (1 + transfers) +
    w.connection_risk * (0.5 + risk) +
    modeBias
  );
}

export function rankItineraries(options: NormalizedItinerary[], policy: Policy) {
  if (!options?.length) return [];
  const mins = {
    price: Math.min(...options.map(o => o.price.amount)),
    duration: Math.min(...options.map(o => o.durationMinutes)),
  };
  return options
    .map(o => ({ id: o.id, score: scoreItinerary(o, mins, policy) }))
    .sort((a, b) => a.score - b.score);
}

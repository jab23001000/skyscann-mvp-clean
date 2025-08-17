// lib/normalize.ts
// Normalizador robusto Amadeus -> Offer del proyecto
// - Fechas SIEMPRE como string ("" si faltan) -> la UI puede hacer .slice(0,10) sin romper.
// - segments siempre string[].
// - Números seguros y defaults consistentes.

// === Tipo autosuficiente (no dependemos de types/itinerary.ts) ===
export type Offer = {
  id: string;
  price_total: number;
  currency: string;
  carriers: string[];
  stops: number;
  duration_total_minutes: number;
  outbound: {
    departure: string;             // ISO string o ""
    arrival: string;               // ISO string o ""
    duration_minutes: number;
    segments: string[];            // p.ej. ["IBE1234 MAD-BCN", ...]
  };
  inbound: {
    departure: string;
    arrival: string;
    duration_minutes: number;
    segments: string[];
  } | null;
};

// Helpers seguros
const asStr = (v: any): string => (typeof v === "string" ? v : "");
const asNum = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isoOrEmpty = (v: any): string =>
  typeof v === "string" && v.length >= 10 ? v : "";

// ISO8601 "PTxHxM" → minutos
export function isoDurationToMinutes(iso?: string): number {
  if (!iso || typeof iso !== "string") return 0;
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  const hours = h ? parseInt(h[1], 10) : 0;
  const mins = m ? parseInt(m[1], 10) : 0;
  return hours * 60 + mins;
}

type AmadeusOffer = {
  id: string;
  price?: { grandTotal?: string; currency?: string };
  itineraries?: Array<{
    duration?: string;
    segments?: Array<{
      carrierCode?: string;
      number?: string;
      departure?: { iataCode?: string; at?: string };
      arrival?: { iataCode?: string; at?: string };
      duration?: string;
    }>;
  }>;
};

const makeId = () => {
  try {
    // Web Crypto en Node 18+ / Next 15
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2);
};

export function normalizeAmadeus(data: any): Offer[] {
  const items: AmadeusOffer[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];

  const res: Offer[] = items.map((o) => {
    const its = Array.isArray(o.itineraries) ? o.itineraries : [];

    // OUTBOUND
    const it0 = its[0] || {};
    const seg0 = Array.isArray(it0.segments) ? it0.segments : [];
    const outDep = isoOrEmpty(seg0[0]?.departure?.at);
    const outArr = isoOrEmpty(seg0[seg0.length - 1]?.arrival?.at);
    const outDur = isoDurationToMinutes(it0.duration);
    const outSegs: string[] = seg0.map((s) => {
      const c = asStr(s?.carrierCode);
      const n = asStr(s?.number);
      const from = asStr(s?.departure?.iataCode);
      const to = asStr(s?.arrival?.iataCode);
      return [c && n ? `${c}${n}` : "", from && to ? `${from}-${to}` : ""]
        .filter(Boolean)
        .join(" ");
    });

    // INBOUND (opcional)
    const it1 = its[1] || null;
    const seg1 = it1 && Array.isArray(it1.segments) ? it1.segments : [];
    const inDep = it1 ? isoOrEmpty(seg1[0]?.departure?.at) : "";
    const inArr = it1 ? isoOrEmpty(seg1[seg1.length - 1]?.arrival?.at) : "";
    const inDur = it1 ? isoDurationToMinutes(it1.duration) : 0;
    const inSegs: string[] = it1
      ? seg1.map((s) => {
          const c = asStr(s?.carrierCode);
          const n = asStr(s?.number);
          const from = asStr(s?.departure?.iataCode);
          const to = asStr(s?.arrival?.iataCode);
          return [c && n ? `${c}${n}` : "", from && to ? `${from}-${to}` : ""]
            .filter(Boolean)
            .join(" ");
        })
      : [];

    // Carriers y stops totales
    const allSegs = [...seg0, ...seg1];
    const carriers = Array.from(
      new Set(allSegs.map((s) => asStr(s?.carrierCode)).filter(Boolean))
    );
    const stopsOut = Math.max(0, seg0.length - 1);
    const stopsIn = it1 ? Math.max(0, seg1.length - 1) : 0;
    const totalStops = stopsOut + stopsIn;

    // Duración total
    const duration_total_minutes = outDur + inDur;

    // Precio/moneda
    const price_total = asNum(o?.price?.grandTotal);
    const currency = asStr(o?.price?.currency) || "EUR";

    const offer: Offer = {
      id: asStr(o?.id) || makeId(),
      price_total,
      currency,
      carriers,
      stops: totalStops,
      duration_total_minutes,
      outbound: {
        departure: outDep, // "" si falta
        arrival: outArr,   // ""
        duration_minutes: outDur,
        segments: outSegs, // [] si falta
      },
      inbound: it1
        ? {
            departure: inDep,
            arrival: inArr,
            duration_minutes: inDur,
            segments: inSegs,
          }
        : null,
    };

    return offer;
  });

  return res;
}

// app/api/search/route.ts
import { NextResponse } from "next/server";

/**
 * Configuración de ruta (desactiva caché en Vercel/Next)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Tipos
 */
type AirportRef = {
  iata: string;
  name: string;
  city?: string;
  lat?: number;
  lon?: number;
  distance_km?: number;
};
type ResolvedPlace = {
  label: string;
  lat: number;
  lon: number;
  airports: AirportRef[];
};

type Offer = {
  id: string;
  price_total: number; // en currency
  currency: string;
  carriers: string[];
  stops: number; // 0 directos, 1 una escala, etc.
  duration_total_minutes: number;
  outbound: {
    departure: string; // ISO
    arrival: string;   // ISO
    duration_minutes: number;
    segments: string[];
  };
  inbound: {
    departure: string;
    arrival: string;
    duration_minutes: number;
    segments: string[];
  } | null;
  // opcional, si tu proveedor lo da
  connection_risk?: number; // 0..1 (1 = más riesgo)
};

type SearchBody = {
  origin: ResolvedPlace;
  destination: ResolvedPlace;
  date: string; // YYYY-MM-DD
  adults?: number;
  // opcional: limitar combinaciones para controlar coste/latencia
  maxOriginAirports?: number; // default 2
  maxDestinationAirports?: number; // default 2
};

/**
 * Utilidades
 */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Estimación simple de minutos en coche (fallback barato, sin API).
 * Media ~80 km/h, suficiente para MVP y cumplir <100€/mes.
 */
function drivingMinutesEstimate(
  orig: [number, number],
  dest: [number, number]
) {
  const km = haversine(orig[0], orig[1], dest[0], dest[1]);
  return Math.max(10, Math.round((km / 80) * 60));
}

/**
 * (Opcional) Llamada a OpenRouteService si defines ORS_API_KEY en Vercel.
 * Si falla o no hay clave, cae a la estimación local.
 */
async function drivingMinutes(
  orig: [number, number],
  dest: [number, number]
): Promise<number> {
  const key = process.env.ORS_API_KEY;
  if (!key) return drivingMinutesEstimate(orig, dest);

  try {
    const r = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: key,
        },
        body: JSON.stringify({
          coordinates: [
            [orig[1], orig[0]],
            [dest[1], dest[0]],
          ],
        }),
        cache: "no-store",
      }
    );
    if (!r.ok) throw new Error(await r.text());
    const json = await r.json();
    const secs =
      json?.features?.[0]?.properties?.summary?.duration ??
      json?.features?.[0]?.properties?.segments?.[0]?.duration;
    if (typeof secs === "number" && secs > 0) {
      return Math.round(secs / 60);
    }
    return drivingMinutesEstimate(orig, dest);
  } catch {
    return drivingMinutesEstimate(orig, dest);
  }
}

/**
 * Ranking según tu política (España, doméstico):
 * price 0.40, duration 0.35, transfers 0.15, connection_risk 0.10
 * Nota: normalizamos cada métrica en [0..1] para combinar.
 */
function rankOffers(offers: Offer[]): Offer[] {
  if (offers.length === 0) return offers;

  // extraer rangos
  const prices = offers.map((o) => o.price_total);
  const durs = offers.map((o) => o.duration_total_minutes);
  const stops = offers.map((o) => o.stops);
  const risks = offers.map((o) =>
    typeof o.connection_risk === "number" ? o.connection_risk! : 0.5
  );

  const min = (arr: number[]) => Math.min(...arr);
  const max = (arr: number[]) => Math.max(...arr);
  const minP = min(prices),
    maxP = max(prices);
  const minD = min(durs),
    maxD = max(durs);
  const minS = min(stops),
    maxS = max(stops);
  const minR = min(risks),
    maxR = max(risks);

  const safeNorm = (v: number, a: number, b: number) =>
    b - a === 0 ? 0.5 : (v - a) / (b - a);

  const W = {
    price: 0.40,
    duration: 0.35,
    transfers: 0.15,
    risk: 0.10,
  };

  // menor es mejor en precio, duración, escalas y riesgo
  const scored = offers.map((o) => {
    const p = safeNorm(o.price_total, minP, maxP);
    const d = safeNorm(o.duration_total_minutes, minD, maxD);
    const s = safeNorm(o.stops, minS, maxS);
    const r = safeNorm(
      typeof o.connection_risk === "number" ? o.connection_risk : 0.5,
      minR,
      maxR
    );

    const score =
      W.price * (1 - p) +
      W.duration * (1 - d) +
      W.transfers * (1 - s) +
      W.risk * (1 - r);

    return { o, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.o);
}

/**
 * Busca vuelos combinando IATAs de origen y destino (top-N).
 * Sustituye la implementación del "adapter" por tu integración real (Amadeus/Kiwi).
 */
async function searchFlightsFromAirports(params: {
  originIatas: string[];
  destinationIatas: string[];
  date: string;
  adults: number;
}): Promise<Offer[]> {
  const { originIatas, destinationIatas, date, adults } = params;

  // EJEMPLO de orquestación: paraleliza por pares O/D
  const pairs: Array<[string, string]> = [];
  for (const o of originIatas) {
    for (const d of destinationIatas) {
      pairs.push([o, d]);
    }
  }

  // TODO: Reemplaza este bloque por tus llamadas reales a Amadeus/Kiwi/Tequila
  // Aquí retornamos un array vacío para que compile y puedas conectar tu proveedor.
  // Si ya tienes una función existente en tu proyecto, impórtala y úsala aquí.
  // e.g. const offers = await amadeusSearchMulti(pairs, date, adults);
  const results: Offer[] = [];
  // --------------------------------------------------------------------------

  return results;
}

/**
 * Handler principal
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchBody;

    // Validaciones básicas
    if (!body?.origin || !body?.destination || !body?.date) {
      return NextResponse.json(
        { error: "Faltan parámetros: origin, destination o date" },
        { status: 400 }
      );
    }

    const adults = body.adults && body.adults > 0 ? body.adults : 1;

    // Baseline coche (ciudad → ciudad)
    const driveMin = await drivingMinutes(
      [body.origin.lat, body.origin.lon],
      [body.destination.lat, body.destination.lon]
    );
    const maxMinutes = 3 * driveMin;

    // Limitar nº de aeropuertos por lado (MVP: 2 por defecto)
    const maxO = Math.max(1, body.maxOriginAirports ?? 2);
    const maxD = Math.max(1, body.maxDestinationAirports ?? 2);
    const originIatas = body.origin.airports.slice(0, maxO).map((a) => a.iata);
    const destinationIatas = body.destination.airports
      .slice(0, maxD)
      .map((a) => a.iata);

    // Buscar ofertas
    const offers = await searchFlightsFromAirports({
      originIatas,
      destinationIatas,
      date: body.date,
      adults,
    });

    // Filtrar por 3× tiempo en coche
    const filtered = offers.filter(
      (of) => of.duration_total_minutes <= maxMinutes
    );

    // Rankear según política (si quieres, puedes saltarte esto y usar tu /api/plan)
    const ranked = rankOffers(filtered);

    // Headers para evitar caché
    const headers = new Headers({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    return NextResponse.json(
      {
        origin: body.origin.label,
        destination: body.destination.label,
        drive_minutes: driveMin,
        max_allowed_minutes: maxMinutes,
        origin_airports_used: originIatas,
        destination_airports_used: destinationIatas,
        options: ranked,
      },
      { status: 200, headers }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}


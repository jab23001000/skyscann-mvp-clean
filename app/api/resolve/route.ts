import { NextResponse } from "next/server";
import ccaaCapital from "@/app/data/ccaa_capital.json";
import airports from "@/app/data/es_airports.json";
import cities from "@/app/data/es_cities_min.json";

type City = { name: string; alt_names?: string[]; lat: number; lon: number };
type Airport = { iata: string; name: string; city: string; lat: number; lon: number };

function norm(s: string) {
  return s.trim().toLowerCase();
}

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

function findCityOrCCAA(query: string): City {
  let n = norm(query);

  // Si es CCAA, usar capital
  if (ccaaCapital[n as keyof typeof ccaaCapital]) {
    n = norm(ccaaCapital[n as keyof typeof ccaaCapital]);
  }

  // Buscar match exacto
  const exact = cities.find(
    c => norm(c.name) === n || c.alt_names?.some(a => norm(a) === n)
  );
  if (exact) return exact;

  // Fallback: prefix match
  const prefix = cities.find(c => norm(c.name).startsWith(n));
  if (prefix) return prefix;

  throw new Error(`No se encontró ciudad o CCAA: ${query}`);
}

function nearestAirports(lat: number, lon: number, topN = 2) {
  const scored = (airports as Airport[]).map(ap => ({
    ...ap,
    distance_km: haversine(lat, lon, ap.lat, ap.lon)
  }));
  scored.sort((a, b) => a.distance_km - b.distance_km);
  return scored.slice(0, topN);
}

export async function POST(req: Request) {
  try {
    const { query, top_n = 2 } = await req.json();
    const city = findCityOrCCAA(query);
    const aps = nearestAirports(city.lat, city.lon, top_n);
    return NextResponse.json({
      label: city.name,
      lat: city.lat,
      lon: city.lon,
      airports: aps
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

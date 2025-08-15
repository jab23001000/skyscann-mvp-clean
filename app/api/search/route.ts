import { NextResponse } from "next/server";
import type { ResolvedPlace } from "@/app/types";

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

// Estimación de tiempo en coche en minutos
function drivingMinutesEstimate(orig: [number, number], dest: [number, number]) {
  const km = haversine(orig[0], orig[1], dest[0], dest[1]);
  return Math.round((km / 80) * 60); // 80 km/h de media
}

export async function POST(req: Request) {
  try {
    const { origin, destination, date, adults = 1 } = await req.json();

    // baseline coche
    const driveMin = drivingMinutesEstimate(
      [origin.lat, origin.lon],
      [destination.lat, destination.lon]
    );
    const maxMinutes = 3 * driveMin;

    // Obtener vuelos de tu función actual
    const offers = await searchFlightsFromAirports(
      origin.airports.map((a: any) => a.iata),
      destination.airports.map((a: any) => a.iata),
      date,
      adults
    );

    // Filtro 3×
    const filtered = offers.filter(
      (of: any) => of.duration_total_minutes <= maxMinutes
    );

    return NextResponse.json({
      origin: origin.label,
      destination: destination.label,
      drive_minutes: driveMin,
      max_allowed_minutes: maxMinutes,
      options: filtered
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// Dummy: deberías conectar aquí con Amadeus/Kiwi
async function searchFlightsFromAirports(
  originIatas: string[],
  destinationIatas: string[],
  date: string,
  adults: number
) {
  // Combinar llamadas a tu API de vuelos
  return [];
}

export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { amadeusSearchOffers } from "@/lib/amadeus";
import { normalizeOffers } from "@/lib/normalize";

type TripType = "oneway" | "roundtrip";

type Body = {
  origin?: string;                       // ← editable desde la UI
  destination: string;
  trip_type?: TripType;                  // ← oneway | roundtrip (default: roundtrip)
  departure_date?: string; return_date?: string;
  departure_range?: { start: string; end: string };
  return_range?: { start: string; end: string };
  adults?: number; nonstop?: boolean; max_results?: number; travel_class?: string;
};

function daysBetween(start: string, end: string, limit = 5) {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let cur = new Date(d); cur <= e && out.length < limit; cur.setDate(cur.getDate() + 1)) {
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const origin = (body.origin || process.env.NEXT_PUBLIC_DEFAULT_ORIGIN || "MAD").toUpperCase();
  const destination = (body.destination || "").toUpperCase();
  const tripType: TripType = (body.trip_type === "oneway" || body.trip_type === "roundtrip") ? body.trip_type : "roundtrip";

  if (!destination) return NextResponse.json({ error: "destination requerido" }, { status: 400 });
  if (!origin) return NextResponse.json({ error: "origin requerido" }, { status: 400 });

  // Cache key incluye origin y trip_type
  const keyPayload = { origin, destination, tripType, body, version: 2 };
  const cacheKey = "search:" + crypto.createHash("sha256").update(JSON.stringify(keyPayload)).digest("hex");
  const cached = await redis.get<any[]>(cacheKey);
  if (cached) return NextResponse.json({ origin, destination, options: cached, cached: true });

  const results: any[] = [];
  const concurrency = 6;

  if (tripType === "oneway") {
    // Solo salida
    let deps: string[] = [];
    if (body.departure_date) {
      deps = [body.departure_date];
    } else if (body.departure_range) {
      deps = daysBetween(body.departure_range.start, body.departure_range.end, 25); // máx 25 fechas
    } else {
      return NextResponse.json({ error: "fecha de salida (exacta o rango) requerida para oneway" }, { status: 400 });
    }

    for (let i = 0; i < deps.length; i += concurrency) {
      const chunk = deps.slice(i, i + concurrency);
      const batch = await Promise.allSettled(
        chunk.map(dep =>
          amadeusSearchOffers({
            origin, destination, departureDate: dep,
            adults: body.adults ?? 1,
            currencyCode: process.env.NEXT_PUBLIC_CURRENCY ?? "EUR",
            nonStop: body.nonstop,
            travelClass: body.travel_class,
            max: body.max_results ?? 50,
          })
        )
      );
      for (const b of batch) if (b.status === "fulfilled") results.push(...b.value);
    }
  } else {
    // Ida y vuelta (máx 25 combinaciones)
    let pairs: Array<{ dep: string; ret: string }> = [];
    if (body.departure_date && body.return_date) {
      pairs = [{ dep: body.departure_date, ret: body.return_date }];
    } else if (body.departure_range && body.return_range) {
      const depDays = daysBetween(body.departure_range.start, body.departure_range.end, 5);
      const retDays = daysBetween(body.return_range.start, body.return_range.end, 5);
      for (const d of depDays) for (const r of retDays) pairs.push({ dep: d, ret: r });
      pairs = pairs.slice(0, 25);
    } else {
      return NextResponse.json({ error: "fechas exactas o rangos requeridos para roundtrip" }, { status: 400 });
    }

    for (let i = 0; i < pairs.length; i += concurrency) {
      const chunk = pairs.slice(i, i + concurrency);
      const batch = await Promise.allSettled(
        chunk.map(p =>
          amadeusSearchOffers({
            origin, destination, departureDate: p.dep, returnDate: p.ret,
            adults: body.adults ?? 1,
            currencyCode: process.env.NEXT_PUBLIC_CURRENCY ?? "EUR",
            nonStop: body.nonstop,
            travelClass: body.travel_class,
            max: body.max_results ?? 50,
          })
        )
      );
      for (const b of batch) if (b.status === "fulfilled") results.push(...b.value);
    }
  }

  const options = normalizeOffers(results);
  await redis.set(cacheKey, options, { ex: 60 * 60 * 12 });
  return NextResponse.json({ origin, destination, options, cached: false });
}


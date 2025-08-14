export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { amadeusSearchRoundtrip } from "@/lib/amadeus";
import { normalizeOffers } from "@/lib/normalize";

type Body = {
  destination: string;
  departure_date?: string; return_date?: string;
  departure_range?: { start: string; end: string };
  return_range?: { start: string; end: string };
  adults?: number; nonstop?: boolean; max_results?: number; travel_class?: string;
};

function daysBetween(start: string, end: string, limit = 5) {
  const out: string[] = [];
  let d = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (d <= e && out.length < limit) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const origin = process.env.NEXT_PUBLIC_DEFAULT_ORIGIN || "MAD";
  const destination = (body.destination || "").toUpperCase();

  if (!destination) return NextResponse.json({ error: "destination requerido" }, { status: 400 });

  const keyPayload = { origin, destination, body, version: 1 };
  const cacheKey = "search:" + crypto.createHash("sha256").update(JSON.stringify(keyPayload)).digest("hex");
  const cached = await redis.get<any[]>(cacheKey);
  if (cached) return NextResponse.json({ origin, destination, options: cached, cached: true });

  let pairs: Array<{ dep: string; ret: string }> = [];
  if (body.departure_date && body.return_date) {
    pairs = [{ dep: body.departure_date, ret: body.return_date }];
  } else if (body.departure_range && body.return_range) {
    const depDays = daysBetween(body.departure_range.start, body.departure_range.end, 5);
    const retDays = daysBetween(body.return_range.start, body.return_range.end, 5);
    for (const d of depDays) for (const r of retDays) pairs.push({ dep: d, ret: r });
    pairs = pairs.slice(0, 25);
  } else {
    return NextResponse.json({ error: "fechas exactas o rangos requeridos" }, { status: 400 });
  }

  const results: any[] = [];
  const concurrency = 6;
  for (let i = 0; i < pairs.length; i += concurrency) {
    const chunk = pairs.slice(i, i + concurrency);
    const batch = await Promise.allSettled(
      chunk.map(p => amadeusSearchRoundtrip({
        origin, destination, departureDate: p.dep, returnDate: p.ret,
        adults: body.adults ?? 1,
        currencyCode: process.env.NEXT_PUBLIC_CURRENCY ?? "EUR",
        nonStop: body.nonstop,
        travelClass: body.travel_class,
        max: body.max_results ?? 50,
      }))
    );
    for (const b of batch) if (b.status === "fulfilled") results.push(...b.value);
  }

  const options = normalizeOffers(results);
  await redis.set(cacheKey, options, { ex: 60 * 60 * 12 });
  return NextResponse.json({ origin, destination, options, cached: false });
}

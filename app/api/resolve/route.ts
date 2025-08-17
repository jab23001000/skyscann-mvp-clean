// app/api/resolve/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet, stableHash } from "@/lib/redis";
import { getAmadeusToken } from "@/lib/amadeus";

const CCAA_TO_CAPITAL: Record<string, string> = {
  "andalucía": "Sevilla",
  "aragón": "Zaragoza",
  "asturias": "Oviedo",
  "illes balears": "Palma",
  "baleares": "Palma",
  "islas baleares": "Palma",
  "canarias": "Las Palmas de Gran Canaria",
  "cantabria": "Santander",
  "castilla-la mancha": "Toledo",
  "castilla y león": "Valladolid",
  "catalunya": "Barcelona",
  "cataluña": "Barcelona",
  "comunitat valenciana": "València",
  "comunidad valenciana": "Valencia",
  "extremadura": "Mérida",
  "galicia": "Santiago de Compostela",
  "la rioja": "Logroño",
  "madrid": "Madrid",
  "murcia": "Murcia",
  "navarra": "Pamplona",
  "euskadi": "Vitoria-Gasteiz",
  "país vasco": "Vitoria-Gasteiz",
  "ceuta": "Ceuta",
  "melilla": "Melilla"
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

async function amadeusLocations(keyword: string) {
  const token = await getAmadeusToken();
  const url = `${process.env.AMAD_BASE || "https://test.api.amadeus.com"}/v1/reference-data/locations?subType=CITY,AIRPORT&keyword=${encodeURIComponent(keyword)}&page[limit]=20`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Amadeus locations ${r.status}: ${txt}`);
  }
  const json = await r.json();
  return json?.data ?? [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400 });

    const key = `resolve:${await stableHash({ q })}`;
    const cached = await redisGet(key);
    if (cached) return NextResponse.json({ ok: true, cached: true, ...cached });

    // 1) ¿Es una CCAA? -> capital
    const qNorm = normalize(q);
    const ccaaCapital = CCAA_TO_CAPITAL[qNorm];
    const keyword = ccaaCapital || q;

    // 2) Buscar en Amadeus (CITY/AIRPORT), filtrar a España
    const data = await amadeusLocations(keyword);
    const es = data.filter((x: any) => x?.address?.countryCode === "ES");

    // 3) Extraer ciudad principal y aeropuertos
    const cities = es.filter((x: any) => x.type === "location" && x.subType === "CITY");
    const airports = es.filter((x: any) => x.type === "location" && x.subType === "AIRPORT");

    // Heurística: ciudad exacta por nombre o por match del keyword
    const city = cities.find((c: any) =>
      normalize(c.name) === normalize(keyword)
      || normalize(c.iataCode) === normalize(keyword)
      || (ccaaCapital && normalize(c.name) === normalize(ccaaCapital))
    ) || cities[0] || null;

    // Aeropuertos en la ciudad si hay city; si no, todos los filtrados
    const cityIATA = city?.iataCode;
    const cityAirports = cityIATA
      ? airports.filter((a: any) => a?.iataCode && normalize(a?.iataCode) !== "null" && (
          normalize(a?.address?.cityName || "") === normalize(city?.name || "")
          || normalize(a?.relevance || "") // algunos payloads traen hints de proximidad
        ))
      : airports;

    const result = {
      query: q,
      resolvedCity: city ? { name: city.name, iata: city.iataCode } : null,
      airports: cityAirports.map((a: any) => ({
        name: a.name,
        iata: a.iataCode
      })),
      note: ccaaCapital ? `Resuelto CCAA → capital: ${ccaaCapital}` : undefined
    };

    await redisSet(key, result, 60 * 60 * 12); // 12h
    return NextResponse.json({ ok: true, cached: false, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "resolve_error" }, { status: 500 });
  }
}


"use client";

import React, { useEffect, useMemo, useState } from "react";

type Airport = { code: string; city: string; name: string };
type Offer = {
  id: string;
  price_total: number;
  currency: string;
  carriers: string[];
  stops: number;
  duration_total_minutes: number;
  outbound: { departure: string; arrival: string; duration_minutes: number; segments: string[] };
  inbound: { departure: string; arrival: string; duration_minutes: number; segments: string[] } | null;
};
type SearchResponse = { origin: string; destination: string; cached: boolean; options: Offer[] };

function minsToHM(m: number) { const h = Math.floor(m / 60); const mm = m % 60; return `${h}h ${mm}m`; }
function fmtDT(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  } catch { return iso; }
}
function money(n: number, ccy = "EUR") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(n); }
  catch { return `${n.toFixed(2)} ${ccy}`; }
}

export default function Home() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loadingAirports, setLoadingAirports] = useState(true);

  // Form state
  const [tripType, setTripType] = useState<"oneway" | "roundtrip">("roundtrip");
  const [mode, setMode] = useState<"exact" | "range">("exact");
  const [origin, setOrigin] = useState("MAD");
  const [plan, setPlan] = useState<{ best_ids: string[]; reason_short?: string } | null>(null);
  const [destination, setDestination] = useState("BCN");
  const [depDate, setDepDate] = useState("");
  const [retDate, setRetDate] = useState("");
  const [depStart, setDepStart] = useState("");
  const [depEnd, setDepEnd] = useState("");
  const [retStart, setRetStart] = useState("");
  const [retEnd, setRetEnd] = useState("");
  const [nonstop, setNonstop] = useState(false);
  const [adults, setAdults] = useState(1);

  // Results
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Local filters
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [onlyNonstop, setOnlyNonstop] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadingAirports(true);
        const r = await fetch("/api/airports", { cache: "no-store" });
        if (!r.ok) throw new Error("No se pudo cargar /api/airports");
        const j = await r.json();
        setAirports(j.airports ?? []);
      } catch (e) { console.error(e); }
      finally { setLoadingAirports(false); }
    })();
  }, []);

  const filteredOptions = useMemo(() => {
    if (!res) return [];
    return (res.options ?? [])
      .filter(o => (maxPrice ? o.price_total <= maxPrice : true))
      .filter(o => (onlyNonstop ? o.stops === 0 : true));
  }, [res, maxPrice, onlyNonstop]);

  const selectableAirports = useMemo(
    () => [...airports].sort((a,b)=>a.city.localeCompare(b.city)),
    [airports]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setRes(null);
    setPlan(null);
    setLoading(true);

    try {
      const body: any = {
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        adults,
        nonstop,
        trip_type: tripType,
      };

      if (mode === "exact") {
        if (!depDate) throw new Error("Pon fecha de salida.");
        body.departure_date = depDate;
        if (tripType === "roundtrip") {
          if (!retDate) throw new Error("Pon fecha de regreso.");
          body.return_date = retDate;
        }
      } else {
        if (!depStart || !depEnd) throw new Error("Completa el rango de salida.");
        body.departure_range = { start: depStart, end: depEnd };
        if (tripType === "roundtrip") {
          if (!retStart || !retEnd) throw new Error("Completa el rango de regreso.");
          body.return_range = { start: retStart, end: retEnd };
        }
      }

      // /api/search
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await safeJson(r);
        throw new Error(j?.error || `Error ${r.status}`);
      }
      const j = await r.json(); // { options, origin, destination, ... }

      // /api/plan (ranking + explicación)
      let ordered = j.options as any[];
      try {
        const pr = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: j.options }),
        });
        if (pr.ok) {
          const planObj = await pr.json(); // { best_ids, reason_short }
          setPlan(planObj);
          const order = new Map(planObj.best_ids.map((id: string, i: number) => [id, i]));
          ordered = [...j.options].sort(
            (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)
          );
        } else {
          setPlan(null);
        }
      } catch {
        setPlan(null);
      }

      setMaxPrice(null);
      setRes({ ...j, options: ordered });
    } catch (e: any) {
      setErr(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() { setMaxPrice(null); setOnlyNonstop(false); }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Buscador de vuelos (MVP)</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        {/* ...el resto de tu JSX sin cambios... */}
      </form>

      {/* ...tabla de resultados, helpers Th/Td, etc. */}
    </main>
  );
}

function ymd(iso: string) { return (iso || "").slice(0, 10); }
function googleFlightsLink(origin: string, dest: string, depISO: string, retISO: string | null, adults: number, currency = "EUR") {
  const dep = ymd(depISO);
  const ret = retISO ? ymd(retISO) : null;
  const q = ret
    ? `Vuelos de ${origin} a ${dest} ${dep} vuelta ${ret} ${adults} adultos`
    : `Vuelos de ${origin} a ${dest} ${dep} ${adults} adultos`;
  const params = new URLSearchParams({ q, hl: "es", curr: currency || "EUR" });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", fontWeight: 600, fontSize: 13, padding: "10px 8px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 8px", verticalAlign: "top" }}>{children}</td>;
}
async function safeJson(r: Response) { try { return await r.json(); } catch { return null; } }

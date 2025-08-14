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
  outbound: { departure: string; arrival: string; duration_minutes: number; segments: string[]; };
  inbound: { departure: string; arrival: string; duration_minutes: number; segments: string[]; } | null;
};
type SearchResponse = { origin: string; destination: string; cached: boolean; options: Offer[]; };

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setRes(null); setLoading(true);
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

      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await safeJson(r);
        throw new Error(j?.error || `Error ${r.status}`);
      }
      const j: SearchResponse = await r.json();
      setMaxPrice(null);
      setRes(j);
    } catch (e: any) {
      setErr(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() { setMaxPrice(null); setOnlyNonstop(false); }

  const selectableAirports = airports.sort((a,b)=>a.city.localeCompare(b.city));

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Buscador de vuelos (MVP)</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Tipo de viaje</label>
            <select value={tripType} onChange={(e)=>setTripType(e.target.value as any)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}>
              <option value="roundtrip">Ida y vuelta</option>
              <option value="oneway">Solo ida</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Origen</label>
            <select value={origin} onChange={(e)=>setOrigin(e.target.value)} disabled={loadingAirports}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 220 }}>
              {selectableAirports.map(a => (
                <option key={a.code} value={a.code}>{a.city} ({a.code}) — {a.name}</option>
              ))}
              {selectableAirports.length===0 && <option value="MAD">Madrid (MAD)</option>}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Destino</label>
            <select value={destination} onChange={(e)=>setDestination(e.target.value)} disabled={loadingAirports}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 220 }}>
              {selectableAirports.map(a => (
                <option key={a.code} value={a.code}>{a.city} ({a.code}) — {a.name}</option>
              ))}
              {selectableAirports.length===0 && <option value="BCN">Barcelona (BCN)</option>}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Modo de fechas</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}>
              <option value="exact">Fechas exactas</option>
              <option value="range">Rango</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Adultos</label>
            <input type="number" min={1} value={adults} onChange={(e)=>setAdults(parseInt(e.target.value||"1",10))}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, width: 80 }} />
          </div>

          <div style={{ alignSelf: "end" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={nonstop} onChange={(e)=>setNonstop(e.target.checked)} />
              Solo sin escalas
            </label>
          </div>
        </div>

        {mode === "exact" ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Salida</label>
              <input type="date" value={depDate} onChange={(e)=>setDepDate(e.target.value)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
            </div>
            {tripType === "roundtrip" && (
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555" }}>Regreso</label>
                <input type="date" value={retDate} onChange={(e)=>setRetDate(e.target.value)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555" }}>Salida: inicio</label>
                <input type="date" value={depStart} onChange={(e)=>setDepStart(e.target.value)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555" }}>Salida: fin</label>
                <input type="date" value={depEnd} onChange={(e)=>setDepEnd(e.target.value)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
              </div>
            </div>
            {tripType === "roundtrip" && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#555" }}>Regreso: inicio</label>
                  <input type="date" value={retStart} onChange={(e)=>setRetStart(e.target.value)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#555" }}>Regreso: fin</label>
                  <input type="date" value={retEnd} onChange={(e)=>setRetEnd(e.target.value)} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={loading} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "#fff" }}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
          {res && (
            <>
              <span style={{ fontSize: 13, color: "#666" }}>
                {res.origin} → {res.destination} • {filteredOptions.length} opciones {res.cached ? "(caché)" : ""}
              </span>
              <button type="button" onClick={resetFilters} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#f4f4f4" }}>
                Limpiar filtros
              </button>
            </>
          )}
        </div>

        {err && (
          <div style={{ padding: 10, background: "#ffe8e8", border: "1px solid #f5a3a3", borderRadius: 8, color: "#b10000" }}>
            {err}
          </div>
        )}
      </form>

      {res && res.options?.length > 0 && (
        <section style={{ marginTop: 16 }}>
          {/* Filtros locales */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Precio máximo (€)</label>
              <input type="number" min={0} value={maxPrice ?? ""} onChange={(e)=>setMaxPrice(e.target.value ? parseInt(e.target.value,10) : null)}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, width: 140 }} />
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={onlyNonstop} onChange={(e)=>setOnlyNonstop(e.target.checked)} />
              Solo sin escalas
            </label>
          </div>

          {/* Tabla de resultados */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Precio</Th>
                  <Th>Aerolíneas</Th>
                  <Th>Escalas</Th>
                  <Th>Duración total</Th>
                  <Th>Ida</Th>
                  <Th>Vuelta</Th>
                </tr>
              </thead>
              <tbody>
                {filteredOptions.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                    <Td>{money(o.price_total, o.currency)}</Td>
                    <Td>{o.carriers.join(", ")}</Td>
                    <Td>{o.stops}</Td>
                    <Td>{minsToHM(o.duration_total_minutes)}</Td>
                    <Td>
                      <div>{fmtDT(o.outbound.departure)} → {fmtDT(o.outbound.arrival)}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{o.outbound.segments.join(" · ")}</div>
                    </Td>
                    <Td>
                      {o.inbound ? (
                        <>
                          <div>{fmtDT(o.inbound.departure)} → {fmtDT(o.inbound.arrival)}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{o.inbound.segments.join(" · ")}</div>
                        </>
                      ) : <em style={{ color: "#666" }}>—</em>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", fontWeight: 600, fontSize: 13, padding: "10px 8px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 8px", verticalAlign: "top" }}>{children}</td>;
}
async function safeJson(r: Response) { try { return await r.json(); } catch { return null; } }

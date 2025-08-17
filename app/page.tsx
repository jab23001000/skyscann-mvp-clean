"use client";

import React, { useEffect, useMemo, useState } from "react";

// Helpers UI a prueba de nulos/indefinidos
const d = (s?: string | null) => (typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : "");
const segs = (a?: string[] | null) => Array.isArray(a) ? a : [];


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

function minsToHM(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}
function fmtDT(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}
function money(n: number, ccy = "EUR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(n);
  } catch {
    return `${n.toFixed(2)} ${ccy}`;
  }
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAirports(false);
      }
    })();
  }, []);

  const filteredOptions = useMemo(() => {
    if (!res) return [];
    return (res.options ?? [])
      .filter((o) => (maxPrice ? o.price_total <= maxPrice : true))
      .filter((o) => (onlyNonstop ? o.stops === 0 : true));
  }, [res, maxPrice, onlyNonstop]);

  const selectableAirports = useMemo(
    () => [...airports].sort((a, b) => a.city.localeCompare(b.city)),
    [airports]
  );

async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setErr(null);
  setRes(null);
  setPlan(null);
  setLoading(true);

  if (mode === "exact") {
  if (!depDate) {
    setLoading(false);
    setErr("Selecciona una fecha de salida.");
    return;
  }
  if (tripType === "roundtrip" && !retDate) {
    setLoading(false);
    setErr("Selecciona una fecha de regreso.");
    return;
  }
} else {
  if (!depStart || !depEnd) {
    setLoading(false);
    setErr("Completa el rango de salida (inicio y fin).");
    return;
  }
  if (tripType === "roundtrip" && (!retStart || !retEnd)) {
    setLoading(false);
    setErr("Completa el rango de regreso (inicio y fin).");
    return;
  }
}

  try {
    const payload = {
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      trip_type: tripType, // "roundtrip" | "oneway"
      departure_date: mode === "exact" ? depDate : undefined,
      return_date:
        tripType === "roundtrip"
          ? (mode === "exact" ? (retDate || null) : null)
          : null,
      departure_range: mode === "range" ? { start: depStart, end: depEnd } : undefined,
      return_range:
        mode === "range" && tripType === "roundtrip"
          ? { start: retStart, end: retEnd }
          : undefined,
      nonstop,
      adults,

      // ⬇️ Alias para /api/search legacy
      date: mode === "exact" ? depDate : undefined,
      date_range: mode === "range" ? { from: depStart, to: depEnd } : undefined
    };

    // 1) /api/search
    const r = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json();
    if (!r.ok) {
      console.error("search error", j);
      throw new Error(j?.error || `Error ${r.status}`);
    }

    // 2) /api/plan (ranking + explicación)
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

        const order = new Map<string, number>(
          (planObj.best_ids as string[]).map((id, i) => [id, i])
        );
        const rank = (id: string) => {
          const v = order.get(id);
          return typeof v === "number" ? v : 999;
        };
        ordered = [...j.options].sort((a: any, b: any) => rank(a.id) - rank(b.id));
      } else {
        setPlan(null);
      }
    } catch {
      setPlan(null);
    }

    // 3) Guardar resultado
    setMaxPrice(null);
    setRes({ ...j, options: ordered });
  } catch (e: any) {
    setErr(e?.message ?? "Error desconocido");
  } finally {
    setLoading(false);
  }
}


  function resetFilters() {
    setMaxPrice(null);
    setOnlyNonstop(false);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Buscador de vuelos (MVP)</h1>

      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 12, borderRadius: 8 }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Tipo de viaje</label>
            <select
              value={tripType}
              onChange={(e) => setTripType(e.target.value as any)}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
            >
              <option value="roundtrip">Ida y vuelta</option>
              <option value="oneway">Solo ida</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Origen</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              disabled={loadingAirports}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 220 }}
            >
              {selectableAirports.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city} ({a.code}) — {a.name}
                </option>
              ))}
              {selectableAirports.length === 0 && <option value="MAD">Madrid (MAD)</option>}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Destino</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={loadingAirports}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 220 }}
            >
              {selectableAirports.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city} ({a.code}) — {a.name}
                </option>
              ))}
              {selectableAirports.length === 0 && <option value="BCN">Barcelona (BCN)</option>}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Modo de fechas</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
            >
              <option value="exact">Fechas exactas</option>
              <option value="range">Rango</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#555" }}>Adultos</label>
            <input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value || "1", 10))}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, width: 80 }}
            />
          </div>

          <div style={{ alignSelf: "end" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={nonstop} onChange={(e) => setNonstop(e.target.checked)} />
              Solo sin escalas
            </label>
          </div>
        </div>

        {mode === "exact" ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Salida</label>
              <input
                type="date"
                value={depDate}
                onChange={(e) => setDepDate(e.target.value)}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </div>
            {tripType === "roundtrip" && (
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555" }}>Regreso</label>
                <input
                  type="date"
                  value={retDate}
                  onChange={(e) => setRetDate(e.target.value)}
                  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555" }}>Salida: inicio</label>
                <input
                  type="date"
                  value={depStart}
                  onChange={(e) => setDepStart(e.target.value)}
                  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555" }}>Salida: fin</label>
                <input
                  type="date"
                  value={depEnd}
                  onChange={(e) => setDepEnd(e.target.value)}
                  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                />
              </div>
            </div>
            {tripType === "roundtrip" && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#555" }}>Regreso: inicio</label>
                  <input
                    type="date"
                    value={retStart}
                    onChange={(e) => setRetStart(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#555" }}>Regreso: fin</label>
                  <input
                    type="date"
                    value={retEnd}
                    onChange={(e) => setRetEnd(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "#fff" }}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>

          {res && (
            <>
              <span style={{ fontSize: 13, color: "#666" }}>
                {res.origin} → {res.destination} • {filteredOptions.length} opciones {res.cached ? "(caché)" : ""}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#f4f4f4" }}
              >
                Limpiar filtros
              </button>
            </>
          )}
        </div>

        {plan?.reason_short && (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "#444",
              background: "#f7f7f7",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              padding: "8px 10px",
              lineHeight: 1.3,
            }}
          >
            <strong>Cómo hemos ordenado:</strong> {plan.reason_short}
          </div>
        )}

        {err && (
          <div
            style={{
              padding: 10,
              background: "#ffe8e8",
              border: "1px solid #f5a3a3",
              borderRadius: 8,
              color: "#b10000",
            }}
          >
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
              <input
                type="number"
                min={0}
                value={maxPrice ?? ""}
                onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, width: 140 }}
              />
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={onlyNonstop} onChange={(e) => setOnlyNonstop(e.target.checked)} />
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
                  <Th>Reservar</Th>
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
                      <div>
                        {fmtDT(o.outbound.departure)} → {fmtDT(o.outbound.arrival)}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>{o.outbound.segments.join(" · ")}</div>
                    </Td>
                    <Td>
                      {o.inbound ? (
                        <>
                          <div>
                            {fmtDT(o.inbound.departure)} → {fmtDT(o.inbound.arrival)}
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>{o.inbound.segments.join(" · ")}</div>
                        </>
                      ) : (
                        <em style={{ color: "#666" }}>—</em>
                      )}
                    </Td>
                    <Td>
                      <a
                        href={googleFlightsLink(
                          res?.origin ?? "MAD",
                          res?.destination ?? "BCN",
                          o.outbound.departure,
                          o.inbound?.departure ?? null,
                          adults,
                          o.currency
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Abrir en Google Flights
                      </a>
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

function ymd(iso?: string | null) {
  if (!iso || typeof iso !== "string") return "";
  // si ya viene "YYYY-MM-DD", úsalo; si es ISO, corta 10
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function googleFlightsLink(
  origin: string,
  dest: string,
  depISO?: string | null,
  retISO?: string | null,
  adults: number = 1,
  currency = "EUR"
) {
  const dep = depISO ? ymd(depISO) : "";
  const ret = retISO ? ymd(retISO) : "";
  const hasDep = !!dep;
  const hasRet = !!ret;

  // Construye query sin fechas si no las tenemos (evita crash)
  const q = hasDep
    ? (hasRet
        ? `Vuelos de ${origin} a ${dest} ${dep} vuelta ${ret} ${adults} adultos`
        : `Vuelos de ${origin} a ${dest} ${dep} ${adults} adultos`)
    : `Vuelos de ${origin} a ${dest} ${adults} adultos`;

  const params = new URLSearchParams({ q, hl: "es", curr: currency || "EUR" });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}


function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontWeight: 600,
        fontSize: 13,
        padding: "10px 8px",
        borderBottom: "2px solid #ddd",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 8px", verticalAlign: "top" }}>{children}</td>;
}
async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

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
  con


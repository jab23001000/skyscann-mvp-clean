// lib/policy.ts
import { z } from "zod";

const Policy = z.object({
  scope: z.string(),
  objectives: z.object({
    weights: z.object({
      price: z.number().min(0).max(1),
      duration: z.number().min(0).max(1),
      transfers: z.number().min(0).max(1),
      connection_risk: z.number().min(0).max(1),
    })
  }),
  defaults: z.object({
    allow_overnight: z.boolean(),
    max_transfers_total: z.number().int().min(0),
    min_connection_minutes: z.object({
      airport_airport: z.number().int().min(0),
      airport_station_same_city: z.number().int().min(0),
      station_station: z.number().int().min(0),
    }),
    prefer_modes: z.array(z.string())
  }),
  constraints: z.object({
    disallow_city_change_without_time_buffer: z.boolean(),
    last_departure_local_time: z.string() // "HH:MM"
  }),
  notes: z.array(z.string())
});
export type Policy = z.infer<typeof Policy>;

let cached: Policy | null = null;

export async function getPolicy(): Promise<Policy> {
  if (cached) return cached;
  // Import estático: Next incluirá el JSON en el bundle
  const policyRaw = await import("@/rules/travel_policy.json");
  const parsed = Policy.parse(policyRaw.default || policyRaw);
  // normaliza "coche" → "car"
  parsed.defaults.prefer_modes = parsed.defaults.prefer_modes.map(m =>
    m.toLowerCase() === "coche" ? "car" : m.toLowerCase()
  );
  cached = parsed;
  return parsed;
}

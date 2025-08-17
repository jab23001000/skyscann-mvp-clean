// lib/redis.ts
const BASE = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

function auth() {
  if (!BASE || !TOKEN) throw new Error("Upstash: faltan env vars");
  return { Authorization: `Bearer ${TOKEN}` };
}

/** GET key (parsea JSON si procede) */
export async function redisGet<T = any>(key: string): Promise<T | null> {
  const r = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: auth(),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash GET ${r.status}`);
  const data = await r.json();
  let v = data?.result ?? null;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch {}
  }
  return v as T | null;
}

/** SET key con TTL en segundos usando POST /set/<key>?EX=ttl */
export async function redisSet(key: string, value: any, ttlSec?: number) {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  const url = `${BASE}/set/${encodeURIComponent(key)}${ttlSec ? `?EX=${ttlSec}` : ""}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: payload,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash SET ${r.status}`);
  return (await r.json())?.result ?? "OK";
}

/** Helper: hash estable sha256 de un objeto */
export async function stableHash(obj: any) {
  const { createHash } = await import("crypto");
  const canonical = (o: any): any =>
    Array.isArray(o) ? o.

// lib/redis.ts
const BASE = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

async function upstashGET(path: string) {
  const r = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash GET error ${r.status}`);
  return r.json();
}

async function upstashPOST(path: string, body: any) {
  const r = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Upstash POST error ${r.status}`);
  return r.json();
}

export const redis = {
  async get<T = any>(key: string): Promise<T | null> {
    const data = await upstashGET(`get/${encodeURIComponent(key)}`);
    let v = data?.result ?? null;
    if (typeof v === "string") {
      try { v = JSON.parse(v); } catch {}
    }
    return v as T | null;
  },
  async set(key: string, value: any, opts?: { ex?: number }) {
    // Guardamos por POST para evitar límites de URL
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    await upstashPOST("set", { key, value: payload, EX: opts?.ex });
  },
};

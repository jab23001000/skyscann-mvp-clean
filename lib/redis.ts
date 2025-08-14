const BASE = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

async function upstash(path: string) {
  const r = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash error ${r.status}`);
  return r.json();
}

export const redis = {
  async get<T = any>(key: string): Promise<T | null> {
    const data = await upstash(`get/${encodeURIComponent(key)}`);
    return (data?.result ?? null) as T | null;
  },
  async set(key: string, value: any, opts?: { ex?: number }) {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    const ttl = opts?.ex ? `?EX=${opts.ex}` : "";
    await upstash(`set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}${ttl}`);
  },
};

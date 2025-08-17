// app/api/health/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAmadeusToken } from "@/lib/amadeus";
import { redisGet, redisSet } from "@/lib/redis";

const REQUIRED_ENVS = [
  "AMADEUS_API_KEY",
  "AMADEUS_API_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

export async function GET() {
  try {
    // 1) Comprobar env vars
    const missing = REQUIRED_ENVS.filter((k) => !process.env[k]);
    const envOK = missing.length === 0;

    // 2) Amadeus
    let amadeusOK = false;
    let amadeusErr: string | undefined;
    try {
      const t = await getAmadeusToken();
      amadeusOK = !!t;
    } catch (e: any) {
      amadeusErr = e?.message || String(e);
    }

    // 3) Redis
    let redisOK = false;
    let redisErr: string | undefined;
    try {
      const key = "health:pulse";
      await redisSet(key, { t: Date.now() }, 30);
      const v = await redisGet(key);
      redisOK = !!v;
    } catch (e: any) {
      redisErr = e?.message || String(e);
    }

    const ok = envOK && amadeusOK && redisOK;
    return NextResponse.json({
      ok,
      envOK,
      amadeusOK,
      redisOK,
      missingEnvs: missing.length ? missing : undefined,
      errors: {
        amadeus: amadeusErr,
        redis: redisErr,
      },
    }, { status: ok ? 200 : 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
  }
}


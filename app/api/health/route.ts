import { NextResponse } from "next/server";
import { getAmadeusToken } from "@/lib/amadeus";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    // Amadeus
    const token = await getAmadeusToken();
    const amadeusOK = !!token;

    // Redis roundtrip
    const key = "health:ping";
    await redis.set(key, { ok: true, t: Date.now() }, { ex: 60 });
    const val = await redis.get<any>(key);
    const redisOK = !!val?.ok;

    return NextResponse.json({ ok: amadeusOK && redisOK, amadeusOK, redisOK });
  } catch (e: any) {
    console.error("health_error", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}

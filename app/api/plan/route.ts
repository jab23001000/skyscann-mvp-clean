

// app/api/plan/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPolicy } from "@/lib/policy";
import { rankItineraries, reasonShort } from "@/lib/ranking";

const OfferZ = z.object({
  id: z.string(),
  price_total: z.number(),
  currency: z.string(),
  stops: z.number(),
  duration_total_minutes: z.number(),
  outbound: z.any(),
  inbound: z.any().nullable(),
});
const ReqZ = z.object({
  origin: z.string().min(3).max(3).optional(),
  destination: z.string().min(3).max(3).optional(),
  options: z.array(OfferZ).min(1),
  policy_hint: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = ReqZ.parse(await req.json());
    const policy = getPolicy();

    // 1) ranking determinista
    const ranked = rankItineraries(body.options, policy);
    const best_ids = ranked.map(r => r.id);

    // 2) explicación breve
    const reason_short = reasonShort(policy);

    return NextResponse.json({ best_ids, reason_short });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "bad_request" }, { status: 400 });
  }
}

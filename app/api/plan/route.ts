// app/api/plan/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPolicy } from "@/lib/policy";
import { rankItineraries } from "@/lib/ranking";

const Req = z.object({
  options: z.array(z.any()).min(1), // NormalizedItinerary[]
  useLLM: z.boolean().optional()
});

export async function POST(req: NextRequest) {
  try {
    const { options } = Req.parse(await req.json());
    const policy = await getPolicy();

    // 1) filtro duro
    const feasible = options.filter((o: any) => (o?.transfers ?? 0) <= policy.defaults.max_transfers_total);

    if (feasible.length === 0) {
      return NextResponse.json({ best_ids: [], reason_short: "Ninguna opción cumple la política" });
    }

    // 2) ranking determinista (MVP)
    const scored = rankItineraries(feasible as any, policy);
    const best = scored.slice(0, 5).map(s => s.id);

    // 3) explicación breve basada en pesos dominantes
    const w = policy.objectives.weights;
    const main = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "price";
    const reason =
      main === "price" ? "Ordenado por precio con atención a duración y conexiones."
      : main === "duration" ? "Priorizamos duración total y conexiones seguras."
      : "Equilibrio entre precio, duración y transbordos.";

    return NextResponse.json({ best_ids: best, reason_short: reason });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal_error" }, { status: 400 });
  }
}

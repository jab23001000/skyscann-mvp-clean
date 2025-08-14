type AmadeusOffer = any;

function isoDurToMinutes(iso: string) {
  const h = /(\d+)H/.exec(iso)?.[1];
  const m = /(\d+)M/.exec(iso)?.[1];
  return (h ? parseInt(h) : 0) * 60 + (m ? parseInt(m) : 0);
}

export function normalizeOffers(offers: AmadeusOffer[]) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const o of offers ?? []) {
    try {
      const id = o.id;
      if (seen.has(id)) continue;
      seen.add(id);

      const itineraries = o.itineraries || [];
      const outIt = itineraries[0], inIt = itineraries[1];

      const carriers = Array.from(new Set([...(outIt?.segments ?? []), ...(inIt?.segments ?? [])]
        .map((s: any) => s.carrierCode)));

      const buildSlice = (it: any) => {
        const segs = it.segments;
        return {
          departure: segs[0].departure.at,
          arrival: segs[segs.length - 1].arrival.at,
          duration_minutes: isoDurToMinutes(it.duration),
          segments: segs.map((s: any) => `${s.carrierCode}${s.number} ${s.departure.iataCode}-${s.arrival.iataCode}`),
        };
      };

      const outbound = buildSlice(outIt);
      const inbound  = inIt ? buildSlice(inIt) : null;
      const stops = Math.max(0, (outIt?.segments?.length ?? 1) - 1) + (inIt ? Math.max(0, inIt.segments.length - 1) : 0);
      const total_minutes = outbound.duration_minutes + (inbound?.duration_minutes ?? 0);

      out.push({
        id,
        price_total: parseFloat(o.price.grandTotal),
        currency: o.price.currency,
        carriers,
        stops,
        duration_total_minutes: total_minutes,
        outbound,
        inbound,
      });
    } catch {}
  }
  return out;
}

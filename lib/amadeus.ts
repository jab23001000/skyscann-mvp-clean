let tokenCache: { value?: string; exp?: number } = {};

export async function getAmadeusToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.exp && tokenCache.exp - 60 > now) return tokenCache.value;

  const res = await fetch(`${process.env.AMAD_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Amadeus auth failed");
  const data = await res.json();
  tokenCache = {
    value: data.access_token,
    exp: Math.floor(Date.now() / 1000) + (data.expires_in ?? 1800),
  };
  return tokenCache.value!;
}

export async function amadeusSearchRoundtrip(q: {
  origin: string; destination: string; departureDate: string; returnDate: string;
  adults?: number; currencyCode?: string; nonStop?: boolean; travelClass?: string; max?: number;
}) {
  const token = await getAmadeusToken();
  const params = new URLSearchParams({
    originLocationCode: q.origin,
    destinationLocationCode: q.destination,
    departureDate: q.departureDate,
    returnDate: q.returnDate,
    adults: String(q.adults ?? 1),
    currencyCode: q.currencyCode ?? "EUR",
    max: String(q.max ?? 50),
  });
  if (typeof q.nonStop === "boolean") params.set("nonStop", String(q.nonStop));
  if (q.travelClass) params.set("travelClass", q.travelClass);

  const res = await fetch(`${process.env.AMAD_BASE}/v2/shopping/flight-offers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Amadeus error ${res.status}`);
  const data = await res.json();
  return data?.data ?? [];
}

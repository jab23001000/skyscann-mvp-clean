import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    airports: [
      { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas", lat: 40.4722, lng: -3.5609 },
      { code: "BCN", city: "Barcelona", name: "Josep Tarradellas Barcelona-El Prat", lat: 41.2974, lng: 2.0833 },
      { code: "AGP", city: "Málaga", name: "Costa del Sol", lat: 36.6749, lng: -4.4991 },
      { code: "SVQ", city: "Sevilla", name: "Sevilla", lat: 37.418,  lng: -5.8931 },
      { code: "VLC", city: "Valencia", name: "Valencia", lat: 39.4893, lng: -0.4816 },
    ],
  });
}

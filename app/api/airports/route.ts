import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    airports: [
      // Principales
      { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas" },
      { code: "BCN", city: "Barcelona", name: "Josep Tarradellas Barcelona-El Prat" },
      { code: "AGP", city: "Málaga", name: "Costa del Sol" },
      { code: "ALC", city: "Alicante", name: "Alicante–Elche Miguel Hernández" },
      { code: "VLC", city: "Valencia", name: "Valencia" },
      { code: "SVQ", city: "Sevilla", name: "Sevilla" },
      // Baleares
      { code: "PMI", city: "Palma de Mallorca", name: "Palma de Mallorca" },
      { code: "IBZ", city: "Ibiza", name: "Ibiza" },
      { code: "MAH", city: "Menorca", name: "Menorca" },
      // Canarias
      { code: "TFS", city: "Tenerife", name: "Tenerife Sur" },
      { code: "TFN", city: "Tenerife", name: "Tenerife Norte–Ciudad de La Laguna" },
      { code: "LPA", city: "Gran Canaria", name: "Gran Canaria" },
      { code: "ACE", city: "Lanzarote", name: "César Manrique–Lanzarote" },
      { code: "FUE", city: "Fuerteventura", name: "Fuerteventura" },
      { code: "SPC", city: "La Palma", name: "La Palma" },
      { code: "GMZ", city: "La Gomera", name: "La Gomera" },
      { code: "VDE", city: "El Hierro", name: "El Hierro" },
      // Norte
      { code: "BIO", city: "Bilbao", name: "Bilbao" },
      { code: "SDR", city: "Santander", name: "Seve Ballesteros–Santander" },
      { code: "LCG", city: "A Coruña", name: "A Coruña" },
      { code: "SCQ", city: "Santiago de Compostela", name: "Santiago–Rosalía de Castro" },
      { code: "VGO", city: "Vigo", name: "Vigo–Peinador" },
      { code: "OVD", city: "Asturias", name: "Asturias" },
      { code: "EAS", city: "San Sebastián", name: "San Sebastián" },
      { code: "PNA", city: "Pamplona", name: "Pamplona" },
      { code: "VIT", city: "Vitoria-Gasteiz", name: "Vitoria" },
      // Este / Cataluña
      { code: "GRO", city: "Girona", name: "Girona–Costa Brava" },
      { code: "REU", city: "Reus", name: "Reus" },
      { code: "ILD", city: "Lleida", name: "Lleida–Alguaire" },
      // Centro y otros
      { code: "ZAZ", city: "Zaragoza", name: "Zaragoza" },
      { code: "VLL", city: "Valladolid", name: "Valladolid" },
      { code: "RJL", city: "Logroño", name: "Logroño–Agoncillo" },
      { code: "RGS", city: "Burgos", name: "Burgos" },
      { code: "SLM", city: "Salamanca", name: "Matacán" },
      { code: "BJZ", city: "Badajoz", name: "Badajoz" },
      // Andalucía / Levante extra
      { code: "XRY", city: "Jerez de la Frontera", name: "Jerez" },
      { code: "LEI", city: "Almería", name: "Almería" },
      { code: "GRX", city: "Granada", name: "Federico García Lorca Granada-Jaén" },
      { code: "RMU", city: "Murcia", name: "Región de Murcia–Corvera" },
      // Ciudades autónomas
      { code: "MLN", city: "Melilla", name: "Melilla" },
      // (opcional) Huesca (HSK) – poca o nula operativa comercial
      { code: "HSK", city: "Huesca", name: "Huesca-Pirineos" }
    ],
  });
}

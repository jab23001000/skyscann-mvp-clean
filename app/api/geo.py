# app/geo.py
from typing import List, Dict, Tuple
import math
import json
from pathlib import Path

# Cargar gazetteer y aeropuertos
DATA_DIR = Path(__file__).parent / "data"
CITIES = json.loads((DATA_DIR / "es_cities_min.json").read_text(encoding="utf-8"))  # [{name, alt_names, lat, lon}]
AIRPORTS = json.loads((DATA_DIR / "es_airports.json").read_text(encoding="utf-8"))  # [{iata, name, city, lat, lon}]
CCAA_CAPITAL = json.loads((DATA_DIR / "ccaa_capital.json").read_text(encoding="utf-8"))  # {"navarra": "pamplona", ...}

def _norm(s: str) -> str:
    return s.strip().lower()

def find_city_or_ccaa(q: str) -> Tuple[str, float, float]:
    n = _norm(q)
    # CCAA → capital
    if n in CCAA_CAPITAL:
        n = _norm(CCAA_CAPITAL[n])
    # match por nombre o alt_names
    for c in CITIES:
        if _norm(c["name"]) == n or n in [ _norm(a) for a in c.get("alt_names", []) ]:
            return c["name"], c["lat"], c["lon"]
    # fallback: prefix match simple
    for c in CITIES:
        if _norm(c["name"]).startswith(n):
            return c["name"], c["lat"], c["lon"]
    raise ValueError(f"No encontrado: {q}")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2-lat1)
    dlon = math.radians(lon2-lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(a))

def nearest_airports(lat: float, lon: float, top_n: int = 2) -> List[Dict]:
    scored = []
    for ap in AIRPORTS:
        d_km = haversine(lat, lon, ap["lat"], ap["lon"])
        scored.append((d_km, ap))
    scored.sort(key=lambda x: x[0])
    return [{"iata": ap["iata"], "name": ap["name"], "city": ap["city"], "distance_km": round(d,1), "lat": ap["lat"], "lon": ap["lon"]}
            for d, ap in scored[:top_n]]

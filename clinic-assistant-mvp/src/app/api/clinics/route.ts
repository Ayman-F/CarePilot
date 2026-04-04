import { NextResponse } from "next/server";

type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lon: number;
  distance_km: number;
};

type ClinicsResponse = {
  origin: { location: string; lat: number; lon: number };
  clinics: Clinic[];
};

const FALLBACK_CLINICS: Clinic[] = [
  {
    id: "fallback-1",
    name: "Montreal Walk-In Clinic",
    address: "123 Rue Sainte-Catherine, Montreal, QC",
    phone: "Phone not listed (call main line)",
    lat: 45.5019,
    lon: -73.5674,
    distance_km: 0,
  },
  {
    id: "fallback-2",
    name: "Plateau Community Clinic",
    address: "456 Avenue du Mont-Royal, Montreal, QC",
    phone: "Phone not listed (call main line)",
    lat: 45.5245,
    lon: -73.5832,
    distance_km: 0,
  },
  {
    id: "fallback-3",
    name: "Downtown Medical Clinic",
    address: "789 Boulevard Rene-Levesque, Montreal, QC",
    phone: "Phone not listed (call main line)",
    lat: 45.4996,
    lon: -73.5709,
    distance_km: 0,
  },
];

const USER_AGENT = "ClinicAssistantMVP/1.0 (hackathon demo)";

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const buildAddress = (tags: Record<string, string> | undefined) => {
  if (!tags) return "";
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return tags["address"] ?? "";
};

const pickPhone = (tags: Record<string, string> | undefined) => {
  if (!tags) return "";
  return (
    tags["contact:phone"] ||
    tags["phone"] ||
    tags["contact:mobile"] ||
    tags["mobile"] ||
    ""
  );
};

const reverseGeocodeAddress = async (lat: number, lon: number) => {
  const reverseUrl = new URL(
    "https://nominatim.openstreetmap.org/reverse",
  );
  reverseUrl.searchParams.set("format", "json");
  reverseUrl.searchParams.set("lat", String(lat));
  reverseUrl.searchParams.set("lon", String(lon));
  reverseUrl.searchParams.set("addressdetails", "1");

  const response = await fetch(reverseUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en",
    },
  });

  if (!response.ok) return "";
  const data = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  if (data.display_name) return data.display_name;
  const address = data.address;
  if (!address) return "";
  const parts = [
    address["house_number"],
    address["road"],
    address["city"] || address["town"] || address["village"],
    address["postcode"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
};

const overpassQueryFor = (lat: number, lon: number, radiusMeters: number) => `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})[amenity=clinic];
  node(around:${radiusMeters},${lat},${lon})[healthcare=clinic];
  node(around:${radiusMeters},${lat},${lon})[healthcare=doctor];
  node(around:${radiusMeters},${lat},${lon})[amenity=doctors];
  way(around:${radiusMeters},${lat},${lon})[amenity=clinic];
  way(around:${radiusMeters},${lat},${lon})[healthcare=clinic];
  way(around:${radiusMeters},${lat},${lon})[healthcare=doctor];
  way(around:${radiusMeters},${lat},${lon})[amenity=doctors];
  relation(around:${radiusMeters},${lat},${lon})[amenity=clinic];
  relation(around:${radiusMeters},${lat},${lon})[healthcare=clinic];
  relation(around:${radiusMeters},${lat},${lon})[healthcare=doctor];
  relation(around:${radiusMeters},${lat},${lon})[amenity=doctors];
);
out center tags;
`;

const applyFallbackDistance = (lat: number, lon: number) =>
  FALLBACK_CLINICS.map((clinic) => ({
    ...clinic,
    distance_km: Number(
      haversineKm(lat, lon, clinic.lat, clinic.lon).toFixed(2),
    ),
  }));

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { location?: string };
    const location = (body.location ?? "").trim();
    if (!location) {
      return NextResponse.json(
        { error: "Please provide a Quebec postal code or address." },
        { status: 400 },
      );
    }

    const geocodeUrl = new URL(
      "https://nominatim.openstreetmap.org/search",
    );
    geocodeUrl.searchParams.set("q", location);
    geocodeUrl.searchParams.set("format", "json");
    geocodeUrl.searchParams.set("limit", "1");
    geocodeUrl.searchParams.set("addressdetails", "1");
    geocodeUrl.searchParams.set("countrycodes", "ca");

    const geocodeResponse = await fetch(geocodeUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en",
      },
    });

    if (!geocodeResponse.ok) {
      return NextResponse.json(
        { error: "Unable to geocode the location. Try a Quebec postal code." },
        { status: 400 },
      );
    }

    const geocodeResults = (await geocodeResponse.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!geocodeResults.length) {
      return NextResponse.json(
        { error: "Location not found. Try a Quebec postal code or address." },
        { status: 400 },
      );
    }

    const originLat = Number.parseFloat(geocodeResults[0].lat);
    const originLon = Number.parseFloat(geocodeResults[0].lon);

    if (Number.isNaN(originLat) || Number.isNaN(originLon)) {
      return NextResponse.json(
        { error: "Location not found. Try a Quebec postal code or address." },
        { status: 400 },
      );
    }

    const overpassResponse = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(overpassQueryFor(originLat, originLon, 12000))}`,
      },
    );

    let clinics: Clinic[] = [];

    if (overpassResponse.ok) {
      const overpassData = (await overpassResponse.json()) as {
        elements: Array<{
          id: number;
          type: string;
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: Record<string, string>;
        }>;
      };

      clinics = overpassData.elements
        .map((element) => {
          const lat =
            typeof element.lat === "number"
              ? element.lat
              : element.center?.lat;
          const lon =
            typeof element.lon === "number"
              ? element.lon
              : element.center?.lon;
          if (typeof lat !== "number" || typeof lon !== "number") return null;
          const name = element.tags?.name ?? "Clinic";
          const address = buildAddress(element.tags);
          const phone = pickPhone(element.tags);
          return {
            id: `${element.type}-${element.id}`,
            name,
            address,
            phone,
            lat,
            lon,
            distance_km: Number(
              haversineKm(originLat, originLon, lat, lon).toFixed(2),
            ),
          } satisfies Clinic;
        })
        .filter((clinic): clinic is Clinic => clinic !== null)
        .sort((a, b) => a.distance_km - b.distance_km);
    }

    const needsReverse = clinics
      .filter((clinic) => !clinic.address)
      .slice(0, 3);
    for (const clinic of needsReverse) {
      // small delay to respect Nominatim rate limits
      await new Promise((resolve) => setTimeout(resolve, 250));
      const address = await reverseGeocodeAddress(clinic.lat, clinic.lon);
      clinic.address = address || "Nearby clinic (address lookup failed)";
    }

    clinics = clinics.map((clinic) => ({
      ...clinic,
      address: clinic.address || "Nearby clinic (address lookup failed)",
      phone: clinic.phone || "Phone not listed (call main line)",
    }));

    if (clinics.length < 3) {
      const fallbackClinics = applyFallbackDistance(originLat, originLon).sort(
        (a, b) => a.distance_km - b.distance_km,
      );
      const merged = [...clinics, ...fallbackClinics].slice(0, 3);
      const response: ClinicsResponse = {
        origin: { location, lat: originLat, lon: originLon },
        clinics: merged,
      };
      return NextResponse.json(response, {
        headers: { "x-fallback": "1" },
      });
    }

    const response: ClinicsResponse = {
      origin: { location, lat: originLat, lon: originLon },
      clinics: clinics.slice(0, 3),
    };
    return NextResponse.json(response);
  } catch {
    const response: ClinicsResponse = {
      origin: { location: "Unknown", lat: 45.5019, lon: -73.5674 },
      clinics: applyFallbackDistance(45.5019, -73.5674),
    };
    return NextResponse.json(response, {
      headers: { "x-fallback": "1" },
    });
  }
}

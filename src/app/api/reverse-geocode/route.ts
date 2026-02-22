import { NextRequest, NextResponse } from "next/server";
import { fetchNaverApiJson, NAVER_MAPS_API_BASES } from "@/lib/naverApi";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat")?.trim();
  const lon = request.nextUrl.searchParams.get("lon")?.trim();
  const orders = request.nextUrl.searchParams.get("orders")?.trim() || "roadaddr,addr";

  if (!lat || !lon) {
    return NextResponse.json({ message: "lat, lon 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
    const coords = `${lon},${lat}`;
    const upstream = `${NAVER_MAPS_API_BASES.reverseGeocoding}/gc?coords=${encodeURIComponent(coords)}&sourcecrs=epsg:4326&output=json&orders=${encodeURIComponent(orders)}`;
    const payload = (await fetchNaverApiJson(upstream)) as {
      results?: Array<{
        name?: string;
        region?: {
          area1?: { name?: string };
          area2?: { name?: string };
          area3?: { name?: string };
          area4?: { name?: string };
        };
        land?: {
          number1?: string;
          number2?: string;
          name?: string;
        };
      }>;
    };

    const items = (payload.results ?? []).map((item) => {
      const a1 = item.region?.area1?.name ?? "";
      const a2 = item.region?.area2?.name ?? "";
      const a3 = item.region?.area3?.name ?? "";
      const a4 = item.region?.area4?.name ?? "";
      const landName = item.land?.name ?? "";
      const num1 = item.land?.number1 ?? "";
      const num2 = item.land?.number2 ? `-${item.land.number2}` : "";
      const address = [a1, a2, a3, a4, landName, `${num1}${num2}`].filter(Boolean).join(" ").trim();

      return {
        title: item.name ?? "reverse-geocode",
        address,
        lat: Number(lat),
        lon: Number(lon),
      };
    });

    return NextResponse.json({ items, raw: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "네이버 Reverse Geocoding 오류";
    return NextResponse.json({ message }, { status: 502 });
  }
}

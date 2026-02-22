import { NextRequest, NextResponse } from "next/server";
import { fetchNaverApiJson, NAVER_MAPS_API_BASES } from "@/lib/naverApi";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ message: "query가 필요합니다." }, { status: 400 });
  }

  try {
    const upstream = `${NAVER_MAPS_API_BASES.geocoding}/geocode?query=${encodeURIComponent(query)}&count=10`;
    const payload = (await fetchNaverApiJson(upstream)) as {
      addresses?: Array<{
        x: string;
        y: string;
        roadAddress?: string;
        jibunAddress?: string;
      }>;
    };

    const items = (payload.addresses ?? []).slice(0, 10).map((item) => {
      const title = item.roadAddress || item.jibunAddress || "주소";
      return {
        title,
        address: item.jibunAddress || item.roadAddress || "",
        lat: Number(item.y),
        lon: Number(item.x),
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "네이버 지오코딩 오류";
    return NextResponse.json({ message }, { status: 502 });
  }
}

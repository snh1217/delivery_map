import { NextRequest, NextResponse } from "next/server";

const API_URL = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ message: "query가 필요합니다." }, { status: 400 });
  }

  const keyId = process.env.NAVER_MAPS_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;
  const secret = process.env.NAVER_MAPS_CLIENT_SECRET;

  if (!keyId || !secret) {
    return NextResponse.json({ message: "네이버 지오코딩 키 설정이 필요합니다." }, { status: 500 });
  }

  const upstream = `${API_URL}?query=${encodeURIComponent(query)}&count=10`;
  const response = await fetch(upstream, {
    headers: {
      "x-ncp-apigw-api-key-id": keyId,
      "x-ncp-apigw-api-key": secret,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json({ message: `네이버 API 오류: ${message}` }, { status: 502 });
  }

  const payload = (await response.json()) as {
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
}

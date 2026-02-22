import { NextRequest, NextResponse } from "next/server";
import { fetchNaverApiJson, NAVER_MAPS_API_BASES } from "@/lib/naverApi";

function parsePoint(request: NextRequest, prefix: "start" | "goal") {
  const direct = request.nextUrl.searchParams.get(prefix)?.trim();
  if (direct) {
    return direct;
  }

  const lat = request.nextUrl.searchParams.get(`${prefix}Lat`)?.trim();
  const lon = request.nextUrl.searchParams.get(`${prefix}Lon`)?.trim();
  if (!lat || !lon) {
    return null;
  }

  return `${lon},${lat}`;
}

export async function GET(request: NextRequest) {
  const start = parsePoint(request, "start");
  const goal = parsePoint(request, "goal");
  const option = request.nextUrl.searchParams.get("option")?.trim() || "trafast";

  if (!start || !goal) {
    return NextResponse.json({ message: "start/goal 또는 startLat,startLon,goalLat,goalLon 이 필요합니다." }, { status: 400 });
  }

  try {
    const upstream = `${NAVER_MAPS_API_BASES.directions5}/driving?start=${encodeURIComponent(start)}&goal=${encodeURIComponent(goal)}&option=${encodeURIComponent(option)}`;
    const payload = (await fetchNaverApiJson(upstream)) as Record<string, unknown>;
    return NextResponse.json({ provider: "directions5", raw: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "네이버 Directions5 오류";
    return NextResponse.json({ message }, { status: 502 });
  }
}

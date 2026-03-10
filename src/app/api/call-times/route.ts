import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { insertCallEstimateHistory, listCallEstimateHistory } from "@/lib/callEstimates";
import type { RouteCallEstimateLeg } from "@/types";

export async function GET() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const rows = await listCallEstimateHistory(user.phone, 10);
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "콜 시간 이력 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    callTime?: string;
    deadlineLabel?: string;
    longestLegMin?: number;
    adjustedDriveMin?: number;
    pickupMin?: number;
    totalRequiredMin?: number;
    referenceLeg?: string;
    routeLegs?: RouteCallEstimateLeg[];
  };

  if (!body.callTime || !body.deadlineLabel || !body.referenceLeg) {
    return NextResponse.json({ message: "필수 값이 부족합니다." }, { status: 400 });
  }

  try {
    const row = await insertCallEstimateHistory({
      phone: user.phone,
      callTime: body.callTime,
      deadlineLabel: body.deadlineLabel,
      longestLegMin: Math.max(0, Math.round(body.longestLegMin ?? 0)),
      adjustedDriveMin: Math.max(0, Math.round(body.adjustedDriveMin ?? 0)),
      pickupMin: Math.max(0, Math.round(body.pickupMin ?? 0)),
      totalRequiredMin: Math.max(0, Math.round(body.totalRequiredMin ?? 0)),
      referenceLeg: body.referenceLeg,
      routeLegs: Array.isArray(body.routeLegs) ? body.routeLegs : [],
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "콜 시간 이력 저장 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

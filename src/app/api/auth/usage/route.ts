import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_PHONE_COOKIE,
  insertRouteRun,
  listUserRouteRunsToday,
  sessionUserFromCookies,
} from "@/lib/auth/allowlist";
import type { RouteRunStop } from "@/types";

export async function GET() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const payload = await listUserRouteRunsToday(user.phone, 100);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "사용 이력 조회 실패";
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

  try {
    const body = (await request.json()) as {
      provider?: "naver" | "kakao";
      batchLabel?: string | null;
      finalShortList?: string[];
      routeStops?: RouteRunStop[];
    };

    if (body.provider !== "naver" && body.provider !== "kakao") {
      return NextResponse.json({ message: "지원되지 않는 길찾기 앱입니다." }, { status: 400 });
    }

    const row = await insertRouteRun({
      phone: user.phone,
      provider: body.provider,
      batchLabel: body.batchLabel ?? null,
      finalShortList: Array.isArray(body.finalShortList) ? body.finalShortList : [],
      routeStops: Array.isArray(body.routeStops) ? body.routeStops : [],
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사용 이력 저장 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}


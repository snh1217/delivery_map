import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { getTodayDailyEarning, upsertTodayDailyEarning } from "@/lib/earningsStore";

async function requireAllowedUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  return sessionUserFromCookies({ phone });
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetName = (url.searchParams.get("target") ?? "").trim();
  const targetId = (url.searchParams.get("targetId") ?? "").trim() || null;

  if (!targetName) {
    return NextResponse.json({ message: "target 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
    const result = await getTodayDailyEarning({
      ownerPhone: user.phone,
      targetName,
      targetId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "오늘 운임 조회 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      targetName?: string;
      targetId?: string | null;
      items?: unknown[];
    };

    const row = await upsertTodayDailyEarning({
      ownerPhone: user.phone,
      targetName: body.targetName ?? "",
      targetId: body.targetId ?? null,
      items: Array.isArray(body.items) ? body.items : [],
    });

    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "오늘 운임 저장 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}


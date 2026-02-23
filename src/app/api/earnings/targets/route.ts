import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { createEarningTarget, listEarningTargets } from "@/lib/earningsStore";

async function requireAllowedUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  return sessionUserFromCookies({ phone });
}

export async function GET() {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const targets = await listEarningTargets(user.phone);
    return NextResponse.json({ targets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "대상 목록 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { targetName?: string };
    const row = await createEarningTarget({
      ownerPhone: user.phone,
      targetName: body.targetName ?? "",
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "대상 생성 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}


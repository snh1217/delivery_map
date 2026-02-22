import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, insertLoginLog, sessionUserFromCookies } from "@/lib/auth/allowlist";

export async function POST(request: Request) {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { userAgent?: string };
    await insertLoginLog(user.phone, body.userAgent ?? request.headers.get("user-agent"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "로그 저장 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

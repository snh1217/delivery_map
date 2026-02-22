import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_PROVIDER_COOKIE,
  AUTH_TOKEN_COOKIE,
  insertLoginLog,
  sessionUserFromCookies,
} from "@/lib/auth/allowlist";

export async function POST(request: Request) {
  const store = await cookies();
  const provider = store.get(AUTH_PROVIDER_COOKIE)?.value;
  const token = store.get(AUTH_TOKEN_COOKIE)?.value;
  const user = await sessionUserFromCookies({ provider, token });

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

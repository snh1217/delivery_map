import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_PHONE_COOKIE,
  createPhoneSession,
  sessionMaxAgeSeconds,
  sessionUserFromCookies,
} from "@/lib/auth/allowlist";

export async function GET() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;

  const user = await sessionUserFromCookies({ phone });
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string };
    const result = await createPhoneSession({
      phone: body.phone ?? "",
      userAgent: request.headers.get("user-agent"),
    });

    if (!result.ok) {
      return NextResponse.json({ message: "승인된 전화번호가 아닙니다." }, { status: 403 });
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(AUTH_PHONE_COOKIE, result.phone, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: result.maxAge ?? sessionMaxAgeSeconds(),
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "로그인 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_PHONE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

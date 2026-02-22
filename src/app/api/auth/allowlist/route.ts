import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveAuthProvider } from "@/lib/auth/provider";
import {
  AUTH_PROVIDER_COOKIE,
  AUTH_TOKEN_COOKIE,
  sessionUserFromCookies,
  validateAndBuildSession,
} from "@/lib/auth/allowlist";

export async function GET() {
  const store = await cookies();
  const provider = store.get(AUTH_PROVIDER_COOKIE)?.value;
  const token = store.get(AUTH_TOKEN_COOKIE)?.value;

  const user = await sessionUserFromCookies({ provider, token });
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { provider?: string; token?: string };
    const provider = resolveAuthProvider(body.provider);

    if (!body.token) {
      return NextResponse.json({ message: "토큰이 필요합니다." }, { status: 400 });
    }

    const result = await validateAndBuildSession({
      provider,
      token: body.token,
      userAgent: request.headers.get("user-agent"),
    });

    if (!result.ok) {
      return NextResponse.json({ message: "allowlist 미허용 사용자입니다." }, { status: 403 });
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(AUTH_PROVIDER_COOKIE, provider, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: result.maxAge,
      path: "/",
    });
    response.cookies.set(AUTH_TOKEN_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: result.maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "인증 실패";
    return NextResponse.json({ message }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_PROVIDER_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(AUTH_TOKEN_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

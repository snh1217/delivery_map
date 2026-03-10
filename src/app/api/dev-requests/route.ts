import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { createDevelopmentRequest, listDevelopmentRequests } from "@/lib/devRequests";

async function requireAllowedUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user?.isAllowed) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const rows = await listDevelopmentRequests({ phone: user.phone, limit: 50 });
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "개발 요청 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
  };

  try {
    const row = await createDevelopmentRequest({
      phone: user.phone,
      title: body.title ?? "",
      body: body.body ?? "",
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "개발 요청 등록 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

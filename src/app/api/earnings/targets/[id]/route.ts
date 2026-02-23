import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { toggleEarningTarget } from "@/lib/earningsStore";

async function requireAllowedUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  return sessionUserFromCookies({ phone });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = (await request.json()) as { isActive?: boolean };
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ message: "isActive 값이 필요합니다." }, { status: 400 });
    }

    const row = await toggleEarningTarget({
      ownerPhone: user.phone,
      id,
      isActive: body.isActive,
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "대상 상태 변경 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}


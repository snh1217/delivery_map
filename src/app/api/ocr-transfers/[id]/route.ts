import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { updateOcrTransferStatus } from "@/lib/ocr/transferStore";

async function requireAllowedUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user?.isAllowed) {
    return null;
  }
  return user;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: "consume" | "dismiss" };
  const params = await context.params;
  const action = body.action === "dismiss" ? "dismissed" : "consumed";

  try {
    const row = await updateOcrTransferStatus({
      ownerPhone: user.phone,
      id: params.id,
      status: action,
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "받은 주소 상태 변경 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

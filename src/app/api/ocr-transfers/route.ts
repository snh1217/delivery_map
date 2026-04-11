import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { createOcrTransfer, listOcrTransfers } from "@/lib/ocr/transferStore";

async function requireAllowedUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user?.isAllowed) {
    return null;
  }
  return user;
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "pending") as "pending" | "consumed" | "dismissed" | "all";
    const rows = await listOcrTransfers({ ownerPhone: user.phone, status, limit: 30 });
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "받은 주소 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    extractedText?: string;
    rawText?: string;
    source?: "extractor" | "admin-panel" | "destination-row";
  };

  try {
    const row = await createOcrTransfer({
      ownerPhone: user.phone,
      senderPhone: user.phone,
      extractedText: body.extractedText ?? "",
      rawText: body.rawText ?? null,
      source: body.source ?? "extractor",
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "주소 전송 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

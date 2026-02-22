import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import {
  AUTH_PHONE_COOKIE,
  listAllowlist,
  listLoginLogs,
  listSignupRequests,
  reviewSignupRequest,
  sessionUserFromCookies,
  toggleAllowlist,
  upsertAllowlist,
} from "@/lib/auth/allowlist";

async function requireAdmin() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user || !user.isAdmin) {
    return null;
  }

  return user;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const activeOnly = new URL(request.url).searchParams.get("activeOnly") === "1";

  try {
    const [allowlist, logs, signupRequests] = await Promise.all([
      listAllowlist(activeOnly),
      listLoginLogs(40),
      listSignupRequests(),
    ]);
    return NextResponse.json({ allowlist, logs, signupRequests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json()) as { phone?: string };
  const phone = normalizePhoneNumber(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ message: "유효한 전화번호를 입력하세요." }, { status: 400 });
  }

  try {
    const row = await upsertAllowlist(phone);
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "추가 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json()) as { phone?: string; isActive?: boolean };
  const phone = normalizePhoneNumber(body.phone ?? "");
  if (!phone || typeof body.isActive !== "boolean") {
    return NextResponse.json({ message: "전화번호와 상태값이 필요합니다." }, { status: 400 });
  }

  try {
    const row = await toggleAllowlist(phone, body.isActive);
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "수정 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json()) as { phone?: string; approve?: boolean };
  const phone = normalizePhoneNumber(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ message: "유효한 전화번호를 입력하세요." }, { status: 400 });
  }

  try {
    const row = await reviewSignupRequest({
      phone,
      approve: body.approve !== false,
      reviewerPhone: admin.phone,
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "승인 처리 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

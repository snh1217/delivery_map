import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { listDevelopmentRequests, updateDevelopmentRequest } from "@/lib/devRequests";

async function requireAdmin() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user?.isAdmin) {
    return null;
  }
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  try {
    const rows = await listDevelopmentRequests({ includeAll: true, limit: 100 });
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "개발 요청 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: "pending" | "reviewing" | "done";
    adminNote?: string | null;
  };

  if (!body.id || !body.status) {
    return NextResponse.json({ message: "id와 status가 필요합니다." }, { status: 400 });
  }

  try {
    const row = await updateDevelopmentRequest({
      id: body.id,
      status: body.status,
      adminNote: body.adminNote,
      reviewerPhone: admin.phone,
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "개발 요청 수정 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

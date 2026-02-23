import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { getAdminEarningsSummary } from "@/lib/earningsStore";

function isValidYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireAdmin() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user?.isAdmin) {
    return null;
  }
  return user;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

  if (!isValidYmd(from) || !isValidYmd(to)) {
    return NextResponse.json({ message: "from/to 형식은 YYYY-MM-DD 이어야 합니다." }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ message: "from은 to보다 클 수 없습니다." }, { status: 400 });
  }

  try {
    const payload = await getAdminEarningsSummary({ from, to });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 운임 통계 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}


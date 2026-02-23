import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";
import { getUserEarningsRange } from "@/lib/earningsStore";

function isValidYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const target = (url.searchParams.get("target") ?? "all").trim() || "all";

  if (!isValidYmd(from) || !isValidYmd(to)) {
    return NextResponse.json({ message: "from/to 형식은 YYYY-MM-DD 이어야 합니다." }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ message: "from은 to보다 클 수 없습니다." }, { status: 400 });
  }

  try {
    const payload = await getUserEarningsRange({
      ownerPhone: user.phone,
      from,
      to,
      target,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "운임 기간 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}


import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";

export async function getAllowedSessionUser() {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });
  return user?.isAllowed ? user : null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
}

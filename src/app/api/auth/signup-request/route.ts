import { NextResponse } from "next/server";
import { createSignupRequest } from "@/lib/auth/allowlist";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string; name?: string };
    const row = await createSignupRequest({
      phone: body.phone ?? "",
      name: body.name ?? "",
    });

    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "회원가입 요청 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

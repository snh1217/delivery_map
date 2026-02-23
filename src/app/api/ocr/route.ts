import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_PHONE_COOKIE, sessionUserFromCookies } from "@/lib/auth/allowlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const phone = store.get(AUTH_PHONE_COOKIE)?.value;
  const user = await sessionUserFromCookies({ phone });

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ message: "관리자만 OCR API를 사용할 수 있습니다." }, { status: 403 });
  }

  const provider = (process.env.OCR_PROVIDER || "tesseract").toLowerCase();
  if (provider === "tesseract") {
    return NextResponse.json(
      { message: "기본 OCR_PROVIDER=tesseract는 클라이언트 OCR을 사용합니다. 서버 OCR은 googlevision/clova 설정 시 사용하세요." },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ message: "이미지 파일이 필요합니다." }, { status: 400 });
  }

  // 서버 OCR provider 훅 (기본 비활성).
  // 개인정보 보호를 위해 저장하지 않고 요청 처리 후 즉시 폐기하는 구조만 제공합니다.
  if (provider === "googlevision" || provider === "clova") {
    return NextResponse.json(
      {
        message: `${provider} 서버 OCR provider 훅은 준비되어 있으나 현재 프로젝트에는 API 호출 키/구현이 연결되지 않았습니다.`,
      },
      { status: 501 },
    );
  }

  return NextResponse.json({ message: `지원하지 않는 OCR_PROVIDER: ${provider}` }, { status: 400 });
}


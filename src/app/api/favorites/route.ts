import { NextResponse } from "next/server";
import { getAllowedSessionUser, unauthorizedResponse } from "@/lib/auth/session";
import { listFavoriteAddresses, saveFavoriteAddress } from "@/lib/favoritesStore";

export async function GET() {
  const user = await getAllowedSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const rows = await listFavoriteAddresses(user.phone);
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "즐겨찾기 조회 실패";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAllowedSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const row = await saveFavoriteAddress({
      ownerPhone: user.phone,
      label: body.label,
      address: body.address,
      detail: body.detail,
      memo: body.memo,
      lat: body.lat,
      lon: body.lon,
    });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "즐겨찾기 저장 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

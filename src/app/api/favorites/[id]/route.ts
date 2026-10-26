import { NextResponse } from "next/server";
import { getAllowedSessionUser, unauthorizedResponse } from "@/lib/auth/session";
import { deleteFavoriteAddress, markFavoriteAddressUsed, updateFavoriteAddress } from "@/lib/favoritesStore";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAllowedSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const row =
      body.used === true
        ? await markFavoriteAddressUsed({ ownerPhone: user.phone, id })
        : await updateFavoriteAddress({
            ownerPhone: user.phone,
            id,
            label: body.label,
            detail: body.detail,
            memo: body.memo,
          });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "즐겨찾기 수정 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAllowedSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  try {
    await deleteFavoriteAddress({ ownerPhone: user.phone, id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "즐겨찾기 삭제 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

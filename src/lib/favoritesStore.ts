import type { FavoriteAddressRow } from "@/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const FAVORITE_SELECT =
  "id, owner_phone, label, address, detail, memo, lat, lon, use_count, last_used_at, created_at, updated_at";
const MAX_FAVORITES = 300;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanCoord(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export async function listFavoriteAddresses(ownerPhone: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("favorite_addresses")
    .select(FAVORITE_SELECT)
    .eq("owner_phone", ownerPhone)
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_FAVORITES);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as FavoriteAddressRow[];
}

// 같은 주소를 다시 저장하면 새로 만들지 않고 이름/상세/좌표를 갱신합니다.
export async function saveFavoriteAddress(params: {
  ownerPhone: string;
  label?: unknown;
  address?: unknown;
  detail?: unknown;
  memo?: unknown;
  lat?: unknown;
  lon?: unknown;
}) {
  const address = cleanText(params.address, 200);
  if (!address) {
    throw new Error("저장할 주소가 비어 있습니다.");
  }

  const row = {
    owner_phone: params.ownerPhone,
    address,
    label: cleanText(params.label, 60) ?? address,
    detail: cleanText(params.detail, 100),
    memo: cleanText(params.memo, 200),
    lat: cleanCoord(params.lat, -90, 90),
    lon: cleanCoord(params.lon, -180, 180),
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("favorite_addresses")
    .upsert(row, { onConflict: "owner_phone,address" })
    .select(FAVORITE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as FavoriteAddressRow;
}

export async function updateFavoriteAddress(params: {
  ownerPhone: string;
  id: string;
  label?: unknown;
  detail?: unknown;
  memo?: unknown;
}) {
  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (params.label !== undefined) {
    const label = cleanText(params.label, 60);
    if (!label) throw new Error("이름을 입력하세요.");
    patch.label = label;
  }
  if (params.detail !== undefined) patch.detail = cleanText(params.detail, 100);
  if (params.memo !== undefined) patch.memo = cleanText(params.memo, 200);

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("favorite_addresses")
    .update(patch)
    .eq("id", params.id)
    .eq("owner_phone", params.ownerPhone)
    .select(FAVORITE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as FavoriteAddressRow;
}

export async function markFavoriteAddressUsed(params: { ownerPhone: string; id: string }) {
  const supabase = getSupabaseServiceClient();
  const { data: current, error: readError } = await supabase
    .from("favorite_addresses")
    .select("use_count")
    .eq("id", params.id)
    .eq("owner_phone", params.ownerPhone)
    .single<{ use_count: number }>();
  if (readError) {
    throw new Error(readError.message);
  }

  const { data, error } = await supabase
    .from("favorite_addresses")
    .update({ use_count: (current?.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("owner_phone", params.ownerPhone)
    .select(FAVORITE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as FavoriteAddressRow;
}

export async function deleteFavoriteAddress(params: { ownerPhone: string; id: string }) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("favorite_addresses")
    .delete()
    .eq("id", params.id)
    .eq("owner_phone", params.ownerPhone);

  if (error) {
    throw new Error(error.message);
  }
}

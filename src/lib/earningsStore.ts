import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getKstYmd, MY_EARNING_TARGET_NAME, sanitizeDailyEarningItems, sumItems } from "@/lib/earnings";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { DailyEarningRow, EarningTargetRow } from "@/types";

function normalizedOwnerPhone(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error("유효한 전화번호가 아닙니다.");
  }
  return normalized;
}

function isMissingEarningsTable(errorMessage: string) {
  return (
    errorMessage.includes("earning_targets") ||
    errorMessage.includes("daily_earnings") ||
    errorMessage.includes("schema cache") ||
    errorMessage.includes("does not exist")
  );
}

export async function listEarningTargets(ownerPhone: string) {
  const phone = normalizedOwnerPhone(ownerPhone);
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("earning_targets")
    .select("id, owner_phone, target_name, is_active, created_at")
    .eq("owner_phone", phone)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingEarningsTable(error.message)) {
      return [] as EarningTargetRow[];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as EarningTargetRow[];
}

export async function createEarningTarget(params: { ownerPhone: string; targetName: string }) {
  const ownerPhone = normalizedOwnerPhone(params.ownerPhone);
  const targetName = params.targetName.trim().slice(0, 40);
  if (!targetName) {
    throw new Error("대상 이름을 입력하세요.");
  }
  if (targetName === MY_EARNING_TARGET_NAME) {
    throw new Error("'내 운임'은 기본 대상입니다.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("earning_targets")
    .upsert(
      {
        owner_phone: ownerPhone,
        target_name: targetName,
        is_active: true,
      },
      { onConflict: "owner_phone,target_name" },
    )
    .select("id, owner_phone, target_name, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EarningTargetRow;
}

export async function toggleEarningTarget(params: { ownerPhone: string; id: string; isActive: boolean }) {
  const ownerPhone = normalizedOwnerPhone(params.ownerPhone);
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("earning_targets")
    .update({ is_active: params.isActive })
    .eq("id", params.id)
    .eq("owner_phone", ownerPhone)
    .select("id, owner_phone, target_name, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EarningTargetRow;
}

async function assertTargetOwnership(params: { ownerPhone: string; targetId: string }) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("earning_targets")
    .select("id, target_name, is_active")
    .eq("id", params.targetId)
    .eq("owner_phone", params.ownerPhone)
    .maybeSingle<{ id: string; target_name: string; is_active: boolean }>();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("선택한 대상을 찾을 수 없습니다.");
  }
  return data;
}

export async function getTodayDailyEarning(params: {
  ownerPhone: string;
  targetName: string;
  targetId?: string | null;
}) {
  const ownerPhone = normalizedOwnerPhone(params.ownerPhone);
  let targetName = params.targetName.trim();
  let targetId: string | null = params.targetId ?? null;
  if (!targetName) {
    throw new Error("대상 이름이 필요합니다.");
  }

  if (targetName !== MY_EARNING_TARGET_NAME && targetId) {
    const owned = await assertTargetOwnership({ ownerPhone, targetId });
    targetName = owned.target_name;
  } else if (targetName === MY_EARNING_TARGET_NAME) {
    targetId = null;
  }

  const ymd = getKstYmd();
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("daily_earnings")
    .select("id, owner_phone, target_id, target_name, ymd, items, total_amount, updated_at, created_at")
    .eq("owner_phone", ownerPhone)
    .eq("ymd", ymd)
    .eq("target_name", targetName)
    .maybeSingle();

  if (error) {
    if (isMissingEarningsTable(error.message)) {
      return { ymd, row: null as DailyEarningRow | null };
    }
    throw new Error(error.message);
  }

  return {
    ymd,
    row: (data as DailyEarningRow | null) ?? null,
  };
}

export async function upsertTodayDailyEarning(params: {
  ownerPhone: string;
  targetName: string;
  targetId?: string | null;
  items: unknown[];
}) {
  const ownerPhone = normalizedOwnerPhone(params.ownerPhone);
  let targetName = params.targetName.trim().slice(0, 40);
  let targetId: string | null = params.targetId ?? null;
  if (!targetName) {
    throw new Error("대상 이름이 필요합니다.");
  }

  if (targetName === MY_EARNING_TARGET_NAME) {
    targetId = null;
    targetName = MY_EARNING_TARGET_NAME;
  } else {
    if (!targetId) {
      throw new Error("제3자 대상 저장에는 targetId가 필요합니다.");
    }
    const owned = await assertTargetOwnership({ ownerPhone, targetId });
    targetName = owned.target_name;
  }

  const items = sanitizeDailyEarningItems(Array.isArray(params.items) ? params.items : []);
  if (items.length === 0) {
    throw new Error("최소 1건 이상의 운임을 입력하세요.");
  }
  const totalAmount = sumItems(items);
  const ymd = getKstYmd();

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("daily_earnings")
    .upsert(
      {
        owner_phone: ownerPhone,
        target_id: targetId,
        target_name: targetName,
        ymd,
        items,
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_phone,ymd,target_name" },
    )
    .select("id, owner_phone, target_id, target_name, ymd, items, total_amount, updated_at, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DailyEarningRow;
}


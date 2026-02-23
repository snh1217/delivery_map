import { normalizePhoneNumber } from "@/lib/auth/phone";
import {
  getKstYmd,
  MY_EARNING_TARGET_NAME,
  sanitizeDailyEarningItems,
  sumNet,
} from "@/lib/earnings";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  AdminEarningsSummaryResponse,
  AdminEarningsUserDetailResponse,
  DailyEarningRow,
  EarningsRangeResponse,
  EarningTargetRow,
} from "@/types";

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

function normalizeDailyEarningRow(row: DailyEarningRow): DailyEarningRow {
  const items = sanitizeDailyEarningItems(Array.isArray(row.items) ? (row.items as unknown[]) : []);
  const total_amount = sumNet(items);
  return {
    ...row,
    items,
    total_amount,
  };
}

type DailyEarningDbRow = {
  id: string;
  owner_phone: string;
  target_id: string | null;
  target_name: string;
  ymd: string;
  items: unknown;
  total_amount: number;
  updated_at: string;
  created_at: string;
};

function normalizeRows(rows: DailyEarningDbRow[]): DailyEarningRow[] {
  return rows.map((row) => normalizeDailyEarningRow(row as DailyEarningRow));
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
    .maybeSingle<DailyEarningDbRow>();

  if (error) {
    if (isMissingEarningsTable(error.message)) {
      return { ymd, row: null as DailyEarningRow | null };
    }
    throw new Error(error.message);
  }

  return {
    ymd,
    row: data ? normalizeDailyEarningRow(data as unknown as DailyEarningRow) : null,
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
  const totalAmount = sumNet(items);
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
    .single<DailyEarningDbRow>();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeDailyEarningRow(data as unknown as DailyEarningRow);
}

async function listDailyEarningsForRange(params: {
  ownerPhone?: string;
  from: string;
  to: string;
  targetName?: string;
}) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("daily_earnings")
    .select("id, owner_phone, target_id, target_name, ymd, items, total_amount, updated_at, created_at")
    .gte("ymd", params.from)
    .lte("ymd", params.to)
    .order("ymd", { ascending: true })
    .order("target_name", { ascending: true });

  if (params.ownerPhone) {
    query = query.eq("owner_phone", params.ownerPhone);
  }
  if (params.targetName) {
    query = query.eq("target_name", params.targetName);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingEarningsTable(error.message)) {
      return [] as DailyEarningRow[];
    }
    throw new Error(error.message);
  }

  return normalizeRows((data ?? []) as DailyEarningDbRow[]);
}

function aggregateEarningsRange(rows: DailyEarningRow[], params: { from: string; to: string; target: string }): EarningsRangeResponse {
  const byDayMap = new Map<string, number>();
  const byTargetMap = new Map<string, number>();
  const rowSummaries = rows.map((row) => {
    const totalNet = Number.isFinite(row.total_amount) ? row.total_amount : sumNet(row.items);
    byDayMap.set(row.ymd, (byDayMap.get(row.ymd) ?? 0) + totalNet);
    byTargetMap.set(row.target_name, (byTargetMap.get(row.target_name) ?? 0) + totalNet);
    return {
      ymd: row.ymd,
      targetName: row.target_name,
      totalNet,
      itemsCount: Array.isArray(row.items) ? row.items.length : 0,
    };
  });

  const totalNet = rowSummaries.reduce((sum, row) => sum + row.totalNet, 0);
  const byDay = [...byDayMap.entries()]
    .map(([ymd, total]) => ({ ymd, totalNet: total }))
    .sort((a, b) => a.ymd.localeCompare(b.ymd));
  const byTarget = [...byTargetMap.entries()]
    .map(([targetName, total]) => ({ targetName, totalNet: total }))
    .sort((a, b) => b.totalNet - a.totalNet || a.targetName.localeCompare(b.targetName, "ko"));

  return {
    from: params.from,
    to: params.to,
    target: params.target,
    totalNet,
    byDay,
    byTarget,
    rows: rowSummaries.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.targetName.localeCompare(b.targetName, "ko")),
  };
}

export async function getUserEarningsRange(params: {
  ownerPhone: string;
  from: string;
  to: string;
  target: "all" | "me" | string;
}): Promise<EarningsRangeResponse> {
  const ownerPhone = normalizedOwnerPhone(params.ownerPhone);
  const targetName = params.target === "all" ? undefined : params.target === "me" ? MY_EARNING_TARGET_NAME : params.target;
  const rows = await listDailyEarningsForRange({ ownerPhone, from: params.from, to: params.to, targetName });
  return aggregateEarningsRange(rows, { from: params.from, to: params.to, target: params.target });
}

export async function getAdminEarningsSummary(params: { from: string; to: string }): Promise<AdminEarningsSummaryResponse> {
  const rows = await listDailyEarningsForRange({ from: params.from, to: params.to });
  const byUser = new Map<string, { totalNet: number; ymdSet: Set<string>; entriesCount: number }>();
  let totalNet = 0;

  for (const row of rows) {
    totalNet += row.total_amount;
    const entry = byUser.get(row.owner_phone) ?? { totalNet: 0, ymdSet: new Set<string>(), entriesCount: 0 };
    entry.totalNet += row.total_amount;
    entry.ymdSet.add(row.ymd);
    entry.entriesCount += 1;
    byUser.set(row.owner_phone, entry);
  }

  return {
    from: params.from,
    to: params.to,
    totalNet,
    byUser: [...byUser.entries()]
      .map(([phone, value]) => ({
        phone,
        totalNet: value.totalNet,
        daysUsed: value.ymdSet.size,
        entriesCount: value.entriesCount,
      }))
      .sort((a, b) => b.totalNet - a.totalNet || b.entriesCount - a.entriesCount || a.phone.localeCompare(b.phone)),
  };
}

export async function getAdminEarningsUserDetail(params: {
  phone: string;
  from: string;
  to: string;
}): Promise<AdminEarningsUserDetailResponse> {
  const ownerPhone = normalizedOwnerPhone(params.phone);
  const range = await getUserEarningsRange({ ownerPhone, from: params.from, to: params.to, target: "all" });
  return {
    phone: ownerPhone,
    from: range.from,
    to: range.to,
    totalNet: range.totalNet,
    byDay: range.byDay,
    byTarget: range.byTarget,
    rows: range.rows,
  };
}

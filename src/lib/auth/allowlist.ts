import type {
  AllowlistRow,
  DailyUsageSummary,
  LoginLogRow,
  RouteRunRow,
  RouteRunStop,
  SessionUser,
  SignupRequestRow,
} from "@/types";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { notifyAdminSignupRequest } from "@/lib/notify/adminNotify";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const AUTH_PHONE_COOKIE = "qs_auth_phone";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

function isRouteRunsTableMissingError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? "";
  return (
    message.includes("public.route_runs") ||
    message.includes("route_runs") && message.includes("schema cache") ||
    message.includes('relation "route_runs" does not exist')
  );
}

export function sessionMaxAgeSeconds() {
  return SESSION_MAX_AGE;
}

export function adminPhone() {
  return normalizePhoneNumber(process.env.ADMIN_PHONE ?? "") ?? "";
}

export function isAdminPhone(phone: string) {
  return adminPhone() !== "" && adminPhone() === phone;
}

export async function checkAllowlist(phone: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("allowlist")
    .select("phone, is_active")
    .eq("phone", phone)
    .maybeSingle<{ phone: string; is_active: boolean }>();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.is_active);
}

export async function insertLoginLog(phone: string, userAgent?: string | null) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("login_logs").insert({
    phone,
    user_agent: userAgent ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPhoneSession(params: { phone: string; userAgent?: string | null }) {
  const phone = normalizePhoneNumber(params.phone);
  if (!phone) {
    throw new Error("유효한 전화번호를 입력하세요.");
  }

  const allowed = await checkAllowlist(phone);
  if (!allowed) {
    return {
      ok: false as const,
      user: {
        phone,
        isAdmin: false,
        isAllowed: false,
      } satisfies SessionUser,
    };
  }

  await insertLoginLog(phone, params.userAgent);

  return {
    ok: true as const,
    user: {
      phone,
      isAdmin: isAdminPhone(phone),
      isAllowed: true,
    } satisfies SessionUser,
    maxAge: SESSION_MAX_AGE,
    phone,
  };
}

export async function sessionUserFromCookies(payload: {
  phone?: string;
}): Promise<SessionUser | null> {
  const phone = normalizePhoneNumber(payload.phone ?? "");
  if (!phone) {
    return null;
  }

  try {
    const allowed = await checkAllowlist(phone);
    if (!allowed) {
      return null;
    }

    return {
      phone,
      isAdmin: isAdminPhone(phone),
      isAllowed: true,
    };
  } catch {
    return null;
  }
}

export async function listAllowlist(activeOnly = false) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("allowlist")
    .select("phone, is_active, created_at")
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AllowlistRow[];
}

export async function upsertAllowlist(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error("유효한 전화번호를 입력하세요.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("allowlist")
    .upsert({ phone: normalized, is_active: true }, { onConflict: "phone" })
    .select("phone, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AllowlistRow;
}

export async function toggleAllowlist(phone: string, isActive: boolean) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error("유효한 전화번호를 입력하세요.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("allowlist")
    .update({ is_active: isActive })
    .eq("phone", normalized)
    .select("phone, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AllowlistRow;
}

export async function listLoginLogs(limit = 50) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("login_logs")
    .select("id, phone, created_at, user_agent")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LoginLogRow[];
}

export async function createSignupRequest(params: { phone: string; name: string }) {
  const phone = normalizePhoneNumber(params.phone);
  const name = params.name.trim();
  if (!phone) {
    throw new Error("유효한 전화번호를 입력하세요.");
  }
  if (!name) {
    throw new Error("이름을 입력하세요.");
  }

  const supabase = getSupabaseServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("signup_requests")
    .select("phone, status")
    .eq("phone", phone)
    .maybeSingle<{ phone: string; status: SignupRequestRow["status"] }>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const { data, error } = await supabase
    .from("signup_requests")
    .upsert(
      {
        phone,
        name,
        status: "pending",
        reviewed_at: null,
        reviewed_by: null,
      },
      { onConflict: "phone" },
    )
    .select("phone, name, status, created_at, reviewed_at, reviewed_by")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as SignupRequestRow;
  const shouldNotify = !existing || existing.status !== "pending";

  if (shouldNotify) {
    void notifyAdminSignupRequest({
      phone: row.phone,
      name: row.name,
      createdAt: row.created_at,
    }).catch((notifyError) => {
      console.error("[signup-request] admin notification failed:", notifyError);
    });
  }

  return row;
}

export async function listSignupRequests(status?: "pending" | "approved" | "rejected") {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("signup_requests")
    .select("phone, name, status, created_at, reviewed_at, reviewed_by")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SignupRequestRow[];
}

export async function reviewSignupRequest(params: {
  phone: string;
  approve: boolean;
  reviewerPhone: string;
}) {
  const phone = normalizePhoneNumber(params.phone);
  const reviewerPhone = normalizePhoneNumber(params.reviewerPhone);
  if (!phone || !reviewerPhone) {
    throw new Error("전화번호 형식이 올바르지 않습니다.");
  }

  const supabase = getSupabaseServiceClient();
  const status = params.approve ? "approved" : "rejected";

  const { data: existing, error: existingError } = await supabase
    .from("signup_requests")
    .select("phone, name")
    .eq("phone", phone)
    .maybeSingle<{ phone: string; name: string }>();
  if (existingError) {
    throw new Error(existingError.message);
  }

  if (params.approve) {
    const { error: allowlistError } = await supabase
      .from("allowlist")
      .upsert({ phone, is_active: true }, { onConflict: "phone" });
    if (allowlistError) {
      throw new Error(allowlistError.message);
    }
  }

  const { data, error } = await supabase
    .from("signup_requests")
    .upsert(
      {
        phone,
        name: existing?.name ?? "미기재",
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerPhone,
      },
      { onConflict: "phone" },
    )
    .select("phone, name, status, created_at, reviewed_at, reviewed_by")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SignupRequestRow;
}

export async function insertRouteRun(params: {
  phone: string;
  provider: "naver" | "kakao";
  batchLabel?: string | null;
  finalShortList?: string[];
  routeStops?: RouteRunStop[];
}): Promise<RouteRunRow | null> {
  const phone = normalizePhoneNumber(params.phone);
  if (!phone) {
    throw new Error("유효한 전화번호가 아닙니다.");
  }

  const finalShortList = (params.finalShortList ?? []).filter(Boolean);
  const routeStops = (params.routeStops ?? []).slice(0, 50);

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("route_runs")
    .insert({
      phone,
      provider: params.provider,
      batch_label: params.batchLabel ?? null,
      destination_count: routeStops.length,
      final_short_list: finalShortList.length ? finalShortList : null,
      final_short_list_text: finalShortList.length ? finalShortList.join(", ") : null,
      route_stops: routeStops,
    })
    .select("id, phone, created_at, provider, batch_label, destination_count, final_short_list, final_short_list_text, route_stops")
    .single();

  if (error) {
    if (isRouteRunsTableMissingError(new Error(error.message))) {
      return null;
    }
    throw new Error(error.message);
  }

  return data as RouteRunRow;
}

function kstDayRange(targetDate?: Date) {
  const base = targetDate ?? new Date();
  const kstNow = new Date(base.getTime() + 9 * 60 * 60 * 1000);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  const startKstUtc = Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
  const endKstUtc = startKstUtc + 24 * 60 * 60 * 1000;
  const dateKst = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return {
    dateKst,
    startIso: new Date(startKstUtc).toISOString(),
    endIso: new Date(endKstUtc).toISOString(),
  };
}

export async function listUserRouteRunsToday(phone: string, limit = 50) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error("유효한 전화번호가 아닙니다.");
  }

  const range = kstDayRange();
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("route_runs")
    .select("id, phone, created_at, provider, batch_label, destination_count, final_short_list, final_short_list_text, route_stops")
    .eq("phone", normalized)
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isRouteRunsTableMissingError(new Error(error.message))) {
      return {
        dateKst: range.dateKst,
        runs: [] as RouteRunRow[],
      };
    }
    throw new Error(error.message);
  }

  return {
    dateKst: range.dateKst,
    runs: ((data ?? []) as RouteRunRow[]).map((row) => ({
      ...row,
      route_stops: Array.isArray(row.route_stops) ? row.route_stops : [],
      final_short_list: Array.isArray(row.final_short_list) ? row.final_short_list : [],
    })),
  };
}

export async function getDailyUsageSummaryToday(): Promise<DailyUsageSummary> {
  const range = kstDayRange();
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("route_runs")
    .select("phone, created_at, destination_count")
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso)
    .order("created_at", { ascending: false });

  if (error) {
    if (isRouteRunsTableMissingError(new Error(error.message))) {
      return {
        dateKst: range.dateKst,
        totalRuns: 0,
        uniqueUsers: 0,
        totalDestinations: 0,
        users: [],
      };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ phone: string; created_at: string; destination_count: number }>;
  const byPhone = new Map<string, { runCount: number; destinationCount: number; latestAt: string }>();
  for (const row of rows) {
    const entry = byPhone.get(row.phone);
    if (!entry) {
      byPhone.set(row.phone, {
        runCount: 1,
        destinationCount: Math.max(0, row.destination_count ?? 0),
        latestAt: row.created_at,
      });
      continue;
    }
    entry.runCount += 1;
    entry.destinationCount += Math.max(0, row.destination_count ?? 0);
    if (row.created_at > entry.latestAt) {
      entry.latestAt = row.created_at;
    }
  }

  const users = [...byPhone.entries()]
    .map(([phone, value]) => ({ phone, ...value }))
    .sort((a, b) => b.runCount - a.runCount || b.destinationCount - a.destinationCount || a.phone.localeCompare(b.phone));

  return {
    dateKst: range.dateKst,
    totalRuns: rows.length,
    uniqueUsers: byPhone.size,
    totalDestinations: rows.reduce((sum, row) => sum + Math.max(0, row.destination_count ?? 0), 0),
    users,
  };
}

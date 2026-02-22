import type { AllowlistRow, LoginLogRow, SessionUser, SignupRequestRow } from "@/types";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const AUTH_PHONE_COOKIE = "qs_auth_phone";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

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

  return data as SignupRequestRow;
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

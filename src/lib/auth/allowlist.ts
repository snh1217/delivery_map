import type { AuthProviderType, SessionUser } from "@/types";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getSupabaseAuthVerifyClient, getSupabaseServiceClient } from "@/lib/supabase/server";

export const AUTH_PROVIDER_COOKIE = "qs_auth_provider";
export const AUTH_TOKEN_COOKIE = "qs_auth_token";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

export function adminPhone() {
  return (process.env.ADMIN_PHONE ?? "").trim();
}

export function isAdminPhone(phone: string) {
  return adminPhone() !== "" && adminPhone() === phone;
}

export async function getPhoneFromToken(provider: AuthProviderType, token: string) {
  if (provider === "firebase") {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token, true);
    const phone = decoded.phone_number;
    if (!phone) {
      throw new Error("Firebase token에 phone_number가 없습니다.");
    }

    return phone;
  }

  const client = getSupabaseAuthVerifyClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.phone) {
    throw new Error(error?.message ?? "Supabase 토큰 검증 실패");
  }

  return data.user.phone;
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
  await supabase.from("login_logs").insert({
    phone,
    user_agent: userAgent ?? null,
  });
}

export async function validateAndBuildSession(params: {
  provider: AuthProviderType;
  token: string;
  userAgent?: string | null;
}) {
  const phone = await getPhoneFromToken(params.provider, params.token);
  const allowed = await checkAllowlist(phone);

  if (!allowed) {
    return {
      ok: false as const,
      user: {
        phone,
        isAdmin: false,
        provider: params.provider,
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
      provider: params.provider,
      isAllowed: true,
    } satisfies SessionUser,
    maxAge: SESSION_MAX_AGE,
    token: params.token,
  };
}

export async function sessionUserFromCookies(payload: {
  provider?: string;
  token?: string;
}): Promise<SessionUser | null> {
  const provider = payload.provider === "firebase" ? "firebase" : payload.provider === "supabase" ? "supabase" : null;
  if (!provider || !payload.token) {
    return null;
  }

  try {
    const phone = await getPhoneFromToken(provider, payload.token);
    const allowed = await checkAllowlist(phone);
    if (!allowed) {
      return null;
    }

    return {
      phone,
      isAdmin: isAdminPhone(phone),
      provider,
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

  return data ?? [];
}

export async function upsertAllowlist(phone: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("allowlist")
    .upsert({ phone, is_active: true }, { onConflict: "phone" })
    .select("phone, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function toggleAllowlist(phone: string, isActive: boolean) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("allowlist")
    .update({ is_active: isActive })
    .eq("phone", phone)
    .select("phone, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
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

  return data ?? [];
}

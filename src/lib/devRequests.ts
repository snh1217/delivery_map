import type { DevelopmentRequestRow } from "@/types";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { notifyAdminDevelopmentRequest } from "@/lib/notify/adminNotify";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function listDevelopmentRequests(params: {
  phone?: string;
  includeAll?: boolean;
  limit?: number;
}) {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("development_requests")
    .select("id, owner_phone, title, body, status, admin_note, created_at, updated_at, reviewed_at, reviewed_by")
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (!params.includeAll) {
    const phone = normalizePhoneNumber(params.phone ?? "");
    if (!phone) {
      throw new Error("전화번호가 필요합니다.");
    }
    query = query.eq("owner_phone", phone);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DevelopmentRequestRow[];
}

export async function createDevelopmentRequest(params: {
  phone: string;
  title: string;
  body: string;
}) {
  const phone = normalizePhoneNumber(params.phone);
  const title = params.title.trim().slice(0, 80);
  const body = params.body.trim().slice(0, 2000);

  if (!phone) {
    throw new Error("전화번호가 필요합니다.");
  }
  if (!title) {
    throw new Error("제목을 입력하세요.");
  }
  if (!body) {
    throw new Error("요청 내용을 입력하세요.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("development_requests")
    .insert({
      owner_phone: phone,
      title,
      body,
      status: "pending",
    })
    .select("id, owner_phone, title, body, status, admin_note, created_at, updated_at, reviewed_at, reviewed_by")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as DevelopmentRequestRow;

  void notifyAdminDevelopmentRequest({
    phone: row.owner_phone,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  }).catch(() => {});

  return row;
}

export async function updateDevelopmentRequest(params: {
  id: string;
  status: DevelopmentRequestRow["status"];
  adminNote?: string | null;
  reviewerPhone: string;
}) {
  const reviewerPhone = normalizePhoneNumber(params.reviewerPhone);
  if (!reviewerPhone) {
    throw new Error("관리자 전화번호가 필요합니다.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("development_requests")
    .update({
      status: params.status,
      admin_note: params.adminNote?.trim() ? params.adminNote.trim().slice(0, 1000) : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerPhone,
    })
    .eq("id", params.id)
    .select("id, owner_phone, title, body, status, admin_note, created_at, updated_at, reviewed_at, reviewed_by")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DevelopmentRequestRow;
}

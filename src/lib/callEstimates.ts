import type { CallEstimateHistoryRow, RouteCallEstimateLeg } from "@/types";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function listCallEstimateHistory(phone: string, limit = 10) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    throw new Error("전화번호가 필요합니다.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("call_time_estimates")
    .select(
      "id, phone, created_at, call_time, deadline_label, longest_leg_min, adjusted_drive_min, pickup_min, total_required_min, reference_leg, route_legs",
    )
    .eq("phone", normalized)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    ...(row as Omit<CallEstimateHistoryRow, "route_legs">),
    route_legs: Array.isArray(row.route_legs) ? (row.route_legs as RouteCallEstimateLeg[]) : [],
  })) as CallEstimateHistoryRow[];
}

export async function insertCallEstimateHistory(params: {
  phone: string;
  callTime: string;
  deadlineLabel: string;
  longestLegMin: number;
  adjustedDriveMin: number;
  pickupMin: number;
  totalRequiredMin: number;
  referenceLeg: string;
  routeLegs: RouteCallEstimateLeg[];
}) {
  const normalized = normalizePhoneNumber(params.phone);
  if (!normalized) {
    throw new Error("전화번호가 필요합니다.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("call_time_estimates")
    .insert({
      phone: normalized,
      call_time: params.callTime,
      deadline_label: params.deadlineLabel,
      longest_leg_min: params.longestLegMin,
      adjusted_drive_min: params.adjustedDriveMin,
      pickup_min: params.pickupMin,
      total_required_min: params.totalRequiredMin,
      reference_leg: params.referenceLeg,
      route_legs: params.routeLegs,
    })
    .select(
      "id, phone, created_at, call_time, deadline_label, longest_leg_min, adjusted_drive_min, pickup_min, total_required_min, reference_leg, route_legs",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...(data as Omit<CallEstimateHistoryRow, "route_legs">),
    route_legs: Array.isArray(data.route_legs) ? (data.route_legs as RouteCallEstimateLeg[]) : [],
  } as CallEstimateHistoryRow;
}

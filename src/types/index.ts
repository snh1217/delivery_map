import type { Feature, MultiPolygon, Polygon } from "geojson";

export type AuthProviderType = "supabase" | "firebase";

export type LatLng = {
  lat: number;
  lon: number;
};

export type GeocodeItem = {
  title: string;
  address: string;
  lat: number;
  lon: number;
};

export type DestinationRowState = {
  id: string;
  input: string;
  status: "idle" | "loading" | "resolved" | "error";
  error?: string;
  geocodeItems: GeocodeItem[];
  selectedIndex: number;
  coord?: LatLng;
  label?: string;
};

export type SettingsState = {
  halfAngleDeg: number;
  forwardBufferKm: number;
  backwardTailKm: number;
  forwardRadiusMinKm: number;
  arcSteps: number;
  autoSearch: boolean;
  viewMode: "segment" | "all";
  navigationApp: "naver" | "kakao" | "kakaonavi";
};

export type DongCentroid = {
  sido: string;
  sigungu: string;
  dong: string;
  short2: string;
  lat: number;
  lon: number;
};

export type SegmentResult = {
  index: number;
  polygon: Feature<Polygon | MultiPolygon>;
  fromLabel: string;
  toLabel: string;
  dongs: DongCentroid[];
};

export type RouteRecommendationItem = {
  step: number;
  rowIndex: number;
  label: string;
  distanceKm: number;
  cumulativeKm: number;
  durationMin?: number;
  cumulativeDurationMin?: number;
};

export type RouteRecommendationMode = "straight" | "road";

export type SessionUser = {
  phone: string;
  isAdmin: boolean;
  isAllowed: boolean;
};

export type AllowlistRow = {
  phone: string;
  is_active: boolean;
  created_at: string;
};

export type LoginLogRow = {
  id: string;
  phone: string;
  created_at: string;
  user_agent: string | null;
};

export type RouteRunStop = {
  step: number;
  rowIndex: number;
  name: string;
  lat: number;
  lon: number;
  distanceKm?: number;
  durationMin?: number;
  cumulativeKm?: number;
  cumulativeDurationMin?: number;
};

export type RouteRunRow = {
  id: string;
  phone: string;
  created_at: string;
  provider: "naver" | "kakao" | "kakaonavi";
  batch_label: string | null;
  destination_count: number;
  final_short_list: string[] | null;
  final_short_list_text: string | null;
  route_stops: RouteRunStop[] | null;
};

export type DailyUsageUserStat = {
  phone: string;
  runCount: number;
  destinationCount: number;
  latestAt: string;
};

export type DailyUsageSummary = {
  dateKst: string;
  totalRuns: number;
  uniqueUsers: number;
  totalDestinations: number;
  users: DailyUsageUserStat[];
};

export type EarningTargetRow = {
  id: string;
  owner_phone: string;
  target_name: string;
  is_active: boolean;
  created_at: string;
};

export type DailyEarningItem = {
  amount_gross: number;
  is_logi: boolean;
  amount_net: number;
  memo?: string;
  createdAt?: string;
};

export type LegacyDailyEarningItem = {
  amount: number;
  memo?: string;
  createdAt?: string;
};

export type DailyEarningRow = {
  id: string;
  owner_phone: string;
  target_id: string | null;
  target_name: string;
  ymd: string;
  items: DailyEarningItem[];
  total_amount: number;
  updated_at: string;
  created_at: string;
};

export type EarningsRangeByDay = {
  ymd: string;
  totalNet: number;
};

export type EarningsRangeByTarget = {
  targetName: string;
  totalNet: number;
};

export type EarningsRangeRowSummary = {
  ymd: string;
  targetName: string;
  totalNet: number;
  itemsCount: number;
};

export type EarningsRangeResponse = {
  from: string;
  to: string;
  target: string;
  totalNet: number;
  byDay: EarningsRangeByDay[];
  byTarget: EarningsRangeByTarget[];
  rows: EarningsRangeRowSummary[];
};

export type AdminEarningsUserSummary = {
  phone: string;
  totalNet: number;
  daysUsed: number;
  entriesCount: number;
};

export type AdminEarningsSummaryResponse = {
  from: string;
  to: string;
  totalNet: number;
  byUser: AdminEarningsUserSummary[];
};

export type AdminEarningsUserDetailResponse = {
  phone: string;
  from: string;
  to: string;
  totalNet: number;
  byDay: EarningsRangeByDay[];
  byTarget: EarningsRangeByTarget[];
  rows: EarningsRangeRowSummary[];
};

export type SignupRequestStatus = "pending" | "approved" | "rejected";

export type SignupRequestRow = {
  phone: string;
  name: string;
  status: SignupRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type DevelopmentRequestStatus = "pending" | "reviewing" | "done";

export type DevelopmentRequestRow = {
  id: string;
  owner_phone: string;
  title: string;
  body: string;
  status: DevelopmentRequestStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type RouteCallEstimateLeg = {
  fromLabel: string;
  toLabel: string;
  distanceKm: number | null;
  durationMin: number | null;
};

export type RouteCallEstimateResult = {
  longestLegMin: number;
  adjustedDriveMin: number;
  pickupMin: number;
  totalRequiredMin: number;
  deadlineLabel: string;
  referenceLeg: string;
  legs: RouteCallEstimateLeg[];
};

export type CallEstimateHistoryRow = {
  id: string;
  phone: string;
  created_at: string;
  call_time: string;
  deadline_label: string;
  longest_leg_min: number;
  adjusted_drive_min: number;
  pickup_min: number;
  total_required_min: number;
  reference_leg: string;
  route_legs: RouteCallEstimateLeg[];
};

export type CallTimeEntry = {
  id: string;
  time: string;
};

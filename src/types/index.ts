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
  navigationApp: "naver" | "kakao";
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
  provider: "naver" | "kakao";
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

export type SignupRequestStatus = "pending" | "approved" | "rejected";

export type SignupRequestRow = {
  phone: string;
  name: string;
  status: SignupRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

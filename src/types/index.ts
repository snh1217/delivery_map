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

export type SessionUser = {
  phone: string;
  isAdmin: boolean;
  provider: AuthProviderType;
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

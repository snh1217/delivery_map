"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DestinationList } from "@/components/DestinationList";
import { EarningsFab } from "@/components/EarningsFab";
import { EarningsStatsFab } from "@/components/EarningsStatsFab";
import { ResultPanel } from "@/components/ResultPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { NativePermissionStatus } from "@/components/app/NativePermissionStatus";
import centroidsRaw from "@/data/dong_centroids.json";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { normalizeDongCentroids } from "@/lib/dong";
import { calculateSegments, makeFinalDongDisplayEntries, makeFinalDongDisplayList, recommendVisitOrder } from "@/lib/geo";
import { addNativeResumeListener } from "@/lib/native/app";
import { getCurrentLocation, watchCurrentLocation, type NativeLocationWatchHandle } from "@/lib/native/geolocation";
import { isNativeApp } from "@/lib/native/runtime";
import {
  openNaverDirections,
  openNaverMultiDirections,
  type NaverDirectionLinkSet,
  type RoutePoint,
} from "@/lib/naverDeepLink";
import {
  openKakaoMapDirections,
  openKakaoMapMultiDirections,
  type KakaoDirectionLinkSet,
} from "@/lib/kakaoDeepLink";
import {
  createKakaoNaviInstallLinks,
  detectKakaoNaviCapability,
  openKakaoNaviDirections,
  openKakaoNaviMultiDirections,
  type KakaoNaviCapability,
  type KakaoNaviInstallLinks,
} from "@/lib/kakao/navi";
import { loadRouteUiSnapshot, persistRouteUiSnapshot, ROUTE_UI_SNAPSHOT_TTL_MS, type RouteUiSnapshot } from "@/lib/routeUiSnapshot";
import { searchNaverGeocode } from "@/lib/naverGeocode";
import { consumePendingOcrDestination } from "@/lib/ocr/pendingDestination";
import type { OcrTransferRow } from "@/types";
import type {
  DevelopmentRequestRow,
  DestinationRowState,
  GeocodeItem,
  LatLng,
  RouteCallEstimateResult,
  RouteRunRow,
  RouteRunStop,
  RouteRecommendationItem,
  RouteRecommendationMode,
  SessionUser,
  SettingsState,
} from "@/types";

const NaverMap = dynamic(() => import("@/components/NaverMap").then((m) => m.NaverMap), { ssr: false });
const EarningsModal = dynamic(() => import("@/components/EarningsModal").then((m) => m.EarningsModal), { ssr: false });
const EarningsStatsModal = dynamic(
  () => import("@/components/EarningsStatsModal").then((m) => m.EarningsStatsModal),
  { ssr: false },
);
const IosPwaHint = dynamic(() => import("@/components/app/IosPwaHint").then((m) => m.IosPwaHint), { ssr: false });

const DEFAULT_ORIGIN: LatLng = { lat: 37.5665, lon: 126.978 };
const MAX_DESTINATIONS = 20;
const SETTINGS_STORAGE_KEY = "delivery_map_settings_v1";
const ROUTE_UNDO_STORAGE_KEY = "delivery_map_route_undo_v1";
const IOS_SAFE_MODE_STORAGE_KEY = "delivery_map_ios_safe_mode_v1";
const OCR_TRANSFER_AUTO_APPLY_STORAGE_KEY = "delivery_map_ocr_transfer_auto_apply_v1";
const MAIN_APP_LATEST_VERSION = process.env.NEXT_PUBLIC_ANDROID_LATEST_VERSION?.trim() || "1.0.1";
const EXTRACTOR_APP_LATEST_VERSION = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_LATEST_VERSION?.trim() || "1.0.5-extractor";
const ATTACHMENT_ALLOWED_PHONES = new Set(
  ["01037986217", "01031446217"]
    .map((value) => normalizePhoneNumber(value))
    .filter((value): value is string => Boolean(value)),
);
const DEFAULT_SETTINGS: SettingsState = {
  halfAngleDeg: 30,
  forwardBufferKm: 3,
  backwardTailKm: 5,
  forwardRadiusMinKm: 2,
  arcSteps: 72,
  autoSearch: false,
  viewMode: "segment",
  navigationApp: "naver",
};

function getNavigationAppLabel(app: SettingsState["navigationApp"]) {
  if (app === "kakao") return "카카오";
  if (app === "kakaonavi") return "카카오내비";
  return "네이버";
}

function getRouteRunProviderLabel(provider: "naver" | "kakao" | "kakaonavi") {
  if (provider === "kakao") return "카카오";
  if (provider === "kakaonavi") return "카카오내비";
  return "네이버";
}

function sanitizeSettings(raw: Partial<SettingsState> | null | undefined): SettingsState {
  return {
    halfAngleDeg: Number.isFinite(raw?.halfAngleDeg) ? Math.min(80, Math.max(5, Number(raw?.halfAngleDeg))) : 30,
    forwardBufferKm:
      Number.isFinite(raw?.forwardBufferKm) ? Math.min(30, Math.max(0, Number(raw?.forwardBufferKm))) : 3,
    backwardTailKm:
      Number.isFinite(raw?.backwardTailKm) ? Math.min(30, Math.max(0, Number(raw?.backwardTailKm))) : 5,
    forwardRadiusMinKm:
      Number.isFinite(raw?.forwardRadiusMinKm) ? Math.min(20, Math.max(0.5, Number(raw?.forwardRadiusMinKm))) : 2,
    arcSteps: Number.isFinite(raw?.arcSteps) ? Math.min(128, Math.max(24, Number(raw?.arcSteps))) : 72,
    autoSearch: Boolean(raw?.autoSearch),
    viewMode: raw?.viewMode === "all" ? "all" : "segment",
    navigationApp:
      raw?.navigationApp === "kakao" || raw?.navigationApp === "kakaonavi" ? raw.navigationApp : "naver",
  };
}

function loadSavedSettings(): SettingsState {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return sanitizeSettings(JSON.parse(raw) as Partial<SettingsState>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadRouteUndoState(): { stack: DestinationRowState[][]; message: string | null } {
  if (typeof window === "undefined") {
    return { stack: [], message: null };
  }

  try {
    const raw = window.sessionStorage.getItem(ROUTE_UNDO_STORAGE_KEY);
    if (!raw) {
      return { stack: [], message: null };
    }

    const parsed = JSON.parse(raw) as {
      stack?: unknown;
      message?: unknown;
    };

    const stack = Array.isArray(parsed?.stack)
      ? parsed.stack
          .filter((snapshot): snapshot is Array<Partial<DestinationRowState>> => Array.isArray(snapshot))
          .map((snapshot) => snapshot.map((row) => hydrateRow(row)))
      : [];

    const message = typeof parsed?.message === "string" ? parsed.message : null;

    return { stack, message };
  } catch {
    return { stack: [], message: null };
  }
}

function detectIosLikeBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;
  const isIOSDevice = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(platform) && touchPoints > 1);
  return isIOSDevice;
}

function detectIosChrome() {
  if (typeof navigator === "undefined") return false;
  return /CriOS/i.test(navigator.userAgent || "");
}

function loadIosSafeModeDefault() {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem(IOS_SAFE_MODE_STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    // ignore storage errors
  }
  return detectIosChrome();
}

function createRow(): DestinationRowState {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    input: "",
    status: "idle",
    geocodeItems: [],
    selectedIndex: 0,
    callTime: getCurrentKstTimeValue(),
    callOriginInput: "",
    callOriginStatus: "idle",
    callEstimate: null,
    callEstimateLoading: false,
    callEstimateError: undefined,
  };
}

function hydrateRow(row: Partial<DestinationRowState> | null | undefined): DestinationRowState {
  return {
    ...createRow(),
    ...row,
    callTime: typeof row?.callTime === "string" ? row.callTime : getCurrentKstTimeValue(),
    callOriginInput: typeof row?.callOriginInput === "string" ? row.callOriginInput : "",
    callOriginStatus: row?.callOriginStatus ?? "idle",
    callOriginCoord: row?.callOriginCoord,
    callOriginLabel: row?.callOriginLabel,
    callOriginError: row?.callOriginError,
    callEstimate: row?.callEstimate ?? null,
    callEstimateLoading: Boolean(row?.callEstimateLoading),
    callEstimateError: row?.callEstimateError,
    geocodeItems: Array.isArray(row?.geocodeItems) ? row.geocodeItems : [],
    selectedIndex: typeof row?.selectedIndex === "number" ? row.selectedIndex : 0,
  };
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getCurrentKstTimeValue() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hours = String(kst.getUTCHours()).padStart(2, "0");
  const minutes = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addMinutesToKstTime(baseTime: string, minutesToAdd: number) {
  const [hoursRaw, minutesRaw] = baseTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "-";
  }

  const total = hours * 60 + minutes + minutesToAdd;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const outHours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const outMinutes = String(normalized % 60).padStart(2, "0");
  return `${outHours}:${outMinutes}`;
}

function distanceMeters(a: LatLng, b: LatLng) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function syncViewportCssVar() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-vh", `${viewportHeight * 0.01}px`);
}

function applyGeocode(row: DestinationRowState, item: GeocodeItem, index: number) {
  return {
    ...row,
    status: "resolved" as const,
    selectedIndex: index,
    coord: { lat: item.lat, lon: item.lon },
    label: item.title,
    error: undefined,
    callEstimate: null,
    callEstimateError: undefined,
    callEstimateLoading: false,
  };
}

function isReusableEmptyRow(row: DestinationRowState) {
  return !row.input.trim() && !row.coord && row.geocodeItems.length === 0;
}

type Props = {
  sessionUser: SessionUser | null;
};

type DirectionsApiResponse = {
  raw?: {
    route?: Record<string, Array<{ summary?: { distance?: number; duration?: number } }>>;
  };
};

type OrderedRouteStop = RoutePoint & {
  rowId: string;
  rowIndex: number;
};

export function DeliveryMapApp({ sessionUser }: Props) {
  const router = useRouter();
  const [origin, setOrigin] = useState<LatLng>(DEFAULT_ORIGIN);
  const [locationStatus, setLocationStatus] = useState("내 위치를 확인하는 중입니다...");
  const [locationSyncing, setLocationSyncing] = useState(false);
  const [locationWatching, setLocationWatching] = useState(false);
  const [rows, setRows] = useState<DestinationRowState[]>([createRow()]);
  const [settings, setSettings] = useState<SettingsState>(loadSavedSettings);
  const [storeModal, setStoreModal] = useState<
    (NaverDirectionLinkSet | KakaoDirectionLinkSet | KakaoNaviInstallLinks) | null
  >(null);
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<RouteRecommendationMode>("straight");
  const [roadRecommendedOrder, setRoadRecommendedOrder] = useState<RouteRecommendationItem[] | null>(null);
  const [manualRecommendationRowOrder, setManualRecommendationRowOrder] = useState<number[] | null>(null);
  const [roadRecommendationLoading, setRoadRecommendationLoading] = useState(false);
  const [roadRecommendationError, setRoadRecommendationError] = useState<string | null>(null);
  const [activeRouteBatchIndex, setActiveRouteBatchIndex] = useState<number | null>(null);
  const [rowsUndoStack, setRowsUndoStack] = useState<DestinationRowState[][]>(() => loadRouteUndoState().stack);
  const [lastAutoRemovedMessage, setLastAutoRemovedMessage] = useState<string | null>(() => loadRouteUndoState().message);
  const rowsRef = useRef(rows);
  const rowsUndoStackRef = useRef(rowsUndoStack);
  const originRef = useRef(origin);
  const recommendationModeRef = useRef(recommendationMode);
  const routeUiSnapshotVersionRef = useRef(0);
  const geoWatchIdRef = useRef<NativeLocationWatchHandle | null>(null);
  const incomingTransferCountRef = useRef<number | null>(null);
  const autoApplyingIncomingTransferRef = useRef(false);
  const [dailyRouteRuns, setDailyRouteRuns] = useState<RouteRunRow[]>([]);
  const [dailyRouteDateKst, setDailyRouteDateKst] = useState<string>("");
  const [dailyRouteLoadError, setDailyRouteLoadError] = useState<string | null>(null);
  const [earningsModalOpen, setEarningsModalOpen] = useState(false);
  const [earningsStatsModalOpen, setEarningsStatsModalOpen] = useState(false);
  const [bootClientErrors, setBootClientErrors] = useState<string[]>([]);
  const [iosSafeMode, setIosSafeMode] = useState<boolean>(loadIosSafeModeDefault);
  const [mapDeferred, setMapDeferred] = useState<boolean>(loadIosSafeModeDefault);
  const [showApkInstallShortcut] = useState(() => !isNativeApp());
  const [iosBrowserInfo] = useState(() => ({ isIos: detectIosLikeBrowser(), isIosChrome: detectIosChrome() }));
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [resultPanelOpenMobile, setResultPanelOpenMobile] = useState(false);
  const [mapPanelOpenMobile, setMapPanelOpenMobile] = useState(false);
  const [mapRenderKey, setMapRenderKey] = useState(0);
  const [developmentRequests, setDevelopmentRequests] = useState<DevelopmentRequestRow[]>([]);
  const [developmentRequestsLoading, setDevelopmentRequestsLoading] = useState(false);
  const [developmentRequestsError, setDevelopmentRequestsError] = useState<string | null>(null);
  const [incomingOcrTransfers, setIncomingOcrTransfers] = useState<OcrTransferRow[]>([]);
  const [incomingTransferToast, setIncomingTransferToast] = useState<string | null>(null);
  const [autoApplyIncomingTransfers, setAutoApplyIncomingTransfers] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = window.localStorage.getItem(OCR_TRANSFER_AUTO_APPLY_STORAGE_KEY);
      if (saved === "1") return true;
      if (saved === "0") return false;
      return true;
    } catch {
      return true;
    }
  });
  const [pendingFocusRowId, setPendingFocusRowId] = useState<string | null>(null);
  const [kakaoNaviCapability, setKakaoNaviCapability] = useState<KakaoNaviCapability>({
    supported: false,
    keyExists: false,
    keySourceVar: null,
    sdkLoaded: false,
    naviAvailable: false,
    message: "카카오내비 상태 확인 전",
  });

  const centroids = useMemo(() => normalizeDongCentroids(centroidsRaw), []);

  const persistCurrentRouteUiSnapshot = useCallback(
    (params: {
      rows: DestinationRowState[];
      undoStack: DestinationRowState[][];
      message: string | null;
      manualOrder: number[] | null;
      roadOrder: RouteRecommendationItem[] | null;
      recommendationMode: RouteRecommendationMode;
      activeBatchIndex: number | null;
      highlightedRowIndex: number | null;
      handoffPending: boolean;
    }) => {
      const snapshot: RouteUiSnapshot = {
        updatedAt: Date.now(),
        handoffPending: params.handoffPending,
        rows: params.rows.map((row) => hydrateRow(row)),
        undoStack: params.undoStack.map((stackRow) => stackRow.map((row) => hydrateRow(row))),
        message: params.message,
        manualRecommendationRowOrder: params.manualOrder,
        roadRecommendedOrder: params.roadOrder,
        recommendationMode: params.recommendationMode,
        activeRouteBatchIndex: params.activeBatchIndex,
        highlightedRowIndex: params.highlightedRowIndex,
      };

      routeUiSnapshotVersionRef.current = snapshot.updatedAt;
      persistRouteUiSnapshot(snapshot);
    },
    [],
  );

  const restorePendingRouteUiSnapshot = useCallback(() => {
    const snapshot = loadRouteUiSnapshot(hydrateRow);
    if (!snapshot) {
      return;
    }

    const isExpired = Date.now() - snapshot.updatedAt > ROUTE_UI_SNAPSHOT_TTL_MS;
    if (isExpired) {
      persistRouteUiSnapshot(null);
      return;
    }

    if (!snapshot.handoffPending || snapshot.updatedAt <= routeUiSnapshotVersionRef.current) {
      return;
    }

    routeUiSnapshotVersionRef.current = snapshot.updatedAt;
    setRows(snapshot.rows.length > 0 ? snapshot.rows : [createRow()]);
    setRowsUndoStack(snapshot.undoStack);
    setLastAutoRemovedMessage(snapshot.message);
    setManualRecommendationRowOrder(snapshot.manualRecommendationRowOrder);
    setRoadRecommendedOrder(snapshot.roadRecommendedOrder);
    setRecommendationMode(snapshot.recommendationMode);
    setActiveRouteBatchIndex(snapshot.activeRouteBatchIndex);
    setHighlightedRowIndex(snapshot.highlightedRowIndex);
    persistRouteUiSnapshot({
      ...snapshot,
      handoffPending: false,
    });
  }, []);

  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  useEffect(() => {
    rowsUndoStackRef.current = rowsUndoStack;
  }, [rowsUndoStack]);

  useEffect(() => {
    recommendationModeRef.current = recommendationMode;
  }, [recommendationMode]);

  const applyOriginUpdate = useCallback((nextOrigin: LatLng, statusText: string) => {
    setOrigin(nextOrigin);
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        callEstimate: null,
        callEstimateLoading: false,
        callEstimateError: undefined,
        ...(row.callOriginLabel === "현재 위치"
          ? {
              callOriginCoord: nextOrigin,
            }
          : {}),
      })),
    );
    setLocationStatus(statusText);
  }, []);

  const syncCurrentLocation = useCallback((silent = false) => {
    setLocationSyncing(true);
    if (!silent) {
      setLocationStatus("현재 위치를 다시 동기화하는 중입니다...");
    }
    void getCurrentLocation()
      .then((position) => {
        applyOriginUpdate(
          position,
          locationWatching ? "현재 위치를 자동 동기화 중입니다." : "현재 위치를 출발지로 사용합니다.",
        );
        setLocationSyncing(false);
      })
      .catch(() => {
        setLocationStatus("위치 권한 거부: 서울시청 좌표를 사용합니다.");
        setLocationSyncing(false);
      });
  }, [applyOriginUpdate, locationWatching]);

  useEffect(() => {
    syncCurrentLocation(true);
  }, [syncCurrentLocation]);

  useEffect(() => {
    let mounted = true;
    void watchCurrentLocation(
      (nextOrigin) => {
        if (!mounted) return;
        const movedMeters = distanceMeters(originRef.current, nextOrigin);
        setLocationWatching(true);
        if (movedMeters < 20) {
          setLocationStatus("현재 위치를 자동 동기화 중입니다.");
          return;
        }
        applyOriginUpdate(nextOrigin, "현재 위치를 자동 동기화 중입니다.");
      },
      () => {
        if (!mounted) return;
        setLocationWatching(false);
      },
    ).then((handle) => {
      if (!mounted) {
        if (handle) {
          void handle.remove();
        }
        return;
      }
      geoWatchIdRef.current = handle;
    });
    return () => {
      mounted = false;
      const watchHandle = geoWatchIdRef.current;
      geoWatchIdRef.current = null;
      if (watchHandle) {
        void watchHandle.remove();
      }
    };
  }, [applyOriginUpdate]);

  useEffect(() => {
    syncViewportCssVar();
    const onViewportResize = () => syncViewportCssVar();
    window.addEventListener("resize", onViewportResize);
    window.addEventListener("orientationchange", onViewportResize);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("scroll", onViewportResize);
    return () => {
      window.removeEventListener("resize", onViewportResize);
      window.removeEventListener("orientationchange", onViewportResize);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("scroll", onViewportResize);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OCR_TRANSFER_AUTO_APPLY_STORAGE_KEY, autoApplyIncomingTransfers ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [autoApplyIncomingTransfers]);

  useEffect(() => {
    try {
      window.localStorage.setItem(IOS_SAFE_MODE_STORAGE_KEY, iosSafeMode ? "1" : "0");
    } catch {
      // ignore storage failures
    }
    if (!iosSafeMode) {
      setMapDeferred(false);
    }
  }, [iosSafeMode]);

  const loadIncomingOcrTransfers = useCallback(async () => {
    if (!sessionUser?.isAllowed) {
      setIncomingOcrTransfers([]);
      return;
    }

    try {
      const response = await fetch("/api/ocr-transfers?status=pending", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { rows?: OcrTransferRow[] };
      setIncomingOcrTransfers(Array.isArray(payload.rows) ? payload.rows : []);
    } catch {
      // keep inbox silent on normal user screen
    }
  }, [sessionUser?.isAllowed]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");

    const apply = (forceMapRefresh = false) => {
      const mobile = media.matches;
      setIsMobileLayout(mobile);
      if (!mobile) {
        setResultPanelOpenMobile(true);
        setMapPanelOpenMobile(true);
      }
      syncViewportCssVar();
      void loadIncomingOcrTransfers();
      if (forceMapRefresh) {
        window.setTimeout(() => {
          syncViewportCssVar();
          restorePendingRouteUiSnapshot();
          void loadIncomingOcrTransfers();
          setMapRenderKey((prev) => prev + 1);
          window.dispatchEvent(new Event("resize"));
        }, 120);
        return;
      }

      restorePendingRouteUiSnapshot();
    };

    const onMediaChange = () => apply(true);
    const onPageShow = () => apply(true);
    const onFocus = () => apply(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        apply(true);
      }
    };

    apply();
    media.addEventListener("change", onMediaChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    let cleanupNativeResume = () => {};
    void addNativeResumeListener(() => apply(true)).then((cleanup) => {
      cleanupNativeResume = cleanup;
    });
    return () => {
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      cleanupNativeResume();
    };
  }, [loadIncomingOcrTransfers, restorePendingRouteUiSnapshot]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = event.message || "클라이언트 오류";
      setBootClientErrors((prev) => (prev.includes(msg) ? prev : [...prev.slice(-2), msg]));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "비동기 오류";
      setBootClientErrors((prev) => (prev.includes(reason) ? prev : [...prev.slice(-2), reason]));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        ROUTE_UNDO_STORAGE_KEY,
        JSON.stringify({
          stack: rowsUndoStack,
          message: lastAutoRemovedMessage,
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, [rowsUndoStack, lastAutoRemovedMessage]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (!pendingFocusRowId) return;
    if (!rows.some((row) => row.id === pendingFocusRowId)) return;
    const timer = window.setTimeout(() => setPendingFocusRowId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [pendingFocusRowId, rows]);

  useEffect(() => {
    let mounted = true;
    void detectKakaoNaviCapability().then((status) => {
      if (!mounted) return;
      setKakaoNaviCapability(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser?.isAllowed) {
      setDailyRouteRuns([]);
      setDailyRouteDateKst("");
      setDailyRouteLoadError(null);
      return;
    }

    let mounted = true;
    const loadDailyRouteRuns = async () => {
      try {
        setDailyRouteLoadError(null);
        const response = await fetch("/api/auth/usage", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "사용 이력 조회 실패");
        }

        const payload = (await response.json()) as { dateKst: string; runs: RouteRunRow[] };
        if (!mounted) {
          return;
        }
        setDailyRouteDateKst(payload.dateKst ?? "");
        setDailyRouteRuns(Array.isArray(payload.runs) ? payload.runs : []);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setDailyRouteLoadError(error instanceof Error ? error.message : "사용 이력 조회 실패");
      }
    };

    void loadDailyRouteRuns();
    return () => {
      mounted = false;
    };
  }, [sessionUser?.isAllowed]);

  const loadDevelopmentRequests = useCallback(async () => {
    if (!sessionUser?.isAllowed) {
      setDevelopmentRequests([]);
      setDevelopmentRequestsError(null);
      return;
    }

    try {
      setDevelopmentRequestsLoading(true);
      setDevelopmentRequestsError(null);
      const response = await fetch("/api/dev-requests", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "개발 요청 조회 실패");
      }
      const payload = (await response.json()) as { rows: DevelopmentRequestRow[] };
      setDevelopmentRequests(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (error) {
      setDevelopmentRequestsError(error instanceof Error ? error.message : "개발 요청 조회 실패");
    } finally {
      setDevelopmentRequestsLoading(false);
    }
  }, [sessionUser?.isAllowed]);

  useEffect(() => {
    void loadDevelopmentRequests();
  }, [loadDevelopmentRequests]);

  useEffect(() => {
    void loadIncomingOcrTransfers();
  }, [loadIncomingOcrTransfers]);

  useEffect(() => {
    if (!sessionUser?.isAllowed) {
      incomingTransferCountRef.current = null;
      setIncomingTransferToast(null);
      return;
    }

    const previousCount = incomingTransferCountRef.current;
    incomingTransferCountRef.current = incomingOcrTransfers.length;

    if (previousCount === null) {
      return;
    }

    if (incomingOcrTransfers.length > previousCount) {
      const addedCount = incomingOcrTransfers.length - previousCount;
      setIncomingTransferToast(
        addedCount === 1 ? "받은 주소 1건이 도착했습니다." : `받은 주소 ${addedCount}건이 새로 도착했습니다.`,
      );
    }

    if (incomingOcrTransfers.length === 0 && previousCount > 0) {
      setIncomingTransferToast(null);
    }
  }, [incomingOcrTransfers, sessionUser?.isAllowed]);

  useEffect(() => {
    if (!incomingTransferToast) return;
    const timeout = window.setTimeout(() => setIncomingTransferToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [incomingTransferToast]);

  useEffect(() => {
    if (!sessionUser?.isAllowed) return;
    const interval = window.setInterval(() => {
      void loadIncomingOcrTransfers();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadIncomingOcrTransfers, sessionUser?.isAllowed]);

  useEffect(() => {
    if (!sessionUser?.isAdmin) return;
    const pending = consumePendingOcrDestination();
    if (!pending?.address) return;
    void addDestinationFromAddress(pending.address).catch((error) => {
      setLastAutoRemovedMessage(error instanceof Error ? error.message : "OCR 도착지 추가 실패");
    });
    // one-shot on page load/admin return
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.isAdmin]);

  useEffect(() => {
    setRoadRecommendedOrder(null);
    setManualRecommendationRowOrder(null);
    setRoadRecommendationError(null);
    setRecommendationMode((prev) => (prev === "road" ? "straight" : prev));
    setHighlightedRowIndex(null);
    setActiveRouteBatchIndex(null);
  }, [origin, rows]);

  const resolveRowAddress = useCallback(async (id: string, input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    setRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "loading",
              error: undefined,
              callEstimate: null,
              callEstimateError: undefined,
            }
          : item,
      ),
    );

    try {
      const items = (await searchNaverGeocode(trimmed)).slice(0, 5);
      if (items.length === 0) {
        throw new Error("검색 결과가 없습니다.");
      }

      const first = items[0];
      setRows((prev) =>
        prev.map((item) => {
          if (item.id !== id) {
            return item;
          }
          return applyGeocode({ ...item, geocodeItems: items }, first, 0);
        }),
      );
      return first;
    } catch (error) {
      setRows((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "error",
                geocodeItems: [],
                selectedIndex: 0,
                coord: undefined,
                label: undefined,
                error: error instanceof Error ? error.message : "검색 실패",
                callEstimate: null,
                callEstimateError: undefined,
              }
            : item,
        ),
      );
      return null;
    }
  }, []);

  const onSearch = useCallback(async (id: string) => {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row || !row.input.trim()) {
      return;
    }
    await resolveRowAddress(id, row.input.trim());
  }, [resolveRowAddress]);

  const onSelectCandidate = (id: string, index: number) => {
    setRows((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const candidate = item.geocodeItems[index];
        if (!candidate) {
          return item;
        }

        return applyGeocode(item, candidate, index);
      }),
    );
  };

  const onNavigate = useCallback((id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row?.coord) {
      return;
    }

    if (settings.navigationApp === "kakaonavi") {
      if (!kakaoNaviCapability.supported) {
        setLastAutoRemovedMessage("카카오내비를 현재 사용할 수 없습니다. 관리자에게 문의하세요.");
        return;
      }
      void openKakaoNaviDirections(origin, row.coord, row.label ?? row.input)
        .then((result) => {
          if (result.links) {
            window.setTimeout(() => setStoreModal(result.links), 1200);
          }
        })
        .catch((error) => {
          setLastAutoRemovedMessage(error instanceof Error ? error.message : "카카오내비 실행 실패");
          setStoreModal(createKakaoNaviInstallLinks());
        });
      return;
    }

    if (settings.navigationApp === "kakao") {
      const result = openKakaoMapDirections(origin, row.coord, row.label ?? row.input);
      if (result.usedAppScheme) {
        window.setTimeout(() => setStoreModal(result.links), 1300);
      }
      return;
    }

    const result = openNaverDirections(origin, row.coord, row.label ?? row.input);
    if (result.usedAppScheme) {
      window.setTimeout(() => setStoreModal(result.links), 1300);
    }
  }, [kakaoNaviCapability.supported, origin, rows, settings.navigationApp]);

  const applyAddressToRowAndSearch = useCallback(async (
    id: string,
    address: string,
    options?: { onResolved?: (rowId: string, label: string) => void },
  ) => {
    const normalized = address.trim();
    if (!normalized) return null;
    setRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              input: normalized,
              status: "idle",
              error: undefined,
              geocodeItems: [],
              selectedIndex: 0,
              coord: undefined,
              label: undefined,
              callEstimate: null,
              callEstimateError: undefined,
            }
          : item,
      ),
    );
    const resolved = await resolveRowAddress(id, normalized);
    if (resolved) {
      options?.onResolved?.(id, resolved.title || normalized);
    }
    return resolved;
  }, [resolveRowAddress]);

  const addDestinationFromAddress = useCallback(async (
    address: string,
    options?: { onResolved?: (rowId: string, label: string) => void },
  ) => {
    const normalized = address.trim();
    if (!normalized) {
      throw new Error("추출된 주소가 비어 있습니다.");
    }

    const reusableRow = rowsRef.current.find(isReusableEmptyRow);
    if (reusableRow) {
      setPendingFocusRowId(reusableRow.id);
      await applyAddressToRowAndSearch(reusableRow.id, normalized, options);
      setLastAutoRemovedMessage("비어 있던 도착지에 OCR 주소를 채우고 자동 검색을 시작했습니다.");
      return reusableRow.id;
    }

    if (rowsRef.current.length >= MAX_DESTINATIONS) {
      throw new Error(`도착지는 최대 ${MAX_DESTINATIONS}개까지 추가할 수 있습니다.`);
    }

    const newRow = createRow();
    newRow.input = normalized;
    setRows((prev) => [...prev, newRow]);
    setPendingFocusRowId(newRow.id);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await resolveRowAddress(newRow.id, normalized).then((resolved) => {
      if (resolved) {
        options?.onResolved?.(newRow.id, resolved.title || normalized);
      }
    });
    setLastAutoRemovedMessage("OCR 주소로 도착지 1건을 추가하고 자동 검색을 시작했습니다.");
    return newRow.id;
  }, [applyAddressToRowAndSearch, resolveRowAddress]);

  const updateIncomingOcrTransferStatus = useCallback(
    async (id: string, action: "consume" | "dismiss") => {
      const response = await fetch(`/api/ocr-transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        setIncomingOcrTransfers((prev) => prev.filter((row) => row.id !== id));
      }
    },
    [],
  );

  const onApplyIncomingOcrTransfer = useCallback(
    async (id: string) => {
      const target = incomingOcrTransfers.find((row) => row.id === id);
      if (!target) {
        return;
      }

      await addDestinationFromAddress(target.normalized_address ?? target.extracted_text);
      await updateIncomingOcrTransferStatus(id, "consume");
    },
    [addDestinationFromAddress, incomingOcrTransfers, updateIncomingOcrTransferStatus],
  );

  const onDismissIncomingOcrTransfer = useCallback(
    async (id: string) => {
      await updateIncomingOcrTransferStatus(id, "dismiss");
    },
    [updateIncomingOcrTransferStatus],
  );

  useEffect(() => {
    if (!sessionUser?.isAllowed || !autoApplyIncomingTransfers || incomingOcrTransfers.length === 0) {
      return;
    }
    if (autoApplyingIncomingTransferRef.current) {
      return;
    }

    autoApplyingIncomingTransferRef.current = true;
    void onApplyIncomingOcrTransfer(incomingOcrTransfers[0].id).finally(() => {
      autoApplyingIncomingTransferRef.current = false;
    });
  }, [autoApplyIncomingTransfers, incomingOcrTransfers, onApplyIncomingOcrTransfer, sessionUser?.isAllowed]);

  const onNavigateKakao = (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row?.coord) {
      return;
    }

    const result = openKakaoMapDirections(origin, row.coord, row.label ?? row.input);
    if (result.usedAppScheme) {
      window.setTimeout(() => setStoreModal(result.links), 1300);
    }
  };

  const onAddRow = () => {
    const reusableRow = rowsRef.current.find(isReusableEmptyRow);
    if (reusableRow) {
      setPendingFocusRowId(reusableRow.id);
      return;
    }

    if (rowsRef.current.length >= MAX_DESTINATIONS) {
      return;
    }

    const newRow = createRow();
    setRows((prev) => [...prev, newRow]);
    setPendingFocusRowId(newRow.id);
  };

  const onMoveRow = (id: string, direction: "up" | "down") => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      return reorderList(prev, index, nextIndex);
    });
  };

  const onReorderRecommendation = (dragRowIndex: number, dropRowIndex: number) => {
    setManualRecommendationRowOrder((prev) => {
      const current = (prev && prev.length > 0 ? prev : recommendedOrder.map((item) => item.rowIndex)).slice();
      const fromIndex = current.indexOf(dragRowIndex);
      const toIndex = current.indexOf(dropRowIndex);
      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }
      return reorderList(current, fromIndex, toIndex);
    });
  };

  const onSubmitDevelopmentRequest = async (payload: { title: string; body: string }) => {
    const response = await fetch("/api/dev-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorPayload.message ?? "개발 요청 등록 실패");
    }

    await loadDevelopmentRequests();
    setLastAutoRemovedMessage("개발 요청이 등록되었습니다.");
  };

  const onChangeCallTime = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              callTime: value,
              callEstimate: null,
              callEstimateError: undefined,
            }
          : row,
      ),
    );
  };

  const onUseCurrentCallTime = (id: string) => {
    onChangeCallTime(id, getCurrentKstTimeValue());
  };

  const onChangeCallOriginInput = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              callOriginInput: value,
              callOriginStatus: "idle",
              callOriginError: undefined,
              callOriginCoord: undefined,
              callOriginLabel: undefined,
              callEstimate: null,
              callEstimateError: undefined,
            }
          : row,
      ),
    );
  };

  const onUseCurrentLocationForCall = (id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              callOriginInput: "현재 위치",
              callOriginCoord: origin,
              callOriginLabel: "현재 위치",
              callOriginStatus: "resolved",
              callOriginError: undefined,
              callEstimate: null,
              callEstimateError: undefined,
            }
          : row,
      ),
    );
  };

  const onResolveCallOrigin = async (id: string) => {
    const targetRow = rowsRef.current.find((row) => row.id === id);
    if (!targetRow) return;

    const query = targetRow.callOriginInput.trim();
    if (!query) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, callOriginError: "출발지 주소를 먼저 입력하세요.", callOriginStatus: "error" } : row,
        ),
      );
      return;
    }

    if (query === "현재 위치") {
      onUseCurrentLocationForCall(id);
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, callOriginStatus: "loading", callOriginError: undefined, callEstimate: null } : row,
      ),
    );

    try {
      const items = (await searchNaverGeocode(query)).slice(0, 1);
      if (items.length === 0) {
        throw new Error("출발지 검색 결과가 없습니다.");
      }

      const first = items[0];
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                callOriginStatus: "resolved",
                callOriginCoord: { lat: first.lat, lon: first.lon },
                callOriginLabel: first.title,
                callOriginInput: first.title,
                callOriginError: undefined,
                callEstimate: null,
                callEstimateError: undefined,
              }
            : row,
        ),
      );
    } catch (error) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                callOriginStatus: "error",
                callOriginCoord: undefined,
                callOriginLabel: undefined,
                callOriginError: error instanceof Error ? error.message : "출발지 검색 실패",
                callEstimate: null,
                callEstimateError: undefined,
              }
            : row,
        ),
      );
    }
  };

  const straightRecommendedOrder = useMemo(
    () =>
      recommendVisitOrder({
        origin,
        destinations: rows.map((row) => ({ label: (row.label ?? row.input) || "이름 없음", coord: row.coord })),
      }),
    [origin, rows],
  );

  const baseRecommendedOrder = useMemo(
    () => (recommendationMode === "road" && roadRecommendedOrder ? roadRecommendedOrder : straightRecommendedOrder),
    [recommendationMode, roadRecommendedOrder, straightRecommendedOrder],
  );

  const recommendedOrder = useMemo(() => {
    if (!manualRecommendationRowOrder || manualRecommendationRowOrder.length === 0) {
      return baseRecommendedOrder;
    }

    const byRowIndex = new Map(baseRecommendedOrder.map((item) => [item.rowIndex, item]));
    const reordered = manualRecommendationRowOrder
      .map((rowIndex) => byRowIndex.get(rowIndex))
      .filter((item): item is RouteRecommendationItem => Boolean(item));

    const remaining = baseRecommendedOrder.filter((item) => !manualRecommendationRowOrder.includes(item.rowIndex));
    const merged = [...reordered, ...remaining];
    if (recommendationMode === "straight") {
      let cumulative = 0;
      let current = origin;
      return merged.map((item, index) => {
        const row = rows[item.rowIndex];
        const coord = row?.coord;
        if (!coord) {
          return { ...item, step: index + 1 };
        }
        const legKm = Math.hypot(coord.lat - current.lat, coord.lon - current.lon) * 111;
        cumulative += legKm;
        current = coord;
        return {
          ...item,
          step: index + 1,
          distanceKm: Number(legKm.toFixed(1)),
          cumulativeKm: Number(cumulative.toFixed(1)),
          durationMin: undefined,
          cumulativeDurationMin: undefined,
        };
      });
    }

    return merged.map((item, index) => ({
      ...item,
      step: index + 1,
    }));
  }, [baseRecommendedOrder, manualRecommendationRowOrder, recommendationMode, origin, rows]);

  const orderedDestinationsForSegments = useMemo(() => {
    const orderedResolved = recommendedOrder
      .map((item) => rows[item.rowIndex])
      .filter((row): row is DestinationRowState & { coord: LatLng } => Boolean(row?.coord))
      .map((row) => ({
        label: row.label ?? row.input,
        coord: row.coord,
      }));

    return orderedResolved;
  }, [recommendedOrder, rows]);

  const segments = useMemo(() => {
    return calculateSegments({
      origin,
      destinations: orderedDestinationsForSegments,
      settings,
      centroids,
    });
  }, [centroids, orderedDestinationsForSegments, origin, settings]);

  const finalShortList = useMemo(() => makeFinalDongDisplayList(segments), [segments]);
  const finalDongEntries = useMemo(() => makeFinalDongDisplayEntries(segments), [segments]);

  const maxMultiRouteStops = settings.navigationApp === "naver" ? 6 : 2;

  const orderedRouteStops = useMemo<OrderedRouteStop[]>(() => {
    return recommendedOrder
      .map((item) => ({ rowIndex: item.rowIndex, row: rows[item.rowIndex] }))
      .filter(
        (item): item is { rowIndex: number; row: DestinationRowState & { coord: LatLng } } => Boolean(item.row?.coord),
      )
      .map((item, idx) => ({
        lat: item.row.coord.lat,
        lon: item.row.coord.lon,
        name: item.row.label ?? item.row.input ?? `도착지 ${idx + 1}`,
        rowId: item.row.id,
        rowIndex: item.rowIndex,
      }));
  }, [recommendedOrder, rows]);

  const routeableStops = useMemo(
    () => orderedRouteStops.slice(0, maxMultiRouteStops),
    [orderedRouteStops, maxMultiRouteStops],
  );

  const routeBatches = useMemo(() => {
    const batches: Array<{ key: string; label: string; origin: LatLng; stops: OrderedRouteStop[] }> = [];
    if (orderedRouteStops.length === 0) {
      return batches;
    }

    for (let i = 0; i < orderedRouteStops.length; i += maxMultiRouteStops) {
      const stops = orderedRouteStops.slice(i, i + maxMultiRouteStops);
      const prevLast = i === 0 ? null : orderedRouteStops[i - 1];
      const batchOrigin = prevLast ? { lat: prevLast.lat, lon: prevLast.lon } : origin;
      const startSeq = i + 1;
      const endSeq = i + stops.length;
      batches.push({
        key: `batch-${i}`,
        label: `${Math.floor(i / maxMultiRouteStops) + 1}차 (${startSeq}~${endSeq})`,
        origin: batchOrigin,
        stops,
      });
    }

    return batches;
  }, [orderedRouteStops, origin, maxMultiRouteStops]);

  const canUseDestinationAttachment = useMemo(() => {
    const normalized = normalizePhoneNumber(sessionUser?.phone ?? "");
    return Boolean(normalized && ATTACHMENT_ALLOWED_PHONES.has(normalized));
  }, [sessionUser?.phone]);

  const buildRouteRunStops = (stops: OrderedRouteStop[]): RouteRunStop[] => {
    const recommendationByRowIndex = new Map(recommendedOrder.map((item) => [item.rowIndex, item]));
    return stops.map((stop, index) => {
      const rec = recommendationByRowIndex.get(stop.rowIndex);
      return {
        step: index + 1,
        rowIndex: stop.rowIndex,
        name: stop.name,
        lat: stop.lat,
        lon: stop.lon,
        distanceKm: rec?.distanceKm,
        durationMin: rec?.durationMin,
        cumulativeKm: rec?.cumulativeKm,
        cumulativeDurationMin: rec?.cumulativeDurationMin,
      };
    });
  };

  const saveRouteRun = async (params: {
    provider: "naver" | "kakao" | "kakaonavi";
    batchLabel?: string | null;
    stops: OrderedRouteStop[];
  }) => {
    if (!sessionUser?.isAllowed || params.stops.length === 0) {
      return;
    }

    const routeStops = buildRouteRunStops(params.stops);
    const payload = {
      provider: params.provider,
      batchLabel: params.batchLabel ?? null,
      finalShortList,
      routeStops,
    };

    const response = await fetch("/api/auth/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorPayload.message ?? "길찾기 이력 저장 실패");
    }

    const result = (await response.json()) as { row?: RouteRunRow };
    if (result.row) {
      setDailyRouteRuns((prev) => [result.row as RouteRunRow, ...prev].slice(0, 100));
    }
  };

  const removeRowsAfterRouteHandoff = (rowIds: string[], message: string) => {
    if (rowIds.length === 0) {
      return;
    }
    const currentRows = rowsRef.current.map((row) => hydrateRow(row));
    const nextUndoStack =
      currentRows.length > 0 ? [...rowsUndoStackRef.current, currentRows] : rowsUndoStackRef.current.slice();
    const nextRows = currentRows.filter((row) => !rowIds.includes(row.id));
    const safeNextRows = nextRows.length > 0 ? nextRows : [createRow()];
    const nextRecommendationMode = recommendationModeRef.current === "road" ? "straight" : recommendationModeRef.current;

    persistCurrentRouteUiSnapshot({
      rows: safeNextRows,
      undoStack: nextUndoStack,
      message,
      manualOrder: null,
      roadOrder: null,
      recommendationMode: nextRecommendationMode,
      activeBatchIndex: null,
      highlightedRowIndex: null,
      handoffPending: true,
    });

    setRowsUndoStack(nextUndoStack);
    setRows(safeNextRows);
    setHighlightedRowIndex(null);
    setRoadRecommendedOrder(null);
    setManualRecommendationRowOrder(null);
    setRecommendationMode(nextRecommendationMode);
    setActiveRouteBatchIndex(null);
    setLastAutoRemovedMessage(message);
  };

  const undoLastAutoRemove = () => {
    const currentUndoStack = rowsUndoStackRef.current;
    if (currentUndoStack.length === 0) {
      return;
    }

    const nextUndoStack = [...currentUndoStack];
    const restored = nextUndoStack.pop();
    if (!restored) {
      return;
    }

    const nextRecommendationMode = recommendationModeRef.current === "road" ? "straight" : recommendationModeRef.current;
    persistCurrentRouteUiSnapshot({
      rows: restored,
      undoStack: nextUndoStack,
      message: null,
      manualOrder: null,
      roadOrder: null,
      recommendationMode: nextRecommendationMode,
      activeBatchIndex: null,
      highlightedRowIndex: null,
      handoffPending: false,
    });

    setRowsUndoStack(nextUndoStack);
    setRows(restored);
    setRoadRecommendedOrder(null);
    setManualRecommendationRowOrder(null);
    setRecommendationMode(nextRecommendationMode);
    setActiveRouteBatchIndex(null);
    setHighlightedRowIndex(null);
    setLastAutoRemovedMessage(null);
  };

  const onNavigateAll = () => {
    if (routeableStops.length === 0) {
      return;
    }
    setActiveRouteBatchIndex(routeBatches.length > 1 ? 0 : null);

    if (settings.navigationApp === "kakaonavi") {
      if (!kakaoNaviCapability.supported) {
        setLastAutoRemovedMessage("카카오내비를 현재 사용할 수 없습니다. 관리자에게 문의하세요.");
        return;
      }
      void openKakaoNaviMultiDirections(origin, routeableStops, maxMultiRouteStops)
        .then((result) => {
          if (!result.supported) {
            setLastAutoRemovedMessage(result.message ?? "카카오내비 전체 길찾기를 실행할 수 없습니다.");
            if (result.links) setStoreModal(result.links);
            return;
          }
          if (result.links) {
            window.setTimeout(() => setStoreModal(result.links), 1200);
          }
          void saveRouteRun({ provider: "kakaonavi", batchLabel: "전체", stops: routeableStops }).catch(() => {});
          removeRowsAfterRouteHandoff(
            routeableStops.map((stop) => stop.rowId),
            `카카오내비 전체 길찾기로 ${routeableStops.length}개 도착지를 전송하고 목록에서 숨겼습니다.`,
          );
        })
        .catch((error) => {
          setLastAutoRemovedMessage(error instanceof Error ? error.message : "카카오내비 전체 길찾기 실행 실패");
          setStoreModal(createKakaoNaviInstallLinks());
        });
      return;
    }

    if (settings.navigationApp === "kakao") {
      const result = openKakaoMapMultiDirections(origin, routeableStops);
      if (!result.supported) {
        setLastAutoRemovedMessage(
          "카카오맵 전체 길찾기는 현재 자동 경유지 1개(총 2도착지)까지만 지원됩니다. 개별 길찾기 또는 네이버 기본 앱을 사용하세요.",
        );
        return;
      }
      if (result.usedAppScheme && result.links) {
        window.setTimeout(() => setStoreModal(result.links), 1300);
      }
      void saveRouteRun({ provider: "kakao", batchLabel: "전체", stops: routeableStops }).catch(() => {});
      removeRowsAfterRouteHandoff(
        routeableStops.map((stop) => stop.rowId),
        `카카오맵 전체 길찾기로 ${routeableStops.length}개 도착지를 전송하고 목록에서 숨겼습니다.`,
      );
      return;
    }

    const result = openNaverMultiDirections(origin, routeableStops);
    if (result.usedAppScheme && result.links) {
      window.setTimeout(() => setStoreModal(result.links), 1300);
    }
    void saveRouteRun({ provider: "naver", batchLabel: "전체", stops: routeableStops }).catch(() => {});
    removeRowsAfterRouteHandoff(
      routeableStops.map((stop) => stop.rowId),
      `전체 길찾기로 ${routeableStops.length}개 도착지를 전송하고 목록에서 숨겼습니다.`,
    );
  };

  const onNavigateBatch = (batchIndex: number) => {
    const batch = routeBatches[batchIndex];
    if (!batch || batch.stops.length === 0) {
      return;
    }
    setActiveRouteBatchIndex(batchIndex);

    if (settings.navigationApp === "kakaonavi") {
      if (!kakaoNaviCapability.supported) {
        setLastAutoRemovedMessage("카카오내비를 현재 사용할 수 없습니다. 관리자에게 문의하세요.");
        return;
      }
      void openKakaoNaviMultiDirections(batch.origin, batch.stops, maxMultiRouteStops)
        .then((result) => {
          if (!result.supported) {
            setLastAutoRemovedMessage(
              result.message ?? `카카오내비 ${batch.label} 경로를 자동 전송할 수 없습니다.`,
            );
            if (result.links) setStoreModal(result.links);
            return;
          }
          if (result.links) {
            window.setTimeout(() => setStoreModal(result.links), 1200);
          }
          void saveRouteRun({ provider: "kakaonavi", batchLabel: batch.label, stops: batch.stops }).catch(() => {});
          removeRowsAfterRouteHandoff(
            batch.stops.map((stop) => stop.rowId),
            `카카오내비 ${batch.label} 경로를 전송하고 해당 도착지를 목록에서 숨겼습니다.`,
          );
        })
        .catch((error) => {
          setLastAutoRemovedMessage(error instanceof Error ? error.message : "카카오내비 분할 길찾기 실행 실패");
          setStoreModal(createKakaoNaviInstallLinks());
        });
      return;
    }

    if (settings.navigationApp === "kakao") {
      const result = openKakaoMapMultiDirections(batch.origin, batch.stops);
      if (!result.supported) {
        setLastAutoRemovedMessage(
          `카카오맵 ${batch.label} 경로는 자동 경유지 1개 제한으로 바로 전송할 수 없습니다. 네이버 기본 앱으로 변경하거나 개별 길찾기를 사용하세요.`,
        );
        return;
      }
      if (result.usedAppScheme && result.links) {
        window.setTimeout(() => setStoreModal(result.links), 1300);
      }
      void saveRouteRun({ provider: "kakao", batchLabel: batch.label, stops: batch.stops }).catch(() => {});
      removeRowsAfterRouteHandoff(
        batch.stops.map((stop) => stop.rowId),
        `카카오맵 ${batch.label} 경로를 전송하고 해당 도착지를 목록에서 숨겼습니다.`,
      );
      return;
    }

    const result = openNaverMultiDirections(batch.origin, batch.stops);
    if (result.usedAppScheme && result.links) {
      window.setTimeout(() => setStoreModal(result.links), 1300);
    }
    void saveRouteRun({ provider: "naver", batchLabel: batch.label, stops: batch.stops }).catch(() => {});
    removeRowsAfterRouteHandoff(
      batch.stops.map((stop) => stop.rowId),
      `${batch.label} 경로를 전송하고 해당 도착지를 목록에서 숨겼습니다.`,
    );
  };

  const onComputeRoadRecommendation = async () => {
    const resolved = rows
      .map((row, rowIndex) => ({ rowIndex, label: (row.label ?? row.input) || "이름 없음", coord: row.coord }))
      .filter((row): row is { rowIndex: number; label: string; coord: LatLng } => Boolean(row.coord));

    if (resolved.length === 0) {
      setRoadRecommendationError("좌표가 확정된 도착지가 없습니다.");
      return;
    }

    setRoadRecommendationLoading(true);
    setRoadRecommendationError(null);

    try {
      const cache = new Map<string, { km: number; min: number }>();
      const keyOf = (a: LatLng, b: LatLng) => `${a.lat.toFixed(6)},${a.lon.toFixed(6)}>${b.lat.toFixed(6)},${b.lon.toFixed(6)}`;

      const getRoadStat = async (a: LatLng, b: LatLng) => {
        const key = keyOf(a, b);
        const cached = cache.get(key);
        if (cached !== undefined) {
          return cached;
        }

        const response = await fetch(
          `/api/directions5?startLat=${a.lat}&startLon=${a.lon}&goalLat=${b.lat}&goalLon=${b.lon}&option=trafast`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "Directions API 요청 실패");
        }

        const payload = (await response.json()) as DirectionsApiResponse;
        const route = payload.raw?.route;
        const firstRouteGroup = route ? Object.values(route)[0] : undefined;
        const distanceMeters = firstRouteGroup?.[0]?.summary?.distance;
        const durationMs = firstRouteGroup?.[0]?.summary?.duration;
        const stat = {
          km: typeof distanceMeters === "number" ? distanceMeters / 1000 : Number.POSITIVE_INFINITY,
          min: typeof durationMs === "number" ? durationMs / 60000 : Number.POSITIVE_INFINITY,
        };
        cache.set(key, stat);
        return stat;
      };

      const unresolved = [...resolved];
      const greedyOrder: typeof resolved = [];
      let current = origin;

      while (unresolved.length > 0) {
        const candidates = await Promise.all(
          unresolved.map(async (item) => ({
            item,
            km: (await getRoadStat(current, item.coord)).km,
          })),
        );
        candidates.sort((a, b) => a.km - b.km);
        const next = candidates[0];
        greedyOrder.push(next.item);
        current = next.item.coord;
        const removeIndex = unresolved.findIndex((it) => it.rowIndex === next.item.rowIndex);
        unresolved.splice(removeIndex, 1);
      }

      const pathDistance = async (order: typeof resolved) => {
        let total = 0;
        let from = origin;
        for (const item of order) {
          total += (await getRoadStat(from, item.coord)).km;
          from = item.coord;
        }
        return total;
      };

      // 2-opt style local improvement on the greedy order (open path, no return edge).
      let improved = [...greedyOrder];
      let improvedFlag = true;
      while (improvedFlag) {
        improvedFlag = false;
        for (let i = 0; i < improved.length - 2; i += 1) {
          for (let k = i + 1; k < improved.length - 1; k += 1) {
            const candidate = [
              ...improved.slice(0, i),
              ...improved.slice(i, k + 1).reverse(),
              ...improved.slice(k + 1),
            ];
            const [currDist, candDist] = await Promise.all([pathDistance(improved), pathDistance(candidate)]);
            if (candDist + 0.05 < currDist) {
              improved = candidate;
              improvedFlag = true;
            }
          }
        }
      }

      const roundSafe = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(1)) : undefined);
      let cumulative = 0;
      let cumulativeMin = 0;
      let from = origin;
      const sorted = [] as RouteRecommendationItem[];
      for (let index = 0; index < improved.length; index += 1) {
        const item = improved[index];
        const leg = await getRoadStat(from, item.coord);
        const legKm = leg.km;
        const legMin = leg.min;
        cumulative += legKm;
        if (Number.isFinite(legMin)) {
          cumulativeMin += legMin;
        }
        sorted.push({
          step: index + 1,
          rowIndex: item.rowIndex,
          label: item.label,
          distanceKm: Number.isFinite(legKm) ? Number(legKm.toFixed(1)) : 0,
          cumulativeKm: Number.isFinite(cumulative) ? Number(cumulative.toFixed(1)) : 0,
          durationMin: roundSafe(legMin),
          cumulativeDurationMin: roundSafe(cumulativeMin),
        });
        from = item.coord;
      }

      setRoadRecommendedOrder(sorted);
      setRecommendationMode("road");
    } catch (error) {
      setRoadRecommendationError(error instanceof Error ? error.message : "실도로 기준 계산 실패");
    } finally {
      setRoadRecommendationLoading(false);
    }
  };

  const onComputeCallEstimate = async (rowId: string) => {
    const targetRow = rowsRef.current.find((row) => row.id === rowId);
    if (!targetRow?.coord) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, callEstimate: null, callEstimateError: "좌표가 확정된 도착지가 아닙니다." } : row,
        ),
      );
      return;
    }
    if (!targetRow.callTime) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, callEstimate: null, callEstimateError: "콜 잡은 시간을 먼저 입력하세요." } : row,
        ),
      );
      return;
    }
    if (!targetRow.callOriginCoord) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, callEstimate: null, callEstimateError: "출발지를 먼저 적용하세요." } : row,
        ),
      );
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              callEstimateLoading: true,
              callEstimateError: undefined,
            }
          : row,
      ),
    );

    try {
      const response = await fetch(
        `/api/directions5?startLat=${targetRow.callOriginCoord.lat}&startLon=${targetRow.callOriginCoord.lon}&goalLat=${targetRow.coord.lat}&goalLon=${targetRow.coord.lon}&option=trafast`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "실제 경로 시간 조회 실패");
      }

      const payload = (await response.json()) as DirectionsApiResponse;
      const route = payload.raw?.route ? Object.values(payload.raw.route)[0] : undefined;
      const summary = route?.[0]?.summary;
      const durationMin = typeof summary?.duration === "number" ? summary.duration / 60000 : null;
      const distanceKm = typeof summary?.distance === "number" ? summary.distance / 1000 : null;

      if (typeof durationMin !== "number" || !Number.isFinite(durationMin)) {
        throw new Error("실제 경로 시간을 계산하지 못했습니다.");
      }

      const longestLegMin = Math.round(durationMin);
      const adjustedDriveMin = Math.round(longestLegMin * 1.5);
      const pickupMin = 20;
      const totalRequiredMin = adjustedDriveMin + pickupMin;
      const label = targetRow.label ?? targetRow.input ?? `도착지 ${rowsRef.current.findIndex((row) => row.id === rowId) + 1}`;

      const nextEstimate = {
        longestLegMin,
        adjustedDriveMin,
        pickupMin,
        totalRequiredMin,
        deadlineLabel: addMinutesToKstTime(targetRow.callTime, totalRequiredMin),
        referenceLeg: `${targetRow.callOriginLabel ?? "출발지"} → ${label}`,
        legs: [
          {
            fromLabel: targetRow.callOriginLabel ?? "출발지",
            toLabel: label,
            distanceKm,
            durationMin,
          },
        ],
      } satisfies RouteCallEstimateResult;

      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                callEstimateLoading: false,
                callEstimateError: undefined,
                callEstimate: nextEstimate,
              }
            : row,
        ),
      );

      if (sessionUser?.isAllowed) {
        try {
          await fetch("/api/call-times", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callTime: targetRow.callTime,
              deadlineLabel: nextEstimate.deadlineLabel,
              longestLegMin: nextEstimate.longestLegMin,
              adjustedDriveMin: nextEstimate.adjustedDriveMin,
              pickupMin: nextEstimate.pickupMin,
              totalRequiredMin: nextEstimate.totalRequiredMin,
              referenceLeg: nextEstimate.referenceLeg,
              routeLegs: nextEstimate.legs,
            }),
          });
        } catch {
          // keep estimate visible even if history save fails
        }
      }
    } catch (error) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                callEstimateLoading: false,
                callEstimate: null,
                callEstimateError: error instanceof Error ? error.message : "콜 시간 계산 실패",
              }
            : row,
        ),
      );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-2 py-3 pb-28 sm:px-4 sm:py-4 sm:pb-32 lg:pb-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-800">퀵배달 메이커</h1>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Quick + Delivery
              </span>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                최신 v{MAIN_APP_LATEST_VERSION}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                추출기 v{EXTRACTOR_APP_LATEST_VERSION}
              </span>
            </div>
            {showApkInstallShortcut ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/install/extractor-android"
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  구역 추출기 설치
                </a>
                <a
                  href="/extractor"
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  구역 추출기 웹
                </a>
                <a
                  href="/install/android"
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3v11" />
                    <path d="m8 10 4 4 4-4" />
                    <path d="M5 20h14" />
                  </svg>
                  APK 설치
                </a>
              </div>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">퀵/배달 경유지 구설정 · 팬 권역 · 길찾기 자동 생성</p>
          {bootClientErrors.length > 0 ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="font-medium">초기 로딩 중 오류가 감지되었습니다.</div>
              <ul className="mt-1 list-disc pl-4">
                {bootClientErrors.map((msg, idx) => (
                  <li key={`${idx}-${msg}`}>{msg}</li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md border border-amber-300 bg-white px-2 text-[11px]"
                  onClick={() => setBootClientErrors([])}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-amber-300 bg-white px-2 text-[11px]"
                  onClick={() => window.location.reload()}
                >
                  새로고침
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-3">
            <IosPwaHint />
          </div>
          <div className="mt-2 inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800">
            출발지(고정): 내 현재 위치
          </div>
          {iosBrowserInfo.isIos ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">iPhone/iPad 안전 모드</span>
                  <span className="ml-2 text-slate-500">
                    {iosBrowserInfo.isIosChrome ? "(Chrome 감지)" : "(iOS 브라우저 감지)"}
                  </span>
                </div>
                <button
                  type="button"
                  className={`h-8 rounded-md px-2 text-[11px] ${
                    iosSafeMode ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() =>
                    setIosSafeMode((prev) => {
                      const next = !prev;
                      if (next) setMapDeferred(true);
                      return next;
                    })
                  }
                >
                  {iosSafeMode ? "안전 모드 ON" : "안전 모드 OFF"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                iOS 크롬/사파리에서 로딩이 불안정하면 지도를 지연 로드하도록 설정할 수 있습니다.
              </p>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
                locationWatching
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {locationWatching ? "실시간 위치 자동 동기화 중" : "자동 위치 동기화 대기 중"}
            </span>
            <button
              type="button"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 disabled:opacity-50"
              onClick={() => syncCurrentLocation(false)}
              disabled={locationSyncing}
            >
              {locationSyncing ? "재확인 중..." : "수동 재확인"}
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-600">출발지: 내 현재 위치(GPS), 권한 거부 시 서울시청 좌표</p>
          <details className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-700">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  로그인 정보
                  {sessionUser?.isAdmin ? " (관리자)" : ""}
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                  승인: {sessionUser?.isAllowed ? "허용" : "미허용"}
                </span>
              </div>
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                펼치기/접기
              </span>
            </summary>

            <div className="mt-2 border-t border-slate-200 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  로그인: {sessionUser?.phone ?? "-"} {sessionUser?.isAdmin ? "(관리자)" : ""}
                </span>
                {sessionUser?.isAdmin ? (
                  <button
                    type="button"
                    className="rounded-md border border-cyan-300 bg-white px-2 py-1 text-[11px] text-cyan-700"
                    onClick={() => router.push("/admin")}
                  >
                    관리자 승인 관리
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
                  onClick={async () => {
                    await fetch("/api/auth/allowlist", { method: "DELETE" });
                    router.replace("/login");
                  }}
                >
                  로그아웃
                </button>
              </div>
              <div className="mt-1">위치 상태: {locationStatus}</div>
              <div>승인 상태: {sessionUser?.isAllowed ? "허용" : "미허용"}</div>
              <NativePermissionStatus />
              {sessionUser?.isAllowed ? (
                <div className="mt-2">
                  <button
                    type="button"
                    className="rounded-md border border-cyan-300 bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-800"
                    onClick={() => setEarningsStatsModalOpen(true)}
                  >
                    운임 통계 보기
                  </button>
                </div>
              ) : null}
              {sessionUser?.isAdmin ? (
                <div>관리자 안내: 회원가입 요청 승인/반려는 관리자 승인 관리에서 처리합니다.</div>
              ) : null}
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700">
                    오늘 길찾기 저장 내역 {dailyRouteDateKst ? `(${dailyRouteDateKst}, KST)` : ""}
                  </span>
                  <span className="text-slate-500">{dailyRouteRuns.length}건</span>
                </div>
                {dailyRouteLoadError ? <p className="mt-1 text-rose-600">{dailyRouteLoadError}</p> : null}
                <div className="mt-2 space-y-2">
                  {dailyRouteRuns.slice(0, 5).map((run) => (
                    <details key={run.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                      <summary className="cursor-pointer text-[11px] text-slate-700">
                        {new Date(run.created_at).toLocaleTimeString()} · {getRouteRunProviderLabel(run.provider)}
                        {run.batch_label ? ` · ${run.batch_label}` : ""} · {run.destination_count}개
                      </summary>
                      <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                        <div>동 리스트: {run.final_short_list_text || "-"}</div>
                        <ol className="list-decimal pl-4">
                          {(run.route_stops ?? []).map((stop) => (
                            <li key={`${run.id}-${stop.step}`}>
                              {stop.name}
                              {typeof stop.distanceKm === "number" ? ` (${stop.distanceKm}km` : ""}
                              {typeof stop.durationMin === "number" ? ` / 약 ${Math.round(stop.durationMin)}분` : ""}
                              {typeof stop.distanceKm === "number" ? ")" : ""}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  ))}
                  {dailyRouteRuns.length === 0 ? (
                    <p className="text-[11px] text-slate-500">오늘 저장된 길찾기 이력이 없습니다.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </details>
        </section>

        <SettingsPanel
          settings={settings}
          kakaoNaviStatus={kakaoNaviCapability}
          onChange={(next) => setSettings(sanitizeSettings(next))}
        />

        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr] lg:gap-4">
          <div className="space-y-3">
            {sessionUser?.isAllowed ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800">받은 주소 자동 적용</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          켜 두면 A폰에서 보낸 첫 번째 주소를 빈 도착지 또는 새 도착지 row에 자동 반영합니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`rounded-full px-4 py-2 text-xs font-semibold ${
                          autoApplyIncomingTransfers
                            ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border border-slate-300 bg-white text-slate-700"
                        }`}
                        onClick={() => setAutoApplyIncomingTransfers((prev) => !prev)}
                      >
                        자동 적용 {autoApplyIncomingTransfers ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800">받은 주소 처리 방식</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          받은 주소는 자동으로 도착지에만 반영합니다. 이후 전체 길찾기나 개별 길찾기는 사용자가 직접 선택하도록 유지해 원하지 않는 자동 실행을 막습니다.
                        </p>
                      </div>
                  </div>
                </div>
              </section>
            ) : null}

            <DestinationList
              rows={rows}
              origin={origin}
              autoSearch={settings.autoSearch}
              resolvedCount={orderedRouteStops.length}
              routeableCount={routeableStops.length}
              skippedCountForAllRoute={Math.max(0, orderedRouteStops.length - routeableStops.length)}
              routeProviderLabel={getNavigationAppLabel(settings.navigationApp)}
              routeMaxStops={maxMultiRouteStops}
              highlightedRowIndex={highlightedRowIndex}
              pendingFocusRowId={pendingFocusRowId}
              activeRouteBatchIndex={activeRouteBatchIndex}
              routeBatchButtons={routeBatches.map((batch, index) => ({
                key: batch.key,
                label: batch.label,
                count: batch.stops.length,
                onClick: () => onNavigateBatch(index),
              }))}
              onAdd={onAddRow}
              onReset={() => setRows([createRow()])}
              onNavigateAll={onNavigateAll}
              canUndoRouteRemoval={rowsUndoStack.length > 0}
              undoRouteMessage={lastAutoRemovedMessage}
              onUndoRouteRemoval={undoLastAutoRemove}
              onMoveRow={onMoveRow}
              onChangeInput={(id, value) =>
                setRows((prev) =>
                  prev.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          input: value,
                          status: "idle",
                          error: undefined,
                          geocodeItems: [],
                          selectedIndex: 0,
                          coord: undefined,
                          label: undefined,
                          callEstimate: null,
                          callEstimateError: undefined,
                        }
                      : item,
                  ),
                )
              }
              onSearch={onSearch}
              onDelete={(id) =>
                setRows((prev) => {
                  const next = prev.filter((item) => item.id !== id);
                  return next.length > 0 ? next : [createRow()];
                })
              }
              onSelectCandidate={onSelectCandidate}
              onNavigate={onNavigate}
              onNavigateKakao={onNavigateKakao}
              preferredNavigationApp={settings.navigationApp}
              isAdmin={Boolean(sessionUser?.isAdmin)}
              canUseAttachment={canUseDestinationAttachment}
              onApplyOcrToRow={(id, address) => {
                void applyAddressToRowAndSearch(id, address);
              }}
              incomingOcrTransfers={incomingOcrTransfers}
              onApplyIncomingOcrTransfer={(id) => void onApplyIncomingOcrTransfer(id)}
              onDismissIncomingOcrTransfer={(id) => void onDismissIncomingOcrTransfer(id)}
              onChangeCallTime={onChangeCallTime}
              onUseCurrentCallTime={onUseCurrentCallTime}
              onComputeCallEstimate={(id) => void onComputeCallEstimate(id)}
              onChangeCallOriginInput={onChangeCallOriginInput}
              onUseCurrentLocationForCall={onUseCurrentLocationForCall}
              onResolveCallOrigin={(id) => void onResolveCallOrigin(id)}
            />
          </div>

          <div className="space-y-3">
            {isMobileLayout ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">결과</h2>
                    <p className="text-xs text-slate-500">추천 순서 / 동 리스트</p>
                  </div>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
                    onClick={() => setResultPanelOpenMobile((prev) => !prev)}
                  >
                    {resultPanelOpenMobile ? "접기" : "펼치기"}
                  </button>
                </div>
                {!resultPanelOpenMobile ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    최종 동 {finalShortList.length}개 · 필요할 때 펼쳐서 확인하세요.
                  </div>
                ) : (
                  <div className="mt-3">
                    <ResultPanel
                      segments={segments}
                      finalDongList={finalShortList}
                      finalDongEntries={finalDongEntries}
                      viewMode={settings.viewMode}
                      recommendedOrder={recommendedOrder}
                      manualOrderActive={Boolean(manualRecommendationRowOrder?.length)}
                      recommendationMode={recommendationMode}
                      roadRecommendationLoading={roadRecommendationLoading}
                      roadRecommendationError={roadRecommendationError}
                      onSelectRecommendation={(rowIndex) => {
                        setHighlightedRowIndex(rowIndex);
                        window.setTimeout(() => setHighlightedRowIndex((prev) => (prev === rowIndex ? null : prev)), 1800);
                      }}
                      onChangeRecommendationMode={(mode) => {
                        setManualRecommendationRowOrder(null);
                        setRecommendationMode(mode);
                        if (mode === "road" && !roadRecommendedOrder && !roadRecommendationLoading) {
                          void onComputeRoadRecommendation();
                        }
                      }}
                      onMoveRecommendation={(rowIndex, direction) => {
                        setManualRecommendationRowOrder((prev) => {
                          const current = (prev && prev.length > 0 ? prev : recommendedOrder.map((item) => item.rowIndex)).slice();
                          const index = current.indexOf(rowIndex);
                          if (index < 0) return current;
                          const nextIndex = direction === "up" ? index - 1 : index + 1;
                          if (nextIndex < 0 || nextIndex >= current.length) return current;
                          const [moved] = current.splice(index, 1);
                          current.splice(nextIndex, 0, moved);
                          return current;
                        });
                      }}
                      onResetRecommendationOrder={() => setManualRecommendationRowOrder(null)}
                      onReorderRecommendation={onReorderRecommendation}
                      onComputeRoadRecommendation={() => void onComputeRoadRecommendation()}
                      developmentRequests={developmentRequests}
                      developmentRequestsLoading={developmentRequestsLoading}
                      developmentRequestsError={developmentRequestsError}
                      onRefreshDevelopmentRequests={() => void loadDevelopmentRequests()}
                      onSubmitDevelopmentRequest={onSubmitDevelopmentRequest}
                    />
                  </div>
                )}
              </section>
            ) : (
              <ResultPanel
                segments={segments}
                finalDongList={finalShortList}
                finalDongEntries={finalDongEntries}
                viewMode={settings.viewMode}
                recommendedOrder={recommendedOrder}
                manualOrderActive={Boolean(manualRecommendationRowOrder?.length)}
                recommendationMode={recommendationMode}
                roadRecommendationLoading={roadRecommendationLoading}
                roadRecommendationError={roadRecommendationError}
                onSelectRecommendation={(rowIndex) => {
                  setHighlightedRowIndex(rowIndex);
                  window.setTimeout(() => setHighlightedRowIndex((prev) => (prev === rowIndex ? null : prev)), 1800);
                }}
                onChangeRecommendationMode={(mode) => {
                  setManualRecommendationRowOrder(null);
                  setRecommendationMode(mode);
                  if (mode === "road" && !roadRecommendedOrder && !roadRecommendationLoading) {
                    void onComputeRoadRecommendation();
                  }
                }}
                onMoveRecommendation={(rowIndex, direction) => {
                  setManualRecommendationRowOrder((prev) => {
                    const current = (prev && prev.length > 0 ? prev : recommendedOrder.map((item) => item.rowIndex)).slice();
                    const index = current.indexOf(rowIndex);
                    if (index < 0) return current;
                    const nextIndex = direction === "up" ? index - 1 : index + 1;
                    if (nextIndex < 0 || nextIndex >= current.length) return current;
                    const [moved] = current.splice(index, 1);
                    current.splice(nextIndex, 0, moved);
                    return current;
                  });
                }}
                onResetRecommendationOrder={() => setManualRecommendationRowOrder(null)}
                onReorderRecommendation={onReorderRecommendation}
                onComputeRoadRecommendation={() => void onComputeRoadRecommendation()}
                developmentRequests={developmentRequests}
                developmentRequestsLoading={developmentRequestsLoading}
                developmentRequestsError={developmentRequestsError}
                onRefreshDevelopmentRequests={() => void loadDevelopmentRequests()}
                onSubmitDevelopmentRequest={onSubmitDevelopmentRequest}
              />
            )}

            {dailyRouteRuns[0] ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">최근 저장된 동 리스트</h3>
                  <span className="text-xs text-slate-500">
                    {new Date(dailyRouteRuns[0].created_at).toLocaleTimeString()} ·{" "}
                    {getRouteRunProviderLabel(dailyRouteRuns[0].provider)}
                  </span>
                </div>
                <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                  {dailyRouteRuns[0].final_short_list_text || "저장된 동 리스트가 없습니다."}
                </p>
                {(dailyRouteRuns[0].route_stops?.length ?? 0) > 0 ? (
                  <ol className="mt-2 space-y-1 text-xs text-slate-600">
                    {(dailyRouteRuns[0].route_stops ?? []).map((stop) => (
                      <li key={`${dailyRouteRuns[0].id}-${stop.step}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                        {stop.step}. {stop.name}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-800">네이버 지도</h2>
            {isMobileLayout ? (
              <button
                type="button"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
                onClick={() => setMapPanelOpenMobile((prev) => !prev)}
              >
                {mapPanelOpenMobile ? "접기" : "펼치기"}
              </button>
            ) : null}
          </div>
          {isMobileLayout && !mapPanelOpenMobile ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              지도가 길어서 기본 접힘 상태입니다. 필요할 때 펼쳐서 확인하세요.
            </div>
          ) : iosSafeMode && mapDeferred ? (
            <div className="flex min-h-[42vh] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="max-w-sm text-center">
                <p className="text-sm font-medium text-slate-700">지도 로드를 지연하고 있습니다.</p>
                <p className="mt-1 text-xs text-slate-500">
                  iOS 브라우저에서 초기 로딩 안정성을 위해 필요할 때만 지도를 로드합니다.
                </p>
                <button
                  type="button"
                  className="mt-3 h-11 rounded-lg bg-cyan-700 px-4 text-sm font-medium text-white"
                  onClick={() => {
                    setMapDeferred(false);
                    setMapPanelOpenMobile(true);
                  }}
                >
                  지도 로드하기
                </button>
              </div>
            </div>
          ) : (
            <NaverMap
              key={mapRenderKey}
              origin={origin}
              destinations={rows.map((row, index) => ({
                coord: row.coord,
                label: (row.label ?? row.input) || `도착지 ${index + 1}`,
                recommendStep: recommendedOrder.find((item) => item.rowIndex === index)?.step,
                highlighted: highlightedRowIndex === index,
              }))}
              segments={segments}
            />
          )}
        </section>
      </div>

      {storeModal ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-800">지도 앱 설치 안내</h3>
            <p className="mt-1 text-sm text-slate-600">앱이 실행되지 않으면 웹지도 또는 앱 설치를 선택하세요.</p>
            <div className="mt-3 grid gap-2">
              <a
                className="flex h-11 items-center justify-center rounded-lg border border-slate-300 text-sm"
                href={storeModal.mobileWeb}
                target="_blank"
                rel="noreferrer"
              >
                {"fallbackLabel" in storeModal && storeModal.fallbackLabel ? storeModal.fallbackLabel : "모바일 웹지도 열기"}
              </a>
              <a
                className="flex h-11 items-center justify-center rounded-lg border border-slate-300 text-sm"
                href={storeModal.storeUrl}
                target="_blank"
                rel="noreferrer"
              >
                {"storeLabel" in storeModal && storeModal.storeLabel ? storeModal.storeLabel : "지도 앱 설치"}
              </a>
              <button
                type="button"
                className="h-11 rounded-lg bg-slate-900 text-sm font-medium text-white"
                onClick={() => setStoreModal(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden">
        <div
          className={`mx-auto grid w-full max-w-6xl gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur ${
            rowsUndoStack.length > 0 ? "grid-cols-2" : "grid-cols-[1fr_auto]"
          }`}
        >
          <button
            type="button"
            className="flex h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onNavigateAll}
            disabled={routeableStops.length === 0}
          >
            전체 길찾기 {routeableStops.length > 0 ? `(${routeableStops.length})` : ""}
          </button>
          {rowsUndoStack.length > 0 ? (
            <button
              type="button"
              className="col-span-2 flex h-11 items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 px-2 text-xs font-semibold text-cyan-900"
              onClick={undoLastAutoRemove}
            >
              최근 목적지 되돌리기
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onAddRow}
            disabled={rows.length >= MAX_DESTINATIONS}
          >
            <span className="text-lg leading-none">+</span>
            도착지 추가
          </button>
        </div>
      </div>

      {incomingTransferToast ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+98px)] z-30 flex justify-center px-3 lg:bottom-6">
          <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
            <div className="text-sm font-medium text-emerald-900">{incomingTransferToast}</div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800"
              onClick={() => setIncomingTransferToast(null)}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {sessionUser?.isAllowed ? <EarningsStatsFab onClick={() => setEarningsStatsModalOpen(true)} /> : null}
      {sessionUser?.isAllowed ? <EarningsFab onClick={() => setEarningsModalOpen(true)} /> : null}
      <EarningsStatsModal open={earningsStatsModalOpen} onClose={() => setEarningsStatsModalOpen(false)} />
      <EarningsModal open={earningsModalOpen} onClose={() => setEarningsModalOpen(false)} />
    </main>
  );
}




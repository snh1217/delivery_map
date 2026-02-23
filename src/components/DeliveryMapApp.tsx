"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DestinationList } from "@/components/DestinationList";
import { EarningsFab } from "@/components/EarningsFab";
import { EarningsModal } from "@/components/EarningsModal";
import { EarningsStatsFab } from "@/components/EarningsStatsFab";
import { EarningsStatsModal } from "@/components/EarningsStatsModal";
import { NaverMap } from "@/components/NaverMap";
import { ResultPanel } from "@/components/ResultPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import centroidsRaw from "@/data/dong_centroids.json";
import { normalizeDongCentroids } from "@/lib/dong";
import { calculateSegments, makeFinalShortList, recommendVisitOrder } from "@/lib/geo";
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
import { searchNaverGeocode } from "@/lib/naverGeocode";
import type {
  DestinationRowState,
  GeocodeItem,
  LatLng,
  RouteRunRow,
  RouteRunStop,
  RouteRecommendationItem,
  RouteRecommendationMode,
  SessionUser,
  SettingsState,
} from "@/types";

const DEFAULT_ORIGIN: LatLng = { lat: 37.5665, lon: 126.978 };
const MAX_DESTINATIONS = 20;
const SETTINGS_STORAGE_KEY = "delivery_map_settings_v1";
const ROUTE_UNDO_STORAGE_KEY = "delivery_map_route_undo_v1";
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
      ? parsed.stack.filter((snapshot): snapshot is DestinationRowState[] => Array.isArray(snapshot))
      : [];

    const message = typeof parsed?.message === "string" ? parsed.message : null;

    return { stack, message };
  } catch {
    return { stack: [], message: null };
  }
}

function createRow(): DestinationRowState {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    input: "",
    status: "idle",
    geocodeItems: [],
    selectedIndex: 0,
  };
}

function applyGeocode(row: DestinationRowState, item: GeocodeItem, index: number) {
  return {
    ...row,
    status: "resolved" as const,
    selectedIndex: index,
    coord: { lat: item.lat, lon: item.lon },
    label: item.title,
    error: undefined,
  };
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
  const [dailyRouteRuns, setDailyRouteRuns] = useState<RouteRunRow[]>([]);
  const [dailyRouteDateKst, setDailyRouteDateKst] = useState<string>("");
  const [dailyRouteLoadError, setDailyRouteLoadError] = useState<string | null>(null);
  const [earningsModalOpen, setEarningsModalOpen] = useState(false);
  const [earningsStatsModalOpen, setEarningsStatsModalOpen] = useState(false);
  const [kakaoNaviCapability, setKakaoNaviCapability] = useState<KakaoNaviCapability>({
    supported: false,
    keyExists: false,
    keySourceVar: null,
    sdkLoaded: false,
    naviAvailable: false,
    message: "카카오내비 상태 확인 전",
  });

  const centroids = useMemo(() => normalizeDongCentroids(centroidsRaw), []);

  const syncCurrentLocation = (silent = false) => {
    if (!navigator.geolocation) {
      setLocationStatus("위치 기능 미지원: 서울시청 좌표를 사용합니다.");
      return;
    }
    setLocationSyncing(true);
    if (!silent) {
      setLocationStatus("현재 위치를 다시 동기화하는 중입니다...");
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocationStatus("현재 위치를 출발지로 사용합니다.");
        setLocationSyncing(false);
      },
      () => {
        setLocationStatus("위치 권한 거부: 서울시청 좌표를 사용합니다.");
        setLocationSyncing(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  useEffect(() => {
    syncCurrentLocation(true);
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
    let mounted = true;
    void detectKakaoNaviCapability().then((status) => {
      if (!mounted) return;
      setKakaoNaviCapability(status);
      console.info("[KakaoNavi] capability", status);
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

  useEffect(() => {
    setRoadRecommendedOrder(null);
    setManualRecommendationRowOrder(null);
    setRoadRecommendationError(null);
    setRecommendationMode((prev) => (prev === "road" ? "straight" : prev));
    setHighlightedRowIndex(null);
    setActiveRouteBatchIndex(null);
  }, [origin, rows]);

  const onSearch = async (id: string) => {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row || !row.input.trim()) {
      return;
    }

    setRows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "loading", error: undefined } : item)),
    );

    try {
      const items = (await searchNaverGeocode(row.input.trim())).slice(0, 5);
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
              }
            : item,
        ),
      );
    }
  };

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

  const onNavigate = (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row?.coord) {
      return;
    }

    if (settings.navigationApp === "kakaonavi") {
      if (!kakaoNaviCapability.supported) {
        setLastAutoRemovedMessage(kakaoNaviCapability.message);
        setStoreModal(createKakaoNaviInstallLinks());
        return;
      }
      void openKakaoNaviDirections(origin, row.coord, row.label ?? row.input)
        .then((result) => {
          if (result.links) {
            window.setTimeout(() => setStoreModal(result.links), 1200);
          }
        })
        .catch((error) => {
          setLastAutoRemovedMessage(
            error instanceof Error
              ? `${error.message} (카카오 개발자 콘솔 도메인 등록/키 설정 확인)`
              : "카카오내비 실행 실패",
          );
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
  };

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
    setRows((prev) => (prev.length >= MAX_DESTINATIONS ? prev : [...prev, createRow()]));
  };

  const segments = useMemo(() => {
    return calculateSegments({
      origin,
      destinations: rows.map((row) => ({ label: row.label ?? row.input, coord: row.coord })),
      settings,
      centroids,
    });
  }, [centroids, origin, rows, settings]);

  const finalShortList = useMemo(() => makeFinalShortList(segments), [segments]);
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
    const snapshot = rowsRef.current;
    if (snapshot.length > 0) {
      setRowsUndoStack((undoPrev) => [...undoPrev, snapshot]);
    }
    setRows((prev) => {
      const next = prev.filter((row) => !rowIds.includes(row.id));
      return next.length > 0 ? next : [createRow()];
    });
    setHighlightedRowIndex(null);
    setLastAutoRemovedMessage(message);
  };

  const undoLastAutoRemove = () => {
    setRowsUndoStack((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = [...prev];
      const restored = next.pop();
      if (restored) {
        setRows(restored);
        setLastAutoRemovedMessage(null);
      }
      return next;
    });
  };

  const onNavigateAll = () => {
    if (routeableStops.length === 0) {
      return;
    }
    setActiveRouteBatchIndex(routeBatches.length > 1 ? 0 : null);

    if (settings.navigationApp === "kakaonavi") {
      if (!kakaoNaviCapability.supported) {
        setLastAutoRemovedMessage(kakaoNaviCapability.message);
        setStoreModal(createKakaoNaviInstallLinks());
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
        setLastAutoRemovedMessage(kakaoNaviCapability.message);
        setStoreModal(createKakaoNaviInstallLinks());
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

  return (
    <main className="min-h-screen bg-slate-50 px-2 py-3 pb-28 sm:px-4 sm:py-4 sm:pb-32 lg:pb-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h1 className="text-xl font-bold text-slate-800">퀵서비스 구설정 자동 생성</h1>
          <div className="mt-2 inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800">
            출발지(고정): 내 현재 위치
          </div>
          <div className="mt-2">
            <button
              type="button"
              className="h-10 rounded-lg border border-cyan-300 bg-white px-3 text-sm text-cyan-700 disabled:opacity-50"
              onClick={() => syncCurrentLocation(false)}
              disabled={locationSyncing}
            >
              {locationSyncing ? "내 위치 동기화 중..." : "내 위치 동기화"}
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
          />

          <div className="space-y-3">
            <ResultPanel
              segments={segments}
              finalShortList={finalShortList}
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
              onComputeRoadRecommendation={() => void onComputeRoadRecommendation()}
            />

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
          <h2 className="mb-2 text-base font-semibold text-slate-800">네이버 지도</h2>
          <NaverMap
            origin={origin}
            destinations={rows.map((row, index) => ({
              coord: row.coord,
              label: (row.label ?? row.input) || `도착지 ${index + 1}`,
              recommendStep: recommendedOrder.find((item) => item.rowIndex === index)?.step,
              highlighted: highlightedRowIndex === index,
            }))}
            segments={segments}
          />
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
            rowsUndoStack.length > 0 ? "grid-cols-3" : "grid-cols-[1fr_auto]"
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
              className="flex h-12 items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 px-2 text-xs font-semibold text-cyan-900"
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

      {sessionUser?.isAllowed ? <EarningsStatsFab onClick={() => setEarningsStatsModalOpen(true)} /> : null}
      {sessionUser?.isAllowed ? <EarningsFab onClick={() => setEarningsModalOpen(true)} /> : null}
      <EarningsStatsModal open={earningsStatsModalOpen} onClose={() => setEarningsStatsModalOpen(false)} />
      <EarningsModal open={earningsModalOpen} onClose={() => setEarningsModalOpen(false)} />
    </main>
  );
}

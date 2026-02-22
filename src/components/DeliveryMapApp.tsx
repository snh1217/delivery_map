"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DestinationList } from "@/components/DestinationList";
import { NaverMap } from "@/components/NaverMap";
import { ResultPanel } from "@/components/ResultPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import centroidsRaw from "@/data/dong_centroids.json";
import { normalizeDongCentroids } from "@/lib/dong";
import { calculateSegments, makeFinalShortList, recommendVisitOrder } from "@/lib/geo";
import { openNaverDirections, type NaverDirectionLinkSet } from "@/lib/naverDeepLink";
import { searchNaverGeocode } from "@/lib/naverGeocode";
import type { DestinationRowState, GeocodeItem, LatLng, SessionUser, SettingsState } from "@/types";

const DEFAULT_ORIGIN: LatLng = { lat: 37.5665, lon: 126.978 };
const SETTINGS_STORAGE_KEY = "delivery_map_settings_v1";
const DEFAULT_SETTINGS: SettingsState = {
  halfAngleDeg: 30,
  forwardBufferKm: 3,
  backwardTailKm: 5,
  forwardRadiusMinKm: 2,
  arcSteps: 72,
  autoSearch: false,
  viewMode: "segment",
};

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

export function DeliveryMapApp({ sessionUser }: Props) {
  const router = useRouter();
  const [origin, setOrigin] = useState<LatLng>(DEFAULT_ORIGIN);
  const [locationStatus, setLocationStatus] = useState("내 위치를 확인하는 중입니다...");
  const [rows, setRows] = useState<DestinationRowState[]>([createRow()]);
  const [settings, setSettings] = useState<SettingsState>(loadSavedSettings);
  const [storeModal, setStoreModal] = useState<NaverDirectionLinkSet | null>(null);

  const centroids = useMemo(() => normalizeDongCentroids(centroidsRaw), []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("위치 기능 미지원: 서울시청 좌표를 사용합니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocationStatus("현재 위치를 출발지로 사용합니다.");
      },
      () => {
        setLocationStatus("위치 권한 거부: 서울시청 좌표를 사용합니다.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [settings]);

  const onSearch = async (id: string) => {
    const row = rows.find((item) => item.id === id);
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

    const result = openNaverDirections(origin, row.coord, row.label ?? row.input);
    if (result.usedAppScheme) {
      window.setTimeout(() => setStoreModal(result.links), 1300);
    }
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
  const recommendedOrder = useMemo(
    () =>
      recommendVisitOrder({
        origin,
        destinations: rows.map((row) => ({ label: (row.label ?? row.input) || "이름 없음", coord: row.coord })),
      }),
    [origin, rows],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-2 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h1 className="text-xl font-bold text-slate-800">퀵서비스 구설정 자동 생성</h1>
          <div className="mt-2 inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800">
            출발지(고정): 내 현재 위치
          </div>
          <p className="mt-1 text-sm text-slate-600">출발지: 내 현재 위치(GPS), 권한 거부 시 서울시청 좌표</p>
          <div className="mt-2 rounded-xl bg-slate-100 px-3 py-3 text-xs leading-5 text-slate-700">
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
            위치 상태: {locationStatus}
            <br />
            승인 상태: {sessionUser?.isAllowed ? "허용" : "미허용"}
            {sessionUser?.isAdmin ? (
              <>
                <br />
                관리자 안내: 회원가입 요청 승인/반려는 상단 관리자 승인 관리 버튼에서 처리합니다.
              </>
            ) : null}
          </div>
        </section>

        <SettingsPanel settings={settings} onChange={(next) => setSettings(sanitizeSettings(next))} />

        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr] lg:gap-4">
          <DestinationList
            rows={rows}
            origin={origin}
            autoSearch={settings.autoSearch}
            onAdd={() => setRows((prev) => (prev.length >= 10 ? prev : [...prev, createRow()]))}
            onReset={() => setRows([createRow()])}
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
            onDelete={(id) => setRows((prev) => prev.filter((item) => item.id !== id))}
            onSelectCandidate={onSelectCandidate}
            onNavigate={onNavigate}
          />

          <ResultPanel
            segments={segments}
            finalShortList={finalShortList}
            viewMode={settings.viewMode}
            recommendedOrder={recommendedOrder}
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-slate-800">네이버 지도</h2>
          <NaverMap
            origin={origin}
            destinations={rows.map((row, index) => ({
              coord: row.coord,
              label: (row.label ?? row.input) || `도착지 ${index + 1}`,
            }))}
            segments={segments}
          />
        </section>
      </div>

      {storeModal ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-800">앱 설치 안내</h3>
            <p className="mt-1 text-sm text-slate-600">앱이 실행되지 않으면 웹지도 또는 앱 설치를 선택하세요.</p>
            <div className="mt-3 grid gap-2">
              <a
                className="flex h-11 items-center justify-center rounded-lg border border-slate-300 text-sm"
                href={storeModal.mobileWeb}
                target="_blank"
                rel="noreferrer"
              >
                모바일 웹지도 열기
              </a>
              <a
                className="flex h-11 items-center justify-center rounded-lg border border-slate-300 text-sm"
                href={storeModal.storeUrl}
                target="_blank"
                rel="noreferrer"
              >
                네이버지도 설치
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
    </main>
  );
}

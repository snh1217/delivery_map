"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_BEFORE_UPDATE_RELOAD_EVENT, APP_BUILD_ID, CURRENT_RELEASE, type AppRelease } from "@/lib/appRelease";
import { addNativeResumeListener } from "@/lib/native/app";

const SEEN_RELEASE_KEY = "delivery_map_seen_release_v1";
const RELOAD_ATTEMPT_KEY = "delivery_map_update_reload_target_v1";
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

type VersionResponse = {
  buildId?: string;
  release?: AppRelease;
};

function readStorage(storage: "local" | "session", key: string) {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function hasExistingAppData() {
  try {
    return Object.keys(window.localStorage).some(
      (key) => key.startsWith("delivery_map_") && key !== SEEN_RELEASE_KEY,
    );
  } catch {
    return false;
  }
}

export function AppUpdateManager() {
  const pathname = usePathname();
  const [updating, setUpdating] = useState<AppRelease | null>(null);
  const [progress, setProgress] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const checkingRef = useRef(false);

  const hidden = pathname?.startsWith("/extractor") || pathname?.startsWith("/install");

  // 새 배포가 감지되면 최신 화면을 내려받아 적용(새로고침)합니다.
  const checkForUpdate = useCallback(async () => {
    if (checkingRef.current || APP_BUILD_ID === "dev") return;
    checkingRef.current = true;
    try {
      const response = await fetch(`/api/app-version?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as VersionResponse;
      if (!data.buildId || data.buildId === APP_BUILD_ID) return;

      // 같은 대상 빌드로 이미 새로고침을 시도했다면 반복하지 않습니다(캐시/CDN 지연 대비).
      if (readStorage("session", RELOAD_ATTEMPT_KEY) === data.buildId) return;
      writeStorage("session", RELOAD_ATTEMPT_KEY, data.buildId);

      setUpdating(data.release ?? CURRENT_RELEASE);
    } catch {
      // 오프라인 등은 조용히 무시
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!updating) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / 1600);
      setProgress(Math.round(ratio * 100));
      if (ratio >= 1) {
        window.clearInterval(timer);
        window.dispatchEvent(new Event(APP_BEFORE_UPDATE_RELOAD_EVENT));
        window.location.reload();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [updating]);

  useEffect(() => {
    void checkForUpdate();

    let removeResume = () => {};
    void addNativeResumeListener(() => void checkForUpdate()).then((remove) => {
      removeResume = remove;
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);

    return () => {
      removeResume();
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [checkForUpdate]);

  // 업데이트 후 처음 실행 시 업데이트 내역을 보여줍니다.
  useEffect(() => {
    const seen = readStorage("local", SEEN_RELEASE_KEY);
    if (seen === CURRENT_RELEASE.version) return;
    if (!seen && !hasExistingAppData()) {
      // 처음 설치한 사용자에게는 표시하지 않습니다.
      writeStorage("local", SEEN_RELEASE_KEY, CURRENT_RELEASE.version);
      return;
    }
    setChangelogOpen(true);
  }, []);

  const closeChangelog = () => {
    writeStorage("local", SEEN_RELEASE_KEY, CURRENT_RELEASE.version);
    setChangelogOpen(false);
  };

  if (updating) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-6 backdrop-blur-sm">
        <div className="app-sheet-in w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <svg viewBox="0 0 24 24" className="h-6 w-6 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.2-8.56" />
            </svg>
          </div>
          <div className="mt-4 text-base font-bold text-slate-900">새 버전으로 업데이트 중</div>
          <p className="mt-1 text-xs text-slate-500">
            v{updating.version} · {updating.title}
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-cyan-600 transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">잠시만 기다려 주세요. 자동으로 다시 시작됩니다.</p>
        </div>
      </div>
    );
  }

  if (!changelogOpen || hidden) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div className="app-sheet-in w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="bg-gradient-to-br from-cyan-700 to-teal-700 px-5 pb-5 pt-6 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">업데이트 완료</div>
          <div className="mt-1.5 text-xl font-extrabold tracking-tight">{CURRENT_RELEASE.title}</div>
          <div className="mt-1 text-xs text-cyan-100">
            v{CURRENT_RELEASE.version} · {CURRENT_RELEASE.date}
          </div>
        </div>
        <ul className="space-y-2.5 px-5 py-4">
          {CURRENT_RELEASE.notes.map((note) => (
            <li key={note} className="flex gap-2.5 text-sm leading-6 text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" aria-hidden="true" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-5">
          <button type="button" className="app-btn app-btn-primary h-12 w-full" onClick={closeChangelog}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

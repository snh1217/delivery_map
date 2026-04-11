"use client";

import { useEffect, useMemo, useState } from "react";
import { isNativeApp } from "@/lib/native/runtime";

const latestVersion = process.env.NEXT_PUBLIC_ANDROID_LATEST_VERSION?.trim() || "";
const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || "";
const playUrl = process.env.NEXT_PUBLIC_ANDROID_PLAY_URL?.trim() || "";

const DISMISSED_VERSION_KEY = "delivery_map_native_update_dismissed_v1";

function compareVersions(a: string, b: string) {
  const aParts = a.split(".").map((part) => Number(part) || 0);
  const bParts = b.split(".").map((part) => Number(part) || 0);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

export function NativeAppUpdatePrompt() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [open, setOpen] = useState(false);

  const downloadUrl = useMemo(() => playUrl || apkUrl || "/install/android", []);

  useEffect(() => {
    if (!isNativeApp() || !latestVersion) return;

    let mounted = true;

    const load = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (!mounted) return;

        const version = info.version?.trim() || "";
        setCurrentVersion(version);

        const dismissedVersion = window.localStorage.getItem(DISMISSED_VERSION_KEY) || "";
        if (dismissedVersion === latestVersion) return;

        if (!version || compareVersions(latestVersion, version) > 0) {
          setOpen(true);
        }
      } catch {
        // ignore version lookup failures
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  if (!open || !isNativeApp() || !latestVersion) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5rem))] z-[80] px-3 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm">
      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl">
        <div className="text-sm font-semibold text-slate-900">새 앱 버전이 있습니다</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          현재 버전 {currentVersion || "-"} / 최신 버전 {latestVersion}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          설치 후 기존 앱 위에 덮어써서 업데이트할 수 있습니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
            onClick={() => {
              window.localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion);
              setOpen(false);
            }}
          >
            나중에
          </button>
          <a
            href={downloadUrl}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white"
          >
            업데이트
          </a>
        </div>
      </div>
    </div>
  );
}

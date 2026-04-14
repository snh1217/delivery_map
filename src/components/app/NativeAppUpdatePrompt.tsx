"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isNativeApp } from "@/lib/native/runtime";

const MAIN_LATEST_VERSION = process.env.NEXT_PUBLIC_ANDROID_LATEST_VERSION?.trim() || "1.0.1";
const MAIN_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || "/install/android";
const MAIN_PLAY_URL = process.env.NEXT_PUBLIC_ANDROID_PLAY_URL?.trim() || "";
const EXTRACTOR_LATEST_VERSION = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_LATEST_VERSION?.trim() || "1.0.2-extractor";
const EXTRACTOR_APK_URL = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_APK_URL?.trim() || "/install/extractor-android";
const EXTRACTOR_PLAY_URL = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_PLAY_URL?.trim() || "";

function compareVersions(a: string, b: string) {
  const aParts = a.split(".").map((part) => Number(part.replace(/[^0-9]/g, "")) || 0);
  const bParts = b.split(".").map((part) => Number(part.replace(/[^0-9]/g, "")) || 0);
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
  const pathname = usePathname();
  const [currentVersion, setCurrentVersion] = useState("");
  const [open, setOpen] = useState(false);

  const isExtractorPath = pathname?.startsWith("/extractor") || pathname?.startsWith("/install/extractor-android");
  const latestVersion = isExtractorPath ? EXTRACTOR_LATEST_VERSION : MAIN_LATEST_VERSION;
  const downloadUrl = isExtractorPath
    ? EXTRACTOR_PLAY_URL || EXTRACTOR_APK_URL || "/install/extractor-android"
    : MAIN_PLAY_URL || MAIN_APK_URL || "/install/android";
  const dismissedKey = isExtractorPath
    ? "delivery_map_native_update_dismissed_extractor_v1"
    : "delivery_map_native_update_dismissed_main_v1";
  const title = isExtractorPath ? "구역 추출기 새 버전이 있습니다" : "새 앱 버전이 있습니다";
  const body = isExtractorPath
    ? "구역 추출기 최신 버전을 덮어 설치하면 한글 표시와 오버레이 동작이 더 안정적으로 동작합니다."
    : "최신 버전을 덮어 설치하면 기능 수정과 안정화가 함께 반영됩니다.";

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

        const dismissedVersion = window.localStorage.getItem(dismissedKey) || "";
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
  }, [dismissedKey, latestVersion]);

  if (!open || !isNativeApp() || !latestVersion) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5rem))] z-[80] px-3 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm">
      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          현재 버전 {currentVersion || "-"} / 최신 버전 {latestVersion}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600">{body}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
            onClick={() => {
              window.localStorage.setItem(dismissedKey, latestVersion);
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

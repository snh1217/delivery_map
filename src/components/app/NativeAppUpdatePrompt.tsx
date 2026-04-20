"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isNativeApp } from "@/lib/native/runtime";

const MAIN_LATEST_VERSION = process.env.NEXT_PUBLIC_ANDROID_LATEST_VERSION?.trim() || "1.0.1";
const MAIN_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || "/install/android";
const MAIN_PLAY_URL = process.env.NEXT_PUBLIC_ANDROID_PLAY_URL?.trim() || "";
const MAIN_UPDATED_AT = "2026-04-14";
const EXTRACTOR_LATEST_VERSION = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_LATEST_VERSION?.trim() || "1.0.8-extractor";
const EXTRACTOR_APK_URL = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_APK_URL?.trim() || "/install/extractor-android";
const EXTRACTOR_PLAY_URL = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_PLAY_URL?.trim() || "";
const EXTRACTOR_UPDATED_AT = "2026-04-20";

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
  const title = isExtractorPath ? "구역 추출기 새 버전이 있습니다" : "새 버전이 있습니다";
  const body = isExtractorPath
    ? "구역 추출기 최신 버전을 설치하면 권한 설정 도우미와 접근성 주소 추출이 더 안정적으로 동작합니다."
    : "최신 버전을 설치하면 기능 수정과 안정화가 함께 반영됩니다.";
  const updatedAt = isExtractorPath ? EXTRACTOR_UPDATED_AT : MAIN_UPDATED_AT;
  const highlights = isExtractorPath
    ? ["권한 설정 도우미 추가", "접근성 주소 추출 안정화", "OCR 캡처 fallback 유지"]
    : ["앱 권한 요청 보강", "길찾기 복귀 화면 안정화", "모바일 입력 흐름 최적화"];

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
        // Native version lookup can fail on older WebView builds. The prompt is optional.
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
    <div className="fixed inset-x-0 bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5rem))] z-[80] px-3 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md">
      <div className="overflow-hidden rounded-3xl border border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_45%,#f0fdf4_100%)] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Update Available
            </div>
            <div className="mt-3 text-base font-semibold text-slate-950">{title}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/80 px-3 py-2 text-right text-[11px] text-slate-600">
            <div>최신 버전</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{latestVersion}</div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          현재 설치 버전 <span className="font-semibold text-slate-900">{currentVersion || "-"}</span> · 업데이트 날짜{" "}
          <span className="font-semibold text-slate-900">{updatedAt}</span>
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/80 p-3">
          <div className="text-xs font-semibold text-slate-900">이번 업데이트 내용</div>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
            {highlights.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-11 rounded-2xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
            onClick={() => {
              window.localStorage.setItem(dismissedKey, latestVersion);
              setOpen(false);
            }}
          >
            나중에
          </button>
          <a
            href={downloadUrl}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm"
          >
            지금 업데이트
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getCoreAppPermissionStates, requestCoreAppPermissions, type PermissionRequestResult } from "@/lib/native/permissions";
import { isNativeApp } from "@/lib/native/runtime";

const LABELS: Record<PermissionRequestResult["state"], string> = {
  granted: "허용",
  prompt: "요청 가능",
  denied: "거부됨",
  unsupported: "미지원",
  unknown: "확인 필요",
};

export function NativePermissionStatus() {
  const [states, setStates] = useState<{ location: PermissionRequestResult["state"]; camera: PermissionRequestResult["state"]; microphone: PermissionRequestResult["state"] } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!isNativeApp()) return;
    setLoading(true);
    try {
      const next = await getCoreAppPermissionStates();
      setStates(next);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!isNativeApp()) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-700">앱 권한 상태</span>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
          onClick={async () => {
            await requestCoreAppPermissions();
            await refresh();
          }}
          disabled={loading}
        >
          {loading ? "확인 중..." : "다시 요청"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1">위치: {LABELS[states?.location ?? "unknown"]}</div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1">카메라: {LABELS[states?.camera ?? "unknown"]}</div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-1">마이크: {LABELS[states?.microphone ?? "unknown"]}</div>
      </div>
    </div>
  );
}

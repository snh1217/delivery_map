"use client";

import { useMemo, useState } from "react";
import { isNativeApp, isStandalonePwa } from "@/lib/native/runtime";

const IOS_PWA_HINT_DISMISS_KEY = "delivery_map_ios_pwa_hint_dismissed_v1";

function detectIosWeb() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
}

export function IosPwaHint() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(IOS_PWA_HINT_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const shouldShow = useMemo(() => detectIosWeb() && !isStandalonePwa() && !isNativeApp(), []);

  if (!shouldShow || dismissed) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-950 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">아이폰에서는 홈 화면 추가 방식이 가장 안정적입니다.</div>
          <p className="mt-1 text-xs leading-5 text-cyan-900">
            Safari 또는 Chrome 공유 버튼에서 <span className="font-medium">홈 화면에 추가</span>를 선택하면 앱처럼 더
            안정적으로 사용할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-cyan-300 bg-white px-2 py-1 text-xs text-cyan-900"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(IOS_PWA_HINT_DISMISS_KEY, "1");
            } catch {
              // ignore storage failures
            }
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

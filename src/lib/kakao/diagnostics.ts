"use client";

import { getKakaoSdkKeyInfo, loadKakaoSdk, resetKakaoSdkLoader } from "@/lib/kakao/sdkLoader";

export type KakaoNaviDiagnosticReasonCode =
  | "KEY_MISSING"
  | "SDK_LOAD_FAILED"
  | "NAVI_API_UNAVAILABLE"
  | "DOMAIN_NOT_ALLOWED";

export type KakaoNaviDiagnosticsResult = {
  ok: boolean;
  hostname: string;
  checks: {
    hasJsKey: boolean;
    sdkLoaded: boolean;
    hasNavi: boolean;
  };
  reasonCodes: KakaoNaviDiagnosticReasonCode[];
};

function getHostname() {
  if (typeof window === "undefined") return "server";
  return window.location.hostname || "unknown";
}

export async function runKakaoNaviDiagnostics(options?: { reload?: boolean }): Promise<KakaoNaviDiagnosticsResult> {
  const checks = {
    hasJsKey: false,
    sdkLoaded: false,
    hasNavi: false,
  };
  const reasonCodes: KakaoNaviDiagnosticReasonCode[] = [];

  if (options?.reload) {
    resetKakaoSdkLoader();
  }

  const keyInfo = getKakaoSdkKeyInfo();
  checks.hasJsKey = keyInfo.exists;

  if (!checks.hasJsKey) {
    reasonCodes.push("KEY_MISSING");
    return {
      ok: false,
      hostname: getHostname(),
      checks,
      reasonCodes,
    };
  }

  try {
    const kakao = await loadKakaoSdk();
    checks.sdkLoaded = true;
    checks.hasNavi = Boolean(kakao?.Navi?.start);

    if (!checks.hasNavi) {
      reasonCodes.push("NAVI_API_UNAVAILABLE");
      reasonCodes.push("DOMAIN_NOT_ALLOWED");
    }
  } catch {
    checks.sdkLoaded = false;
    checks.hasNavi = false;
    reasonCodes.push("SDK_LOAD_FAILED");
  }

  return {
    ok: checks.hasJsKey && checks.sdkLoaded && checks.hasNavi,
    hostname: getHostname(),
    checks,
    reasonCodes,
  };
}

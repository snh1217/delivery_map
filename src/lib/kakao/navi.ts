"use client";

import type { LatLng } from "@/types";
import { detectKakaoPlatform } from "@/lib/kakaoDeepLink";
import type { RoutePoint } from "@/lib/naverDeepLink";
import { getKakaoSdkKeyInfo, loadKakaoSdk } from "@/lib/kakao/sdkLoader";

export type KakaoNaviCapability = {
  supported: boolean;
  keyExists: boolean;
  keySourceVar: string | null;
  sdkLoaded: boolean;
  naviAvailable: boolean;
  message: string;
};

export type KakaoNaviInstallLinks = {
  kind: "kakaonavi";
  mobileWeb: string;
  desktopWeb: string;
  storeUrl: string;
  fallbackLabel: string;
  storeLabel: string;
};

function kakaoNaviGuideUrl() {
  return "https://kakaonavi.kakao.com/home";
}

function kakaoNaviStoreUrl() {
  const platform = detectKakaoPlatform();
  if (platform === "ios") {
    return "https://apps.apple.com/kr/search?term=%EC%B9%B4%EC%B9%B4%EC%98%A4%EB%82%B4%EB%B9%84";
  }
  if (platform === "android") {
    return "https://play.google.com/store/search?q=%EC%B9%B4%EC%B9%B4%EC%98%A4%EB%82%B4%EB%B9%84&c=apps";
  }
  return kakaoNaviGuideUrl();
}

export function createKakaoNaviInstallLinks(): KakaoNaviInstallLinks {
  const guide = kakaoNaviGuideUrl();
  return {
    kind: "kakaonavi",
    mobileWeb: guide,
    desktopWeb: guide,
    storeUrl: kakaoNaviStoreUrl(),
    fallbackLabel: "카카오내비 안내/도움말",
    storeLabel: "카카오내비 설치",
  };
}

export async function detectKakaoNaviCapability(): Promise<KakaoNaviCapability> {
  const keyInfo = getKakaoSdkKeyInfo();
  if (!keyInfo.exists) {
    return {
      supported: false,
      keyExists: false,
      keySourceVar: null,
      sdkLoaded: false,
      naviAvailable: false,
      message: "카카오 JavaScript 키가 없어 카카오내비를 사용할 수 없습니다.",
    };
  }

  try {
    const kakao = await loadKakaoSdk();
    const naviAvailable = Boolean(kakao?.Navi?.start);
    return {
      supported: naviAvailable,
      keyExists: true,
      keySourceVar: keyInfo.sourceVar,
      sdkLoaded: true,
      naviAvailable,
      message: naviAvailable
        ? "카카오 SDK와 카카오내비 호출 준비가 완료되었습니다."
        : "카카오 SDK는 로드됐지만 Kakao.Navi API를 찾지 못했습니다. SDK/도메인 설정을 확인하세요.",
    };
  } catch (error) {
    return {
      supported: false,
      keyExists: true,
      keySourceVar: keyInfo.sourceVar,
      sdkLoaded: false,
      naviAvailable: false,
      message:
        error instanceof Error
          ? `${error.message} (카카오 개발자 콘솔의 JavaScript 키/도메인 등록을 확인하세요)`
          : "카카오내비 준비 상태를 확인하지 못했습니다.",
    };
  }
}

function buildNaviViaList(stops: RoutePoint[]) {
  if (stops.length <= 1) return [];
  return stops.slice(0, -1).map((stop) => ({
    x: stop.lon,
    y: stop.lat,
    name: stop.name || "경유지",
  }));
}

async function startKakaoNaviRoute(params: {
  origin: LatLng;
  orderedStops: RoutePoint[];
}) {
  const kakao = await loadKakaoSdk();
  if (!kakao?.Navi?.start) {
    throw new Error("Kakao.Navi.start API를 사용할 수 없습니다.");
  }

  if (params.orderedStops.length === 0) {
    throw new Error("목적지 정보가 없습니다.");
  }

  const destination = params.orderedStops[params.orderedStops.length - 1];
  const viaList = buildNaviViaList(params.orderedStops);

  const payload = {
    name: destination.name || "도착지",
    x: destination.lon,
    y: destination.lat,
    coordType: "wgs84",
    location: {
      name: "현재위치",
      x: params.origin.lon,
      y: params.origin.lat,
    },
    viaList,
  };

  try {
    kakao.Navi.start(payload);
  } catch {
    // Some environments reject `location` or `viaList` combinations.
    kakao.Navi.start({
      name: destination.name || "도착지",
      x: destination.lon,
      y: destination.lat,
      coordType: "wgs84",
      ...(viaList.length > 0 ? { viaList } : {}),
    });
  }
}

export async function openKakaoNaviDirections(origin: LatLng, destination: LatLng, name: string) {
  const links = createKakaoNaviInstallLinks();
  const platform = detectKakaoPlatform();

  if (platform === "desktop") {
    window.open(links.desktopWeb, "_blank", "noopener,noreferrer");
    return { supported: false as const, usedAppScheme: false, links, message: "카카오내비는 모바일 앱에서 사용 가능합니다." };
  }

  await startKakaoNaviRoute({
    origin,
    orderedStops: [{ lat: destination.lat, lon: destination.lon, name }],
  });
  return { supported: true as const, usedAppScheme: true, links };
}

export async function openKakaoNaviMultiDirections(origin: LatLng, orderedStops: RoutePoint[], maxStops = 2) {
  const links = createKakaoNaviInstallLinks();
  const platform = detectKakaoPlatform();
  if (orderedStops.length === 0) {
    return { supported: false as const, usedAppScheme: false, links, message: "도착지가 없습니다." };
  }

  if (orderedStops.length > maxStops) {
    return {
      supported: false as const,
      usedAppScheme: false,
      links,
      message: `카카오내비 자동 전송은 현재 최대 ${maxStops}개 도착지까지 지원됩니다.`,
    };
  }

  if (platform === "desktop") {
    window.open(links.desktopWeb, "_blank", "noopener,noreferrer");
    return { supported: false as const, usedAppScheme: false, links, message: "카카오내비는 모바일 앱에서 사용 가능합니다." };
  }

  await startKakaoNaviRoute({ origin, orderedStops });
  return { supported: true as const, usedAppScheme: true, links };
}


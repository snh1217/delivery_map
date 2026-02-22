import type { LatLng } from "@/types";

export type KakaoDirectionLinkSet = {
  appScheme: string;
  mobileWeb: string;
  desktopWeb: string;
  storeUrl: string;
};

export type KakaoPlatform = "ios" | "android" | "desktop";

function encodeSegment(value: string) {
  return encodeURIComponent((value || "목적지").trim());
}

export function detectKakaoPlatform(): KakaoPlatform {
  if (typeof navigator === "undefined") {
    return "desktop";
  }

  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "ios";
  }
  if (/Android/i.test(ua)) {
    return "android";
  }
  return "desktop";
}

function kakaoStoreUrl() {
  const platform = detectKakaoPlatform();
  return platform === "ios"
    ? "https://apps.apple.com/kr/app/kakaomap-korea-no-1-map/id304608425"
    : "https://play.google.com/store/apps/details?id=net.daum.android.map";
}

export function createKakaoMapDirectionLinks(origin: LatLng, destination: LatLng, name: string): KakaoDirectionLinkSet {
  const fromName = "현재위치";
  const toName = name || "도착지";

  // KakaoMap URL link (web/app universal handling). `link/from/.../to/...` is the most stable browser fallback.
  const routeWeb = `https://map.kakao.com/link/from/${encodeSegment(fromName)},${origin.lat},${origin.lon}/to/${encodeSegment(toName)},${destination.lat},${destination.lon}`;

  // KakaoMap scheme route (앱 설치 시 직접 시도). 브라우저별 동작 차이가 있어 web fallback을 함께 사용.
  const appScheme = `kakaomap://route?sp=${origin.lat},${origin.lon}&ep=${destination.lat},${destination.lon}&by=CAR`;

  return {
    appScheme,
    mobileWeb: routeWeb,
    desktopWeb: routeWeb,
    storeUrl: kakaoStoreUrl(),
  };
}

export function createKakaoMapSearchLink(query: string) {
  const safe = (query || "목적지").trim() || "목적지";
  return `https://map.kakao.com/link/search/${encodeSegment(safe)}`;
}

export function openKakaoMapDirections(origin: LatLng, destination: LatLng, name: string) {
  const links = createKakaoMapDirectionLinks(origin, destination, name);
  const platform = detectKakaoPlatform();

  if (platform === "desktop") {
    window.open(links.desktopWeb, "_blank", "noopener,noreferrer");
    return { links, usedAppScheme: false };
  }

  window.location.href = links.appScheme;
  window.setTimeout(() => {
    window.location.href = links.mobileWeb;
  }, 1200);

  return { links, usedAppScheme: true };
}


import type { LatLng } from "@/types";
import type { RoutePoint } from "@/lib/naverDeepLink";

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

  const routeWeb = `https://map.kakao.com/link/from/${encodeSegment(fromName)},${origin.lat},${origin.lon}/to/${encodeSegment(toName)},${destination.lat},${destination.lon}`;
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

export function createKakaoMapMultiDirectionLinks(origin: LatLng, orderedStops: RoutePoint[]): KakaoDirectionLinkSet | null {
  if (orderedStops.length === 0) {
    return null;
  }

  // KakaoMap route scheme supports a single waypoint parameter(vp).
  // We support up to 2 stops (waypoint + destination) for exact automatic routing.
  if (orderedStops.length > 2) {
    return null;
  }

  const destination = orderedStops[orderedStops.length - 1];
  const waypoint = orderedStops.length === 2 ? orderedStops[0] : null;

  const vpPart = waypoint ? `&vp=${waypoint.lat},${waypoint.lon}` : "";
  const appScheme = `kakaomap://route?sp=${origin.lat},${origin.lon}${vpPart}&ep=${destination.lat},${destination.lon}&by=CAR`;
  const mobileWeb = `https://m.map.kakao.com/scheme/route?sp=${origin.lat},${origin.lon}${vpPart}&ep=${destination.lat},${destination.lon}&by=CAR`;

  return {
    appScheme,
    mobileWeb,
    desktopWeb: mobileWeb,
    storeUrl: kakaoStoreUrl(),
  };
}

export function openKakaoMapMultiDirections(origin: LatLng, orderedStops: RoutePoint[]) {
  const links = createKakaoMapMultiDirectionLinks(origin, orderedStops);
  if (!links) {
    return { links: null, usedAppScheme: false, supported: false as const };
  }

  const platform = detectKakaoPlatform();
  if (platform === "desktop") {
    window.open(links.desktopWeb, "_blank", "noopener,noreferrer");
    return { links, usedAppScheme: false, supported: true as const };
  }

  window.location.href = links.appScheme;
  window.setTimeout(() => {
    window.location.href = links.mobileWeb;
  }, 1200);

  return { links, usedAppScheme: true, supported: true as const };
}

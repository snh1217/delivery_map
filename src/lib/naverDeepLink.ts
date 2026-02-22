import type { LatLng } from "@/types";

export type Platform = "ios" | "android" | "desktop";

export type NaverDirectionLinkSet = {
  appScheme: string;
  mobileWeb: string;
  desktopWeb: string;
  storeUrl: string;
};

function encodeText(value: string) {
  return encodeURIComponent(value || "목적지");
}

export function detectPlatform(): Platform {
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

export function createNaverDirectionLinks(origin: LatLng, destination: LatLng, name: string): NaverDirectionLinkSet {
  const target = name || "도착지";

  const appScheme = `nmap://route/car?slat=${origin.lat}&slng=${origin.lon}&sname=${encodeText("현재위치")}&dlat=${destination.lat}&dlng=${destination.lon}&dname=${encodeText(target)}&appname=quick.service.zone`;

  const mobileWeb = `https://m.map.naver.com/route.nhn?menu=route&slat=${origin.lat}&slng=${origin.lon}&sname=${encodeText("현재위치")}&dlat=${destination.lat}&dlng=${destination.lon}&dname=${encodeText(target)}&mt=1`;

  const desktopWeb = `https://map.naver.com/p/search/${encodeText(target)}`;

  const platform = detectPlatform();
  const storeUrl = platform === "ios"
    ? "https://apps.apple.com/kr/app/naver-map-navigation/id311867728"
    : "https://play.google.com/store/apps/details?id=com.nhn.android.nmap";

  return {
    appScheme,
    mobileWeb,
    desktopWeb,
    storeUrl,
  };
}

export function openNaverDirections(origin: LatLng, destination: LatLng, name: string) {
  const links = createNaverDirectionLinks(origin, destination, name);
  const platform = detectPlatform();

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

import type { LatLng } from "@/types";

export type Platform = "ios" | "android" | "desktop";

export type NaverDirectionLinkSet = {
  appScheme: string;
  mobileWeb: string;
  desktopWeb: string;
  storeUrl: string;
};

export type RoutePoint = {
  lat: number;
  lon: number;
  name: string;
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

function createStoreUrl() {
  const platform = detectPlatform();
  return platform === "ios"
    ? "https://apps.apple.com/kr/app/naver-map-navigation/id311867728"
    : "https://play.google.com/store/apps/details?id=com.nhn.android.nmap";
}

function buildRouteQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  return query.toString();
}

export function createNaverMultiDirectionLinks(origin: LatLng, orderedStops: RoutePoint[]): NaverDirectionLinkSet | null {
  if (orderedStops.length === 0) {
    return null;
  }

  const limitedStops = orderedStops.slice(0, 6);
  const destination = limitedStops[limitedStops.length - 1];
  const waypoints = limitedStops.slice(0, -1);

  const base: Record<string, string | number | undefined> = {
    slat: origin.lat,
    slng: origin.lon,
    sname: "현재위치",
    dlat: destination.lat,
    dlng: destination.lon,
    dname: destination.name || "도착지",
    appname: "quick.service.zone",
    menu: "route",
    mt: 1,
  };

  waypoints.forEach((point, index) => {
    const idx = index + 1;
    base[`v${idx}lat`] = point.lat;
    base[`v${idx}lng`] = point.lon;
    base[`v${idx}name`] = point.name || `경유지 ${idx}`;
  });

  const appQuery = buildRouteQuery({
    slat: origin.lat,
    slng: origin.lon,
    sname: "현재위치",
    dlat: destination.lat,
    dlng: destination.lon,
    dname: destination.name || "도착지",
    appname: "quick.service.zone",
    ...Object.fromEntries(
      waypoints.flatMap((point, index) => {
        const idx = index + 1;
        return [
          [`v${idx}lat`, point.lat],
          [`v${idx}lng`, point.lon],
          [`v${idx}name`, point.name || `경유지 ${idx}`],
        ];
      }),
    ),
  });

  const webQuery = buildRouteQuery(base);

  return {
    appScheme: `nmap://route/car?${appQuery}`,
    mobileWeb: `https://m.map.naver.com/route.nhn?${webQuery}`,
    desktopWeb: `https://m.map.naver.com/route.nhn?${webQuery}`,
    storeUrl: createStoreUrl(),
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

export function openNaverMultiDirections(origin: LatLng, orderedStops: RoutePoint[]) {
  const links = createNaverMultiDirectionLinks(origin, orderedStops);
  if (!links) {
    return { links: null, usedAppScheme: false };
  }

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

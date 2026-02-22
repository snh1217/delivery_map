"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { polygonPaths } from "@/lib/geo";
import type { LatLng, SegmentResult } from "@/types";

type Props = {
  origin: LatLng;
  destinations: Array<{ coord?: LatLng }>;
  segments: SegmentResult[];
};

const COLORS = ["#06b6d4", "#3b82f6", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"];

export function NaverMap({ origin, destinations, segments }: Props) {
  const mapRef = useRef<unknown>(null);
  const overlaysRef = useRef<unknown[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(
    typeof window !== "undefined" && Boolean(window.naver?.maps),
  );

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;

  const points = useMemo(() => {
    return [origin, ...destinations.map((d) => d.coord).filter(Boolean)] as LatLng[];
  }, [destinations, origin]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const scriptId = "naver-map-sdk";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const onLoaded = () => setReady(true);

    if (existing) {
      if (!window.naver?.maps) {
        existing.addEventListener("load", onLoaded);
      }

      return () => existing.removeEventListener("load", onLoaded);
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.async = true;
    script.addEventListener("load", onLoaded);
    document.head.appendChild(script);

    return () => script.removeEventListener("load", onLoaded);
  }, [clientId]);

  useEffect(() => {
    if (!ready || !rootRef.current || !window.naver?.maps) {
      return;
    }

    const naverMaps = window.naver.maps;

    if (!mapRef.current) {
      mapRef.current = new naverMaps.Map(rootRef.current, {
        center: new naverMaps.LatLng(origin.lat, origin.lon),
        zoom: 11,
      });
    }

    overlaysRef.current.forEach((overlay) => {
      (overlay as { setMap: (map: null) => void }).setMap(null);
    });
    overlaysRef.current = [];

    const map = mapRef.current as {
      fitBounds: (bounds: unknown, padding?: { top: number; right: number; bottom: number; left: number }) => void;
    };
    const bounds = new naverMaps.LatLngBounds();

    const startMarker = new naverMaps.Marker({
      map,
      position: new naverMaps.LatLng(origin.lat, origin.lon),
      title: "출발",
    });
    overlaysRef.current.push(startMarker);
    bounds.extend(new naverMaps.LatLng(origin.lat, origin.lon));

    destinations.forEach((dest, idx) => {
      if (!dest.coord) {
        return;
      }

      const marker = new naverMaps.Marker({
        map,
        position: new naverMaps.LatLng(dest.coord.lat, dest.coord.lon),
        title: `도착 ${idx + 1}`,
      });

      overlaysRef.current.push(marker);
      bounds.extend(new naverMaps.LatLng(dest.coord.lat, dest.coord.lon));
    });

    segments.forEach((segment, idx) => {
      const paths = polygonPaths(segment.polygon.geometry);
      paths.forEach((path) => {
        const polygon = new naverMaps.Polygon({
          map,
          paths: path.map((p) => new naverMaps.LatLng(p.lat, p.lng)),
          fillColor: COLORS[idx % COLORS.length],
          fillOpacity: 0.25,
          strokeColor: COLORS[idx % COLORS.length],
          strokeOpacity: 0.9,
          strokeWeight: 2,
        });

        overlaysRef.current.push(polygon);
        path.forEach((p) => bounds.extend(new naverMaps.LatLng(p.lat, p.lng)));
      });
    });

    if (points.length > 0) {
      map.fitBounds(bounds, {
        top: 24,
        right: 24,
        bottom: 24,
        left: 24,
      });
    }
  }, [destinations, origin, points.length, ready, segments]);

  if (!clientId) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
        NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID가 없어 지도 표시가 비활성화되었습니다.
      </div>
    );
  }

  return <div ref={rootRef} className="h-[50vh] w-full rounded-xl border border-slate-200" />;
}

import {
  bearing,
  booleanPointInPolygon,
  destination,
  distance,
  featureCollection,
  point,
  polygon,
  union,
} from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { DongCentroid, LatLng, RouteRecommendationItem, SegmentResult, SettingsState } from "@/types";

function toCoord(value: LatLng): [number, number] {
  return [value.lon, value.lat];
}

function normalizeBearing(value: number) {
  if (value < 0) {
    return value + 360;
  }

  if (value >= 360) {
    return value - 360;
  }

  return value;
}

export function createFanPolygon(params: {
  center: LatLng;
  angleDeg: number;
  halfAngleDeg: number;
  radiusKm: number;
  arcSteps: number;
}) {
  const centerPoint = point(toCoord(params.center));
  const ring: [number, number][] = [toCoord(params.center)];
  const start = params.angleDeg - params.halfAngleDeg;
  const end = params.angleDeg + params.halfAngleDeg;

  for (let i = 0; i <= params.arcSteps; i += 1) {
    const theta = start + ((end - start) * i) / params.arcSteps;
    const arcPoint = destination(centerPoint, params.radiusKm, theta, { units: "kilometers" });
    ring.push(arcPoint.geometry.coordinates as [number, number]);
  }

  ring.push(toCoord(params.center));
  return polygon([ring]);
}

function unionPolygon(a: Feature<Polygon>, b: Feature<Polygon>): Feature<Polygon | MultiPolygon> {
  try {
    const unionResult = union(featureCollection([a, b]));
    if (unionResult) {
      return unionResult as Feature<Polygon | MultiPolygon>;
    }
  } catch {
    // Turf union may fail on invalid/degenerate polygons. Fallback to a MultiPolygon container.
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPolygon",
      coordinates: [a.geometry.coordinates, b.geometry.coordinates],
    },
  };
}

export function calculateSegments(params: {
  origin: LatLng;
  destinations: Array<{ label: string; coord?: LatLng }>;
  settings: SettingsState;
  centroids: DongCentroid[];
}): SegmentResult[] {
  const results: SegmentResult[] = [];

  params.destinations.forEach((dest, idx) => {
    const prev = idx === 0 ? params.origin : params.destinations[idx - 1].coord;
    const curr = dest.coord;

    if (!prev || !curr) {
      return;
    }

    const prevPoint = point(toCoord(prev));
    const currPoint = point(toCoord(curr));
    const km = distance(prevPoint, currPoint, { units: "kilometers" });
    const dir = normalizeBearing(bearing(prevPoint, currPoint));
    const forwardRadius = Math.max(km + params.settings.forwardBufferKm, params.settings.forwardRadiusMinKm);

    const forward = createFanPolygon({
      center: prev,
      angleDeg: dir,
      halfAngleDeg: params.settings.halfAngleDeg,
      radiusKm: forwardRadius,
      arcSteps: params.settings.arcSteps,
    });

    const finalFan =
      params.settings.backwardTailKm > 0
        ? unionPolygon(
            forward,
            createFanPolygon({
              center: prev,
              angleDeg: normalizeBearing(dir + 180),
              halfAngleDeg: params.settings.halfAngleDeg,
              radiusKm: params.settings.backwardTailKm,
              arcSteps: params.settings.arcSteps,
            }),
          )
        : (forward as Feature<Polygon | MultiPolygon>);

    const dongs = params.centroids
      .filter((item) => booleanPointInPolygon(point([item.lon, item.lat]), finalFan))
      .sort((a, b) => a.short2.localeCompare(b.short2, "ko"));

    results.push({
      index: idx,
      polygon: finalFan,
      fromLabel: idx === 0 ? "출발지" : `도착지 ${idx}`,
      toLabel: `도착지 ${idx + 1}`,
      dongs,
    });
  });

  return results;
}

export function makeFinalShortList(results: SegmentResult[]) {
  return [...new Set(results.flatMap((segment) => segment.dongs.map((d) => d.short2).filter(Boolean)))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

export function normalizeDongDisplayName(dong: string) {
  const compact = dong.replace(/\s+/g, "").trim();
  if (!compact) {
    return "";
  }

  return compact.replace(/([가-힣]+?)(\d+)(동)$/u, "$1$3");
}

export function makeSegmentDongDisplayList(segment: SegmentResult) {
  return [...new Set(segment.dongs.map((dong) => normalizeDongDisplayName(dong.dong)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

export function makeFinalDongDisplayList(results: SegmentResult[]) {
  return [...new Set(results.flatMap((segment) => makeSegmentDongDisplayList(segment)))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

export function recommendVisitOrder(params: {
  origin: LatLng;
  destinations: Array<{ label: string; coord?: LatLng }>;
}): RouteRecommendationItem[] {
  const resolved = params.destinations
    .map((dest, rowIndex) => ({ rowIndex, label: dest.label, coord: dest.coord }))
    .filter((dest): dest is { rowIndex: number; label: string; coord: LatLng } => Boolean(dest.coord));
  const remaining = [...resolved];
  const ordered: RouteRecommendationItem[] = [];
  let current = params.origin;
  let cumulative = 0;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestKm = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const km = distance(point(toCoord(current)), point(toCoord(candidate.coord)), {
        units: "kilometers",
      });
      if (km < bestKm) {
        bestKm = km;
        bestIndex = i;
      }
    }

    const next = remaining.splice(bestIndex, 1)[0];
    cumulative += bestKm;

    ordered.push({
      step: ordered.length + 1,
      rowIndex: next.rowIndex,
      label: next.label,
      distanceKm: Number(bestKm.toFixed(1)),
      cumulativeKm: Number(cumulative.toFixed(1)),
    });

    current = next.coord;
  }

  return ordered;
}

export function polygonPaths(geometry: Polygon | MultiPolygon) {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates[0].map(([lon, lat]) => ({ lat, lng: lon }))];
  }

  return geometry.coordinates.map((poly) =>
    poly[0].map(([lon, lat]) => ({ lat, lng: lon })),
  );
}

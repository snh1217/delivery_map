import type { DestinationRowState, RouteRecommendationItem, RouteRecommendationMode } from "@/types";

const ROUTE_UI_SNAPSHOT_STORAGE_KEY = "delivery_map_route_ui_snapshot_v1";
export const ROUTE_UI_SNAPSHOT_TTL_MS = 2 * 60 * 60 * 1000;

export type RouteUiSnapshot = {
  updatedAt: number;
  handoffPending: boolean;
  rows: DestinationRowState[];
  undoStack: DestinationRowState[][];
  message: string | null;
  manualRecommendationRowOrder: number[] | null;
  roadRecommendedOrder: RouteRecommendationItem[] | null;
  recommendationMode: RouteRecommendationMode;
  activeRouteBatchIndex: number | null;
  highlightedRowIndex: number | null;
};

export function loadRouteUiSnapshot(
  hydrateRow: (row: Partial<DestinationRowState> | null | undefined) => DestinationRowState,
) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ROUTE_UI_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RouteUiSnapshot>;
    if (!Number.isFinite(parsed.updatedAt)) {
      return null;
    }

    const rows = Array.isArray(parsed.rows) ? parsed.rows.map((row) => hydrateRow(row)) : [];
    const undoStack = Array.isArray(parsed.undoStack)
      ? (parsed.undoStack as unknown[])
          .filter((snapshot) => Array.isArray(snapshot))
          .map((snapshot) => (snapshot as Array<Partial<DestinationRowState>>).map((row) => hydrateRow(row)))
      : [];

    return {
      updatedAt: Number(parsed.updatedAt),
      handoffPending: Boolean(parsed.handoffPending),
      rows,
      undoStack,
      message: typeof parsed.message === "string" ? parsed.message : null,
      manualRecommendationRowOrder: Array.isArray(parsed.manualRecommendationRowOrder)
        ? parsed.manualRecommendationRowOrder.filter((value): value is number => typeof value === "number")
        : null,
      roadRecommendedOrder: Array.isArray(parsed.roadRecommendedOrder)
        ? parsed.roadRecommendedOrder.filter(
            (item): item is RouteRecommendationItem =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof item.step === "number" &&
              typeof item.rowIndex === "number" &&
              typeof item.label === "string",
          )
        : null,
      recommendationMode: parsed.recommendationMode === "road" ? "road" : "straight",
      activeRouteBatchIndex:
        typeof parsed.activeRouteBatchIndex === "number" ? parsed.activeRouteBatchIndex : null,
      highlightedRowIndex: typeof parsed.highlightedRowIndex === "number" ? parsed.highlightedRowIndex : null,
    } satisfies RouteUiSnapshot;
  } catch {
    return null;
  }
}

export function persistRouteUiSnapshot(snapshot: RouteUiSnapshot | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!snapshot) {
      window.sessionStorage.removeItem(ROUTE_UI_SNAPSHOT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(ROUTE_UI_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures
  }
}

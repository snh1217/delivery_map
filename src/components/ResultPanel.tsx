"use client";

import { useMemo, useState } from "react";
import { DevelopmentRequestBoard } from "@/components/DevelopmentRequestBoard";
import { makeSegmentDongDisplayList } from "@/lib/geo";
import type {
  DevelopmentRequestRow,
  RouteRecommendationItem,
  RouteRecommendationMode,
  SegmentResult,
} from "@/types";

type Props = {
  segments: SegmentResult[];
  finalDongList: string[];
  viewMode: "segment" | "all";
  recommendedOrder: RouteRecommendationItem[];
  manualOrderActive: boolean;
  recommendationMode: RouteRecommendationMode;
  roadRecommendationLoading: boolean;
  roadRecommendationError: string | null;
  onSelectRecommendation: (rowIndex: number) => void;
  onMoveRecommendation: (rowIndex: number, direction: "up" | "down") => void;
  onReorderRecommendation: (dragRowIndex: number, dropRowIndex: number) => void;
  onResetRecommendationOrder: () => void;
  onChangeRecommendationMode: (mode: RouteRecommendationMode) => void;
  onComputeRoadRecommendation: () => void;
  developmentRequests: DevelopmentRequestRow[];
  developmentRequestsLoading: boolean;
  developmentRequestsError: string | null;
  onRefreshDevelopmentRequests: () => void;
  onSubmitDevelopmentRequest: (payload: { title: string; body: string }) => Promise<void>;
};

type ResultTab = "route" | "requests";

function formatMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded}분`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}시간 ${m}분`;
}

export function ResultPanel({
  segments,
  finalDongList,
  viewMode,
  recommendedOrder,
  manualOrderActive,
  recommendationMode,
  roadRecommendationLoading,
  roadRecommendationError,
  onSelectRecommendation,
  onMoveRecommendation,
  onReorderRecommendation,
  onResetRecommendationOrder,
  onChangeRecommendationMode,
  onComputeRoadRecommendation,
  developmentRequests,
  developmentRequestsLoading,
  developmentRequestsError,
  onRefreshDevelopmentRequests,
  onSubmitDevelopmentRequest,
}: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>("route");
  const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
  const text = useMemo(() => finalDongList.join(", "), [finalDongList]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const totals = useMemo(() => {
    const totalKm = recommendedOrder.reduce((sum, item) => sum + (item.distanceKm || 0), 0);
    const hasDuration = recommendedOrder.some((item) => typeof item.durationMin === "number");
    const totalMin = hasDuration
      ? recommendedOrder.reduce(
          (sum, item) => sum + (Number.isFinite(item.durationMin ?? NaN) ? (item.durationMin ?? 0) : 0),
          0,
        )
      : null;
    return { totalKm: Number(totalKm.toFixed(1)), totalMin };
  }, [recommendedOrder]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
  };

  const onShare = async () => {
    if (!canShare) return;
    await navigator.share({ title: "최종 동 리스트", text });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">결과</h2>
          <p className="text-xs text-slate-500">추천 순서, 동 리스트, 개발 요청</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">전체 {finalDongList.length}개</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`h-10 rounded-lg text-xs font-medium ${
            activeTab === "route" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
          }`}
          onClick={() => setActiveTab("route")}
        >
          추천/동 리스트
        </button>
        <button
          type="button"
          className={`h-10 rounded-lg text-xs font-medium ${
            activeTab === "requests" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
          }`}
          onClick={() => setActiveTab("requests")}
        >
          개발 요청
        </button>
      </div>

      {activeTab === "route" ? (
        <>
          <details className="mb-3 rounded-xl border border-slate-200 p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">추천 방문 순서</summary>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`h-11 rounded-lg text-sm ${
                  recommendationMode === "straight" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
                }`}
                onClick={() => onChangeRecommendationMode("straight")}
              >
                직선거리 기준
              </button>
              <button
                type="button"
                className={`h-11 rounded-lg text-sm ${
                  recommendationMode === "road" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
                }`}
                onClick={() => onChangeRecommendationMode("road")}
              >
                실도로 기준
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs disabled:opacity-50"
                onClick={onComputeRoadRecommendation}
                disabled={roadRecommendationLoading}
              >
                {roadRecommendationLoading ? "실도로 계산 중..." : "실도로 기준 다시 계산"}
              </button>
              <span className="text-xs leading-5 text-slate-500">
                {recommendationMode === "road"
                  ? "실제 내비 거리와 시간을 기준으로 추천 순서를 계산합니다."
                  : "내 위치에서 첫 목적지를 고른 뒤, 각 목적지에서 다음 가까운 곳을 연쇄로 추천합니다."}
              </span>
            </div>

            {roadRecommendationError ? <p className="mt-2 text-xs text-rose-600">{roadRecommendationError}</p> : null}

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">드래그하거나 ↑↓ 버튼으로 추천 순서를 직접 수정할 수 있습니다.</p>
              {manualOrderActive ? (
                <button
                  type="button"
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs"
                  onClick={onResetRecommendationOrder}
                >
                  순서 초기화
                </button>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                총 거리: <span className="font-semibold text-slate-800">{totals.totalKm}km</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                총 예상 시간: <span className="font-semibold text-slate-800">{formatMinutes(totals.totalMin)}</span>
              </div>
            </div>

            <ol className="mt-2 space-y-2">
              {recommendedOrder.map((item, index) => (
                <li
                  key={`${item.rowIndex}-${item.step}`}
                  draggable
                  onDragStart={() => setDraggingRowIndex(item.rowIndex)}
                  onDragEnd={() => setDraggingRowIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingRowIndex === null || draggingRowIndex === item.rowIndex) return;
                    onReorderRecommendation(draggingRowIndex, item.rowIndex);
                    setDraggingRowIndex(null);
                  }}
                >
                  <div
                    className={`grid grid-cols-[1fr_auto] gap-2 rounded-xl ${
                      draggingRowIndex === item.rowIndex ? "ring-2 ring-cyan-300" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-100 bg-slate-50 p-2 text-left active:scale-[0.99]"
                      onClick={() => onSelectRecommendation(item.rowIndex)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800">{item.step}. 도착지 {item.rowIndex + 1}</div>
                          <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            구간 {item.distanceKm}km / {formatMinutes(item.durationMin)}
                            {typeof item.cumulativeDurationMin === "number"
                              ? ` · 누적 ${formatMinutes(item.cumulativeDurationMin)}`
                              : ""}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-md bg-white px-2 py-1 text-xs text-slate-600">{item.distanceKm}km</div>
                      </div>
                    </button>

                    <div className="grid grid-rows-3 gap-1">
                      <div className="flex h-[26px] w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] text-slate-500">
                        이동
                      </div>
                      <button
                        type="button"
                        className="h-[26px] w-10 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40"
                        onClick={() => onMoveRecommendation(item.rowIndex, "up")}
                        disabled={index === 0}
                        aria-label={`도착지 ${item.rowIndex + 1} 위로 이동`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="h-[26px] w-10 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40"
                        onClick={() => onMoveRecommendation(item.rowIndex, "down")}
                        disabled={index === recommendedOrder.length - 1}
                        aria-label={`도착지 ${item.rowIndex + 1} 아래로 이동`}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </li>
              ))}

              {recommendedOrder.length === 0 ? (
                <li className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs text-slate-500">
                  좌표가 확정된 도착지가 있으면 추천 순서를 표시합니다.
                </li>
              ) : null}
            </ol>
          </details>

          <label className="mb-1 block text-xs font-medium text-slate-600">최종 동 리스트</label>
          <textarea
            className="h-28 w-full rounded-lg border border-slate-300 p-2 text-sm"
            readOnly
            value={text}
            onFocus={(event) => event.target.select()}
          />

          <p className="mt-2 text-xs text-slate-500">최종 동 리스트는 각 동의 앞 2글자 표기만 표시합니다.</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-12 rounded-xl bg-cyan-700 text-sm font-medium text-white disabled:opacity-50"
              disabled={!text}
              onClick={() => void onCopy()}
            >
              복사
            </button>
            <button
              type="button"
              className="h-12 rounded-xl border border-slate-300 bg-white text-sm disabled:opacity-50"
              disabled={!text || !canShare}
              onClick={() => void onShare()}
            >
              공유
            </button>
          </div>

          {viewMode === "segment" ? (
            <div className="mt-3 space-y-2">
              {segments.map((segment) => {
                const dongs = makeSegmentDongDisplayList(segment);
                return (
                  <details key={segment.index} className="rounded-lg border border-slate-200 p-2">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      구간 {segment.index + 1} ({dongs.length}개)
                    </summary>
                    <p className="mt-1 text-xs text-slate-600">{dongs.join(", ") || "없음"}</p>
                  </details>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">전체 합산 결과: {finalDongList.length}개</p>
          )}
        </>
      ) : null}

      {activeTab === "requests" ? (
        <DevelopmentRequestBoard
          rows={developmentRequests}
          loading={developmentRequestsLoading}
          error={developmentRequestsError}
          onRefresh={onRefreshDevelopmentRequests}
          onSubmit={onSubmitDevelopmentRequest}
        />
      ) : null}
    </section>
  );
}

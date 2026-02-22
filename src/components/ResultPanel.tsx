"use client";

import { useMemo } from "react";
import type { RouteRecommendationItem, RouteRecommendationMode, SegmentResult } from "@/types";

type Props = {
  segments: SegmentResult[];
  finalShortList: string[];
  viewMode: "segment" | "all";
  recommendedOrder: RouteRecommendationItem[];
  recommendationMode: RouteRecommendationMode;
  roadRecommendationLoading: boolean;
  roadRecommendationError: string | null;
  onSelectRecommendation: (rowIndex: number) => void;
  onChangeRecommendationMode: (mode: RouteRecommendationMode) => void;
  onComputeRoadRecommendation: () => void;
};

export function ResultPanel({
  segments,
  finalShortList,
  viewMode,
  recommendedOrder,
  recommendationMode,
  roadRecommendationLoading,
  roadRecommendationError,
  onSelectRecommendation,
  onChangeRecommendationMode,
  onComputeRoadRecommendation,
}: Props) {
  const text = useMemo(() => finalShortList.join(", "), [finalShortList]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
  };

  const onShare = async () => {
    if (!canShare) {
      return;
    }

    await navigator.share({
      title: "퀵서비스 동 리스트",
      text,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">결과</h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">전체 {finalShortList.length}개</span>
      </div>

      <details className="mb-3 rounded-xl border border-slate-200 p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">추천 방문 순서</summary>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`h-10 rounded-lg text-sm ${
              recommendationMode === "straight" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
            }`}
            onClick={() => onChangeRecommendationMode("straight")}
          >
            직선거리 기준
          </button>
          <button
            type="button"
            className={`h-10 rounded-lg text-sm ${
              recommendationMode === "road" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
            }`}
            onClick={() => onChangeRecommendationMode("road")}
          >
            실도로 기준
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs disabled:opacity-50"
            onClick={onComputeRoadRecommendation}
            disabled={roadRecommendationLoading}
          >
            {roadRecommendationLoading ? "실도로 계산 중..." : "실도로 기준 다시 계산"}
          </button>
          <span className="text-xs text-slate-500">
            {recommendationMode === "road"
              ? "현재 위치 -> 각 도착지 네이버 경로 거리 기준 정렬"
              : "현재 위치 -> 각 도착지 직선거리 기준 정렬"}
          </span>
        </div>

        {roadRecommendationError ? <p className="mt-2 text-xs text-rose-600">{roadRecommendationError}</p> : null}

        <ol className="mt-2 space-y-2">
          {recommendedOrder.map((item: RouteRecommendationItem) => (
            <li key={`${item.rowIndex}-${item.step}`}>
              <button
                type="button"
                className="w-full rounded-lg border border-slate-100 bg-slate-50 p-2 text-left active:scale-[0.99]"
                onClick={() => onSelectRecommendation(item.rowIndex)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {item.step}. 도착지 {item.rowIndex + 1}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.label}</div>
                  </div>
                  <div className="shrink-0 rounded-md bg-white px-2 py-1 text-xs text-slate-600">{item.distanceKm}km</div>
                </div>
              </button>
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
        onFocus={(e) => e.target.select()}
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h-12 rounded-lg bg-cyan-700 text-sm font-medium text-white disabled:opacity-50"
          disabled={!text}
          onClick={() => void onCopy()}
        >
          복사
        </button>
        <button
          type="button"
          className="h-12 rounded-lg border border-slate-300 bg-white text-sm disabled:opacity-50"
          disabled={!text || !canShare}
          onClick={() => void onShare()}
        >
          공유
        </button>
      </div>

      {viewMode === "segment" ? (
        <div className="mt-3 space-y-2">
          {segments.map((segment) => (
            <details key={segment.index} className="rounded-lg border border-slate-200 p-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                구간 {segment.index + 1} ({segment.dongs.length}개)
              </summary>
              <p className="mt-1 text-xs text-slate-600">{segment.dongs.map((d) => d.short2).join(", ") || "없음"}</p>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">전체 합산 결과: {finalShortList.length}개</p>
      )}
    </section>
  );
}

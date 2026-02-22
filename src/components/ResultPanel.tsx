"use client";

import { useMemo } from "react";
import type { SegmentResult } from "@/types";

type Props = {
  segments: SegmentResult[];
  finalShortList: string[];
  viewMode: "segment" | "all";
};

export function ResultPanel({ segments, finalShortList, viewMode }: Props) {
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-slate-800">결과</h2>
      <textarea
        className="h-28 w-full rounded-lg border border-slate-300 p-2 text-sm"
        readOnly
        value={text}
        onFocus={(e) => e.target.select()}
      />

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h-11 rounded-lg bg-cyan-700 text-sm font-medium text-white"
          disabled={!text}
          onClick={() => void onCopy()}
        >
          복사
        </button>
        <button
          type="button"
          className="h-11 rounded-lg border border-slate-300 text-sm"
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

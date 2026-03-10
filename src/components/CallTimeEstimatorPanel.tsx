"use client";

import type { CallEstimateHistoryRow, RouteCallEstimateResult } from "@/types";

type Props = {
  callTime: string;
  loading: boolean;
  error: string | null;
  estimate: RouteCallEstimateResult | null;
  history: CallEstimateHistoryRow[];
  historyLoading: boolean;
  historyError: string | null;
  onChangeCallTime: (value: string) => void;
  onUseNow: () => void;
  onCompute: () => void;
  onRestoreHistory: (row: CallEstimateHistoryRow) => void;
};

function formatDuration(minutes: number | null) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
    return "-";
  }
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}분`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hours}시간 ${mins}분`;
}

export function CallTimeEstimatorPanel({
  callTime,
  loading,
  error,
  estimate,
  history,
  historyLoading,
  historyError,
  onChangeCallTime,
  onUseNow,
  onCompute,
  onRestoreHistory,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">콜 시간 계산</h3>
            <p className="text-xs text-slate-500">
              실제 내비 시간 기준으로 가장 오래 걸리는 구간을 잡고, 150% 가산 + 픽업 20분을 더해 마감 시간을 계산합니다.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="time"
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            value={callTime}
            onChange={(event) => onChangeCallTime(event.target.value)}
          />
          <button
            type="button"
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            onClick={onUseNow}
          >
            현재 시간
          </button>
          <button
            type="button"
            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={onCompute}
            disabled={loading}
          >
            {loading ? "계산 중..." : "시간 계산"}
          </button>
        </div>

        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

        {estimate ? (
          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                가장 오래 걸린 구간
                <div className="mt-1 text-sm font-semibold text-slate-800">{estimate.referenceLeg}</div>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                이 콜은 <span className="font-semibold">{estimate.deadlineLabel}</span>까지 들어가면 됩니다.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                최장 구간
                <div className="mt-1 text-sm font-semibold text-slate-800">{formatDuration(estimate.longestLegMin)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                150% 가산
                <div className="mt-1 text-sm font-semibold text-slate-800">{formatDuration(estimate.adjustedDriveMin)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                픽업 시간
                <div className="mt-1 text-sm font-semibold text-slate-800">{formatDuration(estimate.pickupMin)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                총 필요 시간
                <div className="mt-1 text-sm font-semibold text-slate-800">{formatDuration(estimate.totalRequiredMin)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <h4 className="text-xs font-semibold text-slate-700">현재 추천 방문 순서 기준 구간 시간</h4>
              <div className="mt-2 space-y-2">
                {estimate.legs.map((leg, index) => (
                  <div
                    key={`${leg.fromLabel}-${leg.toLabel}-${index}`}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    <div className="font-medium text-slate-800">
                      {index + 1}. {leg.fromLabel} → {leg.toLabel}
                    </div>
                    <div className="mt-1">
                      거리 {typeof leg.distanceKm === "number" ? `${leg.distanceKm.toFixed(1)}km` : "-"} / 시간{" "}
                      {formatDuration(leg.durationMin)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
            콜 잡은 시간과 현재 추천 방문 순서를 기준으로 계산합니다. 먼저 시간 계산 버튼을 눌러 주세요.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-700">최근 계산 이력</h4>
            {historyLoading ? <span className="text-[11px] text-slate-500">불러오는 중...</span> : null}
          </div>
          {historyError ? <p className="mt-2 text-xs text-rose-600">{historyError}</p> : null}
          <div className="mt-2 space-y-2">
            {history.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-800">
                    {row.call_time} 시작 · {row.deadline_label} 마감
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
                    onClick={() => onRestoreHistory(row)}
                  >
                    다시 보기
                  </button>
                </div>
                <div className="mt-1">기준 구간: {row.reference_leg}</div>
                <div className="mt-1">총 필요 시간: {formatDuration(row.total_required_min)}</div>
              </div>
            ))}
            {history.length === 0 && !historyLoading ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                저장된 계산 이력이 없습니다.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

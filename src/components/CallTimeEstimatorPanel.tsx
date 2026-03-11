"use client";

import type { CallEstimateHistoryRow, CallTimeEntry, RouteCallEstimateResult } from "@/types";

type Props = {
  callTimeEntries: CallTimeEntry[];
  activeCallTimeId: string | null;
  loading: boolean;
  error: string | null;
  estimate: RouteCallEstimateResult | null;
  history: CallEstimateHistoryRow[];
  historyLoading: boolean;
  historyError: string | null;
  onSelectCallTimeEntry: (id: string) => void;
  onAddCallTimeEntry: () => void;
  onRemoveCallTimeEntry: (id: string) => void;
  onChangeCallTimeEntry: (id: string, value: string) => void;
  onUseNow: () => void;
  onCompute: () => void;
  onRestoreHistory: (row: CallEstimateHistoryRow) => void;
};

function formatDuration(minutes: number | null | undefined) {
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
  callTimeEntries,
  activeCallTimeId,
  loading,
  error,
  estimate,
  history,
  historyLoading,
  historyError,
  onSelectCallTimeEntry,
  onAddCallTimeEntry,
  onRemoveCallTimeEntry,
  onChangeCallTimeEntry,
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
              콜 시간을 여러 개 넣고 하나씩 선택해 계산할 수 있습니다. 가장 오래 걸리는 구간을 기준으로 운행 시간을
              150% 가산하고, 픽업 20분을 더해 마감 시간을 계산합니다.
            </p>
          </div>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium"
            onClick={onAddCallTimeEntry}
          >
            + 콜 시간 추가
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {callTimeEntries.map((entry, index) => {
            const isActive = entry.id === activeCallTimeId;
            return (
              <div
                key={entry.id}
                className={`rounded-xl border p-3 ${
                  isActive ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="text-left" onClick={() => onSelectCallTimeEntry(entry.id)}>
                    <div className="text-xs font-semibold text-slate-700">콜 {index + 1}</div>
                    <div className={`text-[11px] ${isActive ? "text-cyan-700" : "text-slate-500"}`}>
                      {isActive ? "현재 계산 대상" : "선택하면 이 시간으로 계산"}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      value={entry.time}
                      onFocus={() => onSelectCallTimeEntry(entry.id)}
                      onChange={(event) => onChangeCallTimeEntry(entry.id, event.target.value)}
                    />
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs disabled:opacity-40"
                      onClick={() => onRemoveCallTimeEntry(entry.id)}
                      disabled={callTimeEntries.length === 1}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr]">
          <button
            type="button"
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            onClick={onUseNow}
          >
            현재 시간 넣기
          </button>
          <button
            type="button"
            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={onCompute}
            disabled={loading}
          >
            {loading ? "계산 중..." : "시간 계산"}
          </button>
          <div className="flex items-center rounded-lg border border-dashed border-slate-200 px-3 text-xs text-slate-500">
            선택된 콜 시간 1건을 기준으로 계산하고, 나머지 시간은 목록에 유지됩니다.
          </div>
        </div>

        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

        {estimate ? (
          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                기준이 된 최장 구간
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
                      거리 {typeof leg.distanceKm === "number" ? `${leg.distanceKm.toFixed(1)}km` : "-"} / 시간 {" "}
                      {formatDuration(leg.durationMin)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
            콜 시간을 추가하고 계산 대상을 선택한 뒤 시간 계산을 누르면, 현재 추천 방문 순서를 기준으로 마감 시간을 계산합니다.
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

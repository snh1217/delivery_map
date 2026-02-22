"use client";

import { DestinationRow } from "@/components/DestinationRow";
import type { DestinationRowState, LatLng } from "@/types";

type Props = {
  rows: DestinationRowState[];
  origin: LatLng;
  autoSearch: boolean;
  resolvedCount: number;
  routeableCount: number;
  skippedCountForAllRoute: number;
  onAdd: () => void;
  onReset: () => void;
  onNavigateAll: () => void;
  onChangeInput: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectCandidate: (id: string, index: number) => void;
  onNavigate: (id: string) => void;
};

export function DestinationList({
  rows,
  origin,
  autoSearch,
  resolvedCount,
  routeableCount,
  skippedCountForAllRoute,
  onAdd,
  onReset,
  onNavigateAll,
  onChangeInput,
  onSearch,
  onDelete,
  onSelectCandidate,
  onNavigate,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">도착지 목록 (출발지는 자동)</h2>
          <p className="text-xs text-slate-500">최대 10개까지 추가 가능</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            onClick={onReset}
          >
            초기화
          </button>
          <button
            type="button"
            className="h-11 rounded-lg bg-cyan-700 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={onAdd}
            disabled={rows.length >= 10}
          >
            + 추가
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">
            전체 길찾기: 좌표 확정 {resolvedCount}개 / 네이버 경유지 지원 기준 자동 전달 {routeableCount}개
            {skippedCountForAllRoute > 0 ? ` (나머지 ${skippedCountForAllRoute}개는 제외)` : ""}
          </div>
          <button
            type="button"
            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={onNavigateAll}
            disabled={routeableCount === 0}
          >
            전체 길찾기 (경유지 포함)
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <DestinationRow
            key={row.id}
            index={index}
            row={row}
            origin={origin}
            autoSearch={autoSearch}
            onChangeInput={onChangeInput}
            onSearch={onSearch}
            onDelete={onDelete}
            onSelectCandidate={onSelectCandidate}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

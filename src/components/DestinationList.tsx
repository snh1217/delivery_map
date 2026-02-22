"use client";

import { DestinationRow } from "@/components/DestinationRow";
import type { DestinationRowState, LatLng } from "@/types";

type Props = {
  rows: DestinationRowState[];
  origin: LatLng;
  autoSearch: boolean;
  onAdd: () => void;
  onReset: () => void;
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
  onAdd,
  onReset,
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

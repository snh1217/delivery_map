"use client";

import { useEffect } from "react";
import { createNaverDirectionLinks, detectPlatform } from "@/lib/naverDeepLink";
import type { DestinationRowState, LatLng } from "@/types";

type Props = {
  index: number;
  row: DestinationRowState;
  origin: LatLng;
  autoSearch: boolean;
  onChangeInput: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectCandidate: (id: string, index: number) => void;
  onNavigate: (id: string) => void;
};

export function DestinationRow({
  index,
  row,
  origin,
  autoSearch,
  onChangeInput,
  onSearch,
  onDelete,
  onSelectCandidate,
  onNavigate,
}: Props) {
  useEffect(() => {
    if (!autoSearch || !row.input.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSearch(row.id);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [autoSearch, onSearch, row.id, row.input]);

  const canNavigate = Boolean(row.coord);
  const links = row.coord
    ? createNaverDirectionLinks(origin, row.coord, row.label ?? row.input)
    : null;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-700">도착지 {index + 1}</div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className="h-12 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="주소 또는 구 동 입력"
          value={row.input}
          onChange={(e) => onChangeInput(row.id, e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-12 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white"
            disabled={!row.input.trim() || row.status === "loading"}
            onClick={() => onSearch(row.id)}
          >
            {row.status === "loading" ? "검색중" : "검색/적용"}
          </button>
          <button
            type="button"
            className="h-12 rounded-lg border border-rose-300 px-3 text-sm font-medium text-rose-600"
            onClick={() => onDelete(row.id)}
          >
            삭제
          </button>
        </div>
      </div>

      {row.geocodeItems.length > 1 ? (
        <div className="mt-2">
          <label className="mb-1 block text-xs text-slate-600">검색 후보 (Top 5)</label>
          <select
            className="h-10 w-full rounded-lg border border-slate-300 px-2 text-sm"
            value={row.selectedIndex}
            onChange={(e) => onSelectCandidate(row.id, Number(e.target.value))}
          >
            {row.geocodeItems.map((item, itemIndex) => (
              <option key={`${row.id}-${itemIndex}`} value={itemIndex}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {row.label ? <p className="mt-1 text-xs text-slate-600">선택 주소: {row.label}</p> : null}
      {row.error ? <p className="mt-1 text-xs text-rose-600">{row.error}</p> : null}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="h-11 rounded-lg bg-cyan-700 px-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={!canNavigate}
          onClick={() => onNavigate(row.id)}
        >
          네이버지도 길찾기
        </button>
        {links ? (
          <a
            className="flex h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm"
            href={detectPlatform() === "desktop" ? links.desktopWeb : links.mobileWeb}
            target="_blank"
            rel="noreferrer"
          >
            웹지도로 열기
          </a>
        ) : (
          <div className="h-11 rounded-lg border border-slate-200" />
        )}
      </div>
    </div>
  );
}

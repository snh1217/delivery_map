"use client";

import { useEffect, useRef } from "react";
import { createNaverDirectionLinks, detectPlatform } from "@/lib/naverDeepLink";
import type { DestinationRowState, LatLng } from "@/types";

type Props = {
  index: number;
  row: DestinationRowState;
  origin: LatLng;
  autoSearch: boolean;
  highlighted?: boolean;
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
  highlighted = false,
  onChangeInput,
  onSearch,
  onDelete,
  onSelectCandidate,
  onNavigate,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoSearch || !row.input.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSearch(row.id);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [autoSearch, onSearch, row.id, row.input]);

  useEffect(() => {
    if (!highlighted) {
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const canNavigate = Boolean(row.coord);
  const links = row.coord ? createNaverDirectionLinks(origin, row.coord, row.label ?? row.input) : null;

  return (
    <div
      ref={rootRef}
      className={`rounded-xl border p-3 transition ${
        highlighted ? "border-cyan-400 bg-cyan-50/50 shadow-sm" : "border-slate-200"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">도착지 {index + 1}</div>
        <div className="flex items-center gap-1">
          {highlighted ? (
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] text-cyan-800">추천 선택</span>
          ) : null}
          {row.status === "resolved" ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">좌표 확인됨</span>
          ) : null}
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        예시: `강서구 마곡동`, `서울 강서구 마곡동 123-4` (입력 후 검색/적용)
      </p>

      <div className="grid gap-2">
        <input
          className="h-12 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="주소 또는 구/동 입력"
          value={row.input}
          onChange={(e) => onChangeInput(row.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && row.input.trim() && row.status !== "loading") {
              e.preventDefault();
              onSearch(row.id);
            }
          }}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="h-12 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white"
            disabled={!row.input.trim() || row.status === "loading"}
            onClick={() => onSearch(row.id)}
          >
            {row.status === "loading" ? "검색 중..." : "검색/적용"}
          </button>
          <button
            type="button"
            className="h-12 rounded-lg border border-rose-300 px-3 text-sm font-medium text-rose-600"
            onClick={() => onDelete(row.id)}
          >
            삭제
          </button>
          <button
            type="button"
            className="hidden h-12 rounded-lg border border-slate-300 px-3 text-sm sm:block"
            disabled={!canNavigate}
            onClick={() => onNavigate(row.id)}
          >
            길찾기
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
                {item.title} | {item.address}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {row.label ? <p className="mt-1 text-xs text-slate-600">선택 주소: {row.label}</p> : null}
      {row.coord ? (
        <p className="mt-1 text-xs text-slate-500">
          좌표: {row.coord.lat.toFixed(5)}, {row.coord.lon.toFixed(5)}
        </p>
      ) : null}
      {row.error ? <p className="mt-1 text-xs text-rose-600">{row.error}</p> : null}

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="h-11 rounded-lg bg-cyan-700 px-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={!canNavigate}
          onClick={() => onNavigate(row.id)}
        >
          네이버앱 길찾기
        </button>
        {links ? (
          <a
            className="flex h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm"
            href={detectPlatform() === "desktop" ? links.desktopWeb : links.mobileWeb}
            target="_blank"
            rel="noreferrer"
          >
            웹으로 열기
          </a>
        ) : (
          <div className="h-11 rounded-lg border border-slate-200" />
        )}
      </div>
    </div>
  );
}

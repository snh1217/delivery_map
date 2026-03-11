"use client";

import { DestinationRow } from "@/components/DestinationRow";
import type { DestinationRowState, LatLng } from "@/types";

export type RouteBatchButton = {
  key: string;
  label: string;
  count: number;
  onClick: () => void;
};

type Props = {
  rows: DestinationRowState[];
  origin: LatLng;
  autoSearch: boolean;
  resolvedCount: number;
  routeableCount: number;
  skippedCountForAllRoute: number;
  routeProviderLabel: "네이버" | "카카오" | "카카오내비";
  routeMaxStops: number;
  highlightedRowIndex: number | null;
  routeBatchButtons: RouteBatchButton[];
  activeRouteBatchIndex: number | null;
  canUndoRouteRemoval: boolean;
  undoRouteMessage?: string | null;
  onAdd: () => void;
  onReset: () => void;
  onNavigateAll: () => void;
  onUndoRouteRemoval: () => void;
  onMoveRow: (id: string, direction: "up" | "down") => void;
  onChangeInput: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectCandidate: (id: string, index: number) => void;
  onNavigate: (id: string) => void;
  onNavigateKakao: (id: string) => void;
  preferredNavigationApp: "naver" | "kakao" | "kakaonavi";
  isAdmin?: boolean;
  canUseAttachment?: boolean;
  onApplyOcrToRow?: (id: string, address: string) => void;
  onChangeCallTime: (id: string, value: string) => void;
  onUseCurrentCallTime: (id: string) => void;
  onComputeCallEstimate: (id: string) => void;
};

export function DestinationList({
  rows,
  origin,
  autoSearch,
  resolvedCount,
  routeableCount,
  skippedCountForAllRoute,
  routeProviderLabel,
  routeMaxStops,
  highlightedRowIndex,
  routeBatchButtons,
  activeRouteBatchIndex,
  canUndoRouteRemoval,
  undoRouteMessage,
  onAdd,
  onReset,
  onNavigateAll,
  onUndoRouteRemoval,
  onMoveRow,
  onChangeInput,
  onSearch,
  onDelete,
  onSelectCandidate,
  onNavigate,
  onNavigateKakao,
  preferredNavigationApp,
  isAdmin = false,
  canUseAttachment = false,
  onApplyOcrToRow,
  onChangeCallTime,
  onUseCurrentCallTime,
  onComputeCallEstimate,
}: Props) {
  const isKakaoFamily = routeProviderLabel === "카카오" || routeProviderLabel === "카카오내비";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">도착지 목록 (출발지는 자동)</h2>
          <p className="text-xs text-slate-500">최대 20개까지 추가 가능 · ↑↓ 버튼으로 순서를 직접 바꿀 수 있습니다.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm" onClick={onReset}>
            초기화
          </button>
          <button
            type="button"
            className="h-11 rounded-lg bg-cyan-700 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={onAdd}
            disabled={rows.length >= 20}
          >
            + 추가
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
            전체 길찾기 좌표 확정 {resolvedCount}개 / {routeProviderLabel} 자동 전달 {routeableCount}개(최대 {routeMaxStops}개)
            {skippedCountForAllRoute > 0 ? ` · 나머지 ${skippedCountForAllRoute}개는 분할 길찾기 사용` : ""}
          </div>

          {isKakaoFamily ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {routeProviderLabel}는 한 번에 최대 {routeMaxStops}개 도착지만 자동 전달합니다. 도착지가 많으면 분할 길찾기 버튼을 사용하세요.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="h-12 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              onClick={onNavigateAll}
              disabled={routeableCount === 0}
            >
              전체 길찾기 (경유지 포함)
            </button>

            {routeBatchButtons.length > 1 ? (
              <div className="grid grid-cols-2 gap-2">
                {routeBatchButtons.map((button, index) => (
                  <button
                    key={button.key}
                    type="button"
                    className={`h-11 rounded-lg px-3 text-xs font-medium ${
                      activeRouteBatchIndex === index
                        ? "border border-cyan-400 bg-cyan-50 text-cyan-800"
                        : "border border-slate-300 bg-white text-slate-700"
                    }`}
                    onClick={button.onClick}
                  >
                    {button.label} ({button.count})
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs leading-5 text-slate-500">
                도착지가 {routeMaxStops + 1}개 이상이면 분할 길찾기 버튼이 표시됩니다.
              </div>
            )}
          </div>

          {canUndoRouteRemoval ? (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-cyan-900">
                  {undoRouteMessage ?? "이전 길찾기 전송으로 숨겨진 도착지가 있습니다."}
                </p>
                <button
                  type="button"
                  className="h-10 rounded-lg border border-cyan-300 bg-white px-3 text-xs font-medium text-cyan-800"
                  onClick={onUndoRouteRemoval}
                >
                  최근 목적지 되돌리기
                </button>
              </div>
            </div>
          ) : null}

          {activeRouteBatchIndex !== null && routeBatchButtons.length > 1 ? (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              {routeBatchButtons[activeRouteBatchIndex]
                ? `${routeBatchButtons[activeRouteBatchIndex].label} 경로를 열었습니다. 다음 경로: ${
                    routeBatchButtons[activeRouteBatchIndex + 1]?.label ?? "없음"
                  }`
                : "분할 경로 안내"}
            </div>
          ) : null}
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
            highlighted={highlightedRowIndex === index}
            canMoveUp={index > 0}
            canMoveDown={index < rows.length - 1}
            onMoveRow={onMoveRow}
            onChangeInput={onChangeInput}
            onSearch={onSearch}
            onDelete={onDelete}
            onSelectCandidate={onSelectCandidate}
            onNavigate={onNavigate}
            onNavigateKakao={onNavigateKakao}
            preferredNavigationApp={preferredNavigationApp}
            isAdmin={isAdmin}
            canUseAttachment={canUseAttachment}
            onApplyOcrToRow={onApplyOcrToRow}
            onChangeCallTime={onChangeCallTime}
            onUseCurrentCallTime={onUseCurrentCallTime}
            onComputeCallEstimate={onComputeCallEstimate}
          />
        ))}
      </div>
    </section>
  );
}

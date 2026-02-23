"use client";

import { EarningsRangePanel } from "@/components/profile/EarningsRangePanel";
import { EarningsSummaryCard } from "@/components/profile/EarningsSummaryCard";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function EarningsStatsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="max-h-[88vh] overflow-y-auto p-4 sm:max-h-[82vh]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">운임 통계</h3>
              <p className="text-xs text-slate-500">실수령 기준(로지 23% 반영) 요약/기간 통계를 조회합니다.</p>
            </div>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={onClose}>
              닫기
            </button>
          </div>

          <div className="space-y-3">
            <EarningsSummaryCard />
            <EarningsRangePanel />
          </div>
        </div>
      </div>
    </div>
  );
}

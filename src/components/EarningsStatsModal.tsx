"use client";

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
              <h3 className="text-lg font-semibold text-slate-800">오늘 운임 요약</h3>
              <p className="text-xs text-slate-500">실수령 기준(로지 23% 반영) 요약입니다.</p>
            </div>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={onClose}>
              닫기
            </button>
          </div>

          <div className="space-y-3">
            <EarningsSummaryCard />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              기간 통계는 상단 <span className="font-medium text-slate-800">로그인 정보</span>를 펼친 뒤 확인할 수 있습니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

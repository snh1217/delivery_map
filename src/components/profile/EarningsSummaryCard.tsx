"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKRW, getKstRange, MY_EARNING_TARGET_NAME } from "@/lib/earnings";
import type { EarningsRangeResponse } from "@/types";

export function EarningsSummaryCard() {
  const [openDetail, setOpenDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EarningsRangeResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getKstRange("today");
      const params = new URLSearchParams({ from, to, target: "all" });
      const response = await fetch(`/api/earnings/range?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "오늘 운임 요약 조회 실패");
      }
      const payload = (await response.json()) as EarningsRangeResponse;
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "오늘 운임 요약 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const byTarget = data?.byTarget ?? [];
    const me = byTarget.find((item) => item.targetName === MY_EARNING_TARGET_NAME)?.totalNet ?? 0;
    const total = data?.totalNet ?? 0;
    return {
      total,
      me,
      thirdParty: Math.max(0, total - me),
      byTarget,
    };
  }, [data]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">오늘 운임 요약</h3>
        <button
          type="button"
          className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
          onClick={() => setOpenDetail((prev) => !prev)}
          disabled={loading}
        >
          {openDetail ? "상세 숨기기" : "오늘 상세 보기"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">모든 합계는 실수령 기준이며, 매출/실운임은 23% 공제 기준으로 환산합니다.</p>

      {loading ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" className="mt-2 h-9 rounded-lg border border-rose-300 bg-white px-3 text-xs" onClick={() => void load()}>
            재시도
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">오늘 전체 실수령</div>
              <div className="mt-1 text-lg font-semibold text-slate-800">{formatKRW(summary.total)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">내 운임 실수령</div>
              <div className="mt-1 text-lg font-semibold text-slate-800">{formatKRW(summary.me)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">제3자 합계</div>
              <div className="mt-1 text-lg font-semibold text-slate-800">{formatKRW(summary.thirdParty)}</div>
            </div>
          </div>

          {openDetail ? (
            <div className="mt-3 space-y-2">
              {summary.byTarget.map((item) => (
                <div key={item.targetName} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-700">{item.targetName}</span>
                  <span className="font-medium text-slate-800">{formatKRW(item.totalNet)}</span>
                </div>
              ))}
              {summary.byTarget.length === 0 ? (
                <p className="text-xs text-slate-500">오늘 저장된 운임이 없습니다.</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

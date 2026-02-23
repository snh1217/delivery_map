"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKRW, getKstRange, type EarningRangePreset } from "@/lib/earnings";
import type { AdminEarningsSummaryResponse, AdminEarningsUserDetailResponse } from "@/types";

const PRESETS: Array<{ key: EarningRangePreset; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "last7", label: "최근 7일" },
  { key: "thisMonth", label: "이번 달" },
];

export function AdminEarningsPanel() {
  const initial = getKstRange("today");
  const [preset, setPreset] = useState<EarningRangePreset>("today");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [summary, setSummary] = useState<AdminEarningsSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminEarningsUserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const range = getKstRange(preset);
    setFrom(range.from);
    setTo(range.to);
  }, [preset]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/admin/earnings/summary?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "운임 통계 조회 실패");
      }
      const payload = (await response.json()) as AdminEarningsSummaryResponse;
      setSummary(payload);
      if (!selectedPhone && payload.byUser[0]) {
        setSelectedPhone(payload.byUser[0].phone);
      }
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "운임 통계 조회 실패");
    } finally {
      setSummaryLoading(false);
    }
  }, [from, to, selectedPhone]);

  const loadUserDetail = useCallback(async (phone: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const params = new URLSearchParams({ phone, from, to });
      const response = await fetch(`/api/admin/earnings/user?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "사용자 운임 상세 조회 실패");
      }
      const payload = (await response.json()) as AdminEarningsUserDetailResponse;
      setDetail(payload);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "사용자 운임 상세 조회 실패");
    } finally {
      setDetailLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!selectedPhone) {
      setDetail(null);
      return;
    }
    void loadUserDetail(selectedPhone);
  }, [selectedPhone, loadUserDetail]);

  const selectedUserSummary = useMemo(
    () => summary?.byUser.find((row) => row.phone === selectedPhone) ?? null,
    [summary, selectedPhone],
  );

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">운임 통계</h3>
        <button type="button" className="h-9 rounded-lg border border-slate-300 px-3 text-xs" onClick={() => void loadSummary()} disabled={summaryLoading}>
          {summaryLoading ? "조회 중..." : "새로고침"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">모든 합계는 실수령 기준(로지 23% 반영)입니다.</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`h-10 rounded-lg text-xs ${preset === item.key ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}
            onClick={() => setPreset(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input type="date" className="h-10 rounded-lg border border-slate-300 px-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="h-10 rounded-lg border border-slate-300 px-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {summaryError ? <p className="mt-2 text-xs text-rose-600">{summaryError}</p> : null}

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs text-slate-500">기간 총 실수령</div>
        <div className="mt-1 text-lg font-semibold text-slate-800">{formatKRW(summary?.totalNet ?? 0)}</div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-700">사용자별 합계 TOP</h4>
          <div className="mt-2 space-y-1">
            {(summary?.byUser ?? []).map((row) => (
              <button
                key={row.phone}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${selectedPhone === row.phone ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}
                onClick={() => setSelectedPhone(row.phone)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{row.phone}</span>
                  <span className="text-slate-700">{formatKRW(row.totalNet)}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{row.daysUsed}일 사용 / {row.entriesCount}건 저장</div>
              </button>
            ))}
            {(summary?.byUser.length ?? 0) === 0 ? <p className="text-xs text-slate-500">데이터가 없습니다.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-700">사용자 상세 {selectedUserSummary ? `(${selectedUserSummary.phone})` : ""}</h4>
          {detailLoading ? <p className="mt-2 text-xs text-slate-500">상세 조회 중...</p> : null}
          {detailError ? <p className="mt-2 text-xs text-rose-600">{detailError}</p> : null}
          {detail ? (
            <div className="mt-2 space-y-3 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                총합: <span className="font-semibold text-slate-800">{formatKRW(detail.totalNet)}</span>
              </div>
              <div>
                <p className="mb-1 font-medium text-slate-700">일자별 합계</p>
                <div className="space-y-1">
                  {detail.byDay.map((row) => (
                    <div key={row.ymd} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                      <span>{row.ymd}</span>
                      <span>{formatKRW(row.totalNet)}</span>
                    </div>
                  ))}
                  {detail.byDay.length === 0 ? <p className="text-slate-500">데이터 없음</p> : null}
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium text-slate-700">대상별 합계</p>
                <div className="space-y-1">
                  {detail.byTarget.map((row) => (
                    <div key={row.targetName} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                      <span>{row.targetName}</span>
                      <span>{formatKRW(row.totalNet)}</span>
                    </div>
                  ))}
                  {detail.byTarget.length === 0 ? <p className="text-slate-500">데이터 없음</p> : null}
                </div>
              </div>
            </div>
          ) : !detailLoading ? <p className="mt-2 text-xs text-slate-500">사용자를 선택하면 상세가 표시됩니다.</p> : null}
        </div>
      </div>
    </section>
  );
}

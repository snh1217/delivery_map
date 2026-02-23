"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKRW, getKstRange, type EarningRangePreset, MY_EARNING_TARGET_NAME } from "@/lib/earnings";
import type { EarningsRangeResponse, EarningTargetRow } from "@/types";

type TargetFilterValue = "all" | "me" | string;

const PRESETS: Array<{ key: EarningRangePreset; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "last7", label: "최근 7일" },
  { key: "thisMonth", label: "이번 달" },
];

export function EarningsRangePanel() {
  const [preset, setPreset] = useState<EarningRangePreset>("last7");
  const [from, setFrom] = useState(getKstRange("last7").from);
  const [to, setTo] = useState(getKstRange("last7").to);
  const [target, setTarget] = useState<TargetFilterValue>("all");
  const [targets, setTargets] = useState<EarningTargetRow[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EarningsRangeResponse | null>(null);

  useEffect(() => {
    const range = getKstRange(preset);
    setFrom(range.from);
    setTo(range.to);
  }, [preset]);

  useEffect(() => {
    let mounted = true;
    const loadTargets = async () => {
      setLoadingTargets(true);
      try {
        const response = await fetch("/api/earnings/targets", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { targets?: EarningTargetRow[] };
        if (!mounted) return;
        setTargets(Array.isArray(payload.targets) ? payload.targets.filter((t) => t.is_active) : []);
      } finally {
        if (mounted) setLoadingTargets(false);
      }
    };
    void loadTargets();
    return () => {
      mounted = false;
    };
  }, []);

  const loadRange = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, target });
      const response = await fetch(`/api/earnings/range?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "기간 통계 조회 실패");
      }
      const payload = (await response.json()) as EarningsRangeResponse;
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "기간 통계 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [from, to, target]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const targetOptions = useMemo(() => {
    return [
      { value: "all", label: "전체" },
      { value: "me", label: "내 운임만" },
      ...targets.map((t) => ({ value: t.target_name, label: `제3자 · ${t.target_name}` })),
    ];
  }, [targets]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">기간 통계</h3>
        <button type="button" className="h-8 rounded-lg border border-slate-300 px-2 text-xs" onClick={() => void loadRange()} disabled={loading}>
          {loading ? "조회 중..." : "새로고침"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">모든 합계는 실수령 기준(로지 23% 반영)입니다.</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`h-10 rounded-lg text-sm ${preset === item.key ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}
            onClick={() => setPreset(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          시작일
          <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-slate-600">
          종료일
          <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div className="mt-2">
        <label className="text-xs text-slate-600">대상 필터</label>
        <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={target} onChange={(e) => setTarget(e.target.value as TargetFilterValue)}>
          {targetOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {loadingTargets ? <p className="mt-1 text-[11px] text-slate-500">대상 목록 불러오는 중...</p> : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" className="mt-2 h-9 rounded-lg border border-rose-300 bg-white px-3 text-xs" onClick={() => void loadRange()}>
            재시도
          </button>
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs text-slate-500">선택 기간 총 실수령 합계</div>
        <div className="mt-1 text-xl font-semibold text-slate-800">{formatKRW(data?.totalNet ?? 0)}</div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-700">일자별 합계</h4>
          <div className="mt-2 space-y-1">
            {(data?.byDay ?? []).map((row) => (
              <div key={row.ymd} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{row.ymd}</span>
                <span className="font-medium">{formatKRW(row.totalNet)}</span>
              </div>
            ))}
            {(data?.byDay.length ?? 0) === 0 ? <p className="text-xs text-slate-500">데이터가 없습니다.</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-700">대상별 합계</h4>
          <div className="mt-2 space-y-1">
            {(data?.byTarget ?? []).map((row) => (
              <div key={row.targetName} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{row.targetName || MY_EARNING_TARGET_NAME}</span>
                <span className="font-medium">{formatKRW(row.totalNet)}</span>
              </div>
            ))}
            {(data?.byTarget.length ?? 0) === 0 ? <p className="text-xs text-slate-500">데이터가 없습니다.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { EarningsTargetSelect } from "@/components/EarningsTargetSelect";
import {
  calcNet,
  formatKRW,
  MY_EARNING_TARGET_NAME,
  normalizeEarningItem,
  parseAmount,
  sumNet,
} from "@/lib/earnings";
import type { DailyEarningItem, DailyEarningRow, EarningTargetRow } from "@/types";

type LocalLine = {
  id: string;
  amountGrossText: string;
  isLogi: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function createLine(seed?: Partial<LocalLine>): LocalLine {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    amountGrossText: seed?.amountGrossText ?? "",
    isLogi: seed?.isLogi ?? false,
  };
}

function itemToLine(item: DailyEarningItem): LocalLine {
  return createLine({
    amountGrossText: item.amount_gross > 0 ? String(item.amount_gross) : "",
    isLogi: item.is_logi,
  });
}

function normalizeSavedItemsToLines(items: unknown[]): LocalLine[] {
  const normalized = items.map(normalizeEarningItem).filter((item): item is DailyEarningItem => Boolean(item));
  return normalized.length > 0 ? normalized.map(itemToLine) : [createLine()];
}

function lineToItem(line: LocalLine): DailyEarningItem | null {
  const gross = parseAmount(line.amountGrossText);
  if (!gross) return null;
  return {
    amount_gross: gross,
    is_logi: line.isLogi,
    amount_net: calcNet(gross, line.isLogi),
    createdAt: new Date().toISOString(),
  };
}

export function EarningsModal({ open, onClose }: Props) {
  const [targets, setTargets] = useState<EarningTargetRow[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [selectedTargetValue, setSelectedTargetValue] = useState<"self" | string>("self");

  const [lines, setLines] = useState<LocalLine[]>([createLine()]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingLoadedRow, setPendingLoadedRow] = useState<DailyEarningRow | null>(null);
  const [showLoadConflictPrompt, setShowLoadConflictPrompt] = useState(false);

  const selectedTarget = useMemo(() => {
    if (selectedTargetValue === "self") {
      return { targetName: MY_EARNING_TARGET_NAME, targetId: null as string | null };
    }
    const target = targets.find((item) => item.id === selectedTargetValue);
    return { targetName: target?.target_name ?? "", targetId: target?.id ?? null };
  }, [selectedTargetValue, targets]);

  const parsedItems = useMemo(() => lines.map(lineToItem).filter((item): item is DailyEarningItem => Boolean(item)), [lines]);
  const totalAmount = useMemo(() => sumNet(parsedItems), [parsedItems]);
  const totalGrossAmount = useMemo(
    () => parsedItems.reduce((sum, item) => sum + (Number.isFinite(item.amount_gross) ? item.amount_gross : 0), 0),
    [parsedItems],
  );

  const resetDraft = () => {
    setSelectedTargetValue("self");
    setLines([createLine()]);
    setLoadingToday(false);
    setSaving(false);
    setError(null);
    setToastMessage(null);
    setPendingLoadedRow(null);
    setShowLoadConflictPrompt(false);
  };

  useEffect(() => {
    if (!open) {
      resetDraft();
      return;
    }

    let mounted = true;
    const loadTargets = async () => {
      setTargetsLoading(true);
      setTargetsError(null);
      try {
        const response = await fetch("/api/earnings/targets", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "대상 목록 조회 실패");
        }
        const payload = (await response.json()) as { targets?: EarningTargetRow[] };
        if (!mounted) return;
        setTargets(Array.isArray(payload.targets) ? payload.targets : []);
      } catch (loadError) {
        if (!mounted) return;
        setTargetsError(loadError instanceof Error ? loadError.message : "대상 목록 조회 실패");
      } finally {
        if (mounted) setTargetsLoading(false);
      }
    };

    void loadTargets();
    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  if (!open) return null;

  const hasExistingDraft = lines.some((line) => parseAmount(line.amountGrossText) > 0);

  const applyLoadedRow = (row: DailyEarningRow, mode: "merge" | "overwrite") => {
    const loadedLines = normalizeSavedItemsToLines(Array.isArray(row.items) ? row.items : []);
    setLines((prev) => {
      if (mode === "overwrite") return loadedLines;
      const merged = [
        ...prev.filter((line) => parseAmount(line.amountGrossText) > 0),
        ...loadedLines.filter((line) => parseAmount(line.amountGrossText) > 0),
      ];
      return merged.length > 0 ? merged : [createLine()];
    });
    setPendingLoadedRow(null);
    setShowLoadConflictPrompt(false);
    setToastMessage("오늘 운임을 불러왔습니다.");
  };

  const onLoadToday = async () => {
    if (!selectedTarget.targetName) {
      setError("대상을 먼저 선택하세요.");
      return;
    }

    setError(null);
    setLoadingToday(true);
    try {
      const params = new URLSearchParams({ target: selectedTarget.targetName });
      if (selectedTarget.targetId) params.set("targetId", selectedTarget.targetId);
      const response = await fetch(`/api/earnings/today?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "오늘 운임 불러오기 실패");
      }
      const payload = (await response.json()) as { row: DailyEarningRow | null };
      if (!payload.row) {
        setToastMessage("오늘 저장된 운임이 없습니다.");
        return;
      }

      if (hasExistingDraft) {
        setPendingLoadedRow(payload.row);
        setShowLoadConflictPrompt(true);
        return;
      }

      setLines(normalizeSavedItemsToLines(Array.isArray(payload.row.items) ? payload.row.items : []));
      setToastMessage("오늘 운임을 불러왔습니다.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "오늘 운임 불러오기 실패");
    } finally {
      setLoadingToday(false);
    }
  };

  const onSave = async () => {
    if (!selectedTarget.targetName) {
      setError("대상을 먼저 선택하세요.");
      return;
    }
    if (parsedItems.length === 0) {
      setError("최소 1건 이상의 운임을 입력하세요.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/earnings/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: selectedTarget.targetName,
          targetId: selectedTarget.targetId,
          items: parsedItems,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "저장 실패");
      }
      setToastMessage("오늘 운임을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const onCreateTarget = async (targetName: string) => {
    const response = await fetch("/api/earnings/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetName }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message ?? "대상 추가 실패");
    }
    const payload = (await response.json()) as { row: EarningTargetRow };
    setTargets((prev) => {
      const next = [...prev.filter((target) => target.id !== payload.row.id), payload.row];
      next.sort((a, b) => a.target_name.localeCompare(b.target_name, "ko"));
      return next;
    });
    setSelectedTargetValue(payload.row.id);
    setToastMessage(`대상 '${payload.row.target_name}' 추가 완료`);
  };

  const updateLineGross = (lineId: string, rawValue: string) => {
    const digits = rawValue.replace(/[^\d]/g, "");
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, amountGrossText: digits } : line)));
  };

  const toggleLineLogi = (lineId: string) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, isLogi: !line.isLogi } : line)));
  };

  const deleteLine = (lineId: string) => {
    setLines((prev) => {
      const next = prev.filter((line) => line.id !== lineId);
      return next.length > 0 ? next : [createLine()];
    });
  };

  const addLine = () => setLines((prev) => [...prev, createLine()]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="max-h-[88vh] overflow-y-auto p-4 sm:max-h-[80vh]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-800">운임 계산기</h3>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={onClose}>
              닫기
            </button>
          </div>

          <EarningsTargetSelect
            targets={targets}
            selectedValue={selectedTargetValue}
            onChange={setSelectedTargetValue}
            onCreateTarget={onCreateTarget}
            disabled={saving || loadingToday || targetsLoading}
          />
          {targetsLoading ? <p className="mt-2 text-xs text-slate-500">대상 목록 불러오는 중...</p> : null}
          {targetsError ? <p className="mt-2 text-xs text-rose-600">{targetsError}</p> : null}

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">운임 항목</p>
              <span className="text-xs text-slate-500">자동 합산 ON</span>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => {
                const gross = parseAmount(line.amountGrossText);
                const net = calcNet(gross, line.isLogi);
                return (
                  <div key={line.id} className="rounded-lg border border-slate-200 p-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₩</span>
                        <input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="h-11 w-full rounded-lg border border-slate-300 pl-7 pr-3 text-sm"
                          placeholder={`${index + 1}건 금액(원금)`}
                          value={line.amountGrossText ? Number(line.amountGrossText).toLocaleString("ko-KR") : ""}
                          onChange={(e) => updateLineGross(line.id, e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="h-11 rounded-lg border border-rose-300 px-3 text-sm text-rose-700"
                        onClick={() => deleteLine(line.id)}
                      >
                        삭제
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={line.isLogi}
                          onChange={() => toggleLineLogi(line.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        로지(-23%)
                      </label>
                      <span className="text-xs text-slate-500">실수령: <span className="font-medium text-slate-800">{formatKRW(net)}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white text-sm" onClick={addLine}>
              + 운임 추가
            </button>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                <div className="text-xs text-cyan-800">합계(순익)</div>
                <div className="mt-1 text-sm font-semibold text-cyan-950">{formatKRW(totalAmount)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-600">매출금액(원금 기준)</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatKRW(totalGrossAmount)}</div>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              합계는 실수령 기준이며, 매출금액은 입력한 원금 기준입니다.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" className="h-11 rounded-lg border border-slate-300 bg-white text-sm disabled:opacity-50" onClick={() => void onLoadToday()} disabled={loadingToday || saving}>
              {loadingToday ? "불러오는 중..." : "오늘 운임 불러오기"}
            </button>
            <button type="button" className="h-11 rounded-lg bg-cyan-700 text-sm font-medium text-white disabled:opacity-50" onClick={() => void onSave()} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button type="button" className="h-11 rounded-lg border border-slate-300 bg-white text-sm" onClick={onClose} disabled={saving}>
              닫기
            </button>
          </div>

          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
          {toastMessage ? <p className="mt-2 text-sm text-emerald-700">{toastMessage}</p> : null}
        </div>

        {showLoadConflictPrompt && pendingLoadedRow ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <h4 className="text-sm font-semibold text-slate-800">오늘 운임 불러오기</h4>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                현재 입력값이 있습니다. 불러온 데이터를 덮어쓸지, 현재 입력에 합칠지 선택하세요.
              </p>
              <div className="mt-3 grid gap-2">
                <button type="button" className="h-10 rounded-lg bg-cyan-700 text-sm font-medium text-white" onClick={() => applyLoadedRow(pendingLoadedRow, "merge")}>
                  합치기 (기본)
                </button>
                <button type="button" className="h-10 rounded-lg border border-slate-300 bg-white text-sm" onClick={() => applyLoadedRow(pendingLoadedRow, "overwrite")}>
                  덮어쓰기
                </button>
                <button
                  type="button"
                  className="h-10 rounded-lg border border-slate-300 bg-white text-sm"
                  onClick={() => {
                    setShowLoadConflictPrompt(false);
                    setPendingLoadedRow(null);
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

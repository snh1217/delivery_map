"use client";

import { useMemo, useState } from "react";
import { MY_EARNING_TARGET_NAME } from "@/lib/earnings";
import type { EarningTargetRow } from "@/types";

type TargetValue = "self" | string;

type Props = {
  targets: EarningTargetRow[];
  selectedValue: TargetValue;
  onChange: (value: TargetValue) => void;
  onCreateTarget: (targetName: string) => Promise<void>;
  disabled?: boolean;
};

export function EarningsTargetSelect({ targets, selectedValue, onChange, onCreateTarget, disabled = false }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTargetName, setNewTargetName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTargets = useMemo(() => targets.filter((target) => target.is_active), [targets]);

  const submitCreate = async () => {
    const value = newTargetName.trim();
    if (!value) {
      setError("대상 이름을 입력하세요.");
      return;
    }
    try {
      setError(null);
      setCreating(true);
      await onCreateTarget(value);
      setNewTargetName("");
      setIsAdding(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "대상 추가 실패");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">대상 선택(필수)</label>
          <select
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            value={selectedValue}
            onChange={(e) => onChange((e.target.value || "self") as TargetValue)}
            disabled={disabled || creating}
          >
            <option value="self">{MY_EARNING_TARGET_NAME}</option>
            {activeTargets.map((target) => (
              <option key={target.id} value={target.id}>
                제3자 · {target.target_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          onClick={() => {
            setError(null);
            setIsAdding((prev) => !prev);
          }}
          disabled={disabled || creating}
        >
          + 대상 추가
        </button>
      </div>

      {isAdding ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              placeholder="별칭 입력 (예: 김기사)"
              value={newTargetName}
              onChange={(e) => setNewTargetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitCreate();
                }
              }}
              disabled={creating}
              maxLength={40}
            />
            <button
              type="button"
              className="h-10 rounded-lg bg-cyan-700 px-3 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void submitCreate()}
              disabled={creating}
            >
              {creating ? "추가 중..." : "추가"}
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              onClick={() => {
                setIsAdding(false);
                setNewTargetName("");
                setError(null);
              }}
              disabled={creating}
            >
              취소
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}


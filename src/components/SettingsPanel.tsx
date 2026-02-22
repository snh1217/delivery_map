"use client";

import { useState } from "react";
import type { SettingsState } from "@/types";

type Props = {
  settings: SettingsState;
  onChange: (next: SettingsState) => void;
};

type NumericFieldKey = "halfAngleDeg" | "forwardBufferKm" | "backwardTailKm";

export function SettingsPanel({ settings, onChange }: Props) {
  const [draftHalfAngle, setDraftHalfAngle] = useState(String(settings.halfAngleDeg));
  const [draftForwardBuffer, setDraftForwardBuffer] = useState(String(settings.forwardBufferKm));
  const [draftBackwardTail, setDraftBackwardTail] = useState(String(settings.backwardTailKm));

  const commitNumber = (key: NumericFieldKey, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      if (key === "halfAngleDeg") setDraftHalfAngle(String(settings.halfAngleDeg));
      if (key === "forwardBufferKm") setDraftForwardBuffer(String(settings.forwardBufferKm));
      if (key === "backwardTailKm") setDraftBackwardTail(String(settings.backwardTailKm));
      return;
    }

    if (key === "halfAngleDeg") {
      const clamped = Math.min(80, Math.max(5, parsed));
      setDraftHalfAngle(String(clamped));
      onChange({ ...settings, halfAngleDeg: clamped });
      return;
    }

    if (key === "forwardBufferKm") {
      const clamped = Math.min(30, Math.max(0, parsed));
      setDraftForwardBuffer(String(clamped));
      onChange({ ...settings, forwardBufferKm: clamped });
      return;
    }

    const clamped = Math.min(30, Math.max(0, parsed));
    setDraftBackwardTail(String(clamped));
    onChange({ ...settings, backwardTailKm: clamped });
  };

  const numberInputHandlers = (key: NumericFieldKey, value: string) => ({
    onBlur: () => commitNumber(key, value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitNumber(key, value);
        e.currentTarget.blur();
      }
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">설정</h2>
            <p className="text-xs text-slate-500">
              팬 반각 {settings.halfAngleDeg}도 / 버퍼 {settings.forwardBufferKm}km / 뒤 꼬리{" "}
              {settings.backwardTailKm}km / 기본 길찾기 {settings.navigationApp === "naver" ? "네이버" : "카카오"}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 group-open:hidden">
            펼치기
          </span>
          <span className="hidden rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 group-open:inline-flex">
            접기
          </span>
        </summary>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-3 text-xs text-slate-600">
            팬(부채꼴) 계산값과 기본 길찾기 앱을 설정합니다. `길찾기` 버튼은 아래 선택값(네이버/카카오)을 따라 동작합니다.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-700">
              팬 반각(도)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-2"
                type="number"
                inputMode="numeric"
                min={5}
                max={80}
                value={draftHalfAngle}
                onChange={(e) => setDraftHalfAngle(e.target.value)}
                {...numberInputHandlers("halfAngleDeg", draftHalfAngle)}
              />
            </label>

            <label className="text-sm text-slate-700">
              전방 버퍼(km)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-2"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                value={draftForwardBuffer}
                onChange={(e) => setDraftForwardBuffer(e.target.value)}
                {...numberInputHandlers("forwardBufferKm", draftForwardBuffer)}
              />
            </label>

            <label className="text-sm text-slate-700">
              뒤 꼬리(km)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-2"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                value={draftBackwardTail}
                onChange={(e) => setDraftBackwardTail(e.target.value)}
                {...numberInputHandlers("backwardTailKm", draftBackwardTail)}
              />
            </label>

            <label className="text-sm text-slate-700">
              자동 검색
              <button
                type="button"
                className={`mt-1 h-11 w-full rounded-lg px-2 text-sm font-medium ${
                  settings.autoSearch ? "bg-cyan-700 text-white" : "border border-slate-300 text-slate-700"
                }`}
                onClick={() => onChange({ ...settings, autoSearch: !settings.autoSearch })}
              >
                {settings.autoSearch ? "ON (입력 후 600ms)" : "OFF"}
              </button>
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 text-sm font-medium text-slate-700">기본 길찾기 앱</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`h-10 rounded-lg text-sm ${
                    settings.navigationApp === "naver"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => onChange({ ...settings, navigationApp: "naver" })}
                >
                  네이버
                </button>
                <button
                  type="button"
                  className={`h-10 rounded-lg text-sm ${
                    settings.navigationApp === "kakao"
                      ? "bg-amber-500 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => onChange({ ...settings, navigationApp: "kakao" })}
                >
                  카카오
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 text-sm font-medium text-slate-700">결과 보기 방식</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`h-10 rounded-lg text-sm ${
                    settings.viewMode === "segment"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => onChange({ ...settings, viewMode: "segment" })}
                >
                  구간별 보기
                </button>
                <button
                  type="button"
                  className={`h-10 rounded-lg text-sm ${
                    settings.viewMode === "all"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => onChange({ ...settings, viewMode: "all" })}
                >
                  전체 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

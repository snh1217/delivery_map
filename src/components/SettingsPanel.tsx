"use client";

import type { SettingsState } from "@/types";

type Props = {
  settings: SettingsState;
  onChange: (next: SettingsState) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">설정</h2>
            <p className="text-xs text-slate-500">
              팬 반각 {settings.halfAngleDeg}도 / 전방 버퍼 {settings.forwardBufferKm}km / 뒤 꼬리{" "}
              {settings.backwardTailKm}km
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
            팬(부채꼴) 계산값을 조절합니다. 기본값(반각 30도 / 버퍼 3km / 뒤 꼬리 5km)으로 시작하는 것을
            권장합니다.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-700">
              팬 반각(도)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-2"
                type="number"
                min={5}
                max={80}
                value={settings.halfAngleDeg}
                onChange={(e) => onChange({ ...settings, halfAngleDeg: Number(e.target.value) })}
              />
            </label>

            <label className="text-sm text-slate-700">
              전방 버퍼(km)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-2"
                type="number"
                step="0.5"
                min={0}
                value={settings.forwardBufferKm}
                onChange={(e) => onChange({ ...settings, forwardBufferKm: Number(e.target.value) })}
              />
            </label>

            <label className="text-sm text-slate-700">
              뒤 꼬리(km)
              <input
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-2"
                type="number"
                step="0.5"
                min={0}
                value={settings.backwardTailKm}
                onChange={(e) => onChange({ ...settings, backwardTailKm: Number(e.target.value) })}
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

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              className={`h-11 rounded-lg px-3 text-sm ${
                settings.viewMode === "segment" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
              }`}
              onClick={() => onChange({ ...settings, viewMode: "segment" })}
            >
              구간별 보기
            </button>
            <button
              type="button"
              className={`h-11 rounded-lg px-3 text-sm ${
                settings.viewMode === "all" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
              }`}
              onClick={() => onChange({ ...settings, viewMode: "all" })}
            >
              전체 보기
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}

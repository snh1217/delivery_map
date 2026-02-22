"use client";

import type { SettingsState } from "@/types";

type Props = {
  settings: SettingsState;
  onChange: (next: SettingsState) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">설정</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-slate-700">
          halfAngleDeg
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
          forwardBufferKm
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
          backwardTailKm
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
          autoSearch
          <button
            type="button"
            className={`mt-1 h-11 w-full rounded-lg px-2 text-sm font-medium ${
              settings.autoSearch ? "bg-cyan-700 text-white" : "border border-slate-300 text-slate-700"
            }`}
            onClick={() => onChange({ ...settings, autoSearch: !settings.autoSearch })}
          >
            {settings.autoSearch ? "ON (600ms)" : "OFF"}
          </button>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`h-10 rounded-lg px-3 text-sm ${
            settings.viewMode === "segment" ? "bg-slate-900 text-white" : "border border-slate-300"
          }`}
          onClick={() => onChange({ ...settings, viewMode: "segment" })}
        >
          구간별 보기
        </button>
        <button
          type="button"
          className={`h-10 rounded-lg px-3 text-sm ${
            settings.viewMode === "all" ? "bg-slate-900 text-white" : "border border-slate-300"
          }`}
          onClick={() => onChange({ ...settings, viewMode: "all" })}
        >
          전체 보기
        </button>
      </div>
    </section>
  );
}

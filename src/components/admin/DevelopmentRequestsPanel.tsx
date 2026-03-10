"use client";

import { useEffect, useState } from "react";
import type { DevelopmentRequestRow, DevelopmentRequestStatus } from "@/types";

const STATUS_OPTIONS: DevelopmentRequestStatus[] = ["pending", "reviewing", "done"];

export function DevelopmentRequestsPanel() {
  const [rows, setRows] = useState<DevelopmentRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, DevelopmentRequestStatus>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/dev-requests", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "개발 요청 조회 실패");
      }
      const payload = (await response.json()) as { rows: DevelopmentRequestRow[] };
      setRows(payload.rows ?? []);
      setNotes(
        Object.fromEntries((payload.rows ?? []).map((row) => [row.id, row.admin_note ?? ""])),
      );
      setStatuses(
        Object.fromEntries((payload.rows ?? []).map((row) => [row.id, row.status])),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "개발 요청 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateRow = async (id: string) => {
    try {
      setSavingId(id);
      setError(null);
      const response = await fetch("/api/admin/dev-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: statuses[id] ?? "pending",
          adminNote: notes[id] ?? "",
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "개발 요청 수정 실패");
      }
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "개발 요청 수정 실패");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">개발 요청 게시판</h3>
          <p className="text-xs text-slate-500">사용자가 등록한 기능 요청을 확인하고 상태를 관리합니다.</p>
        </div>
        <button
          type="button"
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-slate-800">{row.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {row.owner_phone} · {new Date(row.created_at).toLocaleString()}
                </div>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">{row.status}</span>
            </div>

            <p className="mt-2 text-sm text-slate-700">{row.body}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
              <select
                className="h-10 rounded-lg border border-slate-300 px-2 text-sm"
                value={statuses[row.id] ?? row.status}
                onChange={(event) => {
                  const nextStatus = event.target.value as DevelopmentRequestStatus;
                  setStatuses((prev) => ({ ...prev, [row.id]: nextStatus }));
                }}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <input
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                placeholder="관리자 메모"
                value={notes[row.id] ?? ""}
                onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))}
              />

              <button
                type="button"
                className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => void updateRow(row.id)}
                disabled={savingId === row.id}
              >
                {savingId === row.id ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
            등록된 개발 요청이 없습니다.
          </div>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import type { AllowlistRow, LoginLogRow } from "@/types";

export function AdminPanel() {
  const [rows, setRows] = useState<AllowlistRow[]>([]);
  const [logs, setLogs] = useState<LoginLogRow[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/auth/admin?activeOnly=${activeOnly ? "1" : "0"}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "조회 실패");
      return;
    }

    const payload = (await response.json()) as { allowlist: AllowlistRow[]; logs: LoginLogRow[] };
    setRows(payload.allowlist);
    setLogs(payload.logs);
  }, [activeOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim();
    if (!q) {
      return rows;
    }

    return rows.filter((row) => row.phone.includes(q));
  }, [rows, search]);

  const onAdd = async () => {
    const normalized = normalizePhoneNumber(phoneInput);
    if (!normalized) {
      setError("전화번호 형식이 올바르지 않습니다.");
      return;
    }

    const response = await fetch("/api/auth/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "추가 실패");
      return;
    }

    setPhoneInput("");
    await load();
  };

  const onToggle = async (phone: string, current: boolean) => {
    const response = await fetch("/api/auth/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, isActive: !current }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "상태 변경 실패");
      return;
    }

    await load();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">관리자 패널</h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="추가할 전화번호"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
        />
        <button
          type="button"
          className="h-11 rounded-lg bg-cyan-700 px-4 text-sm font-medium text-white"
          onClick={() => void onAdd()}
        >
          추가
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="전화번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={`h-10 rounded-lg px-3 text-sm ${activeOnly ? "bg-slate-900 text-white" : "border border-slate-300"}`}
          onClick={() => setActiveOnly((v) => !v)}
        >
          활성만 보기
        </button>
        <button
          type="button"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          onClick={() => void load()}
        >
          새로고침
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">전화번호</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">등록일</th>
              <th className="px-3 py-2 text-left">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.phone} className="border-t border-slate-200">
                <td className="px-3 py-2">{row.phone}</td>
                <td className="px-3 py-2">{row.is_active ? "활성" : "비활성"}</td>
                <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1"
                    onClick={() => void onToggle(row.phone, row.is_active)}
                  >
                    {row.is_active ? "비활성화" : "활성화"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">최근 로그인</h3>
        <ul className="space-y-1 text-xs text-slate-600">
          {logs.map((log) => (
            <li key={log.id}>{new Date(log.created_at).toLocaleString()} - {log.phone}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

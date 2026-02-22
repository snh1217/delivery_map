"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import type { AllowlistRow, LoginLogRow, SignupRequestRow } from "@/types";

type AdminPayload = {
  allowlist: AllowlistRow[];
  logs: LoginLogRow[];
  signupRequests: SignupRequestRow[];
};

export function AdminPanel() {
  const [rows, setRows] = useState<AllowlistRow[]>([]);
  const [logs, setLogs] = useState<LoginLogRow[]>([]);
  const [requests, setRequests] = useState<SignupRequestRow[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/admin?activeOnly=${activeOnly ? "1" : "0"}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "조회 실패");
      }

      const payload = (await response.json()) as AdminPayload;
      setRows(payload.allowlist);
      setLogs(payload.logs);
      setRequests(payload.signupRequests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim();
    if (!q) {
      return rows;
    }

    return rows.filter((row) => row.phone.includes(q));
  }, [rows, search]);

  const filteredRequests = useMemo(() => {
    const q = search.trim();
    if (!q) {
      return requests;
    }

    return requests.filter((row) => row.phone.includes(q) || row.name.includes(q));
  }, [requests, search]);

  const onAddAllowlist = async () => {
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

  const onToggleAllowlist = async (phone: string, current: boolean) => {
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

  const onReviewRequest = async (phone: string, approve: boolean) => {
    const response = await fetch("/api/auth/admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, approve }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "요청 처리 실패");
      return;
    }

    await load();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">관리자 패널</h2>
        <button
          type="button"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="전화번호 검색 (allowlist/요청 공통)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={`h-11 rounded-lg px-4 text-sm ${activeOnly ? "bg-slate-900 text-white" : "border border-slate-300"}`}
          onClick={() => setActiveOnly((v) => !v)}
        >
          활성만 보기
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-slate-700">회원가입 요청</h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">전화번호</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">요청일</th>
                <th className="px-3 py-2 text-left">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((row) => (
                <tr key={row.phone} className="border-t border-slate-200">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.phone}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 py-1"
                        onClick={() => void onReviewRequest(row.phone, true)}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 py-1"
                        onClick={() => void onReviewRequest(row.phone, false)}
                      >
                        반려
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    요청 내역이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-slate-700">allowlist 직접 추가</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="추가할 전화번호"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
          <button
            type="button"
            className="h-11 rounded-lg bg-cyan-700 px-4 text-sm font-medium text-white"
            onClick={() => void onAddAllowlist()}
          >
            추가
          </button>
        </div>
      </div>

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
                    onClick={() => void onToggleAllowlist(row.phone, row.is_active)}
                  >
                    {row.is_active ? "비활성화" : "활성화"}
                  </button>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={4}>
                  allowlist 데이터가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">최근 로그인</h3>
        <ul className="space-y-1 text-xs text-slate-600">
          {logs.map((log) => (
            <li key={log.id}>
              {new Date(log.created_at).toLocaleString()} - {log.phone}
            </li>
          ))}
          {logs.length === 0 ? <li>로그가 없습니다.</li> : null}
        </ul>
      </div>
    </section>
  );
}

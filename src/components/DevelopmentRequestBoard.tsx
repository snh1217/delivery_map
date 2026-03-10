"use client";

import { useState } from "react";
import type { DevelopmentRequestRow } from "@/types";

type Props = {
  rows: DevelopmentRequestRow[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSubmit: (payload: { title: string; body: string }) => Promise<void>;
};

export function DevelopmentRequestBoard({ rows, loading, error, onRefresh, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setLocalError("제목과 요청 내용을 모두 입력하세요.");
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      await onSubmit({ title: cleanTitle, body: cleanBody });
      setTitle("");
      setBody("");
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : "요청 등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">개발 요청 남기기</h3>
            <p className="text-xs text-slate-500">필요한 기능, 불편한 점, 개선 아이디어를 남겨주세요.</p>
          </div>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="예: 아이폰 크롬 접속 안정화"
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="min-h-[120px] rounded-lg border border-slate-300 p-3 text-sm"
            placeholder="어떤 상황에서 필요한지, 원하는 결과가 무엇인지 적어주세요."
            value={body}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
          />
          {localError ? <p className="text-xs text-rose-600">{localError}</p> : null}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          <button
            type="button"
            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "등록 중..." : "개발 요청 등록"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">내 요청 내역</h3>
          <span className="text-xs text-slate-500">{rows.length}건</span>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <details key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {row.title}
                <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">{row.status}</span>
              </summary>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                <p>{row.body}</p>
                {row.admin_note ? (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-900">
                    관리자 메모: {row.admin_note}
                  </div>
                ) : null}
                <p>등록: {new Date(row.created_at).toLocaleString()}</p>
              </div>
            </details>
          ))}

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
              아직 등록한 개발 요청이 없습니다.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

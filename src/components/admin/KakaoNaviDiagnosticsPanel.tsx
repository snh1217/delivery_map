"use client";

import { useCallback, useEffect, useState } from "react";
import {
  runKakaoNaviDiagnostics,
  type KakaoNaviDiagnosticReasonCode,
  type KakaoNaviDiagnosticsResult,
} from "@/lib/kakao/diagnostics";

const REASON_LABELS: Record<KakaoNaviDiagnosticReasonCode, string> = {
  KEY_MISSING: "카카오 JavaScript 키 미설정",
  SDK_LOAD_FAILED: "카카오 SDK 로드 실패",
  NAVI_API_UNAVAILABLE: "Kakao.Navi API 사용 불가",
  DOMAIN_NOT_ALLOWED: "도메인 미등록 가능성(추정)",
};

function CheckRow(props: { label: string; ok: boolean; helper?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-700">{props.label}</div>
        {props.helper ? <div className="mt-0.5 text-xs text-slate-500">{props.helper}</div> : null}
      </div>
      <span
        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
          props.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        }`}
      >
        {props.ok ? "✅" : "❌"}
      </span>
    </div>
  );
}

export function KakaoNaviDiagnosticsPanel() {
  const [result, setResult] = useState<KakaoNaviDiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (reload = false) => {
    setLoading(true);
    setError(null);
    try {
      const next = await runKakaoNaviDiagnostics({ reload });
      setResult(next);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "진단 실행 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run(false);
  }, [run]);

  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">카카오내비 진단</h3>
          <p className="mt-0.5 text-xs text-slate-500">일반 사용자 화면에는 표시되지 않는 관리자 전용 점검 정보입니다.</p>
        </div>
        <button
          type="button"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50"
          onClick={() => void run(true)}
          disabled={loading}
        >
          {loading ? "점검 중..." : "다시 점검"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-3 grid gap-2">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          현재 도메인(hostname): <span className="font-semibold text-slate-800">{result?.hostname ?? "-"}</span>
        </div>

        <CheckRow label="카카오 JS 키 설정 여부" ok={Boolean(result?.checks.hasJsKey)} helper="키 값은 노출하지 않음" />
        <CheckRow label="카카오 SDK 로드" ok={Boolean(result?.checks.sdkLoaded)} />
        <CheckRow label="Kakao.Navi API 사용 가능" ok={Boolean(result?.checks.hasNavi)} />
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-700">실패 원인 분류</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(result?.reasonCodes ?? []).length > 0 ? (
            result!.reasonCodes.map((code) => (
              <span
                key={code}
                className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700"
                title={REASON_LABELS[code]}
              >
                {code}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500">이상 없음</span>
          )}
        </div>
        {(result?.reasonCodes ?? []).length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {result!.reasonCodes.map((code) => (
              <li key={`detail-${code}`}>- {REASON_LABELS[code]}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-xs font-semibold text-slate-700">카카오 개발자 콘솔 Web 도메인 체크리스트</div>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
          <li>`http://localhost:3000` 등록</li>
          <li>`https://deliverymap.vercel.app` 또는 현재 운영 `vercel.app` 도메인 등록</li>
          <li>커스텀 도메인 사용 중이면 해당 도메인도 추가 등록</li>
          <li>카카오 JavaScript 키가 프로젝트 환경변수에 설정되어 있는지 확인</li>
        </ul>
      </div>
    </section>
  );
}

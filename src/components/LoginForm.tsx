"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoneNumber } from "@/lib/auth/phone";

type Props = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/app" }: Props) {
  const router = useRouter();
  const [loginPhone, setLoginPhone] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [status, setStatus] = useState("승인된 휴대폰 번호로 로그인할 수 있습니다.");
  const [error, setError] = useState<string | null>(null);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const onLogin = async () => {
    const normalized = normalizePhoneNumber(loginPhone);
    if (!normalized) {
      setError("전화번호 형식이 올바르지 않습니다. 예: 01012345678");
      return;
    }

    setError(null);
    setLoadingLogin(true);
    try {
      const response = await fetch("/api/auth/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "로그인 실패");
      }

      setStatus("로그인 성공");
      router.replace(nextPath);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인 실패");
    } finally {
      setLoadingLogin(false);
    }
  };

  const onRequestSignup = async () => {
    const normalized = normalizePhoneNumber(requestPhone);
    if (!requestName.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    if (!normalized) {
      setError("전화번호 형식이 올바르지 않습니다.");
      return;
    }

    setError(null);
    setLoadingRequest(true);
    try {
      const response = await fetch("/api/auth/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: requestName.trim(), phone: normalized }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "회원가입 요청 실패");
      }

      setRequestPhone(normalized);
      setStatus("회원가입 요청이 접수되었습니다. 관리자 승인 후 로그인 가능합니다.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "회원가입 요청 실패");
    } finally {
      setLoadingRequest(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold text-slate-800">전화번호 승인 로그인</h1>
      <p className="mt-1 text-sm text-slate-600">회원가입 요청 후 관리자 승인을 받아야 사용할 수 있습니다.</p>
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        <p>이용 방법</p>
        <p>1. 아래에서 이름/전화번호로 회원가입 요청</p>
        <p>2. 관리자가 승인하면 같은 전화번호로 로그인</p>
        <p>3. 관리자 승인 화면은 로그인 후 상단의 관리자 승인 관리 버튼에서 이동</p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <h2 className="text-sm font-semibold text-slate-700">로그인</h2>
        <div className="mt-2 space-y-2">
          <input
            className="h-12 w-full rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="승인된 전화번호 (예: 01012345678)"
            value={loginPhone}
            onChange={(e) => setLoginPhone(e.target.value)}
          />
          <button
            type="button"
            className="h-12 w-full rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void onLogin()}
            disabled={loadingLogin}
          >
            로그인
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 p-3">
        <h2 className="text-sm font-semibold text-slate-700">회원가입 요청</h2>
        <div className="mt-2 space-y-2">
          <input
            className="h-12 w-full rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="이름"
            value={requestName}
            onChange={(e) => setRequestName(e.target.value)}
          />
          <input
            className="h-12 w-full rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="전화번호 (예: 01012345678)"
            value={requestPhone}
            onChange={(e) => setRequestPhone(e.target.value)}
          />
          <button
            type="button"
            className="h-12 w-full rounded-lg bg-cyan-700 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void onRequestSignup()}
            disabled={loadingRequest}
          >
            회원가입 요청
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {!error ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
    </div>
  );
}

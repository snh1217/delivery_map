"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { resolveAuthProvider } from "@/lib/auth/provider";
import { FirebasePhoneProvider } from "@/lib/auth/firebaseProvider";
import { SupabasePhoneProvider } from "@/lib/auth/supabaseProvider";

type Props = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/app" }: Props) {
  const router = useRouter();

  const providerType = resolveAuthProvider();
  const provider = useMemo(
    () => (providerType === "firebase" ? new FirebasePhoneProvider() : new SupabasePhoneProvider()),
    [providerType],
  );

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("대기");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      setError("전화번호 형식이 올바르지 않습니다. 예: 01012345678");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await provider.signInWithPhone(normalized);
      setStatus("인증번호를 전송했습니다.");
      setPhone(normalized);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "전송 실패");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      setError("전화번호 형식이 올바르지 않습니다.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const verified = await provider.verifyOtp(normalized, code.trim());

      const response = await fetch("/api/auth/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: verified.provider,
          token: verified.accessToken ?? verified.idToken,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        await provider.signOut();
        throw new Error(payload.message ?? "접근이 승인되지 않았습니다.");
      }

      setStatus("로그인 성공");
      router.replace(nextPath);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "인증 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold text-slate-800">전화번호 OTP 로그인</h1>
      <p className="mt-1 text-sm text-slate-600">초대된 사용자만 사용할 수 있습니다.</p>
      <p className="mt-1 text-xs text-slate-500">인증 방식: {providerType}</p>

      <div className="mt-4 space-y-2">
        <input
          className="h-12 w-full rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="전화번호 (예: 01012345678)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button
          type="button"
          className="h-12 w-full rounded-lg bg-cyan-700 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void onSend()}
          disabled={loading}
        >
          OTP 전송
        </button>

        <input
          className="h-12 w-full rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="인증번호"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="button"
          className="h-12 w-full rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void onVerify()}
          disabled={loading}
        >
          인증 완료
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {!error ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
      <div id="recaptcha-container" className="mt-2" />
    </div>
  );
}

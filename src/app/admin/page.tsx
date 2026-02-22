"use client";

import { AuthGate } from "@/components/AuthGate";
import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <AuthGate requireAdmin>
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-800">관리자 승인 페이지</h1>
            <p className="mt-1 text-sm text-slate-600">
              회원가입 요청을 승인하면 allowlist에 자동 등록되고, 해당 전화번호로 로그인할 수 있습니다.
            </p>
          </section>
          <AdminPanel />
        </div>
      </main>
    </AuthGate>
  );
}

import Link from "next/link";

export default function PublicAboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">서비스 안내</h1>
        <p className="mt-2 text-sm text-slate-600">
          퀵서비스 권역 자동 생성 서비스입니다. 초대된 사용자만 이용 가능합니다.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/login" className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white">
            로그인
          </Link>
          <Link href="/app" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            앱으로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  title: "구역 추출기 | Android 설치 안내",
};

export default function ExtractorAndroidInstallPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Extractor Android</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">구역 추출기 별도 APK 준비 중</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          현재는 웹/PWA 형태로 바로 사용할 수 있고, 같은 OCR 코어를 재사용하는 별도 Android APK 포장 경로도 같이 준비했습니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">지금 바로 쓰는 방법</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a href="/extractor" className="inline-flex items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white">
            웹 추출기 열기
          </a>
          <a href="/app" className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            메인 앱 열기
          </a>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          A폰에서는 <span className="font-medium text-slate-900">구역 추출기</span>로 스크린샷에서 주소를 뽑고, B폰에서는 메인 앱의 <span className="font-medium text-slate-900">받은 주소</span> 카드에서 바로 도착지에 추가하는 흐름을 권장합니다.
        </p>
      </section>
    </main>
  );
}

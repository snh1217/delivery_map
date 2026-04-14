const extractorApkUrl =
  process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_APK_URL?.trim() ||
  "https://github.com/snh1217/delivery_map/releases/download/extractor-android-v2026.04.14/guyeok-extractor-v2026.04.14.apk";

const extractorAabUrl =
  process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_AAB_URL?.trim() ||
  "https://github.com/snh1217/delivery_map/releases/download/extractor-android-v2026.04.14/guyeok-extractor-v2026.04.14.aab";

export const metadata = {
  title: "구역 추출기 | Android 설치 안내",
};

export default function ExtractorAndroidInstallPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Extractor Android</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">구역 추출기 APK 설치</h1>
        <p className="mt-2 text-xs font-medium text-slate-500">버전 1.0.2-extractor · 2026-04-14 핫픽스</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A폰에서는 <span className="font-medium text-slate-900">구역 추출기</span>로 퀵 프로그램 화면을 캡처하고,
          원하는 구역만 선택해서 OCR로 주소를 추출할 수 있습니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">설치 순서</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <li>1. 아래 APK 다운로드 버튼으로 설치 파일을 내려받습니다.</li>
          <li>2. Android에서 알 수 없는 앱 설치 허용을 켭니다.</li>
          <li>3. 앱을 실행한 뒤 권한 허용 및 떠있는 버튼 설정을 마치면 바로 사용할 수 있습니다.</li>
          <li>4. 이미 설치된 구버전이 있다면 새 APK를 덮어 설치해 업데이트하세요.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">다운로드</h2>
        <div className="mt-4 grid gap-3">
          <a
            href={extractorApkUrl}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800"
          >
            구역 추출기 APK 다운로드
          </a>
          <a
            href={extractorAabUrl}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            AAB 다운로드 (스토어 업로드용)
          </a>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          B폰에서는 메인 앱의 <span className="font-medium text-slate-700">받은 주소</span> 카드에서 바로 도착지로 추가할 수 있습니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">추천 사용 흐름</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
          <li>- A폰: 구역 추출기 앱 설치 → 퀵 프로그램 위 OCR 버튼으로 캡처/추출</li>
          <li>- 주소 복사 또는 B폰으로 보내기</li>
          <li>- B폰: 퀵배달 메이커 앱의 받은 주소 카드에서 바로 도착지 추가</li>
        </ul>
      </section>
    </main>
  );
}

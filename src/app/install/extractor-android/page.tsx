const extractorApkUrl =
  process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_APK_URL?.trim() ||
  "https://github.com/snh1217/delivery_map/releases/download/extractor-android-v2026.04.19/guyeok-extractor-v2026.04.19.apk";

const extractorAabUrl =
  process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_AAB_URL?.trim() ||
  "https://github.com/snh1217/delivery_map/releases/download/extractor-android-v2026.04.19/guyeok-extractor-v2026.04.19.aab";

const latestVersion = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_LATEST_VERSION?.trim() || "1.0.2-extractor";
const updatedAt = "2026-04-19";
const changeLog = [
  "접근성 기반 주소 자동 추출 MVP 추가",
  "길안내 클릭 시 extractor 자동 전달 흐름 연결",
  "오버레이/캡처 안정화 및 최신 Android 빌드 정리",
];

export const metadata = {
  title: "구역 추출기 | Android 설치 안내",
};

export default function ExtractorAndroidInstallPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <section className="overflow-hidden rounded-[28px] border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Extractor Android</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">구역 추출기 APK 설치</h1>
            <p className="mt-2 text-xs font-medium text-slate-500">
              버전 {latestVersion} · 업데이트 {updatedAt}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              A폰에서 인성/퀵 프로그램 화면의 주소를 자동 또는 수동으로 추출해 B폰 메인 앱으로 보내는 보조 앱입니다.
              오버레이 버튼, 화면 캡처 OCR, 접근성 기반 자동 추출을 함께 지원합니다.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white/80 px-4 py-3 text-xs leading-5 text-slate-600 shadow-sm">
            <div className="font-semibold text-slate-900">이번 빌드 핵심</div>
            <div className="mt-1">접근성 기반 자동 추출 MVP</div>
            <div>오버레이 캡처 흐름 안정화</div>
            <div>B폰 자동 전송 흐름 연결</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Latest Version</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{latestVersion}</div>
            <div className="mt-1 text-xs text-slate-600">업데이트 날짜 {updatedAt}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div className="text-xs font-semibold text-slate-900">변경사항</div>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
              {changeLog.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">설치 순서</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>1. 아래 APK 다운로드 버튼으로 설치 파일을 내려받습니다.</li>
            <li>2. Android에서 “출처를 알 수 없는 앱 설치 허용”을 켭니다.</li>
            <li>3. 앱 실행 후 오버레이 권한, 접근성 권한, 화면 캡처 권한을 순서대로 허용합니다.</li>
            <li>4. 이전 extractor 앱이 있더라도 새 APK를 덮어 설치하면 업데이트됩니다.</li>
          </ol>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">다운로드</h2>
          <div className="mt-4 grid gap-3">
            <a
              href={extractorApkUrl}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800"
            >
              구역 추출기 APK 다운로드 ({latestVersion})
            </a>
            <a
              href={extractorAabUrl}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              AAB 다운로드 (스토어 업로드용)
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            B폰에서는 메인 앱 상단의 받은 주소 카드에서 extractor가 보낸 주소를 바로 도착지로 추가할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 1</div>
          <div className="mt-2 text-base font-semibold text-slate-900">오버레이 또는 접근성 준비</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            떠있는 OCR 버튼을 띄우거나, 접근성 기반 자동 추출을 켜서 길안내 클릭 시점의 주소를 잡습니다.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 2</div>
          <div className="mt-2 text-base font-semibold text-slate-900">주소 추출</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            OCR 또는 접근성 기반으로 주소 후보를 뽑고, 필요하면 원하는 구역만 선택해 정제합니다.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 3</div>
          <div className="mt-2 text-base font-semibold text-slate-900">B폰으로 전송</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            같은 계정이면 Supabase 전송함을 통해 B폰 메인 앱이 주소를 수신하고, 자동 적용/자동 길안내까지 이어질 수 있습니다.
          </p>
        </div>
      </section>
    </main>
  );
}

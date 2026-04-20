const extractorApkUrl =
  process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_APK_URL?.trim() ||
  "https://github.com/snh1217/delivery_map/releases/download/extractor-android-v2026.04.20.2/guyeok-extractor-v2026.04.20.2.apk";

const extractorAabUrl =
  process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_AAB_URL?.trim() ||
  "https://github.com/snh1217/delivery_map/releases/download/extractor-android-v2026.04.20.2/guyeok-extractor-v2026.04.20.2.aab";

const latestVersion = process.env.NEXT_PUBLIC_EXTRACTOR_ANDROID_LATEST_VERSION?.trim() || "1.0.5-extractor";
const updatedAt = "2026-04-20";
const t = {
  meta: "\uad6c\uc5ed \ucd94\ucd9c\uae30 | Android \uc124\uce58 \uc548\ub0b4",
  title: "\uad6c\uc5ed \ucd94\ucd9c\uae30 APK \uc124\uce58",
  version: "\ubc84\uc804",
  updated: "\uc5c5\ub370\uc774\ud2b8",
  intro:
    "A\ud3f0\uc5d0\uc11c \ud000 \ud504\ub85c\uadf8\ub7a8 \ud654\uba74\uc758 \uc8fc\uc18c\ub97c OCR \ub610\ub294 \uc811\uadfc\uc131 \uae30\ubc18 \uc790\ub3d9 \ucd94\ucd9c\ub85c \uc77d\uace0, B\ud3f0\uc758 \ud000\ubc30\ub2ec \uba54\uc774\ucee4\ub85c \ubcf4\ub0b4\ub294 \ubcf4\uc870 \uc571\uc785\ub2c8\ub2e4. \uc6f9\uc5d0\uc11c\ub294 \ub2e4\ub978 \uc571\uc758 \uae38\uc548\ub0b4 \ud074\ub9ad\uc744 \uac10\uc9c0\ud560 \uc218 \uc5c6\uc73c\ubbc0\ub85c, \uc790\ub3d9 \ucd94\ucd9c\uc740 Android \uc571 \uad8c\ud55c \uc124\uc815\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.",
  buildCore: "\uc774\ubc88 \ube4c\ub4dc \ud575\uc2ec",
  core1: "\uad8c\ud55c \uc124\uc815 \ub3c4\uc6b0\ubbf8",
  core2: "\uc811\uadfc\uc131 \uc790\ub3d9 \ucd94\ucd9c \uc548\uc815\ud654",
  core3: "OCR \uc218\ub3d9 \ucea1\ucc98 fallback \uc720\uc9c0",
  changes: "\ubcc0\uacbd\uc0ac\ud56d",
  setup: "\uc124\uce58 \uc21c\uc11c",
  download: "\ub2e4\uc6b4\ub85c\ub4dc",
  apk: "\uad6c\uc5ed \ucd94\ucd9c\uae30 APK \ub2e4\uc6b4\ub85c\ub4dc",
  aab: "AAB \ub2e4\uc6b4\ub85c\ub4dc (\uc2a4\ud1a0\uc5b4 \uc5c5\ub85c\ub4dc\uc6a9)",
  playProtect:
    "Play Protect\uac00 \uc811\uadfc\uc131 \uae30\ub2a5 \ub54c\ubb38\uc5d0 \uacbd\uace0\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \uc77c\ubc18 OCR \ucea1\ucc98 \uae30\ub2a5\uc740 \uacc4\uc18d \uc0ac\uc6a9\ud560 \uc218 \uc788\uace0, \uc790\ub3d9 \ucd94\ucd9c\uc740 \uad8c\ud55c\uc744 \uba85\uc2dc\uc801\uc73c\ub85c \ud5c8\uc6a9\ud55c \uacbd\uc6b0\uc5d0\ub9cc \ub3d9\uc791\ud569\ub2c8\ub2e4.",
  step1: "\uad8c\ud55c \uc900\ube44",
  step2: "\uc8fc\uc18c \ucd94\ucd9c",
  step3: "B\ud3f0\uc73c\ub85c \uc804\uc1a1",
};
const changeLog = [
  "\uad8c\ud55c \uc124\uc815 \ub3c4\uc6b0\ubbf8 \ucd94\uac00: \uc624\ubc84\ub808\uc774, \uc811\uadfc\uc131, \uc54c\ub9bc \uad8c\ud55c\uc744 \uc21c\uc11c\ub300\ub85c \uc548\ub0b4",
  "\uc811\uadfc\uc131 \uc790\ub3d9 \ucd94\ucd9c \uc548\uc815\ud654 \ubc0f \uae30\uc874 OCR \ucea1\ucc98 fallback \uc720\uc9c0",
  "B\ud3f0\uc740 \ubc1b\uc740 \uc8fc\uc18c\ub97c \ub3c4\ucc29\uc9c0\uc5d0\ub9cc \ubc18\uc601\ud558\uace0, \uae38\ucc3e\uae30\ub294 \uc0ac\uc6a9\uc790\uac00 \uc9c1\uc811 \uc2e4\ud589",
];

export const metadata = {
  title: t.meta,
};

export default function ExtractorAndroidInstallPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <section className="overflow-hidden rounded-[28px] border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_42%,#f8fafc_100%)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Extractor Android</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t.title}</h1>
            <p className="mt-2 text-xs font-medium text-slate-500">{t.version} {latestVersion} · {t.updated} {updatedAt}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{t.intro}</p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white/80 px-4 py-3 text-xs leading-5 text-slate-600 shadow-sm">
            <div className="font-semibold text-slate-900">{t.buildCore}</div>
            <div className="mt-1">{t.core1}</div>
            <div>{t.core2}</div>
            <div>{t.core3}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Latest Version</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{latestVersion}</div>
            <div className="mt-1 text-xs text-slate-600">{t.updated} {updatedAt}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div className="text-xs font-semibold text-slate-900">{t.changes}</div>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
              {changeLog.map((item) => <li key={item}>· {item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t.setup}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>1. 아래 APK 다운로드 버튼으로 설치 파일을 내려받습니다.</li>
            <li>2. 설치 차단 안내가 뜨면 브라우저 또는 파일 앱의 설치 허용을 켭니다.</li>
            <li>3. 앱 실행 후 <b>다음 권한 열기</b> 버튼으로 오버레이, 접근성, 알림 권한을 순서대로 확인합니다.</li>
            <li>4. 접근성 권한이 막히면 앱 정보 화면에서 <b>제한된 설정 허용</b>을 먼저 켠 뒤 다시 접근성을 허용합니다.</li>
            <li>5. 기존 구역 추출기가 설치되어 있으면 새 APK를 덮어 설치하면 업데이트됩니다.</li>
          </ol>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t.download}</h2>
          <div className="mt-4 grid gap-3">
            <a href={extractorApkUrl} className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800">
              {t.apk} ({latestVersion})
            </a>
            <a href={extractorAabUrl} className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
              {t.aab}
            </a>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">{t.playProtect}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 1</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{t.step1}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">앱 안의 권한 설정 도우미로 필요한 권한을 차례대로 확인합니다.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 2</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{t.step2}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">길안내 클릭 자동 추출을 우선 사용하고, 실패하면 OCR 버튼 또는 스크린샷 선택으로 보완합니다.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 3</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{t.step3}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">같은 계정이면 B폰 메인 앱의 도착지 목록으로 주소가 들어갑니다. 길찾기는 B폰에서 직접 선택합니다.</p>
        </div>
      </section>
    </main>
  );
}

const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || "";
const playUrl = process.env.NEXT_PUBLIC_ANDROID_PLAY_URL?.trim() || "";
const latestVersion = process.env.NEXT_PUBLIC_ANDROID_LATEST_VERSION?.trim() || "1.0.1";
const updatedAt = "2026-04-19";
const changeLog = [
  "외부 길찾기 복귀 후 최신 상태 복원 강화",
  "받은 주소 자동 적용/자동 길안내 옵션 정리",
  "모바일 UI 및 네이티브 권한 흐름 안정화",
];

export const metadata = {
  title: "퀵배달 메이커 | Android 설치 안내",
};

export default function AndroidInstallPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Android Install</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">퀵배달 메이커 APK 설치</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          안드로이드에서는 스토어 등록 없이 APK 링크로 직접 설치할 수 있습니다. 설치 전
          <span className="font-medium text-slate-900"> 출처를 알 수 없는 앱 설치 허용</span>이 필요할 수 있습니다.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Latest Version</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{latestVersion}</div>
            <div className="mt-1 text-xs text-slate-600">업데이트 날짜 {updatedAt}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-900">변경사항</div>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
              {changeLog.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">설치 순서</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <li>1. 아래 APK 다운로드 버튼으로 설치 파일을 내려받습니다.</li>
          <li>2. Android의 설치 차단 안내가 뜨면 브라우저 또는 파일 앱에 설치 허용 권한을 켭니다.</li>
          <li>3. 앱 실행 후 위치, 카메라, 마이크 권한을 필요 시 허용합니다.</li>
          <li>4. 기존 앱이 있으면 새 APK를 덮어 설치해 업데이트할 수 있습니다.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">다운로드</h2>
        {apkUrl || playUrl ? (
          <div className="mt-4 space-y-4">
            {playUrl ? (
              <a
                href={playUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Google Play에서 설치
              </a>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Google Play 등록은 준비 중입니다. 지금은 아래 APK 다운로드로 바로 설치할 수 있습니다.
              </div>
            )}
            {apkUrl ? (
              <a
                href={apkUrl}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800"
              >
                APK 다운로드 ({latestVersion})
              </a>
            ) : null}
            <p className="text-xs leading-5 text-slate-500">
              APK는 스토어 없이 직접 설치하는 용도이고, Play 링크가 준비되면 같은 페이지에서 함께 제공됩니다.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            아직 공개 APK 링크가 설정되지 않았습니다. 관리자 측에서 APK를 업로드하면 이 페이지에서 바로 설치할 수 있습니다.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">권장 배포 방식</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
          <li>- 테스트/사내 배포: APK 링크 직접 배포</li>
          <li>- 정식 배포: Google Play Console 내부 테스트 후 프로덕션 출시</li>
          <li>- iPhone: APK 설치 불가, 홈 화면 추가(PWA) 방식 권장</li>
        </ul>
      </section>
    </main>
  );
}

const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() || "";

export const metadata = {
  title: "안드로이드 설치 안내 | 퀵·배달 구역메이커",
};

export default function AndroidInstallPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Android Install</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">퀵·배달 구역메이커 APK 설치</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          안드로이드에서는 스토어 등록 없이 APK 링크로 직접 설치할 수 있습니다. 설치 전에{" "}
          <span className="font-medium text-slate-900">알 수 없는 앱 설치 허용</span>이 필요할 수 있습니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">설치 순서</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <li>1. 아래 다운로드 버튼으로 APK를 내려받습니다.</li>
          <li>2. 설치 차단 안내가 나오면 이 브라우저의 설치 허용 권한을 켭니다.</li>
          <li>3. 설치 후 첫 실행 시 위치/카메라/알림 권한을 확인합니다.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">다운로드</h2>
        {apkUrl ? (
          <div className="mt-4 space-y-4">
            <a
              href={apkUrl}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800"
            >
              APK 다운로드
            </a>
            <p className="text-xs leading-5 text-slate-500">
              링크는 관리자가 갱신합니다. 설치가 막히면 브라우저 다운로드 권한과 알 수 없는 앱 설치 허용을 확인하세요.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            아직 공개 APK 링크가 설정되지 않았습니다. 관리자가 APK 파일을 업로드한 뒤 이 화면에서 바로 설치할 수 있습니다.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">권장 배포 방식</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
          <li>- 테스트/내부 배포: APK 링크 직접 배포</li>
          <li>- 정식 배포: Google Play Console 내부 테스트 → 정식 출시</li>
          <li>- iPhone: APK 설치 불가, 홈 화면 추가(PWA) 방식 권장</li>
        </ul>
      </section>
    </main>
  );
}

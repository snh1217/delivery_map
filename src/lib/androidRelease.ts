// GitHub Releases에 올라간 최신 Android APK 정보를 조회합니다.
// .github/workflows/android-release.yml 이 build.gradle 버전으로 릴리스를 자동 생성합니다.
const RELEASES_API = "https://api.github.com/repos/snh1217/delivery_map/releases?per_page=10";
const MAIN_APK_PATTERN = /^delivery-map-.*\.apk$/i;

export type AndroidReleaseInfo = {
  version: string;
  apkUrl: string;
  publishedAt: string | null;
};

type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: { name: string; browser_download_url: string }[];
};

export async function fetchLatestAndroidRelease(): Promise<AndroidReleaseInfo | null> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const releases = (await response.json()) as GithubRelease[];
    for (const release of releases) {
      if (release.draft || release.prerelease) continue;
      const asset = release.assets.find((item) => MAIN_APK_PATTERN.test(item.name));
      if (!asset) continue;
      return {
        version: release.tag_name.replace(/^v/i, ""),
        apkUrl: asset.browser_download_url,
        publishedAt: release.published_at,
      };
    }
  } catch {
    // GitHub 조회 실패 시 환경변수 값으로 대체됩니다.
  }
  return null;
}

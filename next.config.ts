import type { NextConfig } from "next";

// 배포마다 달라지는 빌드 식별자. 클라이언트가 서버와 비교해 새 배포를 감지합니다.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: buildId,
  },
};

export default nextConfig;

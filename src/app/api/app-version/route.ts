import { NextResponse } from "next/server";
import { fetchLatestAndroidRelease } from "@/lib/androidRelease";
import { APP_BUILD_ID, CURRENT_RELEASE } from "@/lib/appRelease";

export const dynamic = "force-dynamic";

export async function GET() {
  const android = await fetchLatestAndroidRelease();
  return NextResponse.json(
    { buildId: APP_BUILD_ID, release: CURRENT_RELEASE, android },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

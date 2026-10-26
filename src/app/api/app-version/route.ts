import { NextResponse } from "next/server";
import { APP_BUILD_ID, CURRENT_RELEASE } from "@/lib/appRelease";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildId: APP_BUILD_ID, release: CURRENT_RELEASE },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
